import sys
import os
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import requests
from dotenv import load_dotenv
from datetime import datetime, timedelta
from defect_detector import DefectDetector

# Load environment variables from .env file
load_dotenv()

# Add parent directory to path to import rag_module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# AWS API endpoint for sensor data
AWS_API_ENDPOINT = "https://j8ql0tblwb.execute-api.us-east-1.amazonaws.com/prod/values"
ASSET_ID = "cd29fe97-2d5e-47b4-a951-04c9e29544ac"

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
    try:
        camera_url = request.args.get("url")
        
        if not camera_url:
            return jsonify({"error": "Camera URL parameter is required"}), 400
        
        print(f"📷 Fetching camera feed from: {camera_url}")
        
        # Fetch image from camera
        response = requests.get(camera_url, timeout=10)
        response.raise_for_status()
        
        # Return image with appropriate headers
        return Response(response.content, mimetype=response.headers.get('content-type', 'image/jpeg'))
        
    except requests.exceptions.Timeout:
        print(f"⏱️ Camera request timeout")
        return jsonify({"error": "Camera request timeout"}), 504
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to camera at {camera_url}")
        return jsonify({"error": f"Cannot connect to camera. Make sure it's online at {camera_url}"}), 503
        
    except Exception as e:
        print(f"❌ Error fetching camera feed: {e}")
        return jsonify({"error": "Failed to fetch camera feed", "message": str(e)}), 500

if __name__ == "__main__":
    print("🚀 Starting Solar Dashboard Backend...")
    print(f"📡 AWS API Endpoint: {AWS_API_ENDPOINT}")
    print(f"🔑 Asset ID: {ASSET_ID}")
    print("🌐 Server running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)

