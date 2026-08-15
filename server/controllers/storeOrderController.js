const { StoreOrder, StoreItem, DiscountCoupon } = require('../models');
const { sequelize } = require('../config/database');
const { validateCouponAgainstOrder } = require('./discountCouponController');
const sgMail = require('@sendgrid/mail');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Notifications to the store's central inbox go here.
const STORE_NOTIFY_EMAIL = 'fablabspec@fablabsahsa.com';
const SAR = (n) => `${Number(n || 0).toFixed(2)} ر.س`;
const fmtOrderNumber = (n) => n == null ? '—' : `INV-${String(n).padStart(4, '0')}`;

const _publicOrigin = () =>
  process.env.PUBLIC_APP_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');

// -------------------- SEQUENCE HELPER --------------------

const _assignNextOrderNumber = async () => {
  return await sequelize.transaction(async (t) => {
    const [row] = await sequelize.query(
      `SELECT COALESCE(MAX("orderNumber"), 0) + 1 AS next FROM store_orders`,
      { transaction: t }
    );
    return Number(row?.[0]?.next) || 1;
  });
};

// -------------------- EMAIL TEMPLATES --------------------

const _renderItemRows = (items) => items.map(i => `
  <tr>
    <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb">${i.name || ''}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${i.quantity}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:end">${SAR(i.price)}</td>
    <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:end;font-weight:700">${SAR(i.lineTotal)}</td>
  </tr>
`).join('');

const _buildAdminOrderEmail = (order) => {
  const orderNo = fmtOrderNumber(order.orderNumber);
  return {
    subject: `طلب متجر جديد ${orderNo} — ${order.customerName}`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,#EE2329,#c41e24);color:#fff;padding:20px 24px">
    <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء · متجر</div>
    <div style="font-size:20px;font-weight:800;margin-top:4px">طلب جديد ${orderNo}</div>
  </div>
  <div style="padding:22px 24px">
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7">
      وصل طلب جديد من العميل <b>${order.customerName}</b> بحاجة إلى مراجعتكم.
    </p>

    <table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:6px 0;color:#64748b;width:130px">العميل:</td><td style="padding:6px 0;font-weight:700">${order.customerName}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">الجوال:</td><td style="padding:6px 0;direction:ltr">${order.customerPhone || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">البريد:</td><td style="padding:6px 0;direction:ltr">${order.customerEmail || '—'}</td></tr>
      ${order.customerNationalId ? `<tr><td style="padding:6px 0;color:#64748b">رقم الهوية:</td><td style="padding:6px 0;direction:ltr">${order.customerNationalId}</td></tr>` : ''}
      ${order.deliveryAddress ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top">عنوان التسليم:</td><td style="padding:6px 0">${order.deliveryAddress}</td></tr>` : ''}
      ${order.notes ? `<tr><td style="padding:6px 0;color:#64748b;vertical-align:top">ملاحظات:</td><td style="padding:6px 0">${order.notes}</td></tr>` : ''}
    </table>

    <table style="width:100%;font-size:13px;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <thead>
        <tr style="background:#fef2f2">
          <th style="padding:10px 8px;text-align:right;color:#c41e24">الصنف</th>
          <th style="padding:10px 8px;text-align:center;color:#c41e24">الكمية</th>
          <th style="padding:10px 8px;text-align:end;color:#c41e24">السعر</th>
          <th style="padding:10px 8px;text-align:end;color:#c41e24">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${_renderItemRows(order.items || [])}</tbody>
      <tfoot>
        <tr><td colspan="3" style="padding:8px 12px;text-align:end;color:#64748b">المجموع الفرعي</td><td style="padding:8px 12px;text-align:end">${SAR(order.subtotal)}</td></tr>
        ${Number(order.discountAmount) > 0 ? `<tr><td colspan="3" style="padding:8px 12px;text-align:end;color:#16a34a">خصم (${order.couponCode} · ${order.couponPercent}%)</td><td style="padding:8px 12px;text-align:end;color:#16a34a">-${SAR(order.discountAmount)}</td></tr>` : ''}
        <tr><td colspan="3" style="padding:8px 12px;text-align:end;color:#64748b">ضريبة القيمة المضافة (${Math.round((order.taxRate || 0) * 100)}%)</td><td style="padding:8px 12px;text-align:end">${SAR(order.taxAmount)}</td></tr>
        <tr style="background:#fef2f2"><td colspan="3" style="padding:12px;text-align:end;color:#c41e24;font-weight:800;font-size:14px">الإجمالي الكلي</td><td style="padding:12px;text-align:end;color:#c41e24;font-weight:800;font-size:16px">${SAR(order.total)}</td></tr>
      </tfoot>
    </table>

    <div style="text-align:center;margin-top:16px">
      <a href="${_publicOrigin()}/admin/dashboard?tab=store" style="display:inline-block;background:#EE2329;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800">إدارة الطلب</a>
    </div>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`,
    text: `طلب متجر جديد ${orderNo}

العميل: ${order.customerName}
الجوال: ${order.customerPhone}
البريد: ${order.customerEmail}
الإجمالي: ${SAR(order.total)}

للإدارة: ${_publicOrigin()}/admin/dashboard?tab=store`
  };
};

// Renders the 4-step order timeline as inline HTML for the email.
// `activeIdx` is the index of the CURRENT step (0..3). Steps before
// it are shown as done (green), after are grey. Cancelled is a
// distinct visual — full red bar across all steps.
const _renderTimeline = (activeIdx, cancelled) => {
  const steps = [
    { icon: '📝', label: 'مستلم' },
    { icon: '✓',  label: 'مؤكد' },
    { icon: '📦', label: 'جاهز' },
    { icon: '✅', label: 'مكتمل' }
  ];
  if (cancelled) {
    return `<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin:14px 0">
      <span style="font-size:22px">❌</span>
      <span style="font-weight:800;color:#b91c1c;font-size:14px">تم إلغاء الطلب</span>
    </div>`;
  }
  const cells = steps.map((s, i) => {
    const done = i < activeIdx;
    const active = i === activeIdx;
    const bg = done ? '#dcfce7' : active ? '#EE2329' : '#f1f5f9';
    const color = done ? '#16a34a' : active ? '#fff' : '#94a3b8';
    const border = done ? '2px solid #86efac' : active ? '2px solid #c41e24' : '2px solid transparent';
    return `<td align="center" style="padding:0 2px">
      <div style="background:${bg};border:${border};color:${color};padding:8px 6px;border-radius:8px;font-size:11px;font-weight:700">
        <div style="font-size:18px;margin-bottom:2px">${s.icon}</div>
        <div>${s.label}</div>
      </div>
    </td>`;
  }).join('');
  return `<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:14px 0"><tr>${cells}</tr></table>`;
};

// Status → { subject, headline, detail, timelineIdx, cancelled }.
const _statusMeta = (status) => {
  switch (status) {
    case 'confirmed':
      return {
        subject: 'تم تأكيد طلبك',
        headline: 'تم تأكيد طلبك من متجر فاب لاب',
        detail: 'استلمنا طلبك وتمت مراجعته بنجاح. سنبدأ الآن بتجهيز الأصناف، وسنُعلمك بالبريد فور جاهزيتها للاستلام.',
        timelineIdx: 1
      };
    case 'ready':
      return {
        subject: 'طلبك جاهز للاستلام',
        headline: 'طلبك جاهز في مقر فاب لاب',
        detail: 'طلبك جاهز الآن ويمكنك الحضور لاستلامه من مقر فاب لاب الأحساء خلال ساعات العمل. يرجى إحضار رقم الطلب أو الفاتورة عند الاستلام والدفع نقداً.',
        timelineIdx: 2
      };
    case 'completed':
      return {
        subject: 'تم استلام طلبك — شكراً لك',
        headline: 'شكراً — تم استلام طلبك بنجاح',
        detail: 'تم استلام طلبك ودفعه بالكامل. نأمل أن تكون تجربتك ممتازة، ونشكرك على تعاملك مع فاب لاب الأحساء. تجد الفاتورة أدناه ويمكنك حفظها كملف PDF.',
        timelineIdx: 3
      };
    case 'cancelled':
      return {
        subject: 'تم إلغاء طلبك',
        headline: 'نأسف — تم إلغاء طلبك',
        detail: 'تم إلغاء طلبك من قِبل الإدارة. للاستفسار عن السبب أو تقديم طلب جديد، يرجى التواصل مع فريق فاب لاب على fablabspec@fablabsahsa.com.',
        cancelled: true
      };
    default: // pending
      return {
        subject: 'تم استلام طلبك',
        headline: 'تم استلام طلبك — بانتظار التأكيد',
        detail: 'استلمنا طلبك بنجاح ونحن الآن بصدد مراجعته. ستصلك رسالة بريد إلكتروني فور تأكيده من قِبل الإدارة.',
        timelineIdx: 0
      };
  }
};

const _buildCustomerInvoiceEmail = (order, subjectOrMeta, headlineArg, detailArg) => {
  // Backwards-compat: allow old (subject, headline) call or new (metaObj).
  const meta = (typeof subjectOrMeta === 'object' && subjectOrMeta)
    ? subjectOrMeta
    : { subject: subjectOrMeta, headline: headlineArg, detail: detailArg };
  const orderNo = fmtOrderNumber(order.orderNumber);
  const timeline = meta.cancelled != null || meta.timelineIdx != null
    ? _renderTimeline(meta.timelineIdx || 0, !!meta.cancelled)
    : '';
  return {
    subject: `${meta.subject} — ${orderNo}`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,#EE2329,#c41e24);color:#fff;padding:22px 24px">
    <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء · متجر</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">${meta.headline}</div>
    <div style="font-size:13px;margin-top:8px;opacity:0.95">رقم الطلب: <b style="font-family:'JetBrains Mono',monospace">${orderNo}</b></div>
  </div>
  <div style="padding:22px 24px">
    <p style="margin:0 0 10px;font-size:14px;line-height:1.75">
      مرحباً ${order.customerName}،
    </p>
    ${meta.detail ? `<p style="margin:0 0 6px;font-size:14px;line-height:1.85;color:#334155">${meta.detail}</p>` : ''}
    ${timeline}
    <p style="margin:14px 0 10px;font-size:13px;line-height:1.75;color:#64748b">
      فيما يلي تفاصيل فاتورتك:
    </p>

    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:10px;overflow:hidden;margin-bottom:16px">
      <tr><td style="padding:10px 14px;color:#64748b;width:120px;border-bottom:1px solid #e5e7eb">التاريخ:</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;direction:ltr">${new Date(order.createdAt).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' })}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;border-bottom:1px solid #e5e7eb">الحالة:</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:700">${arabicStatus(order.status)}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b">طريقة الدفع:</td><td style="padding:10px 14px">نقداً عند الاستلام</td></tr>
    </table>

    <table style="width:100%;font-size:13px;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <thead>
        <tr style="background:#fef2f2">
          <th style="padding:10px 8px;text-align:right;color:#c41e24">الصنف</th>
          <th style="padding:10px 8px;text-align:center;color:#c41e24">الكمية</th>
          <th style="padding:10px 8px;text-align:end;color:#c41e24">السعر</th>
          <th style="padding:10px 8px;text-align:end;color:#c41e24">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${_renderItemRows(order.items || [])}</tbody>
      <tfoot>
        <tr><td colspan="3" style="padding:8px 12px;text-align:end;color:#64748b">المجموع الفرعي</td><td style="padding:8px 12px;text-align:end">${SAR(order.subtotal)}</td></tr>
        ${Number(order.discountAmount) > 0 ? `<tr><td colspan="3" style="padding:8px 12px;text-align:end;color:#16a34a">خصم (${order.couponCode} · ${order.couponPercent}%)</td><td style="padding:8px 12px;text-align:end;color:#16a34a">-${SAR(order.discountAmount)}</td></tr>` : ''}
        <tr><td colspan="3" style="padding:8px 12px;text-align:end;color:#64748b">ضريبة القيمة المضافة (${Math.round((order.taxRate || 0) * 100)}%)</td><td style="padding:8px 12px;text-align:end">${SAR(order.taxAmount)}</td></tr>
        <tr style="background:#fef2f2"><td colspan="3" style="padding:12px;text-align:end;color:#c41e24;font-weight:800;font-size:14px">الإجمالي الكلي</td><td style="padding:12px;text-align:end;color:#c41e24;font-weight:800;font-size:16px">${SAR(order.total)}</td></tr>
      </tfoot>
    </table>

    ${order.adminNotes ? `<div style="background:#eff6ff;padding:12px 14px;border-radius:8px;font-size:13px;color:#1e3a8a;margin-bottom:16px;border-inline-start:3px solid #3b82f6"><b>ملاحظة من الإدارة</b><br>${order.adminNotes}</div>` : ''}

    <div style="text-align:center;margin:20px 0 12px">
      <a href="${_publicOrigin()}/api/public/store/orders/${order.orderId}/invoice" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:800;font-size:14px">📄 عرض الفاتورة / حفظ PDF</a>
    </div>
    <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6">
      افتح الرابط ثم اضغط "طباعة / حفظ PDF" لتنزيل نسخة PDF من فاتورتك.
    </p>

    <p style="margin:16px 0 0;font-size:13px;color:#334155;line-height:1.7">
      للاستفسار عن الطلب، يرجى التواصل معنا وذكر رقم الطلب أعلاه.<br>
      شكراً لتعاملكم مع فاب لاب الأحساء.
    </p>
  </div>
  <div style="background:#f8fafc;padding:12px 24px;font-size:11px;color:#94a3b8;text-align:center">
    فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية
  </div>
</div>
</body></html>`,
    text: `${headline} — ${orderNo}\n\nالإجمالي: ${SAR(order.total)}`
  };
};

const arabicStatus = (s) => ({
  pending:   'قيد المراجعة',
  confirmed: 'تم التأكيد',
  ready:     'جاهز للاستلام',
  completed: 'مكتمل',
  cancelled: 'ملغى'
}[s] || s);

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
    console.error('store email failed:', err?.response?.body || err);
    return { ok: false, reason: err.message };
  }
};

// -------------------- PUBLIC: PLACE ORDER --------------------

exports.publicCreate = async (req, res) => {
  try {
    const {
      customerName, customerPhone, customerEmail, customerNationalId,
      deliveryAddress, notes, items, couponCode
    } = req.body || {};

    if (!customerName || !customerPhone || !customerEmail || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        messageAr: 'الرجاء تعبئة جميع الحقول المطلوبة'
      });
    }

    // Resolve item snapshots server-side from live prices to prevent
    // client-side tampering.
    const ids = items.map(i => i.itemId).filter(Boolean);
    const dbItems = await StoreItem.findAll({ where: { itemId: ids, isActive: true } });
    const dbMap = new Map(dbItems.map(x => [x.itemId, x]));
    const snapshot = [];
    let subtotal = 0;
    for (const req of items) {
      const it = dbMap.get(req.itemId);
      if (!it) return res.status(400).json({ message: `Item ${req.itemId} unavailable` });
      const qty = Math.max(1, Math.floor(Number(req.quantity) || 1));
      if (it.stock >= 0 && qty > it.stock) {
        return res.status(409).json({
          message: `Not enough stock for ${it.name}`,
          messageAr: `الكمية المطلوبة من "${it.name}" أكبر من المتوفر`
        });
      }
      const price = Number(it.price) || 0;
      const lineTotal = +(price * qty).toFixed(2);
      subtotal += lineTotal;
      snapshot.push({
        itemId: it.itemId,
        name: it.name,
        nameEn: it.nameEn,
        price,
        quantity: qty,
        lineTotal,
        image: (Array.isArray(it.images) && it.images[0]) ? it.images[0] : null
      });
    }
    subtotal = +subtotal.toFixed(2);

    // Apply coupon if the client passed one — server verifies again to
    // stop the client sending a fabricated discount.
    let couponCodeApplied = null;
    let couponPercentApplied = null;
    let discountAmount = 0;
    let couponRow = null;
    if (couponCode && String(couponCode).trim()) {
      const check = await validateCouponAgainstOrder(couponCode, subtotal);
      if (!check.ok) {
        return res.status(400).json({ message: check.reason, messageAr: check.reasonAr });
      }
      couponRow = check.coupon;
      couponCodeApplied = couponRow.code;
      couponPercentApplied = couponRow.percent;
      discountAmount = +(subtotal * (couponRow.percent / 100)).toFixed(2);
    }

    const netAfterDiscount = +(subtotal - discountAmount).toFixed(2);
    const taxRate = 0.15;
    const taxAmount = +(netAfterDiscount * taxRate).toFixed(2);
    const total = +(netAfterDiscount + taxAmount).toFixed(2);

    const orderNumber = await _assignNextOrderNumber();

    const order = await StoreOrder.create({
      orderNumber,
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      customerEmail: String(customerEmail).trim(),
      customerNationalId: customerNationalId ? String(customerNationalId).trim() : null,
      deliveryAddress: deliveryAddress ? String(deliveryAddress).trim() : null,
      notes: notes ? String(notes).trim() : null,
      items: snapshot,
      subtotal,
      couponCode: couponCodeApplied,
      couponPercent: couponPercentApplied,
      discountAmount,
      taxRate, taxAmount, total,
      status: 'pending'
    });

    // Consume the coupon usage once the order is persisted
    if (couponRow) {
      try {
        await couponRow.update({ usedCount: (couponRow.usedCount || 0) + 1 });
      } catch (e) { /* non-fatal */ }
    }

    // Decrement stock (only for items with finite stock)
    for (const line of snapshot) {
      const it = dbMap.get(line.itemId);
      if (it.stock >= 0) {
        await it.update({ stock: Math.max(0, it.stock - line.quantity) });
      }
    }

    // Fire off emails asynchronously — don't block the response.
    (async () => {
      try {
        const adminMail = _buildAdminOrderEmail(order);
        const adminRes = await _sendMail(STORE_NOTIFY_EMAIL, adminMail.subject, adminMail.html, adminMail.text);
        if (adminRes.ok) await order.update({ adminEmailSentAt: new Date() });

        const custMail = _buildCustomerInvoiceEmail(order, _statusMeta('pending'));
        const custRes = await _sendMail(order.customerEmail, custMail.subject, custMail.html, custMail.text);
        if (custRes.ok) await order.update({ customerEmailSentAt: new Date() });
      } catch (err) {
        console.error('store email dispatch error:', err);
      }
    })();

    res.status(201).json({
      message: 'Order placed',
      messageAr: 'تم استلام طلبك — سنتواصل معك للتأكيد',
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      total: order.total
    });
  } catch (err) {
    console.error('publicCreate order:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

// GET /public/store/orders/:id — customer's confirmation page fetch
exports.publicGet = async (req, res) => {
  try {
    const order = await StoreOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    // Only expose non-admin fields
    const { adminNotes, ...safe } = order.toJSON();
    res.json(safe);
  } catch (err) {
    console.error('publicGet order:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /public/store/orders/:id/invoice — HTML invoice, safe to open
// in any browser. Printing (Ctrl+P) → "Save as PDF" produces a
// customer-ready PDF file, which is what the completed-order email
// links to.
exports.publicInvoiceHtml = async (req, res) => {
  try {
    const order = await StoreOrder.findByPk(req.params.id);
    if (!order) return res.status(404).send('Order not found');

    const o = order.toJSON();
    const esc = (v) => String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const paid = !!o.paidAt;
    const stampColor = paid ? '#16a34a' : '#dc2626';
    const stampText = paid ? 'تم الدفع' : 'لم يُدفع';
    const stampSub = paid && o.paidAt
      ? new Date(o.paidAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' })
      : 'بانتظار الدفع';
    const orderNo = fmtOrderNumber(o.orderNumber);
    const itemsHtml = (o.items || []).map((i, idx) => `
      <tr>
        <td class="cell-idx">${idx + 1}</td>
        <td>${esc(i.name)}</td>
        <td class="cell-num">${i.quantity}</td>
        <td class="cell-num">${SAR(i.price)}</td>
        <td class="cell-num cell-total">${SAR(i.lineTotal)}</td>
      </tr>`).join('');
    const invoiceDate = new Date(o.createdAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', {
      calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric'
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فاتورة ${orderNo}</title>
<style>
  :root { color-scheme: light; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif; background:#f4f6fb; color:#1f2937; padding:24px 12px; }
  .actions { max-width:820px; margin:0 auto 16px; display:flex; gap:10px; justify-content:end; flex-wrap:wrap; }
  .actions button { padding:12px 22px; border-radius:10px; border:none; background:linear-gradient(135deg,#EE2329,#ff4d51); color:#fff; font-family:inherit; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 8px 20px -8px rgba(238,35,41,0.5); }
  .actions .ghost { background:#fff; color:#0f172a; border:1px solid #e5e7eb; box-shadow:none; }
  .invoice { max-width:820px; margin:0 auto; background:#fff; border-radius:16px; box-shadow:0 20px 40px -20px rgba(15,23,42,0.15); padding:28px; position:relative; overflow:hidden; }
  .stamp { position:absolute; top:44%; inset-inline-start:22%; transform:rotate(-22deg); border:6px double ${stampColor}; color:${stampColor}; padding:18px 44px; font-family:'Bricolage Grotesque','Cairo',sans-serif; font-weight:900; font-size:44px; letter-spacing:3px; text-align:center; background:rgba(255,255,255,0.55); opacity:0.75; pointer-events:none; z-index:999; border-radius:12px; box-shadow:inset 0 0 0 3px ${stampColor}20; }
  .stamp small { display:block; font-size:14px; font-weight:700; margin-top:4px; opacity:0.9; }
  main { position:relative; z-index:1; font-size:12px; line-height:1.55; }
  .invoice-head { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding-bottom:16px; margin-bottom:20px; border-bottom:3px solid #0f172a; }
  .brand { display:flex; gap:12px; align-items:center; }
  .brand-logos { display:flex; gap:8px; }
  .brand-logos img { height:52px; }
  .brand-info h1 { font-family:'Bricolage Grotesque','Cairo',sans-serif; font-size:19px; color:#0f172a; margin-bottom:3px; }
  .brand-info p { font-size:11px; color:#6b7280; }
  .invoice-meta { text-align:end; }
  .invoice-meta h2 { font-family:'Bricolage Grotesque','Cairo',sans-serif; font-size:26px; font-weight:800; color:#0f172a; margin-bottom:4px; }
  .invoice-meta .no { font-family:'JetBrains Mono',monospace; font-size:15px; color:#EE2329; font-weight:800; letter-spacing:2px; }
  .invoice-meta .dates { display:grid; grid-template-columns:auto auto; gap:4px 10px; margin-top:10px; font-size:11px; justify-content:end; }
  .invoice-meta .dates span { color:#6b7280; }
  .invoice-meta .dates b { color:#0f172a; direction:ltr; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px; }
  .party { background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; }
  .party-title { font-size:10px; color:#6b7280; letter-spacing:1.4px; text-transform:uppercase; font-weight:700; margin-bottom:6px; }
  .party-name { font-size:14px; font-weight:800; color:#0f172a; margin-bottom:4px; }
  .party-row { font-size:11px; color:#4b5563; margin-top:2px; }
  .party-row b { color:#0f172a; }
  .items-title { font-size:11px; color:#6b7280; letter-spacing:1.4px; text-transform:uppercase; font-weight:700; margin-bottom:6px; }
  table.items { width:100%; border-collapse:collapse; margin-bottom:12px; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; }
  table.items thead { background:#0f172a; color:#fff; }
  table.items thead th { padding:10px 12px; text-align:start; font-size:10.5px; text-transform:uppercase; letter-spacing:1px; }
  table.items thead th.cell-num { text-align:end; }
  table.items tbody tr:nth-child(even) { background:#f9fafb; }
  table.items tbody td { padding:10px 12px; border-top:1px solid #e5e7eb; font-size:12px; }
  .cell-idx { font-family:'JetBrains Mono',monospace; color:#6b7280; width:28px; text-align:center; }
  .cell-num { font-family:'JetBrains Mono',monospace; text-align:end; }
  .cell-total { font-weight:800; color:#0f172a; }
  .totals-wrap { display:grid; grid-template-columns:1fr 320px; gap:14px; margin-bottom:16px; }
  .payment-info { background:#f8fafc; border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; font-size:11px; }
  .payment-info .pi-title { font-size:10px; text-transform:uppercase; letter-spacing:1.4px; color:#6b7280; font-weight:700; margin-bottom:6px; }
  .payment-info .pi-row { margin:3px 0; color:#4b5563; }
  .payment-info .pi-row b { color:#0f172a; }
  .totals { width:100%; border-collapse:collapse; font-size:12px; }
  .totals td { padding:8px 12px; border-bottom:1px solid #e5e7eb; }
  .totals td.label { color:#6b7280; text-align:end; }
  .totals td.val { font-family:'JetBrains Mono',monospace; text-align:end; font-weight:700; color:#0f172a; }
  .totals .discount td.label { color:#16a34a; }
  .totals .discount td.val { color:#16a34a; }
  .totals .final td { background:#EE2329; color:#fff; font-family:'JetBrains Mono',monospace; font-size:15px; font-weight:800; padding:14px; border:none; }
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
          <p>مؤسسة عبدالمنعم الراشد الإنسانية · متجر</p>
        </div>
      </div>
      <div class="invoice-meta">
        <h2>فاتورة</h2>
        <div class="no">${orderNo}</div>
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
        <div class="party-title">المُصدِر — From</div>
        <div class="party-name">فاب لاب الأحساء</div>
        <div class="party-row">مؤسسة عبدالمنعم الراشد الإنسانية</div>
        <div class="party-row">المملكة العربية السعودية — الأحساء</div>
        <div class="party-row"><b>البريد: </b>fablabspec@fablabsahsa.com</div>
      </div>
    </div>

    <div class="items-title">تفاصيل المشتريات</div>
    <table class="items">
      <thead>
        <tr><th class="cell-idx">#</th><th>الصنف</th><th class="cell-num">الكمية</th><th class="cell-num">السعر</th><th class="cell-num">الإجمالي</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals-wrap">
      <div class="payment-info">
        <div class="pi-title">معلومات الدفع</div>
        <div class="pi-row"><b>حالة الطلب: </b>${esc(o.status)}</div>
        <div class="pi-row"><b>حالة الدفع: </b>${paid ? '✓ مدفوع بالكامل' : 'بانتظار الدفع'}</div>
        ${o.paidAt ? `<div class="pi-row"><b>تاريخ الدفع: </b>${esc(new Date(o.paidAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' }))}</div>` : ''}
      </div>
      <table class="totals">
        <tr><td class="label">المجموع الفرعي</td><td class="val">${SAR(o.subtotal)}</td></tr>
        ${Number(o.discountAmount) > 0 ? `<tr class="discount"><td class="label">خصم (${esc(o.couponCode)} · ${o.couponPercent}%)</td><td class="val">-${SAR(o.discountAmount)}</td></tr>` : ''}
        <tr><td class="label">ضريبة القيمة المضافة (${Math.round((o.taxRate || 0) * 100)}%)</td><td class="val">${SAR(o.taxAmount)}</td></tr>
        <tr class="final"><td class="label">الإجمالي المستحق</td><td class="val">${SAR(o.total)}</td></tr>
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
    console.error('publicInvoiceHtml:', err);
    res.status(500).send('Server error');
  }
};

// -------------------- ADMIN --------------------

exports.list = async (req, res) => {
  try {
    const orders = await StoreOrder.findAll({ order: [['createdAt', 'DESC']] });
    res.json(orders);
  } catch (err) {
    console.error('list orders:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.get = async (req, res) => {
  try {
    const order = await StoreOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    res.json(order);
  } catch (err) {
    console.error('get order:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /store/orders/:id/status — body { status, adminNotes?, notifyCustomer? }
exports.updateStatus = async (req, res) => {
  try {
    const order = await StoreOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    const { status, adminNotes, notifyCustomer } = req.body || {};
    const valid = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];
    if (status && !valid.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const patch = {};
    if (status) patch.status = status;
    if (adminNotes !== undefined) patch.adminNotes = adminNotes ? String(adminNotes).trim() : null;
    if (status === 'completed') { patch.completedAt = new Date(); patch.paidAt = patch.paidAt || new Date(); }
    if (status === 'cancelled') patch.cancelledAt = new Date();
    await order.update(patch);

    // Email the customer about the change, when asked. The status-
    // specific meta gives the recipient a detailed explanation + a
    // progress-timeline visual, not just a swapped headline.
    if (notifyCustomer && order.customerEmail && ['confirmed', 'ready', 'completed', 'cancelled'].includes(status)) {
      const meta = _statusMeta(status);
      const mail = _buildCustomerInvoiceEmail(order, meta);
      await _sendMail(order.customerEmail, mail.subject, mail.html, mail.text);
      await order.update({ customerEmailSentAt: new Date() });
    }
    res.json(order);
  } catch (err) {
    console.error('updateStatus order:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /store/orders/:id/mark-paid
exports.markPaid = async (req, res) => {
  try {
    const order = await StoreOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    await order.update({ paidAt: new Date() });
    res.json(order);
  } catch (err) {
    console.error('markPaid:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const order = await StoreOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    await order.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('remove order:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
