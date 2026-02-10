# RAG Architecture for Solar Panel Defect Detection System

## Overview

This document outlines the complete architecture of the Retrieval-Augmented Generation (RAG) system used in the solar panel defect detection application. The RAG module enhances ML model predictions with domain-specific knowledge from a vector database.

## System Architecture Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Image Input   │    │   ML Model       │    │   RAG Module    │
│   (Camera/Upload│───▶│   (ResNet ONNX)  │───▶│   (FAISS/Chroma)│
│   /File)        │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │◀───│   Gemini LLM     │◀───│   Context       │
│   (Dashboard)   │    │   (Recommendation│    │   Retrieval     │
│                 │    │   Generation)    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Detailed Component Architecture

### 1. Input Layer
- **ESP32-CAM**: Real-time camera feed for solar panel images
- **File Upload**: Manual image upload functionality
- **API Endpoints**: 
  - `/analyze` - Main analysis endpoint
  - `/api/camera/feed` - Camera feed proxy
  - `/capture-and-store` - Store captured images

### 2. ML Inference Layer
**File**: `backend/onnx_infer.py`
- **Model**: ResNet-based ONNX model (`models/last.onnx`)
- **Input**: Image bytes
- **Output**: 
  ```python
  {
      "primary_defect": "defect_type",
      "confidence": 0.85,
      "top_predictions": [
          {"label": "defect1", "score": 0.85},
          {"label": "defect2", "score": 0.10}
      ]
  }
  ```

### 3. RAG Module Architecture

#### 3.1 Knowledge Ingestion Pipeline
```
Knowledge Sources → Text Chunking → Embedding Generation → Vector Storage
```

**Components**:
- **Knowledge Base**: `knowledge/example_knowledge.txt`
- **Text Processing**: Chunking strategy for optimal retrieval
- **Embedding Model**: Sentence transformers for vector representation
- **Vector Stores**: 
  - FAISS (`vector_db/faiss/`)
  - ChromaDB (`vector_db/chroma/`)

#### 3.2 Query Processing
**File**: `rag_module/query.py`

**Function**: `build_query_from_ml_output()`
```python
# Converts ML output to retrieval query
query_parts = [
    "solar panel defect knowledge",
    f"primary_defect: {primary_defect}",
    f"confidence: {confidence}",
    f"top_predictions: {top_str}",
    "impact and risk",
    "maintenance SOP",
    "decision thresholds",
    "cleaning isolation replacement criteria"
]
```

#### 3.3 Context Retrieval
**Function**: `query_rag()`
1. **Query Construction**: Transform ML output to semantic query
2. **Similarity Search**: Retrieve top-k relevant chunks
3. **Context Formatting**: Structure retrieved information for LLM

**Output Format**:
```
[CONTEXT 1 | source=knowledge.txt | score=0.9234]
<retrieved chunk text>

---

[CONTEXT 2 | source=knowledge.txt | score=0.8756]
<retrieved chunk text>
```

### 4. LLM Integration Layer
**File**: `backend/gemini.py`

**Function**: `generate_recommendation()`
- **Input**: ML output + RAG context
- **Processing**: Gemini generates actionable recommendations
- **Output**: Structured advice based on retrieved domain knowledge

### 5. API Layer Architecture
**File**: `backend/main.py`

#### Key Endpoints:
- **POST `/analyze`**: Complete analysis pipeline
- **GET `/api/camera/feed`**: Camera feed access
- **POST `/capture-and-store`**: Image storage
- **GET `/health`**: System health check

#### Request Flow:
```
Image Upload → ML Inference → RAG Retrieval → Gemini Generation → Response
```

## Data Flow Architecture

### 1. Training/Setup Phase
```
Domain Knowledge → Text Processing → Embedding → Vector DB Storage
```

### 2. Inference Phase
```
Image → ML Model → Defect Prediction → Query Construction → 
Vector Search → Context Retrieval → LLM Enhancement → Final Output
```

## Key Design Principles

### 1. Separation of Concerns
- **ML Model**: Pure defect classification
- **RAG Module**: Knowledge retrieval only
- **LLM**: Recommendation generation
- **API**: Orchestration and presentation

### 2. Modularity
- **Pluggable Vector Stores**: FAISS/ChromaDB support
- **Configurable Embedding Models**
- **Multiple LLM Backend Support**

### 3. Performance Considerations
- **Vector Index Optimization**: Fast similarity search
- **Caching**: Embedding and query result caching
- **Async Processing**: Non-blocking API calls

### 4. Scalability
- **Horizontal Scaling**: Multiple API instances
- **Vector Store Scaling**: Distributed vector databases
- **Model Caching**: ONNX model optimization

## Technology Stack

### Core Components
- **Backend**: FastAPI + Flask (hybrid)
- **ML Framework**: ONNX Runtime
- **Vector Database**: FAISS / ChromaDB
- **LLM**: Google Gemini
- **Frontend**: React-based dashboard

### Dependencies
- **Embeddings**: Sentence Transformers
- **Image Processing**: Pillow, OpenCV
- **API**: FastAPI, Flask, Requests
- **Environment**: Python 3.8+, Docker support

## Security & Reliability

### 1. API Security
- **CORS Configuration**: Controlled frontend access
- **Rate Limiting**: Gemini API rate limit handling
- **Input Validation**: File type and size validation

### 2. Error Handling
- **Graceful Degradation**: Fallback to dummy data
- **Comprehensive Logging**: Debug information
- **Health Checks**: System monitoring

### 3. Data Management
- **Local Storage**: Image captures in `captures/`
- **Vector Persistence**: Durable vector storage
- **Configuration**: Environment-based settings

## Performance Metrics

### 1. Latency Targets
- **ML Inference**: < 100ms
- **RAG Retrieval**: < 50ms
- **LLM Generation**: < 2s
- **Total Response**: < 3s

### 2. Accuracy Metrics
- **Defect Classification**: Model accuracy
- **Retrieval Relevance**: Semantic similarity scores
- **Recommendation Quality**: LLM output evaluation

## Future Enhancements

### 1. Advanced RAG Features
- **Hybrid Search**: Semantic + keyword search
- **Query Expansion**: Multi-query retrieval
- **Context Ranking**: Relevance scoring optimization

### 2. Model Improvements
- **Ensemble Models**: Multiple defect classifiers
- **Real-time Learning**: Online model updates
- **Explainability**: Attention visualization

### 3. System Scalability
- **Microservices**: Component separation
- **Cloud Deployment**: AWS/GCP integration
- **Monitoring**: APM integration

---

This architecture demonstrates a production-ready RAG implementation that enhances traditional ML predictions with domain-specific knowledge retrieval, providing more accurate and contextually relevant recommendations for solar panel maintenance.
