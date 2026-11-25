const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const workspaceRequestController = require('../controllers/workspaceRequestController');
const authMiddleware = require('../middleware/auth');
const { print3dAuth } = require('../middleware/print3dAccess');

// Public - used by registration form and chatbot
router.get('/working-hours', settingsController.getWorkingHours);
router.get('/registration-status', settingsController.getRegistrationStatus);
router.get('/store-status', settingsController.getStoreStatus);
router.get('/fablab-visit-status', settingsController.getFablabVisitStatus);
router.get('/print3d-status', settingsController.getPrint3dStatus);
router.get('/workspace-registration-status', workspaceRequestController.getRegistrationStatus);

// Admin-protected
router.put('/working-hours', authMiddleware, settingsController.updateWorkingHours);
router.put('/registration-status', authMiddleware, settingsController.updateRegistrationStatus);
router.put('/store-status', authMiddleware, settingsController.updateStoreStatus);
router.put('/fablab-visit-status', authMiddleware, settingsController.updateFablabVisitStatus);
// Admins and the 3D printing staff (employee board) open / close the service.
router.put('/print3d-status', print3dAuth, settingsController.updatePrint3dStatus);
router.put('/workspace-registration-status', authMiddleware, workspaceRequestController.updateRegistrationStatus);
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
