const express = require('express');
const router = express.Router();
const workingHoursOverrideController = require('../controllers/workingHoursOverrideController');
const authMiddleware = require('../middleware/auth');

// Public - used by registration form calendar
router.get('/active', workingHoursOverrideController.getActiveOverrides);

// Admin-protected
router.get('/', authMiddleware, workingHoursOverrideController.getAllOverrides);
router.post('/', authMiddleware, workingHoursOverrideController.createOverride);
router.delete('/:id', authMiddleware, workingHoursOverrideController.deleteOverride);

module.exports = router;
