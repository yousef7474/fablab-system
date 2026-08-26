const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/institutionSupportController');
const authMiddleware = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Print + download must be defined BEFORE the parameterized routes so
// they aren't shadowed. Both allow admin+manager reads; only manager
// (or admin per project policy) can mutate.
router.get('/:id/print',                          ctrl.printHtml);
router.get('/:id/download/:kind',                 ctrl.download);
router.get('/:id/download/:kind/:index',          ctrl.download);

router.get('/',                                   ctrl.list);
router.get('/:id',                                ctrl.get);
router.post('/',                                  requireManager, ctrl.create);
router.put('/:id',                                requireManager, ctrl.update);
router.delete('/:id',                             requireManager, ctrl.remove);

// Reports (ar / en / patent)
router.put('/:id/report/:kind',                   requireManager, ctrl.setReport);
router.delete('/:id/report/:kind',                requireManager, ctrl.clearReport);

// Images
router.post('/:id/images',                        requireManager, ctrl.addImages);
router.delete('/:id/images/:index',               requireManager, ctrl.removeImage);

// Invoices
router.post('/:id/invoices',                      requireManager, ctrl.addInvoice);
router.put('/:id/invoices/:index',                requireManager, ctrl.updateInvoice);
router.delete('/:id/invoices/:index',             requireManager, ctrl.removeInvoice);

module.exports = router;
