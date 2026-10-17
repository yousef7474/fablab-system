const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { PaymentPage, PaymentSubmission, Settings } = require('../models');
const { IMAGE_TYPES, sendBinary, rateLimited } = require('../utils/siteContent');
const { buildReceiptHtml, sendPaymentReceived, sendPaymentVerified, sendPaymentRejected } = require('../utils/paymentPageDocs');

// Payment pages: the admin creates a page (title, amount, how many people
// may pay, open/closed, optional deadline), shares /pay/:slug, and each
// customer pays by bank transfer (uploading the receipt) or mada at
// FabLab. The admin verifies every payment; the customer then gets the
// invoice. Bank + mada details are the same ones the workshops use.

const METHODS = ['bank_transfer', 'mada'];
const PROOF_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf' };
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const MAX_COVER_BYTES = 4 * 1024 * 1024;
const SLUG_RE = /^[A-Za-z0-9]{6,24}$/;
const TAKES_A_PLACE = ['pending', 'verified'];
const REF_SEQ_KEY = 'payment_page_ref_seq';

const _str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const _origin = () => process.env.PUBLIC_APP_URL
  || (process.env.NODE_ENV === 'production' ? 'https://fablabsahsa.com' : 'http://localhost:3000');
const receiptUrl = (sub) => `${_origin()}/api/pay/receipt/${sub.receiptToken}`;

const _newSlug = () => {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...crypto.randomBytes(10)].map(b => abc[b % abc.length]).join('');
};

async function _paymentSettings() {
  const [bank, mada] = await Promise.all([
    Settings.findByPk('workshop_bank_account'),
    Settings.findByPk('workshop_mada_info')
  ]);
  return { bank: bank?.value || null, mada: mada?.value || null };
}

const _taken = (pageId, transaction) => PaymentSubmission.count({
  where: { pageId, status: { [Op.in]: TAKES_A_PLACE } }, transaction
});

// Why the page is not taking payments right now, or null.
const closedReason = (page, taken) => {
  if (!page.isOpen) return 'closed';
  if (page.closesAt && Date.now() >= new Date(page.closesAt).getTime()) return 'expired';
  if (page.maxPayers && taken >= page.maxPayers) return 'full';
  return null;
};
const CLOSED_MESSAGES = {
  closed: ['This payment page is closed', 'صفحة الدفع مغلقة حالياً'],
  expired: ['The payment deadline has passed', 'انتهى موعد الدفع'],
  full: ['All places have been taken', 'اكتمل العدد المسموح به']
};

// Cover: data URL or { fileName, fileType, fileData }.
const _parseCover = (input) => {
  if (!input) return null;
  let mime, data;
  if (typeof input === 'string') {
    const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(input);
    if (!m) return null;
    mime = m[1].toLowerCase(); data = m[2];
  } else {
    mime = IMAGE_TYPES[_str(input.fileType || String(input.fileName || '').split('.').pop(), 8).toLowerCase()];
    data = input.fileData ? String(input.fileData).replace(/^data:[^;]+;base64,/, '') : '';
  }
  if (!mime || !['image/png', 'image/jpeg', 'image/webp'].includes(mime) || !data) return null;
  if (data.length > MAX_COVER_BYTES * 1.37) return null;
  return { mime, data };
};

const _parseProof = (input) => {
  if (!input || typeof input !== 'object') return null;
  const name = _str(input.fileName, 200);
  const type = _str(input.fileType || name.split('.').pop(), 8).toLowerCase().replace(/^\./, '');
  const data = input.fileData ? String(input.fileData).replace(/^data:[^;]+;base64,/, '') : '';
  if (!name || !data || !PROOF_TYPES[type]) return null;
  if (data.length > MAX_PROOF_BYTES * 1.37) return null;
  return { name, type, data };
};

// Admin form → model fields. `partial` keeps what isn't sent.
function _pageFields(b, { partial = false } = {}) {
  const out = {};
  const errors = [];
  const has = (k) => !partial || b[k] !== undefined;
  if (has('title')) {
    out.title = _str(b.title, 200);
    if (!out.title) errors.push('العنوان مطلوب');
  }
  if (has('description')) out.description = _str(b.description, 4000) || null;
  if (has('maxPayers')) {
    if (b.maxPayers === '' || b.maxPayers == null) out.maxPayers = null;
    else {
      const n = parseInt(b.maxPayers, 10);
      if (!Number.isInteger(n) || n < 1 || n > 100000) errors.push('عدد الأشخاص يجب أن يكون 1 أو أكثر');
      else out.maxPayers = n;
    }
  }
  if (has('closesAt')) {
    if (!b.closesAt) out.closesAt = null;
    else {
      const d = new Date(b.closesAt);
      if (Number.isNaN(d.getTime())) errors.push('موعد الإغلاق غير صحيح');
      else out.closesAt = d;
    }
  }
  if (has('methods')) {
    const m = Array.isArray(b.methods) ? [...new Set(b.methods.filter(x => METHODS.includes(x)))] : [];
    if (!m.length) errors.push('اختر طريقة دفع واحدة على الأقل');
    else out.methods = m;
  }
  if (has('terms')) out.terms = _str(b.terms, 4000) || null;
  if (has('isOpen')) out.isOpen = b.isOpen !== false;
  return { out, errors };
}

const _round2 = (n) => Math.round(n * 100) / 100;
const PRICING_KEYS = ['baseAmount', 'amount', 'discountPercent', 'discountAppliedBy', 'discountApprovedBy'];

// Main cost + % discount → what the customer pays (`amount`). A discount
// needs who applied it and who approved it. `current` fills in what an
// edit leaves out.
function _pricing(b, current = null) {
  const errors = [];
  const pick = (k, fallback) => (b[k] !== undefined ? b[k] : fallback);
  const baseRaw = b.baseAmount !== undefined ? b.baseAmount
    : b.amount !== undefined ? b.amount
      : current ? (current.baseAmount ?? current.amount) : undefined;
  const base = _round2(Number(baseRaw));
  if (!Number.isFinite(base) || base <= 0 || base > 1000000) errors.push('أدخل التكلفة الأساسية (أكبر من صفر)');
  const pctRaw = pick('discountPercent', current ? current.discountPercent : 0);
  const pct = pctRaw === '' || pctRaw == null ? 0 : _round2(Number(pctRaw));
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) errors.push('نسبة الخصم يجب أن تكون بين 0 و 99.99');
  const appliedBy = _str(pick('discountAppliedBy', current?.discountAppliedBy), 150) || null;
  const approvedBy = _str(pick('discountApprovedBy', current?.discountApprovedBy), 150) || null;
  if (pct > 0 && !appliedBy) errors.push('اختر من طبّق الخصم');
  if (pct > 0 && !approvedBy) errors.push('اختر من اعتمد الخصم');
  const amount = _round2(base * (1 - (Number.isFinite(pct) ? pct : 0) / 100));
  if (!errors.length && amount <= 0) errors.push('المبلغ بعد الخصم يجب أن يكون أكبر من صفر');
  return {
    errors,
    out: { baseAmount: base, discountPercent: pct, discountAppliedBy: pct > 0 ? appliedBy : null, discountApprovedBy: pct > 0 ? approvedBy : null, amount }
  };
}

// Pricing as stored on a page or a payment (old rows: no discount).
const _priceOf = (row) => {
  const amount = Number(row.amount);
  const base = row.baseAmount != null ? Number(row.baseAmount) : amount;
  return { amount, baseAmount: base, discountPercent: Number(row.discountPercent || 0), discountValue: _round2(base - amount) };
};

const _pageJson = (page, stats = {}) => {
  const p = page.toJSON ? page.toJSON() : { ...page };
  delete p.coverImage;
  const taken = (stats.pending || 0) + (stats.verified || 0);
  return {
    ...p,
    ..._priceOf(p),
    hasCover: !!p.coverMime,
    url: `${_origin()}/pay/${p.slug}`,
    stats: {
      pending: stats.pending || 0,
      verified: stats.verified || 0,
      rejected: stats.rejected || 0,
      collected: Number(stats.collected || 0),
      taken,
      seatsLeft: p.maxPayers ? Math.max(0, p.maxPayers - taken) : null
    },
    closedReason: closedReason(p, taken)
  };
};

async function _statsFor(pageIds) {
  if (!pageIds.length) return new Map();
  const rows = await PaymentSubmission.findAll({
    where: { pageId: { [Op.in]: pageIds } },
    attributes: ['pageId', 'status', [sequelize.fn('COUNT', sequelize.col('submissionId')), 'n'], [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
    group: ['pageId', 'status'],
    raw: true
  });
  const map = new Map();
  rows.forEach(r => {
    const s = map.get(r.pageId) || {};
    s[r.status] = Number(r.n) || 0;
    if (r.status === 'verified') s.collected = Number(r.total) || 0;
    map.set(r.pageId, s);
  });
  return map;
}

// ═════════════════════════ PUBLIC ═════════════════════════

// GET /api/pay/:slug
exports.getPublicPage = async (req, res) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) return res.status(404).json({ message: 'Not found' });
    const page = await PaymentPage.findOne({ where: { slug: req.params.slug } });
    if (!page) return res.status(404).json({ message: 'Payment page not found', messageAr: 'صفحة الدفع غير موجودة' });
    const taken = await _taken(page.pageId);
    const reason = closedReason(page, taken);
    const { bank, mada } = await _paymentSettings();
    const methods = (page.methods || []).filter(m => METHODS.includes(m));
    res.json({
      slug: page.slug,
      title: page.title,
      description: page.description,
      ...(({ amount, baseAmount, discountPercent, discountValue }) => ({ amount, baseAmount, discountPercent, discountValue }))(_priceOf(page)),
      maxPayers: page.maxPayers,
      seatsLeft: page.maxPayers ? Math.max(0, page.maxPayers - taken) : null,
      closesAt: page.closesAt,
      isOpen: !reason,
      closedReason: reason,
      methods,
      bank: methods.includes('bank_transfer') ? bank : null,
      mada: methods.includes('mada') ? mada : null,
      terms: page.terms,
      cover: page.coverMime ? `/pay/${page.slug}/cover?v=${new Date(page.updatedAt).getTime()}` : null
    });
  } catch (error) {
    console.error('getPublicPage:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// GET /api/pay/:slug/cover
exports.getPublicCover = async (req, res) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) return res.status(404).end();
    const page = await PaymentPage.unscoped().findOne({ where: { slug: req.params.slug }, attributes: ['coverImage', 'coverMime', 'updatedAt'] });
    if (!page?.coverImage) return res.status(404).end();
    return sendBinary(req, res, { data: page.coverImage, mime: page.coverMime, cacheSeconds: 604800, etag: `"pp-${new Date(page.updatedAt).getTime()}"` });
  } catch (error) {
    console.error('getPublicCover:', error);
    res.status(500).end();
  }
};

// POST /api/pay/:slug — { fullName, phone, email, method, proof?, note?, termsAccepted }
exports.submitPayment = async (req, res) => {
  try {
    if (!SLUG_RE.test(req.params.slug)) return res.status(404).json({ message: 'Not found' });
    if (rateLimited(req, `pay:${req.params.slug}`, 8, 10 * 60 * 1000)) {
      return res.status(429).json({ message: 'Too many attempts — try again in a few minutes', messageAr: 'محاولات كثيرة — حاول مجدداً بعد دقائق' });
    }
    const b = req.body || {};
    const fullName = _str(b.fullName, 150);
    const phone = _str(b.phone, 30).replace(/[^\d+]/g, '');
    const email = _str(b.email, 150).toLowerCase();
    const method = _str(b.method, 20);
    const note = _str(b.note, 1000) || null;
    if (fullName.length < 3 || phone.replace(/\D/g, '').length < 9 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter your full name, phone and a valid email', messageAr: 'يرجى إدخال الاسم الكامل والجوال وبريد إلكتروني صحيح' });
    }

    const result = await sequelize.transaction(async (t) => {
      // One reference sequence for every page.
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:k))', { replacements: { k: 'payment-page-ref' }, transaction: t });
      const page = await PaymentPage.findOne({ where: { slug: req.params.slug }, transaction: t, lock: t.LOCK.UPDATE });
      if (!page) throw { status: 404, message: 'Payment page not found', messageAr: 'صفحة الدفع غير موجودة' };
      const reason = closedReason(page, await _taken(page.pageId, t));
      if (reason) {
        const [message, messageAr] = CLOSED_MESSAGES[reason];
        throw { status: 403, code: 'CLOSED', closedReason: reason, message, messageAr };
      }
      if (!(page.methods || []).includes(method)) {
        throw { status: 400, message: 'Choose a payment method', messageAr: 'اختر طريقة الدفع' };
      }
      let proof = null;
      if (method === 'bank_transfer') {
        proof = _parseProof(b.proof);
        if (!proof) throw { status: 400, code: 'PROOF_REQUIRED', message: 'Upload the transfer receipt (image or PDF, up to 10 MB)', messageAr: 'ارفع إيصال التحويل (صورة أو PDF حتى 10 ميجابايت)' };
      }
      if (page.terms && b.termsAccepted !== true) {
        throw { status: 400, message: 'Please accept the terms', messageAr: 'يرجى الموافقة على الشروط' };
      }
      const dup = await PaymentSubmission.findOne({
        where: { pageId: page.pageId, status: { [Op.in]: TAKES_A_PLACE }, [Op.or]: [{ phone }, { email }] },
        transaction: t
      });
      if (dup) {
        throw { status: 409, code: 'DUPLICATE', reference: dup.reference, message: `You already have a payment on this page (${dup.reference})`, messageAr: `لديك طلب دفع مسجل مسبقاً في هذه الصفحة (${dup.reference})` };
      }
      // References never repeat, even after a request is deleted: a
      // counter in settings, never below the highest one in the table.
      const [rows] = await sequelize.query(
        `SELECT reference FROM payment_submissions WHERE reference ~ '^PAY-[0-9]+$' ORDER BY LENGTH(reference) DESC, reference DESC LIMIT 1`,
        { transaction: t }
      );
      const seq = await Settings.findByPk(REF_SEQ_KEY, { transaction: t });
      const next = Math.max(Number(seq?.value) || 0, parseInt(String(rows?.[0]?.reference || 'PAY-0000').slice(4), 10) || 0) + 1;
      await Settings.upsert({ key: REF_SEQ_KEY, value: next }, { transaction: t });
      const sub = await PaymentSubmission.create({
        pageId: page.pageId,
        reference: `PAY-${String(next).padStart(4, '0')}`,
        fullName, phone, email, note, method,
        amount: page.amount,
        baseAmount: page.baseAmount != null ? page.baseAmount : page.amount,
        discountPercent: page.discountPercent || 0,
        discountAppliedBy: Number(page.discountPercent) > 0 ? page.discountAppliedBy : null,
        discountApprovedBy: Number(page.discountPercent) > 0 ? page.discountApprovedBy : null,
        proofFile: proof ? proof.data : null,
        proofType: proof ? proof.type : null,
        proofName: proof ? proof.name : null
      }, { transaction: t });
      return { page, sub };
    });

    const { page, sub } = result;
    _paymentSettings()
      .then(({ bank, mada }) => sendPaymentReceived(page, sub, { bank, mada, receiptUrl: receiptUrl(sub) }))
      .catch(() => {});
    res.status(201).json({
      reference: sub.reference,
      status: sub.status,
      method: sub.method,
      ..._priceOf(sub),
      receiptUrl: `/api/pay/receipt/${sub.receiptToken}`
    });
  } catch (error) {
    if (error && error.status) {
      const { status, ...body } = error;
      return res.status(status).json(body);
    }
    console.error('submitPayment:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// GET /api/pay/receipt/:token — the customer's receipt, an invoice once verified.
exports.getReceipt = async (req, res) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.token)) return res.status(404).send('Not found');
    const sub = await PaymentSubmission.findOne({ where: { receiptToken: req.params.token }, include: [{ model: PaymentPage, as: 'page' }] });
    if (!sub || !sub.page) return res.status(404).send('Not found');
    res.setHeader('Cache-Control', 'private, no-store');
    res.type('html').send(buildReceiptHtml(sub.page, sub, { autoPrint: req.query.print === '1' }));
  } catch (error) {
    console.error('getReceipt:', error);
    res.status(500).send('Server error');
  }
};

// ═════════════════════════ ADMIN ═════════════════════════

// GET /api/payment-pages
exports.listPages = async (req, res) => {
  try {
    const pages = await PaymentPage.findAll({ order: [['createdAt', 'DESC']] });
    const stats = await _statsFor(pages.map(p => p.pageId));
    res.json(pages.map(p => _pageJson(p, stats.get(p.pageId))));
  } catch (error) {
    console.error('listPages:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// POST /api/payment-pages
exports.createPage = async (req, res) => {
  try {
    const { out, errors } = _pageFields(req.body || {});
    const price = _pricing(req.body || {});
    errors.push(...price.errors);
    if (errors.length) return res.status(400).json({ message: errors.join(' · '), messageAr: errors.join(' · ') });
    Object.assign(out, price.out);
    if (req.body?.cover) {
      const cover = _parseCover(req.body.cover);
      if (!cover) return res.status(400).json({ messageAr: 'صورة الغلاف يجب أن تكون PNG أو JPG أو WEBP بحجم لا يتجاوز 4 ميجابايت', message: 'Cover must be PNG, JPG or WEBP up to 4 MB' });
      out.coverImage = cover.data; out.coverMime = cover.mime;
    }
    let slug;
    for (let i = 0; i < 5 && !slug; i++) {
      const s = _newSlug();
      if (!(await PaymentPage.count({ where: { slug: s } }))) slug = s;
    }
    const page = await PaymentPage.create({ ...out, slug, createdBy: req.admin?.fullName || req.admin?.username || null });
    res.status(201).json(_pageJson(page));
  } catch (error) {
    console.error('createPage:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// PUT /api/payment-pages/:id
exports.updatePage = async (req, res) => {
  try {
    const page = await PaymentPage.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Not found', messageAr: 'الصفحة غير موجودة' });
    const { out, errors } = _pageFields(req.body || {}, { partial: true });
    if (PRICING_KEYS.some(k => req.body?.[k] !== undefined)) {
      const price = _pricing(req.body, page);
      errors.push(...price.errors);
      Object.assign(out, price.out);
    }
    if (errors.length) return res.status(400).json({ message: errors.join(' · '), messageAr: errors.join(' · ') });
    if (req.body?.removeCover) { out.coverImage = null; out.coverMime = null; }
    if (req.body?.cover) {
      const cover = _parseCover(req.body.cover);
      if (!cover) return res.status(400).json({ messageAr: 'صورة الغلاف يجب أن تكون PNG أو JPG أو WEBP بحجم لا يتجاوز 4 ميجابايت', message: 'Cover must be PNG, JPG or WEBP up to 4 MB' });
      out.coverImage = cover.data; out.coverMime = cover.mime;
    }
    await page.update(out);
    const stats = await _statsFor([page.pageId]);
    res.json(_pageJson(page, stats.get(page.pageId)));
  } catch (error) {
    console.error('updatePage:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// PATCH /api/payment-pages/:id/open — { isOpen }
exports.setOpen = async (req, res) => {
  try {
    const page = await PaymentPage.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Not found', messageAr: 'الصفحة غير موجودة' });
    await page.update({ isOpen: req.body?.isOpen === true });
    const stats = await _statsFor([page.pageId]);
    res.json(_pageJson(page, stats.get(page.pageId)));
  } catch (error) {
    console.error('setOpen:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// DELETE /api/payment-pages/:id — not once a payment was verified (close it instead).
exports.deletePage = async (req, res) => {
  try {
    const page = await PaymentPage.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Not found', messageAr: 'الصفحة غير موجودة' });
    const verified = await PaymentSubmission.count({ where: { pageId: page.pageId, status: 'verified' } });
    if (verified) {
      return res.status(409).json({ message: 'This page has verified payments — close it instead', messageAr: 'لا يمكن حذف صفحة عليها مدفوعات مؤكدة — يمكنك إغلاقها بدلاً من ذلك' });
    }
    await PaymentSubmission.destroy({ where: { pageId: page.pageId } });
    await page.destroy();
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (error) {
    console.error('deletePage:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// GET /api/payment-pages/:id/submissions
exports.listSubmissions = async (req, res) => {
  try {
    const page = await PaymentPage.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Not found', messageAr: 'الصفحة غير موجودة' });
    const subs = await PaymentSubmission.findAll({ where: { pageId: page.pageId }, order: [['createdAt', 'DESC']] });
    const stats = await _statsFor([page.pageId]);
    res.json({
      page: _pageJson(page, stats.get(page.pageId)),
      submissions: subs.map(s => ({ ...s.toJSON(), ..._priceOf(s), hasProof: !!s.proofType, receiptUrl: receiptUrl(s) }))
    });
  } catch (error) {
    console.error('listSubmissions:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// PATCH /api/payment-pages/submissions/:id — { status: verified|rejected|pending, note }
exports.reviewSubmission = async (req, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status', messageAr: 'حالة غير صالحة' });
    }
    const note = _str(req.body?.note, 1000) || null;
    if (status === 'rejected' && !note) {
      return res.status(400).json({ message: 'Write the reason for rejection', messageAr: 'اكتب سبب الرفض — سيصل للعميل' });
    }
    const sub = await PaymentSubmission.findByPk(req.params.id, { include: [{ model: PaymentPage, as: 'page' }] });
    if (!sub) return res.status(404).json({ message: 'Not found', messageAr: 'الطلب غير موجود' });
    const previous = sub.status;
    await sub.update({
      status,
      reviewNote: note,
      reviewedBy: req.admin?.fullName || req.admin?.username || 'Admin',
      reviewedAt: new Date(),
      paidAt: status === 'verified' ? (sub.paidAt || new Date()) : null
    });

    // Customer emails go out after the response (the invoice PDF takes a moment).
    if (previous !== status && sub.page) {
      const url = receiptUrl(sub);
      if (status === 'verified') {
        setImmediate(async () => {
          let pdf = null;
          try {
            const { generatePdfFromHtml } = require('../utils/pdfGenerator');
            pdf = await generatePdfFromHtml(buildReceiptHtml(sub.page, sub, { forPdf: true }), { landscape: false, format: 'A4' });
          } catch (e) {
            console.error('Payment invoice PDF for email failed (sending the link only):', e.message);
          }
          sendPaymentVerified(sub.page, sub, { receiptUrl: url, pdf });
        });
      } else if (status === 'rejected') {
        sendPaymentRejected(sub.page, sub, { receiptUrl: url });
      }
    }
    res.json({ ...sub.toJSON(), page: undefined, ..._priceOf(sub), hasProof: !!sub.proofType, receiptUrl: receiptUrl(sub) });
  } catch (error) {
    console.error('reviewSubmission:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

// GET /api/payment-pages/submissions/:id/proof (?token= for a new tab)
exports.downloadProof = async (req, res) => {
  try {
    const sub = await PaymentSubmission.unscoped().findByPk(req.params.id, { attributes: ['proofFile', 'proofType', 'proofName'] });
    if (!sub?.proofFile) return res.status(404).send('No receipt uploaded');
    return sendBinary(req, res, { data: sub.proofFile, mime: PROOF_TYPES[sub.proofType], fileName: sub.proofName || `receipt.${sub.proofType}` });
  } catch (error) {
    console.error('downloadProof:', error);
    res.status(500).send('Server error');
  }
};

// GET /api/payment-pages/submissions/:id/invoice-pdf
exports.downloadInvoicePdf = async (req, res) => {
  try {
    const sub = await PaymentSubmission.findByPk(req.params.id, { include: [{ model: PaymentPage, as: 'page' }] });
    if (!sub || !sub.page) return res.status(404).json({ message: 'Not found', messageAr: 'الطلب غير موجود' });
    const { generatePdfFromHtml } = require('../utils/pdfGenerator');
    const pdf = await generatePdfFromHtml(buildReceiptHtml(sub.page, sub, { forPdf: true }), { landscape: false, format: 'A4' });
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${sub.reference}.pdf"`,
      'Content-Length': pdf.length
    });
    res.end(pdf);
  } catch (error) {
    console.error('payment invoice PDF:', error);
    res.status(500).json({ message: 'Error generating invoice', messageAr: 'خطأ في إنشاء الفاتورة', detail: String(error?.message || error).slice(0, 200) });
  }
};

// DELETE /api/payment-pages/submissions/:id — not a verified one (its invoice was issued).
exports.deleteSubmission = async (req, res) => {
  try {
    const sub = await PaymentSubmission.findByPk(req.params.id, { attributes: ['submissionId', 'status'] });
    if (!sub) return res.status(404).json({ message: 'Not found', messageAr: 'الطلب غير موجود' });
    if (sub.status === 'verified') {
      return res.status(409).json({ message: 'A verified payment cannot be deleted — move it back to pending first', messageAr: 'لا يمكن حذف دفعة مؤكدة صدرت لها فاتورة — أعدها إلى «بانتظار التحقق» أولاً' });
    }
    await sub.destroy();
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (error) {
    console.error('deleteSubmission:', error);
    res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' });
  }
};

exports._closedReason = closedReason;
