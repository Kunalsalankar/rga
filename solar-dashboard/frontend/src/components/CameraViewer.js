import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  IconButton,
  CircularProgress,
  Typography,
  Alert,
  Card,
  CardContent,
  Divider,
  Chip,
  LinearProgress
} from '@mui/material';
import { Close, Refresh, Download, CloudUpload } from '@mui/icons-material';

const CameraViewer = ({ open, onClose, panelId, cameraUrl = 'http://10.137.185.244/', onAnalysisComplete = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const handleRefresh = () => {
    setLoading(true);
    // Refresh the image by adding a timestamp parameter
    const imgElement = document.getElementById(`camera-image-${panelId}`);
    if (imgElement) {
      // Use backend proxy with timestamp to avoid caching
      imgElement.src = `/api/camera/feed?url=${encodeURIComponent(cameraUrl)}&t=${new Date().getTime()}`;
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    setLoading(false);
    setError(null);
  };

  const handleImageError = () => {
    setLoading(false);
    setError('Failed to load camera feed. Make sure the ESP32 camera is online at ' + cameraUrl);
  };

  const handleCaptureImage = () => {
    const imgElement = document.getElementById(`camera-image-${panelId}`);
    if (imgElement && imgElement.src) {
      // Create a canvas to draw the image
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.width;
      canvas.height = imgElement.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0);
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${panelId}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 'image/jpeg', 0.95);
    }
  };

  const handleAnalyzeImage = async () => {
    setAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const imgElement = document.getElementById(`camera-image-${panelId}`);
      if (!imgElement || !imgElement.src) {
        setError('No image to analyze');
        setAnalyzing(false);
        return;
      }

      logger('info', `Starting image analysis for panel ${panelId}`);

      // Convert image to blob
      const response = await fetch(imgElement.src);
      const blob = await response.blob();
      logger('info', `Image blob size: ${blob.size} bytes`);

      // Create FormData with image and panel_id
      const formData = new FormData();
      formData.append('image', blob, `${panelId}.jpg`);
      formData.append('panel_id', panelId);

      // Send to FastAPI backend on port 8000
      logger('info', 'Sending to http://localhost:8000/analyze-image');
      const analysisResponse = await fetch('http://localhost:8000/analyze-image', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      logger('info', `Response status: ${analysisResponse.status}`);
      const result = await analysisResponse.json();

      if (!analysisResponse.ok) {
        logger('error', `API Error: ${result.detail || result.error}`);
        setError(result.detail || result.error || 'Analysis failed');
      } else {
        logger('success', 'Analysis complete');
        setAnalysisResult(result);
        
        // Call the callback if provided to show health report
        if (onAnalysisComplete) {
          onAnalysisComplete(result);
        }
      }
    } catch (err) {
      const errorMsg = `Error analyzing image: ${err.message}`;
      logger('error', errorMsg);
      setError(errorMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  const logger = (type, message) => {
    const timestamp = new Date().toISOString().slice(11, 19);
    const prefix = `[${timestamp}] [CameraViewer] `;
    
    switch(type) {
      case 'info':
        console.log(`${prefix}ℹ ${message}`);
        break;
      case 'error':
        console.error(`${prefix}✗ ${message}`);
        break;
      case 'success':
        console.log(`${prefix}✓ ${message}`);
        break;
      default:
        console.log(`${prefix}${message}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Live Camera - {panelId}
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2, textAlign: 'center' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!analysisResult ? (
            <>
              <Box
                sx={{
                  position: 'relative',
                  backgroundColor: '#000',
                  borderRadius: 1,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '400px',
                  mb: 2
                }}
              >
                {loading && (
                  <CircularProgress sx={{ position: 'absolute' }} />
                )}
                <img
                  id={`camera-image-${panelId}`}
                  src={`/api/camera/feed?url=${encodeURIComponent(cameraUrl)}&t=${new Date().getTime()}`}
                  alt={`Live camera feed for ${panelId}`}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '500px',
                    objectFit: 'contain'
                  }}
                />
              </Box>
              <Typography variant="caption" color="textSecondary">
                Camera URL: {cameraUrl}
              </Typography>
            </>
          ) : (
            <>
              {/* Analysis Results Display */}
              <Alert severity="success" sx={{ mb: 2 }}>
                Analysis Complete
              </Alert>

              <Card sx={{ mb: 2, textAlign: 'left' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                    ML Model Results
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      Detected Defect:
                    </Typography>
                    <Chip
                      label={analysisResult.ml_result.defect}
                      color="primary"
                      variant="outlined"
                      sx={{ mt: 0.5, mb: 1 }}
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Confidence: {(analysisResult.ml_result.confidence * 100).toFixed(2)}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={analysisResult.ml_result.confidence * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                    AI Analysis (Gemini)
                  </Typography>
                  <Box
                    sx={{
                      backgroundColor: '#f5f5f5',
                      p: 2,
                      borderRadius: 1,
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {analysisResult.gemini_analysis}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        {!analysisResult ? (
          <>
            <Button
              onClick={handleAnalyzeImage}
              variant="contained"
              color="success"
              startIcon={analyzing ? <CircularProgress size={20} /> : <CloudUpload />}
              disabled={analyzing}
            >
              {analyzing ? 'Analyzing...' : 'Analyze Image'}
            </Button>
            <Button onClick={handleCaptureImage} variant="outlined" color="secondary" startIcon={<Download />}>
              Download
            </Button>
            <Button onClick={handleRefresh} variant="outlined" color="primary">
              Refresh
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => setAnalysisResult(null)}
              variant="outlined"
              color="primary"
            >
              Back to Camera
            </Button>
            <Button
              onClick={handleAnalyzeImage}
              variant="contained"
              color="success"
              startIcon={<CloudUpload />}
            >
              Analyze Again
            </Button>
          </>
        )}
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CameraViewer;
