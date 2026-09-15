const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const activityController = require('../controllers/activityController');
const calendarEventController = require('../controllers/calendarEventController');
const employeeAuth = require('../middleware/employeeAuth');
const adminAuth = require('../middleware/auth');

// Public
router.post('/login', employeeController.login);

// Employee-authenticated routes
router.get('/profile', employeeAuth, employeeController.getProfile);
router.post('/change-password', employeeAuth, employeeController.changePassword);
router.get('/my-tasks', employeeAuth, employeeController.getMyTasks);
router.post('/my-tasks', employeeAuth, employeeController.createMyTask);
router.patch('/my-tasks/:id/status', employeeAuth, employeeController.updateMyTaskStatus);

// Section-scoped registration requests — same rows as the admin
// panel, filtered to the employee's own sections. Employee actions
// update the shared row so admin sees the outcome.
router.get('/my-registrations',              employeeAuth, employeeController.getMyRegistrations);
router.patch('/my-registrations/:id/status', employeeAuth, employeeController.updateMyRegistrationStatus);

// Employee-owned overtime requests. Row lives in the shared
// overtime_requests table so the manager Approvals hub already sees
// it once sent; here we just let the employee CRUD their own drafts.
router.get('/my-overtime',                        employeeAuth, employeeController.getMyOvertime);
router.post('/my-overtime',                       employeeAuth, employeeController.createMyOvertime);
router.put('/my-overtime/:id',                    employeeAuth, employeeController.updateMyOvertime);
router.delete('/my-overtime/:id',                 employeeAuth, employeeController.deleteMyOvertime);
router.post('/my-overtime/:id/send-for-approval', employeeAuth, employeeController.sendMyOvertimeForApproval);
// Auto-computed overtime rows (from QR-scan attendance) + full
// attendance history for the employee's linked FabLab-staff record.
router.get('/my-staff-overtime',                  employeeAuth, employeeController.getMyStaffOvertime);
router.get('/my-attendance',                      employeeAuth, employeeController.getMyAttendance);
router.get('/my-ratings', employeeAuth, employeeController.getMyRatings);
router.get('/my-evaluations', employeeAuth, employeeController.getMyEvaluations);
router.get('/my-schedule', employeeAuth, employeeController.getMySchedule);
router.post('/activity/login', employeeAuth, activityController.recordLogin);
router.post('/activity/heartbeat', employeeAuth, activityController.heartbeat);
router.post('/activity/interaction', employeeAuth, activityController.recordInteraction);
router.get('/activity/my-weekly', employeeAuth, activityController.getMyWeeklyStats);

// Read-only year calendar for the employee dashboard. Employees see the
// same events and Saudi holidays admins see, but cannot create / edit /
// delete — the write routes stay under /api/calendar-events (adminAuth).
router.get('/calendar-events/saudi-holidays', employeeAuth, calendarEventController.saudiHolidays);
router.get('/calendar-events',                employeeAuth, calendarEventController.list);

// Manager views employee activity (requires admin auth)
router.get('/activity/all', adminAuth, activityController.getAllEmployeeStats);

// Admin/Manager generates credentials for an employee
router.post('/:employeeId/generate-credentials', adminAuth, employeeController.generateCredentials);

module.exports = router;
