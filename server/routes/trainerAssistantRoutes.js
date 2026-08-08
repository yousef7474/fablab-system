const express = require('express');
const router = express.Router();
const controller = require('../controllers/trainerAssistantController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Trainers
router.get('/', controller.listTrainers);

// Attendance — path segments are literal, keep BEFORE '/:id' so
// they don't collide with the parameterised routes below.
router.post('/attendance/scan', controller.scanAttendance);
router.get('/attendance/today', controller.todayAttendance);
router.delete('/attendance/today', requireManager, controller.clearTodayAttendance);
router.post('/attendance', requireManager, controller.createManualAttendance);
router.patch('/attendance/:id/checkout', requireManager, controller.setOrClearCheckout);
router.delete('/attendance/:id', requireManager, controller.deleteAttendance);

// QR ID card
router.post('/cards', controller.getTrainerCardsBulk);

router.get('/:id', controller.getTrainer);
router.post('/', requireManager, controller.createTrainer);
router.put('/:id', requireManager, controller.updateTrainer);
router.delete('/:id', requireManager, controller.deleteTrainer);
router.post('/:id/send-email', requireManager, controller.sendEmail);
router.get('/:id/attendance', controller.listAttendance);
router.get('/:id/card', controller.getTrainerCard);

// Assignments (chances) — nested under trainer for create/list;
// updates/deletes address the assignment by its own id.
router.get('/:trainerId/assignments', controller.listAssignments);
router.post('/:trainerId/assignments', requireManager, controller.createAssignment);
router.put('/assignments/:id', requireManager, controller.updateAssignment);
router.delete('/assignments/:id', requireManager, controller.deleteAssignment);

module.exports = router;
