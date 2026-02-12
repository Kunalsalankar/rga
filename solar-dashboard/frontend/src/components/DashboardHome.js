import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
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
import { absNumber } from '../utils/numbers';

const DashboardHome = () => {
  const [readingsData, setReadingsData] = useState(null);
  const [readingsError, setReadingsError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [powerSeries, setPowerSeries] = useState([]);
  const [energyTodayWh, setEnergyTodayWh] = useState(0);
  const [peakToday, setPeakToday] = useState({ w: 0, tsMs: null });

  const trunc2 = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return 0;
    return Math.trunc(num * 100) / 100;
  };

  const pickReadingValue = (obj, key) => {
    const raw = obj?.[key];
    if (raw && typeof raw === 'object' && 'value' in raw) return raw.value;
    return raw;
  };

  const rangeMs = 60 * 60 * 1000;

  useEffect(() => {
    let cancelled = false;
    let lastEnergyTsMs = null;
    let dayKey = new Date().toDateString();

    const fetchReadings = async () => {
      try {
        const res = await fetch('/api/panel/readings', { method: 'GET' });
        if (!res.ok) throw new Error(`Readings request failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setReadingsData(data);
        setReadingsError(null);
        const ts = new Date();
        setLastUpdated(ts);

        const newDayKey = ts.toDateString();
        if (newDayKey !== dayKey) {
          dayKey = newDayKey;
          lastEnergyTsMs = null;
          setEnergyTodayWh(0);
          setPeakToday({ w: 0, tsMs: null });
        }

        const p1 = absNumber(pickReadingValue(data, 'P1') ?? data?.power?.P1 ?? 0);
        const p2 = absNumber(pickReadingValue(data, 'P2') ?? data?.power?.P2 ?? 0);
        const p3 = absNumber(pickReadingValue(data, 'P3') ?? data?.power?.P3 ?? 0);
        const totalW = p1 + p2 + p3;

        const tsMs = ts.getTime();
        setPeakToday((prev) => {
          if (!Number.isFinite(totalW) || totalW <= (prev?.w || 0)) return prev;
          return { w: totalW, tsMs };
        });

        // Energy integration for today (Wh)
        if (Number.isFinite(totalW)) {
          if (lastEnergyTsMs != null) {
            const dtHours = (tsMs - lastEnergyTsMs) / (1000 * 60 * 60);
            if (dtHours > 0 && dtHours < 1) {
              setEnergyTodayWh((prev) => prev + (totalW * dtHours));
            }
          }
          lastEnergyTsMs = tsMs;
        }

        setPowerSeries((prev) => {
          const next = [
            ...prev,
            {
              tsMs,
              time: ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              w: Number(totalW.toFixed(2))
            }
          ];
          // Keep up to 7d in memory for filtering (cap to avoid runaway)
          const cutoff = tsMs - (7 * 24 * 60 * 60 * 1000);
          const trimmed = next.filter((p) => Number(p.tsMs || 0) >= cutoff);
          return trimmed.length > 10000 ? trimmed.slice(trimmed.length - 10000) : trimmed;
        });
      } catch (e) {
        if (cancelled) return;
        setReadingsData(null);
        setReadingsError(e?.message || 'Failed to fetch sensor readings');
      }
    };

    fetchReadings();
    const id = setInterval(fetchReadings, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const kpis = useMemo(
    () => {
      const classify = (p) => {
        const ap = Math.abs(Number(p) || 0);
        if (ap >= 5) return 'healthy';
        if (ap >= 1) return 'warning';
        return 'critical';
      };

      const powerKeys = ['P1', 'P2', 'P3'];
      const totalPanels = powerKeys.filter((k) => pickReadingValue(readingsData, k) != null || readingsData?.power?.[k] != null).length || powerKeys.length;

      const p1 = absNumber(pickReadingValue(readingsData, 'P1') ?? readingsData?.power?.P1 ?? 0);
      const p2 = absNumber(pickReadingValue(readingsData, 'P2') ?? readingsData?.power?.P2 ?? 0);
      const p3 = absNumber(pickReadingValue(readingsData, 'P3') ?? readingsData?.power?.P3 ?? 0);
      const classes = [classify(p1), classify(p2), classify(p3)];

      const healthy = classes.filter((c) => c === 'healthy').length;
      const warning = classes.filter((c) => c === 'warning').length;
      const critical = classes.filter((c) => c === 'critical').length;

      const totalW = p1 + p2 + p3;
      const efficiency = ((healthy / Math.max(1, totalPanels)) * 100).toFixed(0);

      const peakW = absNumber(peakToday?.w || 0);
      const peakLabel = peakToday?.tsMs ? new Date(peakToday.tsMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      const energyKwh = (absNumber(energyTodayWh) / 1000).toFixed(2);

      return [
        { label: 'Total Panels', value: String(totalPanels), icon: <GridView />, color: '#2563eb' },
        { label: 'Active', value: String(healthy), icon: <Bolt />, color: '#22c55e' },
        { label: 'Warning', value: String(warning), icon: <WarningAmber />, color: '#f59e0b' },
        { label: 'Critical', value: String(critical), icon: <ErrorOutline />, color: '#ef4444' },
        { label: 'Total Power', value: `${trunc2(totalW).toFixed(2)} W`, icon: <Bolt />, color: '#16a34a' },
        // Removed Today Energy / Peak Power / Avg Efficiency to avoid repeating totals and efficiency on the home page
      ];
    },
    [readingsData, energyTodayWh, peakToday]
  );

  const filteredPowerSeries = useMemo(() => {
    const now = Date.now();
    const cutoff = now - rangeMs;
    return (powerSeries || []).filter((p) => Number(p.tsMs || 0) >= cutoff);
  }, [powerSeries, rangeMs]);

  const yDomain = useMemo(() => {
    if (!filteredPowerSeries || filteredPowerSeries.length === 0) return [0, 10];
    const vals = filteredPowerSeries.map((p) => Number(p.w || 0)).filter((n) => Number.isFinite(n));
    if (vals.length === 0) return [0, 10];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max(1, (max - min) * 0.1);
    return [Math.max(0, min - pad), max + pad];
  }, [filteredPowerSeries]);

  const healthDist = useMemo(
    () => {
      const classify = (p) => {
        const ap = Math.abs(Number(p) || 0);
        if (ap >= 5) return 'healthy';
        if (ap >= 1) return 'warning';
        return 'critical';
      };

      const powerKeys = ['P1', 'P2', 'P3'];
      const totalPanels = powerKeys.filter((k) => pickReadingValue(readingsData, k) != null || readingsData?.power?.[k] != null).length || powerKeys.length;

      const p1 = absNumber(pickReadingValue(readingsData, 'P1') ?? readingsData?.power?.P1 ?? 0);
      const p2 = absNumber(pickReadingValue(readingsData, 'P2') ?? readingsData?.power?.P2 ?? 0);
      const p3 = absNumber(pickReadingValue(readingsData, 'P3') ?? readingsData?.power?.P3 ?? 0);
      const classes = [classify(p1), classify(p2), classify(p3)];

      const healthy = classes.filter((c) => c === 'healthy').length;
      const warning = classes.filter((c) => c === 'warning').length;
      const critical = classes.filter((c) => c === 'critical').length;

      const total = Math.max(1, totalPanels);

      return [
        { name: 'Healthy', value: Math.round((healthy / total) * 100), color: '#22c55e' },
        { name: 'Warning', value: Math.round((warning / total) * 100), color: '#f59e0b' },
        { name: 'Critical', value: Math.round((critical / total) * 100), color: '#ef4444' }
      ];
    },
    [readingsData]
  );

  const totalPanels = useMemo(() => {
    const powerKeys = ['P1', 'P2', 'P3'];
    return powerKeys.filter((k) => pickReadingValue(readingsData, k) != null || readingsData?.power?.[k] != null).length || powerKeys.length;
  }, [readingsData]);

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={900}>
            GreenEnergy Park A
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : '—'}
          </Typography>
          {readingsError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {readingsError}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={1.25} alignItems="center">
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
                {kpi.sub ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Peak at {kpi.sub}
                  </Typography>
                ) : null}
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
                  Performance measured in watts (W)
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#22c55e', fontWeight: 800 }}>
                LIVE GENERATION
              </Typography>
            </Box>

            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredPowerSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" stroke="#666" minTickGap={24} />
                  <YAxis domain={yDomain} stroke="#666" tickFormatter={(v) => `${Number(v).toFixed(0)} W`} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} W`, 'Power']} />
                  <Area type="monotone" dataKey="w" stroke="#22c55e" strokeWidth={3} fill="url(#powerFill)" dot={false} />
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
                  {totalPanels}
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
