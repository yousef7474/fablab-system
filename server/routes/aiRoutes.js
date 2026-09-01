const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aiController');
const aiAuth = require('../middleware/aiAuth');

// Public health probe — does NOT reveal or accept the key. Just tells
// you whether the server booted with AI_API_KEY set. Handy for a
// browser-based smoke test right after deploy.
router.get('/health', (req, res) => {
  const k = process.env.AI_API_KEY;
  const configured = !!(k && String(k).length >= 8);
  res.json({
    ok: configured,
    status: configured ? 'armed' : 'not_configured',
    note: configured
      ? 'AI API is armed. Send X-Api-Key on the other endpoints.'
      : 'Set AI_API_KEY (>=8 chars) in server/.env and restart pm2.'
  });
});

// Every OTHER route is API-key gated (X-Api-Key header, Authorization
// Bearer, or ?apiKey= query). Zero mutation endpoints — read-only.
router.use(aiAuth);

router.get('/schema',                  ctrl.schema);
router.get('/snapshot',                ctrl.snapshot);
router.get('/search',                  ctrl.search);
router.get('/resource/:name',          ctrl.listResource);
router.get('/resource/:name/:id',      ctrl.getResource);

module.exports = router;
