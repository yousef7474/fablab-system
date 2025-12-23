import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, TextField, Button, Grid, Typography, MenuItem } from '@mui/material';

const ApplicationData = ({ formData, onChange, onNext, onBack }) => {
  const { t } = useTranslation();

  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };

  const canProceed = () => {
    if (['Beneficiary', 'Visitor', 'Volunteer', 'Talented'].includes(formData.applicationType)) {
      return formData.firstName && formData.lastName && formData.phoneNumber && formData.email;
    } else if (formData.applicationType === 'Entity') {
      return formData.entityName && formData.name && formData.phoneNumber && formData.email;
    } else if (formData.applicationType === 'FABLAB Visit') {
      return formData.visitingEntity && formData.personInCharge && formData.phoneNumber && formData.email;
    }
    return false;
  };

  return (
    <Box className="form-step">
      <Typography variant="h5" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        {t('section2')}
      </Typography>

      <Grid container spacing={3}>
        {['Beneficiary', 'Visitor', 'Volunteer', 'Talented'].includes(formData.applicationType) && (
          <>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('firstName')}
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('lastName')}
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label={t('sex')}
                value={formData.sex}
                onChange={(e) => handleChange('sex', e.target.value)}
              >
                <MenuItem value="Male">{t('male')}</MenuItem>
                <MenuItem value="Female">{t('female')}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('nationality')}
                value={formData.nationality}
                onChange={(e) => handleChange('nationality', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('nationalId')}
                value={formData.nationalId}
                onChange={(e) => handleChange('nationalId', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('currentJob')}
                value={formData.currentJob}
                onChange={(e) => handleChange('currentJob', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('nationalAddress')}
                value={formData.nationalAddress}
                onChange={(e) => handleChange('nationalAddress', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>
          </>
        )}

        {formData.applicationType === 'Entity' && (
          <>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label={t('entity')}
                value={formData.entityName}
                onChange={(e) => handleChange('entityName', e.target.value)}
                required
              >
                <MenuItem value="FABLAB AL-Ahsa">{t('fablabAlAhsa')}</MenuItem>
                <MenuItem value="Noura Al-Mousa House for Culture and Arts">{t('nouraHouse')}</MenuItem>
                <MenuItem value="Al-Ahsa Academy for Crafts">{t('ahsaAcademy')}</MenuItem>
                <MenuItem value="Creativity and Innovation Training Center">{t('innovationCenter')}</MenuItem>
                <MenuItem value="Abdulmonem Al-Rashed Foundation">{t('rashedFoundation')}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('name')}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </Grid>
          </>
        )}

        {formData.applicationType === 'FABLAB Visit' && (
          <>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('visitingEntity')}
                value={formData.visitingEntity}
                onChange={(e) => handleChange('visitingEntity', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('personInCharge')}
                value={formData.personInCharge}
                onChange={(e) => handleChange('personInCharge', e.target.value)}
                required
              />
            </Grid>
          </>
        )}

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label={t('phoneNumber')}
            value={formData.phoneNumber}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="email"
            label={t('email')}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            required
          />
        </Grid>
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

export default ApplicationData;
