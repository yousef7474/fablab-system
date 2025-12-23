const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');

// Public routes
router.post('/check-user', registrationController.checkUser);
router.get('/available-slots', registrationController.getAvailableSlots);
router.post('/create', registrationController.createRegistration);

module.exports = router;
