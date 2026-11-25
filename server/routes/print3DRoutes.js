const express = require('express');
const router = express.Router();
const print3d = require('../controllers/print3DController');
const employeeAuth = require('../middleware/employeeAuth');
const { print3dAuth, managerOrPrint3dStaff, adminManagerOnly } = require('../middleware/print3dAccess');

// Employee board: does this employee run the 3D printing service?
router.get('/access', employeeAuth, print3d.staffAccess);

// Admins, and the employees on the 3D printing staff list.
router.use(print3dAuth);

router.get('/rates',                 print3d.rates);
// Materials + colors offered on the public form (declared before /:id).
router.get('/options',               print3d.getOptions);
router.put('/options',               managerOrPrint3dStaff, print3d.updateOptions);
// Who the 3D printing staff are (admins / managers only).
router.get('/staff',                 adminManagerOnly, print3d.getStaff);
router.put('/staff',                 adminManagerOnly, print3d.updateStaff);
router.get('/',                      print3d.list);
router.get('/:id',                   print3d.get);
router.get('/:id/download',          print3d.download);
router.get('/:id/download/:index',   print3d.download);
router.post('/:id/quote',            managerOrPrint3dStaff, print3d.quote);
router.patch('/:id/status',          managerOrPrint3dStaff, print3d.updateStatus);
router.post('/:id/mark-paid',        managerOrPrint3dStaff, print3d.markPaid);
router.delete('/:id',                managerOrPrint3dStaff, print3d.remove);

module.exports = router;
