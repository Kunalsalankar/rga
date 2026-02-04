import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import {
  Bolt,
  ErrorOutline,
  GridView,
  Refresh,
  Search,
  WarningAmber
} from '@mui/icons-material';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

const DashboardHome = () => {
  const [timeRange, setTimeRange] = useState('Last 7 Days');

  const kpis = useMemo(
    () => [
      { label: 'Total Panels', value: '1,240', icon: <GridView />, color: '#2563eb' },
      { label: 'Active', value: '1,192', icon: <Bolt />, color: '#22c55e' },
      { label: 'Warning', value: '36', icon: <WarningAmber />, color: '#f59e0b' },
      { label: 'Critical', value: '12', icon: <ErrorOutline />, color: '#ef4444' },
      { label: 'Total Power', value: '4.2 MW', icon: <Bolt />, color: '#16a34a' },
      { label: 'Avg Efficiency', value: '94.2%', icon: <Bolt />, color: '#6366f1' }
    ],
    []
  );

  const powerSeries = useMemo(
    () => [
      { time: '06:00', mw: 0.9 },
      { time: '09:00', mw: 2.8 },
      { time: '12:00', mw: 1.9 },
      { time: '15:00', mw: 2.4 },
      { time: '18:00', mw: 3.2 },
      { time: '21:00', mw: 2.7 }
    ],
    []
  );

  const healthDist = useMemo(
    () => [
      { name: 'Healthy', value: 95, color: '#22c55e' },
      { name: 'Warning', value: 3, color: '#f59e0b' },
      { name: 'Critical', value: 2, color: '#ef4444' }
    ],
    []
  );

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={900}>
            GreenEnergy Park A
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last updated: Today, 12:45 PM
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.25} alignItems="center">
          <Button
            variant="contained"
            disableElevation
            sx={{
              bgcolor: '#eef2ff',
              color: '#111827',
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { bgcolor: '#e0e7ff' }
            }}
            onClick={() => setTimeRange((v) => v)}
          >
            {timeRange}
          </Button>
          <IconButton sx={{ bgcolor: '#eef2ff', '&:hover': { bgcolor: '#e0e7ff' } }}>
            <Search fontSize="small" />
          </IconButton>
          <IconButton sx={{ bgcolor: '#eef2ff', '&:hover': { bgcolor: '#e0e7ff' } }}>
            <Refresh fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((kpi) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={kpi.label}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 2,
                border: '1px solid #eaeaea',
                bgcolor: '#fff'
              }}
            >
              <CardContent sx={{ p: 2.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: `${kpi.color}15`,
                      color: kpi.color
                    }}
                  >
                    {kpi.icon}
                  </Box>
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  {kpi.label}
                </Typography>
                <Typography variant="h6" fontWeight={900}>
                  {kpi.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #eaeaea' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
              <Box>
                <Typography fontWeight={900}>Power Output vs Time</Typography>
                <Typography variant="caption" color="text.secondary">
                  Performance measured in megawatts (MW)
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 800 }}>
                LIVE GENERATION
              </Typography>
            </Box>

            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={powerSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip />
                  <Area type="monotone" dataKey="mw" stroke="#22c55e" strokeWidth={3} fill="url(#powerFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #eaeaea' }}>
            <Box sx={{ mb: 1.5 }}>
              <Typography fontWeight={900}>Panel Health Distribution</Typography>
              <Typography variant="caption" color="text.secondary">
                Asset status breakdown
              </Typography>
            </Box>

            <Box sx={{ height: 320, position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthDist}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {healthDist.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>

              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center'
                }}
              >
                <Typography variant="h5" fontWeight={900}>
                  1,240
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  TOTAL ASSETS
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mt: 1.5, display: 'grid', gap: 0.75 }}>
              {healthDist.map((row) => (
                <Box key={row.name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color }} />
                    <Typography variant="caption" color="text.secondary">
                      {row.name}
                    </Typography>
                  </Box>
                  <Typography variant="caption" fontWeight={800}>
                    {row.value}%
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardHome;
