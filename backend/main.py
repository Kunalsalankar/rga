from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .gemini import GeminiRateLimit, generate_recommendation
from .onnx_infer import predict_image_bytes
from .rag import ensure_ingested, get_store, retrieve_context_from_model_output

import requests
from fastapi.responses import Response

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
MODEL_PATH = str(PROJECT_ROOT / "models" / "last.onnx")


def _load_env() -> None:
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(Path(__file__).resolve().parent / ".env")


_load_env()

app = FastAPI()

store = get_store()

ESP32_CAM_URL = "http://192.168.1.50/capture"  # change to your ESP32 IP

@app.on_event("startup")
def _startup() -> None:
    ensure_ingested(store)


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def index() -> FileResponse:
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="frontend/index.html not found")
    return FileResponse(str(index_path))


@app.get("/esp32-image")
def esp32_image():
    try:
        r = requests.get(ESP32_CAM_URL, timeout=5)
        r.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"ESP32-CAM not reachable: {e}")

    return Response(content=r.content, media_type="image/jpeg")


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), debug: int = Query(0)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file")

    if not Path(MODEL_PATH).exists():
        raise HTTPException(status_code=500, detail=f"ONNX model not found at: {MODEL_PATH}")

    image_bytes = await file.read()

    try:
        fault, confidence, top = predict_image_bytes(model_path=MODEL_PATH, image_bytes=image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ONNX inference failed: {e}")

    model_output = {
        "primary_defect": fault,
        "confidence": confidence,
        "top_predictions": top,
    }

    debug_payload = None
    if debug:
        try:
            import onnxruntime as ort

            sess = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
            debug_payload = {
                "onnx_inputs": [
                    {
                        "name": i.name,
                        "shape": i.shape,
                        "type": i.type,
                    }
                    for i in sess.get_inputs()
                ],
                "onnx_outputs": [
                    {
                        "name": o.name,
                        "shape": o.shape,
                        "type": o.type,
                    }
                    for o in sess.get_outputs()
                ],
                "top_predictions": top,
            }
        except Exception as e:
            debug_payload = {"debug_error": str(e), "top_predictions": top}

    rag_query, rag_context = retrieve_context_from_model_output(store=store, model_output=model_output, k=3)

    if not rag_context:
        raise HTTPException(status_code=500, detail="RAG retrieval returned empty context")

    try:
        suggestion = generate_recommendation(model_output=model_output, rag_context=rag_context)
    except GeminiRateLimit as e:
        raise HTTPException(
            status_code=429,
            detail=f"Gemini is rate-limited. Please retry after {int(e.retry_after_seconds)} seconds.",
        )
    except RuntimeError as e:
        # Includes missing GEMINI_API_KEY message.
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini call failed: {e}")

    payload = {
        "fault": fault,
        "confidence": confidence,
        "rag_context": rag_context,
        "gemini_suggestion": suggestion,
    }

    if debug_payload is not None:
        debug_payload["model_output"] = model_output
        debug_payload["rag_query"] = rag_query
        payload["debug"] = debug_payload

    return payload


@app.get("/health")
def health():
    return {"status": "ok"}
