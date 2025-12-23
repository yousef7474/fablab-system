import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, Button, Typography, CircularProgress } from '@mui/material';
import { toast } from 'react-toastify';
import api from '../../../config/api';

const UserLookup = ({ onUserFound, onNewUser }) => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    if (!identifier) {
      toast.error('Please enter your National ID or Phone Number');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/registration/check-user', { identifier });

      if (response.data.exists) {
        toast.success('Welcome back!');
        onUserFound(response.data.user);
      } else {
        toast.info('New user - please complete registration');
        onNewUser();
      }
    } catch (error) {
      console.error('Error checking user:', error);
      toast.error('Error checking user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 4 }}>
        {t('nationalId')} / {t('phoneNumber')}
      </Typography>

      <TextField
        fullWidth
        label={`${t('nationalId')} or ${t('phoneNumber')}`}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}
        onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
      />

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCheck}
          disabled={loading}
          size="large"
        >
          {loading ? <CircularProgress size={24} /> : t('search')}
        </Button>
        <Button
          variant="outlined"
          onClick={onNewUser}
          size="large"
        >
          New Registration
        </Button>
      </Box>
    </Box>
  );
};

export default UserLookup;
