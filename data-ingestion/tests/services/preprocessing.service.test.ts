import { PreprocessingService } from '../../src/services/preprocessing';
import { CommitData } from '../../src/models/commit';

const mockBatchClassifyCommits = jest.fn();
const mockBatchExtractEnvironment = jest.fn();
const mockTestConnection = jest.fn();

jest.mock('../../src/llm/azure-openai', () => {
  return {
    AzureOpenAIService: jest.fn().mockImplementation(() => ({
      batchClassifyCommits: mockBatchClassifyCommits,
      batchExtractEnvironment: mockBatchExtractEnvironment,
      testConnection: mockTestConnection
    }))
  };
});

describe('PreprocessingService', () => {
  const createCommit = (): CommitData => ({
    hash: 'abc123def456',
    message: 'Fix memory leak when updating TensorFlow dependency',
    author: { name: 'Test Author', email: 'author@example.com', username: 'author' },
    committer: { name: 'Test Committer', email: 'committer@example.com', username: 'committer' },
    date: new Date('2025-01-20T10:00:00Z'),
    diff: `diff --git a/requirements.txt b/requirements.txt
+tensorflow==2.15.0
+numpy==1.26.0
+scipy==1.11.4
diff --git a/src/core/memory.py b/src/core/memory.py
+def fix_memory_leak(buffer):
+    if buffer.is_pinned():
+        buffer.release()
+    return buffer
`,
    files: [
      { path: 'requirements.txt', type: 'modified', additions: 2, deletions: 0 },
      { path: 'src/core/memory.py', type: 'modified', additions: 4, deletions: 0 }
    ],
    branch: 'main',
    repository: {
      name: 'test-repo',
      fullName: 'owner/test-repo',
      url: 'https://github.com/owner/test-repo',
      description: 'Test repository',
      defaultBranch: 'main',
      language: 'Python',
      size: 1024,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-19T09:00:00Z')
    },
    metadata: {
      collectedAt: new Date('2025-01-20T11:00:00Z'),
      source: 'github-api',
      version: '1.0.0',
      config: { branches: ['main'] }
    }
  });

  beforeEach(() => {
    mockBatchClassifyCommits.mockReset();
    mockBatchExtractEnvironment.mockReset();
    mockTestConnection.mockReset();
  });

  it('processes commits using LLM responses and attaches environment information', async () => {
    mockBatchClassifyCommits.mockResolvedValue([
      {
        type: 'fix',
        confidence: 0.95,
        package_name: 'tensorflow',
        version: '2.15.0',
        reasoning: 'Dependency update and memory leak fix'
      }
    ]);
    mockBatchExtractEnvironment.mockResolvedValue([
      {
        languages: ['Python'],
        frameworks: ['TensorFlow'],
        build_systems: ['pip'],
        file_types: ['.py'],
        tools: ['pytest'],
        versions: { python: '3.10' }
      }
    ]);

    const service = new PreprocessingService();
    const processed = await service.preprocessCommits([createCommit()]);

    expect(processed).toHaveLength(1);
    const result = processed[0];

    expect(result.classification.type).toBe('fix');
    expect(result.classification.package_name).toBe('tensorflow');
    expect(result.environment?.languages).toEqual(['Python']);
    expect(result.metadata.validation_status).toBe('valid');
    expect(result.metadata.quality_score).toBeGreaterThan(0);
    expect(mockBatchClassifyCommits).toHaveBeenCalledTimes(1);
    expect(mockBatchExtractEnvironment).toHaveBeenCalledTimes(1);
  });

  it('falls back to rule-based classification when LLM classification fails', async () => {
    mockBatchClassifyCommits.mockRejectedValueOnce(new Error('LLM failure'));
    mockBatchExtractEnvironment.mockResolvedValue([null]);

    const service = new PreprocessingService();
    const processed = await service.preprocessCommits([createCommit()]);

    expect(processed).toHaveLength(1);
    const fallbackResult = processed[0];

    expect(['fix', 'version_update', 'error', 'patch']).toContain(
      fallbackResult.classification.type
    );
    expect(fallbackResult.classification.reasoning).toContain('Fallback classification');
    expect(fallbackResult.environment).toBeNull();
    expect(mockBatchClassifyCommits).toHaveBeenCalledTimes(1);
  });
});
