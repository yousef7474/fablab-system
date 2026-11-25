const express = require('express');
const ctrl = require('../controllers/workspaceRequestController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Public workspace registration page (/workspace). Never 401: the client
// sends any 401 to the sign-in page.
const publicRouter = express.Router();
publicRouter.get('/status', ctrl.publicStatus);
publicRouter.get('/calendar', ctrl.publicCalendar);
publicRouter.get('/availability', ctrl.publicAvailability);
publicRouter.post('/lookup', ctrl.publicLookup);
publicRouter.post('/submit', ctrl.publicSubmit);

const adminRouter = express.Router();
adminRouter.use(authMiddleware);
// Attendance station (any admin, like the other scan endpoints).
adminRouter.post('/attendance/scan', ctrl.scanAttendance);
adminRouter.get('/attendance/today', ctrl.attendanceToday);
adminRouter.delete('/attendance/today', ctrl.clearAttendanceToday);
// Admin + manager boards: review, print, rate day by day.
adminRouter.use(requireManager);
adminRouter.get('/', ctrl.list);
adminRouter.delete('/logs/:logId', ctrl.removeLog);
adminRouter.patch('/:id/decision', ctrl.decide);
adminRouter.get('/:id/cards', ctrl.cards);
adminRouter.get('/:id/logs', ctrl.listLogs);
adminRouter.post('/:id/logs', ctrl.addLog);
adminRouter.delete('/:id', ctrl.remove);

module.exports = { publicRouter, adminRouter };
