const express = require('express');
const router = express.Router();
const internController = require('../controllers/internController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// ============== INTERN PROFILE ROUTES ==============

// Get all interns
router.get('/', internController.getAllInterns);

// Get single intern
router.get('/:id', internController.getInternById);

// Create intern (manager or admin only)
router.post('/', requireManager, internController.createIntern);

// Update intern (manager or admin only)
router.put('/:id', requireManager, internController.updateIntern);

// Delete intern (manager or admin only)
router.delete('/:id', requireManager, internController.deleteIntern);

// ============== INTERN TRAINING ROUTES ==============

// Get all trainings
router.get('/trainings/all', internController.getAllTrainings);

// Export trainings as CSV
router.get('/trainings/export', internController.exportTrainings);

// Create training (manager or admin only)
router.post('/trainings', requireManager, internController.createTraining);

// Update training (manager or admin only)
router.put('/trainings/:id', requireManager, internController.updateTraining);

// Delete training (manager or admin only)
router.delete('/trainings/:id', requireManager, internController.deleteTraining);

// ============== INTERN RATING ROUTES ==============

// Get ratings for an intern
router.get('/:internId/ratings', internController.getInternRatings);

// Create intern rating (manager or admin only)
router.post('/ratings', requireManager, internController.createInternRating);

// Delete intern rating (manager or admin only)
router.delete('/ratings/:id', requireManager, internController.deleteInternRating);

module.exports = router;
