const express = require('express');
const router = express.Router();
const site = require('../controllers/siteController');

// Public website API — no login.
router.get('/content', site.getContent);
router.get('/media', site.listMedia);
router.get('/media/:id/image', site.mediaImage);
router.get('/workshops-archive', site.listArchive);
router.get('/workshops-archive/:id/image', site.archiveImage);
router.get('/stories', site.listStories);
router.get('/stories/:id/image', site.storyImage);
router.post('/stories', site.submitStory);
router.post('/talent', site.submitTalent);
router.get('/internships', site.listInternships);
router.post('/internships/:id/apply', site.applyInternship);
router.post('/contact', site.submitContact);

module.exports = router;
