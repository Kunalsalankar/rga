# Solar Panel Defect RAG Module (Python)

This folder contains a small Retrieval-Augmented Generation (RAG) module intended to **retrieve factual/company-specific context** for solar panel defect classification outputs.

## What it does

- Takes your ML model output (label, confidence, top-k)
- Converts it into a retrieval query string
- Retrieves relevant knowledge chunks from a vector database (**FAISS** or **ChromaDB**)
- Returns **plain text context** that you can pass into a Gemini prompt later

**Important constraints respected:**
- No image processing
- No operational decisions inside RAG
- No Gemini calls in this module

## Install

```bash
pip install -r requirements.txt
```

## Knowledge ingestion

Example knowledge file:
- `knowledge/example_knowledge.txt`

Ingest it:

```bash
python scripts/ingest_example.py
```

This stores embeddings + chunks under:
- `vector_db/faiss/` or `vector_db/chroma/`

## Querying using ML output

```bash
python scripts/query_example.py
```

## How ML output flows into RAG

- `rag_module/query.py::build_query_from_ml_output(model_output)`
  - Takes fields like `primary_defect`, `confidence`, and `top_predictions`
  - Builds a text query emphasizing:
    - defect impact/risk
    - maintenance SOPs
    - decision thresholds (informational)

- `store.similarity_search(query, k=...)`
  - Retrieves top-k chunks from the vector store

- `rag_module/query.py::format_retrieved_context(chunks)`
  - Produces **plain text** blocks:

```
[CONTEXT 1 | source=... | score=...]
<chunk text>

---

[CONTEXT 2 | ...]
<chunk text>
```

## Preparing for Gemini (later)

In your Gemini-calling layer (not included here yet), you typically:

- pass the **raw ML output JSON**
- append the **retrieved context text** returned by `query_rag(...)`
- instruct Gemini to reason *using only retrieved SOP/threshold facts*

This project intentionally stops at retrieval + formatting.
