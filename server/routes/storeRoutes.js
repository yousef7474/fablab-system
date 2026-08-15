const express = require('express');
const router = express.Router();
const items = require('../controllers/storeItemController');
const orders = require('../controllers/storeOrderController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// All admin routes require auth. Public endpoints live under
// /api/public/store (see publicRoutes.js).
router.use(authMiddleware);

// ---- Items ----
router.get('/items',    items.list);
router.get('/items/:id',items.get);
router.post('/items',   requireManager, items.create);
router.put('/items/:id',requireManager, items.update);
router.delete('/items/:id', requireManager, items.remove);

// ---- Orders ----
router.get('/orders',           orders.list);
router.get('/orders/:id',       orders.get);
router.patch('/orders/:id/status',    requireManager, orders.updateStatus);
router.post('/orders/:id/mark-paid',  requireManager, orders.markPaid);
router.delete('/orders/:id',    requireManager, orders.remove);

module.exports = router;
