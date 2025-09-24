"""
Collection Manager for ChromaDB
"""

from typing import List, Dict, Any, Optional
from loguru import logger

from ..models import CollectionInfo, ChromaConfig
from .chroma_service import ChromaService


class CollectionManager:
    """Manages ChromaDB collections"""
    
    def __init__(self, chroma_config: ChromaConfig):
        self.config = chroma_config
        self.logger = logger.bind(context="CollectionManager")
        self.chroma_service = ChromaService(chroma_config)
    
    def create_collection(self, name: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Create a new collection"""
        try:
            collection = self.chroma_service.create_collection(name)
            if metadata:
                # Update metadata if provided
                collection.modify(metadata=metadata)
            
            self.logger.info("컬렉션 생성됨", extra={
                "collection_name": name,
                "metadata": metadata
            })
            return True
            
        except Exception as error:
            self.logger.error("컬렉션 생성 실패", extra={
                "collection_name": name,
                "error": str(error)
            })
            return False
    
    def list_collections(self) -> List[CollectionInfo]:
        """List all collections"""
        return self.chroma_service.list_collections()
    
    def get_collection_info(self, name: str) -> Optional[CollectionInfo]:
        """Get collection information"""
        return self.chroma_service.get_collection_info(name)
    
    def delete_collection(self, name: str) -> bool:
        """Delete a collection"""
        return self.chroma_service.delete_collection(name)
    
    def collection_exists(self, name: str) -> bool:
        """Check if collection exists"""
        try:
            self.chroma_service.client.get_collection(name)
            return True
        except Exception:
            return False
