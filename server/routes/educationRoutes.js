const express = require('express');
const router = express.Router();
const educationController = require('../controllers/educationController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.post('/check-user', educationController.checkUser);
router.post('/create', educationController.createEducation);
router.get('/user/:identifier', educationController.getMyEducations);
router.get('/verify/:id', educationController.verifyEducationId);
router.post('/:id/students', educationController.bulkAddStudents);

// Student management routes (auth) - must be before /:id to prevent route conflicts
router.put('/students/:studentId', authMiddleware, educationController.updateStudent);
router.delete('/students/:studentId', authMiddleware, educationController.removeStudent);

// Auth routes
router.get('/', authMiddleware, educationController.getAllEducations);
router.get('/:id', authMiddleware, educationController.getEducationById);
router.get('/:id/students', authMiddleware, educationController.getStudentsForEducation);
router.post('/:id/students/add', authMiddleware, educationController.addSingleStudent);
router.put('/:id/status', authMiddleware, educationController.updateEducationStatus);

// Custom email route (auth)
router.post('/:id/send-email', authMiddleware, educationController.sendCustomEmail);

// Rating routes (auth)
router.post('/:id/ratings', authMiddleware, educationController.addRating);
router.get('/:id/ratings', authMiddleware, educationController.getRatings);
router.delete('/:id/ratings/:ratingId', authMiddleware, educationController.deleteRating);

module.exports = router;
