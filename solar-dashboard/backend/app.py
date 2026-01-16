import sys
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
from io import BytesIO
from PIL import Image
import requests
from defect_detector import DefectDetector

# Add parent directory to path to import rag_module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize Gemini API
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if GEMINI_API_KEY:
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)

# Initialize defect detector
detector = DefectDetector()

# Generate 1-year power data for Wardha
def generate_yearly_power_data():
    data = []
    base_date = datetime(2024, 1, 1)
    for day in range(365):
        date = base_date + timedelta(days=day)
        # Simulate seasonal variation
        season_factor = 1 + 0.3 * abs((day % 365) - 180) / 180
        daily_power = 1000 * season_factor
        data.append({
            'date': date.isoformat(),
            'power': daily_power
        })
    return data

# Sample panel data storage (in production, use a database)
PANELS = {
    'SP-001': {
        'name': 'Solar Panel 1',
        'location': 'Roof A',
        'capacity': 400,
        'current_output': 320,
        'health_score': 96,
        'last_update': datetime.now().isoformat()
    },
    'SP-002': {
        'name': 'Solar Panel 2',
        'location': 'Roof B',
        'capacity': 400,
        'current_output': 380,
        'health_score': 98,
        'last_update': datetime.now().isoformat()
    },
    'SP-003': {
        'name': 'Solar Panel 3',
        'location': 'Roof C',
        'capacity': 400,
        'current_output': 290,
        'health_score': 95,
        'last_update': datetime.now().isoformat()
    },
    'SP-004': {
        'name': 'Solar Panel 4',
        'location': 'Roof D',
        'capacity': 400,
        'current_output': 150,
        'health_score': 78,
        'last_update': datetime.now().isoformat()
    }
}

# ==================== API ENDPOINTS ====================

@app.route('/api/panel/readings', methods=['GET'])
def get_panel_readings():
    """Proxy endpoint for AWS API"""
    try:
        asset_id = request.args.get('assetId', 'cd29fe97-2d5e-47b4-a951-04c9e29544ac')
        external_api_url = f'https://sacgn6gxpa.execute-api.us-east-1.amazonaws.com/latest?assetId={asset_id}'
        
        response = requests.get(external_api_url, timeout=10)
        response.raise_for_status()
        
        return jsonify(response.json()), 200
    except requests.exceptions.RequestException as e:
        print(f"Error calling external API: {e}")
        return jsonify({'error': 'Failed to fetch panel readings'}), 500

@app.route('/api/panels/all', methods=['GET'])
def get_all_panels():
    """Get all panels"""
    try:
        panels_list = [
            {
                'id': panel_id,
                **panel_data
            }
            for panel_id, panel_data in PANELS.items()
        ]
        return jsonify(panels_list), 200
    except Exception as e:
        print(f"Error fetching panels: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/panel/info', methods=['GET'])
def get_panel_info():
    """Get panel information"""
    try:
        total_capacity = sum(p['capacity'] for p in PANELS.values())
        total_output = sum(p['current_output'] for p in PANELS.values())
        avg_health = sum(p['health_score'] for p in PANELS.values()) / len(PANELS)
        
        return jsonify({
            'total_panels': len(PANELS),
            'total_capacity': total_capacity,
            'total_output': total_output,
            'average_health': round(avg_health, 2),
            'panels': PANELS
        }), 200
    except Exception as e:
        print(f"Error fetching panel info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/panel/history', methods=['GET'])
def get_panel_history():
    """Get panel history"""
    try:
        limit = request.args.get('limit', 50, type=int)
        return jsonify({
            'current': [{'value': 50 - i, 'timestamp': (datetime.now() - timedelta(minutes=i)).isoformat()} for i in range(min(limit, 50))],
            'voltage': [{'value': 240 + i, 'timestamp': (datetime.now() - timedelta(minutes=i)).isoformat()} for i in range(min(limit, 50))],
            'temperature': [{'value': 45 + (i % 10), 'timestamp': (datetime.now() - timedelta(minutes=i)).isoformat()} for i in range(min(limit, 50))]
        }), 200
    except Exception as e:
        print(f"Error fetching history: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/panel/<panel_id>', methods=['GET'])
def get_panel(panel_id):
    """Get specific panel"""
    try:
        if panel_id in PANELS:
            return jsonify({
                'id': panel_id,
                **PANELS[panel_id]
            }), 200
        return jsonify({'error': 'Panel not found'}), 404
    except Exception as e:
        print(f"Error fetching panel: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/panel/<panel_id>/health', methods=['GET'])
def get_panel_health(panel_id):
    """Get panel health details"""
    try:
        if panel_id in PANELS:
            return jsonify({
                'panel_id': panel_id,
                'health_score': PANELS[panel_id]['health_score'],
                'status': 'healthy' if PANELS[panel_id]['health_score'] > 85 else 'warning',
                'last_check': PANELS[panel_id]['last_update']
            }), 200
        return jsonify({'error': 'Panel not found'}), 404
    except Exception as e:
        print(f"Error fetching health: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/overview', methods=['GET'])
def get_system_overview():
    """Get system overview"""
    try:
        yearly_data = generate_yearly_power_data()
        total_output = sum(p['current_output'] for p in PANELS.values())
        
        return jsonify({
            'total_output_kw': round(total_output / 1000, 2),
            'healthy_panels': sum(1 for p in PANELS.values() if p['health_score'] > 90),
            'faulty_panels': sum(1 for p in PANELS.values() if p['health_score'] <= 90),
            'yearly_data': yearly_data
        }), 200
    except Exception as e:
        print(f"Error getting overview: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health-report', methods=['POST'])
def generate_health_report():
    """Generate health report using Gemini AI"""
    try:
        data = request.json
        if not GEMINI_API_KEY:
            return jsonify({'error': 'Gemini API not configured'}), 500
        
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(data.get('prompt', ''))
        
        return jsonify({
            'report': response.text
        }), 200
    except Exception as e:
        print(f"Error generating report: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

