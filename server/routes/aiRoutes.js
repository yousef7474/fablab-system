const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aiController');
const aiAuth = require('../middleware/aiAuth');

// Every route is API-key gated (X-Api-Key header, Authorization
// Bearer, or ?apiKey= query). Zero mutation endpoints — read-only.
router.use(aiAuth);

router.get('/schema',                  ctrl.schema);
router.get('/snapshot',                ctrl.snapshot);
router.get('/search',                  ctrl.search);
router.get('/resource/:name',          ctrl.listResource);
router.get('/resource/:name/:id',      ctrl.getResource);

module.exports = router;
