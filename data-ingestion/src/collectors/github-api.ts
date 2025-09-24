import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { CommitData, RepositoryInfo, Author, ChangedFile, CollectionConfig } from '../models/commit';
import { Repository, Branch } from '../models/repository';
import { Logger } from '../utils/logger';
import { RateLimiter } from '../utils/rate-limiter';

/**
 * GitHub API 클라이언트
 */
export class GitHubApiCollector {
  private restClient: Octokit;
  private graphqlClient: any;
  private logger: Logger;
  private rateLimiter: RateLimiter;

  constructor(
    private token: string,
    private baseUrl?: string
  ) {
    this.restClient = new Octokit({
      auth: token,
      baseUrl: baseUrl || 'https://api.github.com',
    });

    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
      baseUrl: baseUrl ? `${baseUrl}/graphql` : 'https://api.github.com/graphql',
    });

    this.logger = new Logger('GitHubApiCollector');
    this.rateLimiter = new RateLimiter();
  }

  /**
   * 저장소 정보 조회
   */
  async getRepository(owner: string, repo: string): Promise<Repository> {
    await this.rateLimiter.waitForRateLimit();
    
    try {
      const response = await this.restClient.repos.get({
        owner,
        repo,
      });

      const data = response.data;
      return {
        id: data.id.toString(),
        name: data.name,
        fullName: data.full_name,
        owner: data.owner.login,
        description: data.description || undefined,
        url: data.html_url,
        cloneUrl: data.clone_url,
        sshUrl: data.ssh_url,
        defaultBranch: data.default_branch,
        language: data.language || undefined,
        size: data.size,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        pushedAt: data.pushed_at ? new Date(data.pushed_at) : undefined,
        isPrivate: data.private,
        isFork: data.fork,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        license: data.license?.name || undefined,
        topics: data.topics || [],
      };
    } catch (error) {
      this.logger.error('Failed to get repository', { owner, repo, error });
      throw error;
    }
  }

  /**
   * 저장소의 모든 브랜치 조회
   */
  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    await this.rateLimiter.waitForRateLimit();
    
    try {
      const branches: Branch[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.restClient.repos.listBranches({
          owner,
          repo,
          page,
          per_page: perPage,
        });

        if (response.data.length === 0) break;

        for (const branch of response.data) {
          branches.push({
            name: branch.name,
            sha: branch.commit.sha,
            protected: branch.protected,
          });
        }

        page++;
      }

      return branches;
    } catch (error) {
      this.logger.error('Failed to get branches', { owner, repo, error });
      throw error;
    }
  }

  /**
   * 브랜치의 커밋 목록 조회
   */
  async getCommits(
    owner: string,
    repo: string,
    branch: string,
    config: CollectionConfig
  ): Promise<CommitData[]> {
    const commits: CommitData[] = [];
    let page = 1;
    const perPage = 100;

    try {
      while (true) {
        await this.rateLimiter.waitForRateLimit();

        const response = await this.restClient.repos.listCommits({
          owner,
          repo,
          sha: branch,
          page,
          per_page: perPage,
          since: config.since?.toISOString(),
          until: config.until?.toISOString(),
        });

        if (response.data.length === 0) break;

        for (const commit of response.data) {
          try {
            const commitData = await this.getCommitDetails(owner, repo, commit.sha);
            commits.push(commitData);

            if (config.limit && commits.length >= config.limit) {
              return commits;
            }
          } catch (error) {
            this.logger.warn('Failed to get commit details', { 
              owner, 
              repo, 
              sha: commit.sha, 
              error 
            });
          }
        }

        page++;
      }

      return commits;
    } catch (error) {
      this.logger.error('Failed to get commits', { owner, repo, branch, error });
      throw error;
    }
  }

  /**
   * 커밋 상세 정보 조회 (Diff 포함)
   */
  async getCommitDetails(owner: string, repo: string, sha: string): Promise<CommitData> {
    await this.rateLimiter.waitForRateLimit();

    try {
      const [commitResponse, diffResponse] = await Promise.all([
        this.restClient.repos.getCommit({
          owner,
          repo,
          ref: sha,
        }),
        this.getCommitDiff(owner, repo, sha),
      ]);

      const commit = commitResponse.data;
      const repositoryInfo = await this.getRepositoryInfo(owner, repo);

      return {
        hash: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || '',
          email: commit.commit.author?.email || '',
          username: commit.author?.login,
        },
        committer: {
          name: commit.commit.committer?.name || '',
          email: commit.commit.committer?.email || '',
          username: commit.committer?.login,
        },
        date: new Date(commit.commit.author?.date || commit.commit.committer?.date || new Date()),
        diff: diffResponse,
        files: (commit.files || []).map(file => ({
          path: file.filename,
          type: this.getFileChangeType(file.status),
          additions: file.additions,
          deletions: file.deletions,
          size: file.changes,
          previousPath: file.previous_filename,
        })),
        branch: '', // 브랜치 정보는 별도로 설정
        repository: repositoryInfo,
        metadata: {
          collectedAt: new Date(),
          source: 'github-api',
          version: '1.0.0',
          config: { branches: [] },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get commit details', { owner, repo, sha, error });
      throw error;
    }
  }

  /**
   * 커밋 Diff 조회
   */
  private async getCommitDiff(owner: string, repo: string, sha: string): Promise<string> {
    try {
      const response = await this.restClient.repos.getCommit({
        owner,
        repo,
        ref: sha,
        mediaType: {
          format: 'diff',
        },
      });

      return response.data as unknown as string;
    } catch (error) {
      this.logger.warn('Failed to get commit diff', { owner, repo, sha, error });
      return '';
    }
  }

  /**
   * 저장소 정보 생성
   */
  private async getRepositoryInfo(owner: string, repo: string): Promise<RepositoryInfo> {
    const repository = await this.getRepository(owner, repo);
    
    return {
      name: repository.name,
      fullName: repository.fullName,
      url: repository.url,
      description: repository.description,
      defaultBranch: repository.defaultBranch,
      language: repository.language,
      size: repository.size,
      createdAt: repository.createdAt,
      updatedAt: repository.updatedAt,
    };
  }

  /**
   * 파일 변경 타입 변환
   */
  private getFileChangeType(status: string): 'added' | 'modified' | 'deleted' | 'renamed' {
    switch (status) {
      case 'added':
        return 'added';
      case 'modified':
        return 'modified';
      case 'removed':
        return 'deleted';
      case 'renamed':
        return 'renamed';
      default:
        return 'modified';
    }
  }

  /**
   * GraphQL을 사용한 대량 커밋 조회
   */
  async getCommitsWithGraphQL(
    owner: string,
    repo: string,
    branch: string,
    config: CollectionConfig
  ): Promise<CommitData[]> {
    const query = `
      query($owner: String!, $repo: String!, $branch: String!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
          ref(qualifiedName: $branch) {
            target {
              ... on Commit {
                history(first: $first, after: $after) {
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                  nodes {
                    oid
                    message
                    author {
                      name
                      email
                      user {
                        login
                      }
                    }
                    committer {
                      name
                      email
                      user {
                        login
                      }
                    }
                    authoredDate
                    committedDate
                    changedFiles
                    additions
                    deletions
                  }
                }
              }
            }
          }
        }
      }
    `;

    const commits: CommitData[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    try {
      while (hasNextPage) {
        await this.rateLimiter.waitForRateLimit();

        const variables: any = {
          owner,
          repo,
          branch: `refs/heads/${branch}`,
          first: 100,
          after: cursor,
        };

        const response: any = await this.graphqlClient(query, variables);
        const history: any = response.repository.ref.target.history;
        
        for (const commit of history.nodes) {
          try {
            const commitData = await this.getCommitDetails(owner, repo, commit.oid);
            commits.push(commitData);

            if (config.limit && commits.length >= config.limit) {
              return commits;
            }
          } catch (error) {
            this.logger.warn('Failed to get commit details from GraphQL', { 
              owner, 
              repo, 
              sha: commit.oid, 
              error 
            });
          }
        }

        hasNextPage = history.pageInfo.hasNextPage;
        cursor = history.pageInfo.endCursor;
      }

      return commits;
    } catch (error) {
      this.logger.error('Failed to get commits with GraphQL', { owner, repo, branch, error });
      throw error;
    }
  }
}
