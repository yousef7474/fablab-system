const express = require('express');
const ctrl = require('../controllers/paymentPageController');
const adminAuth = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Public checkout behind the shared link (/pay/:slug). Never 401: the
// client sends any 401 to the admin login.
const publicRouter = express.Router();
publicRouter.get('/receipt/:token', ctrl.getReceipt);
publicRouter.get('/:slug', ctrl.getPublicPage);
publicRouter.get('/:slug/cover', ctrl.getPublicCover);
publicRouter.post('/:slug/coupon', ctrl.checkCoupon);
publicRouter.post('/:slug', ctrl.submitPayment);

// Admin "صفحات الدفع" tab. Any admin can view and review payments;
// creating / editing / opening / deleting pages needs a manager. File
// downloads accept ?token= (opened in a new tab).
const adminRouter = express.Router();
adminRouter.use(adminAuth);
adminRouter.get('/', ctrl.listPages);
adminRouter.post('/', requireManager, ctrl.createPage);
adminRouter.patch('/submissions/:id', ctrl.reviewSubmission);
adminRouter.get('/submissions/:id/proof', ctrl.downloadProof);
adminRouter.get('/submissions/:id/invoice-pdf', ctrl.downloadInvoicePdf);
adminRouter.delete('/submissions/:id', requireManager, ctrl.deleteSubmission);
adminRouter.patch('/coupons/:couponId', requireManager, ctrl.updateCoupon);
adminRouter.delete('/coupons/:couponId', requireManager, ctrl.deleteCoupon);
adminRouter.get('/:id/submissions', ctrl.listSubmissions);
adminRouter.get('/:id/coupons', ctrl.listCoupons);
adminRouter.post('/:id/coupons', requireManager, ctrl.createCoupon);
adminRouter.put('/:id', requireManager, ctrl.updatePage);
adminRouter.patch('/:id/open', requireManager, ctrl.setOpen);
adminRouter.delete('/:id', requireManager, ctrl.deletePage);

module.exports = { publicRouter, adminRouter };
