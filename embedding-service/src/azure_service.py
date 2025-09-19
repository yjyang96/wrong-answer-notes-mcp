"""
Azure OpenAI Embedding Service
"""

import asyncio
import time
from typing import List, Dict, Any
from openai import AsyncAzureOpenAI
from loguru import logger

from .models import (
    EmbeddingRequest, 
    EmbeddingResponse, 
    EmbeddingConfig,
    BatchEmbeddingRequest,
    BatchEmbeddingResult,
    BatchError,
    EmbeddingData,
    EmbeddingMetadata
)


class AzureEmbeddingService:
    """Azure OpenAI embedding service with async support"""
    
    def __init__(self, config: EmbeddingConfig):
        self.config = config
        self.logger = logger.bind(context="AzureEmbeddingService")
        
        # Initialize Azure OpenAI client
        self.client = AsyncAzureOpenAI(
            api_key=config.api_key,
            api_version=config.api_version,
            azure_endpoint=config.endpoint
        )
        
        self.logger.info("Azure OpenAI Embedding Service 초기화됨", extra={
            "model": config.model,
            "dimensions": config.dimensions,
            "batch_size": config.batch_size
        })
    
    async def generate_embedding(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """Generate embedding for a single text"""
        start_time = time.time()
        
        try:
            self.logger.debug("임베딩 생성 시작", extra={
                "commit_id": request.commit_id,
                "content_type": request.content_type,
                "text_length": len(request.text)
            })
            
            # Prepare text for embedding
            processed_text = self._prepare_text_for_embedding(request.text, request.content_type)
            
            # Call Azure OpenAI API
            response = await self.client.embeddings.create(
                model=self.config.model,
                input=processed_text,
                dimensions=self.config.dimensions
            )
            
            processing_time = int((time.time() - start_time) * 1000)
            
            result = EmbeddingResponse(
                embedding=response.data[0].embedding,
                usage={
                    "prompt_tokens": response.usage.prompt_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                model=self.config.model,
                dimensions=len(response.data[0].embedding)
            )
            
            self.logger.debug("임베딩 생성 완료", extra={
                "commit_id": request.commit_id,
                "dimensions": result.dimensions,
                "tokens_used": result.usage["total_tokens"],
                "processing_time_ms": processing_time
            })
            
            return result
            
        except Exception as error:
            processing_time = int((time.time() - start_time) * 1000)
            self.logger.error("임베딩 생성 실패", extra={
                "commit_id": request.commit_id,
                "error": str(error),
                "processing_time_ms": processing_time
            })
            raise
    
    async def generate_batch_embeddings(self, requests: List[EmbeddingRequest]) -> List[EmbeddingResponse]:
        """Generate embeddings for multiple texts in batch"""
        start_time = time.time()
        
        self.logger.info("배치 임베딩 생성 시작", extra={
            "batch_size": len(requests),
            "model": self.config.model
        })
        
        try:
            # Process texts for embedding
            processed_texts = [
                self._prepare_text_for_embedding(req.text, req.content_type)
                for req in requests
            ]
            
            # Call Azure OpenAI API
            response = await self.client.embeddings.create(
                model=self.config.model,
                input=processed_texts,
                dimensions=self.config.dimensions
            )
            
            processing_time = int((time.time() - start_time) * 1000)
            
            results = []
            for i, item in enumerate(response.data):
                result = EmbeddingResponse(
                    embedding=item.embedding,
                    usage={
                        "prompt_tokens": response.usage.prompt_tokens,
                        "total_tokens": response.usage.total_tokens
                    },
                    model=self.config.model,
                    dimensions=len(item.embedding)
                )
                results.append(result)
            
            self.logger.info("배치 임베딩 생성 완료", extra={
                "batch_size": len(requests),
                "total_tokens": response.usage.total_tokens,
                "processing_time_ms": processing_time,
                "avg_time_per_item": processing_time / len(requests)
            })
            
            return results
            
        except Exception as error:
            processing_time = int((time.time() - start_time) * 1000)
            self.logger.error("배치 임베딩 생성 실패", extra={
                "batch_size": len(requests),
                "error": str(error),
                "processing_time_ms": processing_time
            })
            raise
    
    def _prepare_text_for_embedding(self, text: str, content_type: str) -> str:
        """Prepare text for embedding based on content type"""
        if content_type == "text":
            return self._prepare_text_content(text)
        elif content_type == "code":
            return self._prepare_code_content(text)
        elif content_type == "mixed":
            return self._prepare_mixed_content(text)
        else:
            return text
    
    def _prepare_text_content(self, text: str) -> str:
        """Prepare text content for embedding"""
        return text.strip().replace('\n', ' ').replace('\r', ' ')[:8000]
    
    def _prepare_code_content(self, text: str) -> str:
        """Prepare code content for embedding"""
        return text.strip().replace('\r\n', '\n').replace('\t', '  ')[:8000]
    
    def _prepare_mixed_content(self, text: str) -> str:
        """Prepare mixed content for embedding"""
        lines = text.split('\n')
        text_lines = []
        code_lines = []
        
        in_code_block = False
        
        for line in lines:
            if line.startswith('```') or line.startswith('diff --git'):
                in_code_block = not in_code_block
                continue
            
            if in_code_block or line.startswith(('+', '-', '@@')):
                code_lines.append(line)
            else:
                text_lines.append(line)
        
        text_content = self._prepare_text_content('\n'.join(text_lines))
        code_content = self._prepare_code_content('\n'.join(code_lines))
        
        return f"TEXT: {text_content}\n\nCODE: {code_content}"[:8000]
    
    def validate_embedding(self, embedding: List[float]) -> Dict[str, Any]:
        """Validate embedding quality"""
        issues = []
        quality_score = 1.0
        
        # Check dimensions
        if len(embedding) != self.config.dimensions:
            issues.append(f"Invalid dimensions: expected {self.config.dimensions}, got {len(embedding)}")
            quality_score -= 0.3
        
        # Check for NaN or infinite values
        if any(not isinstance(val, (int, float)) or not (val == val) for val in embedding):
            issues.append("Contains NaN or infinite values")
            quality_score -= 0.5
        
        # Check for zero vector
        magnitude = sum(val * val for val in embedding) ** 0.5
        if magnitude == 0:
            issues.append("Zero vector detected")
            quality_score -= 0.8
        elif magnitude < 0.1:
            issues.append("Very low magnitude vector")
            quality_score -= 0.2
        
        # Check for extreme values
        max_value = max(abs(val) for val in embedding)
        if max_value > 10:
            issues.append("Contains extreme values")
            quality_score -= 0.1
        
        return {
            "is_valid": quality_score >= self.config.quality_threshold,
            "quality_score": max(0, quality_score),
            "issues": issues
        }
