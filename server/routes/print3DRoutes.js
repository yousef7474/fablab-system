const express = require('express');
const router = express.Router();
const print3d = require('../controllers/print3DController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/rates',                 print3d.rates);
router.get('/',                      print3d.list);
router.get('/:id',                   print3d.get);
router.get('/:id/download',          print3d.download);
router.post('/:id/quote',            requireManager, print3d.quote);
router.patch('/:id/status',          requireManager, print3d.updateStatus);
router.post('/:id/mark-paid',        requireManager, print3d.markPaid);
router.delete('/:id',                requireManager, print3d.remove);

module.exports = router;
