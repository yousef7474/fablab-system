const { StoreOrder, StoreItem } = require('../models');
const { sequelize } = require('../config/database');
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

const _buildCustomerInvoiceEmail = (order, subject, headline) => {
  const orderNo = fmtOrderNumber(order.orderNumber);
  return {
    subject: `${subject} — ${orderNo}`,
    html: `<!doctype html><html dir="rtl"><body style="margin:0;font-family:Segoe UI,Tahoma,Arial,sans-serif;background:#f4f6fb;color:#0f172a;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.08)">
  <div style="background:linear-gradient(135deg,#EE2329,#c41e24);color:#fff;padding:22px 24px">
    <div style="font-size:12px;letter-spacing:1px;opacity:0.85">FABLAB الأحساء · متجر</div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">${headline}</div>
    <div style="font-size:13px;margin-top:8px;opacity:0.95">رقم الطلب: <b style="font-family:'JetBrains Mono',monospace">${orderNo}</b></div>
  </div>
  <div style="padding:22px 24px">
    <p style="margin:0 0 14px;font-size:14px;line-height:1.75">
      مرحباً ${order.customerName}،
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.75">
      نشكركم على طلبكم من متجر فاب لاب الأحساء. فيما يلي تفاصيل الفاتورة:
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
        <tr><td colspan="3" style="padding:8px 12px;text-align:end;color:#64748b">ضريبة القيمة المضافة (${Math.round((order.taxRate || 0) * 100)}%)</td><td style="padding:8px 12px;text-align:end">${SAR(order.taxAmount)}</td></tr>
        <tr style="background:#fef2f2"><td colspan="3" style="padding:12px;text-align:end;color:#c41e24;font-weight:800;font-size:14px">الإجمالي الكلي</td><td style="padding:12px;text-align:end;color:#c41e24;font-weight:800;font-size:16px">${SAR(order.total)}</td></tr>
      </tfoot>
    </table>

    ${order.adminNotes ? `<div style="background:#eff6ff;padding:12px 14px;border-radius:8px;font-size:13px;color:#1e3a8a;margin-bottom:16px;border-inline-start:3px solid #3b82f6"><b>ملاحظة من الإدارة</b><br>${order.adminNotes}</div>` : ''}

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
      deliveryAddress, notes, items
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
    const taxRate = 0.15;
    const taxAmount = +(subtotal * taxRate).toFixed(2);
    const total = +(subtotal + taxAmount).toFixed(2);

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
      subtotal, taxRate, taxAmount, total,
      status: 'pending'
    });

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

        const custMail = _buildCustomerInvoiceEmail(
          order,
          'تم استلام طلبك',
          'تم استلام طلبك — بانتظار التأكيد'
        );
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

    // Email the customer about the change, when asked
    if (notifyCustomer && order.customerEmail) {
      const labels = {
        confirmed: { subject: 'تم تأكيد طلبك',  headline: 'تم تأكيد طلبك من متجر فاب لاب' },
        ready:     { subject: 'طلبك جاهز',      headline: 'طلبك جاهز للاستلام' },
        completed: { subject: 'تم استلام طلبك', headline: 'شكراً — تم استلام طلبك' },
        cancelled: { subject: 'تم إلغاء طلبك',  headline: 'نأسف — تم إلغاء طلبك' }
      };
      const info = labels[status];
      if (info) {
        const mail = _buildCustomerInvoiceEmail(order, info.subject, info.headline);
        await _sendMail(order.customerEmail, mail.subject, mail.html, mail.text);
        await order.update({ customerEmailSentAt: new Date() });
      }
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
