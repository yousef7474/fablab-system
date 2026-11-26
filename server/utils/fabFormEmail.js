const sgMail = require('@sendgrid/mail');
const path = require('path');
const { answerText, isShown, NO_ANSWER } = require('./fabForms');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PAY_STATUS = {
  bank_transfer: 'وصلنا إيصال التحويل وسيُراجَع ثم تصلك الفاتورة',
  mada: 'ادفع بجهاز مدى عند حضورك إلى فاب لاب',
  verified: 'تم تأكيد الدفع'
};

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The respondent's copy of a FabLab form submission: the success message,
// their reference, their answers and — when the form takes payment — the
// payment they made with it (its own email has the receipt link).
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
          <div style="margin:0 0 18px;padding:14px 16px;border-radius:14px;background:#f3f8f5;border:1px solid #cdebd9">
            <p style="margin:0 0 4px;color:#0f1b2d;font-weight:700">الدفع: ${esc(payment.title)} — ${esc(payment.amount)} ر.س</p>
            <p style="margin:0;color:#3f4d63;font-size:14px">رقم الدفع: <strong style="font-family:monospace">${esc(payment.reference)}</strong> · ${esc(PAY_STATUS[payment.status === 'verified' ? 'verified' : payment.method] || '')}</p>
          </div>` : ''}
          <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f4;border-radius:12px">${rows}</table>
          <p style="color:#8f9cb3;font-size:12px;margin:18px 0 0">هذه رسالة تلقائية، يُرجى عدم الرد عليها.</p>
        </div>
      </div>`
  };
  await sgMail.send(msg);
}

const whenAr = (d) => new Date(d).toLocaleString('ar-SA-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit'
});
const daysLeftAr = (days) => ({ 1: 'غدًا', 2: 'بعد يومين', 7: 'بعد أسبوع', 14: 'بعد أسبوعين' }[days] || `بعد ${days} أيام`);

// The event reminder (utils/fabFormReminders.js): when it starts, the
// admin's reminder text and — when asked — "I'll attend" / "I can't"
// buttons to /forms/attend/:token.
async function sendFormReminder({ to, name, form, response, days, attendUrl }) {
  const ask = form.askAttendance && attendUrl;
  const answered = response.attendance === 'yes' ? '<p style="margin:0 0 14px;color:#157a4b;font-weight:700">✓ حضورك مؤكد — شكرًا لك.</p>' : '';
  const btn = (href, bg, color, label) => `<a href="${esc(href)}" style="display:inline-block;margin:4px;padding:11px 24px;border-radius:12px;background:${bg};color:${color};text-decoration:none;font-weight:700">${label}</a>`;
  const msg = {
    to,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: `تذكير: ${form.title} — ${daysLeftAr(days)}`,
    html: `
      <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:620px;margin:0 auto;background:#f3f5fa;padding:18px">
        <div style="background:linear-gradient(135deg,#1f3d63,#2A4F7C);padding:22px;border-radius:16px 16px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:20px">فاب لاب الأحساء</h1>
          <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:13px">تذكير بموعد</p>
        </div>
        <div style="background:#fff;padding:24px;border-radius:0 0 16px 16px">
          <h2 style="margin:0 0 10px;color:#0f1b2d;font-size:18px">مرحبًا ${esc(name || '')}</h2>
          <p style="color:#3f4d63;line-height:1.8;margin:0 0 14px">نذكّرك بموعد <strong>${esc(form.title)}</strong> ${esc(daysLeftAr(days))}.</p>
          <div style="margin:0 0 16px;padding:14px 16px;border-radius:14px;background:#f2f6fc;border:1px solid #d5e2f2">
            <p style="margin:0 0 4px;color:#5f6c82;font-size:13px">الموعد</p>
            <p style="margin:0;color:#1f3d63;font-weight:700;font-size:16px">${esc(whenAr(form.eventStartsAt))}</p>
          </div>
          ${form.reminderMessage ? `<p style="color:#3f4d63;line-height:1.8;margin:0 0 16px">${esc(form.reminderMessage).replace(/\n/g, '<br>')}</p>` : ''}
          <p style="margin:0 0 16px;color:#3f4d63">رقم التسجيل: <strong style="color:#EE2329;font-family:monospace;font-size:15px">${esc(response.reference)}</strong></p>
          ${answered}
          ${ask ? `
          <div style="text-align:center;margin:6px 0 4px">
            <p style="margin:0 0 10px;color:#0f1b2d;font-weight:700">هل ستحضر؟</p>
            ${btn(`${attendUrl}?a=yes`, '#28B070', '#fff', 'نعم، سأحضر')}
            ${btn(`${attendUrl}?a=no`, '#f3f5fa', '#3f4d63', 'أعتذر عن الحضور')}
          </div>` : ''}
          <p style="color:#8f9cb3;font-size:12px;margin:18px 0 0">هذه رسالة تلقائية، يُرجى عدم الرد عليها.</p>
        </div>
      </div>`
  };
  await sgMail.send(msg);
}

module.exports = { sendFormConfirmation, sendFormReminder };
