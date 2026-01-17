from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .gemini import GeminiRateLimit, generate_recommendation
from .onnx_infer import predict_image_bytes
from .rag import ensure_ingested, get_store, retrieve_context_from_model_output

import requests
from fastapi.responses import Response
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
MODEL_PATH = str(PROJECT_ROOT / "models" / "last.onnx")


def _load_env() -> None:
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(Path(__file__).resolve().parent / ".env")


_load_env()

app = FastAPI()

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = get_store()

CAPTURE_DIR = PROJECT_ROOT / "captures"
CAPTURE_DIR.mkdir(exist_ok=True)

# ESP32-CAM configuration - Camera should be accessible at this URL
ESP32_CAM_URL = os.getenv("ESP32_CAM_URL", "http://10.70.187.244/capture") 

@app.on_event("startup")
def _startup() -> None:
    ensure_ingested(store)


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
    app.mount(
    "/captures",StaticFiles(directory=str(CAPTURE_DIR)),name="captures",)



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


@app.get("/api/camera/feed")
def camera_feed(url: str = Query(None)):
    """
    Proxy endpoint for camera feed. Handles CORS and allows frontend to fetch from camera.
    If no URL provided, uses default ESP32_CAM_URL.
    """
    camera_url = url if url else ESP32_CAM_URL
    
    try:
        r = requests.get(camera_url, timeout=5)
        r.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Camera not reachable at {camera_url}: {e}")

    return Response(content=r.content, media_type="image/jpeg")


@app.post("/capture-and-store")
def capture_and_store():
    try:
        r = requests.get(ESP32_CAM_URL, timeout=5)
        r.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"ESP32-CAM not reachable: {e}")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"esp32_{timestamp}.jpg"
    file_path = CAPTURE_DIR / filename

    with open(file_path, "wb") as f:
        f.write(r.content)

    return {
        "message": "Image captured and stored successfully",
        "filename": filename
    }

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

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

load_dotenv()

flask_app = Flask(__name__)
CORS(flask_app)

# AWS API endpoint for sensor data
AWS_API_ENDPOINT = "https://sacgn6gxpa.execute-api.us-east-1.amazonaws.com/latest"
ASSET_ID = "cd29fe97-2d5e-47b4-a951-04c9e29544ac"

# Dummy panel data (for /api/panels/all)
DUMMY_PANELS = [
    {
        "id": "SP-001",
        "name": "Solar Panel 1",
        "location": "Roof A",
        "capacity": 400,
        "current_output": 320,
        "health_score": 96,
        "last_update": "2026-01-17T10:56:00Z"
    },
    {
        "id": "SP-002",
        "name": "Solar Panel 2",
        "location": "Roof B",
        "capacity": 400,
        "current_output": 380,
        "health_score": 98,
        "last_update": "2026-01-17T10:56:00Z"
    },
    {
        "id": "SP-003",
        "name": "Solar Panel 3",
        "location": "Roof C",
        "capacity": 400,
        "current_output": 290,
        "health_score": 95,
        "last_update": "2026-01-17T10:56:00Z"
    },
    {
        "id": "SP-004",
        "name": "Solar Panel 4",
        "location": "Roof D",
        "capacity": 400,
        "current_output": 150,
        "health_score": 78,
        "last_update": "2026-01-17T10:56:00Z"
    }
]

@flask_app.route("/api/panels/all", methods=["GET"])
def get_all_panels():
    """Get all solar panels"""
    try:
        # Try to fetch real data, fallback to dummy
        return jsonify(DUMMY_PANELS), 200
    except Exception as e:
        print(f"Error fetching panels: {e}")
        return jsonify({"error": "Failed to fetch panels", "message": str(e)}), 500

@flask_app.route("/api/panel/readings", methods=["GET"])
def get_panel_readings():
    """Get real-time sensor readings from AWS API"""
    try:
        asset_id = request.args.get("assetId", ASSET_ID)
        
        # Fetch from AWS API
        response = requests.get(
            f"{AWS_API_ENDPOINT}?assetId={asset_id}",
            timeout=5
        )
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Fetched real sensor data from AWS")
        return jsonify(data), 200
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching from AWS API: {e}")
        
        # Fallback to dummy sensor data
        dummy_sensor_data = {
            "assetId": asset_id,
            "data": {
                "V1": {"value": 38.5, "timestamp": {"timeInSeconds": 1768571120, "offsetInNanos": 0}},
                "V2": {"value": 37.2, "timestamp": {"timeInSeconds": 1768571120, "offsetInNanos": 0}},
                "V3": {"value": 39.1, "timestamp": {"timeInSeconds": 1768571120, "offsetInNanos": 0}},
                "V4": {"value": 36.8, "timestamp": {"timeInSeconds": 1768571120, "offsetInNanos": 0}},
                "P1": {"value": 320, "timestamp": {"timeInSeconds": 1768571120, "offsetInNanos": 0}},
                "P2": {"value": 315, "timestamp": {"timeInSeconds": 1768571120, "offsetInNanos": 0}},
                "P3": {"value": 325, "timestamp": {"timeInSeconds": 1768571120, "offsetInNanos": 0}},
                "P4": {"value": 310, "timestamp": {"timeInSeconds": 1768571123, "offsetInNanos": 0}},
                "I": {"value": 8.5, "timestamp": {"timeInSeconds": 1768571123, "offsetInNanos": 0}}
            }
        }
        return jsonify(dummy_sensor_data), 200

@flask_app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "solar-dashboard-backend"}), 200

@flask_app.route("/", methods=["GET"])
def index():
    """Root endpoint"""
    return jsonify({"message": "Solar Dashboard Backend API"}), 200

if __name__ == "__main__":
    print("🚀 Starting Solar Dashboard Backend...")
    print(f"📡 AWS API Endpoint: {AWS_API_ENDPOINT}")
    print(f"🔑 Asset ID: {ASSET_ID}")
    flask_app.run(host="0.0.0.0", port=5000, debug=True)
