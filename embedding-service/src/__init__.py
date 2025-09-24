"""
Embedding Service Package
"""

from .models import (
    EmbeddingRequest,
    EmbeddingResponse,
    EmbeddingData,
    EmbeddingConfig,
    StorageConfig,
    ProcessedCommitData
)
from .embedding_service import EmbeddingService
from .azure_service import AzureEmbeddingService
from .batch_processor import EmbeddingBatchProcessor
from .storage_service import EmbeddingStorageService

__version__ = "1.0.0"
__all__ = [
    "EmbeddingRequest",
    "EmbeddingResponse", 
    "EmbeddingData",
    "EmbeddingConfig",
    "StorageConfig",
    "ProcessedCommitData",
    "EmbeddingService",
    "AzureEmbeddingService",
    "EmbeddingBatchProcessor",
    "EmbeddingStorageService"
]
