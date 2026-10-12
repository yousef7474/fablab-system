const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/siteAdminController');
const adminAuth = require('../middleware/auth');
const { requireManager } = require('../middleware/roleMiddleware');

// Admin "الموقع الإلكتروني" tab. Reads: any admin. Writes: managers.
// File downloads accept ?token= (opened in a new tab).
router.use(adminAuth);

router.get('/summary', ctrl.summary);
router.post('/import', requireManager, ctrl.importOldSite);
router.get('/import', ctrl.importStatus);

router.get('/content', ctrl.getContent);
router.put('/content', requireManager, ctrl.updateContent);

router.get('/media', ctrl.listMedia);
router.post('/media', requireManager, ctrl.createMedia);
router.put('/media/:id', requireManager, ctrl.updateMedia);
router.delete('/media/:id', requireManager, ctrl.deleteMedia);

router.get('/workshops-archive', ctrl.listArchive);
router.post('/workshops-archive', requireManager, ctrl.createArchive);
router.put('/workshops-archive/:id', requireManager, ctrl.updateArchive);
router.delete('/workshops-archive/:id', requireManager, ctrl.deleteArchive);

router.get('/stories', ctrl.listStories);
router.put('/stories/:id', requireManager, ctrl.updateStory);
router.delete('/stories/:id', requireManager, ctrl.deleteStory);

router.get('/talent', ctrl.listTalent);
router.get('/talent/:id/files/:index', ctrl.talentFile);
router.put('/talent/:id', ctrl.updateTalent);
router.delete('/talent/:id', requireManager, ctrl.deleteTalent);

router.get('/internships', ctrl.listOpportunities);
router.post('/internships', requireManager, ctrl.createOpportunity);
router.put('/internships/:id', requireManager, ctrl.updateOpportunity);
router.delete('/internships/:id', requireManager, ctrl.deleteOpportunity);

router.get('/internship-applications', ctrl.listApplications);
router.get('/internship-applications/:id/file/:which', ctrl.applicationFile);
router.put('/internship-applications/:id', ctrl.updateApplication);
router.delete('/internship-applications/:id', requireManager, ctrl.deleteApplication);

router.get('/contact-messages', ctrl.listMessages);
router.put('/contact-messages/:id', ctrl.updateMessage);
router.delete('/contact-messages/:id', requireManager, ctrl.deleteMessage);

module.exports = router;
