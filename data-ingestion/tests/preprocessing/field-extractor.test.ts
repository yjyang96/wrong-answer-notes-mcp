import { FieldExtractor } from '../../src/preprocessing/field-extractor';
import { CommitData } from '../../src/models/commit';
import { ClassificationData } from '../../src/models/processed-commit';

describe('FieldExtractor', () => {
  let extractor: FieldExtractor;
  let sampleCommit: CommitData;
  let sampleClassification: ClassificationData;

  beforeEach(() => {
    extractor = new FieldExtractor();
    sampleCommit = {
      hash: 'abc123',
      message: 'Update tensorflow to version 2.15.0 and fix memory leak',
      author: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
      committer: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
      date: '2025-01-17T10:00:00Z',
      branch: 'main',
      diff: `diff --git a/requirements.txt b/requirements.txt
+tensorflow==2.15.0
diff --git a/tensor.py b/tensor.py
+def fix_memory_leak():
+    pass`,
      files: [
        { path: 'requirements.txt', type: 'modified', additions: 1, deletions: 0 },
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
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-17T10:00:00Z'
      },
      metadata: {
        collected_at: '2025-01-17T10:00:00Z',
        source: 'test',
        validation: { isValid: true, warnings: [] },
        config: { branches: [] }
      }
    };
    sampleClassification = {
      type: 'version_update',
      confidence: 0.8,
      reasoning: 'Test classification'
    };
  });

  describe('extractFields', () => {
    it('should extract package name from commit data', () => {
      const result = extractor.extractFields(sampleCommit, sampleClassification);
      
      expect(result.package_name).toBeDefined();
      expect(result.package_name).toBe('tensorflow');
    });

    it('should extract version from commit data', () => {
      const result = extractor.extractFields(sampleCommit, sampleClassification);
      
      expect(result.version).toBeDefined();
      expect(result.version).toBe('2.15.0');
    });

    it('should preserve existing classification data', () => {
      const result = extractor.extractFields(sampleCommit, sampleClassification);
      
      expect(result.type).toBe(sampleClassification.type);
      expect(result.confidence).toBe(sampleClassification.confidence);
      expect(result.reasoning).toBe(sampleClassification.reasoning);
    });

    it('should extract error type for error classifications', () => {
      const errorCommit: CommitData = {
        ...sampleCommit,
        message: 'Fix null pointer exception in data processing',
        diff: 'diff --git a/processor.py b/processor.py\n+def handle_null_pointer():\n+    pass'
      };
      const errorClassification: ClassificationData = {
        type: 'error',
        confidence: 0.9,
        reasoning: 'Error fix'
      };

      const result = extractor.extractFields(errorCommit, errorClassification);
      
      expect(result.error_type).toBeDefined();
      expect(result.error_type).toBe('null pointer exception');
    });

    it('should extract API signature from diff', () => {
      const apiCommit: CommitData = {
        ...sampleCommit,
        diff: 'diff --git a/api.py b/api.py\n+def process_data(input_data: str) -> dict:\n+    return {"result": "processed"}'
      };

      const result = extractor.extractFields(apiCommit, sampleClassification);
      
      expect(result.api_signature).toBeDefined();
      expect(result.api_signature).toContain('process_data');
    });
  });

  describe('getExtractionStats', () => {
    it('should return correct extraction statistics', () => {
      const commits = [sampleCommit];
      const classifications = [sampleClassification];
      
      const stats = extractor.getExtractionStats(commits, classifications);
      
      expect(stats.total).toBe(1);
      expect(stats.withPackageName).toBeGreaterThanOrEqual(0);
      expect(stats.withVersion).toBeGreaterThanOrEqual(0);
      expect(stats.withErrorType).toBeGreaterThanOrEqual(0);
      expect(stats.withAPISignature).toBeGreaterThanOrEqual(0);
    });
  });

  describe('package name extraction', () => {
    it('should extract Python package names', () => {
      const pythonCommit: CommitData = {
        ...sampleCommit,
        message: 'Update numpy to 1.24.0',
        diff: 'diff --git a/requirements.txt b/requirements.txt\n+numpy==1.24.0'
      };

      const result = extractor.extractFields(pythonCommit, sampleClassification);
      expect(result.package_name).toBe('numpy');
    });

    it('should extract Node.js package names', () => {
      const nodeCommit: CommitData = {
        ...sampleCommit,
        message: 'Update react to 18.2.0',
        diff: 'diff --git a/package.json b/package.json\n+"react": "18.2.0"'
      };

      const result = extractor.extractFields(nodeCommit, sampleClassification);
      expect(result.package_name).toBe('react');
    });

    it('should extract package name from file path', () => {
      const pathCommit: CommitData = {
        ...sampleCommit,
        files: [
          { path: 'tensorflow/src/core/tensor.py', type: 'modified', additions: 1, deletions: 0 }
        ]
      };

      const result = extractor.extractFields(pathCommit, sampleClassification);
      expect(result.package_name).toBe('tensorflow');
    });
  });

  describe('version extraction', () => {
    it('should extract semantic versions', () => {
      const versionCommit: CommitData = {
        ...sampleCommit,
        message: 'Bump version to 2.15.0',
        diff: 'diff --git a/version.py b/version.py\n+__version__ = "2.15.0"'
      };

      const result = extractor.extractFields(versionCommit, sampleClassification);
      expect(result.version).toBe('2.15.0');
    });

    it('should extract version from commit message', () => {
      const versionCommit: CommitData = {
        ...sampleCommit,
        message: 'Update to v1.2.3'
      };

      const result = extractor.extractFields(versionCommit, sampleClassification);
      expect(result.version).toBe('1.2.3');
    });
  });
});
