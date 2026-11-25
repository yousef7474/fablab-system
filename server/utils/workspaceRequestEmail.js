const sgMail = require('@sendgrid/mail');
const path = require('path');
const { UNITS, APPLICANT_TYPES } = require('./workspaceBooking');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Emails for workspace registration: "we got your request" to the
// applicant, a heads-up to the ops inbox, and the accept / reject answer.

const NOTIFY_EMAIL = 'fablabspec@fablabsahsa.com';
const _origin = () => process.env.PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');
const _esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const unitLabel = (code) => UNITS.find(u => u.code === code)?.label || code;

async function _send(to, subject, html) {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, reason: 'no-api-key' };
  try {
    await sgMail.send({
      from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa' },
      to, subject, html
    });
    return { ok: true };
  } catch (err) {
    console.error('workspace email failed:', err?.response?.body || err.message);
    return { ok: false, reason: err.message };
  }
}

const _details = (r) => `
  <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:10px;margin:12px 0;overflow:hidden">
    <tr><td style="padding:8px 14px;color:#64748b;width:150px">رقم الطلب:</td><td style="padding:8px 14px;font-weight:800;font-family:monospace;color:#EE2329">${_esc(r.requestNumber)}</td></tr>
    <tr><td style="padding:8px 14px;color:#64748b">مساحة العمل:</td><td style="padding:8px 14px;font-weight:700">${_esc(unitLabel(r.unitCode))}</td></tr>
    <tr><td style="padding:8px 14px;color:#64748b">الفترة:</td><td style="padding:8px 14px;font-family:monospace" dir="ltr">${_esc(r.startDate)} → ${_esc(r.endDate)}</td></tr>
    <tr><td style="padding:8px 14px;color:#64748b">الوقت اليومي:</td><td style="padding:8px 14px;font-family:monospace" dir="ltr">${_esc(r.startTime)} → ${_esc(r.endTime)}</td></tr>
    <tr><td style="padding:8px 14px;color:#64748b">المشروع:</td><td style="padding:8px 14px">${_esc(r.projectName)}</td></tr>
    <tr><td style="padding:8px 14px;color:#64748b">عدد الأشخاص:</td><td style="padding:8px 14px">${_esc(r.peopleCount)}</td></tr>
  </table>`;

const _shell = (color, kicker, title, body) => `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:${color};color:#fff;padding:22px 26px">
    <div style="font-size:12px;letter-spacing:1.2px;opacity:0.85">${kicker}</div>
    <div style="font-size:22px;font-weight:800;margin-top:4px">${title}</div>
  </div>
  <div style="padding:24px 26px;font-size:14px;line-height:1.75">${body}</div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`;

// To the applicant: we got it.
const sendReceived = (r) => _send(r.email, `تم استلام طلب مساحة العمل — ${r.requestNumber}`, _shell(
  'linear-gradient(135deg,#1f3d63,#2A4F7C)', 'FABLAB الأحساء · مساحات العمل', 'تم استلام طلبك ✓',
  `<p style="margin:0 0 14px">مرحبًا <b>${_esc(r.fullName)}</b>،</p>
   <p style="margin:0 0 14px">تم استلام طلب حجز مساحة العمل، وسيُراجَع من قبل الإدارة.</p>
   ${_details(r)}
   <p style="margin:14px 0 0;font-size:12px;color:#6b7280;padding:10px 14px;background:#fef3c7;border-inline-start:3px solid #f59e0b;border-radius:6px">
     ⏳ سيصلك قرار القبول أو الاعتذار عبر البريد الإلكتروني. يُرجى عدم الحضور قبل وصول القبول.
   </p>`
));

// To the ops inbox: a new request came in.
const sendOpsNotice = (r) => _send(NOTIFY_EMAIL, `طلب مساحة عمل جديد ${r.requestNumber} — ${r.fullName}`, _shell(
  'linear-gradient(135deg,#b3121a,#e0262c)', 'FABLAB الأحساء · مساحات العمل', 'طلب مساحة عمل جديد',
  `<p style="margin:0 0 10px"><b>${_esc(r.fullName)}</b> (${_esc(APPLICANT_TYPES[r.applicantType] || r.applicantType)})${r.organization ? ` — ${_esc(r.organization)}` : ''}</p>
   <p style="margin:0 0 10px" dir="ltr">${_esc(r.phone)} · ${_esc(r.email)}</p>
   ${_details(r)}
   ${r.projectDescription ? `<p style="margin:0 0 14px;color:#334155">${_esc(r.projectDescription).replace(/\n/g, '<br>')}</p>` : ''}
   <p style="margin:18px 0 0"><a href="${_origin()}/admin/dashboard?tab=workspaces" style="background:#EE2329;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700">مراجعة الطلب</a></p>`
));

// To the applicant: accepted / rejected, with the reviewer's note.
const sendDecision = (r) => {
  const ok = r.status === 'approved';
  const note = r.decisionNote ? `<p style="margin:12px 0 0;padding:12px 14px;background:#f8fafc;border-inline-start:3px solid ${ok ? '#28B070' : '#EE2329'};border-radius:6px">${_esc(r.decisionNote).replace(/\n/g, '<br>')}</p>` : '';
  return _send(r.email,
    ok ? `تم قبول طلب مساحة العمل — ${r.requestNumber}` : `بخصوص طلب مساحة العمل — ${r.requestNumber}`,
    _shell(
      ok ? 'linear-gradient(135deg,#158a52,#28B070)' : 'linear-gradient(135deg,#b3121a,#e0262c)',
      'FABLAB الأحساء · مساحات العمل',
      ok ? 'تم قبول طلبك ✓' : 'نعتذر عن قبول الطلب',
      `<p style="margin:0 0 14px">مرحبًا <b>${_esc(r.fullName)}</b>،</p>
       <p style="margin:0 0 14px">${ok
         ? 'يسعدنا إبلاغك بقبول طلب حجز مساحة العمل. يُرجى الالتزام بالفترة والوقت المحددين وبشروط استخدام مساحة العمل.'
         : 'نعتذر عن عدم إمكانية قبول طلب حجز مساحة العمل في الفترة المطلوبة.'}</p>
       ${_details(r)}
       ${note}
       ${ok ? '' : `<p style="margin:18px 0 0"><a href="${_origin()}/workspace" style="background:#2A4F7C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700">تقديم طلب جديد</a></p>`}`
    ));
};

module.exports = { sendReceived, sendOpsNotice, sendDecision, unitLabel };
