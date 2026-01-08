from __future__ import annotations

from typing import List, Optional

import numpy as np
from sentence_transformers import SentenceTransformer


class EmbeddingModel:
    """Small wrapper around SentenceTransformers.

    Notes:
    - We compute embeddings inside the app so both FAISS and Chroma backends behave the same.
    - Embeddings are L2-normalized so inner product ~= cosine similarity.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", device: Optional[str] = None):
        self.model_name = model_name
        self._model = SentenceTransformer(model_name, device=device)

    def embed_texts(self, texts: List[str]) -> np.ndarray:
        vectors = self._model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vectors.astype("float32")
