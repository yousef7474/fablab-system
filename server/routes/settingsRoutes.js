const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

// Public - used by registration form and chatbot
router.get('/working-hours', settingsController.getWorkingHours);
router.get('/registration-status', settingsController.getRegistrationStatus);
router.get('/store-status', settingsController.getStoreStatus);
router.get('/print3d-status', settingsController.getPrint3dStatus);

// Admin-protected
router.put('/working-hours', authMiddleware, settingsController.updateWorkingHours);
router.put('/registration-status', authMiddleware, settingsController.updateRegistrationStatus);
router.put('/store-status', authMiddleware, settingsController.updateStoreStatus);
router.put('/print3d-status', authMiddleware, settingsController.updatePrint3dStatus);
router.get('/calendar-prefs', authMiddleware, settingsController.getCalendarPrefs);
router.put('/calendar-prefs', authMiddleware, settingsController.updateCalendarPrefs);
router.get('/quick-messages', authMiddleware, settingsController.getQuickMessages);
router.put('/quick-messages', authMiddleware, settingsController.updateQuickMessages);
router.get('/quick-forms', authMiddleware, settingsController.getQuickForms);
router.put('/quick-forms', authMiddleware, settingsController.updateQuickForms);
router.get('/quick-forms/:id/download', authMiddleware, settingsController.downloadQuickForm);
router.get('/store-categories', authMiddleware, settingsController.getStoreCategories);
router.put('/store-categories', authMiddleware, settingsController.updateStoreCategories);

module.exports = router;
