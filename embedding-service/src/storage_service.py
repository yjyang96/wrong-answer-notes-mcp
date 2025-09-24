"""
Embedding Storage Service
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from loguru import logger

from .models import EmbeddingData, ProcessedCommitData, StorageConfig


class EmbeddingStorageService:
    """Handles storage and retrieval of embedding data"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.logger = logger.bind(context="EmbeddingStorageService")
    
    async def save_embeddings(self, embeddings: List[EmbeddingData], 
                            original_commits: List[ProcessedCommitData],
                            batch_id: str) -> Dict[str, Any]:
        """Save embeddings to storage with metadata mapping"""
        self.logger.info("임베딩 저장 시작", extra={
            "embedding_count": len(embeddings),
            "batch_id": batch_id,
            "output_dir": self.config.output_dir
        })
        
        try:
            # Ensure output directory exists
            output_path = Path(self.config.output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Create commit mapping for reference integrity
            commit_map = {commit.commit_id: commit for commit in original_commits}
            
            # Save individual embedding files
            embedding_files = []
            for embedding in embeddings:
                filename = f"{embedding.embedding_id}.json"
                file_path = output_path / filename
                
                # Add original commit data for reference integrity
                original_commit = commit_map.get(embedding.commit_id)
                embedding_with_commit = {
                    **embedding.dict(),
                    "original_commit": original_commit.dict() if original_commit else None
                }
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(embedding_with_commit, f, indent=2, ensure_ascii=False, default=str)
                
                embedding_files.append(filename)
            
            # Create and save index
            index = self._create_index(embeddings, batch_id)
            index_path = output_path / "index.json"
            with open(index_path, 'w', encoding='utf-8') as f:
                json.dump(index, f, indent=2, ensure_ascii=False, default=str)
            
            self.logger.info("임베딩 저장 완료", extra={
                "embedding_count": len(embeddings),
                "index_created": self.config.create_index,
                "files_created": len(embedding_files) + 1
            })
            
            return index
            
        except Exception as error:
            self.logger.error("임베딩 저장 실패", extra={
                "error": str(error),
                "batch_id": batch_id
            })
            raise
    
    async def load_embeddings(self, index_path: Optional[str] = None) -> List[EmbeddingData]:
        """Load embeddings from storage"""
        index_file = index_path or str(Path(self.config.output_dir) / "index.json")
        
        try:
            self.logger.info("저장소에서 임베딩 로딩", extra={
                "index_file": index_file
            })
            
            # Load index
            with open(index_file, 'r', encoding='utf-8') as f:
                index = json.load(f)
            
            # Load individual embedding files
            embeddings = []
            output_path = Path(self.config.output_dir)
            
            for embedding_ref in index["embeddings"]:
                embedding_path = output_path / embedding_ref["file_path"]
                with open(embedding_path, 'r', encoding='utf-8') as f:
                    embedding_data = json.load(f)
                    embeddings.append(EmbeddingData(**embedding_data))
            
            self.logger.info("임베딩 로딩 완료", extra={
                "embedding_count": len(embeddings),
                "model": index["model_info"]["name"],
                "dimensions": index["model_info"]["dimensions"]
            })
            
            return embeddings
            
        except Exception as error:
            self.logger.error("임베딩 로딩 실패", extra={
                "error": str(error),
                "index_file": index_file
            })
            raise
    
    async def load_embedding(self, embedding_id: str) -> Optional[EmbeddingData]:
        """Load specific embedding by ID"""
        try:
            index_path = Path(self.config.output_dir) / "index.json"
            with open(index_path, 'r', encoding='utf-8') as f:
                index = json.load(f)
            
            embedding_ref = next(
                (ref for ref in index["embeddings"] if ref["embedding_id"] == embedding_id),
                None
            )
            
            if not embedding_ref:
                return None
            
            embedding_path = Path(self.config.output_dir) / embedding_ref["file_path"]
            with open(embedding_path, 'r', encoding='utf-8') as f:
                embedding_data = json.load(f)
                return EmbeddingData(**embedding_data)
                
        except Exception as error:
            self.logger.error("임베딩 로딩 실패", extra={
                "embedding_id": embedding_id,
                "error": str(error)
            })
            return None
    
    async def find_embeddings_by_commit(self, commit_id: str) -> List[EmbeddingData]:
        """Search embeddings by commit ID"""
        try:
            index_path = Path(self.config.output_dir) / "index.json"
            with open(index_path, 'r', encoding='utf-8') as f:
                index = json.load(f)
            
            matching_refs = [
                ref for ref in index["embeddings"] 
                if ref["commit_id"] == commit_id
            ]
            
            embeddings = []
            output_path = Path(self.config.output_dir)
            
            for ref in matching_refs:
                embedding_path = output_path / ref["file_path"]
                with open(embedding_path, 'r', encoding='utf-8') as f:
                    embedding_data = json.load(f)
                    embeddings.append(EmbeddingData(**embedding_data))
            
            return embeddings
            
        except Exception as error:
            self.logger.error("커밋별 임베딩 검색 실패", extra={
                "commit_id": commit_id,
                "error": str(error)
            })
            return []
    
    def _create_index(self, embeddings: List[EmbeddingData], batch_id: str) -> Dict[str, Any]:
        """Create index for embeddings"""
        quality_scores = [emb.metadata.quality_score for emb in embeddings]
        
        index = {
            "version": "1.0.0",
            "created_at": datetime.now().isoformat(),
            "total_embeddings": len(embeddings),
            "model_info": {
                "name": embeddings[0].metadata.model_version if embeddings else "unknown",
                "dimensions": embeddings[0].metadata.dimensions if embeddings else 0,
                "version": "text-embedding-3-large"
            },
            "quality_metrics": {
                "average_quality_score": sum(quality_scores) / len(quality_scores) if quality_scores else 0,
                "min_quality_score": min(quality_scores) if quality_scores else 0,
                "max_quality_score": max(quality_scores) if quality_scores else 0
            },
            "embeddings": [
                {
                    "embedding_id": emb.embedding_id,
                    "commit_id": emb.commit_id,
                    "file_path": f"{emb.embedding_id}.json",
                    "quality_score": emb.metadata.quality_score,
                    "content_type": emb.metadata.content_type,
                    "generated_at": emb.metadata.generated_at
                }
                for emb in embeddings
            ]
        }
        
        return index
    
    async def validate_storage(self) -> Dict[str, Any]:
        """Validate storage integrity"""
        issues = []
        total_files = 0
        missing_files = 0
        corrupted_files = 0
        total_size_bytes = 0
        
        try:
            index_path = Path(self.config.output_dir) / "index.json"
            with open(index_path, 'r', encoding='utf-8') as f:
                index = json.load(f)
            
            total_files = len(index["embeddings"])
            
            for embedding_ref in index["embeddings"]:
                file_path = Path(self.config.output_dir) / embedding_ref["file_path"]
                
                try:
                    file_stat = file_path.stat()
                    total_size_bytes += file_stat.st_size
                    
                    # Validate file content
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = json.load(f)
                    
                    if not content.get("embedding_id") or not content.get("commit_id") or not content.get("embedding_vector"):
                        issues.append(f"Invalid embedding data in {embedding_ref['file_path']}")
                        corrupted_files += 1
                        
                except FileNotFoundError:
                    issues.append(f"Missing file: {embedding_ref['file_path']}")
                    missing_files += 1
                except json.JSONDecodeError:
                    issues.append(f"Corrupted file: {embedding_ref['file_path']}")
                    corrupted_files += 1
                except Exception as e:
                    issues.append(f"Error reading {embedding_ref['file_path']}: {str(e)}")
                    corrupted_files += 1
            
            if missing_files > 0:
                issues.append(f"{missing_files} files are missing")
            
            if corrupted_files > 0:
                issues.append(f"{corrupted_files} files are corrupted")
                
        except Exception as error:
            issues.append(f"Failed to read index: {str(error)}")
        
        return {
            "is_valid": len(issues) == 0,
            "issues": issues,
            "statistics": {
                "total_files": total_files,
                "missing_files": missing_files,
                "corrupted_files": corrupted_files,
                "total_size_bytes": total_size_bytes
            }
        }
    
    async def get_storage_statistics(self) -> Dict[str, Any]:
        """Get storage statistics"""
        try:
            index_path = Path(self.config.output_dir) / "index.json"
            with open(index_path, 'r', encoding='utf-8') as f:
                index = json.load(f)
            
            contentType_distribution = {}
            for embedding in index["embeddings"]:
                content_type = embedding["content_type"]
                contentType_distribution[content_type] = contentType_distribution.get(content_type, 0) + 1
            
            return {
                "total_embeddings": index["total_embeddings"],
                "total_size_mb": 0,  # Will be calculated from file sizes
                "average_quality_score": index["quality_metrics"]["average_quality_score"],
                "model_info": index["model_info"],
                "content_type_distribution": contentType_distribution
            }
            
        except Exception as error:
            self.logger.error("저장소 통계 조회 실패", extra={
                "error": str(error)
            })
            raise
