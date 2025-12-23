import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Grid, Card, CardContent, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';

const ApplicationType = ({ formData, onChange, onNext }) => {
  const { t } = useTranslation();

  const applicationTypes = [
    { value: 'Beneficiary', label: t('beneficiary') },
    { value: 'Visitor', label: t('visitor') },
    { value: 'Volunteer', label: t('volunteer') },
    { value: 'Talented', label: t('talented') },
    { value: 'Entity', label: t('entity') },
    { value: 'FABLAB Visit', label: t('fablabVisit') }
  ];

  const handleSelect = (type) => {
    onChange({ applicationType: type });
  };

  const canProceed = formData.applicationType !== '';

  return (
    <Box className="form-step">
      <Typography variant="h5" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        {t('section1')}
      </Typography>

      <Grid container spacing={3}>
        {applicationTypes.map((type, index) => (
          <Grid item xs={12} sm={6} md={4} key={type.value}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`section-card ${formData.applicationType === type.value ? 'selected' : ''}`}
                onClick={() => handleSelect(type.value)}
                sx={{ cursor: 'pointer', height: '100%' }}
              >
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {type.label}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      <Box className="form-step-buttons">
        <div />
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

export default ApplicationType;
