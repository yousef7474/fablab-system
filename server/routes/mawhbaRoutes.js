const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mawhbaController');
const authMiddleware = require('../middleware/auth');

router.get('/students', authMiddleware, ctrl.list);
router.post('/students', authMiddleware, ctrl.create);
router.put('/students/:id', authMiddleware, ctrl.update);
router.delete('/students/:id', authMiddleware, ctrl.remove);
router.post('/send-email', authMiddleware, ctrl.sendEmail);

module.exports = router;
