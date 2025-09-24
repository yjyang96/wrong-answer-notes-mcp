"""
Embedding Data Migration Service
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from tqdm import tqdm
from loguru import logger

from ..models import EmbeddingData, ChromaDocument, MigrationConfig
from ..chroma.chroma_service import ChromaService, ChromaConfig


class EmbeddingMigrator:
    """Migrate embedding data from embedding-service to ChromaDB"""
    
    def __init__(self, chroma_config: ChromaConfig, migration_config: MigrationConfig):
        self.chroma_config = chroma_config
        self.migration_config = migration_config
        self.logger = logger.bind(context="EmbeddingMigrator")
        
        # Initialize ChromaDB service
        self.chroma_service = ChromaService(chroma_config)
    
    def load_embedding_data(self) -> List[EmbeddingData]:
        """Load embedding data from embedding-service output"""
        self.logger.info("임베딩 데이터 로딩 시작", extra={
            "source_dir": self.migration_config.source_embeddings_dir
        })
        
        embeddings = []
        source_path = Path(self.migration_config.source_embeddings_dir)
        
        if not source_path.exists():
            self.logger.error("소스 디렉토리가 존재하지 않음", extra={
                "source_dir": str(source_path)
            })
            return embeddings
        
        # Load index file
        index_file = source_path / "index.json"
        if not index_file.exists():
            self.logger.error("인덱스 파일이 존재하지 않음", extra={
                "index_file": str(index_file)
            })
            return embeddings
        
        try:
            with open(index_file, 'r', encoding='utf-8') as f:
                index_data = json.load(f)
            
            # Load individual embedding files
            for embedding_ref in tqdm(index_data["embeddings"], desc="임베딩 파일 로딩"):
                embedding_file = source_path / embedding_ref["file_path"]
                
                if embedding_file.exists():
                    with open(embedding_file, 'r', encoding='utf-8') as f:
                        embedding_data = json.load(f)
                    
                    # Convert to EmbeddingData model
                    embedding = EmbeddingData(
                        embedding_id=embedding_data["embedding_id"],
                        commit_id=embedding_data["commit_id"],
                        embedding_vector=embedding_data["embedding_vector"],
                        text_content=embedding_data["text_content"],
                        code_content=embedding_data["code_content"],
                        metadata=embedding_data["metadata"]
                    )
                    embeddings.append(embedding)
                else:
                    self.logger.warning("임베딩 파일 누락", extra={
                        "file_path": str(embedding_file)
                    })
            
            self.logger.info("임베딩 데이터 로딩 완료", extra={
                "total_embeddings": len(embeddings)
            })
            
        except Exception as error:
            self.logger.error("임베딩 데이터 로딩 실패", extra={
                "error": str(error)
            })
        
        return embeddings
    
    def convert_to_chroma_documents(self, embeddings: List[EmbeddingData]) -> List[ChromaDocument]:
        """Convert EmbeddingData to ChromaDocument format"""
        self.logger.info("ChromaDB 문서 형식으로 변환 시작", extra={
            "embedding_count": len(embeddings)
        })
        
        chroma_documents = []
        
        for embedding in tqdm(embeddings, desc="문서 변환"):
            # Combine text and code content
            document_text = embedding.text_content
            if embedding.code_content:
                document_text += "\n\n" + embedding.code_content
            
            # Prepare metadata
            metadata = {
                "commit_id": embedding.commit_id,
                "embedding_id": embedding.embedding_id,
                "quality_score": embedding.metadata.get("quality_score", 0.0),
                "content_type": embedding.metadata.get("content_type", "mixed"),
                "model_version": embedding.metadata.get("model_version", "text-embedding-3-large"),
                "generated_at": embedding.metadata.get("generated_at", ""),
                "batch_id": embedding.metadata.get("batch_id", "")
            }
            
            # Add classification metadata if available
            if "classification" in embedding.metadata:
                classification = embedding.metadata["classification"]
                metadata.update({
                    "classification_type": classification.get("type", ""),
                    "package_name": classification.get("package_name", ""),
                    "error_type": classification.get("error_type", ""),
                    "api_signature": classification.get("api_signature", ""),
                    "confidence": classification.get("confidence", 0.0)
                })
            
            # Add original commit metadata if available
            if "original_commit" in embedding.metadata and embedding.metadata["original_commit"]:
                original_commit = embedding.metadata["original_commit"]
                metadata.update({
                    "repository": original_commit.get("repository", ""),
                    "branch": original_commit.get("branch", ""),
                    "author": original_commit.get("author", ""),
                    "date": original_commit.get("date", "")
                })
            
            chroma_document = ChromaDocument(
                id=embedding.embedding_id,
                embedding=embedding.embedding_vector,
                document=document_text,
                metadata=metadata
            )
            
            chroma_documents.append(chroma_document)
        
        self.logger.info("ChromaDB 문서 변환 완료", extra={
            "document_count": len(chroma_documents)
        })
        
        return chroma_documents
    
    def migrate_data(self, collection_name: Optional[str] = None) -> bool:
        """Migrate embedding data to ChromaDB"""
        self.logger.info("데이터 마이그레이션 시작")
        
        try:
            # Load embedding data
            embeddings = self.load_embedding_data()
            if not embeddings:
                self.logger.error("마이그레이션할 데이터가 없음")
                return False
            
            # Convert to ChromaDB format
            chroma_documents = self.convert_to_chroma_documents(embeddings)
            
            # Add to ChromaDB
            target_collection = collection_name or self.chroma_config.collection_name
            
            # Check if collection exists and should be overwritten
            if not self.migration_config.overwrite_existing:
                try:
                    existing_collection = self.chroma_service.client.get_collection(target_collection)
                    if existing_collection.count() > 0:
                        self.logger.warning("기존 컬렉션이 존재함. overwrite_existing=True로 설정하거나 다른 컬렉션명 사용", extra={
                            "collection_name": target_collection,
                            "existing_count": existing_collection.count()
                        })
                        return False
                except Exception:
                    # Collection doesn't exist, continue
                    pass
            
            # Add documents in batches
            batch_size = self.migration_config.batch_size
            total_batches = (len(chroma_documents) + batch_size - 1) // batch_size
            
            for i in tqdm(range(0, len(chroma_documents), batch_size), desc="ChromaDB에 데이터 추가"):
                batch = chroma_documents[i:i + batch_size]
                success = self.chroma_service.add_documents(target_collection, batch)
                
                if not success:
                    self.logger.error("배치 추가 실패", extra={
                        "batch_index": i // batch_size + 1,
                        "total_batches": total_batches
                    })
                    return False
            
            # Verify migration
            collection_info = self.chroma_service.get_collection_info(target_collection)
            if collection_info:
                self.logger.info("데이터 마이그레이션 완료", extra={
                    "collection_name": target_collection,
                    "total_documents": collection_info.count,
                    "source_embeddings": len(embeddings)
                })
                return True
            else:
                self.logger.error("마이그레이션 검증 실패")
                return False
                
        except Exception as error:
            self.logger.error("데이터 마이그레이션 실패", extra={
                "error": str(error)
            })
            return False
    
    def get_migration_stats(self) -> Dict[str, Any]:
        """Get migration statistics"""
        try:
            # Load source data stats
            embeddings = self.load_embedding_data()
            
            # Get ChromaDB stats
            collections = self.chroma_service.list_collections()
            target_collection = None
            
            for collection in collections:
                if collection.name == self.chroma_config.collection_name:
                    target_collection = collection
                    break
            
            return {
                "source_embeddings_count": len(embeddings),
                "chromadb_collections": len(collections),
                "target_collection_exists": target_collection is not None,
                "target_collection_count": target_collection.count if target_collection else 0,
                "migration_complete": len(embeddings) == (target_collection.count if target_collection else 0)
            }
            
        except Exception as error:
            self.logger.error("마이그레이션 통계 조회 실패", extra={
                "error": str(error)
            })
            return {}
