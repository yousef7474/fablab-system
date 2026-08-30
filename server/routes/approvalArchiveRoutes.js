const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/approvalArchiveController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// The archive list, detail, and resend are admin-only.
router.get('/',                    authMiddleware, ctrl.list);
router.get('/:id',                 authMiddleware, ctrl.get);
router.post('/:id/resend',         authMiddleware, requireManager, ctrl.resend);
router.delete('/:id',              authMiddleware, requireManager, ctrl.remove);

// The print HTML endpoint is public-with-id — the archiveId is a UUID
// so it's not guessable, and this lets the admin open the print copy
// in a new tab without carrying auth headers. Same pattern as the
// existing public/volunteer-opportunity/:token flow.
router.get('/:id/print',           ctrl.printHtml);

module.exports = router;
