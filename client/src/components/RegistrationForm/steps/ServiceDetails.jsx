import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, Button, Typography } from '@mui/material';

const ServiceDetails = ({ formData, onChange, onNext, onBack }) => {
  const { t } = useTranslation();

  const canProceed = formData.serviceDetails.trim() !== '';

  return (
    <Box className="form-step">
      <Typography variant="h5" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        {t('section6')}
      </Typography>

      <TextField
        fullWidth
        label={t('section6')}
        value={formData.serviceDetails}
        onChange={(e) => onChange({ serviceDetails: e.target.value })}
        multiline
        rows={6}
        placeholder="Please describe in detail what you need..."
        required
      />

      <Box className="form-step-buttons">
        <Button variant="outlined" onClick={onBack} size="large">
          {t('previous')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onNext}
          disabled={!canProceed}
          size="large"
        >
          {t('next')}
        </Button>
      </Box>
    </Box>
  );
};

export default ServiceDetails;
