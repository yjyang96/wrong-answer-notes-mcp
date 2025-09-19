/**
 * 저장소 모델
 */
export interface Repository {
  /** 저장소 ID */
  id: string;
  /** 저장소 이름 */
  name: string;
  /** 저장소 전체 이름 (owner/repo) */
  fullName: string;
  /** 저장소 소유자 */
  owner: string;
  /** 저장소 설명 */
  description?: string;
  /** 저장소 URL */
  url: string;
  /** 클론 URL */
  cloneUrl: string;
  /** SSH URL */
  sshUrl: string;
  /** 기본 브랜치 */
  defaultBranch: string;
  /** 저장소 언어 */
  language?: string;
  /** 저장소 크기 (바이트) */
  size: number;
  /** 저장소 생성일 */
  createdAt: Date;
  /** 마지막 업데이트일 */
  updatedAt: Date;
  /** 마지막 푸시일 */
  pushedAt?: Date;
  /** 저장소가 비공개인지 여부 */
  isPrivate: boolean;
  /** 포크 여부 */
  isFork: boolean;
  /** 별표 수 */
  stars: number;
  /** 포크 수 */
  forks: number;
  /** 이슈 수 */
  openIssues: number;
  /** 라이선스 */
  license?: string;
  /** 토픽/태그 */
  topics: string[];
}

/**
 * 브랜치 정보
 */
export interface Branch {
  /** 브랜치 이름 */
  name: string;
  /** 브랜치 커밋 해시 */
  sha: string;
  /** 브랜치 보호 여부 */
  protected: boolean;
  /** 브랜치 생성일 */
  createdAt?: Date;
  /** 브랜치 마지막 업데이트일 */
  updatedAt?: Date;
}

/**
 * 저장소 수집 설정
 */
export interface RepositoryCollectionConfig {
  /** 저장소 식별자 */
  repository: string;
  /** 수집할 브랜치 목록 */
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
  /** 수집 활성화 여부 */
  enabled: boolean;
  /** 수집 우선순위 */
  priority: number;
}

