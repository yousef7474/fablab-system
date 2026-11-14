const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// The shared staff sign-in (admin, manager and employee).
router.post('/login', authController.login);

module.exports = router;
