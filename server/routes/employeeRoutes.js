const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const activityController = require('../controllers/activityController');
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
router.get('/my-ratings', employeeAuth, employeeController.getMyRatings);
router.get('/my-evaluations', employeeAuth, employeeController.getMyEvaluations);
router.get('/my-schedule', employeeAuth, employeeController.getMySchedule);
router.post('/activity/login', employeeAuth, activityController.recordLogin);
router.post('/activity/heartbeat', employeeAuth, activityController.heartbeat);
router.post('/activity/interaction', employeeAuth, activityController.recordInteraction);
router.get('/activity/my-weekly', employeeAuth, activityController.getMyWeeklyStats);

// Manager views employee activity (requires admin auth)
router.get('/activity/all', adminAuth, activityController.getAllEmployeeStats);

// Admin/Manager generates credentials for an employee
router.post('/:employeeId/generate-credentials', adminAuth, employeeController.generateCredentials);

module.exports = router;
