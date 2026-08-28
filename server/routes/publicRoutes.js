const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/volunteerController');
const overtimeController = require('../controllers/overtimeController');
const fablabVisitController = require('../controllers/fablabVisitController');
const storeItemController = require('../controllers/storeItemController');
const storeOrderController = require('../controllers/storeOrderController');
const discountCouponController = require('../controllers/discountCouponController');
const storeCustomerController = require('../controllers/storeCustomerController');
const print3DController = require('../controllers/print3DController');
const vorController = require('../controllers/volunteerOpportunityRequestController');
const customerAuth = require('../middleware/customerAuth');

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

// Store — public browse + place order + view own order confirmation
router.get('/store/items',           storeItemController.publicList);
router.get('/store/items/:id',       storeItemController.publicGet);
router.post('/store/orders',         storeOrderController.publicCreate);
router.get('/store/orders/:id',      storeOrderController.publicGet);
router.get('/store/orders/:id/invoice', storeOrderController.publicInvoiceHtml);
router.post('/store/coupon/validate', discountCouponController.publicValidate);

// Customer accounts (public — password-based)
router.post('/store/customer/register', storeCustomerController.register);
router.post('/store/customer/login',    storeCustomerController.login);
router.get('/store/customer/me',        customerAuth, storeCustomerController.me);
router.put('/store/customer/me',        customerAuth, storeCustomerController.updateMe);
router.get('/store/customer/orders',    customerAuth, storeCustomerController.myOrders);

// 3D printing service — public form submit, quote-token page, accept/reject,
// and printable invoice HTML.
router.post('/print3d',                    print3DController.publicCreate);
router.get('/print3d/quote/:token',        print3DController.publicGetByToken);
router.post('/print3d/quote/:token/decide', print3DController.publicDecide);
router.get('/print3d/:id/invoice',         print3DController.publicInvoiceHtml);

// Volunteer opportunity request — manager approval via emailed link.
router.get('/volunteer-opportunity/:token',        vorController.publicGetByToken);
router.post('/volunteer-opportunity/:token/decide', vorController.publicDecide);

module.exports = router;
