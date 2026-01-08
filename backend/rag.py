from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple

from rag_module.ingest import ingest_knowledge
from rag_module.query import build_query_from_ml_output, format_retrieved_context
from rag_module.types import RetrievedChunk
from rag_module.vectorstores import ChromaVectorStore


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PERSIST_DIR = PROJECT_ROOT / "vector_db" / "chroma"
KNOWLEDGE_DIR = Path(__file__).resolve().parent / "knowledge_base"
COLLECTION_NAME = "solar_panel_knowledge"


def get_store() -> ChromaVectorStore:
    return ChromaVectorStore(persist_dir=str(PERSIST_DIR), collection_name=COLLECTION_NAME)


def _format_retrieved_context(chunks: List[RetrievedChunk]) -> str:
    if not chunks:
        return "No relevant knowledge retrieved."

    blocks: List[str] = []
    for i, ch in enumerate(chunks, start=1):
        src = ch.metadata.get("source", "unknown")
        relevance = "Highly Relevant" if ch.score > 0.7 else "Relevant" if ch.score > 0.5 else "Low Relevance"
        header = f"\n{'='*80}\nCONTEXT {i} | Source: {src} | Relevance: {relevance} (Score: {ch.score:.4f})\n{'='*80}\n"
        blocks.append(header + ch.text)
    
    footer = f"\n\n{'='*80}\nEND OF RETRIEVED KNOWLEDGE BASE\n{'='*80}"
    return "".join(blocks) + footer


def retrieve_context_from_model_output(
    *,
    store: ChromaVectorStore,
    model_output: Dict[str, Any],
    k: int = 3,
) -> Tuple[str, str]:
    query = build_query_from_ml_output(model_output)
    chunks = store.similarity_search(query, k=k)

    # Prefer the canonical formatter from rag_module to keep consistent output.
    try:
        context = format_retrieved_context(chunks)
    except Exception:
        context = _format_retrieved_context(chunks)
    return query, context


def ensure_ingested(store: ChromaVectorStore) -> None:
    # Skip ingestion if the persistent collection already has documents.
    try:
        count = int(store._collection.count())  # type: ignore[attr-defined]
    except Exception:
        count = 0

    if count > 0:
        return

    if not KNOWLEDGE_DIR.exists():
        raise RuntimeError(f"Knowledge directory not found: {KNOWLEDGE_DIR}")

    txt_files = sorted(KNOWLEDGE_DIR.glob("*.txt"))
    if not txt_files:
        raise RuntimeError(f"No knowledge files found in: {KNOWLEDGE_DIR}")

    texts: List[str] = []
    sources: List[str] = []
    for p in txt_files:
        texts.append(p.read_text(encoding="utf-8"))
        sources.append(p.name)

    ingest_knowledge(store, knowledge_texts=texts, sources=sources)

    # Must never be empty after startup.
    try:
        new_count = int(store._collection.count())  # type: ignore[attr-defined]
    except Exception:
        new_count = 0
    if new_count <= 0:
        raise RuntimeError("RAG retrieval is empty after ingestion; check knowledge base ingestion.")


def retrieve_context(*, store: ChromaVectorStore, fault: str, confidence: float, k: int = 3) -> str:
    model_output = {
        "primary_defect": fault,
        "confidence": confidence,
        "top_predictions": [{"label": fault, "score": confidence}],
    }
    _query, context = retrieve_context_from_model_output(store=store, model_output=model_output, k=k)
    return context
