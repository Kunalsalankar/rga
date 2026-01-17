# 🚀 Solar Panel Monitoring System - Setup & Run Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Port 3000)                             │
│  - Dashboard, Camera Viewer, Analysis Display           │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST
                     ↓
┌─────────────────────────────────────────────────────────┐
│  FastAPI Backend (Port 8000) - ML/RAG/Gemini           │
│  - Image Analysis (ONNX Model)                          │
│  - RAG Module (Knowledge Base Retrieval)                │
│  - Gemini AI (Recommendations)                          │
└─────────────────────────────────────────────────────────┘
                     ↓
                  Models & Data
              - ONNX Model (last.onnx)
              - Knowledge Base (PDF + TXT)
              - Vector DB (Chroma)
              - ESP32 Camera Feed
```

## Prerequisites

### 1. Install Python Dependencies
```bash
cd c:\Users\kunal salankar\Downloads\rag_folder
pip install -r requirements.txt
```

### 2. Install Node Dependencies
```bash
cd c:\Users\kunal salankar\Downloads\rag_folder\solar-dashboard\frontend
npm install
```

### 3. Environment Configuration
Make sure `.env` file exists in the root directory with:
```
GEMINI_API_KEYS=your_api_keys_here
ESP32_CAM_URL=http://10.70.187.244/capture
```

## ⚡ Quick Start

### Option 1: Using Batch Script (Windows)
```bash
# Navigate to root directory
cd c:\Users\kunal salankar\Downloads\rag_folder

# Run all services at once
START_ALL.bat
```

This will:
1. Start FastAPI Backend on port 8000
2. Start React Frontend on port 3000

### Option 2: Start Services Separately

**Terminal 1 - Start Backend:**
```bash
cd c:\Users\kunal salankar\Downloads\rag_folder
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Start Frontend:**
```bash
cd c:\Users\kunal salankar\Downloads\rag_folder\solar-dashboard\frontend
npm start
```

## 🌐 Access Points

Once services are running:

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Dashboard & UI |
| Backend | http://localhost:8000 | API Endpoints |
| Docs | http://localhost:8000/docs | API Documentation |
| ReDoc | http://localhost:8000/redoc | API Reference |

## 📊 Workflow

1. **Open Dashboard**: http://localhost:3000
2. **View Live Camera**: Click "View Camera" on any panel
3. **Capture Image**: Image auto-loads from ESP32 camera at 10.70.187.244
4. **Analyze Image**: Click "Analyze Image" button
   - ONNX model detects defect (Dusty, Bird-drop, Physical-Damage, etc.)
   - RAG retrieves relevant knowledge from solar panel manuals
   - Gemini generates recommendations based on SOP
5. **View Results**: Report shows:
   - Defect type detected
   - Confidence score
   - AI recommendations grounded in knowledge base

## 🔧 Key API Endpoints

### Image Analysis
```
POST /analyze
- Input: Image file
- Output: Defect, Confidence, RAG Context, Gemini Recommendations
```

### Camera Feed Proxy
```
GET /api/camera/feed?url=http://10.70.187.244/capture
- Proxies ESP32 camera feed through backend (CORS workaround)
```

### Health Check
```
GET /health
- Returns: {"status": "ok"}
```

## 🛠️ Troubleshooting

### "Failed to fetch" / Connection Refused
**Problem**: Backend not running on port 8000
**Solution**: Start backend with:
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Camera Feed Not Loading
**Problem**: ESP32 camera not reachable
**Solution**: 
- Check camera IP: http://10.70.187.244/capture
- Verify camera is online and on same network
- Update .env file: `ESP32_CAM_URL=http://10.70.187.244/capture`

### Gemini Recommendations Not Showing
**Problem**: Missing GEMINI_API_KEY
**Solution**: 
- Add to .env: `GEMINI_API_KEYS=your_api_key`
- Restart backend

### Model Not Found
**Problem**: "ONNX model not found"
**Solution**: Ensure `models/last.onnx` exists in root directory

### Knowledge Base Empty
**Problem**: RAG returns no context
**Solution**: 
- Check `backend/knowledge_base/` has PDF and TXT files
- Restart backend to re-ingest documents
- Clear `vector_db/` folder to force re-indexing

## 📝 Example Analysis Flow

```
1. User clicks "Analyze Image"
   ↓
2. Frontend sends image to POST /analyze
   ↓
3. Backend:
   a. Runs ONNX model → detects "Dusty" (87% confidence)
   b. Builds RAG query from model output
   c. Retrieves knowledge from solar panel manuals
   d. Sends to Gemini with RAG context
   e. Returns: {
      "fault": "Dusty",
      "confidence": 0.87,
      "rag_context": "Solar panel dust definition, impact...",
      "gemini_suggestion": "CRITICAL - Immediate action required..."
   }
   ↓
4. Frontend displays results in CameraViewer modal
   - Shows defect type
   - Shows confidence with progress bar
   - Shows full Gemini recommendations
   - User can download image or analyze again
```

## 🎯 Features Working

✅ Live camera feed from ESP32  
✅ ONNX model inference (6 defect types)  
✅ RAG module (knowledge base retrieval)  
✅ Gemini AI integration (smart recommendations)  
✅ CORS-enabled for frontend/backend communication  
✅ Responsive dashboard UI  
✅ Real sensor data from AWS API  
✅ Image capture and storage  

## 📚 Knowledge Base

Located in: `backend/knowledge_base/`

Includes:
- `example_knowledge.txt` - Solar panel defect definitions and SOPs
- `2022122719-1.pdf` - Solar panel maintenance manual
- `Best-Practices-In-Solar-Performance-Monitoring.pdf` - Best practices guide

All documents are indexed and searchable via RAG!

---

**Last Updated**: January 17, 2026
