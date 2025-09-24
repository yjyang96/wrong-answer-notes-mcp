"""
Hybrid Search Service (BM25 + Vector Search)
"""

import time
from typing import List, Dict, Any, Tuple, Optional
from loguru import logger
import numpy as np

from .bm25_service import BM25Service
from .embedding_generator import EmbeddingGenerator
from ..models import SearchQuery, SearchResult


class HybridSearchService:
    """Hybrid search combining BM25 and vector search"""
    
    def __init__(self, persist_directory: str = "./data/chroma_db"):
        self.logger = logger.bind(context="HybridSearchService")
        self.bm25_service = BM25Service(persist_directory)
        self.embedding_generator = EmbeddingGenerator()
        
        # Default weights for combining results
        self.bm25_weight = 0.4
        self.vector_weight = 0.6
        
    def set_weights(self, bm25_weight: float, vector_weight: float):
        """Set weights for combining BM25 and vector search results"""
        if abs(bm25_weight + vector_weight - 1.0) > 0.01:
            self.logger.warning("가중치 합이 1.0이 아님", extra={
                "bm25_weight": bm25_weight,
                "vector_weight": vector_weight,
                "sum": bm25_weight + vector_weight
            })
        
        self.bm25_weight = bm25_weight
        self.vector_weight = vector_weight
        
        self.logger.info("하이브리드 검색 가중치 설정", extra={
            "bm25_weight": bm25_weight,
            "vector_weight": vector_weight
        })
    
    def build_bm25_index(self, documents: List[str], document_ids: List[str]) -> bool:
        """Build BM25 index from documents"""
        return self.bm25_service.build_index(documents, document_ids)
    
    def _normalize_scores(self, scores: List[float]) -> List[float]:
        """Normalize scores to [0, 1] range"""
        if not scores:
            return []
        
        scores_array = np.array(scores, dtype=float)
        min_score = float(np.min(scores_array))
        max_score = float(np.max(scores_array))
        
        if max_score == min_score:
            return [1.0] * len(scores)
        
        normalized = (scores_array - min_score) / (max_score - min_score)
        return normalized.tolist()
    
    def _combine_results(
        self, 
        bm25_results: List[Tuple[str, float]], 
        vector_results: List[Tuple[str, float]]
    ) -> List[Tuple[str, float]]:
        """Combine BM25 and vector search results"""
        
        # Create score dictionaries
        bm25_scores = {doc_id: score for doc_id, score in bm25_results}
        vector_scores = {doc_id: score for doc_id, score in vector_results}
        
        # Get all unique document IDs
        all_doc_ids = set(bm25_scores.keys()) | set(vector_scores.keys())
        
        # Normalize scores
        bm25_score_list = [float(bm25_scores.get(doc_id, 0.0)) for doc_id in all_doc_ids]
        vector_score_list = [float(vector_scores.get(doc_id, 0.0)) for doc_id in all_doc_ids]
        
        normalized_bm25 = self._normalize_scores(bm25_score_list)
        normalized_vector = self._normalize_scores(vector_score_list)
        
        # Combine scores with weights
        combined_results = []
        for i, doc_id in enumerate(all_doc_ids):
            combined_score = (
                self.bm25_weight * normalized_bm25[i] + 
                self.vector_weight * normalized_vector[i]
            )
            combined_results.append((doc_id, combined_score))
        
        # Sort by combined score (descending)
        combined_results.sort(key=lambda x: x[1], reverse=True)
        
        return combined_results
    
    def search(
        self, 
        query: str, 
        documents: List[str], 
        document_ids: List[str],
        embeddings: List[List[float]],
        top_k: int = 10
    ) -> List[Tuple[str, float, Dict[str, float]]]:
        """
        Perform hybrid search combining BM25 and vector search
        
        Returns:
            List of (document_id, combined_score, score_breakdown)
        """
        start_time = time.time()
        
        try:
            self.logger.info("하이브리드 검색 시작", extra={
                "query": query,
                "document_count": len(documents),
                "top_k": top_k
            })
            
            # Debug: Check data types
            self.logger.info("데이터 타입 확인", extra={
                "documents_type": type(documents),
                "document_ids_type": type(document_ids),
                "embeddings_type": type(embeddings),
                "embeddings_length": len(embeddings) if embeddings else 0
            })
            
            # 1. Try to load existing BM25 index first, then build if needed
            if not self.bm25_service.is_initialized:
                self.logger.info("BM25 인덱스 로드 시도 중...")
                if not self.bm25_service.load_index():
                    self.logger.info("BM25 인덱스 구축 중...")
                    bm25_success = self.bm25_service.build_index(documents, document_ids)
                    if not bm25_success:
                        self.logger.error("BM25 인덱스 구축 실패")
                        return []
            
            # 2. BM25 Search
            bm25_start = time.time()
            bm25_results = self.bm25_service.search(query, top_k=top_k * 2)  # Get more results for better combination
            bm25_time = (time.time() - bm25_start) * 1000
            
            # 3. Vector Search
            vector_start = time.time()
            query_embedding = self.embedding_generator.generate_embedding(query)
            if not query_embedding:
                self.logger.error("임베딩 생성 실패")
                return []
            
            # Calculate cosine similarities
            vector_scores = []
            for i, doc_embedding in enumerate(embeddings):
                if doc_embedding and len(doc_embedding) > 0:
                    # Convert to numpy arrays
                    query_vec = np.array(query_embedding)
                    doc_vec = np.array(doc_embedding)
                    
                    # Cosine similarity
                    dot_product = np.dot(query_vec, doc_vec)
                    norm_query = np.linalg.norm(query_vec)
                    norm_doc = np.linalg.norm(doc_vec)
                    
                    if norm_query > 0 and norm_doc > 0:
                        similarity = dot_product / (norm_query * norm_doc)
                        vector_scores.append((document_ids[i], float(similarity)))
            
            # Sort by similarity and get top results
            vector_scores.sort(key=lambda x: x[1], reverse=True)
            vector_results = vector_scores[:top_k * 2]
            vector_time = (time.time() - vector_start) * 1000
            
            # 4. Combine results
            combine_start = time.time()
            combined_results = self._combine_results(bm25_results, vector_results)
            combine_time = (time.time() - combine_start) * 1000
            
            # 5. Prepare detailed results
            final_results = []
            bm25_scores = {doc_id: score for doc_id, score in bm25_results}
            vector_scores_dict = {doc_id: score for doc_id, score in vector_results}
            
            for doc_id, combined_score in combined_results[:top_k]:
                score_breakdown = {
                    "bm25_score": bm25_scores.get(doc_id, 0.0),
                    "vector_score": vector_scores_dict.get(doc_id, 0.0),
                    "combined_score": combined_score
                }
                final_results.append((doc_id, combined_score, score_breakdown))
            
            total_time = (time.time() - start_time) * 1000
            
            self.logger.info("하이브리드 검색 완료", extra={
                "query": query,
                "bm25_time_ms": bm25_time,
                "vector_time_ms": vector_time,
                "combine_time_ms": combine_time,
                "total_time_ms": total_time,
                "results_count": len(final_results),
                "bm25_results": len(bm25_results),
                "vector_results": len(vector_results)
            })
            
            return final_results
            
        except Exception as error:
            total_time = (time.time() - start_time) * 1000
            self.logger.error("하이브리드 검색 실패", extra={
                "query": query,
                "error": str(error),
                "total_time_ms": total_time
            })
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get hybrid search service statistics"""
        return {
            "bm25_stats": self.bm25_service.get_stats(),
            "weights": {
                "bm25_weight": self.bm25_weight,
                "vector_weight": self.vector_weight
            },
            "embedding_generator_configured": self.embedding_generator.is_configured()
        }
