const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.post('/login', adminController.login);

// Protected routes
router.post('/create-admin', authMiddleware, adminController.createAdmin);

// Registration routes
router.get('/registrations', authMiddleware, adminController.getAllRegistrations);
router.get('/registrations/:id', authMiddleware, adminController.getRegistrationById);
router.put('/registrations/:id/status', authMiddleware, adminController.updateRegistrationStatus);
router.patch('/registrations/:id/status', authMiddleware, adminController.updateRegistrationStatus);
router.put('/registrations/:id', authMiddleware, adminController.updateRegistration);
router.delete('/registrations/:id', authMiddleware, adminController.deleteRegistration);

// User routes
router.get('/users', authMiddleware, adminController.getAllUsers);
router.get('/users/:userId', authMiddleware, adminController.getUserProfile);
router.get('/users/:userId/registrations', authMiddleware, adminController.getUserWithRegistrations);
router.put('/users/:userId', authMiddleware, adminController.updateUser);
router.delete('/users/:userId', authMiddleware, adminController.deleteUser);

// Employee routes
router.get('/employees', authMiddleware, adminController.getAllEmployees);
router.post('/employees', authMiddleware, adminController.createEmployee);
router.put('/employees/:id', authMiddleware, adminController.updateEmployee);
router.delete('/employees/:id', authMiddleware, adminController.deleteEmployee);

// Schedule routes
router.get('/schedule', authMiddleware, adminController.getSchedule);

// Analytics routes
router.get('/analytics', authMiddleware, adminController.getAnalytics);
router.get('/analytics/enhanced', authMiddleware, adminController.getEnhancedAnalytics);

// Export routes
router.post('/export-csv', authMiddleware, adminController.exportToCSV);
router.get('/export/csv', authMiddleware, adminController.exportToCSV);

// Bulk operations
router.post('/registrations/bulk-delete', authMiddleware, adminController.bulkDeleteRegistrations);
router.post('/registrations/export-selected', authMiddleware, adminController.exportSelectedCSV);
router.post('/users/export-selected', authMiddleware, adminController.exportSelectedUsersCSV);

module.exports = router;
