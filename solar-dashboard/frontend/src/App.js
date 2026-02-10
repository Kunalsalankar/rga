import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  ThemeProvider,
  createTheme,
  Typography,
  Button
} from '@mui/material';
import {
  Bolt,
  Build,
  Dashboard as DashboardIcon,
  ErrorOutline,
  Insights,
  NotificationsNone,
  Search,
  Settings,
  ShowChart,
  Visibility
} from '@mui/icons-material';
import SolarPanelGrid from './components/SolarPanelGrid';
import DigitalTwin from './components/DigitalTwin';
import DashboardHome from './components/DashboardHome';
import HistoricalAnalysis from './components/HistoricalAnalysis';
import HealthReport from './components/HealthReport';
import ScheduleMaintenance from './components/ScheduleMaintenance';
import axios from 'axios';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0066cc',
    },
    secondary: {
      main: '#ff9800',
    },
    background: {
      default: '#f0f4f8',
    },
    success: {
      main: '#4CAF50',
    },
    error: {
      main: '#F44336',
    },
    warning: {
      main: '#FFC107',
    }
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", sans-serif',
    h6: {
      fontWeight: 600,
      letterSpacing: '0.5px'
    }
  }
});

function App() {
  const [panelInfo, setPanelInfo] = useState(null);
  const [showDigitalTwin, setShowDigitalTwin] = useState(false);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [lastAutoNavTs, setLastAutoNavTs] = useState(0);

  useEffect(() => {
    // Fetch initial panel info
    fetchPanelInfo();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchPanelInfo();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const maybeAutoNavigate = async () => {
      try {
        const res = await fetch('/api/panel/readings', { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json();

        const p1 = Number(data?.P1?.value || 0);
        const threshold = 4;
        if (!(p1 > threshold)) return;

        const now = Date.now();
        const cooldownMs = 15000;
        if (now - lastAutoNavTs < cooldownMs) return;

        setSelectedPanel({ id: 'SP-001' });
        setActivePage('health-report');
        setLastAutoNavTs(now);
      } catch {
        // ignore
      }
    };

    const id = setInterval(maybeAutoNavigate, 3000);
    return () => clearInterval(id);
  }, [lastAutoNavTs]);

  const fetchPanelInfo = async () => {
    try {
      const response = await axios.get(
        `/api/panel/info?panelId=SP-001`,
        { timeout: 5000 }
      );
      setPanelInfo(response.data);
      console.log(" Panel info:", response.data);
    } catch (error) {
      console.error(" Error fetching panel info:", error);
    }
  };

  const drawerWidth = 260;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'live', label: 'Live Data', icon: <ShowChart /> },
    { id: 'historical', label: 'Historical Analysis', icon: <Insights /> },
    { id: 'health-report', label: 'Health Report', icon: <ErrorOutline /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Build /> },
    { id: 'settings', label: 'Settings', icon: <Settings /> }
  ];

  const handlePanelSelect = (panel) => {
    setSelectedPanel(panel);
    setActivePage('historical');
  };

  const handleOpenHealthReport = (panel) => {
    setSelectedPanel(panel);
    setActivePage('health-report');
  };

  const handleOpenScheduleMaintenance = (panelOrId = null) => {
    const panel = typeof panelOrId === 'string' ? { id: panelOrId } : panelOrId;
    setSelectedPanel(panel);
    setActivePage('maintenance');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {showDigitalTwin ? (
        <DigitalTwin onBack={() => setShowDigitalTwin(false)} panelInfo={panelInfo} />
      ) : (
        <>
          <AppBar
            position="fixed"
            elevation={3}
            sx={{
              background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)',
              zIndex: (t) => t.zIndex.drawer + 1,
              ml: { sm: `${drawerWidth}px` },
              width: { sm: `calc(100% - ${drawerWidth}px)` }
            }}
          >
            <Toolbar sx={{ py: 1.25, gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Bolt sx={{ fontSize: 32, color: '#FFD700' }} />
                <Typography variant="h6" component="div" sx={{ fontWeight: 800, letterSpacing: '0.4px' }}>
                  SolarMonitor Pro
                </Typography>
              </Box>

              <Box
                sx={{
                  flexGrow: 1,
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.25)'
                }}
              >
                <Search sx={{ opacity: 0.9 }} />
                <InputBase
                  placeholder="Search metrics or panels..."
                  sx={{ color: 'white', width: '100%' }}
                  inputProps={{ 'aria-label': 'search' }}
                />
              </Box>

              <IconButton color="inherit" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                <Badge color="error" variant="dot">
                  <NotificationsNone />
                </Badge>
              </IconButton>

              <Button
                color="inherit"
                startIcon={<Visibility />}
                onClick={() => setShowDigitalTwin(true)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Digital Twin
              </Button>

              {panelInfo?.panel_id && (
                <Typography
                  variant="body2"
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.18)',
                    border: '1px solid rgba(255,255,255,0.25)'
                  }}
                >
                  Panel: {panelInfo.panel_id}
                </Typography>
              )}

              <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(0,0,0,0.25)' }}>
                A
              </Avatar>
            </Toolbar>
          </AppBar>

          <Box sx={{ display: 'flex' }}>
            <Drawer
              variant="permanent"
              sx={{
                width: drawerWidth,
                flexShrink: 0,
                display: { xs: 'none', sm: 'block' },
                '& .MuiDrawer-paper': {
                  width: drawerWidth,
                  boxSizing: 'border-box',
                  borderRight: '1px solid #e6e6e6',
                  bgcolor: '#ffffff'
                }
              }}
              open
            >
              <Toolbar />
              <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={900}>
                  Solar Plant Admin
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Site ID: PV-7742
                </Typography>
              </Box>
              <Divider />
              <List sx={{ px: 1.25, py: 1 }}>
                {navItems.map((item) => (
                  <ListItemButton
                    key={item.id}
                    selected={activePage === item.id}
                    onClick={() => setActivePage(item.id)}
                    sx={{
                      borderRadius: 2,
                      mb: 0.75,
                      '&.Mui-selected': {
                        bgcolor: '#dff7e7',
                        '&:hover': { bgcolor: '#d2f1dd' }
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                ))}
              </List>
            </Drawer>

            <Box
              component="main"
              sx={{
                flexGrow: 1,
                width: { sm: `calc(100% - ${drawerWidth}px)` },
                bgcolor: '#f3f6fb',
                minHeight: '100vh'
              }}
            >
              <Toolbar />
              <Box sx={{ px: { xs: 2, md: 3 }, py: 3 }}>
                {activePage === 'historical' ? (
                  <HistoricalAnalysis panelId={selectedPanel?.id || null} />
                ) : activePage === 'dashboard' ? (
                  <>
                    <DashboardHome />
                    <SolarPanelGrid onPanelSelect={handlePanelSelect} onHealthReportOpen={handleOpenHealthReport} />
                  </>
                ) : activePage === 'health-report' ? (
                  <HealthReport
                    panelId={selectedPanel?.id || null}
                    onScheduleMaintenanceOpen={handleOpenScheduleMaintenance}
                  />
                ) : activePage === 'maintenance' ? (
                  <ScheduleMaintenance panelId={selectedPanel?.id || null} />
                ) : (
                  <SolarPanelGrid onPanelSelect={handlePanelSelect} onHealthReportOpen={handleOpenHealthReport} />
                )}
              </Box>
            </Box>
          </Box>
        </>
      )}
    </ThemeProvider>
  );
}

export default App;

