const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mawhbaController');
const authMiddleware = require('../middleware/auth');

router.get('/students', authMiddleware, ctrl.list);
router.get('/courses', authMiddleware, ctrl.listCourses);
router.get('/course-colors', authMiddleware, ctrl.listCourseColors);
router.post('/course-colors', authMiddleware, ctrl.setCourseColor);
router.post('/attendance/scan', authMiddleware, ctrl.scanAttendance);
router.get('/attendance/today', authMiddleware, ctrl.todayAttendance);
router.delete('/attendance/today', authMiddleware, ctrl.clearTodayAttendance);
router.get('/students/:id/attendance', authMiddleware, ctrl.listStudentAttendance);
router.delete('/attendance/:id', authMiddleware, ctrl.deleteAttendance);
router.post('/attendance/export', authMiddleware, ctrl.exportAttendance);
router.post('/students', authMiddleware, ctrl.create);
router.put('/students/:id', authMiddleware, ctrl.update);
router.delete('/students/:id', authMiddleware, ctrl.remove);
router.post('/send-email', authMiddleware, ctrl.sendEmail);
router.get('/students/:id/card', authMiddleware, ctrl.cardData);
router.post('/cards', authMiddleware, ctrl.cardsBulk);
router.post('/students/:id/email-card', authMiddleware, ctrl.emailCard);
router.post('/email-cards-bulk', authMiddleware, ctrl.emailCardsBulk);

module.exports = router;
