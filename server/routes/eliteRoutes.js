const express = require('express');
const router = express.Router();
const eliteController = require('../controllers/eliteController');
const eliteRatingController = require('../controllers/eliteRatingController');
const eliteTaskController = require('../controllers/eliteTaskController');
const eliteWorkController = require('../controllers/eliteWorkController');
const eliteScheduleController = require('../controllers/eliteScheduleController');

// Public routes
router.post('/register', eliteController.register);
router.post('/login', eliteController.login);

// Admin routes (can add auth middleware later)
router.get('/users', eliteController.getAllEliteUsers);
router.get('/users/:id', eliteController.getEliteUserById);
router.patch('/users/:id/status', eliteController.updateStatus);
router.delete('/users/:id', eliteController.deleteEliteUser);

// Performance routes
router.get('/performance', eliteRatingController.getAllElitePerformance);
router.get('/performance/:eliteId', eliteRatingController.getElitePerformance);

// Rating routes
router.get('/ratings/:eliteId', eliteRatingController.getEliteRatings);
router.post('/ratings', eliteRatingController.createEliteRating);
router.put('/ratings/:ratingId', eliteRatingController.updateEliteRating);
router.delete('/ratings/:ratingId', eliteRatingController.deleteEliteRating);

// Credit routes
router.get('/credits/:eliteId', eliteRatingController.getEliteCredits);
router.post('/credits', eliteRatingController.addEliteCredit);
router.delete('/credits/:creditId', eliteRatingController.deleteEliteCredit);

// Task routes
router.get('/tasks', eliteTaskController.getAllTasks);
router.get('/tasks/user/:eliteId', eliteTaskController.getTasksByEliteId);
router.get('/tasks/:taskId', eliteTaskController.getTaskById);
router.post('/tasks', eliteTaskController.createTask);
router.put('/tasks/:taskId', eliteTaskController.updateTask);
router.patch('/tasks/:taskId/progress', eliteTaskController.updateTaskProgress);
router.patch('/tasks/:taskId/complete', eliteTaskController.completeTask);
router.delete('/tasks/:taskId', eliteTaskController.deleteTask);

// Work routes
router.get('/works', eliteWorkController.getAllWorks);
router.get('/works/user/:eliteId', eliteWorkController.getWorksByEliteId);
router.get('/works/:workId', eliteWorkController.getWorkById);
router.post('/works', eliteWorkController.createWork);
router.put('/works/:workId', eliteWorkController.updateWork);
router.patch('/works/:workId/submit', eliteWorkController.submitWork);
router.patch('/works/:workId/review', eliteWorkController.reviewWork);
router.delete('/works/:workId', eliteWorkController.deleteWork);

// Schedule routes
router.get('/schedules', eliteScheduleController.getAllSchedules);
router.get('/schedules/user/:eliteId', eliteScheduleController.getSchedulesByEliteId);
router.get('/schedules/upcoming/:eliteId', eliteScheduleController.getUpcomingSchedules);
router.get('/schedules/:scheduleId', eliteScheduleController.getScheduleById);
router.post('/schedules', eliteScheduleController.createSchedule);
router.put('/schedules/:scheduleId', eliteScheduleController.updateSchedule);
router.patch('/schedules/:scheduleId/status', eliteScheduleController.updateScheduleStatus);
router.delete('/schedules/:scheduleId', eliteScheduleController.deleteSchedule);

module.exports = router;
