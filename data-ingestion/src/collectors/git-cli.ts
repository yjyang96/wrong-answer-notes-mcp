import { exec } from 'child_process';
import { promisify } from 'util';
import { CommitData, RepositoryInfo, Author, ChangedFile, CollectionConfig } from '../models/commit';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * Git CLI 기반 데이터 수집기
 */
export class GitCliCollector {
  private logger: Logger;

  constructor(private repoPath: string) {
    this.logger = new Logger('GitCliCollector');
  }

  /**
   * 저장소 정보 조회
   */
  async getRepositoryInfo(): Promise<RepositoryInfo> {
    try {
      const [name, url, defaultBranch, description] = await Promise.all([
        this.getRepositoryName(),
        this.getRepositoryUrl(),
        this.getDefaultBranch(),
        this.getRepositoryDescription(),
      ]);

      return {
        name,
        fullName: name,
        url,
        description,
        defaultBranch,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get repository info', { repoPath: this.repoPath, error });
      throw error;
    }
  }

  /**
   * 모든 브랜치 조회
   */
  async getBranches(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git branch -a', { cwd: this.repoPath });
      const branches = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('*'))
        .map(line => line.replace(/^remotes\/origin\//, ''))
        .filter((branch, index, array) => array.indexOf(branch) === index);

      return branches;
    } catch (error) {
      this.logger.error('Failed to get branches', { repoPath: this.repoPath, error });
      throw error;
    }
  }

  /**
   * 브랜치의 커밋 목록 조회
   */
  async getCommits(branch: string, config: CollectionConfig): Promise<CommitData[]> {
    try {
      const commitHashes = await this.getCommitHashes(branch, config);
      const commits: CommitData[] = [];

      for (const hash of commitHashes) {
        try {
          const commit = await this.getCommitDetails(hash, branch);
          commits.push(commit);
        } catch (error) {
          this.logger.warn('Failed to get commit details', { hash, branch, error });
        }
      }

      return commits;
    } catch (error) {
      this.logger.error('Failed to get commits', { branch, config, error });
      throw error;
    }
  }

  /**
   * 커밋 해시 목록 조회
   */
  private async getCommitHashes(branch: string, config: CollectionConfig): Promise<string[]> {
    let command = `git log --pretty=format:"%H" ${branch}`;

    if (config.since) {
      command += ` --since="${config.since.toISOString()}"`;
    }

    if (config.until) {
      command += ` --until="${config.until.toISOString()}"`;
    }

    if (config.limit) {
      command += ` -n ${config.limit}`;
    }

    try {
      const { stdout } = await execAsync(command, { cwd: this.repoPath });
      return stdout.trim().split('\n').filter(hash => hash);
    } catch (error) {
      this.logger.error('Failed to get commit hashes', { branch, config, error });
      throw error;
    }
  }

  /**
   * 커밋 상세 정보 조회
   */
  private async getCommitDetails(hash: string, branch: string): Promise<CommitData> {
    try {
      const [commitInfo, diff, files] = await Promise.all([
        this.getCommitInfo(hash),
        this.getCommitDiff(hash),
        this.getChangedFiles(hash),
      ]);

      const repositoryInfo = await this.getRepositoryInfo();

      return {
        hash,
        message: commitInfo.message,
        author: commitInfo.author,
        committer: commitInfo.committer,
        date: commitInfo.date,
        diff,
        files,
        branch,
        repository: repositoryInfo,
        metadata: {
          collectedAt: new Date(),
          source: 'git-cli',
          version: '1.0.0',
          config: { branches: [] },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get commit details', { hash, branch, error });
      throw error;
    }
  }

  /**
   * 커밋 기본 정보 조회
   */
  private async getCommitInfo(hash: string): Promise<{
    message: string;
    author: Author;
    committer: Author;
    date: Date;
  }> {
    const format = '%H|%s|%an|%ae|%cn|%ce|%ad';
    const { stdout } = await execAsync(
      `git log -1 --pretty=format:"${format}" --date=iso ${hash}`,
      { cwd: this.repoPath }
    );

    const parts = stdout.split('|');
    if (parts.length < 7) {
      throw new Error('Invalid commit info format');
    }

    return {
      message: parts[1],
      author: {
        name: parts[2],
        email: parts[3],
      },
      committer: {
        name: parts[4],
        email: parts[5],
      },
      date: new Date(parts[6]),
    };
  }

  /**
   * 커밋 Diff 조회
   */
  private async getCommitDiff(hash: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git show --format="" ${hash}`, { cwd: this.repoPath });
      return stdout;
    } catch (error) {
      this.logger.warn('Failed to get commit diff', { hash, error });
      return '';
    }
  }

  /**
   * 변경된 파일 목록 조회
   */
  private async getChangedFiles(hash: string): Promise<ChangedFile[]> {
    try {
      const { stdout } = await execAsync(
        `git show --name-status --format="" ${hash}`,
        { cwd: this.repoPath }
      );

      const files: ChangedFile[] = [];
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.split('\t');
        if (parts.length < 2) continue;

        const status = parts[0];
        const path = parts[1];
        const previousPath = parts[2];

        const stats = await this.getFileStats(hash, path);

        files.push({
          path,
          type: this.getFileChangeType(status),
          additions: stats.additions,
          deletions: stats.deletions,
          previousPath: previousPath || undefined,
        });
      }

      return files;
    } catch (error) {
      this.logger.warn('Failed to get changed files', { hash, error });
      return [];
    }
  }

  /**
   * 파일 통계 조회
   */
  private async getFileStats(hash: string, path: string): Promise<{ additions: number; deletions: number }> {
    try {
      const { stdout } = await execAsync(
        `git show --numstat ${hash} -- "${path}" | head -1`,
        { cwd: this.repoPath }
      );

      const parts = stdout.trim().split('\t');
      if (parts.length >= 2) {
        return {
          additions: parseInt(parts[0]) || 0,
          deletions: parseInt(parts[1]) || 0,
        };
      }

      return { additions: 0, deletions: 0 };
    } catch (error) {
      this.logger.warn('Failed to get file stats', { hash, path, error });
      return { additions: 0, deletions: 0 };
    }
  }

  /**
   * 파일 변경 타입 변환
   */
  private getFileChangeType(status: string): 'added' | 'modified' | 'deleted' | 'renamed' {
    switch (status) {
      case 'A':
        return 'added';
      case 'M':
        return 'modified';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      default:
        return 'modified';
    }
  }

  /**
   * 저장소 이름 조회
   */
  private async getRepositoryName(): Promise<string> {
    const { stdout } = await execAsync('basename $(git rev-parse --show-toplevel)', { cwd: this.repoPath });
    return stdout.trim();
  }

  /**
   * 저장소 URL 조회
   */
  private async getRepositoryUrl(): Promise<string> {
    try {
      const { stdout } = await execAsync('git config --get remote.origin.url', { cwd: this.repoPath });
      return stdout.trim();
    } catch (error) {
      return '';
    }
  }

  /**
   * 기본 브랜치 조회
   */
  private async getDefaultBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git symbolic-ref refs/remotes/origin/HEAD | sed "s@^refs/remotes/origin/@@"', { cwd: this.repoPath });
      return stdout.trim();
    } catch (error) {
      return 'main';
    }
  }

  /**
   * 저장소 설명 조회
   */
  private async getRepositoryDescription(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('git config --get remote.origin.description', { cwd: this.repoPath });
      return stdout.trim() || undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * 저장소 클론
   */
  static async cloneRepository(url: string, targetPath: string): Promise<void> {
    try {
      await execAsync(`git clone ${url} ${targetPath}`);
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  /**
   * 저장소 업데이트
   */
  async updateRepository(): Promise<void> {
    try {
      await execAsync('git fetch --all', { cwd: this.repoPath });
    } catch (error) {
      this.logger.error('Failed to update repository', { repoPath: this.repoPath, error });
      throw error;
    }
  }
}

