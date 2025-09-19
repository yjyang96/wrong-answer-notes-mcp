import { CommitData } from '../models/commit';
import { ProcessedCommitData, ClassificationData, QualityMetrics } from '../models/processed-commit';
import { RuleBasedFilter } from '../preprocessing/rule-filter';
import { AzureOpenAIService } from '../llm/azure-openai';
import { FieldExtractor } from '../preprocessing/field-extractor';
import { QualityValidator } from '../validation/quality-validator';
import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export class PreprocessingService {
  private logger: Logger;
  private ruleFilter: RuleBasedFilter;
  private llmService: AzureOpenAIService;
  private fieldExtractor: FieldExtractor;
  private qualityValidator: QualityValidator;

  constructor() {
    this.logger = new Logger('PreprocessingService');
    this.ruleFilter = new RuleBasedFilter();
    this.llmService = new AzureOpenAIService();
    this.fieldExtractor = new FieldExtractor();
    this.qualityValidator = new QualityValidator();
  }

  /**
   * Main preprocessing pipeline
   */
  public async preprocessCommits(commits: CommitData[]): Promise<ProcessedCommitData[]> {
    this.logger.info(`Starting preprocessing pipeline for ${commits.length} commits`);

    try {
      // Stage 1: Rule-based filtering
      console.log('🔍 Stage 1: Applying rule-based filtering...');
      this.logger.info('Stage 1: Applying rule-based filtering');
      const filteredCommits = this.ruleFilter.filterCommits(commits);
      console.log(`   → Filtered ${commits.length} commits down to ${filteredCommits.length} (${((filteredCommits.length / commits.length) * 100).toFixed(1)}%)`);
      this.logger.info(`Filtered ${commits.length} commits down to ${filteredCommits.length}`);

      if (filteredCommits.length === 0) {
        this.logger.warn('No commits passed rule-based filtering');
        return [];
      }

      // Stage 2: LLM classification
      console.log('🤖 Stage 2: Performing LLM classification...');
      this.logger.info('Stage 2: Performing LLM classification');
      const classifications = await this.performLLMClassification(filteredCommits);
      console.log(`   → Classified ${classifications.length} commits`);

      // Stage 3: Field extraction
      console.log('📊 Stage 3: Extracting structured fields...');
      this.logger.info('Stage 3: Extracting structured fields');
      const processedCommits = this.extractStructuredFields(filteredCommits, classifications);
      console.log(`   → Extracted fields for ${processedCommits.length} commits`);

      // Stage 4: Filter relevant commits (exclude "other" category)
      console.log('🎯 Stage 4: Filtering relevant commits for wrong answer notes...');
      this.logger.info('Stage 4: Filtering relevant commits');
      const relevantCommits = this.filterRelevantCommits(processedCommits);
      console.log(`   → Filtered to ${relevantCommits.length} relevant commits (${((relevantCommits.length / processedCommits.length) * 100).toFixed(1)}%)`);

      // Stage 5: Quality validation
      console.log('✅ Stage 5: Validating data quality...');
      this.logger.info('Stage 5: Validating data quality');
      const validation = this.qualityValidator.validateBatch(relevantCommits);
      console.log(`   → Validation complete: ${validation.valid.length} valid, ${validation.warnings.length} warnings, ${validation.invalid.length} invalid`);

      this.logger.info(`Preprocessing complete: ${validation.valid.length} valid, ${validation.warnings.length} warnings, ${validation.invalid.length} invalid`);

      return relevantCommits;
    } catch (error) {
      this.logger.error(`Preprocessing failed: ${error}`);
      throw error;
    }
  }

  /**
   * Perform LLM classification on filtered commits
   */
  private async performLLMClassification(commits: CommitData[]): Promise<ClassificationData[]> {
    const requests = commits.map(commit => ({
      commit_message: commit.message,
      diff_summary: this.createDiffSummary(commit.diff),
      file_changes: commit.files.map(f => f.path)
    }));

    try {
      const llmResponses = await this.llmService.batchClassifyCommits(requests);
      
      return llmResponses.map((response, index) => ({
        type: response.type as any,
        confidence: response.confidence,
        package_name: response.package_name,
        version: response.version,
        error_type: response.error_type,
        api_signature: response.api_signature,
        reasoning: response.reasoning
      }));
    } catch (error) {
      this.logger.error(`LLM classification failed: ${error}`);
      // Fallback to rule-based classification
      return commits.map(commit => this.fallbackClassification(commit));
    }
  }

  /**
   * Create a summary of the diff for LLM processing
   */
  private createDiffSummary(diff: string): string {
    // Limit diff size and extract key information
    const maxLength = 2000;
    if (diff.length <= maxLength) {
      return diff;
    }

    // Extract first part and last part of diff
    const firstPart = diff.substring(0, maxLength / 2);
    const lastPart = diff.substring(diff.length - maxLength / 2);
    
    return `${firstPart}\n... [truncated] ...\n${lastPart}`;
  }

  /**
   * Fallback classification when LLM fails
   */
  private fallbackClassification(commit: CommitData): ClassificationData {
    const analysis = this.ruleFilter.analyzeCommit(commit);
    
    return {
      type: analysis.category as any,
      confidence: Math.max(0.3, analysis.score),
      reasoning: `Fallback classification based on rule analysis. Matched rules: ${analysis.matchedRules.join(', ')}`
    };
  }

  /**
   * Filter commits to include only relevant categories for wrong answer notes
   */
  private filterRelevantCommits(commits: ProcessedCommitData[]): ProcessedCommitData[] {
    const relevantCategories = ['fix', 'version_update', 'error', 'patch'];
    
    const relevantCommits = commits.filter(commit => {
      const isRelevant = relevantCategories.includes(commit.classification.type);
      if (!isRelevant) {
        this.logger.debug(`Excluding commit ${commit.commit_id.substring(0, 8)} - category: ${commit.classification.type}`);
      }
      return isRelevant;
    });
    
    this.logger.info(`Filtered ${commits.length} commits to ${relevantCommits.length} relevant commits`);
    
    // Log category breakdown for relevant commits
    const categoryBreakdown: { [key: string]: number } = {};
    for (const commit of relevantCommits) {
      const category = commit.classification.type;
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    }
    
    this.logger.info('Relevant commits breakdown:', categoryBreakdown);
    
    return relevantCommits;
  }

  /**
   * Extract structured fields from commits and classifications
   */
  private extractStructuredFields(commits: CommitData[], classifications: ClassificationData[]): ProcessedCommitData[] {
    return commits.map((commit, index) => {
      const classification = classifications[index];
      const enhancedClassification = this.fieldExtractor.extractFields(commit, classification);

      return {
        commit_id: commit.hash,
        repository: commit.repository.fullName,
        branch: commit.branch,
        message: commit.message,
        diff: commit.diff,
        author: commit.author.name,
        date: commit.date,
        classification: enhancedClassification,
        metadata: {
          processed_at: new Date().toISOString(),
          quality_score: 0, // Will be set by validator
          validation_status: 'valid', // Will be set by validator
          original_commit_hash: commit.hash,
          preprocessing_stage: 'extracted'
        }
      };
    });
  }

  /**
   * Save processed commits to JSON file
   */
  public async saveProcessedCommits(commits: ProcessedCommitData[], outputPath: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(commits, null, 2));
      this.logger.info(`Saved ${commits.length} processed commits to ${outputPath}`);
    } catch (error) {
      this.logger.error(`Failed to save processed commits: ${error}`);
      throw error;
    }
  }

  /**
   * Load processed commits from JSON file
   */
  public async loadProcessedCommits(inputPath: string): Promise<ProcessedCommitData[]> {
    try {
      const data = await fs.readFile(inputPath, 'utf-8');
      const commits = JSON.parse(data) as ProcessedCommitData[];
      this.logger.info(`Loaded ${commits.length} processed commits from ${inputPath}`);
      return commits;
    } catch (error) {
      this.logger.error(`Failed to load processed commits: ${error}`);
      throw error;
    }
  }

  /**
   * Generate preprocessing report
   */
  public generateReport(commits: ProcessedCommitData[]): {
    summary: QualityMetrics;
    categoryBreakdown: { [key: string]: number };
    confidenceDistribution: { [key: string]: number };
    qualityDistribution: { [key: string]: number };
    recommendations: string[];
    consistency: { isConsistent: boolean; issues: string[] };
  } {
    const report = this.qualityValidator.generateQualityReport(commits);
    const consistency = this.qualityValidator.checkConsistency(commits);

    return {
      ...report,
      consistency
    };
  }

  /**
   * Test preprocessing pipeline with sample data
   */
  public async testPipeline(): Promise<boolean> {
    try {
      this.logger.info('Testing preprocessing pipeline components');

      // Test LLM connection
      const llmConnected = await this.llmService.testConnection();
      if (!llmConnected) {
        this.logger.warn('LLM service connection test failed - will use fallback classification');
      }

      // Test with sample commit
      const sampleCommit: CommitData = {
        hash: 'test123',
        message: 'Fix memory leak in tensor operations',
        author: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
        committer: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
        date: new Date(),
        branch: 'main',
        diff: 'diff --git a/tensor.py b/tensor.py\n+def fix_memory_leak():\n+    pass',
        files: [
          { path: 'tensor.py', type: 'modified', additions: 2, deletions: 0 }
        ],
        repository: {
          name: 'test-repo',
          fullName: 'test/test-repo',
          url: 'https://github.com/test/test-repo',
          description: 'Test repository',
          defaultBranch: 'main',
          language: 'Python',
          size: 1000,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        metadata: {
          collectedAt: new Date(),
          source: 'github-api',
          version: '1.0.0',
          config: { branches: [] }
        }
      };

      const processed = await this.preprocessCommits([sampleCommit]);
      
      if (processed.length > 0) {
        this.logger.info('Pipeline test successful');
        return true;
      } else {
        this.logger.error('Pipeline test failed - no processed commits returned');
        return false;
      }
    } catch (error) {
      this.logger.error(`Pipeline test failed: ${error}`);
      return false;
    }
  }
}
