const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/volunteerController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(authMiddleware);

// ============== VOLUNTEER PROFILE ROUTES ==============

// Get all volunteers
router.get('/', volunteerController.getAllVolunteers);

// Get single volunteer
router.get('/:id', volunteerController.getVolunteerById);

// Create volunteer (manager or admin only)
router.post('/', requireManager, volunteerController.createVolunteer);

// Update volunteer (manager or admin only)
router.put('/:id', requireManager, volunteerController.updateVolunteer);

// Delete volunteer (manager or admin only)
router.delete('/:id', requireManager, volunteerController.deleteVolunteer);

// ============== VOLUNTEER OPPORTUNITY ROUTES ==============

// Get all opportunities
router.get('/opportunities/all', volunteerController.getAllOpportunities);

// Export opportunities as CSV
router.get('/opportunities/export', volunteerController.exportOpportunities);

// Create opportunity (manager or admin only)
router.post('/opportunities', requireManager, volunteerController.createOpportunity);

// Update opportunity (manager or admin only)
router.put('/opportunities/:id', requireManager, volunteerController.updateOpportunity);

// Delete opportunity (manager or admin only)
router.delete('/opportunities/:id', requireManager, volunteerController.deleteOpportunity);

module.exports = router;
