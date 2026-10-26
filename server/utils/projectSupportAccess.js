// Access code for the public project-support form (/project-support).
// The page is closed to the public: the admin shares this code (or a
// link that carries it) with the people who may apply. A correct code
// returns a short-lived signed token that /public/project-support/submit
// checks. The code lives in Settings so the admin can see, copy and
// change it from the admin board; changing it invalidates the tokens
// issued for the old one.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Settings } = require('../models');

const KEY = 'project_support_access';
const TOKEN_TTL = '12h';
// No 0/O/1/I so a code read out loud or from a screenshot isn't misread.
// 32 symbols divide 256 evenly, so random bytes map without bias.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateCode = (len = 6) =>
  Array.from(crypto.randomBytes(len), b => ALPHABET[b % ALPHABET.length]).join('');

const normalizeCode = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');
const isValidCode = (c) => /^[A-Z0-9]{4,20}$/.test(c);

const _fingerprint = (code) => crypto.createHash('sha256').update(`psr-access:${code}`).digest('hex').slice(0, 16);

// Current { code, updatedAt, updatedBy }; the first call creates a code.
const loadAccess = async () => {
  const [row] = await Settings.findOrCreate({
    where: { key: KEY },
    defaults: { value: { code: generateCode(), updatedAt: new Date().toISOString(), updatedBy: null } }
  });
  return row.value;
};

const setAccessCode = async (code, updatedBy) => {
  const value = { code, updatedAt: new Date().toISOString(), updatedBy: updatedBy || null };
  await Settings.upsert({ key: KEY, value });
  return value;
};

const checkAccessCode = async (input) => {
  const given = normalizeCode(input);
  if (!given || given.length > 40) return null;
  const { code } = await loadAccess();
  const a = Buffer.from(given);
  const b = Buffer.from(String(code));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? code : null;
};

const issueAccessToken = (code) =>
  jwt.sign({ typ: 'psr-access', f: _fingerprint(code) }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

const verifyAccessToken = async (token) => {
  if (!token) return false;
  try {
    const p = jwt.verify(String(token), process.env.JWT_SECRET);
    if (p.typ !== 'psr-access') return false;
    const { code } = await loadAccess();
    return p.f === _fingerprint(code);
  } catch {
    return false;
  }
};

module.exports = {
  generateCode, normalizeCode, isValidCode,
  loadAccess, setAccessCode, checkAccessCode, issueAccessToken, verifyAccessToken
};
