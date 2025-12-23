import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Grid, Card, CardContent, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';

const FablabSection = ({ formData, onChange, onNext, onBack }) => {
  const { t } = useTranslation();

  const sections = [
    { value: 'Electronics and Programming', label: t('electronicsAndProgramming') },
    { value: 'CNC Laser', label: t('cncLaser') },
    { value: 'CNC Wood', label: t('cncWood') },
    { value: '3D', label: t('3d') },
    { value: 'Robotic and AI', label: t('roboticAndAI') },
    { value: "Kid's Club", label: t('kidsClub') },
    { value: 'Vinyl Cutting', label: t('vinylCutting') }
  ];

  const handleSelect = (section) => {
    onChange({ fablabSection: section });
  };

  const canProceed = formData.fablabSection !== '';

  return (
    <Box className="form-step">
      <Typography variant="h5" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        {t('section3')}
      </Typography>

      <Grid container spacing={3}>
        {sections.map((section, index) => (
          <Grid item xs={12} sm={6} md={4} key={section.value}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={`section-card ${formData.fablabSection === section.value ? 'selected' : ''}`}
                onClick={() => handleSelect(section.value)}
              >
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {section.label}
                  </Typography>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

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

export default FablabSection;
