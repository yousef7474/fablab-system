const express = require('express');
const router = express.Router();
const educationController = require('../controllers/educationController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.post('/check-user', educationController.checkUser);
router.post('/create', educationController.createEducation);
router.get('/user/:identifier', educationController.getMyEducations);

// Auth routes
router.get('/', authMiddleware, educationController.getAllEducations);
router.get('/:id', authMiddleware, educationController.getEducationById);
router.put('/:id/status', authMiddleware, educationController.updateEducationStatus);

// Rating routes (auth)
router.post('/:id/ratings', authMiddleware, educationController.addRating);
router.get('/:id/ratings', authMiddleware, educationController.getRatings);
router.delete('/:id/ratings/:ratingId', authMiddleware, educationController.deleteRating);

module.exports = router;
