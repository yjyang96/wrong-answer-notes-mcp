import { RuleBasedFilter } from '../../src/preprocessing/rule-filter';
import { CommitData } from '../../src/models/commit';

describe('RuleBasedFilter', () => {
  let filter: RuleBasedFilter;
  let sampleCommits: CommitData[];

  beforeEach(() => {
    filter = new RuleBasedFilter();
    sampleCommits = [
      {
        hash: 'abc123',
        message: 'Update tensorflow to version 2.15.0',
        author: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
        committer: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
        date: '2025-01-17T10:00:00Z',
        branch: 'main',
        diff: 'diff --git a/requirements.txt b/requirements.txt\n+tensorflow==2.15.0',
        files: [
          { path: 'requirements.txt', type: 'modified', additions: 1, deletions: 0 }
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
      },
      {
        hash: 'def456',
        message: 'Fix memory leak in tensor operations',
        author: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
        committer: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
        date: '2025-01-17T10:00:00Z',
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
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-17T10:00:00Z'
        },
        metadata: {
          collected_at: '2025-01-17T10:00:00Z',
          source: 'test',
          validation: { isValid: true, warnings: [] },
          config: { branches: [] }
        }
      },
      {
        hash: 'ghi789',
        message: 'Add new feature for data processing',
        author: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
        committer: { name: 'Test Author', email: 'test@example.com', username: 'testuser' },
        date: '2025-01-17T10:00:00Z',
        branch: 'main',
        diff: 'diff --git a/processor.py b/processor.py\n+def new_feature():\n+    pass',
        files: [
          { path: 'processor.py', type: 'added', additions: 2, deletions: 0 }
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
      }
    ];
  });

  describe('filterCommits', () => {
    it('should filter commits based on relevance score', () => {
      const filtered = filter.filterCommits(sampleCommits);
      
      // Version update and fix commits should pass, feature commit might not
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.length).toBeLessThanOrEqual(sampleCommits.length);
    });

    it('should include version update commits', () => {
      const filtered = filter.filterCommits(sampleCommits);
      const versionUpdateCommit = filtered.find(c => c.hash === 'abc123');
      expect(versionUpdateCommit).toBeDefined();
    });

    it('should include fix commits', () => {
      const filtered = filter.filterCommits(sampleCommits);
      const fixCommit = filtered.find(c => c.hash === 'def456');
      expect(fixCommit).toBeDefined();
    });
  });

  describe('analyzeCommit', () => {
    it('should analyze version update commit correctly', () => {
      const analysis = filter.analyzeCommit(sampleCommits[0]);
      
      expect(analysis.score).toBeGreaterThan(0);
      expect(analysis.matchedRules.length).toBeGreaterThan(0);
      expect(analysis.category).toBe('version_update');
    });

    it('should analyze fix commit correctly', () => {
      const analysis = filter.analyzeCommit(sampleCommits[1]);
      
      expect(analysis.score).toBeGreaterThan(0);
      expect(analysis.matchedRules.length).toBeGreaterThan(0);
      expect(analysis.category).toBe('fix');
    });

    it('should handle commits with no matching rules', () => {
      const commit: CommitData = {
        ...sampleCommits[0],
        message: 'Random commit with no keywords',
        diff: 'diff --git a/random.txt b/random.txt\n+random content'
      };
      
      const analysis = filter.analyzeCommit(commit);
      
      expect(analysis.score).toBe(0);
      expect(analysis.matchedRules.length).toBe(0);
      expect(analysis.category).toBe('other');
    });
  });

  describe('getFilteringStats', () => {
    it('should return correct filtering statistics', () => {
      const stats = filter.getFilteringStats(sampleCommits);
      
      expect(stats.total).toBe(sampleCommits.length);
      expect(stats.filtered).toBeGreaterThan(0);
      expect(stats.filtered).toBeLessThanOrEqual(stats.total);
      expect(stats.averageScore).toBeGreaterThanOrEqual(0);
      expect(stats.averageScore).toBeLessThanOrEqual(1);
      expect(stats.categoryBreakdown).toBeDefined();
    });
  });
});
