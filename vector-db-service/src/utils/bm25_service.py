"""
BM25 Text Search Service Implementation
"""

import re
import pickle
import os
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from rank_bm25 import BM25Okapi
from loguru import logger
import numpy as np


class BM25Service:
    """BM25 text search service for hybrid search"""
    
    def __init__(self, persist_directory: str = "./data/chroma_db"):
        self.logger = logger.bind(context="BM25Service")
        self.persist_directory = Path(persist_directory)
        self.bm25_index = None
        self.documents = []
        self.document_ids = []
        self.is_initialized = False
        self.index_file = self.persist_directory / "bm25_index.pkl"
        
    def _preprocess_text(self, text: str) -> List[str]:
        """Preprocess text for BM25 indexing"""
        if not text:
            return []
        
        # Convert to lowercase and split into tokens
        text = text.lower()
        
        # Remove special characters but keep alphanumeric and spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Split into tokens and remove empty strings
        tokens = [token.strip() for token in text.split() if token.strip()]
        
        return tokens
    
    def save_index(self) -> bool:
        """Save BM25 index to disk"""
        try:
            if not self.is_initialized or not self.bm25_index:
                self.logger.warning("저장할 인덱스가 없음")
                return False
            
            # Ensure directory exists
            self.persist_directory.mkdir(parents=True, exist_ok=True)
            
            # Prepare data for saving
            index_data = {
                'bm25_index': self.bm25_index,
                'documents': self.documents,
                'document_ids': self.document_ids,
                'is_initialized': self.is_initialized
            }
            
            # Save to pickle file
            with open(self.index_file, 'wb') as f:
                pickle.dump(index_data, f)
            
            self.logger.info("BM25 인덱스 저장 완료", extra={
                "index_file": str(self.index_file),
                "document_count": len(self.documents)
            })
            
            return True
            
        except Exception as error:
            self.logger.error("BM25 인덱스 저장 실패", extra={
                "error": str(error),
                "index_file": str(self.index_file)
            })
            return False
    
    def load_index(self) -> bool:
        """Load BM25 index from disk"""
        try:
            if not self.index_file.exists():
                self.logger.info("BM25 인덱스 파일이 없음", extra={
                    "index_file": str(self.index_file)
                })
                return False
            
            # Load from pickle file
            with open(self.index_file, 'rb') as f:
                index_data = pickle.load(f)
            
            # Restore index data
            self.bm25_index = index_data['bm25_index']
            self.documents = index_data['documents']
            self.document_ids = index_data['document_ids']
            self.is_initialized = index_data['is_initialized']
            
            self.logger.info("BM25 인덱스 로드 완료", extra={
                "index_file": str(self.index_file),
                "document_count": len(self.documents)
            })
            
            return True
            
        except Exception as error:
            self.logger.error("BM25 인덱스 로드 실패", extra={
                "error": str(error),
                "index_file": str(self.index_file)
            })
            return False
    
    def build_index(self, documents: List[str], document_ids: List[str], save_to_disk: bool = True) -> bool:
        """Build BM25 index from documents"""
        try:
            self.logger.info("BM25 인덱스 구축 시작", extra={
                "document_count": len(documents)
            })
            
            if len(documents) != len(document_ids):
                raise ValueError("Documents and document_ids must have the same length")
            
            # Preprocess all documents
            tokenized_docs = []
            for doc in documents:
                tokens = self._preprocess_text(doc)
                tokenized_docs.append(tokens)
            
            # Build BM25 index
            self.bm25_index = BM25Okapi(tokenized_docs)
            self.documents = documents
            self.document_ids = document_ids
            self.is_initialized = True
            
            self.logger.info("BM25 인덱스 구축 완료", extra={
                "document_count": len(documents),
                "total_tokens": sum(len(doc) for doc in tokenized_docs)
            })
            
            # Save to disk if requested
            if save_to_disk:
                self.save_index()
            
            return True
            
        except Exception as error:
            self.logger.error("BM25 인덱스 구축 실패", extra={
                "error": str(error)
            })
            return False
    
    def search(self, query: str, top_k: int = 10) -> List[Tuple[str, float]]:
        """Search using BM25 algorithm"""
        if not self.is_initialized or not self.bm25_index:
            self.logger.error("BM25 인덱스가 초기화되지 않음")
            return []
        
        try:
            # Preprocess query
            query_tokens = self._preprocess_text(query)
            if not query_tokens:
                self.logger.warning("빈 쿼리 토큰")
                return []
            
            # Get BM25 scores
            scores = self.bm25_index.get_scores(query_tokens)
            
            # Convert scores to list to avoid numpy array comparison issues
            scores_list = scores.tolist() if hasattr(scores, 'tolist') else list(scores)
            
            # Get top-k results with document IDs
            top_indices = np.argsort(scores_list)[::-1][:top_k]
            
            results = []
            for idx in top_indices:
                if scores_list[idx] > 0:  # Only include documents with positive scores
                    doc_id = self.document_ids[idx]
                    score = float(scores_list[idx])
                    results.append((doc_id, score))
            
            self.logger.info("BM25 검색 완료", extra={
                "query": query,
                "query_tokens": query_tokens,
                "results_count": len(results),
                "top_score": results[0][1] if results else 0.0
            })
            
            return results
            
        except Exception as error:
            self.logger.error("BM25 검색 실패", extra={
                "query": query,
                "error": str(error)
            })
            return []
    
    def get_document_by_id(self, doc_id: str) -> Optional[str]:
        """Get document content by ID"""
        try:
            idx = self.document_ids.index(doc_id)
            return self.documents[idx]
        except ValueError:
            return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Get BM25 index statistics"""
        if not self.is_initialized:
            return {"initialized": False}
        
        return {
            "initialized": True,
            "document_count": len(self.documents),
            "total_tokens": sum(len(self._preprocess_text(doc)) for doc in self.documents),
            "average_tokens_per_doc": np.mean([len(self._preprocess_text(doc)) for doc in self.documents]) if self.documents else 0
        }
    
    def clear_index(self, remove_file: bool = True):
        """Clear the BM25 index"""
        self.bm25_index = None
        self.documents = []
        self.document_ids = []
        self.is_initialized = False
        
        # Remove index file if requested
        if remove_file and self.index_file.exists():
            try:
                self.index_file.unlink()
                self.logger.info("BM25 인덱스 파일 삭제됨", extra={
                    "index_file": str(self.index_file)
                })
            except Exception as error:
                self.logger.warning("BM25 인덱스 파일 삭제 실패", extra={
                    "error": str(error),
                    "index_file": str(self.index_file)
                })
        
        self.logger.info("BM25 인덱스 초기화됨")
