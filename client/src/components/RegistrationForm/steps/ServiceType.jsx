import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, RadioGroup, FormControlLabel, Radio, Button, Typography } from '@mui/material';

const ServiceType = ({ formData, onChange, onNext, onBack }) => {
  const { t } = useTranslation();

  const serviceTypes = [
    { value: 'From official partners', label: t('officialPartners') },
    { value: 'Free', label: t('free') },
    { value: 'Partial Financial compensation', label: t('partialCompensation') },
    { value: 'Full Financial compensation', label: t('fullCompensation') }
  ];

  const canProceed = formData.serviceType !== '';

  return (
    <Box className="form-step">
      <Typography variant="h5" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        {t('section7')}
      </Typography>

      <RadioGroup
        value={formData.serviceType}
        onChange={(e) => onChange({ serviceType: e.target.value })}
      >
        {serviceTypes.map((type) => (
          <FormControlLabel
            key={type.value}
            value={type.value}
            control={<Radio />}
            label={type.label}
            sx={{ mb: 2 }}
          />
        ))}
      </RadioGroup>

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

export default ServiceType;
