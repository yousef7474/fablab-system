const express = require('express');
const router = express.Router();
const programs = require('../controllers/summerProgramController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Programs
router.get('/programs', programs.list);
router.post('/programs', requireManager, programs.create);
router.put('/programs/:id', requireManager, programs.update);
router.delete('/programs/:id', requireManager, programs.remove);

module.exports = router;
