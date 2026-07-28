const express = require('express');
const router = express.Router();
const programs = require('../controllers/summerProgramController');
const teachers = require('../controllers/summerTeacherController');
const students = require('../controllers/summerStudentController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Programs
router.get('/programs', programs.list);
router.post('/programs', requireManager, programs.create);
router.put('/programs/:id', requireManager, programs.update);
router.delete('/programs/:id', requireManager, programs.remove);

// Teachers
router.get('/teachers', teachers.list);
router.post('/teachers', requireManager, teachers.create);
router.put('/teachers/:id', requireManager, teachers.update);
router.delete('/teachers/:id', requireManager, teachers.remove);
router.post('/teacher-ratings', requireManager, teachers.addRating);
router.delete('/teacher-ratings/:id', requireManager, teachers.deleteRating);

// Students
router.get('/students', students.list);
router.post('/students', requireManager, students.create);
router.put('/students/:id', requireManager, students.update);
router.delete('/students/:id', requireManager, students.remove);

// Student ID cards (single + bulk 4-up)
router.get('/students/:id/card', students.cardData);
router.post('/students/cards',    students.cardsBulk);

// Attendance (QR-scan based, mirrors the Mawhba flow)
router.post('/attendance/scan',        students.scanAttendance);
router.get('/attendance/today',        students.todayAttendance);
router.delete('/attendance/today',     students.clearTodayAttendance);
router.get('/students/:id/attendance', students.listStudentAttendance);
router.patch('/attendance/:id/checkout', students.clearCheckout);
router.delete('/attendance/:id',       students.deleteAttendance);
router.post('/attendance/export',      students.exportAttendance);

module.exports = router;
