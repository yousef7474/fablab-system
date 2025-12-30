const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Get all ratings (with optional filters)
router.get('/', ratingController.getAllRatings);

// Get ratings for a specific employee
router.get('/employee/:employeeId', ratingController.getEmployeeRatings);

// Export ratings as CSV
router.get('/export', ratingController.exportRatings);

// Create new rating (manager or admin only)
router.post('/', requireManager, ratingController.createRating);

// Update rating (manager or admin only)
router.put('/:id', requireManager, ratingController.updateRating);

// Delete rating (manager or admin only)
router.delete('/:id', requireManager, ratingController.deleteRating);

module.exports = router;
