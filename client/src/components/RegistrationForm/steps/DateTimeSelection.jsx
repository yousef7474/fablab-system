import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, Button, Typography, Grid } from '@mui/material';

const DateTimeSelection = ({ formData, onChange, onNext, onBack }) => {
  const { t } = useTranslation();

  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };

  const canProceed = () => {
    if (['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType)) {
      return formData.appointmentDate && formData.appointmentTime;
    } else if (formData.applicationType === 'Volunteer') {
      return formData.startDate && formData.endDate && formData.startTime && formData.endTime;
    } else if (formData.applicationType === 'FABLAB Visit') {
      return formData.visitDate && formData.visitStartTime && formData.visitEndTime;
    }
    return false;
  };

  return (
    <Box className="form-step">
      <Typography variant="h5" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        {t('section5')}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Working hours: Sunday - Thursday, 8:00 AM - 3:00 PM
      </Typography>

      <Grid container spacing={3}>
        {['Beneficiary', 'Talented', 'Visitor'].includes(formData.applicationType) && (
          <>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('date')}
                value={formData.appointmentDate || ''}
                onChange={(e) => handleChange('appointmentDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="time"
                label={t('time')}
                value={formData.appointmentTime || ''}
                onChange={(e) => handleChange('appointmentTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: '08:00', max: '15:00' }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label={t('duration')}
                value={formData.appointmentDuration}
                onChange={(e) => handleChange('appointmentDuration', e.target.value)}
                inputProps={{ min: 30, max: 480, step: 30 }}
              />
            </Grid>
          </>
        )}

        {formData.applicationType === 'Volunteer' && (
          <>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('startDate')}
                value={formData.startDate || ''}
                onChange={(e) => handleChange('startDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('endDate')}
                value={formData.endDate || ''}
                onChange={(e) => handleChange('endDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="time"
                label={t('startTime')}
                value={formData.startTime || ''}
                onChange={(e) => handleChange('startTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="time"
                label={t('endTime')}
                value={formData.endTime || ''}
                onChange={(e) => handleChange('endTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
          </>
        )}

        {formData.applicationType === 'FABLAB Visit' && (
          <>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label={t('visitDate')}
                value={formData.visitDate || ''}
                onChange={(e) => handleChange('visitDate', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="time"
                label={t('visitStartTime')}
                value={formData.visitStartTime || ''}
                onChange={(e) => handleChange('visitStartTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="time"
                label={t('visitEndTime')}
                value={formData.visitEndTime || ''}
                onChange={(e) => handleChange('visitEndTime', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
          </>
        )}
      </Grid>

      <Box className="form-step-buttons">
        <Button variant="outlined" onClick={onBack} size="large">
          {t('previous')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onNext}
          disabled={!canProceed()}
          size="large"
        >
          {t('next')}
        </Button>
      </Box>
    </Box>
  );
};

export default DateTimeSelection;
