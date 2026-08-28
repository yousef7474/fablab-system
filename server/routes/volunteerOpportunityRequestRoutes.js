const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/volunteerOpportunityRequestController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Manager approvals board
router.get('/pending',                   requireManager, ctrl.listPending);

router.get('/',                          ctrl.list);
router.get('/:id',                       ctrl.get);
router.post('/',                         requireManager, ctrl.create);
router.put('/:id',                       requireManager, ctrl.update);
router.delete('/:id',                    requireManager, ctrl.remove);

router.post('/:id/send-for-approval',    requireManager, ctrl.sendForApproval);
router.post('/:id/manager-approve',      requireManager, ctrl.managerApprove);
router.post('/:id/manager-reject',       requireManager, ctrl.managerReject);

module.exports = router;
