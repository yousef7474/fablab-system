import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Paper, Button } from '@mui/material';
import { motion } from 'framer-motion';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import QRCode from 'react-qr-code';

const SuccessPage = ({ registration }) => {
  const { t } = useTranslation();

  const handlePrint = () => {
    window.print();
  };

  const handleNewRegistration = () => {
    window.location.reload();
  };

  return (
    <Box className="success-container" sx={{ py: 6, px: 3 }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <CheckCircleIcon
          sx={{ fontSize: 100, color: '#48BF85', mb: 3 }}
        />
      </motion.div>

      <Typography variant="h3" gutterBottom sx={{ color: '#48BF85', fontWeight: 700 }}>
        {t('registrationSuccess')}
      </Typography>

      <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
        Your registration has been submitted successfully!
      </Typography>

      <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto', mb: 4 }}>
        <Box className="barcode-container">
          <QRCode value={registration.registrationId} size={200} />
        </Box>

        <Box className="registration-details">
          <Box className="detail-row">
            <Typography className="detail-label">Registration ID:</Typography>
            <Typography className="detail-value">{registration.registrationId}</Typography>
          </Box>

          <Box className="detail-row">
            <Typography className="detail-label">User ID:</Typography>
            <Typography className="detail-value">{registration.userId}</Typography>
          </Box>

          <Box className="detail-row">
            <Typography className="detail-label">Name:</Typography>
            <Typography className="detail-value">{registration.userName}</Typography>
          </Box>

          <Box className="detail-row">
            <Typography className="detail-label">Section:</Typography>
            <Typography className="detail-value">{registration.fablabSection}</Typography>
          </Box>

          <Box className="detail-row">
            <Typography className="detail-label">Date:</Typography>
            <Typography className="detail-value">{registration.appointmentDate || 'N/A'}</Typography>
          </Box>

          <Box className="detail-row">
            <Typography className="detail-label">Time:</Typography>
            <Typography className="detail-value">{registration.appointmentTime || 'N/A'}</Typography>
          </Box>

          <Box className="detail-row">
            <Typography className="detail-label">Status:</Typography>
            <Typography className="detail-value" sx={{ color: '#EE2329', fontWeight: 600 }}>
              {registration.status.toUpperCase()}
            </Typography>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
          A confirmation email has been sent to you. You will receive another email once your registration is approved by our team.
        </Typography>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button variant="contained" color="primary" onClick={handlePrint} size="large">
          {t('print')}
        </Button>
        <Button variant="outlined" onClick={handleNewRegistration} size="large">
          New Registration
        </Button>
      </Box>
    </Box>
  );
};

export default SuccessPage;
