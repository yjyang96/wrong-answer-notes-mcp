import { CommitData } from '../models/commit';
import { FilteringRule } from '../models/processed-commit';
import { Logger } from '../utils/logger';

export class RuleBasedFilter {
  private logger: Logger;
  private rules: FilteringRule[];

  constructor() {
    this.logger = new Logger('RuleBasedFilter');
    this.rules = this.initializeRules();
  }

  private initializeRules(): FilteringRule[] {
    return [
      // Version Update Rules
      {
        name: 'version_update_keywords',
        pattern: /(?:update|upgrade|bump|version|release|v\d+\.\d+)/i,
        weight: 0.8,
        category: 'version_update'
      },
      {
        name: 'dependency_update',
        pattern: /(?:dependabot|dependencies?|package\.json|requirements\.txt|setup\.py|pom\.xml)/i,
        weight: 0.9,
        category: 'version_update'
      },
      {
        name: 'version_file_changes',
        pattern: /(?:version\.h|VERSION|CHANGELOG|RELEASE_NOTES)/i,
        weight: 0.7,
        category: 'version_update'
      },

      // Fix Rules
      {
        name: 'fix_keywords',
        pattern: /(?:fix|fixed|fixes|bug|issue|problem|error|bugfix)/i,
        weight: 0.8,
        category: 'fix'
      },
      {
        name: 'patch_keywords',
        pattern: /(?:patch|hotfix|critical|urgent|security)/i,
        weight: 0.9,
        category: 'patch'
      },

      // Error Rules
      {
        name: 'error_keywords',
        pattern: /(?:error|exception|crash|fail|failure|timeout|memory leak)/i,
        weight: 0.7,
        category: 'error'
      },
      {
        name: 'test_failure',
        pattern: /(?:test.*fail|ci.*fail|build.*fail|travis|jenkins)/i,
        weight: 0.6,
        category: 'error'
      },

      // API/Code Changes
      {
        name: 'api_changes',
        pattern: /(?:api|interface|signature|method|function|class)/i,
        weight: 0.5,
        category: 'other'
      }
    ];
  }

  /**
   * Apply rule-based filtering to commit data
   */
  public filterCommits(commits: CommitData[]): CommitData[] {
    this.logger.info(`Starting rule-based filtering for ${commits.length} commits`);
    
    const filteredCommits: CommitData[] = [];
    const scores: { [key: string]: number } = {};

    for (const commit of commits) {
      const score = this.calculateCommitScore(commit);
      scores[commit.hash] = score;

      // Include commits with score >= 0.5
      if (score >= 0.5) {
        filteredCommits.push(commit);
        this.logger.debug(`Commit ${commit.hash.substring(0, 8)} passed filter with score ${score.toFixed(2)}`);
      } else {
        this.logger.debug(`Commit ${commit.hash.substring(0, 8)} filtered out with score ${score.toFixed(2)}`);
      }
    }

    this.logger.info(`Filtered ${commits.length} commits down to ${filteredCommits.length} (${((filteredCommits.length / commits.length) * 100).toFixed(1)}%)`);
    
    return filteredCommits;
  }

  /**
   * Calculate relevance score for a commit based on rules
   */
  private calculateCommitScore(commit: CommitData): number {
    let totalScore = 0;
    let matchedRules = 0;

    const textToAnalyze = [
      commit.message,
      ...commit.files.map(f => f.path),
      commit.diff.substring(0, 1000) // Limit diff analysis to first 1000 chars
    ].join(' ').toLowerCase();

    for (const rule of this.rules) {
      if (rule.pattern.test(textToAnalyze)) {
        totalScore += rule.weight;
        matchedRules++;
        this.logger.debug(`Rule '${rule.name}' matched for commit ${commit.hash.substring(0, 8)}`);
      }
    }

    // Normalize score based on number of matched rules
    const normalizedScore = matchedRules > 0 ? totalScore / matchedRules : 0;
    
    return Math.min(normalizedScore, 1.0); // Cap at 1.0
  }

  /**
   * Get detailed analysis for a specific commit
   */
  public analyzeCommit(commit: CommitData): {
    score: number;
    matchedRules: string[];
    category: string;
  } {
    const matchedRules: string[] = [];
    let category = 'other';
    let maxCategoryWeight = 0;

    const textToAnalyze = [
      commit.message,
      ...commit.files.map(f => f.path),
      commit.diff.substring(0, 1000)
    ].join(' ').toLowerCase();

    for (const rule of this.rules) {
      if (rule.pattern.test(textToAnalyze)) {
        matchedRules.push(rule.name);
        
        // Determine primary category based on highest weight
        if (rule.weight > maxCategoryWeight) {
          category = rule.category;
          maxCategoryWeight = rule.weight;
        }
      }
    }

    const score = this.calculateCommitScore(commit);

    return {
      score,
      matchedRules,
      category
    };
  }

  /**
   * Get filtering statistics
   */
  public getFilteringStats(commits: CommitData[]): {
    total: number;
    filtered: number;
    categoryBreakdown: { [key: string]: number };
    averageScore: number;
  } {
    const filtered = this.filterCommits(commits);
    const categoryBreakdown: { [key: string]: number } = {};
    let totalScore = 0;

    for (const commit of commits) {
      const analysis = this.analyzeCommit(commit);
      categoryBreakdown[analysis.category] = (categoryBreakdown[analysis.category] || 0) + 1;
      totalScore += analysis.score;
    }

    return {
      total: commits.length,
      filtered: filtered.length,
      categoryBreakdown,
      averageScore: commits.length > 0 ? totalScore / commits.length : 0
    };
  }
}
