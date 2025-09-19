export interface ProcessedCommitData {
  commit_id: string;
  repository: string;
  branch: string;
  message: string;
  diff: string;
  author: string;
  date: Date;
  classification: ClassificationData;
  metadata: ProcessedMetadata;
}

export interface ClassificationData {
  type: 'version_update' | 'fix' | 'patch' | 'error' | 'other';
  confidence: number;
  package_name?: string;
  version?: string;
  error_type?: string;
  api_signature?: string;
  reasoning?: string;
}

export interface ProcessedMetadata {
  processed_at: string;
  quality_score: number;
  validation_status: 'valid' | 'warning' | 'invalid';
  original_commit_hash: string;
  preprocessing_stage: 'filtered' | 'classified' | 'extracted' | 'validated';
}

export interface FilteringRule {
  name: string;
  pattern: RegExp;
  weight: number;
  category: 'version_update' | 'fix' | 'patch' | 'error' | 'other';
}

export interface LLMClassificationRequest {
  commit_message: string;
  diff_summary: string;
  file_changes: string[];
}

export interface LLMClassificationResponse {
  type: string;
  confidence: number;
  package_name?: string;
  version?: string;
  error_type?: string;
  api_signature?: string;
  reasoning: string;
}

export interface QualityMetrics {
  total_commits: number;
  filtered_commits: number;
  classified_commits: number;
  high_confidence_commits: number;
  average_confidence: number;
  quality_score: number;
}
