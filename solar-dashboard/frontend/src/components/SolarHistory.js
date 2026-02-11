import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Grid,
  IconButton,
  Paper,
  Skeleton,
  Typography
} from '@mui/material';
import { Bolt, CalendarMonth, Refresh, Speed, Tune } from '@mui/icons-material';
import MetricLineChart from './solarHistory/MetricLineChart';
import SummaryMetricCard from './solarHistory/SummaryMetricCard';
import { fetchSolarHistory } from '../services/solarHistoryApi';
import { absNumber, formatAbsFixed } from '../utils/numbers';
import './SolarHistory.css';

const defaultAssetId = 'SolarPanel_01';
const REFRESH_MS = 30000;

const SolarHistory = ({ assetId = defaultAssetId, isActive = true }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const didInitFetchRef = useRef(false);
  const prevActiveRef = useRef(isActive);
  const dataRef = useRef([]);

  const formatDateTime = (ms) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date(ms));
    } catch {
      return new Date(ms).toLocaleString();
    }
  };

  const toMetricValue = (v) => {
    if (v != null && typeof v === 'object' && 'value' in v) return v.value;
    return v;
  };

  const extractTimestampMs = (row) => {
    const candidate =
      row?.tsMs ??
      row?.timestampMs ??
      row?.timestamp ??
      row?.ts ??
      row?.time ??
      row?.datetime ??
      row?.V1?.timestamp ??
      row?.P1?.timestamp ??
      row?.I?.timestamp;

    const n = Number(candidate);
    if (!Number.isFinite(n) || n <= 0) return null;

    // Heuristic: if it's in seconds (e.g. 1770804910), convert to ms.
    return n < 1e12 ? n * 1000 : n;
  };

  const fetchHistory = async () => {
    const hasData = Array.isArray(dataRef.current) && dataRef.current.length > 0;

    try {
      if (!hasData) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      const rows = await fetchSolarHistory({ assetId });

      if (!Array.isArray(rows)) {
        throw new Error('Invalid API response: expected an array');
      }

      const normalized = rows
        .map((r) => {
          const tsMs = extractTimestampMs(r);
          return {
            ...r,
            tsMs,
            timeLabel: tsMs ? new Date(tsMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            dateTimeLabel: tsMs ? formatDateTime(tsMs) : '',
            V1: absNumber(toMetricValue(r.V1)),
            V2: absNumber(toMetricValue(r.V2)),
            V3: absNumber(toMetricValue(r.V3)),
            P1: absNumber(toMetricValue(r.P1)),
            P2: absNumber(toMetricValue(r.P2)),
            P3: absNumber(toMetricValue(r.P3)),
            I: absNumber(toMetricValue(r.I)),
          };
        })
        .sort((a, b) => Number(a.tsMs || 0) - Number(b.tsMs || 0));

      dataRef.current = normalized;
      setData(normalized);
      setLastUpdated(new Date());
    } catch (e) {
      if (!hasData) {
        dataRef.current = [];
        setData([]);
      }
      setError(e?.message || 'Failed to fetch historical data');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isActive) {
      prevActiveRef.current = false;
      return undefined;
    }

    const becameActive = prevActiveRef.current === false;
    prevActiveRef.current = true;

    if (!didInitFetchRef.current || becameActive) {
      didInitFetchRef.current = true;
      fetchHistory();
    }
    const id = setInterval(fetchHistory, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, isActive]);

  const latest = useMemo(() => {
    if (!data || data.length === 0) return null;
    return data[data.length - 1];
  }, [data]);

  const latestCards = useMemo(() => {
    return [
      {
        label: 'V1',
        value: latest ? formatAbsFixed(latest.V1, 2) : '—',
        unit: 'V',
        color: '#2563eb',
        icon: <Speed />
      },
      {
        label: 'V2',
        value: latest ? formatAbsFixed(latest.V2, 2) : '—',
        unit: 'V',
        color: '#22c55e',
        icon: <Speed />
      },
      {
        label: 'V3',
        value: latest ? formatAbsFixed(latest.V3, 2) : '—',
        unit: 'V',
        color: '#f59e0b',
        icon: <Speed />
      },
      {
        label: 'Current',
        value: latest ? String(Math.round(absNumber(latest.I))) : '—',
        unit: 'mA',
        color: '#6366f1',
        icon: <Tune />
      },
      {
        label: 'P1',
        value: latest ? formatAbsFixed(latest.P1, 2) : '—',
        unit: 'W',
        color: '#16a34a',
        icon: <Bolt />
      },
      {
        label: 'P2',
        value: latest ? formatAbsFixed(latest.P2, 2) : '—',
        unit: 'W',
        color: '#ef4444',
        icon: <Bolt />
      },
      {
        label: 'P3',
        value: latest ? formatAbsFixed(latest.P3, 2) : '—',
        unit: 'W',
        color: '#f97316',
        icon: <Bolt />
      }
    ];
  }, [latest]);

  return (
    <Box className="solarHistoryPage">
      <Box className="solarHistoryHeader">
        <Box>
          <Typography variant="h5" fontWeight={900} sx={{ mb: 0.25 }}>
            Solar History
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Asset: {assetId}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : '—'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {refreshing && (
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              Refreshing…
            </Typography>
          )}
          <IconButton
            onClick={fetchHistory}
            sx={{ bgcolor: '#eef2ff', '&:hover': { bgcolor: '#e0e7ff' } }}
            aria-label="Refresh history"
          >
            <Refresh fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #eaeaea', bgcolor: '#fff' }}>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={idx}>
                <Paper elevation={0} sx={{ p: 2.25, borderRadius: 2, border: '1px solid #eaeaea' }}>
                  <Skeleton variant="rounded" width={38} height={38} />
                  <Skeleton variant="text" sx={{ mt: 1.5 }} width="40%" />
                  <Skeleton variant="text" width="60%" />
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #eaeaea' }}>
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="rounded" sx={{ mt: 2 }} height={280} />
          </Paper>
        </Paper>
      ) : !error && (!data || data.length === 0) ? (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid #eaeaea', bgcolor: '#fff' }}>
          <Typography fontWeight={900} sx={{ mb: 0.5 }}>
            No historical data available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try refreshing, or check if the backend proxy is running.
          </Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {latestCards.map((c) => (
              <Grid item xs={12} sm={6} md={4} lg={2} key={c.label}>
                <SummaryMetricCard {...c} />
              </Grid>
            ))}
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <SummaryMetricCard
                label="Timestamp"
                value={latest ? formatDateTime(latest.tsMs) : '—'}
                unit=""
                color="#0ea5e9"
                icon={<CalendarMonth />}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <MetricLineChart
                title="Voltage (V)"
                subtitle="Historical voltage readings"
                data={data}
                yUnit="V"
                yDecimals={2}
                lines={[
                  { dataKey: 'V1', name: 'V1' },
                  { dataKey: 'V2', name: 'V2' },
                  { dataKey: 'V3', name: 'V3' }
                ]}
              />
            </Grid>

            <Grid item xs={12}>
              <MetricLineChart
                title="Power (W)"
                subtitle="Historical power readings"
                data={data}
                yUnit="W"
                yDecimals={2}
                lines={[
                  { dataKey: 'P1', name: 'P1' },
                  { dataKey: 'P2', name: 'P2' },
                  { dataKey: 'P3', name: 'P3' }
                ]}
              />
            </Grid>

            <Grid item xs={12}>
              <MetricLineChart
                title="Current (mA)"
                subtitle="Historical current readings"
                data={data}
                yUnit="mA"
                yDecimals={0}
                lines={[{ dataKey: 'I', name: 'I' }]}
              />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default SolarHistory;
