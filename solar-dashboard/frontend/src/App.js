import React, { useState, useEffect } from 'react';
import {
  Container,
  AppBar,
  Toolbar,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Typography,
  Button,
  Box
} from '@mui/material';
import { Bolt, Visibility } from '@mui/icons-material';
import SolarPanelGrid from './components/SolarPanelGrid';
import DigitalTwin from './components/DigitalTwin';
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

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [panelInfo, setPanelInfo] = useState(null);
  const [showDigitalTwin, setShowDigitalTwin] = useState(false);

  useEffect(() => {
    // Fetch initial panel info
    fetchPanelInfo();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchPanelInfo();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchPanelInfo = async () => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/panel/info?panelId=SP-001`,  // ✅ Use port 5000
        { timeout: 5000 }
      );
      console.log("✅ Panel info:", response.data);
    } catch (error) {
      console.error("❌ Error fetching panel info:", error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={3} sx={{ background: 'linear-gradient(135deg, #0066cc 0%, #0052a3 100%)' }}>
        <Toolbar sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
            <Bolt sx={{ fontSize: 32, color: '#FFD700' }} />
          </Box>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: '0.5px' }}>
            Solar Panel Monitoring System
          </Typography>
          <Button
            color="inherit"
            startIcon={<Visibility />}
            onClick={() => setShowDigitalTwin(true)}
            sx={{
              mr: 2,
              textTransform: 'none',
              fontSize: '0.95rem',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
            }}
          >
            Digital Twin
          </Button>
          {panelInfo && (
            <Typography variant="body2" sx={{ mr: 2, backgroundColor: 'rgba(255,255,255,0.2)', px: 1.5, py: 0.5, borderRadius: 1 }}>
              Panel: {panelInfo.panel_id}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <SolarPanelGrid />
      </Container>
    </ThemeProvider>
  );
}

export default App;

