import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  IconButton,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../../config/api';

const AdminDashboard = ({ isDarkMode, toggleTheme }) => {
  const navigate = useNavigate();
  const [adminData, setAdminData] = useState(null);
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    pendingRegistrations: 0,
    approvedRegistrations: 0,
    rejectedRegistrations: 0
  });

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const admin = localStorage.getItem('adminData');

    if (!token || !admin) {
      navigate('/admin/login');
      return;
    }

    setAdminData(JSON.parse(admin));
    fetchAnalytics();
  }, [navigate]);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/admin/analytics');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    toast.success('Logged out successfully');
    navigate('/admin/login');
  };

  if (!adminData) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              FABLAB Admin Dashboard
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2">
                Welcome, <strong>{adminData.fullName}</strong>
              </Typography>

              <FormControlLabel
                control={<Switch checked={isDarkMode} onChange={toggleTheme} />}
                label={isDarkMode ? <DarkModeIcon /> : <LightModeIcon />}
              />

              <IconButton onClick={handleLogout} color="error">
                <LogoutIcon />
              </IconButton>
            </Box>
          </Box>
        </Container>
      </Paper>

      <Container maxWidth="lg">
        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#EE2329', color: 'white' }}>
              <CardContent>
                <DashboardIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.totalRegistrations}
                </Typography>
                <Typography variant="body2">Total Registrations</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#81AED6', color: 'white' }}>
              <CardContent>
                <AssignmentIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.pendingRegistrations}
                </Typography>
                <Typography variant="body2">Pending</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#48BF85', color: 'white' }}>
              <CardContent>
                <PeopleIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.approvedRegistrations}
                </Typography>
                <Typography variant="body2">Approved</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#C2E0E1', color: '#333' }}>
              <CardContent>
                <AssignmentIcon sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {stats.rejectedRegistrations}
                </Typography>
                <Typography variant="body2">Rejected</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Quick Actions */}
        <Paper elevation={2} sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
            Quick Actions
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                sx={{ py: 2 }}
              >
                View All Registrations
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                sx={{ py: 2 }}
              >
                Manage Users
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                sx={{ py: 2 }}
              >
                View Analytics
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                sx={{ py: 2 }}
              >
                Create Admin
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                sx={{ py: 2 }}
              >
                Export Data
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Button
                fullWidth
                variant="outlined"
                size="large"
                sx={{ py: 2 }}
              >
                Employee Schedules
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Coming Soon Notice */}
        <Box sx={{ mt: 4, textAlign: 'center', pb: 4 }}>
          <Typography variant="body2" color="text.secondary">
            Full admin dashboard features coming soon...
          </Typography>
          <Typography variant="caption" color="text.secondary">
            For now, use the API endpoints directly or we can build the full UI next
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default AdminDashboard;
