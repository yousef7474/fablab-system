const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/fablabStaffController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// CRUD
router.get('/', ctrl.getAllStaff);
router.get('/:id', ctrl.getStaffById);
router.post('/', requireManager, ctrl.createStaff);
router.put('/:id', requireManager, ctrl.updateStaff);
router.delete('/:id', requireManager, ctrl.deleteStaff);

// ID cards
router.get('/:id/card', ctrl.getStaffCard);
router.post('/cards', ctrl.getStaffCardsBulk);

// Attendance
router.post('/attendance/scan', ctrl.scanAttendance);
router.get('/attendance/today', ctrl.todayAttendance);
router.delete('/attendance/today', requireManager, ctrl.clearTodayAttendance);
router.get('/:id/attendance', ctrl.listStaffAttendance);
router.patch('/attendance/:id/checkout', requireManager, ctrl.clearCheckout);
router.patch('/attendance/:id/annotate', requireManager, ctrl.annotateAttendance);
router.delete('/attendance/:id', requireManager, ctrl.deleteAttendance);

// Overtime (auto-derived) — path order matters: overtime overview
// BEFORE the parameterized :id/overtime.
router.get('/overtime', ctrl.listOvertime);
router.get('/:id/overtime', ctrl.listStaffOvertime);

module.exports = router;
