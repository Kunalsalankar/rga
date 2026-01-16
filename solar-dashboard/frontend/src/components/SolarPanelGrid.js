import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, Alert, Button, IconButton } from '@mui/material';
import { Bolt, ErrorOutline, CheckCircle, Videocam } from '@mui/icons-material';
import axios from 'axios';
import CameraViewer from './CameraViewer';

const SolarPanelGrid = () => {
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState(null);

  // Dummy data for fallback
  const DUMMY_PANELS = [
    {
      id: 'SP-001',
      name: 'Solar Panel 1',
      location: 'Roof A',
      capacity: 400,
      current_output: 320,
      health_score: 96,
      last_update: new Date().toISOString()
    },
    {
      id: 'SP-002',
      name: 'Solar Panel 2',
      location: 'Roof B',
      capacity: 400,
      current_output: 380,
      health_score: 98,
      last_update: new Date().toISOString()
    },
    {
      id: 'SP-003',
      name: 'Solar Panel 3',
      location: 'Roof C',
      capacity: 400,
      current_output: 290,
      health_score: 95,
      last_update: new Date().toISOString()
    },
    {
      id: 'SP-004',
      name: 'Solar Panel 4',
      location: 'Roof D',
      capacity: 400,
      current_output: 150,
      health_score: 78,
      last_update: new Date().toISOString()
    }
  ];

  const fetchPanels = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching panels...');
      const response = await axios.get('/api/panels/all', { timeout: 5000 });
      console.log('✅ Panels fetched:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        setPanels(response.data);
        setError(null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('❌ Error fetching panels, using dummy data:', err.message);
      setPanels(DUMMY_PANELS);
      setError('Using simulated panel data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPanels();
  }, [fetchPanels]);

  const getHealthColor = (score) => {
    if (score >= 85) return '#4caf50'; // Green
    if (score >= 70) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  const getHealthStatus = (score) => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    return 'Poor';
  };

  const handleOpenCamera = (panelId) => {
    setSelectedPanelId(panelId);
    setCameraOpen(true);
  };

  const handleCloseCamera = () => {
    setCameraOpen(false);
    setSelectedPanelId(null);
  };

  const PanelCard = ({ panel }) => (
    <Paper
      sx={{
        p: 2,
        height: '100%',
        borderRadius: 2,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        transition: 'transform 0.3s, box-shadow 0.3s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 12px rgba(0,0,0,0.15)'
        }
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            {panel.name}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {panel.location}
          </Typography>
        </Box>
        {panel.health_score >= 85 ? (
          <CheckCircle sx={{ color: '#4caf50', fontSize: 24 }} />
        ) : (
          <ErrorOutline sx={{ color: '#f44336', fontSize: 24 }} />
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography variant="body2">Capacity</Typography>
          <Typography variant="body2" fontWeight="bold">{panel.capacity}W</Typography>
        </Box>
        <Box display="flex" justifyContent="space-between" mb={1}>
          <Typography variant="body2">Output</Typography>
          <Typography variant="body2" fontWeight="bold">{panel.current_output}W</Typography>
        </Box>
        <Box display="flex" justifyContent="space-between">
          <Typography variant="body2">Health</Typography>
          <Typography variant="body2" fontWeight="bold" sx={{ color: getHealthColor(panel.health_score) }}>
            {panel.health_score}% - {getHealthStatus(panel.health_score)}
          </Typography>
        </Box>
      </Box>

      <Button
        fullWidth
        variant="contained"
        startIcon={<Videocam />}
        onClick={() => handleOpenCamera(panel.id)}
        sx={{ mt: 2 }}
      >
        View Camera
      </Button>
    </Paper>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        🌞 Solar Panels ({panels.length})
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {panels.map((panel) => (
          <Grid item xs={12} sm={6} md={6} lg={3} key={panel.id}>
            <PanelCard panel={panel} />
          </Grid>
        ))}
      </Grid>

      {selectedPanelId && (
        <CameraViewer
          open={cameraOpen}
          onClose={handleCloseCamera}
          panelId={selectedPanelId}
          cameraUrl={`http://10.137.185.244/`}
        />
      )}
    </Box>
  );
};

export default SolarPanelGrid;
