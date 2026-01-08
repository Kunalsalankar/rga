from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import onnxruntime as ort
from PIL import Image


CLASSES: List[str] = [
    "Bird-drop",
    "Clean",
    "Dusty",
    "Electrical-damage",
    "Physical-Damage",
    "Snow-Covered",
]


def _softmax(x: np.ndarray) -> np.ndarray:
    x = x.astype("float32")
    x = x - np.max(x)
    e = np.exp(x)
    return e / np.sum(e)


def _parse_float_csv(value: str, expected_len: int) -> np.ndarray:
    parts = [p.strip() for p in value.split(",") if p.strip()]
    if len(parts) != expected_len:
        raise ValueError(f"Expected {expected_len} comma-separated floats, got: {value}")
    return np.array([float(p) for p in parts], dtype="float32")


def preprocess_image(img: Image.Image) -> np.ndarray:
    img = img.convert("RGB")
    img = img.resize((224, 224))

    arr = np.asarray(img).astype("float32") / 255.0

    normalize = os.getenv("ONNX_NORMALIZE", "1").strip() not in ("0", "false", "FALSE", "no", "NO")
    if normalize:
        mean_env = os.getenv("ONNX_MEAN")
        std_env = os.getenv("ONNX_STD")
        mean = (
            _parse_float_csv(mean_env, 3)
            if mean_env
            else np.array([0.485, 0.456, 0.406], dtype="float32")
        )
        std = (
            _parse_float_csv(std_env, 3)
            if std_env
            else np.array([0.229, 0.224, 0.225], dtype="float32")
        )
        arr = (arr - mean) / std

    # HWC -> CHW
    arr = np.transpose(arr, (2, 0, 1))

    # Add batch dimension
    arr = np.expand_dims(arr, axis=0)

    return arr.astype("float32")


@lru_cache(maxsize=1)
def get_session(model_path: str) -> ort.InferenceSession:
    providers = ["CPUExecutionProvider"]
    sess = ort.InferenceSession(model_path, providers=providers)
    return sess


def predict_image_bytes(*, model_path: str, image_bytes: bytes, top_k: int = 3) -> Tuple[str, float, List[Dict[str, float]]]:
    sess = get_session(model_path)

    input_name = sess.get_inputs()[0].name
    output_name = sess.get_outputs()[0].name

    try:
        from io import BytesIO

        img = Image.open(BytesIO(image_bytes))
    except Exception as e:
        raise ValueError(f"Invalid image: {e}")

    x = preprocess_image(img)

    outputs = sess.run([output_name], {input_name: x})
    y = np.array(outputs[0])

    # Common shapes: [1, C], [C], [1, 1, C], etc.
    y = np.squeeze(y)
    if y.ndim != 1:
        raise RuntimeError(f"Unexpected model output shape: {y.shape}")

    # Some exports already output probabilities.
    # Heuristic: values within [0,1] and sum ~ 1 => treat as probs; else softmax logits.
    y_min = float(np.min(y))
    y_max = float(np.max(y))
    y_sum = float(np.sum(y))
    looks_like_probs = (y_min >= -1e-6) and (y_max <= 1.0 + 1e-6) and (abs(y_sum - 1.0) < 1e-2)
    probs = y.astype("float32") if looks_like_probs else _softmax(y)

    idxs = np.argsort(-probs)[: max(1, min(top_k, len(CLASSES)))]
    top = [{"label": CLASSES[int(i)], "score": float(probs[int(i)])} for i in idxs]

    best_idx = int(idxs[0])
    fault = CLASSES[best_idx]
    confidence = float(probs[best_idx])

    return fault, confidence, top
