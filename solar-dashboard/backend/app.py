import sys
import os
from flask import Flask, jsonify, request
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
AWS_API_ENDPOINT = "https://sacgn6gxpa.execute-api.us-east-1.amazonaws.com/latest"
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
        
        print(f"📡 Fetching sensor data for asset: {asset_id}")
        
        # Fetch from AWS API
        response = requests.get(
            f"{AWS_API_ENDPOINT}?assetId={asset_id}",
            timeout=5
        )
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Real sensor data received from AWS API")
        print(f"Data: {data}")
        
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
        "assetId": asset_id,
        "data": {
            "V1": {"value": 38.5, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}},
            "V2": {"value": 37.2, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}},
            "V3": {"value": 39.1, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}},
            "V4": {"value": 36.8, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}},
            "P1": {"value": 320, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}},
            "P2": {"value": 315, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}},
            "P3": {"value": 325, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}},
            "P4": {"value": 310, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}},
            "I": {"value": 8.5, "timestamp": {"timeInSeconds": int(datetime.now().timestamp()), "offsetInNanos": 0}}
        }
    }

if __name__ == "__main__":
    print("🚀 Starting Solar Dashboard Backend...")
    print(f"📡 AWS API Endpoint: {AWS_API_ENDPOINT}")
    print(f"🔑 Asset ID: {ASSET_ID}")
    print("🌐 Server running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)

