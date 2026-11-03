const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/executionPlanController');
const { requirePM } = require('../controllers/reviewFlow');
const employeeAuth = require('../middleware/employeeAuth');
const adminAuth = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Plan files come as the raw request body (no base64 overhead).
const rawFile = express.raw({ type: () => true, limit: '26mb' });

// ── Employee: own plans ──
router.get('/mine',                        employeeAuth, ctrl.myList);
router.post('/mine',                       employeeAuth, ctrl.myCreate);
router.get('/mine/files/:fileId',          employeeAuth, ctrl.myFile);
router.get('/mine/:id',                    employeeAuth, ctrl.myGet);
router.put('/mine/:id',                    employeeAuth, ctrl.mySave);
router.delete('/mine/:id',                 employeeAuth, ctrl.myDelete);
router.post('/mine/:id/files',             employeeAuth, rawFile, ctrl.myUpload);
router.delete('/mine/:id/files/:fileId',   employeeAuth, ctrl.myDeleteFile);
router.post('/mine/:id/submit',            employeeAuth, ctrl.mySubmit);
router.get('/mine/:id/document',           employeeAuth, ctrl.myDocument);
router.get('/mine/:id/zip',                employeeAuth, ctrl.myZip);

// ── Project manager (مسؤول إدارة المشاريع) — the same PM as the kits;
//    her status is /training-kits/pm/status ──
router.get('/pm/plans',                    employeeAuth, requirePM, ctrl.pmList);
router.get('/pm/files/:fileId',            employeeAuth, requirePM, ctrl.pmFile);
router.get('/pm/plans/:id',                employeeAuth, requirePM, ctrl.pmGet);
router.post('/pm/plans/:id/decide',        employeeAuth, requirePM, ctrl.pmDecide);
router.get('/pm/plans/:id/document',       employeeAuth, requirePM, ctrl.reviewDocument);
router.get('/pm/plans/:id/zip',            employeeAuth, requirePM, ctrl.reviewZip);

// ── Manager board ──
router.get('/admin/plans',                 adminAuth, requireManager, ctrl.adminList);
router.get('/admin/files/:fileId',         adminAuth, requireManager, ctrl.adminFile);
router.get('/admin/plans/:id',             adminAuth, requireManager, ctrl.adminGet);
router.post('/admin/plans/:id/decide',     adminAuth, requireManager, ctrl.adminDecide);
router.get('/admin/plans/:id/document',    adminAuth, requireManager, ctrl.reviewDocument);
router.get('/admin/plans/:id/zip',         adminAuth, requireManager, ctrl.reviewZip);
router.delete('/admin/plans/:id',          adminAuth, requireManager, ctrl.adminDelete);

module.exports = router;
