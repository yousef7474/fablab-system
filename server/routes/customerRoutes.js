const express = require('express');
const router = express.Router();
const customers = require('../controllers/customerController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireManager);

router.get('/',       customers.list);
router.get('/stats',  customers.stats);
router.post('/',      customers.create);
router.put('/:id',    customers.update);
router.delete('/:id', customers.remove);

router.post('/bulk-import', customers.bulkImport);
router.post('/send-email',  customers.sendBulkEmail);

module.exports = router;
