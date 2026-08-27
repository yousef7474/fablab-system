// Long-lived API key auth for the /api/ai/* namespace. This is a
// separate credential from the admin/employee JWTs so an AI model
// can hold a stable, revocable key without impersonating a person.
//
// The key is stored in the AI_API_KEY environment variable. If the
// variable is missing or empty, the endpoint returns 503 so the AI
// gets a clear "not configured" signal instead of a silent 401.
//
// Callers may pass the key either:
//   Header:      X-Api-Key: <key>
//   OR Header:   Authorization: Bearer <key>
//   OR Query:    ?apiKey=<key>   (useful for browser-console debugging)

const aiAuthMiddleware = (req, res, next) => {
  const expected = process.env.AI_API_KEY;
  if (!expected || String(expected).length < 8) {
    return res.status(503).json({
      error: 'AI API is not configured',
      hint: 'Set AI_API_KEY in the server .env (at least 8 chars) and restart pm2.'
    });
  }

  const header = req.header('X-Api-Key');
  const bearer = req.header('Authorization')?.startsWith('Bearer ')
    ? req.header('Authorization').slice(7)
    : null;
  const supplied = header || bearer || req.query?.apiKey;

  if (!supplied) {
    return res.status(401).json({
      error: 'Missing API key',
      hint: 'Send it as X-Api-Key header, Authorization: Bearer <key>, or ?apiKey= query param.'
    });
  }
  if (String(supplied) !== String(expected)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

module.exports = aiAuthMiddleware;
