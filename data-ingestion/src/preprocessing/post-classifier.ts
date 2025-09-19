import { ProcessedCommitData, ClassificationData } from '../models/processed-commit';
import { Logger } from '../utils/logger';

export class PostClassifier {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('PostClassifier');
  }

  /**
   * Post-process LLM classification results to improve accuracy
   */
  public postProcessClassifications(commits: ProcessedCommitData[]): ProcessedCommitData[] {
    this.logger.info(`Post-processing classifications for ${commits.length} commits`);
    
    let reclassifiedCount = 0;
    
    const processedCommits = commits.map(commit => {
      const originalType = commit.classification.type;
      const newClassification = this.reclassifyCommit(commit);
      
      if (newClassification.type !== originalType) {
        reclassifiedCount++;
        this.logger.debug(`Reclassified commit ${commit.commit_id.substring(0, 8)} from ${originalType} to ${newClassification.type}`);
        
        return {
          ...commit,
          classification: {
            ...newClassification,
            reasoning: `Post-processed: ${newClassification.reasoning} (Originally: ${originalType})`
          }
        };
      }
      
      return commit;
    });
    
    this.logger.info(`Post-processing complete: ${reclassifiedCount} commits reclassified`);
    return processedCommits;
  }

  /**
   * Reclassify a single commit based on additional analysis
   */
  private reclassifyCommit(commit: ProcessedCommitData): ClassificationData {
    const { message, diff, files } = commit;
    const textToAnalyze = [message, diff.substring(0, 2000), ...files.map(f => f.path)].join(' ').toLowerCase();
    
    // If already classified as fix, version_update, patch, or error, keep it
    if (['fix', 'version_update', 'patch', 'error'].includes(commit.classification.type)) {
      return commit.classification;
    }
    
    // Reclassify from "other" to more specific categories
    const newType = this.analyzeCommitContent(textToAnalyze, message, files);
    
    if (newType !== 'other') {
      return {
        ...commit.classification,
        type: newType,
        confidence: Math.min(commit.classification.confidence + 0.1, 1.0), // Boost confidence slightly
        reasoning: `Post-classified as ${newType} based on content analysis`
      };
    }
    
    return commit.classification;
  }

  /**
   * Analyze commit content to determine better classification
   */
  private analyzeCommitContent(textToAnalyze: string, message: string, files: any[]): string {
    // Version update patterns
    const versionPatterns = [
      /(?:update|upgrade|bump|version|release|v\d+\.\d+)/i,
      /(?:compatibility|forward compatibility|backward compatibility)/i,
      /(?:graphdef|schema|protocol).*version/i,
      /(?:library|framework|dependency).*update/i,
      /(?:api|interface).*version/i
    ];
    
    if (versionPatterns.some(pattern => pattern.test(textToAnalyze))) {
      return 'version_update';
    }
    
    // Fix patterns
    const fixPatterns = [
      /(?:fix|fixed|fixes|bug|issue|problem|error|bugfix)/i,
      /(?:build|compilation|test).*fix/i,
      /(?:performance|memory|optimization).*fix/i,
      /(?:api|interface|signature).*fix/i,
      /(?:configuration|setup).*fix/i,
      /(?:correct|correction|resolve|resolved)/i,
      /(?:patch|hotfix|critical|urgent)/i
    ];
    
    if (fixPatterns.some(pattern => pattern.test(textToAnalyze))) {
      return 'fix';
    }
    
    // Error patterns
    const errorPatterns = [
      /(?:error|exception|crash|fail|failure|timeout|memory leak)/i,
      /(?:test.*fail|ci.*fail|build.*fail|travis|jenkins)/i,
      /(?:exception|error).*handling/i,
      /(?:debug|logging|diagnostic)/i,
      /(?:recovery|retry|fallback)/i
    ];
    
    if (errorPatterns.some(pattern => pattern.test(textToAnalyze))) {
      return 'error';
    }
    
    // Patch patterns
    const patchPatterns = [
      /(?:security|vulnerability|critical|urgent|hotfix)/i,
      /(?:patch|hotfix|critical.*fix|urgent.*fix)/i,
      /(?:emergency|immediate|asap)/i
    ];
    
    if (patchPatterns.some(pattern => pattern.test(textToAnalyze))) {
      return 'patch';
    }
    
    // File-based analysis
    const filePaths = files.map(f => f.path).join(' ').toLowerCase();
    
    // Version-related files
    if (filePaths.includes('version') || filePaths.includes('requirements') || 
        filePaths.includes('package.json') || filePaths.includes('setup.py') ||
        filePaths.includes('pom.xml') || filePaths.includes('cargo.toml')) {
      return 'version_update';
    }
    
    // Test files with fixes
    if (filePaths.includes('test') && (textToAnalyze.includes('fix') || textToAnalyze.includes('correct'))) {
      return 'fix';
    }
    
    // Error-related files
    if (filePaths.includes('error') || filePaths.includes('exception') || 
        filePaths.includes('debug') || filePaths.includes('log')) {
      return 'error';
    }
    
    return 'other';
  }

  /**
   * Get post-processing statistics
   */
  public getPostProcessingStats(originalCommits: ProcessedCommitData[], processedCommits: ProcessedCommitData[]): {
    total: number;
    reclassified: number;
    originalBreakdown: { [key: string]: number };
    finalBreakdown: { [key: string]: number };
  } {
    const originalBreakdown: { [key: string]: number } = {};
    const finalBreakdown: { [key: string]: number } = {};
    
    for (const commit of originalCommits) {
      const type = commit.classification.type;
      originalBreakdown[type] = (originalBreakdown[type] || 0) + 1;
    }
    
    for (const commit of processedCommits) {
      const type = commit.classification.type;
      finalBreakdown[type] = (finalBreakdown[type] || 0) + 1;
    }
    
    const reclassified = originalCommits.filter((commit, index) => 
      commit.classification.type !== processedCommits[index].classification.type
    ).length;
    
    return {
      total: originalCommits.length,
      reclassified,
      originalBreakdown,
      finalBreakdown
    };
  }
}
