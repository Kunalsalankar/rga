# Solar Panel Health Report Dashboard

A comprehensive solar panel health monitoring dashboard with AI-powered defect detection, real-time readings, predictive maintenance, and digital twin visualization.

## Features

- **Real-Time Monitoring**: Live readings of current (A), voltage (V), and temperature (°C)
- **AI Defect Detection**: Upload panel images to detect:
  - Microcracks
  - Diode failures
  - Hotspots
  - Dust accumulation
  - Bird droppings
- **Panel Comparison**: Compare installation ratings vs current ratings with health score
- **Predictive Maintenance**: AI-powered maintenance recommendations and efficiency predictions
- **Digital Twin**: 3D visualization of panel status (placeholder for Three.js integration)
- **Historical Data**: Charts showing trends over time

## Technology Stack

### Backend
- Python 3.8+
- Flask (REST API)
- OpenCV (Image processing)
- NumPy (Data processing)
- PIL/Pillow (Image handling)

### Frontend
- React 18
- Material-UI (MUI)
- Recharts (Data visualization)
- Axios (HTTP client)

## Installation

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the backend server:
```bash
python app.py
```

The backend API will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Usage

1. Start both backend and frontend servers
2. Open your browser to `http://localhost:3000`
3. View real-time panel readings (auto-updates every 5 seconds)
4. Upload a panel image for defect detection
5. Check predictive maintenance recommendations
6. Click "Digital Twin" button for 3D visualization view

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/panel/current-reading` - Get current readings
- `GET /api/panel/info` - Get panel information
- `POST /api/panel/defect-detect` - Upload image for defect detection
- `GET /api/panel/history` - Get historical readings
- `GET /api/panel/defects` - Get defect history
- `GET /api/panel/predictive-maintenance` - Get maintenance predictions

## Defect Detection

The AI model uses computer vision techniques to detect:
- **Microcracks**: Linear patterns using edge detection
- **Hotspots**: Dark/bright regions indicating thermal issues
- **Diode failures**: Dark spots in specific patterns
- **Dust**: Small irregular shapes
- **Bird droppings**: Larger circular/irregular shapes

Note: The current implementation uses rule-based detection. For production, integrate a trained machine learning model (e.g., TensorFlow/PyTorch CNN).

## Future Enhancements

- Integrate trained ML models for more accurate defect detection
- Connect to actual IoT sensors for real-time data
- Implement database for data persistence
- Add Three.js for interactive 3D digital twin
- Add user authentication and multi-panel support
- Export reports as PDF
- Mobile app integration
- Alert notifications system

## License

MIT License

# solar-dashboard
solar dashboard
