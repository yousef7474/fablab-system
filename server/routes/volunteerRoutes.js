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

// Adjust hours for opportunity (manager or admin only)
router.patch('/opportunities/:id/hours', requireManager, volunteerController.adjustOpportunityHours);

// Delete opportunity (manager or admin only)
router.delete('/opportunities/:id', requireManager, volunteerController.deleteOpportunity);

// ============== VOLUNTEER RATING ROUTES ==============

// Get ratings for a volunteer
router.get('/:volunteerId/ratings', volunteerController.getVolunteerRatings);

// Create volunteer rating (manager or admin only)
router.post('/ratings', requireManager, volunteerController.createVolunteerRating);

// Delete volunteer rating (manager or admin only)
router.delete('/ratings/:id', requireManager, volunteerController.deleteVolunteerRating);

// ============== VOLUNTEER ID CARD (QR) ==============

router.get('/:id/card', volunteerController.getVolunteerCard);
router.post('/cards', volunteerController.getVolunteerCardsBulk);

// ============== VOLUNTEER ATTENDANCE ==============

router.post('/attendance/scan', volunteerController.scanAttendance);
router.get('/attendance/today', volunteerController.todayAttendance);
router.delete('/attendance/today', requireManager, volunteerController.clearTodayAttendance);
router.get('/:id/attendance', volunteerController.listVolunteerAttendance);
router.patch('/attendance/:id/checkout', requireManager, volunteerController.clearCheckout);
router.delete('/attendance/:id', requireManager, volunteerController.deleteAttendance);
router.post('/attendance/export', volunteerController.exportAttendance);

// ============== VOLUNTEER PUBLIC SHARE (admin side) ==============

router.get('/share/master-token', volunteerController.getMasterShareToken);
router.post('/share/master-token/rotate', requireManager, volunteerController.rotateMasterShareToken);
router.patch('/:id/share', requireManager, volunteerController.updateVolunteerShare);
router.post('/:id/share/rotate', requireManager, volunteerController.rotateVolunteerShareToken);

// ============== VOLUNTEER RECEIPTS ==============

router.get('/:id/receipts', volunteerController.listVolunteerReceipts);
router.post('/:id/receipts', requireManager, volunteerController.createVolunteerReceipt);
router.delete('/receipts/:id', requireManager, volunteerController.deleteVolunteerReceipt);

module.exports = router;
