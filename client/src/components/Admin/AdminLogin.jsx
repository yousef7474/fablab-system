import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  CircularProgress
} from '@mui/material';
import { toast } from 'react-toastify';
import api from '../../config/api';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/admin/login', formData);
      localStorage.setItem('adminToken', response.data.token);
      localStorage.setItem('adminData', JSON.stringify(response.data.admin));
      toast.success('Login successful!');
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%', borderRadius: 3 }}>
          <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 700, mb: 4 }}>
            Admin Login
          </Typography>

          <Typography variant="h6" align="center" color="text.secondary" gutterBottom>
            FABLAB Al-Ahsa
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              margin="normal"
              required
              autoFocus
            />

            <TextField
              fullWidth
              type="password"
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              margin="normal"
              required
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
            </Button>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              onClick={() => navigate('/')}
              color="secondary"
            >
              Back to Registration
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default AdminLogin;
