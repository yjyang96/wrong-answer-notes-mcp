import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Ensure src package is importable when running tests from repository root
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = PROJECT_ROOT / "src"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.batch_processor import EmbeddingBatchProcessor  # type: ignore  # noqa: E402
from src.models import (  # type: ignore  # noqa: E402
    EmbeddingData,
    EmbeddingMetadata,
    ProcessedCommitData,
    StorageConfig,
)
from src.storage_service import EmbeddingStorageService  # type: ignore  # noqa: E402


def _make_processed_commit() -> ProcessedCommitData:
    return ProcessedCommitData(
        commit_id="abc123def",
        repository="owner/project",
        branch="main",
        message="Fix parser crash when request payload is empty",
        diff="""diff --git a/app/parser.py b/app/parser.py
@@ -10,6 +10,9 @@
 def parse_request(payload: dict) -> dict:
-    return payload['data']
+    if not payload:
+        return {}
+    return payload.get('data', {})
""",
        author="Test Author",
        date=datetime(2025, 1, 20, 12, 0, 0),
        classification={
            "type": "fix",
            "confidence": 0.92,
            "reasoning": "Handles empty payloads gracefully",
            "package_name": "parser",
        },
        environment={
            "languages": ["Python"],
            "frameworks": ["FastAPI"],
            "build_systems": ["poetry"],
            "file_types": [".py"],
            "tools": ["pytest"],
            "versions": {"python": "3.11"},
        },
        metadata={
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "quality_score": 0.9,
            "validation_status": "valid",
            "original_commit_hash": "abc123def",
            "preprocessing_stage": "validated",
        },
    )


def _make_embedding(metadata: EmbeddingMetadata, commit_id: str) -> EmbeddingData:
    return EmbeddingData(
        embedding_id="emb_abc123",
        commit_id=commit_id,
        embedding_vector=[0.1, 0.2, 0.3],
        text_content="Fix parser crash when request payload is empty",
        code_content="return payload.get('data', {})",
        metadata=metadata,
    )


def test_convert_commits_to_requests_includes_environment_metadata():
    azure_stub = MagicMock()
    processor = EmbeddingBatchProcessor(azure_stub, max_concurrent=2)
    commit = _make_processed_commit()

    requests = processor.convert_commits_to_requests([commit])

    assert len(requests) == 1
    request = requests[0]
    assert request.commit_id == commit.commit_id
    assert request.content_type == "mixed"
    assert "Fix parser crash" in request.text
    assert request.metadata["classification"]["type"] == "fix"
    assert request.metadata["environment"] == commit.environment


def test_save_embeddings_persists_index_and_files(tmp_path):
    storage_config = StorageConfig(output_dir=str(tmp_path))
    storage_service = EmbeddingStorageService(storage_config)

    commit = _make_processed_commit()
    metadata = EmbeddingMetadata(
        model_version="text-embedding-3-large",
        generated_at=datetime.now(timezone.utc),
        quality_score=0.95,
        dimensions=3072,
        content_type="mixed",
        processing_time_ms=120,
        batch_id="batch-test",
        environment={"runtime": "python"},
    )
    embedding = _make_embedding(metadata, commit.commit_id)

    index = asyncio.run(
        storage_service.save_embeddings([embedding], [commit], "batch-test")
    )

    index_path = tmp_path / "index.json"
    embedding_path = tmp_path / f"{embedding.embedding_id}.json"

    assert index_path.exists()
    assert embedding_path.exists()
    assert index["total_embeddings"] == 1
    assert index["embeddings"][0]["commit_id"] == commit.commit_id

    with embedding_path.open("r", encoding="utf-8") as f:
        stored_data = json.load(f)

    assert stored_data["embedding_id"] == embedding.embedding_id
    assert stored_data["original_commit"]["commit_id"] == commit.commit_id
    assert stored_data["original_commit"]["classification"]["type"] == "fix"
