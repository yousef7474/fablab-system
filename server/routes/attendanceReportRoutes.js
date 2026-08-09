const express = require('express');
const router = express.Router();
const controller = require('../controllers/attendanceReportController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/attendance/report?from=&to=&categories=
router.get('/report', controller.exportUnifiedAttendance);

module.exports = router;
