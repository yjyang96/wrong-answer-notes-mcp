"""
Batch Embedding Processor
"""

import asyncio
import time
import uuid
from typing import List, Dict, Any
from loguru import logger

from .models import (
    BatchEmbeddingRequest,
    BatchEmbeddingResult,
    BatchError,
    EmbeddingRequest,
    EmbeddingData,
    EmbeddingMetadata,
    QualityMetrics,
    ProcessedCommitData
)
from .azure_service import AzureEmbeddingService


class EmbeddingBatchProcessor:
    """Handles efficient batch processing of embedding requests"""
    
    def __init__(self, azure_service: AzureEmbeddingService, max_concurrent: int = 5):
        self.azure_service = azure_service
        self.max_concurrent = max_concurrent
        self.logger = logger.bind(context="EmbeddingBatchProcessor")
    
    async def process_batch(self, request: BatchEmbeddingRequest) -> BatchEmbeddingResult:
        """Process a batch of embedding requests"""
        start_time = time.time()
        
        self.logger.info("배치 처리 시작", extra={
            "batch_id": request.batch_id,
            "total_requests": len(request.requests),
            "batch_size": request.options.batch_size if request.options else 100
        })
        
        result = BatchEmbeddingResult(
            batch_id=request.batch_id,
            total_requests=len(request.requests),
            successful=0,
            failed=0,
            embeddings=[],
            errors=[],
            processing_time_ms=0,
            quality_metrics=QualityMetrics(
                average_quality_score=0,
                min_quality_score=1,
                max_quality_score=0,
                quality_distribution={"excellent": 0, "good": 0, "fair": 0, "poor": 0},
                average_processing_time_ms=0,
                total_tokens_used=0
            )
        )
        
        try:
            # Split requests into chunks
            batch_size = request.options.batch_size if request.options else 100
            chunks = self._chunk_list(request.requests, batch_size)
            
            # Process chunks with concurrency limit
            semaphore = asyncio.Semaphore(self.max_concurrent)
            tasks = [
                self._process_chunk_with_semaphore(semaphore, chunk, f"{request.batch_id}-chunk-{i}")
                for i, chunk in enumerate(chunks)
            ]
            
            chunk_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Aggregate results
            for i, chunk_result in enumerate(chunk_results):
                if isinstance(chunk_result, Exception):
                    self.logger.error("청크 처리 실패", extra={
                        "chunk_index": i,
                        "error": str(chunk_result)
                    })
                    result.failed += len(chunks[i])
                else:
                    result.embeddings.extend(chunk_result["embeddings"])
                    result.errors.extend(chunk_result["errors"])
                    result.successful += chunk_result["successful"]
                    result.failed += chunk_result["failed"]
            
            # Calculate quality metrics
            result.quality_metrics = self._calculate_quality_metrics(result.embeddings)
            result.processing_time_ms = int((time.time() - start_time) * 1000)
            
            self.logger.info("배치 처리 완료", extra={
                "batch_id": request.batch_id,
                "successful": result.successful,
                "failed": result.failed,
                "processing_time_ms": result.processing_time_ms,
                "quality_score": result.quality_metrics.average_quality_score
            })
            
            return result
            
        except Exception as error:
            result.processing_time_ms = int((time.time() - start_time) * 1000)
            self.logger.error("배치 처리 실패", extra={
                "batch_id": request.batch_id,
                "error": str(error),
                "processing_time_ms": result.processing_time_ms
            })
            raise
    
    async def _process_chunk_with_semaphore(self, semaphore: asyncio.Semaphore, 
                                          requests: List[EmbeddingRequest], 
                                          chunk_id: str) -> Dict[str, Any]:
        """Process a chunk with semaphore for concurrency control"""
        async with semaphore:
            return await self._process_chunk(requests, chunk_id)
    
    async def _process_chunk(self, requests: List[EmbeddingRequest], chunk_id: str) -> Dict[str, Any]:
        """Process a chunk of requests"""
        result = {
            "embeddings": [],
            "errors": [],
            "successful": 0,
            "failed": 0
        }
        
        try:
            self.logger.debug("청크 처리 시작", extra={
                "chunk_id": chunk_id,
                "request_count": len(requests)
            })
            
            # Generate embeddings for the chunk
            responses = await self.azure_service.generate_batch_embeddings(requests)
            
            # Process responses
            for i, (request, response) in enumerate(zip(requests, responses)):
                try:
                    # Validate embedding quality
                    validation = self.azure_service.validate_embedding(response.embedding)
                    
                    if validation["is_valid"]:
                        embedding_data = EmbeddingData(
                            embedding_id=self._generate_embedding_id(request.commit_id),
                            commit_id=request.commit_id,
                            embedding_vector=response.embedding,
                            text_content=request.text,
                            code_content=request.text if request.content_type == "code" else "",
                            metadata=EmbeddingMetadata(
                                model_version=response.model,
                                generated_at=time.time(),
                                quality_score=validation["quality_score"],
                                dimensions=response.dimensions,
                                content_type=request.content_type,
                                processing_time_ms=0,  # Will be calculated at batch level
                                batch_id=chunk_id
                            )
                        )
                        
                        result["embeddings"].append(embedding_data)
                        result["successful"] += 1
                    else:
                        result["errors"].append(BatchError(
                            commit_id=request.commit_id,
                            error=f"Quality validation failed: {', '.join(validation['issues'])}",
                            retry_count=0
                        ))
                        result["failed"] += 1
                        
                except Exception as error:
                    result["errors"].append(BatchError(
                        commit_id=request.commit_id,
                        error=str(error),
                        retry_count=0
                    ))
                    result["failed"] += 1
                    
        except Exception as error:
            self.logger.error("청크 처리 실패", extra={
                "chunk_id": chunk_id,
                "error": str(error)
            })
            
            # Mark all requests in this chunk as failed
            for request in requests:
                result["errors"].append(BatchError(
                    commit_id=request.commit_id,
                    error="Chunk processing failed",
                    retry_count=0
                ))
                result["failed"] += 1
        
        return result
    
    def convert_commits_to_requests(self, commits: List[ProcessedCommitData]) -> List[EmbeddingRequest]:
        """Convert processed commit data to embedding requests"""
        requests = []
        
        for commit in commits:
            # Combine commit message and file diffs
            text_content = self._extract_text_content(commit)
            code_content = self._extract_code_content(commit)
            
            # Determine content type
            if code_content and text_content:
                content_type = "mixed"
                combined_text = f"{text_content}\n\n{code_content}"
            elif code_content:
                content_type = "code"
                combined_text = code_content
            else:
                content_type = "text"
                combined_text = text_content
            
            request = EmbeddingRequest(
                text=combined_text,
                content_type=content_type,
                commit_id=commit.commit_id,
                metadata={
                    "classification": commit.classification,
                    "author": commit.author,
                    "date": commit.date.isoformat(),
                    "repository": commit.repository,
                    "branch": commit.branch
                }
            )
            requests.append(request)
        
        return requests
    
    def _extract_text_content(self, commit: ProcessedCommitData) -> str:
        """Extract text content from commit"""
        parts = []
        
        # Add commit message
        if commit.message:
            parts.append(commit.message)
        
        # Add classification reasoning
        if commit.classification.get("reasoning"):
            parts.append(f"Classification: {commit.classification['reasoning']}")
        
        # Add classification fields
        if commit.classification.get("package_name"):
            parts.append(f"Package: {commit.classification['package_name']}")
        if commit.classification.get("error_type"):
            parts.append(f"Error Type: {commit.classification['error_type']}")
        if commit.classification.get("api_signature"):
            parts.append(f"API Signature: {commit.classification['api_signature']}")
        
        return "\n".join(parts)
    
    def _extract_code_content(self, commit: ProcessedCommitData) -> str:
        """Extract code content from commit"""
        code_parts = []
        
        if commit.diff:
            code_parts.append(commit.diff)
        
        return "\n".join(code_parts)
    
    def _calculate_quality_metrics(self, embeddings: List[EmbeddingData]) -> QualityMetrics:
        """Calculate quality metrics for a batch of embeddings"""
        if not embeddings:
            return QualityMetrics(
                average_quality_score=0,
                min_quality_score=0,
                max_quality_score=0,
                quality_distribution={"excellent": 0, "good": 0, "fair": 0, "poor": 0},
                average_processing_time_ms=0,
                total_tokens_used=0
            )
        
        quality_scores = [emb.metadata.quality_score for emb in embeddings]
        total_tokens = sum(emb.metadata.processing_time_ms or 0 for emb in embeddings)
        
        distribution = {
            "excellent": sum(1 for score in quality_scores if score >= 0.9),
            "good": sum(1 for score in quality_scores if 0.7 <= score < 0.9),
            "fair": sum(1 for score in quality_scores if 0.5 <= score < 0.7),
            "poor": sum(1 for score in quality_scores if score < 0.5)
        }
        
        return QualityMetrics(
            average_quality_score=sum(quality_scores) / len(quality_scores),
            min_quality_score=min(quality_scores),
            max_quality_score=max(quality_scores),
            quality_distribution=distribution,
            average_processing_time_ms=total_tokens / len(embeddings),
            total_tokens_used=total_tokens
        )
    
    def _chunk_list(self, lst: List, chunk_size: int) -> List[List]:
        """Split list into chunks"""
        return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]
    
    def _generate_embedding_id(self, commit_id: str) -> str:
        """Generate unique embedding ID"""
        timestamp = int(time.time() * 1000)
        random_suffix = str(uuid.uuid4())[:8]
        return f"emb_{commit_id[:8]}_{timestamp}_{random_suffix}"
