const express = require('express');
const router = express.Router();
const eliteController = require('../controllers/eliteController');
const eliteRatingController = require('../controllers/eliteRatingController');
const eliteTaskController = require('../controllers/eliteTaskController');
const eliteWorkController = require('../controllers/eliteWorkController');
const eliteScheduleController = require('../controllers/eliteScheduleController');
const eliteCourseController = require('../controllers/eliteCourseController');

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

// Course routes (Admin)
router.get('/courses', eliteCourseController.getAllCourses);
router.get('/courses/:courseId', eliteCourseController.getCourseById);
router.post('/courses', eliteCourseController.createCourse);
router.put('/courses/:courseId', eliteCourseController.updateCourse);
router.patch('/courses/:courseId/status', eliteCourseController.updateCourseStatus);
router.delete('/courses/:courseId', eliteCourseController.deleteCourse);

// Lesson routes
router.post('/courses/:courseId/lessons', eliteCourseController.addLesson);
router.put('/courses/:courseId/lessons/:lessonId', eliteCourseController.updateLesson);
router.delete('/courses/:courseId/lessons/:lessonId', eliteCourseController.deleteLesson);
router.patch('/courses/:courseId/lessons/reorder', eliteCourseController.reorderLessons);

// Enrollment routes
router.post('/courses/:courseId/enroll', eliteCourseController.enrollUsers);
router.delete('/courses/:courseId/enrollments/:enrollmentId', eliteCourseController.removeEnrollment);
router.get('/courses/:courseId/progress', eliteCourseController.getCourseProgress);

// Quiz routes (Admin)
router.put('/courses/:courseId/quiz', eliteCourseController.createOrUpdateQuiz);
router.get('/courses/:courseId/quiz', eliteCourseController.getQuizDetails);
router.patch('/courses/:courseId/quiz/attempts/:attemptId/grade', eliteCourseController.gradeWrittenAnswers);

// User-facing course routes
router.get('/my-courses', eliteCourseController.getMyCourses);
router.get('/my-courses/:courseId', eliteCourseController.getCourseDetail);
router.post('/my-courses/:courseId/lessons/:lessonId/access', eliteCourseController.accessLesson);
router.patch('/my-courses/:courseId/lessons/:lessonId/complete', eliteCourseController.markLessonComplete);
router.post('/my-courses/:courseId/quiz/start', eliteCourseController.startQuiz);
router.post('/my-courses/:courseId/quiz/submit', eliteCourseController.submitQuiz);
router.get('/my-courses/:courseId/quiz/result', eliteCourseController.getQuizResult);

module.exports = router;
