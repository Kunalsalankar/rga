import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography
} from '@mui/material';
import { Build, Info } from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ScheduleMaintenance = ({ panelId = null, autoGenerateToken = 0 }) => {
  const panels = useMemo(
    () => [
      { id: 'SP-001', label: 'SP-001 (Sector 1, Row 2)' },
      { id: 'SP-014', label: 'SP-014 (Sector 2, Row 8)' },
      { id: 'SP-99284', label: 'SP-99284 (Sector 4, Row 12)' }
    ],
    []
  );

  const [selectedPanelId, setSelectedPanelId] = useState(panelId || panels[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [lastAutoToken, setLastAutoToken] = useState(0);

  useEffect(() => {
    if (panelId) setSelectedPanelId(panelId);
  }, [panelId]);

  useEffect(() => {
    if (!autoGenerateToken) return;
    if (loading) return;
    if (autoGenerateToken === lastAutoToken) return;
    setLastAutoToken(autoGenerateToken);
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateToken, loading, lastAutoToken]);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const res = await fetch(`/api/panel/maintenance-plan?panel_id=${encodeURIComponent(selectedPanelId)}`, {
        method: 'POST'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed: ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e?.message || 'Failed to generate maintenance plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
          mb: 2
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ mb: 0.5 }}>
            Schedule Maintenance
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<Build />}
              label={`Panel: ${selectedPanelId}`}
              sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 900 }}
            />
          </Box>
        </Box>

        <Button
          variant="contained"
          color="success"
          sx={{ textTransform: 'none', borderRadius: 2 }}
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? 'Generating…' : 'Generate Maintenance Plan'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result?.gemini_error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {String(result.gemini_error)}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #eaeaea' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Info sx={{ color: '#22c55e' }} />
              <Typography fontWeight={900}>Maintenance Request</Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Panel"
                  value={selectedPanelId}
                  onChange={(e) => setSelectedPanelId(e.target.value)}
                >
                  {panels.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #eaeaea' }}>
            <Typography fontWeight={900} sx={{ mb: 1.5 }}>
              AI Maintenance Plan
            </Typography>

            {result?.defect_analysis && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip
                  label={`Defect: ${result.defect_analysis.defect || 'None'}`}
                  sx={{ bgcolor: '#f1f5f9', fontWeight: 900 }}
                />
                <Chip
                  label={`Confidence: ${((Number(result.defect_analysis.confidence) || 0) * 100).toFixed(1)}%`}
                  sx={{ bgcolor: '#f1f5f9', fontWeight: 900 }}
                />
              </Box>
            )}

            {result?.maintenance_plan ? (
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #eaeaea', bgcolor: '#fff' }}>
                <Box sx={{ color: 'text.secondary' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {String(result.maintenance_plan || '')}
                  </ReactMarkdown>
                </Box>
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Click “Generate Maintenance Plan” to create a plan using the AI model.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ScheduleMaintenance;
