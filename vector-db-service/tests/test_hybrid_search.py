import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Allow importing modules from the src package when tests run from repository root
PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = PROJECT_ROOT / "src"
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.utils.hybrid_search import HybridSearchService  # type: ignore  # noqa: E402


def test_combine_results_normalizes_and_prioritizes_scores():
    service = HybridSearchService()
    service.set_weights(0.5, 0.5)

    combined = service._combine_results(  # pylint: disable=protected-access
        bm25_results=[("doc1", 2.0), ("doc2", 1.0)],
        vector_results=[("doc2", 0.9), ("doc3", 0.2)],
    )

    scores = {doc_id: score for doc_id, score in combined}

    assert {"doc1", "doc2", "doc3"}.issubset(scores.keys())
    assert scores["doc1"] > scores["doc3"], "Higher BM25 scores should influence ranking"
    assert all(0.0 <= value <= 1.0 for value in scores.values())


def test_search_combines_bm25_and_vector_signals():
    service = HybridSearchService()

    bm25_stub = MagicMock()
    bm25_stub.is_initialized = True
    bm25_stub.search.return_value = [("docA", 9.0), ("docB", 2.0)]
    service.bm25_service = bm25_stub

    service.embedding_generator.generate_embedding = MagicMock(return_value=[1.0, 0.0])

    documents = [
        "Fix parser bug when payload is missing",
        "Update documentation for new parser",
    ]
    doc_ids = ["docA", "docB"]
    embeddings = [
        [1.0, 0.0],
        [0.5, 0.866],
    ]

    results = service.search(
        query="parser bug",
        documents=documents,
        document_ids=doc_ids,
        embeddings=embeddings,
        top_k=2,
    )

    assert len(results) == 2
    top_doc_id, _, score_breakdown = results[0]
    assert top_doc_id == "docA"
    assert score_breakdown["combined_score"] >= 0.0
    assert score_breakdown["bm25_score"] >= score_breakdown["vector_score"]
    bm25_stub.search.assert_called_once()
