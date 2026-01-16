import React, { useState, useEffect } from 'react';
import { Paper, Grid, Typography, Box } from '@mui/material';
import { Bolt, Speed, Thermostat } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const RealTimeReadings = ({ reading }) => {
  const [history, setHistory] = useState({ current: [], voltage: [], temperature: [] });
  const [panelData, setPanelData] = useState({
    P1: { value: null, timestamp: null },
    P2: { value: null, timestamp: null },
    P3: { value: null, timestamp: null },
    P4: { value: null, timestamp: null },
    I: { value: null, timestamp: null },
    V1: { value: null, timestamp: null },
    V2: { value: null, timestamp: null },
    V3: { value: null, timestamp: null },
    V4: { value: null, timestamp: null }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ASSET_ID = 'cd29fe97-2d5e-47b4-a951-04c9e29544ac';

  // Dummy data for fallback
  const DUMMY_DATA = {
    P1: { value: 245.50, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } },
    P2: { value: 312.75, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } },
    P3: { value: 198.30, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } },
    P4: { value: 267.45, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } },
    I: { value: 0.45, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } },
    V1: { value: 48.5, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } },
    V2: { value: null, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } },
    V3: { value: null, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } },
    V4: { value: null, timestamp: { timeInSeconds: Math.floor(Date.now() / 1000), offsetInNanos: 0 } }
  };

  useEffect(() => {
    fetchHistory();
    fetchPanelData();
    const interval = setInterval(() => {
      fetchHistory();
      fetchPanelData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get('/api/panel/history?limit=50');
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchPanelData = async () => {
    try {
      setLoading(true);
      console.log('Fetching panel data...');
      
      // Try backend proxy first
      try {
        const response = await axios.get(`/api/panel/readings?assetId=${ASSET_ID}`, {
          timeout: 5000
        });
        console.log('✅ Backend proxy response:', response.data);
        
        if (response.data && response.data.data) {
          setPanelData(response.data.data);
          setError(null);
          setLoading(false);
          return;
        }
      } catch (proxyError) {
        console.log('❌ Backend proxy failed, trying direct AWS call...', proxyError.message);
      }

      // Fallback: Direct API call if proxy not available
      const externalUrl = `https://sacgn6gxpa.execute-api.us-east-1.amazonaws.com/latest?assetId=${ASSET_ID}`;
      console.log('Attempting direct fetch from AWS:', externalUrl);
      
      const response = await fetch(externalUrl, {
        headers: {
          'Accept': 'application/json'
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`AWS API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ Direct AWS API response:', data);
      
      if (data && data.data) {
        setPanelData(data.data);
        setError(null);
      }
    } catch (err) {
      console.error('❌ All API calls failed, using dummy data:', err.message);
      setPanelData(DUMMY_DATA);
      setError('Using simulated data');
    } finally {
      setLoading(false);
    }
  };

  const calculateIndividualCurrent = (totalCurrent) => {
    return totalCurrent ? (totalCurrent / 2).toFixed(4) : '0.0000';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  const chartData = history.current?.map((item, index) => ({
    time: formatTime(item.timestamp),
    Current: item.value,
    Voltage: history.voltage?.[index]?.value || 0,
    Temperature: history.temperature?.[index]?.value || 0,
  })) || [];

  const StatCard = ({ icon, title, value, unit, color }) => (
    <Paper
      sx={{
        p: 3,
        height: '100%',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `2px solid ${color}30`,
      }}
    >
      <Box display="flex" alignItems="center" mb={2}>
        <Box
          sx={{
            bgcolor: color,
            color: 'white',
            borderRadius: '50%',
            p: 1.5,
            mr: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="textSecondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color={color}>
            {value !== null && value !== undefined ? `${value} ${unit}` : '--'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );

  const totalCurrent = panelData.I?.value || 0;
  const individualCurrent = calculateIndividualCurrent(totalCurrent);

  return (
    <Paper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" gutterBottom fontWeight="bold" mb={0}>
          Real-Time Readings
        </Typography>
        {error && (
          <Typography variant="caption" color="warning.main" sx={{ bgcolor: '#fff3cd', px: 2, py: 1, borderRadius: 1 }}>
            ⚠️ {error}
          </Typography>
        )}
      </Box>
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon={<Bolt sx={{ fontSize: 32 }} />}
            title="Total Current"
            value={typeof totalCurrent === 'number' ? totalCurrent.toFixed(4) : '0.0000'}
            unit="A"
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon={<Speed sx={{ fontSize: 32 }} />}
            title="Voltage"
            value={panelData.V1?.value?.toFixed(2) || reading?.voltage || 'N/A'}
            unit="V"
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon={<Thermostat sx={{ fontSize: 32 }} />}
            title="Temperature"
            value={reading?.temperature || 'N/A'}
            unit="°C"
            color="#d32f2f"
          />
        </Grid>

        {/* Individual Panel Currents */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Individual Panel Currents (I/2)
          </Typography>
          <Grid container spacing={2}>
            {['P1', 'P2', 'P3', 'P4'].map((panel) => (
              <Grid item xs={12} sm={6} md={3} key={`current-${panel}`}>
                <StatCard
                  icon={<Bolt sx={{ fontSize: 28 }} />}
                  title={`${panel} Current`}
                  value={individualCurrent}
                  unit="A"
                  color="#ff9800"
                />
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Panel Power Values */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Panel Power Output
          </Typography>
          <Grid container spacing={2}>
            {['P1', 'P2', 'P3', 'P4'].map((panel) => (
              <Grid item xs={12} sm={6} md={3} key={`power-${panel}`}>
                <StatCard
                  icon={<Bolt sx={{ fontSize: 28 }} />}
                  title={`${panel} Power`}
                  value={panelData[panel]?.value?.toFixed(2) || 'N/A'}
                  unit="W"
                  color="#9c27b0"
                />
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Panel Voltage Values */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Panel Voltage
          </Typography>
          <Grid container spacing={2}>
            {['V1', 'V2', 'V3', 'V4'].map((voltage) => (
              <Grid item xs={12} sm={6} md={3} key={`voltage-${voltage}`}>
                <StatCard
                  icon={<Speed sx={{ fontSize: 28 }} />}
                  title={`${voltage}`}
                  value={panelData[voltage]?.value?.toFixed(2) || 'N/A'}
                  unit="V"
                  color="#2196f3"
                />
              </Grid>
            ))}
          </Grid>
        </Grid>

        <Grid item xs={12} sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Historical Trends
          </Typography>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Current"
                  stroke="#1976d2"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="Voltage"
                  stroke="#2e7d32"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="Temperature"
                  stroke="#d32f2f"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Typography color="textSecondary">No historical data available</Typography>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
};

export default RealTimeReadings;