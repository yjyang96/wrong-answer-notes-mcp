import { CommitData, CollectionConfig } from '../models/commit';
import { Repository, RepositoryCollectionConfig } from '../models/repository';
import { Metadata, CollectionJob, CollectionStatistics } from '../models/metadata';
import { GitHubApiCollector } from '../collectors/github-api';
import { GitCliCollector } from '../collectors/git-cli';
import { Logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 데이터 수집 서비스
 */
export class CollectionService {
  private logger: Logger;
  private githubCollector?: GitHubApiCollector;
  private gitCliCollector?: GitCliCollector;

  constructor(
    private githubToken?: string,
    private githubBaseUrl?: string
  ) {
    this.logger = new Logger('CollectionService');
    
    if (githubToken) {
      this.githubCollector = new GitHubApiCollector(githubToken, githubBaseUrl);
    }
  }

  /**
   * 저장소에서 커밋 데이터 수집
   */
  async collectFromRepository(
    config: RepositoryCollectionConfig,
    source: 'github-api' | 'git-cli' | 'pydriller' = 'github-api'
  ): Promise<CollectionJob> {
    const jobId = this.generateJobId();
    const job: CollectionJob = {
      id: jobId,
      name: `Collect from ${config.repository}`,
      description: `Collect commits from repository ${config.repository}`,
      status: 'pending',
      priority: config.priority,
      createdAt: new Date(),
      config,
      progress: 0,
      metadata: {
        id: jobId,
        collectedAt: new Date(),
        source,
        version: '1.0.0',
        config,
        status: 'pending',
        itemCount: 0,
        startedAt: new Date(),
        statistics: {
          totalCommits: 0,
          collectedCommits: 0,
          failedCommits: 0,
          totalFiles: 0,
          collectedFiles: 0,
          collectionTimeMs: 0,
          avgTimePerCommitMs: 0,
          apiCalls: 0,
          rateLimitWaitTimeMs: 0,
        },
      },
    };

    try {
      job.status = 'running';
      job.startedAt = new Date();
      job.metadata.status = 'in-progress';
      job.metadata.startedAt = new Date();

      const startTime = Date.now();
      let commits: CommitData[] = [];

      switch (source) {
        case 'github-api':
          commits = await this.collectFromGitHubApi(config);
          break;
        case 'git-cli':
          commits = await this.collectFromGitCli(config);
          break;
        case 'pydriller':
          commits = await this.collectFromPyDriller(config);
          break;
        default:
          throw new Error(`지원하지 않는 수집 소스: ${source}`);
      }

      const endTime = Date.now();
      const collectionTime = endTime - startTime;

      // 통계 업데이트
      job.metadata.statistics = {
        totalCommits: commits.length,
        collectedCommits: commits.length,
        failedCommits: 0,
        totalFiles: commits.reduce((sum, commit) => sum + commit.files.length, 0),
        collectedFiles: commits.reduce((sum, commit) => sum + commit.files.length, 0),
        collectionTimeMs: collectionTime,
        avgTimePerCommitMs: commits.length > 0 ? collectionTime / commits.length : 0,
        apiCalls: source === 'github-api' ? commits.length * 2 : 0, // 대략적인 API 호출 수
        rateLimitWaitTimeMs: 0,
      };

      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;
      job.metadata.status = 'completed';
      job.metadata.completedAt = new Date();
      job.metadata.itemCount = commits.length;
      job.result = { commits };

      this.logger.info('Collection completed', {
        jobId,
        repository: config.repository,
        commitCount: commits.length,
        collectionTime,
      });

    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = {
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        retryCount: 0,
      };
      job.metadata.status = 'failed';
      job.metadata.completedAt = new Date();
      job.metadata.error = job.error;

      this.logger.error('Collection failed', {
        jobId,
        repository: config.repository,
        error: job.error,
      });
    }

    return job;
  }

  /**
   * GitHub API를 통한 수집
   */
  private async collectFromGitHubApi(config: RepositoryCollectionConfig): Promise<CommitData[]> {
    if (!this.githubCollector) {
      throw new Error('GitHub API collector가 초기화되지 않았습니다.');
    }

    const [owner, repo] = this.parseRepositoryName(config.repository);
    const allCommits: CommitData[] = [];

    // 브랜치별로 수집
    const branches = config.branches.length > 0 ? config.branches : await this.getDefaultBranches(owner, repo);
    
    for (const branch of branches) {
      try {
        const collectionConfig: CollectionConfig = {
          branches: [branch],
          limit: config.limit,
          since: config.since,
          until: config.until,
          includePatterns: config.includePatterns,
          excludePatterns: config.excludePatterns,
        };

        const commits = await this.githubCollector.getCommits(owner, repo, branch, collectionConfig);
        
        // 브랜치 정보 설정
        commits.forEach(commit => {
          commit.branch = branch;
        });

        allCommits.push(...commits);
        
        this.logger.info('Collected commits from branch', {
          repository: config.repository,
          branch,
          commitCount: commits.length,
        });

      } catch (error) {
        this.logger.warn('Failed to collect from branch', {
          repository: config.repository,
          branch,
          error,
        });
      }
    }

    return allCommits;
  }

  /**
   * Git CLI를 통한 수집
   */
  private async collectFromGitCli(config: RepositoryCollectionConfig): Promise<CommitData[]> {
    const repoPath = await this.ensureRepositoryCloned(config.repository);
    this.gitCliCollector = new GitCliCollector(repoPath);
    
    const allCommits: CommitData[] = [];
    const branches = config.branches.length > 0 ? config.branches : await this.gitCliCollector.getBranches();
    
    for (const branch of branches) {
      try {
        const collectionConfig: CollectionConfig = {
          branches: [branch],
          limit: config.limit,
          since: config.since,
          until: config.until,
          includePatterns: config.includePatterns,
          excludePatterns: config.excludePatterns,
        };

        const commits = await this.gitCliCollector.getCommits(branch, collectionConfig);
        allCommits.push(...commits);
        
        this.logger.info('Collected commits from branch via Git CLI', {
          repository: config.repository,
          branch,
          commitCount: commits.length,
        });

      } catch (error) {
        this.logger.warn('Failed to collect from branch via Git CLI', {
          repository: config.repository,
          branch,
          error,
        });
      }
    }

    return allCommits;
  }

  /**
   * PyDriller를 통한 수집
   */
  private async collectFromPyDriller(config: RepositoryCollectionConfig): Promise<CommitData[]> {
    const repoPath = await this.ensureRepositoryCloned(config.repository);
    
    // Python 스크립트 실행
    const pythonScript = `
import sys
import os
sys.path.append('${process.cwd()}/python')

from pydriller_collector import PyDrillerCollector
import json
from datetime import datetime

collector = PyDrillerCollector('${repoPath}')
commits = collector.collect_commits(
    branches=${JSON.stringify(config.branches)},
    since=${config.since ? `datetime.fromisoformat('${config.since.toISOString()}')` : 'None'},
    until=${config.until ? `datetime.fromisoformat('${config.until.toISOString()}')` : 'None'},
    limit=${config.limit || 'None'},
    include_patterns=${JSON.stringify(config.includePatterns)},
    exclude_patterns=${JSON.stringify(config.excludePatterns)}
)

print(json.dumps(commits, ensure_ascii=False))
`;

    try {
      const { stdout } = await execAsync(`python3 -c "${pythonScript}"`);
      const commits = JSON.parse(stdout);
      
      this.logger.info('Collected commits via PyDriller', {
        repository: config.repository,
        commitCount: commits.length,
      });

      return commits;
    } catch (error) {
      this.logger.error('Failed to collect via PyDriller', {
        repository: config.repository,
        error,
      });
      throw error;
    }
  }

  /**
   * 저장소가 클론되어 있는지 확인하고 필요시 클론
   */
  private async ensureRepositoryCloned(repository: string): Promise<string> {
    const repoPath = `/tmp/repos/${repository.replace('/', '_')}`;
    
    if (!await this.directoryExists(repoPath)) {
      await GitCliCollector.cloneRepository(
        `https://github.com/${repository}.git`,
        repoPath
      );
    } else {
      // 기존 저장소 업데이트
      const collector = new GitCliCollector(repoPath);
      await collector.updateRepository();
    }

    return repoPath;
  }

  /**
   * 디렉토리 존재 여부 확인
   */
  private async directoryExists(path: string): Promise<boolean> {
    try {
      await execAsync(`test -d "${path}"`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 저장소 이름 파싱 (owner/repo)
   */
  private parseRepositoryName(repository: string): [string, string] {
    const parts = repository.split('/');
    if (parts.length !== 2) {
      throw new Error(`잘못된 저장소 이름 형식: ${repository}`);
    }
    return [parts[0], parts[1]];
  }

  /**
   * 기본 브랜치 조회
   */
  private async getDefaultBranches(owner: string, repo: string): Promise<string[]> {
    if (!this.githubCollector) {
      return ['main', 'master'];
    }

    try {
      const repository = await this.githubCollector.getRepository(owner, repo);
      return [repository.defaultBranch];
    } catch (error) {
      this.logger.warn('Failed to get default branch', { owner, repo, error });
      return ['main', 'master'];
    }
  }

  /**
   * 작업 ID 생성
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 여러 저장소에서 병렬 수집
   */
  async collectFromMultipleRepositories(
    configs: RepositoryCollectionConfig[],
    source: 'github-api' | 'git-cli' | 'pydriller' = 'github-api',
    maxConcurrency: number = 3
  ): Promise<CollectionJob[]> {
    const jobs: CollectionJob[] = [];
    const activeJobs: Array<{ promise: Promise<CollectionJob>; index: number }> = [];

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      
      if (activeJobs.length >= maxConcurrency) {
        // 완료된 작업 대기
        const completed = await Promise.race(activeJobs.map(job => job.promise));
        jobs.push(completed);
        
        // 완료된 작업 제거
        const completedIndex = activeJobs.findIndex(job => job.promise === Promise.resolve(completed));
        if (completedIndex !== -1) {
          activeJobs.splice(completedIndex, 1);
        }
      }

      // 새 작업 시작
      const jobPromise = this.collectFromRepository(config, source);
      activeJobs.push({ promise: jobPromise, index: i });
    }

    // 남은 작업들 완료 대기
    const remainingJobs = await Promise.all(activeJobs.map(job => job.promise));
    jobs.push(...remainingJobs);

    return jobs;
  }
}

