const crypto = require('crypto');
const { Op } = require('sequelize');
const { Print3DRequest, Settings } = require('../models');
const { sequelize } = require('../config/database');
const sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const PRINT3D_NOTIFY_EMAIL = 'fablabspec@fablabsahsa.com';
const SAR = (n) => `${Number(n || 0).toFixed(2)} ر.س`;
const fmtRequestNumber = (n) => n == null ? '—' : `P3D-${String(n).padStart(4, '0')}`;

const _publicOrigin = () =>
  process.env.PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

const DEFAULT_RATES = {
  PLA: 1.5, PETG: 2.0, TPU: 3.0,
  setupFee: 15, multiColorFee: 20, minCharge: 25,
  supported: ['stl', 'obj', '3mf', 'step', 'stp', 'ply', 'gcode']
};

// Load current pricing from Settings, falling back to defaults so a
// missing seed row never blocks a quote.
const _loadRates = async () => {
  const keys = [
    'print3d_rate_pla', 'print3d_rate_petg', 'print3d_rate_tpu',
    'print3d_setup_fee', 'print3d_multi_color_fee', 'print3d_min_charge',
    'print3d_supported_files'
  ];
  const rows = await Settings.findAll({ where: { key: { [Op.in]: keys } } });
  const m = new Map(rows.map(r => [r.key, r.value]));
  const num = (k, d) => {
    const v = m.get(k);
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  return {
    PLA: num('print3d_rate_pla', DEFAULT_RATES.PLA),
    PETG: num('print3d_rate_petg', DEFAULT_RATES.PETG),
    TPU: num('print3d_rate_tpu', DEFAULT_RATES.TPU),
    setupFee: num('print3d_setup_fee', DEFAULT_RATES.setupFee),
    multiColorFee: num('print3d_multi_color_fee', DEFAULT_RATES.multiColorFee),
    minCharge: num('print3d_min_charge', DEFAULT_RATES.minCharge),
    supported: Array.isArray(m.get('print3d_supported_files')) && m.get('print3d_supported_files').length
      ? m.get('print3d_supported_files').map(s => String(s).toLowerCase())
      : DEFAULT_RATES.supported
  };
};

// Cost = max(minCharge, weight × rate + setupFee + (multi ? multiColorFee : 0))
// Then add 15% VAT on top.
const _computeQuote = (weight, material, colorMode, rates) => {
  const w = Math.max(0, Number(weight) || 0);
  const rate = Number(rates[String(material || '').toUpperCase()]) || 0;
  const setup = Number(rates.setupFee) || 0;
  const multi = colorMode === 'multi' ? (Number(rates.multiColorFee) || 0) : 0;
  const raw = +(w * rate + setup + multi).toFixed(2);
  const subtotal = +Math.max(raw, Number(rates.minCharge) || 0).toFixed(2);
  const taxRate = 0.15;
  const taxAmount = +(subtotal * taxRate).toFixed(2);
  const total = +(subtotal + taxAmount).toFixed(2);
  return {
    materialRate: rate,
    setupFee: setup,
    multiColorFee: multi,
    subtotal,
    taxRate,
    taxAmount,
    estimatedCost: total
  };
};

const _assignNextNumber = async () => {
  return await sequelize.transaction(async (t) => {
    const [row] = await sequelize.query(
      `SELECT COALESCE(MAX("requestNumber"), 0) + 1 AS next FROM print3d_requests`,
      { transaction: t }
    );
    return Number(row?.[0]?.next) || 1;
  });
};

const _sendMail = async (to, subject, html, text) => {
  if (!process.env.SENDGRID_API_KEY) return { ok: false, reason: 'no-api-key' };
  try {
    await sgMail.send({
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
      },
      to, subject, html, text
    });
    return { ok: true };
  } catch (err) {
    console.error('print3d email failed:', err?.response?.body || err);
    return { ok: false, reason: err.message };
  }
};

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// -------------------- PUBLIC: SUBMIT --------------------

exports.publicCreate = async (req, res) => {
  try {
    const {
      customerName, customerPhone, customerEmail, customerNationalId,
      deliveryAddress, notes,
      fileName, fileType, fileSize, fileData,
      material, colorMode, singleColor, multiColorParts,
      termsAccepted
    } = req.body || {};

    if (!customerName || !customerPhone || !customerEmail) {
      return res.status(400).json({
        message: 'Missing required customer fields',
        messageAr: 'يرجى تعبئة جميع البيانات الشخصية'
      });
    }
    if (!fileName || !fileData) {
      return res.status(400).json({
        message: 'File is required',
        messageAr: 'يجب رفع ملف الطباعة'
      });
    }
    if (!termsAccepted) {
      return res.status(400).json({
        message: 'You must accept the terms & conditions',
        messageAr: 'يجب الموافقة على الشروط والأحكام'
      });
    }

    const rates = await _loadRates();
    const ext = String(fileType || fileName.split('.').pop() || '').toLowerCase().replace(/^\./, '');
    if (!rates.supported.includes(ext)) {
      return res.status(400).json({
        message: `Unsupported file type .${ext}`,
        messageAr: `صيغة الملف غير مدعومة (.${ext}) — الصيغ المدعومة: ${rates.supported.join(', ').toUpperCase()}`
      });
    }

    const mat = String(material || 'PLA').toUpperCase();
    if (!['PLA', 'PETG', 'TPU'].includes(mat)) {
      return res.status(400).json({ message: 'Invalid material', messageAr: 'خامة الطباعة غير صحيحة' });
    }
    const cMode = colorMode === 'multi' ? 'multi' : 'single';
    if (cMode === 'multi' && (!Array.isArray(multiColorParts) || multiColorParts.length === 0)) {
      return res.status(400).json({
        message: 'Multi-color parts are required for multi-color mode',
        messageAr: 'يرجى إضافة تفاصيل الأجزاء والألوان'
      });
    }

    const requestNumber = await _assignNextNumber();
    const quoteToken = crypto.randomBytes(24).toString('hex');

    const r = await Print3DRequest.create({
      requestNumber,
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      customerEmail: String(customerEmail).trim(),
      customerNationalId: customerNationalId ? String(customerNationalId).trim() : null,
      deliveryAddress: deliveryAddress ? String(deliveryAddress).trim() : null,
      notes: notes ? String(notes).trim() : null,
      fileName: String(fileName).slice(0, 250),
      fileType: ext,
      fileSize: Math.max(0, Number(fileSize) || 0),
      fileData: String(fileData),
      material: mat,
      colorMode: cMode,
      singleColor: cMode === 'single' ? (singleColor || null) : null,
      multiColorParts: cMode === 'multi'
        ? (multiColorParts || [])
            .map(p => ({ part: String(p.part || '').trim(), color: String(p.color || '').trim() }))
            .filter(p => p.part || p.color)
        : [],
      termsAcceptedAt: new Date(),
      quoteToken,
      status: 'submitted'
    });

    // Emails — customer confirmation + admin notification. Fire and
    // forget so a slow SendGrid doesn't stall the submit response.
    process.nextTick(async () => {
      try {
        const reqNo = fmtRequestNumber(r.requestNumber);
        const adminHtml = `<div style="font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#0f172a;background:#f4f6fb;padding:24px">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
            <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;padding:20px 24px">
              <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء · خدمة الطباعة ثلاثية الأبعاد</div>
              <div style="font-size:20px;font-weight:800;margin-top:4px">طلب طباعة جديد ${esc(reqNo)}</div>
            </div>
            <div style="padding:22px 24px;font-size:14px;line-height:1.7">
              <p>وصل طلب طباعة جديد من العميل <b>${esc(r.customerName)}</b>.</p>
              <table style="width:100%;font-size:13px;border-collapse:collapse;margin:12px 0">
                <tr><td style="padding:4px 0;color:#64748b;width:130px">الجوال:</td><td dir="ltr">${esc(r.customerPhone)}</td></tr>
                <tr><td style="padding:4px 0;color:#64748b">البريد:</td><td dir="ltr">${esc(r.customerEmail)}</td></tr>
                <tr><td style="padding:4px 0;color:#64748b">الملف:</td><td dir="ltr">${esc(r.fileName)} (${(r.fileSize/1024).toFixed(1)} KB)</td></tr>
                <tr><td style="padding:4px 0;color:#64748b">الخامة:</td><td>${esc(r.material)}</td></tr>
                <tr><td style="padding:4px 0;color:#64748b">نمط اللون:</td><td>${cMode === 'multi' ? 'متعدد الألوان' : 'لون واحد'}</td></tr>
              </table>
              <div style="text-align:center;margin-top:16px">
                <a href="${_publicOrigin()}/admin/dashboard?tab=print3d" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800">مراجعة الطلب وإصدار عرض السعر</a>
              </div>
            </div>
          </div>
        </div>`;
        await _sendMail(PRINT3D_NOTIFY_EMAIL, `طلب طباعة ثلاثية الأبعاد ${reqNo} — ${r.customerName}`, adminHtml, `New 3D print request ${reqNo} from ${r.customerName}`);

        const customerHtml = `<div style="font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#0f172a;background:#f4f6fb;padding:24px" dir="rtl">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
            <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;padding:20px 24px">
              <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء</div>
              <div style="font-size:20px;font-weight:800;margin-top:4px">تم استلام طلبك ${esc(reqNo)}</div>
            </div>
            <div style="padding:22px 24px;font-size:14px;line-height:1.7">
              <p>مرحباً <b>${esc(r.customerName)}</b>،</p>
              <p>شكراً لاختيارك خدمة الطباعة ثلاثية الأبعاد لدى فاب لاب الأحساء. تم استلام طلبك بنجاح وسنقوم بمراجعة الملف وإرسال عرض السعر إليك عبر البريد الإلكتروني خلال أسرع وقت ممكن.</p>
              <table style="width:100%;font-size:13px;border-collapse:collapse;margin:12px 0;background:#f8fafc;border-radius:8px;padding:8px">
                <tr><td style="padding:6px 12px;color:#64748b">رقم الطلب:</td><td style="padding:6px 12px;font-weight:700;font-family:monospace">${esc(reqNo)}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748b">الملف:</td><td style="padding:6px 12px" dir="ltr">${esc(r.fileName)}</td></tr>
                <tr><td style="padding:6px 12px;color:#64748b">الخامة:</td><td style="padding:6px 12px">${esc(r.material)}</td></tr>
              </table>
              <p style="font-size:12px;color:#6b7280;margin-top:16px">عند وصول عرض السعر ستتمكن من الموافقة أو الرفض عبر البريد الإلكتروني قبل بدء الطباعة.</p>
            </div>
          </div>
        </div>`;
        await _sendMail(r.customerEmail, `تم استلام طلب الطباعة ${reqNo}`, customerHtml, `Print request ${reqNo} received`);

        await r.update({ adminEmailSentAt: new Date(), customerEmailSentAt: new Date() });
      } catch (e) { console.error('print3d emails:', e); }
    });

    res.status(201).json({
      requestId: r.requestId,
      requestNumber: r.requestNumber,
      status: r.status
    });
  } catch (err) {
    console.error('print3d publicCreate:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// -------------------- PUBLIC: QUOTE PAGE (JSON) --------------------

exports.publicGetByToken = async (req, res) => {
  try {
    const r = await Print3DRequest.findOne({ where: { quoteToken: req.params.token } });
    if (!r) return res.status(404).json({ message: 'Not found', messageAr: 'الطلب غير موجود' });
    const o = r.toJSON();
    // Strip the file payload from the public JSON response.
    delete o.fileData;
    res.json(o);
  } catch (err) {
    console.error('publicGetByToken:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- PUBLIC: ACCEPT / REJECT QUOTE --------------------

exports.publicDecide = async (req, res) => {
  try {
    const { decision, message } = req.body || {};
    if (!['accept', 'reject'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid decision' });
    }
    const r = await Print3DRequest.findOne({ where: { quoteToken: req.params.token } });
    if (!r) return res.status(404).json({ message: 'Not found' });
    if (r.status !== 'quoted') {
      return res.status(409).json({
        message: 'Quote is not pending decision',
        messageAr: 'لا يوجد عرض سعر بانتظار قرارك'
      });
    }
    const patch = {
      customerDecisionMessage: message ? String(message).trim() : null
    };
    if (decision === 'accept') {
      patch.status = 'accepted';
      patch.acceptedAt = new Date();
    } else {
      patch.status = 'rejected';
      patch.rejectedAt = new Date();
    }
    await r.update(patch);

    // Notify admin of the customer's decision.
    process.nextTick(async () => {
      try {
        const reqNo = fmtRequestNumber(r.requestNumber);
        const html = `<div style="font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#0f172a;background:#f4f6fb;padding:24px" dir="rtl">
          <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
            <div style="background:${decision === 'accept' ? '#16a34a' : '#dc2626'};color:#fff;padding:20px 24px">
              <div style="font-size:20px;font-weight:800">${decision === 'accept' ? '✓ تمت الموافقة' : '✕ تم الرفض'} — ${esc(reqNo)}</div>
            </div>
            <div style="padding:22px 24px;font-size:14px;line-height:1.7">
              <p>العميل <b>${esc(r.customerName)}</b> ${decision === 'accept' ? 'وافق على عرض السعر' : 'رفض عرض السعر'} للطلب ${esc(reqNo)}.</p>
              ${message ? `<p style="background:#f8fafc;padding:12px;border-radius:8px;border-inline-start:3px solid #64748b"><b>رسالة العميل:</b><br>${esc(message)}</p>` : ''}
              <div style="text-align:center;margin-top:16px">
                <a href="${_publicOrigin()}/admin/dashboard?tab=print3d" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800">فتح الطلب</a>
              </div>
            </div>
          </div>
        </div>`;
        await _sendMail(PRINT3D_NOTIFY_EMAIL, `قرار العميل — ${reqNo} (${decision === 'accept' ? 'قبول' : 'رفض'})`, html, `Customer ${decision} on ${reqNo}`);
      } catch (e) { console.error('print3d decision email:', e); }
    });

    res.json({ ok: true, status: r.status });
  } catch (err) {
    console.error('publicDecide:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// -------------------- PUBLIC: INVOICE HTML --------------------

exports.publicInvoiceHtml = async (req, res) => {
  try {
    const r = await Print3DRequest.findByPk(req.params.id);
    if (!r) return res.status(404).send('Not found');
    const o = r.toJSON();
    const paid = !!o.paidAt;
    const stampColor = paid ? '#16a34a' : '#dc2626';
    const stampText = paid ? 'تم الدفع' : 'لم يُدفع';
    const stampSub = paid && o.paidAt
      ? new Date(o.paidAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' })
      : 'بانتظار الدفع';
    const reqNo = fmtRequestNumber(o.requestNumber);
    const invoiceDate = new Date(o.createdAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', {
      calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric'
    });
    const colorRows = (o.colorMode === 'multi' && Array.isArray(o.multiColorParts) && o.multiColorParts.length)
      ? o.multiColorParts.map((p, i) => `<tr>
          <td class="cell-idx">${i + 1}</td>
          <td>${esc(p.part)}</td>
          <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${esc(p.color)};border:1px solid #e5e7eb;vertical-align:middle;margin-inline-end:6px"></span><span style="font-family:monospace">${esc(p.color)}</span></td>
        </tr>`).join('')
      : `<tr><td class="cell-idx">1</td><td>الكامل</td><td>${o.singleColor ? `<span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${esc(o.singleColor)};border:1px solid #e5e7eb;vertical-align:middle;margin-inline-end:6px"></span><span style="font-family:monospace">${esc(o.singleColor)}</span>` : '—'}</td></tr>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فاتورة طباعة ${reqNo}</title>
<style>
  :root { color-scheme: light; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif; background:#f4f6fb; color:#1f2937; padding:24px 12px; }
  .actions { max-width:820px; margin:0 auto 16px; display:flex; gap:10px; justify-content:end; flex-wrap:wrap; }
  .actions button { padding:12px 22px; border-radius:10px; border:none; background:linear-gradient(135deg,#0ea5e9,#2563eb); color:#fff; font-family:inherit; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 8px 20px -8px rgba(14,165,233,0.5); }
  .actions .ghost { background:#fff; color:#0f172a; border:1px solid #e5e7eb; box-shadow:none; }
  .invoice { max-width:820px; margin:0 auto; background:#fff; border-radius:16px; box-shadow:0 20px 40px -20px rgba(15,23,42,0.15); padding:28px; position:relative; overflow:hidden; }
  .stamp { position:absolute; top:44%; inset-inline-start:22%; transform:rotate(-22deg); border:6px double ${stampColor}; color:${stampColor}; padding:18px 44px; font-family:'Bricolage Grotesque','Cairo',sans-serif; font-weight:900; font-size:44px; letter-spacing:3px; text-align:center; background:rgba(255,255,255,0.55); opacity:0.75; pointer-events:none; z-index:999; border-radius:12px; }
  .stamp small { display:block; font-size:14px; font-weight:700; margin-top:4px; opacity:0.9; }
  main { position:relative; z-index:1; font-size:12px; line-height:1.55; }
  .invoice-head { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding-bottom:16px; margin-bottom:20px; border-bottom:3px solid #0f172a; }
  .brand { display:flex; gap:12px; align-items:center; }
  .brand-logos img { height:52px; }
  .brand-info h1 { font-family:'Bricolage Grotesque','Cairo',sans-serif; font-size:19px; color:#0f172a; margin-bottom:3px; }
  .brand-info p { font-size:11px; color:#6b7280; }
  .invoice-meta { text-align:end; }
  .invoice-meta h2 { font-family:'Bricolage Grotesque','Cairo',sans-serif; font-size:26px; font-weight:800; color:#0f172a; margin-bottom:4px; }
  .invoice-meta .no { font-family:'JetBrains Mono',monospace; font-size:15px; color:#0ea5e9; font-weight:800; letter-spacing:2px; }
  .invoice-meta .dates { display:grid; grid-template-columns:auto auto; gap:4px 10px; margin-top:10px; font-size:11px; justify-content:end; }
  .invoice-meta .dates span { color:#6b7280; }
  .invoice-meta .dates b { color:#0f172a; direction:ltr; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px; }
  .party { background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; }
  .party-title { font-size:10px; color:#6b7280; letter-spacing:1.4px; text-transform:uppercase; font-weight:700; margin-bottom:6px; }
  .party-name { font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px; }
  .party-row { font-size:11px; color:#4b5563; margin-top:2px; }
  .party-row b { color:#0f172a; }
  table.items { width:100%; border-collapse:collapse; margin-bottom:12px; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; }
  table.items thead { background:#0f172a; color:#fff; }
  table.items thead th { padding:10px 12px; text-align:start; font-size:10.5px; text-transform:uppercase; letter-spacing:1px; }
  table.items thead th.cell-num { text-align:end; }
  table.items tbody tr:nth-child(even) { background:#f9fafb; }
  table.items tbody td { padding:10px 12px; border-top:1px solid #e5e7eb; font-size:12px; }
  .cell-idx { font-family:'JetBrains Mono',monospace; color:#6b7280; width:28px; text-align:center; }
  .cell-num { font-family:'JetBrains Mono',monospace; text-align:end; }
  .items-title { font-size:11px; color:#6b7280; letter-spacing:1.4px; text-transform:uppercase; font-weight:700; margin:10px 0 6px; }
  .totals-wrap { display:grid; grid-template-columns:1fr 320px; gap:14px; margin-bottom:16px; }
  .payment-info { background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; font-size:11px; }
  .payment-info .pi-title { font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:#6b7280; font-weight:700; margin-bottom:6px; }
  .payment-info .pi-row { margin:3px 0; color:#4b5563; }
  .payment-info .pi-row b { color:#0f172a; }
  .totals { width:100%; border-collapse:collapse; font-size:12px; }
  .totals td { padding:8px 12px; border-bottom:1px solid #e5e7eb; }
  .totals td.label { color:#6b7280; text-align:end; }
  .totals td.val { font-family:'JetBrains Mono',monospace; text-align:end; font-weight:700; color:#0f172a; }
  .totals .final td { background:#0ea5e9; color:#fff; font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:800; padding:14px; border:none; }
  .totals .final td.label { text-align:end; font-family:'Cairo',sans-serif; }
  .invoice-foot { margin-top:18px; padding-top:12px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:10px; color:#9ca3af; }
  @media print {
    body { background:#fff; padding:0; }
    .actions { display:none; }
    .invoice { box-shadow:none; border-radius:0; padding:14mm 12mm; max-width:none; }
    @page { size:A4; margin:0; }
  }
</style></head><body>
<div class="actions">
  <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  <button class="ghost" onclick="window.close()">إغلاق</button>
</div>
<div class="invoice">
  <div class="stamp">${stampText}<small>${esc(stampSub)}</small></div>
  <main>
    <div class="invoice-head">
      <div class="brand">
        <div class="brand-logos">
          <img src="/found.png" alt="مؤسسة" />
          <img src="/fablab.png" alt="فاب لاب" />
        </div>
        <div class="brand-info">
          <h1>فاب لاب الأحساء</h1>
          <p>مؤسسة عبدالمنعم الراشد الإنسانية · خدمة الطباعة ثلاثية الأبعاد</p>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>فاتورة طباعة 3D</h2>
        <div class="no">${esc(reqNo)}</div>
        <div class="dates">
          <span>تاريخ الإصدار</span><b>${esc(invoiceDate)}</b>
          <span>طريقة الدفع</span><b>نقداً عند الاستلام</b>
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-title">المُصدَر إلى — Bill To</div>
        <div class="party-name">${esc(o.customerName)}</div>
        <div class="party-row"><b>الجوال: </b>${esc(o.customerPhone)}</div>
        <div class="party-row"><b>البريد: </b>${esc(o.customerEmail)}</div>
        ${o.customerNationalId ? `<div class="party-row"><b>الهوية: </b>${esc(o.customerNationalId)}</div>` : ''}
        ${o.deliveryAddress ? `<div class="party-row"><b>العنوان: </b>${esc(o.deliveryAddress)}</div>` : ''}
      </div>
      <div class="party">
        <div class="party-title">تفاصيل الطباعة</div>
        <div class="party-name">${esc(o.fileName)}</div>
        <div class="party-row"><b>الخامة: </b>${esc(o.material)}</div>
        <div class="party-row"><b>نمط اللون: </b>${o.colorMode === 'multi' ? 'متعدد الألوان' : 'لون واحد'}</div>
        ${o.estimatedWeight ? `<div class="party-row"><b>الوزن التقديري: </b>${esc(o.estimatedWeight)} جم</div>` : ''}
      </div>
    </div>

    <div class="items-title">تفصيل الألوان</div>
    <table class="items">
      <thead><tr><th class="cell-idx">#</th><th>الجزء</th><th>اللون</th></tr></thead>
      <tbody>${colorRows}</tbody>
    </table>

    <div class="items-title">تفاصيل التكلفة</div>
    <table class="items">
      <thead><tr><th>البند</th><th class="cell-num">القيمة</th></tr></thead>
      <tbody>
        <tr><td>الخامة (${esc(o.material)}) — ${esc(o.estimatedWeight || 0)} جم × ${SAR(o.materialRate)}</td><td class="cell-num">${SAR(Number(o.estimatedWeight || 0) * Number(o.materialRate || 0))}</td></tr>
        <tr><td>رسوم الإعداد والمعايرة</td><td class="cell-num">${SAR(o.setupFee)}</td></tr>
        ${Number(o.multiColorFee) > 0 ? `<tr><td>رسوم الطباعة متعددة الألوان</td><td class="cell-num">${SAR(o.multiColorFee)}</td></tr>` : ''}
      </tbody>
    </table>

    <div class="totals-wrap">
      <div class="payment-info">
        <div class="pi-title">معلومات الطلب</div>
        <div class="pi-row"><b>حالة الطلب: </b>${esc(o.status)}</div>
        <div class="pi-row"><b>حالة الدفع: </b>${paid ? '✓ مدفوع بالكامل' : 'بانتظار الدفع'}</div>
        ${o.paidAt ? `<div class="pi-row"><b>تاريخ الدفع: </b>${esc(new Date(o.paidAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' }))}</div>` : ''}
      </div>
      <table class="totals">
        <tr><td class="label">المجموع الفرعي</td><td class="val">${SAR(o.subtotal)}</td></tr>
        <tr><td class="label">ضريبة القيمة المضافة (${Math.round((o.taxRate || 0) * 100)}%)</td><td class="val">${SAR(o.taxAmount)}</td></tr>
        <tr class="final"><td class="label">الإجمالي المستحق</td><td class="val">${SAR(o.estimatedCost)}</td></tr>
      </table>
    </div>

    <div class="invoice-foot">
      <div><b>فاب لاب الأحساء</b> · مؤسسة عبدالمنعم الراشد الإنسانية</div>
      <div>fablabsahsa.com</div>
    </div>
  </main>
</div>
</body></html>`);
  } catch (err) {
    console.error('print3d publicInvoiceHtml:', err);
    res.status(500).send('Server error');
  }
};

// -------------------- ADMIN --------------------

exports.list = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    const rows = await Print3DRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['fileData'] } // keep the list payload lean
    });
    res.json(rows);
  } catch (err) {
    console.error('print3d list:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const r = await Print3DRequest.findByPk(req.params.id, {
      attributes: { exclude: ['fileData'] }
    });
    if (!r) return res.status(404).json({ message: 'Not found' });
    res.json(r);
  } catch (err) {
    console.error('print3d get:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Download the raw file. Streams the base64 payload back as its
// original binary type.
exports.download = async (req, res) => {
  try {
    const r = await Print3DRequest.findByPk(req.params.id);
    if (!r) return res.status(404).send('Not found');
    const raw = String(r.fileData || '');
    // Accept "data:application/octet-stream;base64,XXXX" or plain base64.
    const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
    const buf = Buffer.from(b64, 'base64');
    const safeName = r.fileName.replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (err) {
    console.error('print3d download:', err);
    res.status(500).send('Server error');
  }
};

exports.rates = async (req, res) => {
  try {
    const rates = await _loadRates();
    res.json(rates);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Recalculate + save the quote on the request.
exports.quote = async (req, res) => {
  try {
    const { estimatedWeight, sendEmail } = req.body || {};
    const r = await Print3DRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });

    const w = Number(estimatedWeight);
    if (!Number.isFinite(w) || w <= 0) {
      return res.status(400).json({ message: 'estimatedWeight must be a positive number' });
    }

    const rates = await _loadRates();
    const q = _computeQuote(w, r.material, r.colorMode, rates);
    await r.update({
      estimatedWeight: w,
      materialRate: q.materialRate,
      setupFee: q.setupFee,
      multiColorFee: q.multiColorFee,
      subtotal: q.subtotal,
      taxRate: q.taxRate,
      taxAmount: q.taxAmount,
      estimatedCost: q.estimatedCost,
      status: 'quoted',
      quotedAt: new Date()
    });

    if (sendEmail !== false) {
      process.nextTick(async () => {
        try {
          const reqNo = fmtRequestNumber(r.requestNumber);
          const acceptUrl = `${_publicOrigin()}/print-quote/${r.quoteToken}`;
          const html = `<div style="font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#0f172a;background:#f4f6fb;padding:24px" dir="rtl">
            <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
              <div style="background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;padding:20px 24px">
                <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء · خدمة الطباعة</div>
                <div style="font-size:20px;font-weight:800;margin-top:4px">عرض السعر جاهز — ${esc(reqNo)}</div>
              </div>
              <div style="padding:22px 24px;font-size:14px;line-height:1.7">
                <p>مرحباً <b>${esc(r.customerName)}</b>،</p>
                <p>تمت مراجعة الملف المرسل، وفيما يلي عرض السعر التقديري لطلب الطباعة الخاص بك:</p>
                <table style="width:100%;font-size:13px;border-collapse:collapse;margin:12px 0;background:#f8fafc;border-radius:8px">
                  <tr><td style="padding:8px 12px;color:#64748b;width:170px">الوزن التقديري:</td><td style="padding:8px 12px;font-weight:700">${w} جم</td></tr>
                  <tr><td style="padding:8px 12px;color:#64748b">الخامة:</td><td style="padding:8px 12px">${esc(r.material)} — ${SAR(q.materialRate)}/جم</td></tr>
                  <tr><td style="padding:8px 12px;color:#64748b">رسوم الإعداد:</td><td style="padding:8px 12px">${SAR(q.setupFee)}</td></tr>
                  ${q.multiColorFee > 0 ? `<tr><td style="padding:8px 12px;color:#64748b">رسوم الألوان المتعددة:</td><td style="padding:8px 12px">${SAR(q.multiColorFee)}</td></tr>` : ''}
                  <tr><td style="padding:8px 12px;color:#64748b">المجموع الفرعي:</td><td style="padding:8px 12px">${SAR(q.subtotal)}</td></tr>
                  <tr><td style="padding:8px 12px;color:#64748b">ضريبة القيمة المضافة (15%):</td><td style="padding:8px 12px">${SAR(q.taxAmount)}</td></tr>
                  <tr style="background:#0ea5e9;color:#fff"><td style="padding:12px;font-weight:800">الإجمالي:</td><td style="padding:12px;font-weight:800;font-size:16px">${SAR(q.estimatedCost)}</td></tr>
                </table>
                <div style="text-align:center;margin:22px 0">
                  <a href="${acceptUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;margin-inline-end:8px">✓ موافقة على السعر</a>
                  <a href="${acceptUrl}" style="display:inline-block;background:#ef4444;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800">✕ رفض السعر</a>
                </div>
                <p style="font-size:11px;color:#6b7280;text-align:center">افتح الرابط أعلاه لتأكيد قرارك.</p>
              </div>
            </div>
          </div>`;
          await _sendMail(r.customerEmail, `عرض سعر الطباعة ${reqNo} — ${SAR(q.estimatedCost)}`, html, `Quote for ${reqNo}: ${SAR(q.estimatedCost)}. Decide at ${acceptUrl}`);
          await r.update({ customerEmailSentAt: new Date() });
        } catch (e) { console.error('print3d quote email:', e); }
      });
    }

    res.json(r);
  } catch (err) {
    console.error('print3d quote:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body || {};
    const allowed = ['submitted','quoted','accepted','rejected','printing','ready','completed','cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const r = await Print3DRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    const patch = { status };
    if (adminNotes !== undefined) patch.adminNotes = adminNotes;
    if (status === 'completed') patch.completedAt = new Date();
    if (status === 'cancelled') patch.cancelledAt = new Date();
    await r.update(patch);
    res.json(r);
  } catch (err) {
    console.error('print3d updateStatus:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markPaid = async (req, res) => {
  try {
    const r = await Print3DRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    await r.update({ paidAt: new Date() });
    res.json(r);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const r = await Print3DRequest.findByPk(req.params.id);
    if (!r) return res.status(404).json({ message: 'Not found' });
    await r.destroy();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
