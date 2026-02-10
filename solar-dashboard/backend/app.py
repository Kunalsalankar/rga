import sys
import os
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import requests
from dotenv import load_dotenv
from datetime import datetime, timedelta
from defect_detector import DefectDetector
from pathlib import Path
from urllib.parse import urlparse, urlunparse

# Load environment variables from .env files (prefer repo root)
_HERE = Path(__file__).resolve()
load_dotenv(_HERE.parent / ".env")
load_dotenv(_HERE.parents[1] / ".env")
load_dotenv(_HERE.parents[2] / ".env")
load_dotenv(_HERE.parents[3] / ".env")
load_dotenv()

# Add parent directory to path to import rag_module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# AWS API endpoint for sensor data
AWS_API_ENDPOINT = "https://j8ql0tblwb.execute-api.us-east-1.amazonaws.com/prod/values"
ASSET_ID = "cd29fe97-2d5e-47b4-a951-04c9e29544ac"

# FastAPI (YOLOv8 + RAG + Gemini) backend base URL
FASTAPI_BACKEND_URL = os.getenv("FASTAPI_BACKEND_URL", "http://localhost:8000")

WARDHA_LAT = 20.7453
WARDHA_LON = 78.6022

# Dummy panel data
DUMMY_PANELS = [
    {
        "id": "SP-001",
        "name": "Solar Panel 1",
        "location": "Roof A",
        "capacity": 400,
        "current_output": 320,
        "health_score": 96,
        "last_update": datetime.now().isoformat()
    },
    {
        "id": "SP-002",
        "name": "Solar Panel 2",
        "location": "Roof B",
        "capacity": 400,
        "current_output": 380,
        "health_score": 98,
        "last_update": datetime.now().isoformat()
    },
    {
        "id": "SP-003",
        "name": "Solar Panel 3",
        "location": "Roof C",
        "capacity": 400,
        "current_output": 290,
        "health_score": 95,
        "last_update": datetime.now().isoformat()
    },
    {
        "id": "SP-004",
        "name": "Solar Panel 4",
        "location": "Roof D",
        "capacity": 400,
        "current_output": 150,
        "health_score": 78,
        "last_update": datetime.now().isoformat()
    }
]

# ==================== API ENDPOINTS ====================

@app.route("/", methods=["GET"])
def index():
    """Root endpoint"""
    return jsonify({"message": "Solar Dashboard Backend API", "version": "1.0"}), 200

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "service": "solar-dashboard-backend"}), 200


@app.route("/api/weather/wardha", methods=["GET"])
def get_weather_wardha():
    """Fetch live weather for Wardha using OpenWeather."""
    api_key = os.getenv("OPENWEATHER_API_KEY", "").strip() or request.args.get("appid") or ""
    if not api_key:
        return jsonify({"error": "Missing OPENWEATHER_API_KEY"}), 500

    url = "https://api.openweathermap.org/data/2.5/weather"
    try:
        resp = requests.get(
            url,
            params={"lat": WARDHA_LAT, "lon": WARDHA_LON, "appid": api_key, "units": "metric"},
            timeout=10,
        )
        if resp.status_code >= 400:
            return jsonify({"error": "OpenWeather returned error", "status": resp.status_code, "body": resp.text}), resp.status_code
        data = resp.json()

        main = data.get("main") or {}
        weather0 = (data.get("weather") or [{}])[0] or {}
        wind = data.get("wind") or {}

        return (
            jsonify(
                {
                    "city": "Wardha",
                    "temperature_c": main.get("temp"),
                    "humidity_percent": main.get("humidity"),
                    "pressure_hpa": main.get("pressure"),
                    "condition": weather0.get("main") or weather0.get("description"),
                    "wind_mps": wind.get("speed"),
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            200,
        )
    except requests.exceptions.Timeout:
        return jsonify({"error": "OpenWeather timeout"}), 504
    except Exception as e:
        return jsonify({"error": "Failed to fetch weather", "message": str(e)}), 502

@app.route("/api/panels/all", methods=["GET"])
def get_all_panels():
    """Get all solar panels"""
    try:
        return jsonify(DUMMY_PANELS), 200
    except Exception as e:
        print(f"❌ Error fetching panels: {e}")
        return jsonify({"error": "Failed to fetch panels", "message": str(e)}), 500

@app.route("/api/panel/info", methods=["GET"])
def get_panel_info():
    """Get panel information"""
    try:
        panel_id = request.args.get("panelId", "SP-001")
        
        # Find panel by ID
        panel = next((p for p in DUMMY_PANELS if p["id"] == panel_id), None)
        
        if panel:
            return jsonify(panel), 200
        else:
            return jsonify({"error": "Panel not found"}), 404
            
    except Exception as e:
        print(f"❌ Error fetching panel info: {e}")
        return jsonify({"error": "Failed to fetch panel info", "message": str(e)}), 500

@app.route("/api/panel/readings", methods=["GET"])
def get_panel_readings():
    """Get real-time sensor readings from AWS API"""
    try:
        asset_id = request.args.get("assetId", ASSET_ID)
        
        print(f"📡 Fetching sensor data from AWS API: {AWS_API_ENDPOINT}")
        
        # Fetch from AWS API (no asset_id parameter needed for new endpoint)
        response = requests.get(
            AWS_API_ENDPOINT,
            timeout=5
        )
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Real sensor data received from AWS API")
        print(f"Data: {data}")
        
        # Return the data directly (new format has no nested structure)
        return jsonify(data), 200
        
    except requests.exceptions.Timeout:
        print(f"⏱️ AWS API timeout, using dummy data")
        dummy_sensor_data = _get_dummy_sensor_data(asset_id)
        return jsonify(dummy_sensor_data), 200
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching from AWS API: {e}")
        dummy_sensor_data = _get_dummy_sensor_data(asset_id)
        return jsonify(dummy_sensor_data), 200


@app.route("/api/panel/health-report", methods=["GET"])
def get_panel_health_report():
    """Generate/Fetch health report from FastAPI (YOLOv8 + RAG + Gemini) backend."""
    panel_id = request.args.get("panel_id") or request.args.get("panelId") or "SP-001"

    try:
        url = f"{FASTAPI_BACKEND_URL.rstrip('/')}/api/panel/auto-analyze"
        print(f"🤖 Proxying health report request to FastAPI: {url} (panel_id={panel_id})")

        resp = requests.post(url, params={"panel_id": panel_id}, timeout=120)
        if resp.status_code >= 400:
            print(f"❌ FastAPI responded with {resp.status_code}: {resp.text[:500]}")
            return (
                jsonify(
                    {
                        "error": "FastAPI returned error",
                        "fastapi_status": resp.status_code,
                        "fastapi_body": resp.text,
                    }
                ),
                resp.status_code,
            )

        try:
            return jsonify(resp.json()), 200
        except Exception:
            return (
                jsonify(
                    {
                        "error": "FastAPI response was not valid JSON",
                        "fastapi_status": resp.status_code,
                        "fastapi_body": resp.text,
                    }
                ),
                502,
            )
    except requests.exceptions.Timeout:
        return jsonify({"error": "FastAPI health report timeout"}), 504
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Cannot connect to FastAPI at {FASTAPI_BACKEND_URL}: {e}")
        return (
            jsonify(
                {
                    "error": "Cannot connect to FastAPI backend",
                    "fastapi_base_url": FASTAPI_BACKEND_URL,
                    "message": str(e),
                }
            ),
            502,
        )
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching health report from FastAPI: {e}")
        status = getattr(getattr(e, "response", None), "status_code", None)
        body = getattr(getattr(e, "response", None), "text", None)
        return (
            jsonify(
                {
                    "error": "Failed to fetch health report from FastAPI",
                    "fastapi_base_url": FASTAPI_BACKEND_URL,
                    "fastapi_status": status,
                    "fastapi_body": body,
                    "message": str(e),
                }
            ),
            502,
        )

def _get_dummy_sensor_data(asset_id):
    """Return dummy sensor data as fallback"""
    return {
        "I1": {"value": 272, "timestamp": 1768827220},
        "I2": {"value": 386, "timestamp": 1768827220},
        "P1": {"value": 1.84, "timestamp": 1768827220},
        "P2": {"value": 1.84, "timestamp": 1768827220},
        "P3": {"value": 2.72, "timestamp": 1768827220},
        "P4": {"value": 2.72, "timestamp": 1768827220},
        "V1": {"value": 6.46, "timestamp": 1768827220},
        "V2": {"value": 7.07, "timestamp": 1768827220},
        "V3": {"value": 7.35, "timestamp": 1768827220},
        "V4": {"value": 6.75, "timestamp": 1768827220}
    }

@app.route("/api/camera/feed", methods=["GET"])
def get_camera_feed():
    """Proxy endpoint to fetch camera feed from ESP32 camera"""
    fallback_path = os.path.join(os.path.dirname(__file__), "image.png")

    def _candidate_camera_urls(raw: str):
        raw = (raw or "").strip()
        if not raw:
            return []

        p = urlparse(raw)
        if not p.scheme:
            p = urlparse("http://" + raw)

        path = p.path or "/"
        if path != "/" and path.endswith("/"):
            path = path[:-1]
        base_path = "/" if path in ("", "/") else path

        base = urlunparse((p.scheme, p.netloc, base_path, "", "", ""))
        base_slash = base if base.endswith("/") else base + "/"

        capture = base if base_path.endswith("/capture") else base_slash + "capture"
        stream = base if base_path.endswith("/stream") else base_slash + "stream"
        jpg = base if base_path.endswith("/jpg") else base_slash + "jpg"

        urls = []
        # Prefer single-image endpoints first
        for u in (capture, jpg, raw, base_slash, stream):
            if u and u not in urls:
                urls.append(u)
        return urls

    def _fallback_image_response():
        try:
            if os.path.exists(fallback_path):
                with open(fallback_path, "rb") as f:
                    return Response(f.read(), mimetype="image/png")
        except Exception as e:
            print(f"❌ Error reading fallback image: {e}")
        return jsonify({"error": "Camera feed unavailable and fallback image missing"}), 503

    try:
        camera_url = request.args.get("url")
        
        if not camera_url:
            return jsonify({"error": "Camera URL parameter is required"}), 400
        
        last_error = None
        for url in _candidate_camera_urls(camera_url):
            try:
                print(f"📷 Fetching camera feed from: {url}")
                response = requests.get(url, timeout=10)
                response.raise_for_status()

                content_type = (response.headers.get("content-type") or "").lower()
                body = response.content or b""
                is_jpeg = body.startswith(b"\xff\xd8\xff")
                is_png = body.startswith(b"\x89PNG\r\n\x1a\n")
                if not ("image/" in content_type or is_jpeg or is_png):
                    raise requests.exceptions.RequestException(
                        f"Camera response is not an image (content-type={content_type or 'unknown'}, size={len(body)})"
                    )

                return Response(body, mimetype=(content_type if "image/" in content_type else "image/jpeg"))
            except requests.exceptions.RequestException as e:
                last_error = e
                continue

        print(f"❌ Cannot fetch image from camera: {last_error}")
        return _fallback_image_response()
        
    except requests.exceptions.Timeout:
        print(f"⏱️ Camera request timeout")
        return _fallback_image_response()
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to camera at {camera_url}")
        return _fallback_image_response()
        
    except Exception as e:
        print(f"❌ Error fetching camera feed: {e}")
        return _fallback_image_response()

if __name__ == "__main__":
    print("🚀 Starting Solar Dashboard Backend...")
    print(f"📡 AWS API Endpoint: {AWS_API_ENDPOINT}")
    print(f"🔑 Asset ID: {ASSET_ID}")
    print("🌐 Server running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)

