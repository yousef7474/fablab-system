const sgMail = require('@sendgrid/mail');
const path = require('path');
const { answerText, isShown, NO_ANSWER } = require('./fabForms');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The respondent's copy of a FabLab form submission: the success message,
// their reference, their answers and — when the form has a payment page —
// the link to pay.
async function sendFormConfirmation({ to, name, form, response, payment = null }) {
  const fields = response.fieldsSnapshot || [];
  const rows = fields
    .filter(f => !NO_ANSWER.includes(f.type) && isShown(f, response.answers) && response.answers[f.id] != null)
    .map(f => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;color:#5f6c82;font-size:13px;vertical-align:top;width:40%">${esc(f.label)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;color:#0f1b2d;font-size:14px;font-weight:600">${esc(answerText(f, response.answers[f.id]))}</td>
      </tr>`).join('');

  const msg = {
    to,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: `تم استلام تسجيلك — ${form.title}`,
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:620px;margin:0 auto;background:#f3f5fa;padding:18px">
        <div style="background:linear-gradient(135deg,#1f3d63,#2A4F7C);padding:22px;border-radius:16px 16px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:20px">فاب لاب الأحساء</h1>
          <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px">${esc(form.title)}</p>
        </div>
        <div style="background:#fff;padding:24px;border-radius:0 0 16px 16px">
          <h2 style="margin:0 0 10px;color:#0f1b2d;font-size:18px">مرحبًا ${esc(name || '')}</h2>
          <p style="color:#3f4d63;line-height:1.8;margin:0 0 16px">${esc(form.successMessage || 'تم استلام إجابتك بنجاح.').replace(/\n/g, '<br>')}</p>
          <p style="margin:0 0 16px;color:#3f4d63">رقم التسجيل: <strong style="color:#EE2329;font-family:monospace;font-size:15px">${esc(response.reference)}</strong></p>
          ${payment ? `
          <div style="margin:0 0 18px;padding:16px;border-radius:14px;background:#fff6f6;border:1px solid #ffd2d4;text-align:center">
            <p style="margin:0 0 6px;color:#0f1b2d;font-weight:700">الخطوة التالية: إتمام الدفع</p>
            <p style="margin:0 0 12px;color:#3f4d63;font-size:14px">${esc(payment.title)} — <strong>${esc(payment.amount)} ر.س</strong></p>
            <a href="${esc(payment.url)}" style="display:inline-block;padding:11px 26px;border-radius:12px;background:#EE2329;color:#fff;text-decoration:none;font-weight:700">ادفع الآن</a>
          </div>` : ''}
          <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f4;border-radius:12px">${rows}</table>
          <p style="color:#8f9cb3;font-size:12px;margin:18px 0 0">هذه رسالة تلقائية، يُرجى عدم الرد عليها.</p>
        </div>
      </div>`
  };
  await sgMail.send(msg);
}

module.exports = { sendFormConfirmation };
