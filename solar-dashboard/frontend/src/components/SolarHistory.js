import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
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

const SolarHistory = ({ assetId = defaultAssetId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const didInitFetchRef = useRef(false);

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

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const raw = await fetchSolarHistory({ assetId });

      const normalized = raw
        .map((row) => {
          const tsSeconds = Number(row?.timestamp);
          const tsMs = Number.isFinite(tsSeconds) ? tsSeconds * 1000 : Date.now();

          return {
            ...row,
            V1: absNumber(row?.V1),
            V2: absNumber(row?.V2),
            V3: absNumber(row?.V3),
            I: absNumber(row?.I),
            P1: absNumber(row?.P1),
            P2: absNumber(row?.P2),
            P3: absNumber(row?.P3),
            timestamp: tsSeconds,
            tsMs,
            timeLabel: new Date(tsMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            dateTimeLabel: formatDateTime(tsMs)
          };
        })
        .sort((a, b) => a.tsMs - b.tsMs);

      setData(normalized);
      setLastUpdated(new Date());
    } catch (e) {
      setData([]);
      setError(e?.message || 'Failed to fetch historical data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!didInitFetchRef.current) {
      didInitFetchRef.current = true;
      fetchHistory();
    }
    const id = setInterval(fetchHistory, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <CircularProgress size={22} />
            <Typography fontWeight={800}>Loading historical data…</Typography>
          </Box>
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
