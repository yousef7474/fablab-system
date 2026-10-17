const fs = require('fs');
const path = require('path');
const sgMail = require('@sendgrid/mail');

// Invoice / receipt HTML and customer emails for payment pages.

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const BRAND = '#EE2329';
const ASSETS = 'https://fablabsahsa.com';

// The PDF is printed before remote images finish loading, so it embeds
// the logos from the client's public folder (same repo on the server).
const _logoCache = {};
const logoSrc = (name, embed) => {
  if (!embed) return `${ASSETS}/${name}`;
  if (_logoCache[name] === undefined) {
    try {
      _logoCache[name] = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'public', name)).toString('base64')}`;
    } catch {
      _logoCache[name] = null;
    }
  }
  return _logoCache[name] || `${ASSETS}/${name}`;
};

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const sar = (n) => `${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d).slice(0, 10); }
};
const METHOD_AR = { bank_transfer: 'تحويل بنكي', mada: 'مدى — جهاز الدفع في فاب لاب' };
const STATUS = {
  verified: { ar: 'مدفوعة', en: 'PAID', bg: '#dcfce7', fg: '#166534', ring: '#16a34a' },
  pending: { ar: 'بانتظار التحقق', en: 'PENDING', bg: '#fef3c7', fg: '#92400e', ring: '#d97706' },
  rejected: { ar: 'مرفوضة', en: 'REJECTED', bg: '#fee2e2', fg: '#991b1b', ring: '#dc2626' }
};

// A4 invoice (verified) / payment receipt (pending, rejected). Used for
// the customer's link and the admin PDF.
const buildReceiptHtml = (page, sub, { autoPrint = false, forPdf = false } = {}) => {
  const st = STATUS[sub.status] || STATUS.pending;
  const paid = sub.status === 'verified';
  const docTitle = paid ? 'فاتورة' : 'إيصال طلب دفع';
  const amount = sar(sub.amount);
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(sub.reference)} · ${esc(page.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: ${forPdf ? '#fff' : '#eef0f3'}; color: #111318; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { width: 210mm; min-height: 297mm; margin: ${forPdf ? '0' : '24px auto'}; background: #fff; position: relative; overflow: hidden; padding: 18mm 16mm 16mm; ${forPdf ? '' : 'box-shadow: 0 30px 60px -30px rgba(17,19,24,.35); border-radius: 6px;'} }
.sheet::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 7mm; background: repeating-linear-gradient(135deg, ${BRAND} 0 14px, #c81d22 14px 28px); }
.grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(17,19,24,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,24,.035) 1px, transparent 1px); background-size: 8mm 8mm; pointer-events: none; }
.wrap { position: relative; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm; margin-top: 4mm; }
.logos { display: flex; gap: 5mm; align-items: center; }
.logos img { height: 15mm; }
.doc { text-align: left; }
.doc h1 { margin: 0; font-size: 26pt; font-weight: 900; letter-spacing: -.5px; }
.doc .no { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 11pt; color: ${BRAND}; direction: ltr; }
.stamp { display: inline-block; margin-top: 3mm; padding: 1.5mm 4mm; border: 2px solid ${st.ring}; color: ${st.fg}; background: ${st.bg}; border-radius: 999px; font-weight: 800; font-size: 10pt; }
.stamp small { font-family: 'JetBrains Mono', monospace; font-weight: 700; margin-inline-start: 2mm; letter-spacing: 1px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; margin: 10mm 0 8mm; }
.box { border: 1px solid #e3e5ea; border-radius: 4mm; padding: 5mm 6mm; background: rgba(255,255,255,.9); }
.box h3 { margin: 0 0 3mm; font-size: 9pt; letter-spacing: 1.5px; color: #8a8f99; font-weight: 800; }
.row { display: flex; justify-content: space-between; gap: 4mm; padding: 1.4mm 0; font-size: 10.5pt; }
.row span:first-child { color: #6b7280; }
.row b { font-weight: 800; text-align: left; }
.ltr { direction: ltr; unicode-bidi: embed; }
.tbl { border-radius: 3mm; overflow: hidden; border: 1px solid #eceef2; }
table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
thead tr { background: #111318; }
thead th { color: #fff; font-weight: 700; padding: 3.2mm 4mm; text-align: start; }
thead th:last-child { text-align: end; }
tbody td { padding: 4mm; vertical-align: top; }
tbody td:last-child { text-align: end; font-family: 'JetBrains Mono', monospace; font-weight: 700; }
.desc { font-weight: 800; }
.desc small { display: block; font-weight: 600; color: #6b7280; margin-top: 1mm; white-space: pre-line; }
.totals { margin-top: 6mm; margin-inline-start: auto; width: 82mm; }
.totals .row { padding: 2mm 0; border-bottom: 1px dashed #e3e5ea; }
.grand { margin-top: 3mm; display: flex; justify-content: space-between; align-items: center; padding: 4mm 5mm; border-radius: 3mm; background: ${paid ? '#111318' : '#f4f5f7'}; color: ${paid ? '#fff' : '#111318'}; }
.grand span { font-weight: 800; }
.grand strong { font-size: 15pt; font-weight: 900; font-variant-numeric: tabular-nums; }
.grand strong em { font-style: normal; font-family: 'Cairo', sans-serif; font-size: 10pt; margin-inline-start: 1.5mm; }
.note { margin-top: 8mm; padding: 4mm 5mm; border-radius: 3mm; font-size: 9.5pt; line-height: 1.8; background: ${st.bg}; color: ${st.fg}; }
.foot { position: absolute; left: 16mm; right: 16mm; bottom: 12mm; display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; font-size: 8.5pt; color: #8a8f99; border-top: 1px solid #eceef2; padding-top: 4mm; }
.foot b { color: #111318; }
.bar { position: fixed; inset: auto 0 0 0; display: flex; justify-content: center; gap: 10px; padding: 14px; background: rgba(17,19,24,.92); backdrop-filter: blur(6px); }
.bar button { font: 800 14px 'Cairo', sans-serif; border: 0; border-radius: 10px; padding: 11px 26px; cursor: pointer; background: ${BRAND}; color: #fff; }
@media print { .bar { display: none; } html, body { background: #fff; } .sheet { margin: 0; box-shadow: none; border-radius: 0; } }
@media screen and (max-width: 860px) { .sheet { width: auto; min-height: 0; margin: 0 0 80px; border-radius: 0; padding: 16mm 6mm 40mm; } .cols { grid-template-columns: 1fr; } .totals { width: 100%; } }
</style></head><body>
<div class="sheet"><div class="grid"></div><div class="wrap">
  <div class="head">
    <div class="logos"><img src="${logoSrc('fablab.png', forPdf)}" alt="FabLab"><img src="${logoSrc('found.png', forPdf)}" alt=""></div>
    <div class="doc">
      <h1>${docTitle}</h1>
      <div class="no">${esc(sub.reference)}</div>
      <div class="stamp">${st.ar}<small>${st.en}</small></div>
    </div>
  </div>

  <div class="cols">
    <div class="box">
      <h3>العميل · BILLED TO</h3>
      <div class="row"><span>الاسم</span><b>${esc(sub.fullName)}</b></div>
      <div class="row"><span>الجوال</span><b class="ltr">${esc(sub.phone)}</b></div>
      <div class="row"><span>البريد</span><b class="ltr">${esc(sub.email)}</b></div>
    </div>
    <div class="box">
      <h3>تفاصيل الدفع · PAYMENT</h3>
      <div class="row"><span>تاريخ الطلب</span><b>${fmtDate(sub.createdAt)}</b></div>
      <div class="row"><span>طريقة الدفع</span><b>${METHOD_AR[sub.method] || esc(sub.method)}</b></div>
      ${paid ? `<div class="row"><span>تاريخ التأكيد</span><b>${fmtDate(sub.paidAt || sub.reviewedAt)}</b></div>` : ''}
    </div>
  </div>

  <div class="tbl"><table>
    <thead><tr><th>البيان</th><th style="width:22mm">الكمية</th><th style="width:38mm">المبلغ (ر.س)</th></tr></thead>
    <tbody><tr>
      <td class="desc">${esc(page.title)}${page.description ? `<small>${esc(String(page.description).slice(0, 280))}</small>` : ''}</td>
      <td>1</td>
      <td>${amount}</td>
    </tr></tbody>
  </table></div>

  <div class="totals">
    <div class="row"><span>المجموع الفرعي</span><b class="ltr">${amount}</b></div>
    <div class="grand"><span>${paid ? 'الإجمالي المدفوع' : 'الإجمالي المستحق'}</span><strong class="ltr">${amount}<em>ر.س</em></strong></div>
  </div>

  <div class="note">${paid
    ? 'تم استلام المبلغ والتحقق منه من قبل فريق فاب لاب الأحساء. شكراً لك.'
    : sub.status === 'rejected'
      ? `لم يتم قبول هذا الدفع.${sub.reviewNote ? ` السبب: ${esc(sub.reviewNote)}` : ''} للاستفسار يرجى التواصل مع فاب لاب الأحساء.`
      : 'استلمنا طلبك وسيقوم فريق فاب لاب بالتحقق من الدفع. تصبح هذه الوثيقة فاتورة مدفوعة بعد التأكيد.'}</div>
</div>
  <div class="foot">
    <div><b>فاب لاب الأحساء</b> — مختبر التصنيع الرقمي<br>مؤسسة عبدالمنعم الراشد الإنسانية</div>
    <div class="ltr">FABLAB Al-Ahsa · fablabsahsa.com</div>
  </div>
</div>
${forPdf ? '' : `<div class="bar"><button onclick="window.print()">طباعة / حفظ PDF</button></div>`}
${autoPrint ? `<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500));</script>` : ''}
</body></html>`;
};

// ---------- emails ----------
const _shell = ({ tone = BRAND, kicker, heading, body }) => `<div dir="rtl" style="font-family:'Segoe UI','Cairo',Tahoma,sans-serif;background:#f1f2f5;padding:24px">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(17,19,24,.10)">
  <div style="background:#111318;padding:22px 26px;border-bottom:4px solid ${tone}">
    <img src="${ASSETS}/fablab.png" alt="FabLab" style="height:38px;filter:brightness(0) invert(1)">
    <div style="font-size:12px;letter-spacing:1.4px;color:#c9ccd3;margin-top:10px">${kicker}</div>
    <h1 style="margin:4px 0 0;font-size:21px;font-weight:800;color:#fff">${heading}</h1>
  </div>
  <div style="padding:24px 26px;color:#111318;font-size:14px;line-height:1.8">${body}</div>
  <div style="background:#f7f8fa;padding:12px 24px;font-size:11px;color:#8a8f99;text-align:center">فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية</div>
</div></div>`;
const _summary = (page, sub) => `<table style="width:100%;border-collapse:collapse;background:#f7f8fa;border-radius:12px;font-size:13.5px;margin:12px 0 16px">
  <tr><td style="padding:10px 14px;color:#6b7280;width:130px">رقم المرجع</td><td style="padding:10px 14px;font-weight:800;font-family:'JetBrains Mono',monospace;color:${BRAND}" dir="ltr">${esc(sub.reference)}</td></tr>
  <tr><td style="padding:10px 14px;color:#6b7280">البيان</td><td style="padding:10px 14px;font-weight:700">${esc(page.title)}</td></tr>
  <tr><td style="padding:10px 14px;color:#6b7280">المبلغ</td><td style="padding:10px 14px;font-weight:800">${sar(sub.amount)} ر.س</td></tr>
  <tr><td style="padding:10px 14px;color:#6b7280">طريقة الدفع</td><td style="padding:10px 14px;font-weight:700">${METHOD_AR[sub.method] || esc(sub.method)}</td></tr>
</table>`;
const _button = (href, label, tone = BRAND) => `<div style="text-align:center;margin:20px 0 6px"><a href="${href}" style="display:inline-block;background:${tone};color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:800">${label}</a></div>`;

const _send = async (msg, label) => {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL || !msg.to) return false;
  try {
    await sgMail.send({ from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa' }, ...msg });
    console.log(`✉️  payment page ${label} email sent to ${msg.to}`);
    return true;
  } catch (err) {
    console.error(`❌ payment page ${label} email FAILED for ${msg.to}:`, err?.response?.body || err.message);
    return false;
  }
};

const sendPaymentReceived = (page, sub, { bank, mada, receiptUrl }) => {
  const isBank = sub.method === 'bank_transfer';
  const madaBlock = !isBank && mada ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;margin:4px 0 12px">
    <div style="font-weight:800;color:#1d4ed8">💳 ${esc(mada.title || 'الدفع بمدى في فاب لاب')}</div>
    ${mada.instructions ? `<p style="margin:6px 0 0;color:#1e3a8a">${esc(mada.instructions)}</p>` : ''}
    ${mada.address ? `<p style="margin:6px 0 0;color:#334155;font-size:13px"><b>العنوان:</b> ${esc(mada.address)}</p>` : ''}
  </div>` : '';
  const body = `<p style="margin:0 0 10px">مرحباً <b>${esc(sub.fullName)}</b>،</p>
    <p style="margin:0">${isBank
      ? 'استلمنا طلب الدفع مع إيصال التحويل البنكي. سيقوم فريق فاب لاب بالتحقق منه، وستصلك الفاتورة بعد التأكيد.'
      : `استلمنا طلبك. يرجى الحضور إلى فاب لاب الأحساء لإتمام دفع <b>${sar(sub.amount)} ر.س</b> عبر جهاز مدى، وستصلك الفاتورة بعد الدفع.`}</p>
    ${_summary(page, sub)}${madaBlock}
    ${_button(receiptUrl, 'عرض حالة الطلب')}
    <p style="margin:12px 0 0;font-size:12.5px;color:#6b7280">احتفظ برقم المرجع لأي استفسار.</p>`;
  return _send({
    to: sub.email,
    subject: `استلمنا طلب الدفع — ${page.title} · ${sub.reference}`,
    html: _shell({ kicker: 'FABLAB الأحساء · طلب دفع', heading: isBank ? 'إيصالك قيد المراجعة' : 'بانتظار الدفع بمدى', body })
  }, 'received');
};

const sendPaymentVerified = (page, sub, { receiptUrl, pdf }) => {
  const body = `<p style="margin:0 0 10px">مرحباً <b>${esc(sub.fullName)}</b>،</p>
    <p style="margin:0">تم التحقق من دفعتك بنجاح. شكراً لك! فاتورتك ${pdf ? 'مرفقة بهذا البريد، ويمكنك أيضاً' : 'جاهزة، ويمكنك'} عرضها وطباعتها من الرابط أدناه.</p>
    ${_summary(page, sub)}
    ${_button(receiptUrl, '📄 عرض الفاتورة', '#16a34a')}`;
  return _send({
    to: sub.email,
    subject: `✅ تأكيد الدفع وفاتورتك — ${page.title} · ${sub.reference}`,
    html: _shell({ tone: '#16a34a', kicker: 'FABLAB الأحساء · تأكيد الدفع', heading: 'تم تأكيد دفعتك ✓', body }),
    ...(pdf ? { attachments: [{ content: pdf.toString('base64'), filename: `invoice-${sub.reference}.pdf`, type: 'application/pdf', disposition: 'attachment' }] } : {})
  }, 'verified');
};

const sendPaymentRejected = (page, sub, { receiptUrl }) => {
  const body = `<p style="margin:0 0 10px">مرحباً <b>${esc(sub.fullName)}</b>،</p>
    <p style="margin:0">نأسف، لم نتمكن من تأكيد دفعتك لـ <b>${esc(page.title)}</b>.</p>
    ${sub.reviewNote ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:12px 16px;margin:12px 0;color:#991b1b"><b>السبب:</b> ${esc(sub.reviewNote)}</div>` : ''}
    ${_summary(page, sub)}
    <p style="margin:0;font-size:13px;color:#334155">للاستفسار يرجى التواصل مع فاب لاب الأحساء مع ذكر رقم المرجع.</p>
    ${_button(receiptUrl, 'عرض حالة الطلب', '#111318')}`;
  return _send({
    to: sub.email,
    subject: `بخصوص طلب الدفع — ${page.title} · ${sub.reference}`,
    html: _shell({ tone: '#dc2626', kicker: 'FABLAB الأحساء · طلب دفع', heading: 'لم يتم تأكيد الدفع', body })
  }, 'rejected');
};

module.exports = { buildReceiptHtml, sendPaymentReceived, sendPaymentVerified, sendPaymentRejected };
