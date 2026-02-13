from __future__ import annotations

import os
import json
import google.generativeai as genai
from google.generativeai.types import StopCandidateException
import time
from pathlib import Path
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlparse, urlunparse

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .onnx_infer import predict_image_bytes
from .rag import ensure_ingested, get_store, retrieve_context_from_model_output

import requests
from fastapi.responses import Response
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
MODEL_PATH = str(PROJECT_ROOT / "models" / "last.onnx")
FALLBACK_IMAGE_PATH = PROJECT_ROOT / "backend" / "image.png"

# ==================== GEMINI INTEGRATION ====================

TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}

def _get_gemini_cooldown_seconds() -> int:
    value = (os.getenv("GEMINI_COOLDOWN_SECONDS") or "60").strip()
    try:
        seconds = int(value)
    except ValueError:
        seconds = 60
    return max(0, seconds)

_GEMINI_CACHE: dict[str, dict[str, Any]] = {}

# Simple in-memory cache for weather responses
_WEATHER_CACHE: dict[str, dict[str, Any]] = {}

# Simple in-memory cache for panel readings (avoid slow first paint / AWS hiccups)
_READINGS_CACHE: dict[str, dict[str, Any]] = {}

@dataclass(frozen=True)
class GeminiRateLimit(Exception):
    retry_after_seconds: float

def _parse_retry_delay_seconds(error_body: str) -> Optional[float]:
    """Parse retry-after from error response"""
    try:
        data = json.loads(error_body)
        if "error" in data and isinstance(data["error"], dict):
            error_dict = data["error"]
            if "details" in error_dict:
                for detail in error_dict["details"]:
                    if detail.get("@type") == "type.googleapis.com/google.rpc.RetryInfo":
                        retry_delay = detail.get("retryDelay")
                        if retry_delay:
                            seconds = float(retry_delay.get("seconds", 0))
                            nanos = float(retry_delay.get("nanos", 0))
                            return seconds + (nanos / 1e9)
    except Exception:
        pass
    return None

def _get_api_keys() -> list[str]:
    """Extract multiple API keys from environment"""
    explicit = (os.getenv("GEMINI_API_KEYS") or "").strip()
    if explicit:
        return [k.strip() for k in explicit.split(",") if k.strip()]

    # Allow comma-separated keys in GEMINI_API_KEY as well (common user mistake)
    single = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not single:
        return []
    return [k.strip() for k in single.split(",") if k.strip()]

def _pick_model() -> str:
    """Pick Gemini model from environment"""
    explicit = (os.getenv("GEMINI_MODEL") or "").strip()
    if explicit:
        return explicit
    
    csv = (os.getenv("GEMINI_MODELS") or "").strip()
    if csv:
        models = [m.strip() for m in csv.split(",") if m.strip()]
        if models:
            return models[0]
    
    return "models/gemini-2.0-flash"

def build_prompt(*, model_output: Dict[str, Any], rag_context: str) -> str:
    """Build comprehensive prompt for Gemini"""
    fault = model_output.get("primary_defect")
    confidence = model_output.get("confidence")
    panel_id = model_output.get("panel_id", "Unknown")
    
    defect_contexts = {
        "Dusty": {
            "urgency_threshold": 0.7,
            "safety_risk": "Low - accumulation can mask other issues",
            "typical_actions": "Cleaning with deionized water, early morning/evening timing to reduce thermal stress",
            "inspection_focus": "Surface cleanliness, residue verification, cracks under dust",
        },
        "Bird-drop": {
            "urgency_threshold": 0.6,
            "safety_risk": "Medium - can create localized hotspots and mismatch losses",
            "typical_actions": "Careful removal, subsequent cleaning, hotspot monitoring",
            "inspection_focus": "Hotspot development, thermal imaging confirmation, cell integrity",
        },
        "Physical-Damage": {
            "urgency_threshold": 0.5,
            "safety_risk": "High - may cause moisture ingress and rapid performance decline",
            "typical_actions": "Immediate visual assessment, potential electrical isolation",
            "inspection_focus": "Crack severity, encapsulation integrity, frame gaps, conductor exposure",
        },
        "Electrical-damage": {
            "urgency_threshold": 0.4,
            "safety_risk": "Critical - fire hazard, electrical shock risk",
            "typical_actions": "Immediate isolation, professional assessment required, safety protocols",
            "inspection_focus": "Burn marks, discoloration, connector integrity, conductor damage",
        },
        "Snow-Covered": {
            "urgency_threshold": 0.8,
            "safety_risk": "Medium - no immediate electrical hazard, but complete power loss",
            "typical_actions": "Monitor for natural melting, avoid thermal shock from hot water",
            "inspection_focus": "Ice/snow accumulation depth, underlying panel condition after removal",
        },
        "Clean": {
            "urgency_threshold": 1.0,
            "safety_risk": "None - normal operation",
            "typical_actions": "Standard maintenance schedule, no immediate intervention",
            "inspection_focus": "Routine performance monitoring, schedule next maintenance",
        },
    }
    
    defect_info = defect_contexts.get(fault, {})
    urgency_level = _determine_urgency(fault, confidence, defect_info)

    fault_l = str(fault or "").strip().lower()
    if fault_l == "clean" and float(confidence or 0) >= 0.9:
        action_required = "Monitor"
    elif "critical" in urgency_level.lower() or "electrical" in fault_l or "physical" in fault_l:
        action_required = "Immediate maintenance"
    else:
        action_required = "Inspect & maintain"
    
    return (
        "You are an expert solar PV operations assistant specialized in defect identification and technician guidance.\n"
        "DEFECT TYPE: " + fault + "\n"
        "PANEL ID: " + panel_id + "\n"
        "MODEL CONFIDENCE: {:.1%}\n".format(confidence) +
        "\n"
        "YOUR TASK:\n"
        "1. Analyze the detected defect using the retrieved solar panel knowledge base\n"
        "2. Determine severity, impact, and required actions\n"
        "3. Prefer facts from retrieved knowledge when available.\n"
        "4. If the knowledge base does not contain enough specifics, provide SAFE, generic best-practice guidance instead of writing 'Not found in retrieved knowledge'.\n"
        "5. If defect is 'Clean' and confidence is high, keep it very short and focus on monitoring and routine maintenance.\n"
        "\n"
        "DEFECT-SPECIFIC CONTEXT:\n"
        "- Defect: " + fault + "\n"
        "- Expected Urgency Threshold: " + str(defect_info.get("urgency_threshold", "N/A")) + "\n"
        "- Safety Risk Level: " + defect_info.get("safety_risk", "Unknown") + "\n"
        "- Typical Maintenance Actions: " + defect_info.get("typical_actions", "Unknown") + "\n"
        "- Critical Inspection Points: " + defect_info.get("inspection_focus", "Unknown") + "\n"
        "\n"
        "OUTPUT FORMAT (STRICTLY FOLLOW):\n"
        "Use GitHub-flavored Markdown. No preamble, no greeting, no emojis.\n"
        "Section headings must be exactly as shown. Keep it SHORT and actionable.\n"
        "\n"
        "## Summary\n"
        "| Field | Value |\n"
        "|-------|-------|\n"
        "| **Panel ID** | " + panel_id + " |\n"
        "| **Defect Detected** | " + fault + " |\n"
        "| **Model Confidence** | {:.1%} |\n".format(confidence) +
        "| **Urgency Level** | " + urgency_level + " |\n"
        "| **Action Required** | " + action_required + " |\n"
        "\n"
        "## Root Cause Analysis\n"
        "Write 2-4 short bullet points explaining the most likely cause.\n"
        "If the knowledge base does not contain enough specifics, write generic but safe causes (e.g., soiling, shading, mismatch, connector issues) and label them as 'Possible causes'.\n"
        "\n"
        "## Recommendations\n"
        "Write 3-6 short bullet points of actions (simple and practical).\n"
        "No long explanations. No SOP steps. No extra sections.\n"
        "Do not output the phrase 'Not found in retrieved knowledge'.\n"
        "\n"
        "---\n\n"
        "RETRIEVED KNOWLEDGE BASE (Use these facts only):\n"
        f"{rag_context}\n"
    )

def _determine_urgency(defect: str, confidence: float, defect_info: Dict[str, Any]) -> str:
    """Determine urgency level based on defect type and confidence"""
    threshold = defect_info.get("urgency_threshold", 0.6)
    
    if defect in ("Electrical-damage", "Physical-Damage"):
        return "🔴 CRITICAL - Immediate action required"
    elif defect == "Snow-Covered":
        return "🟡 MEDIUM - Monitor and plan removal"
    elif defect == "Bird-drop":
        return "🟠 HIGH - Schedule maintenance within 24-48 hours"
    elif defect == "Dusty":
        return "🟡 MEDIUM - Schedule cleaning within 1-2 weeks"
    else:
        return "🟢 LOW - Continue normal operation"

def generate_recommendation(*, model_output: Dict[str, Any], rag_context: str, max_output_tokens: int = 2500) -> str:
    """Generate recommendation using Gemini API"""
    api_keys = _get_api_keys()
    if not api_keys:
        raise RuntimeError("No GEMINI_API_KEY found in environment")
    
    model = _pick_model()
    prompt = build_prompt(model_output=model_output, rag_context=rag_context)
    
    last_error: Exception | None = None
    
    for api_key in api_keys:
        try:
            genai.configure(api_key=api_key)
            client = genai.GenerativeModel(model)
            response = client.generate_content(prompt, stream=False)
            return response.text
            
        except StopCandidateException as e:
            last_error = e
            print(f"⚠️  Gemini safety filter blocked response: {e}")
            continue
            
        except Exception as e:
            error_str = str(e)
            status_code = None
            
            if hasattr(e, "status_code"):
                status_code = e.status_code
            
            if status_code in TRANSIENT_STATUS_CODES or "429" in error_str or "503" in error_str:
                retry_delay = _parse_retry_delay_seconds(error_str) if status_code == 429 else 60
                last_error = GeminiRateLimit(retry_after_seconds=retry_delay or 60)
                print(f"⚠️  Rate limited, retrying with next key...")
                continue
            
            last_error = e
            print(f"❌ Gemini error with key: {e}")
            continue
    
    if isinstance(last_error, GeminiRateLimit):
        raise last_error
    
    raise RuntimeError(f"All Gemini API keys failed. Last error: {last_error}")


def build_maintenance_prompt(*, model_output: Dict[str, Any], rag_context: str) -> str:
    defect = str(model_output.get("primary_defect") or "").strip() or "Unknown"
    confidence = float(model_output.get("confidence") or 0)
    panel_id = str(model_output.get("panel_id") or "Unknown")
    urgency = _determine_urgency(defect, confidence, {})

    return (
        "You are an expert solar PV maintenance planner.\n"
        "Generate a SHORT, actionable maintenance plan based strictly on the retrieved knowledge.\n"
        "If the knowledge is not specific enough, provide safe generic best-practice steps.\n"
        "No greeting, no emojis. Output GitHub-flavored Markdown only.\n"
        "\n"
        f"PANEL ID: {panel_id}\n"
        f"DEFECT: {defect}\n"
        f"MODEL CONFIDENCE: {confidence:.1%}\n"
        f"URGENCY: {urgency}\n"
        "\n"
        "OUTPUT FORMAT (STRICT):\n"
        "## Summary\n"
        "| Field | Value |\n"
        "|-------|-------|\n"
        f"| **Panel ID** | {panel_id} |\n"
        f"| **Defect** | {defect} |\n"
        f"| **Confidence** | {confidence:.1%} |\n"
        f"| **Urgency** | {urgency} |\n"
        "\n"
        "## Maintenance Actions\n"
        "Write 4-8 bullet points of actions (short).\n"
        "\n"
        "## Safety\n"
        "Write 2-4 bullet points.\n"
        "\n"
        "## Materials / Tools\n"
        "Write 3-6 bullet points.\n"
        "\n"
        "## Verification\n"
        "Write 3-6 bullet points to confirm the fix (visual + basic electrical checks).\n"
        "\n"
        "---\n\n"
        "RETRIEVED KNOWLEDGE BASE (Use these facts only):\n"
        f"{rag_context}\n"
    )


def generate_maintenance_plan(*, model_output: Dict[str, Any], rag_context: str) -> str:
    api_keys = _get_api_keys()
    if not api_keys:
        raise RuntimeError("No GEMINI_API_KEY found in environment")

    model = _pick_model()
    prompt = build_maintenance_prompt(model_output=model_output, rag_context=rag_context)

    last_error: Exception | None = None
    for api_key in api_keys:
        try:
            genai.configure(api_key=api_key)
            client = genai.GenerativeModel(model)
            response = client.generate_content(prompt, stream=False)
            return response.text
        except StopCandidateException as e:
            last_error = e
            print(f"⚠️  Gemini safety filter blocked response: {e}")
            continue
        except Exception as e:
            error_str = str(e)
            status_code = getattr(e, "status_code", None)
            if status_code in TRANSIENT_STATUS_CODES or "429" in error_str or "503" in error_str:
                retry_delay = _parse_retry_delay_seconds(error_str) if status_code == 429 else 60
                last_error = GeminiRateLimit(retry_after_seconds=retry_delay or 60)
                continue
            last_error = e
            continue

    if isinstance(last_error, GeminiRateLimit):
        raise last_error

    raise RuntimeError(f"All Gemini API keys failed. Last error: {last_error}")

# ==================== FASTAPI SETUP ====================

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

# ESP32-CAM configuration
def _get_esp32_cam_url() -> str:
    raw = (os.getenv("ESP32_CAM_URL") or "http://10.86.72.244/")
    # Guard against accidental newline/comment pollution in .env
    first_line = raw.splitlines()[0].strip()
    if "#" in first_line:
        first_line = first_line.split("#", 1)[0].strip()
    # Also drop any trailing whitespace-separated tokens
    first_token = first_line.split()[0] if first_line else ""
    return first_token

AWS_API_ENDPOINT = os.getenv("AWS_API_ENDPOINT", "https://j8ql0tblwb.execute-api.us-east-1.amazonaws.com/prod/values")
AWS_SOLAR_HISTORY_ENDPOINT = os.getenv(
    "AWS_SOLAR_HISTORY_ENDPOINT",
    "https://tm6scx17o3.execute-api.us-east-1.amazonaws.com/solar-history",
)

def _esp32_candidate_urls(url: str) -> list[str]:
    raw = (url or "").strip()
    if not raw:
        return []

    p = urlparse(raw)
    if not p.scheme:
        p = urlparse("http://" + raw)

    # Normalize path for common firmwares:
    # - http://ip/
    # - http://ip/capture
    path = p.path or "/"
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    base_path = "/" if path in ("", "/") else path

    base = urlunparse((p.scheme, p.netloc, base_path, "", "", ""))
    base_slash = base if base.endswith("/") else base + "/"
    capture = base if base_path.endswith("/capture") else base_slash + "capture"

    candidates: list[str] = []
    # Prefer /capture (often the only endpoint that returns an image)
    if capture not in candidates:
        candidates.append(capture)
    # Only try the raw URL if it is different from /capture
    if raw and raw != capture and raw not in candidates:
        candidates.append(raw)
    # Only try base '/' when the provided URL was not already a specific path
    if base_path in ("", "/") and base_slash not in candidates:
        candidates.append(base_slash)
    return candidates


@app.get("/api/camera/feed")
def camera_feed(url: str = Query("")):
    """Proxy endpoint to fetch a single image from ESP32-CAM for the frontend.

    The frontend uses this to avoid mixed-content/CORS issues when loading images.
    """
    target = (url or "").strip() or _get_esp32_cam_url()

    timeout_s = float(os.getenv("ESP32_TIMEOUT_SECONDS", "5") or "5")
    last_error: Exception | None = None

    for candidate in _esp32_candidate_urls(target):
        try:
            print(f"📷 Camera feed fetch: {candidate}")
            r = requests.get(candidate, timeout=timeout_s)
            r.raise_for_status()

            content_type = (r.headers.get("content-type") or "").lower()
            body = r.content or b""
            is_jpeg = body.startswith(b"\xff\xd8\xff")
            is_png = body.startswith(b"\x89PNG\r\n\x1a\n")

            if not ("image/" in content_type or is_jpeg or is_png):
                raise requests.exceptions.RequestException(
                    f"Camera response is not an image (content-type={content_type or 'unknown'}, size={len(body)})"
                )

            media_type = content_type if "image/" in content_type else ("image/png" if is_png else "image/jpeg")
            return Response(content=body, media_type=media_type)
        except requests.exceptions.RequestException as e:
            last_error = e
            continue

    # Fall back to the same fallback image used by analysis
    print(f"⚠️  Camera feed unavailable: {last_error}")
    if FALLBACK_IMAGE_PATH.exists():
        return Response(content=FALLBACK_IMAGE_PATH.read_bytes(), media_type="image/png")

    raise HTTPException(status_code=503, detail="Camera feed unavailable and fallback image missing")

def _get_esp32_image() -> bytes:
    """Try to get image from ESP32, fallback to image.png if unavailable"""
    last_error: Exception | None = None

    timeout_s = float(os.getenv("ESP32_TIMEOUT_SECONDS", "5") or "5")

    for candidate in _esp32_candidate_urls(_get_esp32_cam_url()):
        try:
            print(f"📸 Attempting to fetch from ESP32: {candidate}")
            r = requests.get(candidate, timeout=timeout_s)
            r.raise_for_status()
            content_type = (r.headers.get("content-type") or "").lower()
            body = r.content or b""
            is_jpeg = body.startswith(b"\xff\xd8\xff")
            is_png = body.startswith(b"\x89PNG\r\n\x1a\n")
            if not ("image/" in content_type or is_jpeg or is_png):
                raise requests.exceptions.RequestException(
                    f"ESP32 response is not an image (content-type={content_type or 'unknown'}, size={len(body)})"
                )
            print("✅ Image fetched from ESP32-CAM")
            return body
        except requests.exceptions.RequestException as e:
            last_error = e
            print(f"⚠️  ESP32 candidate failed: {candidate} -> {e}")
            continue

    print(f"⚠️  ESP32-CAM unavailable: {last_error}")
    print(f"📁 Falling back to image.png")

    if FALLBACK_IMAGE_PATH.exists():
        with open(FALLBACK_IMAGE_PATH, "rb") as f:
            print("✅ Image loaded from fallback image.png")
            return f.read()

    raise HTTPException(
        status_code=502,
        detail=f"ESP32-CAM unavailable and fallback image not found at {FALLBACK_IMAGE_PATH}",
    )

@app.on_event("startup")
def _startup() -> None:
    ensure_ingested(store)

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
    app.mount("/captures", StaticFiles(directory=str(CAPTURE_DIR)), name="captures")

@app.get("/")
def index() -> FileResponse:
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=500, detail="frontend/index.html not found")
    return FileResponse(str(index_path))

# ==================== PANEL READINGS ENDPOINT ====================

@app.get("/api/panel/readings")
def get_panel_readings(panel_id: str = Query(""), panelId: str = Query("")):
    """Fetch real sensor readings from AWS SiteWise"""
    panel_id = (panel_id or "").strip() or (panelId or "").strip() or "SP-001"
    try:
        now = time.time()
        cached = _READINGS_CACHE.get(panel_id)
        if cached and (now - float(cached.get("ts", 0))) < 5:
            return cached.get("data")

        print(f"📡 Fetching sensor data from AWS API: {AWS_API_ENDPOINT}")
        
        # Fetch from AWS with proper error handling
        response = requests.get(AWS_API_ENDPOINT, timeout=(2, 4))
        response.raise_for_status()
        data = response.json()
        
        print(f"✅ Real sensor data received from AWS API")
        print(f"Data: {data}")
        
        # Extract voltage values
        v1_value = data.get("V1", {}).get("value", 0) if isinstance(data.get("V1"), dict) else data.get("V1", 0)
        v2_value = data.get("V2", {}).get("value", 0) if isinstance(data.get("V2"), dict) else data.get("V2", 0)
        v3_value = data.get("V3", {}).get("value", 0) if isinstance(data.get("V3"), dict) else data.get("V3", 0)
        
        # Extract power values
        p1_value = data.get("P1", {}).get("value", 0) if isinstance(data.get("P1"), dict) else data.get("P1", 0)
        p2_value = data.get("P2", {}).get("value", 0) if isinstance(data.get("P2"), dict) else data.get("P2", 0)
        p3_value = data.get("P3", {}).get("value", 0) if isinstance(data.get("P3"), dict) else data.get("P3", 0)
        
        # Extract current value
        current_value = data.get("I", {}).get("value", 0) if isinstance(data.get("I"), dict) else data.get("I", 0)
        
        payload = {
            "panel_id": panel_id,
            "voltage": {
                "V1": float(v1_value),
                "V2": float(v2_value),
                "V3": float(v3_value)
            },
            "current": float(current_value),
            "power": {
                "P1": float(p1_value),
                "P2": float(p2_value),
                "P3": float(p3_value)
            },
            "timestamp": datetime.now().isoformat(),
            "alert": float(v1_value) > 4.0
        }

        _READINGS_CACHE[panel_id] = {"ts": now, "data": payload}
        return payload
    except requests.exceptions.Timeout:
        print(f"⏱️ AWS API timeout, using fallback data")
        payload = {
            "panel_id": panel_id,
            "voltage": {"V1": 6.18, "V2": 7.17, "V3": 16.5},
            "current": 323.0,
            "power": {"P1": -2.89, "P2": -3.35, "P3": -7.71},
            "timestamp": datetime.now().isoformat(),
            "alert": False
        }
        _READINGS_CACHE[panel_id] = {"ts": time.time(), "data": payload}
        return payload
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching from AWS API: {e}")
        cached = _READINGS_CACHE.get(panel_id)
        if cached and cached.get("data"):
            return cached.get("data")
        # Return fallback data on error
        payload = {
            "panel_id": panel_id,
            "voltage": {"V1": 6.18, "V2": 7.17, "V3": 16.5},
            "current": 323.0,
            "power": {"P1": -2.89, "P2": -3.35, "P3": -7.71},
            "timestamp": datetime.now().isoformat(),
            "alert": False
        }
        _READINGS_CACHE[panel_id] = {"ts": time.time(), "data": payload}
        return payload
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        cached = _READINGS_CACHE.get(panel_id)
        if cached and cached.get("data"):
            return cached.get("data")
        return {
            "panel_id": panel_id,
            "voltage": {"V1": 0, "V2": 0, "V3": 0},
            "current": 0,
            "power": {"P1": 0, "P2": 0, "P3": 0},
            "timestamp": datetime.now().isoformat(),
            "alert": False
        }

@app.get("/api/panel/info")
def get_panel_info(panel_id: str = Query(""), panelId: str = Query("")):
    """Get panel information and check if analysis is needed"""
    panel_id = (panel_id or "").strip() or (panelId or "").strip() or "SP-001"
    try:
        # Get sensor readings
        readings = get_panel_readings(panel_id)
        
        v1_value = readings.get("voltage", {}).get("V1", 0)
        
        if v1_value > 4.0:
            print(f"🚨 ALERT: V1 ({v1_value}V) > 4V threshold!")
            return {
                "panel_id": panel_id,
                "status": "alert",
                "message": f"V1 voltage ({v1_value}V) exceeds 4V threshold - TRIGGERING ANALYSIS",
                "voltage": readings.get("voltage"),
                "current": readings.get("current"),
                "power": readings.get("power"),
                "requires_analysis": True,
                "timestamp": readings.get("timestamp")
            }
        else:
            return {
                "panel_id": panel_id,
                "status": "normal",
                "message": f"V1 voltage ({v1_value}V) is within safe limits",
                "voltage": readings.get("voltage"),
                "current": readings.get("current"),
                "power": readings.get("power"),
                "requires_analysis": False,
                "timestamp": readings.get("timestamp")
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get panel info: {e}")


@app.get("/api/solar-history")
def get_solar_history(assetId: str = Query("SolarPanel_01")):
    """Proxy historical solar panel data from AWS API Gateway to avoid browser CORS."""
    asset_id = (assetId or "").strip() or "SolarPanel_01"
    try:
        resp = requests.get(
            AWS_SOLAR_HISTORY_ENDPOINT,
            params={"assetId": asset_id},
            timeout=10,
        )

        if resp.status_code >= 400:
            raise HTTPException(
                status_code=resp.status_code,
                detail={
                    "error": "AWS solar-history returned error",
                    "status": resp.status_code,
                    "body": resp.text,
                },
            )

        try:
            data = resp.json()
        except Exception:
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "AWS solar-history response was not valid JSON",
                    "status": resp.status_code,
                    "body": resp.text,
                },
            )

        if not isinstance(data, list):
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Unexpected solar-history response",
                    "message": "Expected a JSON array",
                    "received_type": str(type(data)),
                },
            )

        return data
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail={"error": "AWS solar-history timeout"})
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail={"error": "Failed to fetch solar-history", "message": str(e)})

@app.post("/api/panel/auto-analyze")
async def auto_analyze(panel_id: str = Query("SP-001")):
    """
    Automatic workflow:
    1. Get sensor readings
    2. Check if V1 > 4V
    3. If yes, capture image and analyze
    4. Return full health report
    """
    try:
        print(f"\n{'='*60}")
        print(f"🔄 STARTING AUTOMATIC ANALYSIS FOR PANEL: {panel_id}")
        print(f"{'='*60}\n")
        
        # Step 1: Get sensor readings
        print("📊 Step 1: Fetching sensor readings from AWS...")
        readings = get_panel_readings(panel_id)
        v1_value = readings.get("voltage", {}).get("V1", 0)
        
        print(f"✅ V1 Voltage: {v1_value}V")
        
        # Step 2: Check threshold
        if v1_value <= 4.0:
            print(f"✅ V1 ({v1_value}V) is within safe limits. No analysis needed.")
            return {
                "status": "normal",
                "panel_id": panel_id,
                "message": f"V1 voltage ({v1_value}V) is within safe limits",
                "voltage_data": readings,
                "analysis_triggered": False,
                "timestamp": datetime.now().isoformat()
            }
        
        print(f"🚨 ALERT: V1 ({v1_value}V) > 4V - ANALYSIS TRIGGERED!")
        
        # Step 2: Capture image
        print("\n📸 Step 2: Capturing image...")
        image_bytes = _get_esp32_image()
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"panel_{panel_id}_{timestamp}.jpg"
        file_path = CAPTURE_DIR / filename
        
        with open(file_path, "wb") as f:
            f.write(image_bytes)
        
        print(f"✅ Image saved: {filename}")
        
        # Step 3: ONNX inference
        print("\n🤖 Step 3: Running ONNX model inference...")
        if not Path(MODEL_PATH).exists():
            raise HTTPException(status_code=500, detail=f"ONNX model not found at: {MODEL_PATH}")
        
        try:
            fault, confidence, top = predict_image_bytes(model_path=MODEL_PATH, image_bytes=image_bytes)
            print(f"✅ Inference complete: {fault} (confidence: {confidence:.1%})")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ONNX inference failed: {e}")

        fault_display: str | None
        if str(fault or "").strip().lower() == "clean":
            fault_display = None
        else:
            fault_display = str(fault)
        
        model_output = {
            "primary_defect": fault,
            "confidence": confidence,
            "top_predictions": top,
            "panel_id": panel_id
        }
        
        # Step 4: RAG retrieval
        print("\n📚 Step 4: Retrieving context from knowledge base...")
        rag_query, rag_context = retrieve_context_from_model_output(store=store, model_output=model_output, k=3)
        
        if not rag_context:
            raise HTTPException(status_code=500, detail="RAG retrieval returned empty context")
        
        print(f"✅ Retrieved {len(rag_context)} characters of context")
        
        # Step 5: Gemini AI recommendation
        print("\n🤖 Step 5: Generating AI health report via Gemini...")
        now = time.time()
        cached = _GEMINI_CACHE.get(panel_id)
        cooldown_seconds = _get_gemini_cooldown_seconds()
        if cached and (now - float(cached.get("ts", 0))) < cooldown_seconds:
            suggestion = str(cached.get("suggestion") or "")
            gemini_error = cached.get("gemini_error")
            remaining = int(max(0, cooldown_seconds - (now - float(cached.get("ts", 0)))))
            print(f"⏳ Gemini cooldown active ({remaining}s remaining). Reusing cached result.")
        else:
            try:
                suggestion = generate_recommendation(model_output=model_output, rag_context=rag_context)
                print(f"✅ Health report generated successfully")
                gemini_error: str | None = None
            except GeminiRateLimit as e:
                suggestion = ""
                gemini_error = f"Gemini is rate-limited. Please retry after {int(e.retry_after_seconds)} seconds."
                print(f"⚠️  {gemini_error}")
            except Exception as e:
                suggestion = ""
                gemini_error = f"Gemini call failed: {e}"
                print(f"⚠️  {gemini_error}")

            _GEMINI_CACHE[panel_id] = {
                "ts": now,
                "suggestion": suggestion,
                "gemini_error": gemini_error,
            }
        
        print(f"\n{'='*60}")
        print(f"✅ ANALYSIS COMPLETE FOR PANEL: {panel_id}")
        print(f"{'='*60}\n")
        
        health_report = {
            "status": "analyzed",
            "analysis_triggered": True,
            "panel_id": panel_id,
            "timestamp": datetime.now().isoformat(),
            
            # Voltage data that triggered analysis
            "voltage_trigger": {
                "v1_value": v1_value,
                "threshold": 4.0,
                "status": "EXCEEDED",
                "message": f"V1 ({v1_value}V) > 4V threshold"
            },
            
            # Image information
            "image": {
                "filename": filename,
                "url": f"/captures/{filename}",
                "timestamp": timestamp
            },
            
            # AI defect analysis
            "defect_analysis": {
                "defect": fault_display,
                "confidence": float(confidence),
                "top_predictions": top
            },
            
            # Knowledge base context
            "knowledge_context": rag_context,
            
            # AI health report
            "health_report": suggestion,
            "gemini_error": gemini_error,
            
            # All sensor data
            "sensor_data": readings
        }
        
        return health_report
        
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"\n❌ ANALYSIS FAILED: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


@app.get("/api/panel/health-report")
async def get_health_report(panel_id: str = Query(""), panelId: str = Query("")):
    pid = (panel_id or "").strip() or (panelId or "").strip() or "SP-001"
    return await auto_analyze(panel_id=pid)


@app.post("/api/panel/maintenance-plan")
async def maintenance_plan(panel_id: str = Query(""), panelId: str = Query("")):
    pid = (panel_id or "").strip() or (panelId or "").strip() or "SP-001"
    try:
        image_bytes = _get_esp32_image()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"panel_{pid}_{timestamp}.jpg"
        file_path = CAPTURE_DIR / filename
        with open(file_path, "wb") as f:
            f.write(image_bytes)

        if not Path(MODEL_PATH).exists():
            raise HTTPException(status_code=500, detail=f"ONNX model not found at: {MODEL_PATH}")

        fault, confidence, top = predict_image_bytes(model_path=MODEL_PATH, image_bytes=image_bytes)
        defect = str(fault or "").strip()
        conf = float(confidence or 0)

        if defect.lower() == "clean" and conf >= 0.9:
            return {
                "status": "no_maintenance",
                "panel_id": pid,
                "timestamp": datetime.now().isoformat(),
                "image": {"filename": filename, "url": f"/captures/{filename}", "timestamp": timestamp},
                "defect_analysis": {"defect": None, "confidence": conf, "top_predictions": top},
                "maintenance_plan": "## Summary\n\nNo maintenance required. Continue monitoring and follow routine cleaning schedule.\n",
            }

        model_output = {
            "primary_defect": defect,
            "confidence": conf,
            "top_predictions": top,
            "panel_id": pid,
        }

        rag_query, rag_context = retrieve_context_from_model_output(store=store, model_output=model_output, k=3)
        if not rag_context:
            raise HTTPException(status_code=500, detail="RAG retrieval returned empty context")

        now = time.time()
        cache_key = f"maintenance::{pid}"
        cached = _GEMINI_CACHE.get(cache_key)
        cooldown_seconds = _get_gemini_cooldown_seconds()
        if cached and (now - float(cached.get("ts", 0))) < cooldown_seconds:
            plan_md = str(cached.get("suggestion") or "")
            gemini_error = cached.get("gemini_error")
        else:
            try:
                plan_md = generate_maintenance_plan(model_output=model_output, rag_context=rag_context)
                gemini_error = None
            except GeminiRateLimit as e:
                plan_md = ""
                gemini_error = f"Gemini is rate-limited. Please retry after {int(e.retry_after_seconds)} seconds."
            except Exception as e:
                plan_md = ""
                gemini_error = f"Gemini call failed: {e}"

            _GEMINI_CACHE[cache_key] = {"ts": now, "suggestion": plan_md, "gemini_error": gemini_error}

        return {
            "status": "maintenance_generated",
            "panel_id": pid,
            "timestamp": datetime.now().isoformat(),
            "image": {"filename": filename, "url": f"/captures/{filename}", "timestamp": timestamp},
            "defect_analysis": {"defect": defect, "confidence": conf, "top_predictions": top},
            "knowledge_context": rag_context,
            "maintenance_plan": plan_md,
            "gemini_error": gemini_error,
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate maintenance plan: {e}")

@app.get("/api/workflow/status")
def get_workflow_status():
    """Get current workflow status"""
    return {
        "backend": "online",
        "ml_model": Path(MODEL_PATH).exists(),
        "rag_store": store is not None,
        "capture_dir": CAPTURE_DIR.exists(),
        "esp32_url": ESP32_CAM_URL,
        "aws_api": AWS_API_ENDPOINT,
        "captures_count": len(list(CAPTURE_DIR.glob("*.jpg")))
    }

@app.get("/api/diagnostic")
def diagnostic():
    """Diagnostic endpoint to check all components"""
    diagnostics = {
        "model_path": MODEL_PATH,
        "model_exists": Path(MODEL_PATH).exists(),
        "capture_dir_exists": CAPTURE_DIR.exists(),
        "rag_store_initialized": store is not None,
        "gemini_api_key_set": bool(os.getenv("GEMINI_API_KEY")),
        "esp32_url": ESP32_CAM_URL,
        "aws_api": AWS_API_ENDPOINT,
        "fallback_image_exists": FALLBACK_IMAGE_PATH.exists()
    }
    
    return diagnostics


@app.get("/api/weather/wardha")
def get_wardha_weather():
    api_key = (os.getenv("OPENWEATHER_API_KEY") or "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENWEATHER_API_KEY is not set")

    cache_key = "wardha"
    now = time.time()
    cached = _WEATHER_CACHE.get(cache_key)
    if cached and (now - float(cached.get("ts", 0))) < 60:
        return cached.get("data")

    lat = float(os.getenv("WARDHA_LAT", "20.7453") or "20.7453")
    lon = float(os.getenv("WARDHA_LON", "78.6022") or "78.6022")

    url = "https://api.openweathermap.org/data/2.5/weather"
    try:
        r = requests.get(
            url,
            params={
                "lat": lat,
                "lon": lon,
                "appid": api_key,
                "units": "metric",
            },
            timeout=10,
        )
        r.raise_for_status()
        payload = r.json() or {}

        main = payload.get("main") or {}
        weather_list = payload.get("weather") or []
        w0 = weather_list[0] if isinstance(weather_list, list) and weather_list else {}

        data = {
            "city": (payload.get("name") or "Wardha"),
            "condition": (w0.get("description") or w0.get("main") or "—"),
            "temperature_c": main.get("temp"),
            "humidity_percent": main.get("humidity"),
            "timestamp": datetime.now().isoformat(),
        }

        _WEATHER_CACHE[cache_key] = {"ts": now, "data": data}
        return data
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"OpenWeather request failed: {e}")
