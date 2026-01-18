const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All routes require authentication and manager role
router.use(authMiddleware);
router.use(requireManager);

// Get workspace statistics
router.get('/statistics', workspaceController.getStatistics);

// Get all workspaces
router.get('/', workspaceController.getAllWorkspaces);

// Get workspace by ID
router.get('/:id', workspaceController.getWorkspaceById);

// Create new workspace
router.post('/', workspaceController.createWorkspace);

// Update workspace
router.put('/:id', workspaceController.updateWorkspace);

// Complete workspace
router.patch('/:id/complete', workspaceController.completeWorkspace);

// Delete workspace
router.delete('/:id', workspaceController.deleteWorkspace);

// Rating routes
router.get('/:id/ratings', workspaceController.getWorkspaceRatings);
router.post('/:id/ratings', workspaceController.addRating);
router.delete('/:id/ratings/:ratingId', workspaceController.deleteRating);

module.exports = router;
