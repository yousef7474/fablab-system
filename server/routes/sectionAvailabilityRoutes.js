const express = require('express');
const router = express.Router();
const sectionAvailabilityController = require('../controllers/sectionAvailabilityController');
const authMiddleware = require('../middleware/auth');

// Public route - Get all sections status (for registration form)
router.get('/availability', sectionAvailabilityController.getAllSectionsStatus);

// Protected routes - Admin only
router.get('/availability/history', authMiddleware, sectionAvailabilityController.getDeactivationHistory);
router.post('/availability', authMiddleware, sectionAvailabilityController.deactivateSection);
router.patch('/availability/:id/reactivate', authMiddleware, sectionAvailabilityController.reactivateSection);
router.put('/availability/:id', authMiddleware, sectionAvailabilityController.updateDeactivation);
router.delete('/availability/:id', authMiddleware, sectionAvailabilityController.deleteDeactivation);

module.exports = router;
