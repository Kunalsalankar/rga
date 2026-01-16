import React, { useState, useEffect } from 'react';
import {
  Paper,
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, LocationOn, Bolt, EnergySavingsLeaf } from '@mui/icons-material';
import axios from 'axios';

const HealthReport = ({ panelId = null }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHealthReport();
  }, [panelId]);

  const fetchHealthReport = async () => {
    try {
      setLoading(true);
      const url = panelId 
        ? `/api/panel/health-report?panel_id=${panelId}`
        : '/api/panel/health-report';
      const response = await axios.get(url);
      setReportData(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching health report:', err);
      setError('Failed to load health report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading Health Report...
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!reportData) {
    return <Alert severity="warning">No health report data available</Alert>;
  }

  const { yearly_summary, current_health, chart_data, location, panel_id } = reportData;
  const COLORS = ['#1976d2', '#ff9800', '#4caf50', '#f44336'];

  // Status indicator
  const getConditionColor = (condition) => {
    switch (condition) {
      case 'Excellent':
        return '#4caf50';
      case 'Good':
        return '#8bc34a';
      case 'Fair':
        return '#ff9800';
      case 'Poor':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const StatBox = ({ title, value, unit, icon, color }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h5" sx={{ color }}>
              {value} <span style={{ fontSize: '0.8em' }}>{unit}</span>
            </Typography>
          </Box>
          <Box
            sx={{
              bgcolor: color + '20',
              color: color,
              borderRadius: '50%',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ mb: 3 }}>
        Yearly Health Report - Solar Panel
      </Typography>

      {/* Location and Panel Info */}
      <Card sx={{ mb: 3, bgcolor: '#f5f5f5' }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <LocationOn sx={{ fontSize: 32, color: '#1976d2' }} />
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Panel Location
              </Typography>
              <Typography variant="h6">{location}</Typography>
              <Typography variant="body2" color="textSecondary">
                Panel ID: {panel_id}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Current Health Status */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2, fontWeight: 'bold' }}>
        Current Health Status
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 150,
                  height: 150,
                  margin: '0 auto',
                  mb: 2,
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: `conic-gradient(${getConditionColor(
                      current_health.condition
                    )} 0deg ${(current_health.health_score / 100) * 360}deg, #e0e0e0 ${(
                      current_health.health_score / 100
                    ) * 360}deg)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: '90%',
                      height: '90%',
                      borderRadius: '50%',
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                    }}
                  >
                    <Typography variant="h4" sx={{ color: getConditionColor(current_health.condition) }}>
                      {current_health.health_score.toFixed(1)}%
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Health Score
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Typography
                variant="h6"
                sx={{
                  color: getConditionColor(current_health.condition),
                  fontWeight: 'bold',
                }}
              >
                {current_health.condition}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatBox
            title="Current (Amperes)"
            value={current_health.current_avg_amperes}
            unit="A"
            icon={<Bolt />}
            color="#ff9800"
          />
          <StatBox
            title="Voltage (Volts)"
            value={current_health.voltage_avg_volts}
            unit="V"
            icon={<TrendingUp />}
            color="#1976d2"
          />
          <StatBox
            title="Active Defects"
            value={current_health.defect_count}
            unit="issues"
            icon={<Alert severity="warning" />}
            color="#f44336"
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Yearly Summary */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2, fontWeight: 'bold' }}>
        Yearly Summary (1 Year)
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Power Generated
              </Typography>
              <Typography variant="h5" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                {yearly_summary.total_power_kwh.toLocaleString()}
              </Typography>
              <Typography variant="caption">kWh</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Average Daily
              </Typography>
              <Typography variant="h5" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                {yearly_summary.avg_daily_power_kwh.toFixed(2)}
              </Typography>
              <Typography variant="caption">kWh/day</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Average Efficiency
              </Typography>
              <Typography variant="h5" sx={{ color: '#ff9800', fontWeight: 'bold' }}>
                {yearly_summary.avg_efficiency_percent.toFixed(2)}%
              </Typography>
              <Typography variant="caption">Efficiency</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <EnergySavingsLeaf sx={{ color: '#4caf50', fontSize: 28 }} />
                <Box>
                  <Typography color="textSecondary" variant="body2">
                    CO₂ Avoided
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                    {yearly_summary.estimated_co2_avoided_kg.toLocaleString()}
                  </Typography>
                  <Typography variant="caption">kg</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Charts */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3, mb: 2, fontWeight: 'bold' }}>
        Power Generation Analysis
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Monthly Power Generation Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Monthly Power Generation
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chart_data.monthly}
                margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis label={{ value: 'Power (kWh)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value) => `${value.toFixed(2)} kWh`}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="total_kwh" fill="#1976d2" name="Power Generated" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Monthly Efficiency Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Monthly Average Efficiency
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={chart_data.monthly}
                margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  domain={[80, 100]}
                  label={{ value: 'Efficiency (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value) => `${value.toFixed(2)}%`}
                  labelFormatter={(label) => `${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avg_efficiency"
                  stroke="#4caf50"
                  strokeWidth={2}
                  dot={{ fill: '#4caf50', r: 5 }}
                  activeDot={{ r: 7 }}
                  name="Efficiency"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Daily Power Distribution */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
          Daily Power Generation (Last 30 Days)
        </Typography>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={chart_data.daily.slice(-30)}
            margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              interval={Math.floor(30 / 8)}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis label={{ value: 'Power (kWh)', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              formatter={(value) => `${value.toFixed(2)} kWh`}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="power_kwh"
              stroke="#1976d2"
              strokeWidth={2}
              dot={false}
              name="Daily Power"
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* Min/Max Daily Stats */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#e3f2fd' }}>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Maximum Daily Power
              </Typography>
              <Typography variant="h5" sx={{ color: '#1976d2', fontWeight: 'bold', mt: 1 }}>
                {yearly_summary.max_daily_power_kwh.toFixed(2)}
              </Typography>
              <Typography variant="caption">kWh</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#fff3e0' }}>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Minimum Daily Power
              </Typography>
              <Typography variant="h5" sx={{ color: '#ff9800', fontWeight: 'bold', mt: 1 }}>
                {yearly_summary.min_daily_power_kwh.toFixed(2)}
              </Typography>
              <Typography variant="caption">kWh</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ bgcolor: '#f3e5f5' }}>
            <CardContent>
              <Typography color="textSecondary" variant="body2">
                Variance
              </Typography>
              <Typography variant="h5" sx={{ color: '#9c27b0', fontWeight: 'bold', mt: 1 }}>
                {(yearly_summary.max_daily_power_kwh - yearly_summary.min_daily_power_kwh).toFixed(2)}
              </Typography>
              <Typography variant="caption">kWh</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default HealthReport;
