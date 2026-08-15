const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/fablabVisitController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All admin routes below require auth. The public form uses a
// separate mount point (see server/index.js) so it isn't affected.
router.use(authMiddleware);

// Literal-path routes BEFORE /:id so they aren't shadowed
router.get('/override-code',              ctrl.getOverrideCode);
router.post('/override-code/regenerate',  requireManager, ctrl.regenerateOverrideCode);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.put('/:id', requireManager, ctrl.update);
router.delete('/:id', requireManager, ctrl.remove);

router.post('/:id/send-for-approval', requireManager, ctrl.sendForApproval);
router.post('/:id/notify-visitor',    requireManager, ctrl.notifyVisitor);

module.exports = router;
