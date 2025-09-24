"""
Main Embedding Service
"""

import asyncio
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from loguru import logger

from .models import (
    EmbeddingConfig,
    StorageConfig,
    ProcessedCommitData,
    EmbeddingData,
    BatchEmbeddingRequest,
    BatchEmbeddingResult
)
from .azure_service import AzureEmbeddingService
from .batch_processor import EmbeddingBatchProcessor
from .storage_service import EmbeddingStorageService


class EmbeddingService:
    """Main embedding service that orchestrates the entire pipeline"""
    
    def __init__(self, config: EmbeddingConfig, storage_config: StorageConfig):
        self.config = config
        self.storage_config = storage_config
        self.logger = logger.bind(context="EmbeddingService")
        
        # Initialize services
        self.azure_service = AzureEmbeddingService(config)
        self.batch_processor = EmbeddingBatchProcessor(self.azure_service, config.max_concurrent)
        self.storage_service = EmbeddingStorageService(storage_config)
        
        self.logger.info("임베딩 서비스 초기화됨", extra={
            "model": config.model,
            "dimensions": config.dimensions,
            "batch_size": config.batch_size,
            "output_dir": storage_config.output_dir
        })
    
    async def generate_embeddings(self, commits: List[ProcessedCommitData], 
                                batch_id: Optional[str] = None) -> BatchEmbeddingResult:
        """Generate embeddings for processed commit data"""
        start_time = time.time()
        actual_batch_id = batch_id or self._generate_batch_id()
        
        self.logger.info("임베딩 생성 시작", extra={
            "commit_count": len(commits),
            "batch_id": actual_batch_id
        })
        
        try:
            # Convert commits to embedding requests
            print("🔄 커밋을 임베딩 요청으로 변환 중...")
            requests = self.batch_processor.convert_commits_to_requests(commits)
            print(f"   → {len(requests)}개 임베딩 요청 생성 완료")
            
            # Create batch request
            batch_request = BatchEmbeddingRequest(
                requests=requests,
                batch_id=actual_batch_id,
                options=None  # Use default options
            )
            
            # Process batch
            print("🤖 임베딩 배치 처리 중...")
            result = await self.batch_processor.process_batch(batch_request)
            print(f"   → {result.successful}개 임베딩 생성, {result.failed}개 실패")
            
            # Save embeddings
            print("💾 임베딩을 저장소에 저장 중...")
            await self.storage_service.save_embeddings(
                result.embeddings,
                commits,
                actual_batch_id
            )
            print(f"   → {len(result.embeddings)}개 임베딩과 인덱스 저장 완료")
            
            total_time = int((time.time() - start_time) * 1000)
            
            self.logger.info("임베딩 생성 완료", extra={
                "batch_id": actual_batch_id,
                "total_commits": len(commits),
                "successful_embeddings": result.successful,
                "failed_embeddings": result.failed,
                "processing_time_ms": total_time,
                "average_quality_score": result.quality_metrics.average_quality_score
            })
            
            return result
            
        except Exception as error:
            total_time = int((time.time() - start_time) * 1000)
            self.logger.error("임베딩 생성 실패", extra={
                "batch_id": actual_batch_id,
                "error": str(error),
                "processing_time_ms": total_time
            })
            raise
    
    async def load_embeddings(self, index_path: Optional[str] = None) -> List[EmbeddingData]:
        """Load embeddings from storage"""
        self.logger.info("저장소에서 임베딩 로딩", extra={
            "index_path": index_path
        })
        
        try:
            embeddings = await self.storage_service.load_embeddings(index_path)
            
            self.logger.info("임베딩 로딩 완료", extra={
                "embedding_count": len(embeddings)
            })
            
            return embeddings
            
        except Exception as error:
            self.logger.error("임베딩 로딩 실패", extra={
                "error": str(error)
            })
            raise
    
    async def find_embeddings_by_commit(self, commit_id: str) -> List[EmbeddingData]:
        """Search embeddings by commit ID"""
        self.logger.debug("커밋 ID로 임베딩 검색", extra={
            "commit_id": commit_id
        })
        
        try:
            embeddings = await self.storage_service.find_embeddings_by_commit(commit_id)
            
            self.logger.debug("커밋 임베딩 검색 완료", extra={
                "commit_id": commit_id,
                "embedding_count": len(embeddings)
            })
            
            return embeddings
            
        except Exception as error:
            self.logger.error("커밋 임베딩 검색 실패", extra={
                "commit_id": commit_id,
                "error": str(error)
            })
            return []
    
    async def validate_storage(self) -> Dict[str, Any]:
        """Validate storage integrity"""
        self.logger.info("저장소 무결성 검증")
        
        try:
            validation = await self.storage_service.validate_storage()
            
            self.logger.info("저장소 검증 완료", extra={
                "is_valid": validation["is_valid"],
                "total_files": validation["statistics"]["total_files"],
                "missing_files": validation["statistics"]["missing_files"],
                "corrupted_files": validation["statistics"]["corrupted_files"]
            })
            
            return validation
            
        except Exception as error:
            self.logger.error("저장소 검증 실패", extra={
                "error": str(error)
            })
            raise
    
    async def get_storage_statistics(self) -> Dict[str, Any]:
        """Get storage statistics"""
        self.logger.info("저장소 통계 조회")
        
        try:
            stats = await self.storage_service.get_storage_statistics()
            
            self.logger.info("저장소 통계 조회 완료", extra={
                "total_embeddings": stats["total_embeddings"],
                "average_quality_score": stats["average_quality_score"],
                "model_name": stats["model_info"]["name"]
            })
            
            return stats
            
        except Exception as error:
            self.logger.error("저장소 통계 조회 실패", extra={
                "error": str(error)
            })
            raise
    
    def _generate_batch_id(self) -> str:
        """Generate batch ID"""
        timestamp = int(time.time() * 1000)
        return f"batch_{timestamp}_{hash(str(time.time())) % 10000:04d}"
    
    def get_config(self) -> EmbeddingConfig:
        """Get service configuration"""
        return self.config
    
    def update_config(self, new_config: Dict[str, Any]) -> None:
        """Update configuration"""
        for key, value in new_config.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
        
        self.logger.info("설정 업데이트됨", extra=new_config)
