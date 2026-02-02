const express = require('express');
const router = express.Router();
const eliteController = require('../controllers/eliteController');
const eliteRatingController = require('../controllers/eliteRatingController');

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

module.exports = router;
