const express = require('express');
const router = express.Router();
const controller = require('../controllers/registrationClosureController');
const authMiddleware = require('../middleware/auth');

router.get('/', controller.list);                       // public
router.get('/all', authMiddleware, controller.listAll); // admin
router.post('/', authMiddleware, controller.create);    // admin
router.delete('/:id', authMiddleware, controller.remove); // admin

module.exports = router;
