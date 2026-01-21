const express = require('express');
const router = express.Router();
const eliteController = require('../controllers/eliteController');

// Public routes
router.post('/register', eliteController.register);
router.post('/login', eliteController.login);

// Admin routes (can add auth middleware later)
router.get('/users', eliteController.getAllEliteUsers);
router.get('/users/:id', eliteController.getEliteUserById);
router.patch('/users/:id/status', eliteController.updateStatus);
router.delete('/users/:id', eliteController.deleteEliteUser);

module.exports = router;
