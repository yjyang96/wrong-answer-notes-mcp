import { ValidationService, ValidationFilters } from '../../src/services/validation';
import { CommitData } from '../../src/models/commit';

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('validateCommitData', () => {
    const validCommit: CommitData = {
      hash: 'abc123',
      message: 'Test commit',
      author: {
        name: 'Test Author',
        email: 'test@example.com'
      },
      committer: {
        name: 'Test Committer',
        email: 'test@example.com'
      },
      date: new Date('2024-01-01T00:00:00Z'),
      diff: 'diff content',
      files: [
        {
          path: 'test.ts',
          type: 'added',
          additions: 10,
          deletions: 0
        }
      ],
      branch: 'main',
      repository: {
        name: 'test-repo',
        fullName: 'owner/test-repo',
        url: 'https://github.com/owner/test-repo',
        defaultBranch: 'main',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      },
      metadata: {
        collectedAt: new Date('2024-01-01T00:00:00Z'),
        source: 'github-api',
        version: '1.0.0',
        config: { branches: [] }
      }
    };

    it('should validate correct commit data', () => {
      const result = validationService.validateCommitData(validCommit);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing hash', () => {
      const invalidCommit = { ...validCommit, hash: '' };
      const result = validationService.validateCommitData(invalidCommit);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('커밋 해시가 없습니다.');
    });

    it('should detect missing message', () => {
      const invalidCommit = { ...validCommit, message: '' };
      const result = validationService.validateCommitData(invalidCommit);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('커밋 메시지가 없습니다.');
    });

    it('should detect invalid author', () => {
      const invalidCommit = { ...validCommit, author: { name: '', email: '' } };
      const result = validationService.validateCommitData(invalidCommit);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('작성자 정보가 불완전합니다.');
    });

    it('should detect invalid date', () => {
      const invalidCommit = { ...validCommit, date: new Date('invalid') };
      const result = validationService.validateCommitData(invalidCommit);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('유효하지 않은 커밋 날짜입니다.');
    });

    it('should warn about long message', () => {
      const longMessageCommit = { 
        ...validCommit, 
        message: 'a'.repeat(1001) 
      };
      const result = validationService.validateCommitData(longMessageCommit);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('커밋 메시지가 너무 깁니다.');
    });

    it('should warn about large diff', () => {
      const largeDiffCommit = { 
        ...validCommit, 
        diff: 'a'.repeat(1000001) 
      };
      const result = validationService.validateCommitData(largeDiffCommit);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Diff가 너무 큽니다.');
    });

    it('should warn about no file changes', () => {
      const noFilesCommit = { ...validCommit, files: [] };
      const result = validationService.validateCommitData(noFilesCommit);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('변경된 파일이 없습니다.');
    });
  });

  describe('validateCommitList', () => {
    it('should validate list of commits', () => {
      const commits: CommitData[] = [
        {
          hash: 'commit1',
          message: 'Test commit 1',
          author: { name: 'Author 1', email: 'author1@example.com' },
          committer: { name: 'Committer 1', email: 'committer1@example.com' },
          date: new Date('2024-01-01T00:00:00Z'),
          diff: '',
          files: [],
          branch: 'main',
          repository: {
            name: 'test-repo',
            fullName: 'owner/test-repo',
            url: 'https://github.com/owner/test-repo',
            defaultBranch: 'main',
            createdAt: new Date('2024-01-01T00:00:00Z'),
            updatedAt: new Date('2024-01-01T00:00:00Z')
          },
          metadata: {
            collectedAt: new Date('2024-01-01T00:00:00Z'),
            source: 'github-api',
            version: '1.0.0',
            config: { branches: [] }
          }
        }
      ];

      const result = validationService.validateCommitList(commits);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate commits', () => {
      const validCommit: CommitData = {
        hash: 'commit1',
        message: 'Test commit',
        author: { name: 'Test Author', email: 'test@example.com' },
        committer: { name: 'Test Committer', email: 'test@example.com' },
        date: new Date('2024-01-01T00:00:00Z'),
        diff: '',
        files: [],
        branch: 'main',
        repository: {
          name: 'test-repo',
          fullName: 'owner/test-repo',
          url: 'https://github.com/owner/test-repo',
          defaultBranch: 'main',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z')
        },
        metadata: {
          collectedAt: new Date('2024-01-01T00:00:00Z'),
          source: 'github-api',
          version: '1.0.0',
          config: { branches: [] }
        }
      };

      const commits: CommitData[] = [validCommit, { ...validCommit, hash: 'commit1' }]; // 중복

      const result = validationService.validateCommitList(commits);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('중복된 커밋이 발견되었습니다: commit1');
    });

    it('should handle empty commit list', () => {
      const result = validationService.validateCommitList([]);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('수집된 커밋이 없습니다.');
    });
  });

  describe('sanitizeCommitData', () => {
    it('should sanitize commit data', () => {
      const dirtyCommit: CommitData = {
        hash: '  abc123  ',
        message: '  Test commit  ',
        author: {
          name: '  Test Author  ',
          email: '  test@example.com  '
        },
        committer: {
          name: '  Test Committer  ',
          email: '  test@example.com  '
        },
        date: new Date('2024-01-01T00:00:00Z'),
        diff: '  diff content  ',
        files: [
          {
            path: '  test.ts  ',
            type: 'added',
            additions: -5, // 음수
            deletions: -2  // 음수
          }
        ],
        branch: '  main  ',
        repository: {
          name: '  test-repo  ',
          fullName: '  owner/test-repo  ',
          url: '  https://github.com/owner/test-repo  ',
          defaultBranch: '  main  ',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z')
        },
        metadata: {
          collectedAt: new Date('2024-01-01T00:00:00Z'),
          source: 'github-api',
          version: '1.0.0',
          config: { branches: [] }
        }
      };

      const result = validationService.sanitizeCommitData(dirtyCommit);
      
      expect(result.hash).toBe('abc123');
      expect(result.message).toBe('Test commit');
      expect(result.author.name).toBe('Test Author');
      expect(result.author.email).toBe('test@example.com');
      expect(result.diff).toBe('diff content');
      expect(result.files[0].path).toBe('test.ts');
      expect(result.files[0].additions).toBe(0); // 음수는 0으로 변환
      expect(result.files[0].deletions).toBe(0); // 음수는 0으로 변환
      expect(result.branch).toBe('main');
      expect(result.repository.name).toBe('test-repo');
    });
  });

  describe('applyFilters', () => {
    const commits: CommitData[] = [
      {
        hash: 'commit1',
        message: 'Short message',
        author: { name: 'Author 1', email: 'author1@example.com' },
        committer: { name: 'Committer 1', email: 'committer1@example.com' },
        date: new Date('2024-01-01T00:00:00Z'),
        diff: '',
        files: [
          { path: 'test.ts', type: 'added', additions: 10, deletions: 0 }
        ],
        branch: 'main',
        repository: {
          name: 'test-repo',
          fullName: 'owner/test-repo',
          url: 'https://github.com/owner/test-repo',
          defaultBranch: 'main',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z')
        },
        metadata: {
          collectedAt: new Date('2024-01-01T00:00:00Z'),
          source: 'github-api',
          version: '1.0.0',
          config: { branches: [] }
        }
      },
      {
        hash: 'commit2',
        message: 'This is a very long message that exceeds the minimum length requirement',
        author: { name: 'Author 2', email: 'author2@example.com' },
        committer: { name: 'Committer 2', email: 'committer2@example.com' },
        date: new Date('2024-01-02T00:00:00Z'),
        diff: '',
        files: [
          { path: 'test.js', type: 'modified', additions: 5, deletions: 2 },
          { path: 'test.py', type: 'deleted', additions: 0, deletions: 10 }
        ],
        branch: 'develop',
        repository: {
          name: 'test-repo',
          fullName: 'owner/test-repo',
          url: 'https://github.com/owner/test-repo',
          defaultBranch: 'main',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-01T00:00:00Z')
        },
        metadata: {
          collectedAt: new Date('2024-01-01T00:00:00Z'),
          source: 'github-api',
          version: '1.0.0',
          config: { branches: [] }
        }
      }
    ];

    it('should filter by message length', () => {
      const filters: ValidationFilters = {
        minMessageLength: 20
      };

      const result = validationService.applyFilters(commits, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('commit2');
    });

    it('should filter by file changes', () => {
      const filters: ValidationFilters = {
        minFileChanges: 2
      };

      const result = validationService.applyFilters(commits, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('commit2');
    });

    it('should filter by date range', () => {
      const filters: ValidationFilters = {
        since: new Date('2024-01-02T00:00:00Z')
      };

      const result = validationService.applyFilters(commits, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('commit2');
    });

    it('should filter by branch', () => {
      const filters: ValidationFilters = {
        branches: ['main']
      };

      const result = validationService.applyFilters(commits, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('commit1');
    });

    it('should filter by file patterns', () => {
      const filters: ValidationFilters = {
        includeFilePatterns: ['*.ts']
      };

      const result = validationService.applyFilters(commits, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('commit1');
    });

    it('should exclude file patterns', () => {
      const filters: ValidationFilters = {
        excludeFilePatterns: ['*.js']
      };

      const result = validationService.applyFilters(commits, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('commit1');
    });
  });
});
