"""
Data models for vector database service
"""

import os
from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class ChromaDocument(BaseModel):
    """ChromaDB document structure"""
    id: str
    embedding: List[float]
    document: str
    metadata: Dict[str, Any]


class SearchQuery(BaseModel):
    """Search query structure"""
    query_text: Optional[str] = None
    query_embedding: Optional[List[float]] = None
    n_results: int = 10
    where: Optional[Dict[str, Any]] = None
    include: List[str] = ["documents", "metadatas", "distances"]


class SearchResult(BaseModel):
    """Search result structure"""
    ids: List[str]
    documents: List[str]
    metadatas: List[Dict[str, Any]]
    distances: List[float]
    query_time_ms: float


class CollectionInfo(BaseModel):
    """ChromaDB collection information"""
    name: str
    id: str
    metadata: Dict[str, Any]
    count: int
    created_at: datetime


class ChromaConfig(BaseModel):
    """ChromaDB configuration"""
    persist_directory: str = "./data/chroma_db"
    collection_name: str = "default"
    distance_metric: str = "cosine"
    hnsw_space: str = "cosine"
    hnsw_construction_ef: int = 200
    hnsw_M: int = 16
    
    @classmethod
    def from_env(cls) -> "ChromaConfig":
        """Create config from environment variables"""
        return cls(
            persist_directory=os.getenv("CHROMA_PERSIST_DIRECTORY", "./data/chroma_db"),
            collection_name=os.getenv("CHROMA_COLLECTION_NAME", "commit_embeddings"),
            distance_metric=os.getenv("CHROMA_DISTANCE_METRIC", "cosine"),
            hnsw_space=os.getenv("CHROMA_HNSW_SPACE", "cosine"),
            hnsw_construction_ef=int(os.getenv("CHROMA_HNSW_CONSTRUCTION_EF", "200")),
            hnsw_M=int(os.getenv("CHROMA_HNSW_M", "16"))
        )


class MigrationConfig(BaseModel):
    """Data migration configuration"""
    source_embeddings_dir: str = "../embedding-service/output/embeddings"
    batch_size: int = 100
    overwrite_existing: bool = False
    
    @classmethod
    def from_env(cls) -> "MigrationConfig":
        """Create config from environment variables"""
        return cls(
            source_embeddings_dir=os.getenv("MIGRATION_SOURCE_DIR", "../embedding-service/output/embeddings"),
            batch_size=int(os.getenv("MIGRATION_BATCH_SIZE", "100")),
            overwrite_existing=os.getenv("MIGRATION_OVERWRITE_EXISTING", "false").lower() == "true"
        )


class BackupConfig(BaseModel):
    """Backup configuration"""
    backup_dir: str = "./data/backups"
    retention_days: int = 30
    compression: bool = True
    
    @classmethod
    def from_env(cls) -> "BackupConfig":
        """Create config from environment variables"""
        return cls(
            backup_dir=os.getenv("BACKUP_DIR", "./data/backups"),
            retention_days=int(os.getenv("BACKUP_RETENTION_DAYS", "30")),
            compression=os.getenv("BACKUP_COMPRESSION", "true").lower() == "true"
        )


class MonitoringMetrics(BaseModel):
    """Monitoring metrics"""
    collection_count: int
    total_documents: int
    storage_size_mb: float
    last_backup: Optional[datetime] = None
    query_count_today: int = 0
    average_query_time_ms: float = 0.0


class EmbeddingData(BaseModel):
    """Embedding data from embedding-service"""
    embedding_id: str
    commit_id: str
    embedding_vector: List[float]
    text_content: str
    code_content: str
    metadata: Dict[str, Any]


class VectorDBStats(BaseModel):
    """Vector database statistics"""
    collections: List[CollectionInfo]
    total_documents: int
    storage_size_mb: float
    last_updated: datetime
    health_status: Literal["healthy", "warning", "error"] = "healthy"


class AppConfig(BaseModel):
    """Application configuration from environment variables"""
    # Logging
    log_level: str = "INFO"
    log_file: str = "logs/vector-db.log"
    log_rotation_size: str = "10MB"
    log_retention_days: int = 30
    
    # Performance
    max_concurrent_requests: int = 10
    request_timeout_seconds: int = 30
    embedding_cache_size: int = 1000
    
    # Monitoring
    enable_metrics: bool = True
    metrics_port: int = 8080
    health_check_interval: int = 60
    
    @classmethod
    def from_env(cls) -> "AppConfig":
        """Create config from environment variables"""
        return cls(
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            log_file=os.getenv("LOG_FILE", "logs/vector-db.log"),
            log_rotation_size=os.getenv("LOG_ROTATION_SIZE", "10MB"),
            log_retention_days=int(os.getenv("LOG_RETENTION_DAYS", "30")),
            max_concurrent_requests=int(os.getenv("MAX_CONCURRENT_REQUESTS", "10")),
            request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30")),
            embedding_cache_size=int(os.getenv("EMBEDDING_CACHE_SIZE", "1000")),
            enable_metrics=os.getenv("ENABLE_METRICS", "true").lower() == "true",
            metrics_port=int(os.getenv("METRICS_PORT", "8080")),
            health_check_interval=int(os.getenv("HEALTH_CHECK_INTERVAL", "60"))
        )
