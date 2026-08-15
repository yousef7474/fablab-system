const { DiscountCoupon } = require('../models');

// ---- Helpers ----

// Returns { ok: true, coupon } or { ok: false, reason, reasonAr }.
// Callable from the order controller so cart price stays honest.
const validateCouponAgainstOrder = async (code, subtotal) => {
  if (!code) return { ok: false, reason: 'No code', reasonAr: 'لم يُدخل رمز' };
  const coupon = await DiscountCoupon.findOne({
    where: { code: String(code).trim().toUpperCase() }
  });
  if (!coupon) return { ok: false, reason: 'Coupon not found', reasonAr: 'الرمز غير صالح' };
  if (!coupon.isActive) return { ok: false, reason: 'Coupon disabled', reasonAr: 'الرمز غير مفعّل' };

  const today = new Date().toISOString().slice(0, 10);
  if (coupon.validFrom && today < String(coupon.validFrom)) {
    return { ok: false, reason: 'Not yet valid', reasonAr: 'الرمز لم يبدأ سريانه بعد' };
  }
  if (coupon.validUntil && today > String(coupon.validUntil)) {
    return { ok: false, reason: 'Coupon expired', reasonAr: 'انتهت صلاحية الرمز' };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: 'Usage limit reached', reasonAr: 'استُنفذ عدد استخدامات الرمز' };
  }
  if (coupon.minOrderTotal != null && Number(subtotal) < Number(coupon.minOrderTotal)) {
    return {
      ok: false,
      reason: `Minimum order ${coupon.minOrderTotal} not met`,
      reasonAr: `الحد الأدنى للطلب ${coupon.minOrderTotal} ر.س لتفعيل الرمز`
    };
  }
  return { ok: true, coupon };
};

exports.validateCouponAgainstOrder = validateCouponAgainstOrder;

// ---- Public ----

// POST /public/store/coupon/validate  body: { code, subtotal }
exports.publicValidate = async (req, res) => {
  try {
    const { code, subtotal } = req.body || {};
    const check = await validateCouponAgainstOrder(code, Number(subtotal) || 0);
    if (!check.ok) return res.status(400).json({ message: check.reason, messageAr: check.reasonAr });
    const c = check.coupon;
    const discountAmount = +((Number(subtotal) || 0) * (c.percent / 100)).toFixed(2);
    res.json({
      code: c.code,
      percent: c.percent,
      description: c.description,
      discountAmount
    });
  } catch (err) {
    console.error('publicValidate coupon:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ---- Admin CRUD ----

exports.list = async (req, res) => {
  try {
    const rows = await DiscountCoupon.findAll({ order: [['createdAt', 'DESC']] });
    res.json(rows);
  } catch (err) {
    console.error('list coupons:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { code, description, percent, isActive, maxUses, validFrom, validUntil, minOrderTotal } = req.body || {};
    if (!code || !percent) {
      return res.status(400).json({ message: 'code and percent are required' });
    }
    const p = Math.max(1, Math.min(100, Number(percent) || 1));
    const row = await DiscountCoupon.create({
      code, // hook uppercases + trims
      description: description ? String(description).trim() : null,
      percent: p,
      isActive: isActive !== false,
      maxUses: maxUses != null && maxUses !== '' ? Number(maxUses) : null,
      validFrom: validFrom || null,
      validUntil: validUntil || null,
      minOrderTotal: minOrderTotal != null && minOrderTotal !== '' ? Number(minOrderTotal) : null
    });
    res.status(201).json(row);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Code already exists', messageAr: 'الرمز مستخدم مسبقاً' });
    }
    console.error('create coupon:', err);
    res.status(500).json({ message: 'Server error', detail: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await DiscountCoupon.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const p = { ...req.body };
    if (p.percent != null) p.percent = Math.max(1, Math.min(100, Number(p.percent) || 1));
    if (p.maxUses === '' ) p.maxUses = null;
    if (p.validFrom === '') p.validFrom = null;
    if (p.validUntil === '') p.validUntil = null;
    if (p.minOrderTotal === '') p.minOrderTotal = null;
    delete p.usedCount; // admin can't tamper
    await row.update(p);
    res.json(row);
  } catch (err) {
    console.error('update coupon:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const row = await DiscountCoupon.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    await row.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('remove coupon:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
