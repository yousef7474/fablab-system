const express = require('express');
const router = express.Router();
const borrowingController = require('../controllers/borrowingController');
const authMiddleware = require('../middleware/auth');

// Public routes
router.post('/check-user', borrowingController.checkUser);
router.post('/create', borrowingController.createBorrowing);
router.get('/user/:identifier', borrowingController.getMyBorrowings);

// Admin routes (auth required)
router.get('/', authMiddleware, borrowingController.getAllBorrowings);
router.get('/:id', authMiddleware, borrowingController.getBorrowingById);
router.put('/:id/status', authMiddleware, borrowingController.updateBorrowingStatus);
router.put('/:id/return', authMiddleware, borrowingController.markAsReturned);

module.exports = router;
