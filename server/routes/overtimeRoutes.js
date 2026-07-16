const express = require('express');
const router = express.Router();
const controller = require('../controllers/overtimeController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', controller.listOvertime);
router.get('/:id', controller.getOvertime);
router.post('/', requireManager, controller.createOvertime);
router.put('/:id', requireManager, controller.updateOvertime);
router.delete('/:id', requireManager, controller.deleteOvertime);

module.exports = router;
