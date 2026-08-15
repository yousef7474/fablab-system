const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/volunteerController');
const overtimeController = require('../controllers/overtimeController');
const fablabVisitController = require('../controllers/fablabVisitController');

// PUBLIC — no auth middleware, no login required.
// Access is gated by opaque UUID tokens generated on the admin side:
//   - Per-volunteer token → single volunteer's data
//   - Master token → all share-enabled volunteers' data
// A volunteer must also have shareEnabled=true for their token to work.

router.get('/volunteer/:token', volunteerController.publicGetVolunteerByToken);
router.get('/attendance-report/:masterToken', volunteerController.publicGetMasterReport);

// Overtime approval — email-link flow. Manager clicks the link in
// the notification, previews the request, and hits approve/reject
// without needing to log in.
router.get('/overtime/:token', overtimeController.publicGetByToken);
router.post('/overtime/:token/decide', overtimeController.publicDecide);

// FABLAB Visit — public submission (from the /fablab-visit form) and
// manager approval flow (same shape as overtime).
router.post('/fablab-visit/submit', fablabVisitController.publicCreate);
router.get('/fablab-visit/:token', fablabVisitController.publicGetByToken);
router.post('/fablab-visit/:token/decide', fablabVisitController.publicDecide);

module.exports = router;
