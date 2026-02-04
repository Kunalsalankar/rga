import React, { useState, useEffect, useCallback } from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab } from '@mui/material';
import { Bolt, ErrorOutline, CheckCircle, Videocam, TrendingUp, Close } from '@mui/icons-material';
import axios from 'axios';
import CameraViewer from './CameraViewer';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

const SolarPanelGrid = ({ onPanelSelect }) => {
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [panelData, setPanelData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const ASSET_ID = 'cd29fe97-2d5e-47b4-a951-04c9e29544ac';
  const BACKEND_URL = 'http://localhost:5000'; // ✅ Backend on port 5000

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

  const DUMMY_SENSOR_DATA = {
    I1: { value: 272, timestamp: 1768827220 },
    I2: { value: 386, timestamp: 1768827220 },
    P1: { value: 1.84, timestamp: 1768827220 },
    P2: { value: 1.84, timestamp: 1768827220 },
    P3: { value: 2.72, timestamp: 1768827220 },
    P4: { value: 2.72, timestamp: 1768827220 },
    V1: { value: 6.46, timestamp: 1768827220 },
    V2: { value: 7.07, timestamp: 1768827220 },
    V3: { value: 7.35, timestamp: 1768827220 },
    V4: { value: 6.75, timestamp: 1768827220 }
  };

  // Fetch panels from backend
  const fetchPanels = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching panels from backend...');
      
      const response = await axios.get(`${BACKEND_URL}/api/panels/all`, { timeout: 5000 });
      
      if (response.data && Array.isArray(response.data)) {
        console.log('✅ Panels fetched successfully:', response.data);
        setPanels(response.data);
        setError(null);
      }
    } catch (err) {
      console.error('❌ Error fetching panels:', err.message);
      setPanels(DUMMY_PANELS);
      setError('Using simulated panel data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch real-time sensor data from backend with longer timeout
  const fetchPanelData = useCallback(async () => {
    try {
      console.log('📡 Fetching sensor data from backend...');
      
      // ✅ Call Flask backend which proxies AWS API - increased timeout to 10s
      const response = await axios.get(
        `${BACKEND_URL}/api/panel/readings?assetId=${ASSET_ID}`,
        { timeout: 10000 } // Increased from 5000ms
      );
      
      // New API format returns data directly, not nested
      if (response.data) {
        console.log('✅ Real sensor data received:', response.data);
        setPanelData(response.data);
      }
    } catch (err) {
      console.error('❌ Error fetching sensor data:', err.message);
      console.log('📊 Using dummy sensor data as fallback');
      setPanelData(DUMMY_SENSOR_DATA);
    } finally {
      setDataLoading(false);
    }
  }, [ASSET_ID, BACKEND_URL]);

  useEffect(() => {
    fetchPanels();
    fetchPanelData(); // ✅ Fetch sensor data on component mount ONCE
    
    // DISABLED: Auto-refresh was causing CameraViewer state to reset
    // Only refresh when user explicitly requests or on manual intervals
    // const panelInterval = setInterval(fetchPanels, 15000);
    // const sensorInterval = setInterval(fetchPanelData, 15000);
    
    // return () => {
    //   clearInterval(panelInterval);
    //   clearInterval(sensorInterval);
    // };
  }, []); // ✅ EMPTY DEPENDENCY ARRAY - only run once on mount

  const getHealthColor = (score) => {
    if (score >= 85) return '#4caf50';
    if (score >= 70) return '#ff9800';
    return '#f44336';
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

  const handleOpenDetails = (panel) => {
    setSelectedPanel(panel);
    setDetailsOpen(true);
    setDataLoading(true); // ✅ Show loading state
    fetchPanelData(); // Fetch fresh data when opening
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedPanel(null);
    setPanelData(null);
    setTabValue(0);
  };

  const calculateSummary = () => {
    if (panels.length === 0) return { totalOutput: 0, healthyCount: 0, unhealthyCount: 0, averageHealth: 0, totalCapacity: 0 };
    
    const totalOutput = panels.reduce((sum, p) => sum + (p.current_output || 0), 0);
    const totalCapacity = panels.reduce((sum, p) => sum + (p.capacity || 0), 0);
    const healthyCount = panels.filter(p => p.health_score >= 85).length;
    const unhealthyCount = panels.filter(p => p.health_score < 70).length;
    const averageHealth = (panels.reduce((sum, p) => sum + (p.health_score || 0), 0) / panels.length).toFixed(1);
    
    return { totalOutput, totalCapacity, healthyCount, unhealthyCount, averageHealth };
  };

  // Generate IV Curve data - ACTUAL AWS VALUES with I1/I2
  const generateIVCurveData = () => {
    if (!panelData) return [];
    
    const V1 = panelData.V1?.value || 0;
    const V2 = panelData.V2?.value || 0;
    const V3 = panelData.V3?.value || 0;
    const V4 = panelData.V4?.value || 0;
    const I1 = (panelData.I1?.value || 0) / 1000; // Convert mA to A
    const I2 = (panelData.I2?.value || 0) / 1000; // Convert mA to A

    const voltages = [
      { voltage: V1, current: I1, label: 'V1' },
      { voltage: V2, current: I1, label: 'V2' },
      { voltage: V3, current: I2, label: 'V3' },
      { voltage: V4, current: I2, label: 'V4' }
    ].filter(v => v.voltage !== null && v.voltage !== undefined);
    
    return voltages.map((v) => ({
      voltage: parseFloat(v.voltage.toFixed(4)),
      current: parseFloat(v.current.toFixed(4)),
      power: parseFloat((v.voltage * v.current).toFixed(6)),
      label: v.label
    })).sort((a, b) => a.voltage - b.voltage);
  };

  // Replace the generatePowerTimeline function

  // Generate power production timeline - Calculate as Voltage × I
  const generatePowerTimeline = () => {
    if (!panelData) return [];
    
    const V1 = panelData.V1?.value || 0;
    const V2 = panelData.V2?.value || 0;
    const V3 = panelData.V3?.value || 0;
    const V4 = panelData.V4?.value || 0;
    const I1 = (panelData.I1?.value || 0) / 1000; // Convert mA to A
    const I2 = (panelData.I2?.value || 0) / 1000; // Convert mA to A
    
    const labels = ['P1', 'P2', 'P3', 'P4'];

    return [
      { name: 'P1', power: parseFloat((V1 * I1).toFixed(4)), capacity: 0.5 },
      { name: 'P2', power: parseFloat((V2 * I1).toFixed(4)), capacity: 0.5 },
      { name: 'P3', power: parseFloat((V3 * I2).toFixed(4)), capacity: 0.5 },
      { name: 'P4', power: parseFloat((V4 * I2).toFixed(4)), capacity: 0.5 }
    ];
  };

  const summary = calculateSummary();
  const efficiency = summary.totalCapacity > 0 ? ((summary.totalOutput / summary.totalCapacity) * 100).toFixed(1) : 0;

  const SummaryCard = ({ icon, title, value, unit, color, subtitle }) => (
    <Paper
      sx={{
        p: 2.5,
        height: '100%',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `2px solid ${color}30`,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >
      <Box display="flex" alignItems="flex-start" gap={2}>
        <Box
          sx={{
            bgcolor: color,
            color: 'white',
            borderRadius: '50%',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 50,
            height: 50
          }}
        >
          {icon}
        </Box>
        <Box flex={1}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h5" fontWeight="bold" color={color}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
          {unit && (
            <Typography variant="caption" color={color} sx={{ fontWeight: 500 }}>
              {unit}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );

  // Wrap PanelCard with React.memo to prevent unnecessary re-renders
  const PanelCard = React.memo(({ panel, panelData }) => {
    // Get sensor data based on panel ID
    const getPanelSensorData = () => {
      // Default values if no sensor data
      if (!panelData) {
        return { 
          voltage: 0,
          power: 0,
          current: 0
        };
      }

      try {
        // Map panel IDs to sensor keys
        let voltageKey;
        let currentKey;
        let powerKey;
        
        if (panel.id === 'SP-001') {
          voltageKey = 'V1';
          currentKey = 'I1';
          powerKey = 'P1';
        } else if (panel.id === 'SP-002') {
          voltageKey = 'V2';
          currentKey = 'I1';
          powerKey = 'P2';
        } else if (panel.id === 'SP-003') {
          voltageKey = 'V3';
          currentKey = 'I2';
          powerKey = 'P3';
        } else if (panel.id === 'SP-004') {
          voltageKey = 'V4';
          currentKey = 'I2';
          powerKey = 'P4';
        }

        // Get ACTUAL sensor values from AWS API for this specific panel
        const voltage = panelData[voltageKey]?.value || 0;
        const current = (panelData[currentKey]?.value || 0) / 1000; // Convert mA to A
        const power = voltage * current; // Calculate power
        
        console.log(`📊 ${panel.name} - ${voltageKey}: ${voltage}V, ${currentKey}: ${current}A, Power: ${power}W`);

        return { 
          voltage: parseFloat(voltage.toFixed(2)),
          power: parseFloat(power.toFixed(3)),
          current: parseFloat(current.toFixed(2))
        };
      } catch (err) {
        console.error(`Error parsing sensor data for ${panel.name}:`, err);
        return { voltage: 0, power: 0, current: 0 };
      }
    };

    const sensorData = getPanelSensorData();

    // Determine voltage key for display
    const getVoltageLabel = () => {
      const panelNum = panel.id.slice(-1); // Get '1', '2', '3', '4'
      return `V${panelNum}`;
    };

    // Determine power key for display
    const getPowerLabel = () => {
      const panelNum = panel.id.slice(-1); // Get '1', '2', '3', '4'
      return `P${panelNum}`;
    };

    return (
      <Paper
        sx={{
          p: 2,
          height: '100%',
          borderRadius: 2,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          transition: 'transform 0.3s, box-shadow 0.3s, cursor 0.3s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer'
          }
        }}
        onClick={() => {
          if (onPanelSelect) {
            onPanelSelect(panel);
            return;
          }
          handleOpenDetails(panel);
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
          ) : panel.health_score >= 70 ? (
            <CheckCircle sx={{ color: '#ff9800', fontSize: 24 }} />
          ) : (
            <ErrorOutline sx={{ color: '#f44336', fontSize: 24 }} />
          )}
        </Box>

        {/* Show Individual Panel AWS Sensor Data */}
        <Box sx={{ mb: 2, bgcolor: '#f9f9f9', p: 1.5, borderRadius: 1, border: '1px solid #e0e0e0' }}>
          <Box display="flex" justifyContent="space-between" mb={1.5}>
            <Typography variant="body2" fontWeight="500">⚡ Voltage</Typography>
            <Box>
              <Typography 
                variant="body2" 
                fontWeight="bold" 
                color="#2196f3"
                sx={{ fontSize: '1rem' }}
              >
                {sensorData.voltage.toFixed(4)}V
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'right' }}>
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" justifyContent="space-between" mb={1.5}>
            <Typography variant="body2" fontWeight="500">🔋 Power</Typography>
            <Box>
              <Typography 
                variant="body2" 
                fontWeight="bold" 
                color={sensorData.power >= 0 ? '#ff9800' : '#f44336'}
                sx={{ fontSize: '1rem' }}
              >
                {sensorData.power.toFixed(4)}W
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'right' }}>
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" fontWeight="500">⚙️ Current </Typography>
            <Box>
              <Typography 
                variant="body2" 
                fontWeight="bold" 
                color="#4caf50"
                sx={{ fontSize: '1rem' }}
              >
                {sensorData.current.toFixed(4)}A
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ display: 'block', textAlign: 'right' }}>
              </Typography>
            </Box>
          </Box>
        </Box>

        <Button
          fullWidth
          variant="outlined"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDetails(panel);
          }}
          sx={{ mt: 1.5 }}
        >
          View Details
        </Button>

        <Button
          fullWidth
          variant="contained"
          startIcon={<Videocam />}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenCamera(panel.id);
          }}
          sx={{ mt: 2 }}
        >
          View Camera
        </Button>
      </Paper>
    );
  });

  PanelCard.displayName = 'PanelCard';

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Summary Dashboard */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold" mb={3}>
          📊 System Overview
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<Bolt sx={{ fontSize: 28 }} />}
              title="Total Output"
              value={summary.totalOutput}
              unit="W"
              color="#ff9800"
              subtitle={`of ${summary.totalCapacity}W capacity`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<TrendingUp sx={{ fontSize: 28 }} />}
              title="System Efficiency"
              value={efficiency}
              unit="%"
              color="#2196f3"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<CheckCircle sx={{ fontSize: 28 }} />}
              title="Healthy Panels"
              value={summary.healthyCount}
              unit={`of ${panels.length}`}
              color="#4caf50"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<ErrorOutline sx={{ fontSize: 28 }} />}
              title="Unhealthy Panels"
              value={summary.unhealthyCount}
              unit={`Avg: ${summary.averageHealth}%`}
              color="#f44336"
            />
          </Grid>
        </Grid>
      </Box>

      {/* Solar Panels Grid */}
      <Box>
        <Typography variant="h5" gutterBottom fontWeight="bold" mb={3}>
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
              <PanelCard panel={panel} panelData={panelData} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Panel Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="lg"
        fullWidth
        sx={{ '& .MuiDialog-paper': { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">
            {selectedPanel?.name} - Detailed Analysis
          </Typography>
          <Button onClick={handleCloseDetails} sx={{ minWidth: 'auto' }}>
            <Close />
          </Button>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {dataLoading ? (
            <Box display="flex" justifyContent="center" py={5}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Alert severity={panelData === DUMMY_SENSOR_DATA ? "warning" : "success"} sx={{ mb: 2 }}>
                {panelData === DUMMY_SENSOR_DATA ? '📊 Showing sample data (API unavailable)' : '✅ Live data from AWS sensors - Last updated: ' + new Date(panelData?.data?.V1?.timestamp?.timeInSeconds * 1000).toLocaleTimeString()}
              </Alert>

              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Tab label="IV Curve" />
                <Tab label="Power Production" />
                <Tab label="Sensor Data" />
              </Tabs>

              {/* IV Curve Tab */}
              {tabValue === 0 && (
                <Box sx={{ py: 2 }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Current vs Voltage Curve
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Current shown in amps (A).
                  </Typography>
                  {generateIVCurveData().length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={generateIVCurveData()} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff9800" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ff9800" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="voltage" 
                          label={{ value: 'Voltage (V)', position: 'insideBottomRight', offset: -5 }}
                          stroke="#666"
                        />
                        <YAxis 
                          label={{ value: 'Current (A)', angle: -90, position: 'insideLeft' }}
                          stroke="#666"
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: 8 }}
                          formatter={(value) => value.toFixed(4)}
                          labelFormatter={(label) => `Voltage: ${label}V`}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="current" 
                          stroke="#ff9800" 
                          strokeWidth={3}
                          dot={{ fill: '#ff9800', r: 6 }}
                          activeDot={{ r: 8 }}
                          name="Current"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Alert severity="info">No IV curve data available</Alert>
                  )}
                </Box>
              )}

              {/* Power Production Tab */}
              {tabValue === 1 && (
                <Box sx={{ py: 2 }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Power Production (V × I)
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Calculated as: Voltage × Current
                  </Typography>
                  {generatePowerTimeline().length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={generatePowerTimeline()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="name"
                          stroke="#666"
                        />
                        <YAxis 
                          label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }}
                          stroke="#666"
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: 8 }}
                          formatter={(value) => `${value.toFixed(4)}W`}
                        />
                        <Legend />
                        <Bar 
                          dataKey="power" 
                          fill="#2196f3"
                          name="Power (V × I)"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Alert severity="info">No power data available</Alert>
                  )}
                </Box>
              )}

              {/* Sensor Data Tab */}
              {tabValue === 2 && (
                <Box sx={{ py: 2 }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Raw Sensor Data (Real-time from AWS)
                  </Typography>
                  {(panelData?.data || panelData) ? (
                    <Grid container spacing={2}>
                      {Object.entries(panelData?.data || panelData).map(([key, data]) => (
                        <Grid item xs={12} sm={6} key={key}>
                          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {key}
                            </Typography>
                            <Typography variant="h6" color="primary" sx={{ my: 1 }}>
                              {data?.value !== null && data?.value !== undefined ? Number(data.value).toFixed(4) : 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {data?.timestamp?.timeInSeconds
                                ? `Updated: ${new Date(data.timestamp.timeInSeconds * 1000).toLocaleString()}`
                                : ''}
                            </Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Alert severity="info">No sensor data available</Alert>
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button onClick={handleCloseDetails} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {selectedPanelId && (
        <CameraViewer
          open={cameraOpen}
          onClose={handleCloseCamera}
          panelId={selectedPanelId}
          cameraUrl={`http://10.70.187.244/capture`}
        />
      )}
    </Box>
  );
}

export default SolarPanelGrid;
