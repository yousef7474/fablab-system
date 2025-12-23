import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, FormControlLabel, Checkbox, TextField, Button, Typography, Grid } from '@mui/material';

const RequiredService = ({ formData, onChange, onNext, onBack }) => {
  const { t } = useTranslation();

  const services = [
    'In-person consultation',
    'Online consultation',
    'Machine/Device reservation',
    'Personal workspace',
    'Support in project implementation',
    'Other'
  ];

  const handleServiceToggle = (service) => {
    let newServices = [...formData.requiredServices];

    if (newServices.includes(service)) {
      newServices = newServices.filter(s => s !== service);
    } else {
      if (newServices.length < 2) {
        newServices.push(service);
      }
    }

    onChange({ requiredServices: newServices });
  };

  const canProceed = formData.requiredServices.length > 0;

  return (
    <Box className="form-step">
      <Typography variant="h5" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        {t('section4')}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select up to 2 services
      </Typography>

      <Grid container spacing={2}>
        {services.map((service) => (
          <Grid item xs={12} sm={6} key={service}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.requiredServices.includes(service)}
                  onChange={() => handleServiceToggle(service)}
                  disabled={
                    formData.requiredServices.length >= 2 &&
                    !formData.requiredServices.includes(service)
                  }
                />
              }
              label={service}
            />
          </Grid>
        ))}
      </Grid>

      {formData.requiredServices.includes('Other') && (
        <TextField
          fullWidth
          label="Please specify"
          value={formData.otherServiceDetails}
          onChange={(e) => onChange({ otherServiceDetails: e.target.value })}
          sx={{ mt: 3 }}
          multiline
          rows={3}
        />
      )}

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

export default RequiredService;
