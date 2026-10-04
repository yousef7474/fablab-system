// Access code for "Entity" (كيان) registrations. The public form asks
// for it before an Entity registration can continue; a correct code
// returns a short-lived signed token that /registration/create checks.
//
// Only a scrypt hash of the code lives here. ENTITY_ACCESS_PASSWORD in
// server/.env replaces it without a code change.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const SALT = 'fablab-entity-access-v1';
const DEFAULT_HASH = '4a8128b4181c583d4a3f25623431d2f1b73c3bf37c04e118f5472e7375f59d45';
const TOKEN_TTL = '6h';

const hashOf = (value) => crypto.scryptSync(String(value), SALT, 32);

const checkEntityPassword = (password) => {
  if (!password || String(password).length > 200) return false;
  const want = process.env.ENTITY_ACCESS_PASSWORD
    ? hashOf(process.env.ENTITY_ACCESS_PASSWORD)
    : Buffer.from(DEFAULT_HASH, 'hex');
  return crypto.timingSafeEqual(hashOf(password), want);
};

const issueEntityToken = () =>
  jwt.sign({ typ: 'entity-access' }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

const verifyEntityToken = (token) => {
  if (!token) return false;
  try {
    return jwt.verify(String(token), process.env.JWT_SECRET).typ === 'entity-access';
  } catch {
    return false;
  }
};

module.exports = { checkEntityPassword, issueEntityToken, verifyEntityToken };
