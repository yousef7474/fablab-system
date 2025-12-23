import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, Button, Typography, Paper, CircularProgress } from '@mui/material';

const Commitment = ({ formData, onChange, onBack, onSubmit, loading }) => {
  const { t } = useTranslation();

  const commitmentText = t('commitmentText');

  const canProceed = formData.commitmentName.trim() !== '';

  return (
    <Box className="form-step">
      <Typography variant="h5" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        {t('section8')}
      </Typography>

      <Paper elevation={2} sx={{ p: 3, mb: 4, bgcolor: '#f9f9f9' }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
          {commitmentText.replace('[name]', '_______________')}
        </Typography>
      </Paper>

      <TextField
        fullWidth
        label="Your Full Name"
        value={formData.commitmentName}
        onChange={(e) => onChange({ commitmentName: e.target.value })}
        placeholder="Enter your full name to confirm commitment"
        required
        sx={{ mb: 4 }}
      />

      <Box className="form-step-buttons">
        <Button variant="outlined" onClick={onBack} size="large" disabled={loading}>
          {t('previous')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onSubmit}
          disabled={!canProceed || loading}
          size="large"
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : t('submit')}
        </Button>
      </Box>
    </Box>
  );
};

export default Commitment;
