"""
ChromaDB Service Implementation
"""

import os
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from loguru import logger

from ..models import (
    ChromaConfig, 
    ChromaDocument, 
    SearchQuery, 
    SearchResult,
    CollectionInfo,
    MonitoringMetrics
)
from ..utils.embedding_generator import EmbeddingGenerator


class ChromaService:
    """ChromaDB service for vector operations"""
    
    def __init__(self, config: ChromaConfig):
        self.config = config
        self.logger = logger.bind(context="ChromaService")
        
        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(
            path=config.persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Initialize embedding generator for text queries
        self.embedding_generator = EmbeddingGenerator()
        
        self.logger.info("ChromaDB 서비스 초기화됨", extra={
            "persist_directory": config.persist_directory,
            "collection_name": config.collection_name
        })
    
    def create_collection(self, name: Optional[str] = None) -> chromadb.Collection:
        """Create or get collection"""
        collection_name = name or self.config.collection_name
        
        try:
            # Try to get existing collection
            collection = self.client.get_collection(collection_name)
            self.logger.info("기존 컬렉션 로드됨", extra={
                "collection_name": collection_name,
                "count": collection.count()
            })
            return collection
        except Exception:
            # Create new collection with custom embedding function for 3072 dimensions
            # Use a dummy embedding function that doesn't actually embed text
            # since we're providing our own embeddings
            embedding_function = embedding_functions.DefaultEmbeddingFunction()
            
            collection = self.client.create_collection(
                name=collection_name,
                embedding_function=embedding_function,
                metadata={
                    "hnsw:space": self.config.hnsw_space,
                    "hnsw:construction_ef": self.config.hnsw_construction_ef,
                    "hnsw:M": self.config.hnsw_M,
                    "description": "Commit embeddings collection",
                    "created_at": time.time(),
                    "embedding_dimension": 3072
                }
            )
            self.logger.info("새 컬렉션 생성됨", extra={
                "collection_name": collection_name
            })
            return collection
    
    def add_documents(self, collection_name: str, documents: List[ChromaDocument]) -> bool:
        """Add documents to collection"""
        try:
            collection = self.create_collection(collection_name)
            
            # Prepare data for ChromaDB
            ids = [doc.id for doc in documents]
            embeddings = [doc.embedding for doc in documents]
            texts = [doc.document for doc in documents]
            metadatas = [doc.metadata for doc in documents]
            
            # Add to collection
            collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas
            )
            
            self.logger.info("문서 추가 완료", extra={
                "collection_name": collection_name,
                "document_count": len(documents)
            })
            return True
            
        except Exception as error:
            self.logger.error("문서 추가 실패", extra={
                "collection_name": collection_name,
                "error": str(error)
            })
            return False
    
    def search(self, collection_name: str, query: SearchQuery) -> SearchResult:
        """Search in collection"""
        start_time = time.time()
        
        try:
            collection = self.client.get_collection(collection_name)
            
            if query.query_embedding:
                # Vector similarity search
                results = collection.query(
                    query_embeddings=[query.query_embedding],
                    n_results=query.n_results,
                    where=query.where,
                    include=query.include
                )
            elif query.query_text:
                # Convert text to embedding first
                query_embedding = self.embedding_generator.generate_embedding(query.query_text)
                if not query_embedding:
                    raise ValueError("Failed to generate embedding for text query")
                
                # Use the generated embedding for search
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=query.n_results,
                    where=query.where,
                    include=query.include
                )
            else:
                raise ValueError("Either query_text or query_embedding must be provided")
            
            query_time = (time.time() - start_time) * 1000
            
            # Format results
            search_result = SearchResult(
                ids=results["ids"][0] if results["ids"] else [],
                documents=results["documents"][0] if results["documents"] else [],
                metadatas=results["metadatas"][0] if results["metadatas"] else [],
                distances=results["distances"][0] if results["distances"] else [],
                query_time_ms=query_time
            )
            
            self.logger.info("검색 완료", extra={
                "collection_name": collection_name,
                "query_type": "embedding" if query.query_embedding else "text",
                "results_count": len(search_result.ids),
                "query_time_ms": query_time
            })
            
            return search_result
            
        except Exception as error:
            query_time = (time.time() - start_time) * 1000
            self.logger.error("검색 실패", extra={
                "collection_name": collection_name,
                "error": str(error),
                "query_time_ms": query_time
            })
            raise
    
    def get_collection_info(self, collection_name: str) -> Optional[CollectionInfo]:
        """Get collection information"""
        try:
            collection = self.client.get_collection(collection_name)
            count = collection.count()
            
            return CollectionInfo(
                name=collection_name,
                id=str(collection.id),
                metadata=collection.metadata,
                count=count,
                created_at=datetime.fromtimestamp(collection.metadata.get("created_at", time.time()))
            )
            
        except Exception as error:
            self.logger.error("컬렉션 정보 조회 실패", extra={
                "collection_name": collection_name,
                "error": str(error)
            })
            return None
    
    def list_collections(self) -> List[CollectionInfo]:
        """List all collections"""
        try:
            collections = self.client.list_collections()
            collection_infos = []
            
            for collection in collections:
                info = self.get_collection_info(collection.name)
                if info:
                    collection_infos.append(info)
            
            return collection_infos
            
        except Exception as error:
            self.logger.error("컬렉션 목록 조회 실패", extra={
                "error": str(error)
            })
            return []
    
    def delete_collection(self, collection_name: str) -> bool:
        """Delete collection"""
        try:
            self.client.delete_collection(collection_name)
            self.logger.info("컬렉션 삭제됨", extra={
                "collection_name": collection_name
            })
            return True
            
        except Exception as error:
            self.logger.error("컬렉션 삭제 실패", extra={
                "collection_name": collection_name,
                "error": str(error)
            })
            return False
    
    def get_monitoring_metrics(self) -> MonitoringMetrics:
        """Get monitoring metrics"""
        try:
            collections = self.list_collections()
            total_documents = sum(c.count for c in collections)
            
            # Calculate storage size
            storage_size = 0
            if os.path.exists(self.config.persist_directory):
                for root, dirs, files in os.walk(self.config.persist_directory):
                    for file in files:
                        file_path = os.path.join(root, file)
                        storage_size += os.path.getsize(file_path)
            
            storage_size_mb = storage_size / (1024 * 1024)
            
            return MonitoringMetrics(
                collection_count=len(collections),
                total_documents=total_documents,
                storage_size_mb=storage_size_mb,
                last_backup=None,  # Will be implemented in backup service
                query_count_today=0,  # Will be implemented with query tracking
                average_query_time_ms=0.0  # Will be implemented with query tracking
            )
            
        except Exception as error:
            self.logger.error("모니터링 메트릭 조회 실패", extra={
                "error": str(error)
            })
            return MonitoringMetrics(
                collection_count=0,
                total_documents=0,
                storage_size_mb=0.0
            )
    
    def health_check(self) -> Dict[str, Any]:
        """Health check for ChromaDB service"""
        try:
            # Test basic operations
            collections = self.list_collections()
            metrics = self.get_monitoring_metrics()
            
            return {
                "status": "healthy",
                "collections_count": len(collections),
                "total_documents": metrics.total_documents,
                "storage_size_mb": metrics.storage_size_mb,
                "timestamp": time.time()
            }
            
        except Exception as error:
            return {
                "status": "error",
                "error": str(error),
                "timestamp": time.time()
            }
