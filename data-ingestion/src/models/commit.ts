/**
 * Git 커밋 데이터 모델
 */
export interface CommitData {
  /** 커밋 해시 */
  hash: string;
  /** 커밋 메시지 */
  message: string;
  /** 커밋 작성자 */
  author: Author;
  /** 커밋 커미터 */
  committer: Author;
  /** 커밋 날짜 */
  date: Date;
  /** 커밋 Diff */
  diff: string;
  /** 변경된 파일 목록 */
  files: ChangedFile[];
  /** 브랜치 정보 */
  branch: string;
  /** 저장소 정보 */
  repository: RepositoryInfo;
  /** 수집 메타데이터 */
  metadata: CollectionMetadata;
}

/**
 * 작성자/커미터 정보
 */
export interface Author {
  /** 이름 */
  name: string;
  /** 이메일 */
  email: string;
  /** GitHub 사용자명 (있는 경우) */
  username?: string;
}

/**
 * 변경된 파일 정보
 */
export interface ChangedFile {
  /** 파일 경로 */
  path: string;
  /** 변경 타입 (added, modified, deleted, renamed) */
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  /** 추가된 라인 수 */
  additions: number;
  /** 삭제된 라인 수 */
  deletions: number;
  /** 파일 크기 (바이트) */
  size?: number;
  /** 이전 파일 경로 (renamed인 경우) */
  previousPath?: string;
}

/**
 * 저장소 정보
 */
export interface RepositoryInfo {
  /** 저장소 이름 */
  name: string;
  /** 저장소 전체 이름 (owner/repo) */
  fullName: string;
  /** 저장소 URL */
  url: string;
  /** 저장소 설명 */
  description?: string;
  /** 기본 브랜치 */
  defaultBranch: string;
  /** 저장소 언어 */
  language?: string;
  /** 저장소 크기 (바이트) */
  size?: number;
  /** 저장소 생성일 */
  createdAt: Date;
  /** 마지막 업데이트일 */
  updatedAt: Date;
}

/**
 * 수집 메타데이터
 */
export interface CollectionMetadata {
  /** 수집 시간 */
  collectedAt: Date;
  /** 수집 소스 (github-api, git-cli, pydriller) */
  source: 'github-api' | 'git-cli' | 'pydriller';
  /** 수집 버전 */
  version: string;
  /** 수집 설정 */
  config: CollectionConfig;
}

/**
 * 수집 설정
 */
export interface CollectionConfig {
  /** 수집할 브랜치 목록 (빈 배열이면 모든 브랜치) */
  branches: string[];
  /** 수집할 커밋 수 제한 */
  limit?: number;
  /** 수집 시작 날짜 */
  since?: Date;
  /** 수집 종료 날짜 */
  until?: Date;
  /** 포함할 파일 패턴 */
  includePatterns?: string[];
  /** 제외할 파일 패턴 */
  excludePatterns?: string[];
}

