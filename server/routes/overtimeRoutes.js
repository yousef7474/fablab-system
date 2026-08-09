const express = require('express');
const router = express.Router();
const controller = require('../controllers/overtimeController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Literal-path routes BEFORE /:id so they aren't shadowed
router.get('/pending', controller.listPendingOvertime);

router.get('/', controller.listOvertime);
router.post('/', requireManager, controller.createOvertime);

router.get('/:id', controller.getOvertime);
router.put('/:id', requireManager, controller.updateOvertime);
router.delete('/:id', requireManager, controller.deleteOvertime);

// Approval workflow
router.post('/:id/send-for-approval', requireManager, controller.sendForApproval);
router.post('/:id/approve', requireManager, controller.approveOvertime);
router.post('/:id/reject', requireManager, controller.rejectOvertime);

module.exports = router;
