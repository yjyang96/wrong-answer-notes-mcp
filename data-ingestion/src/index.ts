import dotenv from 'dotenv';
import { CollectionService } from './services/collection';
import { ValidationService } from './services/validation';
import { RepositoryCollectionConfig } from './models/repository';
import { Logger } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// 환경 변수 로드
dotenv.config();

/**
 * 데이터 수집 서비스 메인 클래스
 */
export class DataIngestionService {
  private collectionService: CollectionService;
  private validationService: ValidationService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('DataIngestionService');
    this.collectionService = new CollectionService(
      process.env.GITHUB_TOKEN,
      process.env.GITHUB_BASE_URL
    );
    this.validationService = new ValidationService();
  }

  /**
   * 저장소에서 데이터 수집 실행
   */
  async collectFromRepository(
    repository: string,
    options: {
      branches?: string[];
      limit?: number;
      since?: Date;
      until?: Date;
      includePatterns?: string[];
      excludePatterns?: string[];
      source?: 'github-api' | 'git-cli' | 'pydriller';
      outputFile?: string;
    } = {}
  ): Promise<void> {
    const config: RepositoryCollectionConfig = {
      repository,
      branches: options.branches || [],
      limit: options.limit,
      since: options.since,
      until: options.until,
      includePatterns: options.includePatterns,
      excludePatterns: options.excludePatterns,
      enabled: true,
      priority: 1,
    };

    this.logger.info('Starting data collection', { repository, options });

    try {
      const job = await this.collectionService.collectFromRepository(
        config,
        options.source || 'github-api'
      );

      if (job.status === 'completed' && job.result) {
        const commits = job.result.commits;
        
        // 데이터 검증
        const validationResult = this.validationService.validateCommitList(commits);
        
        if (!validationResult.isValid) {
          this.logger.warn('Validation failed', {
            repository,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
          });
        }

        // 데이터 정제
        const sanitizedCommits = this.validationService.sanitizeCommitList(commits);

        // 결과 저장
        if (options.outputFile) {
          await this.saveResults(sanitizedCommits, options.outputFile);
        }

        this.logger.info('Data collection completed', {
          repository,
          commitCount: sanitizedCommits.length,
          validationErrors: validationResult.errors.length,
          validationWarnings: validationResult.warnings.length,
        });

      } else {
        this.logger.error('Data collection failed', {
          repository,
          error: job.error,
        });
        throw new Error(`Data collection failed: ${job.error?.message}`);
      }

    } catch (error) {
      this.logger.error('Data collection error', { repository, error });
      throw error;
    }
  }

  /**
   * 여러 저장소에서 데이터 수집 실행
   */
  async collectFromMultipleRepositories(
    repositories: string[],
    options: {
      branches?: string[];
      limit?: number;
      since?: Date;
      until?: Date;
      includePatterns?: string[];
      excludePatterns?: string[];
      source?: 'github-api' | 'git-cli' | 'pydriller';
      outputDir?: string;
      maxConcurrency?: number;
    } = {}
  ): Promise<void> {
    const configs: RepositoryCollectionConfig[] = repositories.map(repo => ({
      repository: repo,
      branches: options.branches || [],
      limit: options.limit,
      since: options.since,
      until: options.until,
      includePatterns: options.includePatterns,
      excludePatterns: options.excludePatterns,
      enabled: true,
      priority: 1,
    }));

    this.logger.info('Starting multi-repository data collection', {
      repositoryCount: repositories.length,
      options,
    });

    try {
      const jobs = await this.collectionService.collectFromMultipleRepositories(
        configs,
        options.source || 'github-api',
        options.maxConcurrency || 3
      );

      const results: any[] = [];

      for (const job of jobs) {
        if (job.status === 'completed' && job.result) {
          const commits = job.result.commits;
          
          // 데이터 검증 및 정제
          const validationResult = this.validationService.validateCommitList(commits);
          const sanitizedCommits = this.validationService.sanitizeCommitList(commits);

          results.push({
            repository: job.config.repository,
            commits: sanitizedCommits,
            validation: validationResult,
            statistics: job.metadata.statistics,
          });

          // 개별 파일 저장
          if (options.outputDir) {
            const outputFile = path.join(
              options.outputDir,
              `${job.config.repository.replace('/', '_')}.json`
            );
            await this.saveResults(sanitizedCommits, outputFile);
          }
        }
      }

      // 전체 결과 저장
      if (options.outputDir) {
        const summaryFile = path.join(options.outputDir, 'collection_summary.json');
        await this.saveResults(results, summaryFile);
      }

      this.logger.info('Multi-repository data collection completed', {
        totalRepositories: repositories.length,
        successfulRepositories: results.length,
        totalCommits: results.reduce((sum, result) => sum + result.commits.length, 0),
      });

    } catch (error) {
      this.logger.error('Multi-repository data collection error', { error });
      throw error;
    }
  }

  /**
   * 설정 파일에서 수집 실행
   */
  async collectFromConfig(configFile: string): Promise<void> {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      
      if (config.repositories && Array.isArray(config.repositories)) {
        await this.collectFromMultipleRepositories(
          config.repositories,
          config.options || {}
        );
      } else if (config.repository) {
        await this.collectFromRepository(config.repository, config.options || {});
      } else {
        throw new Error('Invalid configuration file format');
      }

    } catch (error) {
      this.logger.error('Failed to collect from config', { configFile, error });
      throw error;
    }
  }

  /**
   * 결과를 파일에 저장
   */
  private async saveResults(data: any, outputFile: string): Promise<void> {
    try {
      // 출력 디렉토리 생성
      const outputDir = path.dirname(outputFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // JSON 파일로 저장
      fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf-8');
      
      this.logger.info('Results saved', { outputFile, dataSize: JSON.stringify(data).length });
    } catch (error) {
      this.logger.error('Failed to save results', { outputFile, error });
      throw error;
    }
  }
}

/**
 * CLI 인터페이스
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
사용법:
  npm run dev -- <repository> [options]
  npm run dev -- --config <config-file>
  npm run dev -- --multi <repo1,repo2,repo3> [options]

옵션:
  --branches <branch1,branch2>    수집할 브랜치 목록
  --limit <number>                수집할 커밋 수 제한
  --since <YYYY-MM-DD>            수집 시작 날짜
  --until <YYYY-MM-DD>            수집 종료 날짜
  --include <pattern1,pattern2>   포함할 파일 패턴
  --exclude <pattern1,pattern2>   제외할 파일 패턴
  --source <github-api|git-cli|pydriller>  수집 소스
  --output <file>                 출력 파일 경로
  --output-dir <dir>              출력 디렉토리 (멀티 저장소용)
  --max-concurrency <number>      최대 동시 수집 수
    `);
    return;
  }

  const service = new DataIngestionService();
  
  try {
    if (args[0] === '--config') {
      // 설정 파일에서 수집
      const configFile = args[1];
      if (!configFile) {
        throw new Error('설정 파일 경로를 지정해주세요.');
      }
      await service.collectFromConfig(configFile);
      
    } else if (args[0] === '--multi') {
      // 여러 저장소에서 수집
      const repositories = args[1].split(',').map((repo: string) => repo.trim());
      const options = parseOptions(args.slice(2));
      await service.collectFromMultipleRepositories(repositories, options);
      
    } else {
      // 단일 저장소에서 수집
      const repository = args[0];
      const options = parseOptions(args.slice(1));
      await service.collectFromRepository(repository, options);
    }
    
    console.log('데이터 수집이 완료되었습니다.');
    
  } catch (error) {
    console.error('데이터 수집 중 오류가 발생했습니다:', error);
    process.exit(1);
  }
}

/**
 * 명령행 옵션 파싱
 */
function parseOptions(args: string[]): any {
  const options: any = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    switch (key) {
      case '--branches':
        options.branches = value.split(',').map((b: string) => b.trim());
        break;
      case '--limit':
        options.limit = parseInt(value);
        break;
      case '--since':
        options.since = new Date(value);
        break;
      case '--until':
        options.until = new Date(value);
        break;
      case '--include':
        options.includePatterns = value.split(',').map((p: string) => p.trim());
        break;
      case '--exclude':
        options.excludePatterns = value.split(',').map((p: string) => p.trim());
        break;
      case '--source':
        options.source = value;
        break;
      case '--output':
        options.outputFile = value;
        break;
      case '--output-dir':
        options.outputDir = value;
        break;
      case '--max-concurrency':
        options.maxConcurrency = parseInt(value);
        break;
    }
  }
  
  return options;
}

// CLI로 실행된 경우 main 함수 호출
if (require.main === module) {
  main().catch(console.error);
}


