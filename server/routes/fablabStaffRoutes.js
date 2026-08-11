const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/fablabStaffController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// ---------------------------------------------------------------
// LITERAL-PATH routes MUST come before any parameterized /:id
// routes below, otherwise Express matches "/overtime" against
// GET /:id and hands the string "overtime" to FablabStaff.findByPk
// as a UUID — which Postgres rejects and returns as a 500.
// ---------------------------------------------------------------

// Overtime (auto-derived from attendance)
router.get('/overtime', ctrl.listOvertime);

// ID cards (bulk)
router.post('/cards', ctrl.getStaffCardsBulk);

// Attendance
router.post('/attendance/scan', ctrl.scanAttendance);
router.get('/attendance/today', ctrl.todayAttendance);
router.delete('/attendance/today', requireManager, ctrl.clearTodayAttendance);
router.post('/attendance', requireManager, ctrl.createManualAttendance);
router.patch('/attendance/:id/checkout', requireManager, ctrl.clearCheckout);
router.patch('/attendance/:id/annotate', requireManager, ctrl.annotateAttendance);
router.delete('/attendance/:id', requireManager, ctrl.deleteAttendance);

// Staff CRUD (parameterized routes last so the literal paths above
// are matched first)
router.get('/', ctrl.getAllStaff);
router.post('/', requireManager, ctrl.createStaff);
router.get('/:id', ctrl.getStaffById);
router.put('/:id', requireManager, ctrl.updateStaff);
router.delete('/:id', requireManager, ctrl.deleteStaff);
router.get('/:id/card', ctrl.getStaffCard);
router.get('/:id/attendance', ctrl.listStaffAttendance);
router.get('/:id/overtime', ctrl.listStaffOvertime);

module.exports = router;
