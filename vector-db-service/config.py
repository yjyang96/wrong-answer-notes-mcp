"""
Configuration management for Vector DB Service
"""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Application configuration from environment variables"""
    
    # =============================================================================
    # ChromaDB Configuration
    # =============================================================================
    CHROMA_PERSIST_DIRECTORY: str = os.getenv("CHROMA_PERSIST_DIRECTORY", "./data/chroma_db")
    CHROMA_COLLECTION_NAME: str = os.getenv("CHROMA_COLLECTION_NAME", "commit_embeddings")
    CHROMA_DISTANCE_METRIC: str = os.getenv("CHROMA_DISTANCE_METRIC", "cosine")
    CHROMA_HNSW_SPACE: str = os.getenv("CHROMA_HNSW_SPACE", "cosine")
    CHROMA_HNSW_CONSTRUCTION_EF: int = int(os.getenv("CHROMA_HNSW_CONSTRUCTION_EF", "200"))
    CHROMA_HNSW_M: int = int(os.getenv("CHROMA_HNSW_M", "16"))
    
    # =============================================================================
    # Azure OpenAI API Configuration
    # =============================================================================
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "text-embedding-3-large")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    
    # =============================================================================
    # Migration Configuration
    # =============================================================================
    MIGRATION_SOURCE_DIR: str = os.getenv("MIGRATION_SOURCE_DIR", "../embedding-service/output/embeddings")
    MIGRATION_BATCH_SIZE: int = int(os.getenv("MIGRATION_BATCH_SIZE", "100"))
    MIGRATION_OVERWRITE_EXISTING: bool = os.getenv("MIGRATION_OVERWRITE_EXISTING", "false").lower() == "true"
    
    # =============================================================================
    # Logging Configuration
    # =============================================================================
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "logs/vector-db.log")
    LOG_ROTATION_SIZE: str = os.getenv("LOG_ROTATION_SIZE", "10MB")
    LOG_RETENTION_DAYS: int = int(os.getenv("LOG_RETENTION_DAYS", "30"))
    
    # =============================================================================
    # Performance Configuration
    # =============================================================================
    MAX_CONCURRENT_REQUESTS: int = int(os.getenv("MAX_CONCURRENT_REQUESTS", "10"))
    REQUEST_TIMEOUT_SECONDS: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
    EMBEDDING_CACHE_SIZE: int = int(os.getenv("EMBEDDING_CACHE_SIZE", "1000"))
    
    # =============================================================================
    # Backup Configuration
    # =============================================================================
    BACKUP_DIR: str = os.getenv("BACKUP_DIR", "./data/backups")
    BACKUP_RETENTION_DAYS: int = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
    BACKUP_COMPRESSION: bool = os.getenv("BACKUP_COMPRESSION", "true").lower() == "true"
    BACKUP_SCHEDULE: str = os.getenv("BACKUP_SCHEDULE", "0 2 * * *")  # Daily at 2 AM
    
    # =============================================================================
    # Monitoring Configuration
    # =============================================================================
    ENABLE_METRICS: bool = os.getenv("ENABLE_METRICS", "true").lower() == "true"
    METRICS_PORT: int = int(os.getenv("METRICS_PORT", "8080"))
    HEALTH_CHECK_INTERVAL: int = int(os.getenv("HEALTH_CHECK_INTERVAL", "60"))
    
    @classmethod
    def validate(cls) -> bool:
        """Validate configuration"""
        errors = []
        
        # Check required directories
        if not Path(cls.CHROMA_PERSIST_DIRECTORY).parent.exists():
            errors.append(f"ChromaDB persist directory parent does not exist: {cls.CHROMA_PERSIST_DIRECTORY}")
        
        if not Path(cls.BACKUP_DIR).parent.exists():
            errors.append(f"Backup directory parent does not exist: {cls.BACKUP_DIR}")
        
        # Check Azure OpenAI configuration for text search
        if not cls.AZURE_OPENAI_API_KEY or not cls.AZURE_OPENAI_ENDPOINT:
            print("⚠️  Azure OpenAI API not configured - text search will be disabled")
        
        # Check numeric values
        if cls.CHROMA_HNSW_CONSTRUCTION_EF < 1:
            errors.append("CHROMA_HNSW_CONSTRUCTION_EF must be >= 1")
        
        if cls.CHROMA_HNSW_M < 1:
            errors.append("CHROMA_HNSW_M must be >= 1")
        
        if cls.MIGRATION_BATCH_SIZE < 1:
            errors.append("MIGRATION_BATCH_SIZE must be >= 1")
        
        if cls.REQUEST_TIMEOUT_SECONDS < 1:
            errors.append("REQUEST_TIMEOUT_SECONDS must be >= 1")
        
        if errors:
            print("❌ Configuration validation errors:")
            for error in errors:
                print(f"   - {error}")
            return False
        
        print("✅ Configuration validation passed")
        return True
    
    @classmethod
    def print_config(cls):
        """Print current configuration"""
        print("🔧 Current Configuration:")
        print(f"   ChromaDB Directory: {cls.CHROMA_PERSIST_DIRECTORY}")
        print(f"   Collection Name: {cls.CHROMA_COLLECTION_NAME}")
        print(f"   Migration Source: {cls.MIGRATION_SOURCE_DIR}")
        print(f"   Log Level: {cls.LOG_LEVEL}")
        print(f"   Azure OpenAI: {'✅ Configured' if cls.AZURE_OPENAI_API_KEY else '❌ Not configured'}")
        print(f"   Metrics: {'✅ Enabled' if cls.ENABLE_METRICS else '❌ Disabled'}")


# Global config instance
config = Config()
