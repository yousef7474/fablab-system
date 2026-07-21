const sgMail = require('@sendgrid/mail');
require('dotenv').config();

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const BATCH_SIZE = 100;

const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Simple bilingual-friendly wrapper. The manager writes the body in Arabic
// (or English) and we just render it as-is inside a branded card. `bodyHtml`
// is already-escaped (or already-html) — see caller.
const wrapEmail = (bodyHtml) => `
  <div style="font-family: 'Cairo', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f5f7fb; padding: 24px;">
    <div style="background: linear-gradient(135deg, #EE2329, #c91d22); padding: 22px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 0.3px;">فاب لاب الأحساء</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0 0; font-size: 13px;">FABLAB Al-Ahsa</p>
    </div>
    <div dir="rtl" style="background: #ffffff; padding: 28px 24px; border: 1px solid #e5e7eb; color: #1f2937; font-size: 15px; line-height: 1.75;">
      ${bodyHtml}
    </div>
    <div style="background: #111827; padding: 16px; text-align: center; border-radius: 0 0 12px 12px;">
      <p style="color: #fff; margin: 0; font-size: 13px;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
      <p style="color: rgba(255,255,255,0.6); margin: 6px 0 0 0; font-size: 11px;">
        <a href="https://fablabsahsa.com" style="color: rgba(255,255,255,0.7); text-decoration: none;">fablabsahsa.com</a>
      </p>
    </div>
  </div>
`;

// Send the same email to N recipients using SendGrid personalizations so each
// recipient sees only their own address (no BCC leak). Sends in batches of
// BATCH_SIZE to stay well under SendGrid's 1000-recipient-per-request limit.
// Returns { sent, failed, errors[] }.
const sendBulk = async ({ recipients, subject, bodyPlain, useHtml }) => {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is not configured on the server');
  }
  if (!process.env.SENDGRID_FROM_EMAIL) {
    throw new Error('SENDGRID_FROM_EMAIL is not configured on the server');
  }

  const cleaned = (recipients || [])
    .map(r => ({ email: (r.email || '').trim(), name: (r.name || '').trim() }))
    .filter(r => r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));

  const bodyHtml = useHtml
    ? bodyPlain
    : escapeHtml(bodyPlain).replace(/\n/g, '<br/>');

  const html = wrapEmail(bodyHtml);
  const text = String(bodyPlain || '').replace(/<[^>]+>/g, '');

  const results = { sent: 0, failed: 0, errors: [] };

  for (let i = 0; i < cleaned.length; i += BATCH_SIZE) {
    const batch = cleaned.slice(i, i + BATCH_SIZE);
    const msg = {
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa' },
      subject,
      html,
      text,
      personalizations: batch.map(r => ({
        to: [{ email: r.email, name: r.name || undefined }]
      }))
    };
    try {
      await sgMail.send(msg);
      results.sent += batch.length;
    } catch (err) {
      results.failed += batch.length;
      const detail = err?.response?.body?.errors?.map(e => e.message).join('; ') || err.message;
      results.errors.push(`batch ${i}-${i + batch.length}: ${detail}`);
      console.error(`Bulk email batch ${i}-${i + batch.length} failed:`, detail);
    }
  }

  return results;
};

module.exports = { sendBulk };
