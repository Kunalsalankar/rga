import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab } from '@mui/material';
import { Bolt, ErrorOutline, CheckCircle, Videocam, TrendingUp, Close } from '@mui/icons-material';
import CameraViewer from './CameraViewer';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { absNumber } from '../utils/numbers';

const SolarPanelGrid = ({ onPanelSelect, onHealthReportOpen }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [panelData, setPanelData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const trunc2 = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return 0;
    return Math.trunc(num * 100) / 100;
  };

  const VALUES_ENDPOINT = '/api/panel/readings';

  const panels = useMemo(
    () => [
      { id: 'SP-001', name: 'Solar Panel 1', location: 'Panel 1' },
      { id: 'SP-002', name: 'Solar Panel 2', location: 'Panel 2' },
      { id: 'SP-003', name: 'Solar Panel 3', location: 'Panel 3' }
    ],
    []
  );

  const SENSOR_MAP = useMemo(
    () => ({
      'SP-001': { voltageKey: 'V1', powerKey: 'P1', currentKey: 'I' },
      'SP-002': { voltageKey: 'V2', powerKey: 'P1', currentKey: 'I' },
      'SP-003': { voltageKey: 'V3', powerKey: 'P3', currentKey: 'I' }
    }),
    []
  );

  const fetchPanelData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(VALUES_ENDPOINT, { method: 'GET' });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setPanelData(data);
    } catch (e) {
      setPanelData(null);
      setError(e?.message || 'Failed to fetch live panel values');
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  }, [VALUES_ENDPOINT]);

  useEffect(() => {
    fetchPanelData();
    const id = setInterval(fetchPanelData, 5000);
    return () => clearInterval(id);
  }, [fetchPanelData]);

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
    fetchPanelData();
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedPanel(null);
    setPanelData(null);
    setTabValue(0);
  };

  const calculateSummary = () => {
    const p1 = absNumber(panelData?.P1?.value || 0);
    const p3 = absNumber(panelData?.P3?.value || 0);
    const totalOutput = p1 + p1 + p3;

    const classify = (p) => {
      const ap = Math.abs(Number(p) || 0);
      if (ap >= 5) return 'healthy';
      if (ap >= 1) return 'warning';
      return 'critical';
    };
    const classes = [classify(p1), classify(p1), classify(p3)];
    const healthyCount = classes.filter((c) => c === 'healthy').length;
    const unhealthyCount = classes.filter((c) => c === 'critical').length;
    const averageHealth = ((healthyCount / 3) * 100).toFixed(0);

    return { totalOutput: trunc2(totalOutput).toFixed(2), totalCapacity: null, healthyCount, unhealthyCount, averageHealth };
  };

  // Generate IV Curve data - Live values (V1/V2/V3 and I in mA)
  const generateIVCurveData = () => {
    if (!panelData) return [];

    const I = absNumber(panelData?.I?.value || 0); // mA
    const points = [
      { voltage: absNumber(panelData?.V1?.value || 0), current: I, label: 'V1' },
      { voltage: absNumber(panelData?.V2?.value || 0), current: I, label: 'V2' },
      { voltage: absNumber(panelData?.V3?.value || 0), current: I, label: 'V3' }
    ];

    return points
      .filter((p) => Number.isFinite(p.voltage))
      .map((p) => ({
        voltage: Number(p.voltage.toFixed(4)),
        current: Number(p.current.toFixed(0)),
        label: p.label
      }))
      .sort((a, b) => a.voltage - b.voltage);
  };

  // Replace the generatePowerTimeline function

  // Generate power production timeline - Use P1/P2/P3 directly (W)
  const generatePowerTimeline = () => {
    if (!panelData) return [];

    return [
      { name: 'Panel 1', power: absNumber(panelData?.P1?.value || 0) },
      { name: 'Panel 2', power: absNumber(panelData?.P1?.value || 0) },
      { name: 'Panel 3', power: absNumber(panelData?.P3?.value || 0) }
    ].map((p) => ({ ...p, power: Number(p.power.toFixed(4)) }));
  };

  const summary = calculateSummary();
  const efficiency = summary.totalCapacity && summary.totalCapacity !== '—'
    ? ((summary.totalOutput / summary.totalCapacity) * 100).toFixed(1)
    : summary.averageHealth;

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
        const map = SENSOR_MAP[panel.id];
        const voltage = absNumber(panelData?.[map.voltageKey]?.value || 0);
        const current = absNumber(panelData?.[map.currentKey]?.value || 0); // mA
        const power = absNumber(panelData?.[map.powerKey]?.value || 0); // W

        return { 
          voltage: Number(voltage.toFixed(4)),
          power: Number(power.toFixed(4)),
          current: Number(current.toFixed(0))
        };
      } catch (err) {
        console.error(`Error parsing sensor data for ${panel.name}:`, err);
        return { voltage: 0, power: 0, current: 0 };
      }
    };

    const sensorData = getPanelSensorData();

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
          {Math.abs(sensorData.power) >= 5 ? (
            <CheckCircle sx={{ color: '#4caf50', fontSize: 24 }} />
          ) : Math.abs(sensorData.power) >= 1 ? (
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
                {sensorData.current.toFixed(0)} mA
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

        {onHealthReportOpen && (
          <Button
            fullWidth
            variant="outlined"
            color="success"
            onClick={(e) => {
              e.stopPropagation();
              onHealthReportOpen(panel);
            }}
            sx={{ mt: 1.25 }}
          >
            Health Report
          </Button>
        )}

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
              subtitle={summary.totalCapacity ? `of ${summary.totalCapacity}W capacity` : null}
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
            <Grid item xs={12} sm={6} md={4} lg={4} key={panel.id}>
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
              {error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mb: 2 }}>
                  ✅ Live data from AWS sensors
                </Alert>
              )}

              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Tab label="IV Curve" />
                <Tab label="Power" />
                <Tab label="Sensor Data" />
              </Tabs>

              {/* IV Curve Tab */}
              {tabValue === 0 && (
                <Box sx={{ py: 2 }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Current vs Voltage Curve
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Current shown in milliampere (mA).
                  </Typography>
                  {generateIVCurveData().length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={generateIVCurveData()} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ff9800" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#ff9800" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="voltage"
                          label={{ value: 'Voltage (V)', position: 'insideBottomRight', offset: -5 }}
                          stroke="#666"
                        />
                        <YAxis
                          label={{ value: 'Current (mA)', angle: -90, position: 'insideLeft' }}
                          stroke="#666"
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: 8 }}
                          formatter={(value) => `${Number(value).toFixed(0)} mA`}
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

              {/* Power Tab */}
              {tabValue === 1 && (
                <Box sx={{ py: 2 }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    Power (W)
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Using sensor power readings P1 and P3.
                  </Typography>
                  {generatePowerTimeline().length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={generatePowerTimeline()} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" stroke="#666" />
                        <YAxis label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} stroke="#666" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: 8 }}
                          formatter={(value) => `${Number(value).toFixed(4)} W`}
                        />
                        <Legend />
                        <Bar dataKey="power" fill="#2196f3" name="Power (W)" radius={[8, 8, 0, 0]} />
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
                  {panelData ? (
                    <Grid container spacing={2}>
                      {Object.entries(panelData).map(([key, data]) => (
                        <Grid item xs={12} sm={6} key={key}>
                          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {key}
                            </Typography>
                            <Typography variant="h6" color="primary" sx={{ my: 1 }}>
                              {data?.value !== null && data?.value !== undefined ? absNumber(data.value).toFixed(4) : 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {data?.timestamp ? `Updated: ${new Date(Number(data.timestamp) * 1000).toLocaleString()}` : ''}
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
