import { CommitData } from '../models/commit';
import { Logger } from '../utils/logger';

/**
 * 데이터 검증 서비스
 */
export class ValidationService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ValidationService');
  }

  /**
   * 커밋 데이터 검증
   */
  validateCommitData(commit: CommitData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 필수 필드 검증
    if (!commit.hash || commit.hash.trim() === '') {
      errors.push('커밋 해시가 없습니다.');
    }

    if (!commit.message || commit.message.trim() === '') {
      errors.push('커밋 메시지가 없습니다.');
    }

    if (!commit.author || !commit.author.name || !commit.author.email) {
      errors.push('작성자 정보가 불완전합니다.');
    }

    if (!commit.committer || !commit.committer.name || !commit.committer.email) {
      errors.push('커미터 정보가 불완전합니다.');
    }

    if (!commit.date || isNaN(commit.date.getTime())) {
      errors.push('유효하지 않은 커밋 날짜입니다.');
    }

    if (!commit.repository || !commit.repository.name) {
      errors.push('저장소 정보가 없습니다.');
    }

    // 데이터 품질 검증
    if (commit.message.length > 1000) {
      warnings.push('커밋 메시지가 너무 깁니다.');
    }

    if (commit.diff && commit.diff.length > 1000000) { // 1MB
      warnings.push('Diff가 너무 큽니다.');
    }

    if (commit.files.length === 0) {
      warnings.push('변경된 파일이 없습니다.');
    }

    // 파일 정보 검증
    for (const file of commit.files) {
      const fileValidation = this.validateFileData(file);
      errors.push(...fileValidation.errors);
      warnings.push(...fileValidation.warnings);
    }

    // 메타데이터 검증
    if (!commit.metadata || !commit.metadata.collectedAt) {
      errors.push('수집 메타데이터가 없습니다.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 파일 데이터 검증
   */
  private validateFileData(file: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!file.path || file.path.trim() === '') {
      errors.push('파일 경로가 없습니다.');
    }

    if (!file.type || !['added', 'modified', 'deleted', 'renamed'].includes(file.type)) {
      errors.push('유효하지 않은 파일 변경 타입입니다.');
    }

    if (typeof file.additions !== 'number' || file.additions < 0) {
      errors.push('유효하지 않은 추가 라인 수입니다.');
    }

    if (typeof file.deletions !== 'number' || file.deletions < 0) {
      errors.push('유효하지 않은 삭제 라인 수입니다.');
    }

    if (file.type === 'renamed' && !file.previousPath) {
      warnings.push('이름이 변경된 파일의 이전 경로가 없습니다.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 커밋 목록 검증
   */
  validateCommitList(commits: CommitData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (commits.length === 0) {
      warnings.push('수집된 커밋이 없습니다.');
      return { isValid: true, errors, warnings };
    }

    // 중복 커밋 검증
    const hashes = new Set<string>();
    const duplicates: string[] = [];

    for (const commit of commits) {
      if (hashes.has(commit.hash)) {
        duplicates.push(commit.hash);
      } else {
        hashes.add(commit.hash);
      }
    }

    if (duplicates.length > 0) {
      errors.push(`중복된 커밋이 발견되었습니다: ${duplicates.join(', ')}`);
    }

    // 개별 커밋 검증
    let validCount = 0;
    let invalidCount = 0;

    for (const commit of commits) {
      const result = this.validateCommitData(commit);
      if (result.isValid) {
        validCount++;
      } else {
        invalidCount++;
        errors.push(`커밋 ${commit.hash}: ${result.errors.join(', ')}`);
      }
      warnings.push(...result.warnings.map(w => `커밋 ${commit.hash}: ${w}`));
    }

    this.logger.info('Commit validation completed', {
      total: commits.length,
      valid: validCount,
      invalid: invalidCount,
      warnings: warnings.length,
    });

    return {
      isValid: invalidCount === 0 && duplicates.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 커밋 데이터 정제
   */
  sanitizeCommitData(commit: CommitData): CommitData {
    const sanitized = { ...commit };

    // 문자열 필드 정제
    sanitized.hash = sanitized.hash?.trim() || '';
    sanitized.message = sanitized.message?.trim() || '';
    sanitized.branch = sanitized.branch?.trim() || '';

    // 작성자 정보 정제
    if (sanitized.author) {
      sanitized.author.name = sanitized.author.name?.trim() || '';
      sanitized.author.email = sanitized.author.email?.trim() || '';
      sanitized.author.username = sanitized.author.username?.trim() || undefined;
    }

    // 커미터 정보 정제
    if (sanitized.committer) {
      sanitized.committer.name = sanitized.committer.name?.trim() || '';
      sanitized.committer.email = sanitized.committer.email?.trim() || '';
      sanitized.committer.username = sanitized.committer.username?.trim() || undefined;
    }

    // Diff 정제
    sanitized.diff = sanitized.diff?.trim() || '';

    // 파일 정보 정제
    sanitized.files = sanitized.files.map(file => ({
      ...file,
      path: file.path?.trim() || '',
      previousPath: file.previousPath?.trim() || undefined,
      additions: Math.max(0, file.additions || 0),
      deletions: Math.max(0, file.deletions || 0),
    }));

    // 저장소 정보 정제
    if (sanitized.repository) {
      sanitized.repository.name = sanitized.repository.name?.trim() || '';
      sanitized.repository.fullName = sanitized.repository.fullName?.trim() || '';
      sanitized.repository.url = sanitized.repository.url?.trim() || '';
      sanitized.repository.description = sanitized.repository.description?.trim() || undefined;
      sanitized.repository.defaultBranch = sanitized.repository.defaultBranch?.trim() || 'main';
      sanitized.repository.language = sanitized.repository.language?.trim() || undefined;
    }

    return sanitized;
  }

  /**
   * 커밋 목록 정제
   */
  sanitizeCommitList(commits: CommitData[]): CommitData[] {
    return commits.map(commit => this.sanitizeCommitData(commit));
  }

  /**
   * 필터링 규칙 적용
   */
  applyFilters(commits: CommitData[], filters: ValidationFilters): CommitData[] {
    let filtered = [...commits];

    // 최소/최대 커밋 메시지 길이
    if (filters.minMessageLength) {
      filtered = filtered.filter(commit => commit.message.length >= filters.minMessageLength!);
    }

    if (filters.maxMessageLength) {
      filtered = filtered.filter(commit => commit.message.length <= filters.maxMessageLength!);
    }

    // 최소/최대 파일 변경 수
    if (filters.minFileChanges) {
      filtered = filtered.filter(commit => commit.files.length >= filters.minFileChanges!);
    }

    if (filters.maxFileChanges) {
      filtered = filtered.filter(commit => commit.files.length <= filters.maxFileChanges!);
    }

    // 날짜 범위
    if (filters.since) {
      filtered = filtered.filter(commit => commit.date >= filters.since!);
    }

    if (filters.until) {
      filtered = filtered.filter(commit => commit.date <= filters.until!);
    }

    // 브랜치 필터
    if (filters.branches && filters.branches.length > 0) {
      filtered = filtered.filter(commit => filters.branches!.includes(commit.branch));
    }

    // 파일 패턴 필터
    if (filters.includeFilePatterns && filters.includeFilePatterns.length > 0) {
      filtered = filtered.filter(commit => 
        commit.files.some(file => 
          filters.includeFilePatterns!.some(pattern => 
            this.matchesPattern(file.path, pattern)
          )
        )
      );
    }

    if (filters.excludeFilePatterns && filters.excludeFilePatterns.length > 0) {
      filtered = filtered.filter(commit => 
        !commit.files.some(file => 
          filters.excludeFilePatterns!.some(pattern => 
            this.matchesPattern(file.path, pattern)
          )
        )
      );
    }

    return filtered;
  }

  /**
   * 패턴 매칭 (간단한 와일드카드 지원)
   */
  private matchesPattern(path: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(path);
  }
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 검증 필터
 */
export interface ValidationFilters {
  minMessageLength?: number;
  maxMessageLength?: number;
  minFileChanges?: number;
  maxFileChanges?: number;
  since?: Date;
  until?: Date;
  branches?: string[];
  includeFilePatterns?: string[];
  excludeFilePatterns?: string[];
}

