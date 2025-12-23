const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.post('/login', adminController.login);

// Protected routes
router.post('/create-admin', authMiddleware, adminController.createAdmin);
router.get('/registrations', authMiddleware, adminController.getAllRegistrations);
router.get('/registrations/:id', authMiddleware, adminController.getRegistrationById);
router.put('/registrations/:id/status', authMiddleware, adminController.updateRegistrationStatus);
router.put('/registrations/:id', authMiddleware, adminController.updateRegistration);
router.delete('/registrations/:id', authMiddleware, adminController.deleteRegistration);
router.get('/users/:userId', authMiddleware, adminController.getUserProfile);
router.get('/analytics', authMiddleware, adminController.getAnalytics);
router.post('/export-csv', authMiddleware, adminController.exportToCSV);

module.exports = router;
