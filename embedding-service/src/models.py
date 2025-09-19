"""
Data models for embedding service
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
import json


class EmbeddingRequest(BaseModel):
    """Request for generating a single embedding"""
    text: str
    content_type: Literal["text", "code", "mixed"]
    commit_id: str
    metadata: Optional[Dict[str, Any]] = None


class EmbeddingResponse(BaseModel):
    """Response from embedding generation"""
    embedding: List[float]
    usage: Dict[str, int]
    model: str
    dimensions: int


class EmbeddingData(BaseModel):
    """Complete embedding data with metadata"""
    embedding_id: str
    commit_id: str
    embedding_vector: List[float]
    text_content: str
    code_content: str
    metadata: "EmbeddingMetadata"


class EmbeddingMetadata(BaseModel):
    """Metadata for embedding"""
    model_version: str
    generated_at: datetime
    quality_score: float
    dimensions: int
    content_type: Literal["text", "code", "mixed"]
    processing_time_ms: int
    batch_id: Optional[str] = None


class BatchEmbeddingRequest(BaseModel):
    """Request for batch embedding generation"""
    requests: List[EmbeddingRequest]
    batch_id: str
    options: Optional["BatchOptions"] = None


class BatchOptions(BaseModel):
    """Options for batch processing"""
    max_concurrent: int = 5
    batch_size: int = 100
    retry_attempts: int = 3
    timeout_ms: int = 30000


class BatchEmbeddingResult(BaseModel):
    """Result of batch embedding generation"""
    batch_id: str
    total_requests: int
    successful: int
    failed: int
    embeddings: List[EmbeddingData]
    errors: List["BatchError"]
    processing_time_ms: int
    quality_metrics: "QualityMetrics"


class BatchError(BaseModel):
    """Error information for batch processing"""
    commit_id: str
    error: str
    retry_count: int


class QualityMetrics(BaseModel):
    """Quality metrics for embeddings"""
    average_quality_score: float
    min_quality_score: float
    max_quality_score: float
    quality_distribution: Dict[str, int]
    average_processing_time_ms: float
    total_tokens_used: int


class ProcessedCommitData(BaseModel):
    """Processed commit data from data-ingestion service"""
    commit_id: str
    repository: str
    branch: str
    message: str
    diff: str
    author: str
    date: datetime
    classification: Dict[str, Any]
    metadata: Dict[str, Any]


class EmbeddingConfig(BaseModel):
    """Configuration for embedding service"""
    model: str = "text-embedding-3-large"
    dimensions: int = 3072
    batch_size: int = 100
    max_concurrent: int = 5
    timeout_ms: int = 30000
    retry_attempts: int = 3
    quality_threshold: float = 0.7
    api_key: str = ""
    endpoint: str = ""
    api_version: str = "2024-02-15-preview"


class StorageConfig(BaseModel):
    """Configuration for storage"""
    output_dir: str = "output/embeddings"
    create_index: bool = True
    compress_output: bool = False


# Update forward references
EmbeddingData.model_rebuild()
BatchEmbeddingRequest.model_rebuild()
BatchEmbeddingResult.model_rebuild()
