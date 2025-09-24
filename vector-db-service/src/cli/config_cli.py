"""
Configuration CLI commands
"""

import click
from loguru import logger

from ..models import ChromaConfig, MigrationConfig, AppConfig


@click.group()
def config_cli():
    """Configuration management commands"""
    pass


@config_cli.command()
def validate():
    """Validate current configuration"""
    print("🔧 설정 검증 중...")
    
    try:
        # Load all configurations
        chroma_config = ChromaConfig.from_env()
        migration_config = MigrationConfig.from_env()
        app_config = AppConfig.from_env()
        
        print("✅ 모든 설정이 올바르게 로드되었습니다.")
        
        # Print configuration summary
        print("\n📋 현재 설정:")
        print(f"   ChromaDB 디렉토리: {chroma_config.persist_directory}")
        print(f"   컬렉션명: {chroma_config.collection_name}")
        print(f"   마이그레이션 소스: {migration_config.source_embeddings_dir}")
        print(f"   배치 크기: {migration_config.batch_size}")
        print(f"   로그 레벨: {app_config.log_level}")
        print(f"   Azure OpenAI: {'✅ 설정됨' if app_config.enable_metrics else '❌ 미설정'}")
        
    except Exception as error:
        print(f"❌ 설정 검증 실패: {error}")


@config_cli.command()
def show():
    """Show current configuration"""
    print("📋 현재 설정:")
    
    try:
        chroma_config = ChromaConfig.from_env()
        migration_config = MigrationConfig.from_env()
        app_config = AppConfig.from_env()
        
        print("\n🔧 ChromaDB 설정:")
        print(f"   persist_directory: {chroma_config.persist_directory}")
        print(f"   collection_name: {chroma_config.collection_name}")
        print(f"   distance_metric: {chroma_config.distance_metric}")
        print(f"   hnsw_space: {chroma_config.hnsw_space}")
        print(f"   hnsw_construction_ef: {chroma_config.hnsw_construction_ef}")
        print(f"   hnsw_M: {chroma_config.hnsw_M}")
        
        print("\n📦 마이그레이션 설정:")
        print(f"   source_embeddings_dir: {migration_config.source_embeddings_dir}")
        print(f"   batch_size: {migration_config.batch_size}")
        print(f"   overwrite_existing: {migration_config.overwrite_existing}")
        
        print("\n📊 애플리케이션 설정:")
        print(f"   log_level: {app_config.log_level}")
        print(f"   log_file: {app_config.log_file}")
        print(f"   max_concurrent_requests: {app_config.max_concurrent_requests}")
        print(f"   request_timeout_seconds: {app_config.request_timeout_seconds}")
        print(f"   enable_metrics: {app_config.enable_metrics}")
        print(f"   metrics_port: {app_config.metrics_port}")
        
    except Exception as error:
        print(f"❌ 설정 조회 실패: {error}")


@config_cli.command()
@click.option('--key', required=True, help='환경 변수 키')
@click.option('--value', required=True, help='환경 변수 값')
def set_env(key: str, value: str):
    """Set environment variable (for current session only)"""
    import os
    os.environ[key] = value
    print(f"✅ 환경 변수 설정: {key}={value}")
    print("⚠️  이 설정은 현재 세션에서만 유효합니다.")
    print("영구적으로 설정하려면 .env 파일을 수정하세요.")


@config_cli.command()
def env_template():
    """Generate .env template"""
    template = """# Vector Database Service Environment Configuration

# =============================================================================
# ChromaDB Configuration
# =============================================================================
CHROMA_PERSIST_DIRECTORY=./data/chroma_db
CHROMA_COLLECTION_NAME=commit_embeddings
CHROMA_DISTANCE_METRIC=cosine
CHROMA_HNSW_SPACE=cosine
CHROMA_HNSW_CONSTRUCTION_EF=200
CHROMA_HNSW_M=16

# =============================================================================
# Azure OpenAI API Configuration (for text search)
# =============================================================================
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=text-embedding-3-large
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# =============================================================================
# Migration Configuration
# =============================================================================
MIGRATION_SOURCE_DIR=../embedding-service/output/embeddings
MIGRATION_BATCH_SIZE=100
MIGRATION_OVERWRITE_EXISTING=false

# =============================================================================
# Logging Configuration
# =============================================================================
LOG_LEVEL=INFO
LOG_FILE=logs/vector-db.log
LOG_ROTATION_SIZE=10MB
LOG_RETENTION_DAYS=30

# =============================================================================
# Performance Configuration
# =============================================================================
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT_SECONDS=30
EMBEDDING_CACHE_SIZE=1000

# =============================================================================
# Backup Configuration
# =============================================================================
BACKUP_DIR=./data/backups
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION=true
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM (cron format)

# =============================================================================
# Monitoring Configuration
# =============================================================================
ENABLE_METRICS=true
METRICS_PORT=8080
HEALTH_CHECK_INTERVAL=60
"""
    
    print("📝 .env 템플릿:")
    print(template)
    print("\n💡 이 내용을 .env 파일에 복사하여 사용하세요.")
