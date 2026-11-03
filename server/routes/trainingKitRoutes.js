const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/trainingKitController');
const employeeAuth = require('../middleware/employeeAuth');
const adminAuth = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Kit files come as the raw request body (no base64 overhead).
const rawFile = express.raw({ type: () => true, limit: '26mb' });

// ── Employee: own kits ──
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

// ── Project manager (مسؤول إدارة المشاريع) — an employee login ──
router.get('/pm/status',                   employeeAuth, ctrl.pmStatus);
router.get('/pm/kits',                     employeeAuth, ctrl.requirePM, ctrl.pmList);
router.get('/pm/files/:fileId',            employeeAuth, ctrl.requirePM, ctrl.pmFile);
router.get('/pm/kits/:id',                 employeeAuth, ctrl.requirePM, ctrl.pmGet);
router.post('/pm/kits/:id/decide',         employeeAuth, ctrl.requirePM, ctrl.pmDecide);
router.get('/pm/kits/:id/document',        employeeAuth, ctrl.requirePM, ctrl.reviewDocument);
router.get('/pm/kits/:id/zip',             employeeAuth, ctrl.requirePM, ctrl.reviewZip);

// ── Manager board ──
router.get('/admin/settings',              adminAuth, requireManager, ctrl.adminSettings);
router.put('/admin/settings',              adminAuth, requireManager, ctrl.adminSaveSettings);
router.get('/admin/kits',                  adminAuth, requireManager, ctrl.adminList);
router.get('/admin/files/:fileId',         adminAuth, requireManager, ctrl.adminFile);
router.get('/admin/kits/:id',              adminAuth, requireManager, ctrl.adminGet);
router.post('/admin/kits/:id/decide',      adminAuth, requireManager, ctrl.adminDecide);
router.get('/admin/kits/:id/document',     adminAuth, requireManager, ctrl.reviewDocument);
router.get('/admin/kits/:id/zip',          adminAuth, requireManager, ctrl.reviewZip);

module.exports = router;
