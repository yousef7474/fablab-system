const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mawhbaController');
const authMiddleware = require('../middleware/auth');

router.get('/students', authMiddleware, ctrl.list);
router.get('/courses', authMiddleware, ctrl.listCourses);
router.get('/course-colors', authMiddleware, ctrl.listCourseColors);
router.post('/course-colors', authMiddleware, ctrl.setCourseColor);
router.post('/students', authMiddleware, ctrl.create);
router.put('/students/:id', authMiddleware, ctrl.update);
router.delete('/students/:id', authMiddleware, ctrl.remove);
router.post('/send-email', authMiddleware, ctrl.sendEmail);
router.get('/students/:id/card', authMiddleware, ctrl.cardData);
router.post('/cards', authMiddleware, ctrl.cardsBulk);
router.post('/students/:id/email-card', authMiddleware, ctrl.emailCard);

module.exports = router;
