const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

// Public - used by registration form and chatbot
router.get('/working-hours', settingsController.getWorkingHours);
router.get('/registration-status', settingsController.getRegistrationStatus);
router.get('/store-status', settingsController.getStoreStatus);

// Admin-protected
router.put('/working-hours', authMiddleware, settingsController.updateWorkingHours);
router.put('/registration-status', authMiddleware, settingsController.updateRegistrationStatus);
router.put('/store-status', authMiddleware, settingsController.updateStoreStatus);
router.get('/calendar-prefs', authMiddleware, settingsController.getCalendarPrefs);
router.put('/calendar-prefs', authMiddleware, settingsController.updateCalendarPrefs);

module.exports = router;
