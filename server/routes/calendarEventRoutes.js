const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/calendarEventController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Literal-path routes BEFORE /:id so they aren't shadowed.
router.get('/saudi-holidays', ctrl.saudiHolidays);

router.get('/',        ctrl.list);
router.post('/',       ctrl.create);
router.put('/:id',     ctrl.update);
router.delete('/:id',  ctrl.remove);

module.exports = router;
