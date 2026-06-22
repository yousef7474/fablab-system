const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// ============== WORKER PROFILE ROUTES ==============

// Get all workers
router.get('/', workerController.getAllWorkers);

// Get single worker
router.get('/:id', workerController.getWorkerById);

// Create worker (manager or admin only)
router.post('/', requireManager, workerController.createWorker);

// Update worker (manager or admin only)
router.put('/:id', requireManager, workerController.updateWorker);

// Delete worker (manager or admin only)
router.delete('/:id', requireManager, workerController.deleteWorker);

// ============== WORKER OPPORTUNITY ROUTES ==============

// Get all opportunities
router.get('/opportunities/all', workerController.getAllOpportunities);

// Export opportunities as CSV
router.get('/opportunities/export', workerController.exportOpportunities);

// Create opportunity (manager or admin only)
router.post('/opportunities', requireManager, workerController.createOpportunity);

// Update opportunity (manager or admin only)
router.put('/opportunities/:id', requireManager, workerController.updateOpportunity);

// Adjust hours for opportunity (manager or admin only)
router.patch('/opportunities/:id/hours', requireManager, workerController.adjustOpportunityHours);

// Delete opportunity (manager or admin only)
router.delete('/opportunities/:id', requireManager, workerController.deleteOpportunity);

// ============== WORKER RATING ROUTES ==============

// Get ratings for a worker
router.get('/:workerId/ratings', workerController.getWorkerRatings);

// Create worker rating (manager or admin only)
router.post('/ratings', requireManager, workerController.createWorkerRating);

// Delete worker rating (manager or admin only)
router.delete('/ratings/:id', requireManager, workerController.deleteWorkerRating);

// ============== WORKER RECEIPTS ==============

router.get('/:id/receipts', workerController.listWorkerReceipts);
router.post('/:id/receipts', requireManager, workerController.createWorkerReceipt);
router.delete('/receipts/:id', requireManager, workerController.deleteWorkerReceipt);

module.exports = router;
