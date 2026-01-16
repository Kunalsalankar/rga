# FastAPI Backend Fix - Summary

## Problem Analysis

### Issues Found:
1. **503 SERVICE UNAVAILABLE** - FastAPI service wasn't running on port 8000
2. **504 GATEWAY TIMEOUT** - Image processing taking too long (no resizing)
3. **CORS ERRORS** - Frontend on 3000 couldn't reach backend on 8000
4. **Wrong Port Mapping** - Frontend calling `/api/analyze-image` (port 5000) instead of port 8000
5. **Large Images** - No image size validation before ML inference

---

## Solution Implemented

### 1. Created FastAPI Service (image_analysis_service.py)

**Features:**
- ✅ Runs on port 8000 (separate from Flask on 5000)
- ✅ CORS enabled for `http://localhost:3000`
- ✅ Accepts `multipart/form-data` image uploads
- ✅ Image resizing (max 640x640) to prevent timeouts
- ✅ OpenCV safe image loading with error handling
- ✅ ML model inference with timeout protection
- ✅ RAG context retrieval from knowledge base
- ✅ Gemini AI analysis integration
- ✅ Comprehensive logging for debugging
- ✅ JSON response format

**Key Code Sections:**

```python
# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Image Resizing Function
def resize_image(image_bytes: bytes, max_width: int = 640, max_height: int = 640):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    # ... calculate scale and resize ...
    _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return buffer.tobytes()

# Main Analysis Endpoint
@app.post("/analyze-image")
async def analyze_image(
    image: UploadFile = File(...),
    panel_id: str = Form("Unknown")
):
    # 1. Validate image
    # 2. Resize to prevent timeout
    # 3. Run ML inference
    # 4. Query RAG context
    # 5. Generate Gemini analysis
    # 6. Return JSON
```

---

### 2. Updated Frontend (CameraViewer.js)

**Changes:**
- ✅ Changed endpoint URL from `/api/analyze-image` to `http://localhost:8000/analyze-image`
- ✅ Added detailed logging for debugging
- ✅ Proper error handling for 503/504 status codes
- ✅ Added "Analyze Image" button functionality
- ✅ Results display with ML confidence, defect type, and AI analysis

**Key Code:**
```javascript
// Correct URL pointing to FastAPI on port 8000
const analysisResponse = await fetch('http://localhost:8000/analyze-image', {
  method: 'POST',
  body: formData,
  headers: {
    'Accept': 'application/json'
  }
});

// Added logging
logger('info', 'Sending to http://localhost:8000/analyze-image');
```

---

### 3. Service Startup Scripts

**start-image-service.bat** - Launches FastAPI on port 8000
```batch
python -m uvicorn image_analysis_service:app --host 0.0.0.0 --port 8000 --reload
```

**SETUP.md** - Complete guide to running all services

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (3000)                     │
│                                                               │
│  - Dashboard displays solar panels                           │
│  - "Live Camera" button opens CameraViewer                  │
│  - "Analyze Image" sends to FastAPI (8000)                  │
│  - Displays ML results + Gemini analysis                    │
└──────┬────────────────────────────────────────────┬─────────┘
       │                                            │
       │ HTTP calls                                 │
       │                                            │
┌──────▼──────────────────┐         ┌───────────────▼──────────┐
│  Flask Backend (5000)   │         │ FastAPI Service (8000)   │
│                         │         │                          │
│ - Panel data APIs       │         │ - Image analysis         │
│ - Camera proxy          │         │ - ML inference           │
│ - Health reports        │         │ - RAG integration        │
│ - Other endpoints       │         │ - Gemini AI              │
└─────────────────────────┘         └──────────────────────────┘
       │                                    │
       │ Reads from                         │
       │                                    │
       └────────────────────┬───────────────┘
                            │
                  ┌─────────▼─────────┐
                  │  ML Model Files   │
                  ├───────────────────┤
                  │ models/last.onnx  │
                  │ vector_db/faiss   │
                  │ Gemini API key    │
                  └───────────────────┘
```

---

## Why 503/504 Occurred

### 503 SERVICE UNAVAILABLE
**Root Cause:** Frontend was calling `http://localhost:8000/analyze-image` but:
- FastAPI service wasn't started
- Only Flask (port 5000) was running
- No service listening on port 8000

**Fix:** Start FastAPI service:
```bash
cd solar-dashboard/backend
python -m uvicorn image_analysis_service:app --host 0.0.0.0 --port 8000
```

### 504 GATEWAY TIMEOUT
**Root Cause:** 
- Large images being processed without resizing
- ML inference taking >30 seconds per image
- CORS preflight requests timing out

**Fixes Applied:**
1. **Image Resizing** - Automatically resize to max 640x640 before inference
2. **JPEG Quality** - Use quality 85 to reduce file size
3. **Timeout Protection** - Set Gemini timeout to 30 seconds
4. **Proper CORS** - CORSMiddleware handles preflight correctly

---

## Testing the Fix

### 1. Start All Services
```bash
# Terminal 1
cd solar-dashboard/backend
python app.py

# Terminal 2
cd solar-dashboard/backend
python -m uvicorn image_analysis_service:app --host 0.0.0.0 --port 8000

# Terminal 3
cd solar-dashboard/frontend
npm start
```

### 2. Check Health Endpoints
```bash
# Flask health
curl http://localhost:5000/

# FastAPI health
curl http://localhost:8000/health
```

### 3. Test Image Analysis
1. Open http://localhost:3000
2. Click "Live Camera" on any panel
3. Click "Analyze Image"
4. Check browser console for logs
5. View analysis results

### 4. Check Logs
```
[09:30:15] [ImageAnalysisService] - INFO - [ANALYZE] Received request for panel: SP-001
[09:30:15] [ImageAnalysisService] - INFO - Original image size: 2048x1536
[09:30:16] [ImageAnalysisService] - INFO - Resized image size: 45678 bytes
[09:30:18] [ImageAnalysisService] - INFO - [ML] Detected: Dusty, Confidence: 0.9532
[09:30:19] [ImageAnalysisService] - INFO - [RAG] Context retrieved successfully
[09:30:22] [ImageAnalysisService] - INFO - [Gemini] Analysis generated successfully
[09:30:22] [ImageAnalysisService] - INFO - [ANALYZE] Analysis complete for SP-001
```

---

## Environment Setup

### Required Environment Variables
```bash
# Set GEMINI_API_KEY
set GEMINI_API_KEY=your_gemini_api_key_here

# Or create .env file in backend directory
GEMINI_API_KEY=your_gemini_api_key_here
```

### Required Model Files
```
solar-dashboard/
├── ../models/
│   └── last.onnx                    # ML model
├── ../vector_db/
│   └── faiss/                       # RAG vector store
└── ../rag_module/                   # RAG modules
```

---

## Dependencies Added

### requirements-image-service.txt
```
fastapi==0.104.1
uvicorn==0.24.0
opencv-python-headless==4.8.1.78
python-multipart==0.0.6
```

Install with:
```bash
pip install -r solar-dashboard/backend/requirements-image-service.txt
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "panel_id": "SP-001",
  "ml_result": {
    "fault_type": "Dusty",
    "confidence": 0.9532,
    "top_predictions": [
      {"label": "Dusty", "score": 0.9532},
      {"label": "Clean", "score": 0.0352},
      {"label": "Bird-drop", "score": 0.0116}
    ]
  },
  "rag_context": "[CONTEXT 1 | source=knowledge.txt | score=0.8954]\nSolar panel cleaning procedures...",
  "gemini_analysis": "The panel shows significant dust accumulation (95.32% confidence)...",
  "timestamp": "2026-01-16T09:30:22.000Z"
}
```

### Error Response
```json
{
  "detail": "ML model not available"
}
```
Status codes: 400, 500, 503, 504

---

## Summary

| Issue | Cause | Fix |
|-------|-------|-----|
| 503 SERVICE UNAVAILABLE | FastAPI not running | Start image_analysis_service on port 8000 |
| 504 GATEWAY TIMEOUT | Large images, slow processing | Resize images to 640x640 before inference |
| CORS ERRORS | Port mismatch (3000 → 5000/8000) | FastAPI CORSMiddleware + correct URL |
| Wrong endpoint | Frontend calling Flask endpoint | Update to `http://localhost:8000/analyze-image` |
| No image validation | Upload any size | OpenCV with resize function |

All issues resolved! ✅
