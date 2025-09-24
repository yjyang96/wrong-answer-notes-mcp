import { CommitData } from '../models/commit';
import { ClassificationData } from '../models/processed-commit';
import { Logger } from '../utils/logger';

export class FieldExtractor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('FieldExtractor');
  }

  /**
   * Extract structured fields from commit data and classification
   */
  public extractFields(commit: CommitData, classification: ClassificationData): ClassificationData {
    this.logger.debug(`Extracting fields for commit ${commit.hash.substring(0, 8)}`);

    const enhancedClassification: ClassificationData = { ...classification };

    // Extract package name if not already provided
    if (!enhancedClassification.package_name) {
      enhancedClassification.package_name = this.extractPackageName(commit);
    }

    // Extract version if not already provided
    if (!enhancedClassification.version) {
      enhancedClassification.version = this.extractVersion(commit);
    }

    // Extract error type if not already provided
    if (!enhancedClassification.error_type && classification.type === 'error') {
      enhancedClassification.error_type = this.extractErrorType(commit);
    }

    // Extract API signature if not already provided
    if (!enhancedClassification.api_signature) {
      enhancedClassification.api_signature = this.extractAPISignature(commit);
    }

    return enhancedClassification;
  }

  /**
   * Extract package name from commit data
   */
  private extractPackageName(commit: CommitData): string | undefined {
    const textToAnalyze = [
      commit.message,
      ...commit.files.map(f => f.path),
      commit.diff.substring(0, 2000)
    ].join(' ');

    // Common package patterns
    const packagePatterns = [
      // Python packages
      /(?:from|import)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
      /setup\(.*?name=['"]([^'"]+)['"]/g,
      /requirements\.txt.*?([a-zA-Z0-9_-]+)==/g,
      
      // Node.js packages
      /package\.json.*?"name":\s*"([^"]+)"/g,
      /npm\s+(?:install|add)\s+([a-zA-Z0-9_-]+)/g,
      
      // Java packages
      /groupId.*?([a-zA-Z0-9_.-]+)/g,
      /artifactId.*?([a-zA-Z0-9_.-]+)/g,
      
      // Go modules
      /module\s+([a-zA-Z0-9_.-]+)/g,
      /import\s+["']([a-zA-Z0-9_.-]+)["']/g,
      
      // C++/C# namespaces
      /namespace\s+([a-zA-Z0-9_.]+)/g,
      /using\s+([a-zA-Z0-9_.]+)/g,
      
      // Generic patterns
      /([a-zA-Z0-9_-]+)\s+v?\d+\.\d+/g,
      /update\s+([a-zA-Z0-9_-]+)/gi
    ];

    for (const pattern of packagePatterns) {
      const matches = textToAnalyze.match(pattern);
      if (matches && matches.length > 0) {
        // Extract the package name from the match
        const match = matches[0];
        const packageName = this.cleanPackageName(match);
        if (packageName && packageName.length > 2) {
          this.logger.debug(`Extracted package name: ${packageName}`);
          return packageName;
        }
      }
    }

    // Try to extract from file paths
    const packageFromPath = this.extractPackageFromPath(commit.files);
    if (packageFromPath) {
      return packageFromPath;
    }

    return undefined;
  }

  /**
   * Extract version information from commit data
   */
  private extractVersion(commit: CommitData): string | undefined {
    const textToAnalyze = [
      commit.message,
      commit.diff.substring(0, 2000)
    ].join(' ');

    // Version patterns
    const versionPatterns = [
      /v?(\d+\.\d+\.\d+)/g,  // Semantic versioning
      /v?(\d+\.\d+)/g,       // Major.minor
      /version\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
      /VERSION\s*[:=]\s*["']?([^"'\s]+)["']?/g,
      /(\d+\.\d+\.\d+\.\d+)/g, // Four-part version
      /bump.*?to\s+v?(\d+\.\d+\.\d+)/gi,
      /update.*?to\s+v?(\d+\.\d+\.\d+)/gi
    ];

    for (const pattern of versionPatterns) {
      const matches = textToAnalyze.match(pattern);
      if (matches && matches.length > 0) {
        const version = matches[0].replace(/[^\d.]/g, '');
        if (version && version.length > 0) {
          this.logger.debug(`Extracted version: ${version}`);
          return version;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract error type from commit data
   */
  private extractErrorType(commit: CommitData): string | undefined {
    const textToAnalyze = [
      commit.message,
      commit.diff.substring(0, 1000)
    ].join(' ').toLowerCase();

    const errorTypes = [
      'null pointer exception',
      'index out of bounds',
      'memory leak',
      'segmentation fault',
      'timeout',
      'connection error',
      'authentication error',
      'permission denied',
      'file not found',
      'syntax error',
      'type error',
      'runtime error',
      'compilation error',
      'build error',
      'test failure',
      'assertion error',
      'validation error',
      'parsing error',
      'serialization error',
      'network error'
    ];

    for (const errorType of errorTypes) {
      if (textToAnalyze.includes(errorType)) {
        this.logger.debug(`Extracted error type: ${errorType}`);
        return errorType;
      }
    }

    // Generic error patterns
    const genericPatterns = [
      /error\s+in\s+([a-zA-Z0-9_.-]+)/g,
      /failed\s+to\s+([a-zA-Z0-9_.-]+)/g,
      /exception\s+in\s+([a-zA-Z0-9_.-]+)/g
    ];

    for (const pattern of genericPatterns) {
      const matches = textToAnalyze.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }

    return undefined;
  }

  /**
   * Extract API signature from commit data
   */
  private extractAPISignature(commit: CommitData): string | undefined {
    const diff = commit.diff;

    // Function/method signature patterns
    const signaturePatterns = [
      // Python
      /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g,
      /class\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      
      // JavaScript/TypeScript
      /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)/g,
      /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\([^)]*\)\s*=>/g,
      /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
      
      // Java
      /(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?(?:[a-zA-Z0-9_.]+\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g,
      
      // C++
      /(?:[a-zA-Z0-9_:]+\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*{/g,
      
      // C#
      /(?:public|private|protected|internal)\s+(?:static\s+)?(?:[a-zA-Z0-9_.]+\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g
    ];

    const signatures: string[] = [];

    for (const pattern of signaturePatterns) {
      const matches = diff.match(pattern);
      if (matches) {
        signatures.push(...matches.slice(0, 3)); // Limit to first 3 matches
      }
    }

    if (signatures.length > 0) {
      const signature = signatures[0].trim();
      this.logger.debug(`Extracted API signature: ${signature}`);
      return signature;
    }

    return undefined;
  }

  /**
   * Extract package name from file paths
   */
  private extractPackageFromPath(files: any[]): string | undefined {
    const pathPatterns = [
      /([a-zA-Z0-9_-]+)\/src\//,
      /([a-zA-Z0-9_-]+)\/lib\//,
      /([a-zA-Z0-9_-]+)\/package\.json/,
      /([a-zA-Z0-9_-]+)\/setup\.py/,
      /([a-zA-Z0-9_-]+)\/pom\.xml/,
      /([a-zA-Z0-9_-]+)\/Cargo\.toml/
    ];

    for (const file of files) {
      for (const pattern of pathPatterns) {
        const match = file.path.match(pattern);
        if (match && match[1]) {
          const packageName = match[1];
          if (packageName.length > 2 && !['src', 'lib', 'test', 'tests'].includes(packageName)) {
            return packageName;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Clean and normalize package name
   */
  private cleanPackageName(name: string): string {
    return name
      .replace(/['"]/g, '')
      .replace(/[^\w.-]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Get extraction statistics
   */
  public getExtractionStats(commits: CommitData[], classifications: ClassificationData[]): {
    total: number;
    withPackageName: number;
    withVersion: number;
    withErrorType: number;
    withAPISignature: number;
  } {
    let withPackageName = 0;
    let withVersion = 0;
    let withErrorType = 0;
    let withAPISignature = 0;

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const classification = classifications[i];
      const extracted = this.extractFields(commit, classification);

      if (extracted.package_name) withPackageName++;
      if (extracted.version) withVersion++;
      if (extracted.error_type) withErrorType++;
      if (extracted.api_signature) withAPISignature++;
    }

    return {
      total: commits.length,
      withPackageName,
      withVersion,
      withErrorType,
      withAPISignature
    };
  }
}
