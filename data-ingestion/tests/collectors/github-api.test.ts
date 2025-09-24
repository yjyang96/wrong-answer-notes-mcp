import { GitHubApiCollector } from '../../src/collectors/github-api';
import { CollectionConfig } from '../../src/models/commit';

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      get: jest.fn(),
      listBranches: jest.fn(),
      listCommits: jest.fn(),
    }
  }))
}));

jest.mock('@octokit/graphql', () => ({
  graphql: jest.fn()
}));

describe('GitHubApiCollector', () => {
  let collector: GitHubApiCollector;
  const mockToken = 'mock-token';

  beforeEach(() => {
    collector = new GitHubApiCollector(mockToken);
  });

  describe('getRepository', () => {
    it('should return repository information', async () => {
      // Mock repository data
      const mockRepoData = {
        id: 12345,
        name: 'test-repo',
        full_name: 'owner/test-repo',
        owner: { login: 'owner' },
        description: 'Test repository',
        html_url: 'https://github.com/owner/test-repo',
        clone_url: 'https://github.com/owner/test-repo.git',
        ssh_url: 'git@github.com:owner/test-repo.git',
        default_branch: 'main',
        language: 'TypeScript',
        size: 1024,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        pushed_at: '2024-01-01T00:00:00Z',
        private: false,
        fork: false,
        stargazers_count: 100,
        forks_count: 10,
        open_issues_count: 5,
        license: { name: 'MIT' },
        topics: ['test', 'example']
      };

      // Mock the REST client
      const mockRestClient = {
        repos: {
          get: jest.fn().mockResolvedValue({ data: mockRepoData })
        }
      };

      (collector as any).restClient = mockRestClient;

      const result = await collector.getRepository('owner', 'test-repo');

      expect(result).toEqual({
        id: '12345',
        name: 'test-repo',
        fullName: 'owner/test-repo',
        owner: 'owner',
        description: 'Test repository',
        url: 'https://github.com/owner/test-repo',
        cloneUrl: 'https://github.com/owner/test-repo.git',
        sshUrl: 'git@github.com:owner/test-repo.git',
        defaultBranch: 'main',
        language: 'TypeScript',
        size: 1024,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        pushedAt: new Date('2024-01-01T00:00:00Z'),
        isPrivate: false,
        isFork: false,
        stars: 100,
        forks: 10,
        openIssues: 5,
        license: 'MIT',
        topics: ['test', 'example']
      });

      expect(mockRestClient.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'test-repo'
      });
    });

    it('should handle API errors', async () => {
      const mockRestClient = {
        repos: {
          get: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      };

      (collector as any).restClient = mockRestClient;

      await expect(collector.getRepository('owner', 'test-repo'))
        .rejects.toThrow('API Error');
    });
  });

  describe('getBranches', () => {
    it('should return list of branches', async () => {
      const mockBranches = [
        {
          name: 'main',
          commit: { sha: 'abc123' },
          protected: false
        },
        {
          name: 'develop',
          commit: { sha: 'def456' },
          protected: true
        }
      ];

      const mockRestClient = {
        repos: {
          listBranches: jest.fn().mockResolvedValue({ data: mockBranches })
        }
      };

      (collector as any).restClient = mockRestClient;

      const result = await collector.getBranches('owner', 'test-repo');

      expect(result).toEqual([
        {
          name: 'main',
          sha: 'abc123',
          protected: false
        },
        {
          name: 'develop',
          sha: 'def456',
          protected: true
        }
      ]);
    });
  });

  describe('getCommits', () => {
    it('should return commits with details', async () => {
      const mockCommits = [
        {
          sha: 'commit1',
          commit: {
            message: 'Test commit 1',
            author: {
              name: 'Author 1',
              email: 'author1@example.com',
              date: '2024-01-01T00:00:00Z'
            },
            committer: {
              name: 'Committer 1',
              email: 'committer1@example.com',
              date: '2024-01-01T00:00:00Z'
            }
          },
          author: { login: 'author1' },
          committer: { login: 'committer1' },
          files: [
            {
              filename: 'test.ts',
              status: 'added',
              additions: 10,
              deletions: 0,
              changes: 10
            }
          ]
        }
      ];

      const mockRestClient = {
        repos: {
          listCommits: jest.fn().mockResolvedValue({ data: mockCommits }),
          getCommit: jest.fn().mockResolvedValue({ data: mockCommits[0] })
        }
      };

      (collector as any).restClient = mockRestClient;

      const config: CollectionConfig = {
        branches: ['main'],
        limit: 1
      };

      const result = await collector.getCommits('owner', 'test-repo', 'main', config);

      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('commit1');
      expect(result[0].message).toBe('Test commit 1');
      expect(result[0].author.name).toBe('Author 1');
      expect(result[0].files).toHaveLength(1);
      expect(result[0].files[0].path).toBe('test.ts');
    });
  });
});

