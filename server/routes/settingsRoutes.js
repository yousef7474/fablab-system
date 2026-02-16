const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');

// Public - used by registration form and chatbot
router.get('/working-hours', settingsController.getWorkingHours);

// Admin-protected
router.put('/working-hours', authMiddleware, settingsController.updateWorkingHours);

module.exports = router;
