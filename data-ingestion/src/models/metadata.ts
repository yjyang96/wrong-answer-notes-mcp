/**
 * 메타데이터 모델
 */
export interface Metadata {
  /** 메타데이터 ID */
  id: string;
  /** 수집 시간 */
  collectedAt: Date;
  /** 수집 소스 */
  source: 'github-api' | 'git-cli' | 'pydriller';
  /** 수집 버전 */
  version: string;
  /** 수집 설정 */
  config: any;
  /** 수집 상태 */
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  /** 수집된 항목 수 */
  itemCount: number;
  /** 수집 시작 시간 */
  startedAt: Date;
  /** 수집 완료 시간 */
  completedAt?: Date;
  /** 오류 정보 */
  error?: ErrorInfo;
  /** 수집 통계 */
  statistics: CollectionStatistics;
}

/**
 * 오류 정보
 */
export interface ErrorInfo {
  /** 오류 메시지 */
  message: string;
  /** 오류 코드 */
  code?: string;
  /** 오류 스택 */
  stack?: string;
  /** 오류 발생 시간 */
  timestamp: Date;
  /** 재시도 횟수 */
  retryCount: number;
}

/**
 * 수집 통계
 */
export interface CollectionStatistics {
  /** 총 커밋 수 */
  totalCommits: number;
  /** 수집된 커밋 수 */
  collectedCommits: number;
  /** 실패한 커밋 수 */
  failedCommits: number;
  /** 총 파일 수 */
  totalFiles: number;
  /** 수집된 파일 수 */
  collectedFiles: number;
  /** 수집 시간 (밀리초) */
  collectionTimeMs: number;
  /** 평균 커밋당 수집 시간 (밀리초) */
  avgTimePerCommitMs: number;
  /** API 호출 수 */
  apiCalls: number;
  /** 레이트 리미팅으로 인한 대기 시간 (밀리초) */
  rateLimitWaitTimeMs: number;
}

/**
 * 수집 작업 정보
 */
export interface CollectionJob {
  /** 작업 ID */
  id: string;
  /** 작업 이름 */
  name: string;
  /** 작업 설명 */
  description?: string;
  /** 작업 상태 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** 작업 우선순위 */
  priority: number;
  /** 작업 생성 시간 */
  createdAt: Date;
  /** 작업 시작 시간 */
  startedAt?: Date;
  /** 작업 완료 시간 */
  completedAt?: Date;
  /** 작업 설정 */
  config: any;
  /** 작업 결과 */
  result?: any;
  /** 작업 오류 */
  error?: ErrorInfo;
  /** 작업 진행률 (0-100) */
  progress: number;
  /** 작업 메타데이터 */
  metadata: Metadata;
}

/**
 * 수집 스케줄 정보
 */
export interface CollectionSchedule {
  /** 스케줄 ID */
  id: string;
  /** 스케줄 이름 */
  name: string;
  /** 크론 표현식 */
  cronExpression: string;
  /** 활성화 여부 */
  enabled: boolean;
  /** 마지막 실행 시간 */
  lastRunAt?: Date;
  /** 다음 실행 시간 */
  nextRunAt?: Date;
  /** 실행 횟수 */
  runCount: number;
  /** 성공 횟수 */
  successCount: number;
  /** 실패 횟수 */
  failureCount: number;
  /** 스케줄 설정 */
  config: any;
}

