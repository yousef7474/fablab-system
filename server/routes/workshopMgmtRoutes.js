const express = require('express');
const router = express.Router();
const controller = require('../controllers/workshopController');
const adminAuth = require('../middleware/auth');
const employeeAuth = require('../middleware/employeeAuth');
const { requireManager } = require('../middleware/roleMiddleware');

// Public routes
router.get('/lookup-student', controller.lookupStudent);
router.get('/check-duplicate', controller.checkDuplicate);

// Admin email & attendance ID routes
router.get('/:id/export-csv', adminAuth, controller.exportStudentsCSV);
router.post('/:id/email-all', adminAuth, controller.emailAllStudents);
router.post('/students/:id/email', adminAuth, controller.emailOneStudent);
router.post('/students/:id/send-attendance-id', adminAuth, controller.sendAttendanceId);
router.post('/students/:id/send-certificate', adminAuth, controller.sendCertificate);
router.get('/students/:id/attendance-id', adminAuth, controller.getAttendanceIdHtml);
router.post('/register', controller.registerStudent);
router.get('/active', controller.getActiveWorkshops);

// Employee routes (must be before /:id to avoid conflicts)
router.get('/employee/my-workshops', employeeAuth, controller.getMyWorkshops);
router.patch('/employee/students/:id/attendance', employeeAuth, controller.markAttendanceEmployee);
router.patch('/employee/students/:id/rate', employeeAuth, controller.rateStudentEmployee);

// Admin routes
router.get('/', adminAuth, controller.getAllWorkshops);
router.post('/', adminAuth, requireManager, controller.createWorkshop);
router.get('/:id', adminAuth, controller.getWorkshopById);
router.put('/:id', adminAuth, requireManager, controller.updateWorkshop);
router.delete('/:id', adminAuth, requireManager, controller.deleteWorkshop);
router.patch('/students/:id/verify', adminAuth, controller.verifyPayment);
router.delete('/students/:id', adminAuth, controller.deleteStudent);
router.put('/students/:id', adminAuth, controller.updateStudent);
router.patch('/students/:id/attendance', adminAuth, controller.markAttendance);
router.patch('/students/:id/rate', adminAuth, controller.rateStudent);

module.exports = router;
