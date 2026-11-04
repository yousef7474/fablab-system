const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mediaRequestController');
const employeeAuth = require('../middleware/employeeAuth');
const adminAuth = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Files (ad images, design deliverables) come as the raw request body.
const rawFile = express.raw({ type: () => true, limit: '26mb' });

// ── Employee: own design requests ──
router.get('/mine',                            employeeAuth, ctrl.myList);
router.post('/mine',                           employeeAuth, ctrl.myCreate);
router.post('/mine/from-plan',                 employeeAuth, ctrl.myFromPlan);
router.get('/mine/files/:fileId',              employeeAuth, ctrl.myFile);
router.get('/mine/:id',                        employeeAuth, ctrl.myGet);
router.put('/mine/:id',                        employeeAuth, ctrl.mySave);
router.delete('/mine/:id',                     employeeAuth, ctrl.myDelete);
router.post('/mine/:id/files',                 employeeAuth, rawFile, ctrl.myUpload);
router.delete('/mine/:id/files/:fileId',       employeeAuth, ctrl.myDeleteFile);
router.post('/mine/:id/submit',                employeeAuth, ctrl.mySubmit);
router.post('/mine/:id/check',                 employeeAuth, ctrl.myCheck);
router.get('/mine/:id/document',               employeeAuth, ctrl.myDocument);

// ── Design team — any admin dashboard account ──
router.get('/design/requests',                 adminAuth, ctrl.designList);
router.get('/design/files/:fileId',            adminAuth, ctrl.reviewFile);
router.get('/design/requests/:id',             adminAuth, ctrl.reviewGet);
router.post('/design/requests/:id/files',      adminAuth, rawFile, ctrl.designUpload);
router.delete('/design/requests/:id/files/:fileId', adminAuth, ctrl.designDeleteFile);
router.post('/design/requests/:id/deliver',    adminAuth, ctrl.designDeliver);
router.get('/design/requests/:id/document',    adminAuth, ctrl.reviewDocument);

// ── Project manager (مسؤول إدارة المشاريع) — an employee login ──
router.get('/pm/requests',                     employeeAuth, ctrl.requirePM, ctrl.pmList);
router.get('/pm/files/:fileId',                employeeAuth, ctrl.requirePM, ctrl.reviewFile);
router.get('/pm/requests/:id',                 employeeAuth, ctrl.requirePM, ctrl.reviewGet);
router.post('/pm/requests/:id/decide',         employeeAuth, ctrl.requirePM, ctrl.pmDecide);
router.get('/pm/requests/:id/document',        employeeAuth, ctrl.requirePM, ctrl.reviewDocument);

// ── Manager board ──
router.get('/admin/requests',                  adminAuth, requireManager, ctrl.adminList);
router.get('/admin/files/:fileId',             adminAuth, requireManager, ctrl.reviewFile);
router.get('/admin/requests/:id',              adminAuth, requireManager, ctrl.reviewGet);
router.post('/admin/requests/:id/decide',      adminAuth, requireManager, ctrl.adminDecide);
router.get('/admin/requests/:id/document',     adminAuth, requireManager, ctrl.reviewDocument);
router.delete('/admin/requests/:id',           adminAuth, requireManager, ctrl.adminDelete);

module.exports = router;
