# Solar Panel Dashboard - Services Setup

This project runs **two separate backend services** that communicate with the React frontend:

## Services Overview

### 1. Flask Backend (Port 5000)
- Handles general API endpoints (panels data, health report, etc.)
- Camera proxy endpoint for ESP32 camera
- File: `app.py`
- Start: `start-backend.bat`

### 2. FastAPI Image Analysis Service (Port 8000)
- Dedicated service for ML model inference
- Image processing and resizing
- RAG context retrieval
- Gemini AI integration
- File: `image_analysis_service.py`
- Start: `start-image-service.bat`

### 3. React Frontend (Port 3000)
- Running on localhost:3000
- Calls Flask on localhost:5000
- Calls FastAPI on localhost:8000

## Installation

### Prerequisites
```bash
# Python 3.10+
python --version

# Node.js 16+
node --version
npm --version
```

### Backend Dependencies

Install Flask dependencies:
```bash
pip install -r requirements.txt
```

Install FastAPI dependencies:
```bash
pip install -r requirements-image-service.txt
```

Environment variables needed:
```bash
# In .env file or system environment
GEMINI_API_KEY=your_gemini_api_key_here
```

## Running the Services

### Option 1: Individual Terminal Windows (Recommended for Development)

**Terminal 1 - Flask Backend:**
```bash
cd solar-dashboard/backend
python app.py
# Or double-click: start-backend.bat
```
Expected output:
```
Running on http://0.0.0.0:5000
```

**Terminal 2 - FastAPI Image Service:**
```bash
cd solar-dashboard/backend
python -m uvicorn image_analysis_service:app --host 0.0.0.0 --port 8000 --reload
# Or double-click: start-image-service.bat
```
Expected output:
```
Uvicorn running on http://0.0.0.0:8000
```

**Terminal 3 - React Frontend:**
```bash
cd solar-dashboard/frontend
npm start
```
Expected output:
```
Compiled successfully!
You can now view the app in the browser at http://localhost:3000
```

### Option 2: All at Once (Windows)

Create `solar-dashboard/start-all.bat`:
```batch
@echo off
start "Flask Backend" cmd /k "cd backend && python app.py"
start "FastAPI Service" cmd /k "cd backend && python -m uvicorn image_analysis_service:app --host 0.0.0.0 --port 8000 --reload"
start "React Frontend" cmd /k "cd frontend && npm start"
```

Then run:
```bash
start-all.bat
```

## API Endpoints

### Flask Backend (5000)
- `GET /api/panels/all` - Get all solar panels
- `GET /api/camera/feed` - Proxy ESP32 camera feed
- `GET /api/panel/current-reading` - Get current readings
- Other panel-related endpoints

### FastAPI Service (8000)
- `GET /health` - Service health check
- `POST /analyze-image` - Analyze solar panel image
  ```
  Content-Type: multipart/form-data
  Fields:
    - image: file (JPEG/PNG)
    - panel_id: string (e.g., "SP-001")
  
  Response:
  {
    "success": true,
    "panel_id": "SP-001",
    "ml_result": {
      "fault_type": "Dusty",
      "confidence": 0.95,
      "top_predictions": [...]
    },
    "rag_context": "Knowledge base context...",
    "gemini_analysis": "Expert analysis...",
    "timestamp": "2026-01-16T09:30:00.000Z"
  }
  ```

## Troubleshooting

### 503/504 Errors (Service Unavailable)
**Cause:** FastAPI service not running
**Fix:**
```bash
# Make sure FastAPI is running on port 8000
netstat -ano | findstr "8000"  # Check if port is in use
python -m uvicorn image_analysis_service:app --host 0.0.0.0 --port 8000
```

### CORS Errors
**Cause:** Frontend can't reach backend on different port
**Fix:** Both services have CORS configured for localhost:3000
- Flask: `CORS(app)` in app.py
- FastAPI: CORSMiddleware in image_analysis_service.py

### Image Analysis Timeout (504)
**Cause:** Image too large causing slow processing
**Fix:** Image is automatically resized to max 640x640 in FastAPI service

### Model Not Found
**Error:** "ML model not available"
**Fix:** Verify model path:
```bash
# Check if model exists
if exist "..\models\last.onnx" (echo Model found) else (echo Model missing)
```

### GEMINI_API_KEY Not Set
**Error:** "Analysis unavailable"
**Fix:**
```bash
# Set environment variable
set GEMINI_API_KEY=your_key_here

# Or in .env file
echo GEMINI_API_KEY=your_key_here > .env
```

## File Structure

```
solar-dashboard/
├── backend/
│   ├── app.py                          # Flask main app (port 5000)
│   ├── image_analysis_service.py       # FastAPI app (port 8000)
│   ├── start-backend.bat               # Start Flask
│   ├── start-image-service.bat         # Start FastAPI
│   ├── requirements.txt                # Flask dependencies
│   ├── requirements-image-service.txt  # FastAPI dependencies
│   ├── onnx_infer.py                   # ML inference module
│   └── defect_detector.py              # Defect detection logic
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── CameraViewer.js         # Updated to call port 8000
│   │   └── ...
│   └── package.json
└── start-all.bat                       # Start all services
```

## Development Notes

### Adding New Image Analysis Features
1. Edit `image_analysis_service.py`
2. Add endpoint or modify `/analyze-image`
3. Service reloads automatically with `--reload` flag
4. Check logs for debugging

### Environment Variables
Create `.env` in backend directory:
```
GEMINI_API_KEY=your_key
ONNX_MODEL_PATH=../models/last.onnx
FAISS_PATH=../vector_db/faiss
```

### Logging
All services output logs to console:
- Flask: `[timestamp] level - message`
- FastAPI: `[timestamp] ComponentName - level - message`
- Check browser console for frontend errors

## Production Deployment

For production:
1. Replace `--reload` with `--workers 4` in FastAPI
2. Use proper WSGI server (gunicorn) for Flask
3. Configure proper CORS origins
4. Use environment variables from secure vault
5. Run behind reverse proxy (nginx, etc.)

## Support

If services don't start:
1. Check Python installation: `python --version`
2. Verify ports are available: `netstat -ano | findstr "3000\|5000\|8000"`
3. Check console output for specific error messages
4. Install missing dependencies: `pip install -r requirements.txt`
