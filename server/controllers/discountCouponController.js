const { DiscountCoupon } = require('../models');

// ---- Helpers ----

// Returns { ok: true, coupon } or { ok: false, reason, reasonAr }.
// Callable from the order controller so cart price stays honest.
const validateCouponAgainstOrder = async (code, subtotal) => {
  const trimmed = String(code || '').trim().toUpperCase();
  if (!trimmed) return { ok: false, reason: 'No code entered', reasonAr: 'لم يُدخل رمز خصم' };

  const coupon = await DiscountCoupon.findOne({ where: { code: trimmed } });
  if (!coupon) return { ok: false, reason: `Coupon "${trimmed}" not found`, reasonAr: `الرمز "${trimmed}" غير موجود` };
  if (!coupon.isActive) return { ok: false, reason: 'Coupon is disabled', reasonAr: 'الرمز غير مفعّل — تواصل مع الإدارة' };

  const today = new Date().toISOString().slice(0, 10);
  if (coupon.validFrom && today < String(coupon.validFrom).slice(0, 10)) {
    return { ok: false, reason: `Not valid until ${coupon.validFrom}`, reasonAr: `الرمز يبدأ سريانه في ${String(coupon.validFrom).slice(0, 10)}` };
  }
  if (coupon.validUntil && today > String(coupon.validUntil).slice(0, 10)) {
    return { ok: false, reason: `Expired on ${coupon.validUntil}`, reasonAr: `انتهت صلاحية الرمز في ${String(coupon.validUntil).slice(0, 10)}` };
  }
  // maxUses <= 0 is treated as unlimited (matches how stock uses -1)
  if (coupon.maxUses != null && Number(coupon.maxUses) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.maxUses)) {
    return { ok: false, reason: 'Usage limit reached', reasonAr: 'استُنفذ عدد استخدامات هذا الرمز' };
  }
  if (coupon.minOrderTotal != null && Number(coupon.minOrderTotal) > 0) {
    const need = Number(coupon.minOrderTotal);
    const have = Number(subtotal) || 0;
    if (have < need) {
      return {
        ok: false,
        reason: `Minimum order ${need} not met (have ${have})`,
        reasonAr: `الحد الأدنى لتفعيل الرمز: ${need.toFixed(2)} ر.س (الحالي: ${have.toFixed(2)} ر.س)`
      };
    }
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
    // Sanitize numeric bounds — treat <= 0 as "no limit / no minimum".
    const cleanMaxUses = (() => {
      if (maxUses == null || maxUses === '') return null;
      const n = Number(maxUses);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();
    const cleanMinOrder = (() => {
      if (minOrderTotal == null || minOrderTotal === '') return null;
      const n = Number(minOrderTotal);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();
    const row = await DiscountCoupon.create({
      code, // hook uppercases + trims
      description: description ? String(description).trim() : null,
      percent: p,
      isActive: isActive !== false,
      maxUses: cleanMaxUses,
      validFrom: validFrom || null,
      validUntil: validUntil || null,
      minOrderTotal: cleanMinOrder
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
