const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/projectSupportRequestController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Manager pending queue (mounted BEFORE the auth-any routes so the
// role gate applies).
router.get('/pending', authMiddleware, requireManager, ctrl.listPending);

// Admin (any authed user) — list, detail, per-file download, delete
router.use(authMiddleware);
router.get('/',                          ctrl.list);
router.get('/:id',                       ctrl.get);
router.get('/:id/files/:index',          ctrl.downloadFile);
router.delete('/:id',                    requireManager, ctrl.remove);

// Send-for-approval + manual notify (manager-role admins)
router.post('/:id/send-for-approval',    requireManager, ctrl.sendForApproval);
router.post('/:id/manager-approve',      requireManager, ctrl.managerApprove);
router.post('/:id/manager-reject',       requireManager, ctrl.managerReject);
router.post('/:id/notify-user',          requireManager, ctrl.notifyUser);

module.exports = router;
