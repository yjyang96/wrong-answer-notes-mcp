"""
Command Line Interface for Embedding Service
"""

import asyncio
import json
import os
from pathlib import Path
from typing import Optional
import click
from loguru import logger
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from .models import EmbeddingConfig, StorageConfig, ProcessedCommitData
from .embedding_service import EmbeddingService


@click.group()
@click.option('--log-level', default='INFO', help='로그 레벨')
@click.option('--log-file', default='logs/embedding.log', help='로그 파일 경로')
def cli(log_level: str, log_file: str):
    """임베딩 서비스 CLI"""
    # 로그 설정
    logger.remove()
    # Ensure 'context' always exists to avoid KeyError in format
    safe_logger = logger.patch(lambda r: r["extra"].setdefault("context", "-"))
    safe_logger.add(
        log_file,
        level=log_level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra[context]} | {message}",
        rotation="10 MB"
    )
    safe_logger.add(
        lambda msg: print(msg, end=""),
        level=log_level,
        format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}"
    )


@cli.command()
@click.option('--input', '-i', required=True, help='입력 파일 경로 (processed commits JSON)')
@click.option('--output', '-o', required=True, help='출력 디렉토리')
@click.option('--batch-size', default=100, help='배치 크기')
@click.option('--max-concurrent', default=5, help='최대 동시 처리 수')
@click.option('--dimensions', default=3072, help='임베딩 차원')
def generate(input: str, output: str, batch_size: int, max_concurrent: int, dimensions: int):
    """임베딩 생성"""
    asyncio.run(_generate_embeddings(input, output, batch_size, max_concurrent, dimensions))


@cli.command()
@click.option('--input', '-i', required=True, help='입력 파일 경로 (embeddings index JSON)')
def load(input: str):
    """임베딩 로딩"""
    asyncio.run(_load_embeddings(input))


@cli.command()
@click.option('--commit-id', required=True, help='커밋 ID')
@click.option('--input', '-i', required=True, help='입력 디렉토리')
def search(commit_id: str, input: str):
    """커밋별 임베딩 검색"""
    asyncio.run(_search_embeddings(commit_id, input))


@cli.command()
@click.option('--input', '-i', required=True, help='입력 디렉토리')
def validate(input: str):
    """저장소 무결성 검증"""
    asyncio.run(_validate_storage(input))


@cli.command()
@click.option('--input', '-i', required=True, help='입력 디렉토리')
def stats(input: str):
    """저장소 통계 조회"""
    asyncio.run(_get_statistics(input))


async def _generate_embeddings(input_path: str, output_dir: str, 
                             batch_size: int, max_concurrent: int, dimensions: int):
    """Generate embeddings from processed commits"""
    print("🚀 임베딩 생성 시작...")
    
    try:
        # Load processed commits
        print(f"📂 입력 파일 로딩: {input_path}")
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        commits = [ProcessedCommitData(**commit) for commit in data]
        print(f"   → {len(commits)}개 커밋 로딩 완료")
        
        # Create configuration
        config = EmbeddingConfig(
            model="text-embedding-3-large",
            dimensions=dimensions,
            batch_size=batch_size,
            max_concurrent=max_concurrent,
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        )
        
        storage_config = StorageConfig(
            output_dir=output_dir,
            create_index=True,
            compress_output=False
        )
        
        # Initialize service
        service = EmbeddingService(config, storage_config)
        
        # Generate embeddings
        result = await service.generate_embeddings(commits)
        
        # Print results
        print("\n=== 임베딩 생성 결과 리포트 ===")
        print(f"✅ 성공: {result.successful}개")
        print(f"❌ 실패: {result.failed}개")
        print(f"⏱️ 처리 시간: {result.processing_time_ms}ms")
        print(f"📊 평균 품질 점수: {result.quality_metrics.average_quality_score:.3f}")
        print(f"📈 품질 분포: {result.quality_metrics.quality_distribution}")
        print(f"💾 출력 디렉토리: {output_dir}")
        
        if result.errors:
            print(f"\n⚠️ 오류 ({len(result.errors)}개):")
            for error in result.errors[:5]:  # Show first 5 errors
                print(f"   - {error.commit_id}: {error.error}")
            if len(result.errors) > 5:
                print(f"   ... 및 {len(result.errors) - 5}개 추가 오류")
        
    except Exception as error:
        print(f"❌ 임베딩 생성 실패: {error}")
        raise


async def _load_embeddings(input_path: str):
    """Load embeddings from storage"""
    print("📂 임베딩 로딩 시작...")
    
    try:
        # Create configuration
        config = EmbeddingConfig(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        )
        
        storage_config = StorageConfig(output_dir=os.path.dirname(input_path))
        service = EmbeddingService(config, storage_config)
        
        # Load embeddings
        embeddings = await service.load_embeddings(input_path)
        
        print(f"✅ {len(embeddings)}개 임베딩 로딩 완료")
        
        if embeddings:
            sample = embeddings[0]
            print(f"\n📋 샘플 임베딩:")
            print(f"   ID: {sample.embedding_id}")
            print(f"   커밋: {sample.commit_id}")
            print(f"   차원: {sample.metadata.dimensions}")
            print(f"   품질: {sample.metadata.quality_score:.3f}")
            print(f"   타입: {sample.metadata.content_type}")
        
    except Exception as error:
        print(f"❌ 임베딩 로딩 실패: {error}")
        raise


async def _search_embeddings(commit_id: str, input_dir: str):
    """Search embeddings by commit ID"""
    print(f"🔍 커밋 '{commit_id}' 임베딩 검색...")
    
    try:
        config = EmbeddingConfig(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        )
        
        storage_config = StorageConfig(output_dir=input_dir)
        service = EmbeddingService(config, storage_config)
        
        embeddings = await service.find_embeddings_by_commit(commit_id)
        
        if embeddings:
            print(f"✅ {len(embeddings)}개 임베딩 발견")
            for emb in embeddings:
                print(f"   - {emb.embedding_id}: {emb.metadata.content_type} (품질: {emb.metadata.quality_score:.3f})")
        else:
            print("❌ 해당 커밋의 임베딩을 찾을 수 없습니다")
        
    except Exception as error:
        print(f"❌ 임베딩 검색 실패: {error}")
        raise


async def _validate_storage(input_dir: str):
    """Validate storage integrity"""
    print("🔍 저장소 무결성 검증...")
    
    try:
        config = EmbeddingConfig(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        )
        
        storage_config = StorageConfig(output_dir=input_dir)
        service = EmbeddingService(config, storage_config)
        
        validation = await service.validate_storage()
        
        if validation["is_valid"]:
            print("✅ 저장소 무결성 검증 통과")
        else:
            print("❌ 저장소 무결성 문제 발견:")
            for issue in validation["issues"]:
                print(f"   - {issue}")
        
        stats = validation["statistics"]
        print(f"\n📊 통계:")
        print(f"   총 파일: {stats['total_files']}개")
        print(f"   누락 파일: {stats['missing_files']}개")
        print(f"   손상 파일: {stats['corrupted_files']}개")
        print(f"   총 크기: {stats['total_size_bytes'] / 1024 / 1024:.2f}MB")
        
    except Exception as error:
        print(f"❌ 저장소 검증 실패: {error}")
        raise


async def _get_statistics(input_dir: str):
    """Get storage statistics"""
    print("📊 저장소 통계 조회...")
    
    try:
        config = EmbeddingConfig(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        )
        
        storage_config = StorageConfig(output_dir=input_dir)
        service = EmbeddingService(config, storage_config)
        
        stats = await service.get_storage_statistics()
        
        print("📈 저장소 통계:")
        print(f"   총 임베딩: {stats['total_embeddings']}개")
        print(f"   평균 품질: {stats['average_quality_score']:.3f}")
        print(f"   모델: {stats['model_info']['name']}")
        print(f"   차원: {stats['model_info']['dimensions']}")
        
        if stats.get('content_type_distribution'):
            print(f"   콘텐츠 타입 분포:")
            for content_type, count in stats['content_type_distribution'].items():
                print(f"     - {content_type}: {count}개")
        
    except Exception as error:
        print(f"❌ 통계 조회 실패: {error}")
        raise


if __name__ == '__main__':
    cli()
