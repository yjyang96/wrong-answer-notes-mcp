import { ProcessedCommitData, QualityMetrics } from '../models/processed-commit';
import { Logger } from '../utils/logger';

export class QualityValidator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('QualityValidator');
  }

  /**
   * Validate processed commit data quality
   */
  public validateProcessedCommit(commit: ProcessedCommitData): {
    isValid: boolean;
    qualityScore: number;
    validationStatus: 'valid' | 'warning' | 'invalid';
    issues: string[];
  } {
    const issues: string[] = [];
    let qualityScore = 1.0;

    // Check required fields
    if (!commit.commit_id || commit.commit_id.length < 7) {
      issues.push('Invalid or missing commit ID');
      qualityScore -= 0.3;
    }

    if (!commit.message || commit.message.length < 10) {
      issues.push('Commit message too short or missing');
      qualityScore -= 0.2;
    }

    if (!commit.classification.type) {
      issues.push('Missing classification type');
      qualityScore -= 0.3;
    }

    if (commit.classification.confidence < 0.1) {
      issues.push('Very low confidence score');
      qualityScore -= 0.2;
    }

    // Check classification quality
    if (commit.classification.type === 'version_update' && !commit.classification.package_name) {
      issues.push('Version update without package name');
      qualityScore -= 0.1;
    }

    if (commit.classification.type === 'version_update' && !commit.classification.version) {
      issues.push('Version update without version information');
      qualityScore -= 0.1;
    }

    if (commit.classification.type === 'error' && !commit.classification.error_type) {
      issues.push('Error classification without error type');
      qualityScore -= 0.1;
    }

    // Check diff quality
    if (!commit.diff || commit.diff.length < 50) {
      issues.push('Diff too short or missing');
      qualityScore -= 0.1;
    }

    // Check metadata quality
    if (!commit.metadata.processed_at) {
      issues.push('Missing processing timestamp');
      qualityScore -= 0.05;
    }

    // Determine validation status
    let validationStatus: 'valid' | 'warning' | 'invalid';
    if (qualityScore >= 0.8) {
      validationStatus = 'valid';
    } else if (qualityScore >= 0.5) {
      validationStatus = 'warning';
    } else {
      validationStatus = 'invalid';
    }

    // Ensure quality score is between 0 and 1
    qualityScore = Math.max(0, Math.min(1, qualityScore));

    return {
      isValid: validationStatus !== 'invalid',
      qualityScore,
      validationStatus,
      issues
    };
  }

  /**
   * Validate batch of processed commits
   */
  public validateBatch(commits: ProcessedCommitData[]): {
    valid: ProcessedCommitData[];
    warnings: ProcessedCommitData[];
    invalid: ProcessedCommitData[];
    metrics: QualityMetrics;
  } {
    this.logger.info(`Validating batch of ${commits.length} processed commits`);

    const valid: ProcessedCommitData[] = [];
    const warnings: ProcessedCommitData[] = [];
    const invalid: ProcessedCommitData[] = [];

    let totalConfidence = 0;
    let highConfidenceCount = 0;

    for (const commit of commits) {
      const validation = this.validateProcessedCommit(commit);
      
      // Update commit metadata with validation results
      commit.metadata.quality_score = validation.qualityScore;
      commit.metadata.validation_status = validation.validationStatus;

      if (validation.validationStatus === 'valid') {
        valid.push(commit);
      } else if (validation.validationStatus === 'warning') {
        warnings.push(commit);
      } else {
        invalid.push(commit);
      }

      totalConfidence += commit.classification.confidence;
      if (commit.classification.confidence >= 0.8) {
        highConfidenceCount++;
      }

      if (validation.issues.length > 0) {
        this.logger.debug(`Commit ${commit.commit_id.substring(0, 8)} has issues: ${validation.issues.join(', ')}`);
      }
    }

    const metrics: QualityMetrics = {
      total_commits: commits.length,
      filtered_commits: commits.length, // All commits passed initial filtering
      classified_commits: commits.length,
      high_confidence_commits: highConfidenceCount,
      average_confidence: commits.length > 0 ? totalConfidence / commits.length : 0,
      quality_score: commits.length > 0 ? 
        (valid.length * 1.0 + warnings.length * 0.7 + invalid.length * 0.3) / commits.length : 0
    };

    this.logger.info(`Validation complete: ${valid.length} valid, ${warnings.length} warnings, ${invalid.length} invalid`);
    this.logger.info(`Overall quality score: ${metrics.quality_score.toFixed(3)}`);

    return {
      valid,
      warnings,
      invalid,
      metrics
    };
  }

  /**
   * Generate quality report
   */
  public generateQualityReport(commits: ProcessedCommitData[]): {
    summary: QualityMetrics;
    categoryBreakdown: { [key: string]: number };
    confidenceDistribution: { [key: string]: number };
    qualityDistribution: { [key: string]: number };
    recommendations: string[];
  } {
    const validation = this.validateBatch(commits);
    const metrics = validation.metrics;

    // Category breakdown
    const categoryBreakdown: { [key: string]: number } = {};
    for (const commit of commits) {
      const category = commit.classification.type;
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    }

    // Confidence distribution
    const confidenceDistribution: { [key: string]: number } = {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0
    };

    for (const commit of commits) {
      const confidence = commit.classification.confidence;
      if (confidence < 0.2) confidenceDistribution['0.0-0.2']++;
      else if (confidence < 0.4) confidenceDistribution['0.2-0.4']++;
      else if (confidence < 0.6) confidenceDistribution['0.4-0.6']++;
      else if (confidence < 0.8) confidenceDistribution['0.6-0.8']++;
      else confidenceDistribution['0.8-1.0']++;
    }

    // Quality distribution
    const qualityDistribution: { [key: string]: number } = {
      'valid': validation.valid.length,
      'warning': validation.warnings.length,
      'invalid': validation.invalid.length
    };

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (metrics.average_confidence < 0.6) {
      recommendations.push('Consider improving LLM classification prompts for better accuracy');
    }
    
    if (validation.invalid.length > commits.length * 0.1) {
      recommendations.push('High number of invalid commits - review filtering rules');
    }
    
    if (validation.warnings.length > commits.length * 0.3) {
      recommendations.push('Many commits with warnings - consider improving field extraction');
    }
    
    if (categoryBreakdown['other'] > commits.length * 0.5) {
      recommendations.push('High percentage of "other" category - consider refining classification rules');
    }

    return {
      summary: metrics,
      categoryBreakdown,
      confidenceDistribution,
      qualityDistribution,
      recommendations
    };
  }

  /**
   * Check data consistency
   */
  public checkConsistency(commits: ProcessedCommitData[]): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check for duplicate commit IDs
    const commitIds = new Set<string>();
    for (const commit of commits) {
      if (commitIds.has(commit.commit_id)) {
        issues.push(`Duplicate commit ID: ${commit.commit_id}`);
      }
      commitIds.add(commit.commit_id);
    }

    // Check date consistency
    for (const commit of commits) {
      const commitDate = new Date(commit.date);
      const processedDate = new Date(commit.metadata.processed_at);
      
      if (processedDate < commitDate) {
        issues.push(`Processed date before commit date for ${commit.commit_id}`);
      }
    }

    // Check classification consistency
    for (const commit of commits) {
      if (commit.classification.type === 'version_update' && !commit.classification.package_name) {
        issues.push(`Version update without package name: ${commit.commit_id}`);
      }
      
      if (commit.classification.type === 'error' && !commit.classification.error_type) {
        issues.push(`Error classification without error type: ${commit.commit_id}`);
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }
}
