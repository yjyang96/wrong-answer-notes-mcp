"""
Command Line Interface for Vector DB Service
"""

import os
from pathlib import Path
from typing import Optional
import click
from loguru import logger
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from ..models import ChromaConfig, MigrationConfig, SearchQuery, AppConfig
from ..chroma.chroma_service import ChromaService
from ..migration.embedding_migrator import EmbeddingMigrator
from .config_cli import config_cli


@click.group()
@click.option('--log-level', default=None, help='로그 레벨 (env: LOG_LEVEL)')
@click.option('--log-file', default=None, help='로그 파일 경로 (env: LOG_FILE)')
@click.option('--config-check', is_flag=True, help='설정 검증 후 종료')
def cli(log_level: str, log_file: str, config_check: bool):
    """벡터 데이터베이스 서비스 CLI"""
    # 환경 변수에서 설정 로드
    app_config = AppConfig.from_env()
    
    # CLI 옵션이 제공되면 환경 변수보다 우선
    final_log_level = log_level or app_config.log_level
    final_log_file = log_file or app_config.log_file
    
    # 로그 설정
    logger.remove()
    logger.add(
        final_log_file,
        level=final_log_level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        rotation=app_config.log_rotation_size
    )
    logger.add(
        lambda msg: print(msg, end=""),
        level=final_log_level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}"
    )
    
    # 설정 검증 요청 시
    if config_check:
        from ..models import ChromaConfig, MigrationConfig
        print("🔧 설정 검증 중...")
        chroma_config = ChromaConfig.from_env()
        migration_config = MigrationConfig.from_env()
        app_config = AppConfig.from_env()
        print("✅ 모든 설정이 올바르게 로드되었습니다.")
        exit(0)


@cli.command()
@click.option('--source', '-s', default=None, help='임베딩 데이터 소스 디렉토리 (env: MIGRATION_SOURCE_DIR)')
@click.option('--collection', '-c', default='default', help='ChromaDB 컬렉션명 (기본값: default)')
@click.option('--batch-size', default=None, help='배치 크기 (env: MIGRATION_BATCH_SIZE)')
@click.option('--overwrite', is_flag=True, help='기존 컬렉션 덮어쓰기 (env: MIGRATION_OVERWRITE_EXISTING)')
def migrate(source: str, collection: str, batch_size: int, overwrite: bool):
    """임베딩 데이터를 ChromaDB로 마이그레이션"""
    print("🚀 데이터 마이그레이션 시작...")
    
    try:
        # 환경 변수에서 설정 로드
        chroma_config = ChromaConfig.from_env()
        migration_config = MigrationConfig.from_env()
        
        # CLI 옵션이 제공되면 환경 변수보다 우선
        if source:
            migration_config.source_embeddings_dir = source
        if collection:
            chroma_config.collection_name = collection
        if batch_size:
            migration_config.batch_size = batch_size
        if overwrite:
            migration_config.overwrite_existing = overwrite
        
        # Initialize migrator
        migrator = EmbeddingMigrator(chroma_config, migration_config)
        
        # Run migration
        success = migrator.migrate_data()
        
        if success:
            print("✅ 데이터 마이그레이션 완료!")
            
            # Show stats
            stats = migrator.get_migration_stats()
            print(f"\n📊 마이그레이션 통계:")
            print(f"   소스 임베딩: {stats.get('source_embeddings_count', 0)}개")
            print(f"   ChromaDB 문서: {stats.get('target_collection_count', 0)}개")
            print(f"   마이그레이션 완료: {'✅' if stats.get('migration_complete') else '❌'}")
        else:
            print("❌ 데이터 마이그레이션 실패")
            
    except Exception as error:
        print(f"❌ 마이그레이션 오류: {error}")


@cli.command()
@click.option('--query', '-q', required=True, help='검색 쿼리')
@click.option('--collection', '-c', default='default', help='컬렉션명 (기본값: default)')
@click.option('--limit', default=10, help='결과 개수')
@click.option('--filter', help='메타데이터 필터 (JSON 형식)')
@click.option('--hybrid/--no-hybrid', default=True, help='하이브리드 검색 사용 (BM25 + 벡터). 기본값: 하이브리드 ON')
@click.option('--bm25-weight', default=0.4, help='BM25 가중치 (0.0-1.0)')
@click.option('--vector-weight', default=0.6, help='벡터 가중치 (0.0-1.0)')
def search(query: str, collection: str, limit: int, filter: Optional[str], 
          hybrid: bool, bm25_weight: float, vector_weight: float):
    """벡터 데이터베이스에서 검색"""
    print(f"🔍 검색 시작: '{query}'")
    
    try:
        # 환경 변수에서 설정 로드
        chroma_config = ChromaConfig.from_env()
        if collection:
            chroma_config.collection_name = collection
        
        # Initialize service
        service = ChromaService(chroma_config)
        
        # Parse filter if provided
        where_filter = None
        if filter:
            import json
            where_filter = json.loads(filter)
        
        # Perform search
        if hybrid:
            print(f"🔀 하이브리드 검색 모드 (BM25: {bm25_weight}, 벡터: {vector_weight})")
            results = service.hybrid_search(
                collection_name=collection,
                query=query,
                top_k=limit,
                bm25_weight=bm25_weight,
                vector_weight=vector_weight
            )
        else:
            # Create search query for vector search
            search_query = SearchQuery(
                query_text=query,
                n_results=limit,
                where=where_filter
            )
            results = service.search(collection, search_query)
        
        print(f"✅ 검색 완료 ({results.query_time_ms:.2f}ms)")
        print(f"📊 결과: {len(results.ids)}개")
        
        # Display results
        for i, (doc_id, document, metadata, distance) in enumerate(zip(
            results.ids, results.documents, results.metadatas, results.distances
        )):
            print(f"\n--- 결과 {i+1} ---")
            print(f"ID: {doc_id}")
            print(f"거리: {distance:.4f}")
            print(f"커밋: {metadata.get('commit_id', 'N/A')[:8]}")
            print(f"분류: {metadata.get('classification_type', 'N/A')}")
            print(f"패키지: {metadata.get('package_name', 'N/A')}")
            print(f"문서 (처음 200자): {document[:200]}...")
        
    except Exception as error:
        print(f"❌ 검색 오류: {error}")


@cli.command()
@click.option('--collection', '-c', default='default', help='컬렉션명 (기본값: default)')
def info(collection: str):
    """컬렉션 정보 조회"""
    print(f"📋 컬렉션 정보 조회: {collection or 'default'}")
    
    try:
        # 환경 변수에서 설정 로드
        chroma_config = ChromaConfig.from_env()
        if collection:
            chroma_config.collection_name = collection
        
        # Initialize service
        service = ChromaService(chroma_config)
        
        # Get collection info
        collection_info = service.get_collection_info(collection)
        
        if collection_info:
            print("✅ 컬렉션 정보:")
            print(f"   이름: {collection_info.name}")
            print(f"   ID: {collection_info.id}")
            print(f"   문서 수: {collection_info.count}")
            print(f"   생성일: {collection_info.created_at}")
            print(f"   메타데이터: {collection_info.metadata}")
        else:
            print("❌ 컬렉션을 찾을 수 없음")
        
        # Get monitoring metrics
        metrics = service.get_monitoring_metrics()
        print(f"\n📊 시스템 메트릭:")
        print(f"   총 컬렉션: {metrics.collection_count}개")
        print(f"   총 문서: {metrics.total_documents}개")
        print(f"   저장소 크기: {metrics.storage_size_mb:.2f}MB")
        
    except Exception as error:
        print(f"❌ 정보 조회 오류: {error}")


@cli.command()
def list_collections():
    """모든 컬렉션 목록 조회"""
    print("📋 컬렉션 목록 조회")
    
    try:
        # 환경 변수에서 설정 로드
        chroma_config = ChromaConfig.from_env()
        
        # Initialize service
        service = ChromaService(chroma_config)
        
        # List collections
        collections = service.list_collections()
        
        if collections:
            print(f"✅ 총 {len(collections)}개 컬렉션:")
            for collection in collections:
                print(f"   - {collection.name}: {collection.count}개 문서")
        else:
            print("❌ 컬렉션이 없음")
        
    except Exception as error:
        print(f"❌ 목록 조회 오류: {error}")


@cli.command()
def health():
    """시스템 상태 확인"""
    print("🏥 시스템 상태 확인")
    
    try:
        # 환경 변수에서 설정 로드
        chroma_config = ChromaConfig.from_env()
        
        # Initialize service
        service = ChromaService(chroma_config)
        
        # Health check
        health_status = service.health_check()
        
        print(f"상태: {health_status['status']}")
        if health_status['status'] == 'healthy':
            print("✅ 시스템이 정상 작동 중")
            print(f"   컬렉션: {health_status['collections_count']}개")
            print(f"   문서: {health_status['total_documents']}개")
            print(f"   저장소: {health_status['storage_size_mb']:.2f}MB")
        else:
            print(f"❌ 시스템 오류: {health_status.get('error', 'Unknown error')}")
        
    except Exception as error:
        print(f"❌ 상태 확인 오류: {error}")


# Add config subcommand
cli.add_command(config_cli, name='config')


if __name__ == '__main__':
    cli()
