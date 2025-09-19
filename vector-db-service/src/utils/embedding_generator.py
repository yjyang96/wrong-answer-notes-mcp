"""
Embedding Generator for text queries
"""

import os
import json
import time
from typing import List, Optional
import requests
from loguru import logger


class EmbeddingGenerator:
    """Generate embeddings for text queries using Azure OpenAI"""
    
    def __init__(self, timeout: int = 30):
        self.logger = logger.bind(context="EmbeddingGenerator")
        
        # Azure OpenAI configuration from environment
        self.api_key = os.getenv("AZURE_OPENAI_API_KEY", "")
        self.endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
        self.deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "text-embedding-3-large")
        self.api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
        self.timeout = timeout
        
        self.is_available = bool(self.api_key and self.endpoint)
        
        if not self.is_available:
            self.logger.warning("Azure OpenAI API 키가 설정되지 않음 - 텍스트 검색 불가")
        else:
            self.logger.info("Azure OpenAI API 설정됨", extra={
                "endpoint": self.endpoint,
                "deployment": self.deployment,
                "api_version": self.api_version
            })
    
    def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text"""
        if not self.is_available:
            self.logger.error("Azure OpenAI API가 설정되지 않음")
            return None
        
        try:
            url = f"{self.endpoint}/openai/deployments/{self.deployment}/embeddings?api-version={self.api_version}"
            
            headers = {
                "Content-Type": "application/json",
                "api-key": self.api_key
            }
            
            data = {
                "input": [text],
                "model": self.deployment,
                "encoding_format": "float"
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=self.timeout)
            
            if response.status_code == 200:
                result = response.json()
                embedding = result["data"][0]["embedding"]
                self.logger.info("임베딩 생성 성공", extra={
                    "text_length": len(text),
                    "embedding_dimension": len(embedding)
                })
                return embedding
            else:
                self.logger.error("임베딩 생성 실패", extra={
                    "status_code": response.status_code,
                    "response": response.text
                })
                return None
                
        except Exception as error:
            self.logger.error("임베딩 생성 중 오류", extra={
                "error": str(error)
            })
            return None
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts"""
        if not self.is_available:
            return [None] * len(texts)
        
        try:
            url = f"{self.endpoint}/openai/deployments/{self.deployment}/embeddings?api-version={self.api_version}"
            
            headers = {
                "Content-Type": "application/json",
                "api-key": self.api_key
            }
            
            data = {
                "input": texts,
                "model": self.deployment,
                "encoding_format": "float"
            }
            
            response = requests.post(url, headers=headers, json=data, timeout=self.timeout * 2)
            
            if response.status_code == 200:
                result = response.json()
                embeddings = [item["embedding"] for item in result["data"]]
                self.logger.info("배치 임베딩 생성 성공", extra={
                    "text_count": len(texts),
                    "embedding_dimension": len(embeddings[0]) if embeddings else 0
                })
                return embeddings
            else:
                self.logger.error("배치 임베딩 생성 실패", extra={
                    "status_code": response.status_code,
                    "response": response.text
                })
                return [None] * len(texts)
                
        except Exception as error:
            self.logger.error("배치 임베딩 생성 중 오류", extra={
                "error": str(error)
            })
            return [None] * len(texts)
