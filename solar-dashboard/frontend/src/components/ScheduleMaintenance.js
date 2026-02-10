import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Divider,
  Grid,
  Link,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  FormControlLabel,
  Switch
} from '@mui/material';
import { Build, CalendarMonth, CheckCircle, Info } from '@mui/icons-material';

const ScheduleMaintenance = ({ panelId = null }) => {
  const panels = useMemo(
    () => [
      { id: 'SP-001', label: 'SP-001 (Sector 1, Row 2)' },
      { id: 'SP-014', label: 'SP-014 (Sector 2, Row 8)' },
      { id: 'SP-99284', label: 'SP-99284 (Sector 4, Row 12)' }
    ],
    []
  );

  const initialUpcoming = useMemo(
    () => [
      {
        id: 'm-1',
        panelId: panelId || 'SP-99284',
        date: '2026-02-07',
        time: '04:00',
        type: 'Surface Cleaning',
        priority: 'High',
        technician: 'Auto Drone',
        status: 'Scheduled'
      },
      {
        id: 'm-2',
        panelId: 'SP-014',
        date: '2026-02-10',
        time: '11:30',
        type: 'Bypass Diode Check',
        priority: 'Medium',
        technician: 'Field Tech A',
        status: 'Pending'
      }
    ],
    [panelId]
  );

  const [upcoming, setUpcoming] = useState(initialUpcoming);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    panelId: panelId || panels[0].id,
    type: 'Surface Cleaning',
    priority: 'High',
    date: new Date().toISOString().slice(0, 10),
    time: '04:00',
    technician: 'Auto Drone',
    notes: 'Routine cleaning based on reduced efficiency trend.',
    autoAssign: true,
    notifyOps: true
  });

  const priorityColor = (p) => {
    if (p === 'High') return { bgcolor: '#fee2e2', color: '#b91c1c' };
    if (p === 'Medium') return { bgcolor: '#fef3c7', color: '#b45309' };
    return { bgcolor: '#dcfce7', color: '#15803d' };
  };

  const handleChange = (key) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmitted(false);
  };

  const handleSubmit = () => {
    const id = `m-${Date.now()}`;
    setUpcoming((prev) => [
      {
        id,
        panelId: form.panelId,
        date: form.date,
        time: form.time,
        type: form.type,
        priority: form.priority,
        technician: form.technician,
        status: 'Scheduled'
      },
      ...prev
    ]);
    setSubmitted(true);
  };

  return (
    <Box>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2, color: 'text.secondary' }}>
        <Link underline="hover" color="inherit" href="#">
          Home
        </Link>
        <Typography color="text.primary">Schedule Maintenance</Typography>
      </Breadcrumbs>

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
              label={panelId ? `Panel: ${panelId}` : 'All Panels'}
              sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 900 }}
            />
            <Chip
              icon={<CalendarMonth />}
              label="Static scheduler (for now)"
              sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 900 }}
            />
          </Box>
        </Box>

        <Button
          variant="contained"
          color="success"
          startIcon={<CheckCircle />}
          sx={{ textTransform: 'none', borderRadius: 2 }}
          onClick={handleSubmit}
        >
          Confirm Schedule
        </Button>
      </Box>

      {submitted && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Maintenance scheduled successfully.
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
                  value={form.panelId}
                  onChange={handleChange('panelId')}
                >
                  {panels.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Maintenance Type"
                  value={form.type}
                  onChange={handleChange('type')}
                >
                  {['Surface Cleaning', 'Bypass Diode Check', 'Thermal Inspection', 'Cable/Connector Check'].map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Priority"
                  value={form.priority}
                  onChange={handleChange('priority')}
                >
                  {['High', 'Medium', 'Low'].map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date"
                  value={form.date}
                  onChange={handleChange('date')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="time"
                  label="Time"
                  value={form.time}
                  onChange={handleChange('time')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Assigned Technician"
                  value={form.technician}
                  onChange={handleChange('technician')}
                >
                  {['Auto Drone', 'Field Tech A', 'Field Tech B', 'Electrical Team'].map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Notes"
                  value={form.notes}
                  onChange={handleChange('notes')}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }} />
                <FormControlLabel
                  control={<Switch checked={form.autoAssign} onChange={handleChange('autoAssign')} />}
                  label="Auto-assign best technician / drone"
                />
                <FormControlLabel
                  control={<Switch checked={form.notifyOps} onChange={handleChange('notifyOps')} />}
                  label="Notify operations team"
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, mt: 2.5, borderRadius: 2, border: '1px solid #eaeaea' }}>
            <Typography fontWeight={900} sx={{ mb: 1.25 }}>
              Suggested Window (Static)
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip label="Best time: 04:00 AM" sx={{ bgcolor: '#f1f5f9', fontWeight: 900 }} />
              <Chip label="Expected downtime: 20 min" sx={{ bgcolor: '#f1f5f9', fontWeight: 900 }} />
              <Chip label="Weather: Clear" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 900 }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.8 }}>
              This is placeholder logic. Later we can compute this from irradiation, wind, workforce availability, and predicted power loss.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #eaeaea' }}>
            <Typography fontWeight={900} sx={{ mb: 1.5 }}>
              Upcoming Scheduled Maintenance
            </Typography>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 900 }}>Panel</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Priority</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Assigned</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {upcoming.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell sx={{ fontWeight: 800 }}>{u.panelId}</TableCell>
                      <TableCell>{u.date}</TableCell>
                      <TableCell>{u.time}</TableCell>
                      <TableCell>{u.type}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={u.priority}
                          sx={{ ...priorityColor(u.priority), fontWeight: 900 }}
                        />
                      </TableCell>
                      <TableCell>{u.technician}</TableCell>
                      <TableCell>
                        <Chip size="small" label={u.status} sx={{ bgcolor: '#f1f5f9', fontWeight: 900 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, mt: 2.5, borderRadius: 2, border: '1px solid #eaeaea' }}>
            <Typography fontWeight={900} sx={{ mb: 1.25 }}>
              Checklist (Static)
            </Typography>
            <Grid container spacing={1.5}>
              {[
                'Verify panel ID and location',
                'Check soiling / hotspot markers',
                'Confirm drone/crew availability',
                'Run pre-maintenance safety checklist',
                'Capture post-maintenance photo',
                'Update maintenance log'
              ].map((item) => (
                <Grid item xs={12} sm={6} key={item}>
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #eaeaea' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {item}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ScheduleMaintenance;
