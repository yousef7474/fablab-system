// Public website API (/api/site): content, media center, workshops
// archive, success stories, "أنا موهوب", co-op training, contact form.
// Never answers 401 — the client's axios interceptor treats 401 as an
// expired admin session.
const { Op } = require('sequelize');
const sgMail = require('@sendgrid/mail');
const {
  Settings, SiteMedia, SiteWorkshopArchive, SiteStory, TalentApplication,
  InternshipOpportunity, InternshipApplication, SiteContactMessage
} = require('../models');
const { loadSiteContent, parseImage, parseFile, sendBinary, rateLimited } = require('../utils/siteContent');
if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const SITE_INBOX = 'fablabspec@fablabsahsa.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const _s = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
const _bad = (res, message, messageAr, status = 400, extra = {}) => res.status(status).json({ message, messageAr, ...extra });
const _tooMany = (res) => _bad(res, 'Too many submissions — please try again later', 'محاولات كثيرة — يرجى المحاولة لاحقاً', 429);
const _esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _int = (v, d, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : d; };

// Fire-and-forget email (never blocks or fails the request).
const _mail = (to, subject, rows, intro) => {
  if (!to || !process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
<div style="background:linear-gradient(135deg,#6a1b9a,#9C27B0);color:#fff;padding:20px;text-align:center"><b style="font-size:18px">فاب لاب الأحساء</b></div>
<div style="padding:20px 22px;color:#334155;font-size:14px;line-height:1.8">${intro}
${rows && rows.length ? `<table style="width:100%;font-size:13px;border-collapse:collapse;background:#f8fafc;border-radius:8px;margin-top:12px">${rows.map(([k, v]) => `<tr><td style="padding:7px 12px;color:#64748b;width:150px;vertical-align:top">${_esc(k)}</td><td style="padding:7px 12px;white-space:pre-wrap">${_esc(v)}</td></tr>`).join('')}</table>` : ''}
</div><div style="background:#f8fafc;padding:10px;text-align:center;font-size:11px;color:#94a3b8">فاب لاب الأحساء — مبادرة مؤسسة عبدالمنعم الراشد الإنسانية</div></div>`;
  sgMail.send({
    to, subject, html,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa' }
  }).catch(e => console.error('site email failed:', e?.response?.body || e.message));
};

const _imgUrl = (base, row) => (row.imageMime ? `/api/site/${base}/${row.id}/image?v=${new Date(row.updatedAt).getTime() || 0}` : null);

// ---------- content ----------
exports.getContent = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(await loadSiteContent(Settings));
  } catch (e) {
    console.error('site getContent:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};

// ---------- media center ----------
const _mediaOut = (m) => ({
  id: m.mediaId, kind: m.kind, mediaType: m.mediaType,
  title: m.title, titleEn: m.titleEn, description: m.description, descriptionEn: m.descriptionEn,
  imageUrl: _imgUrl('media', { id: m.mediaId, imageMime: m.imageMime, updatedAt: m.updatedAt }),
  videoUrl: m.videoUrl, link: m.link, date: m.date, duration: m.duration, views: m.views, category: m.category
});

exports.listMedia = async (req, res) => {
  try {
    const where = { isPublished: true };
    if (['news', 'coverage', 'report'].includes(req.query.kind)) where.kind = req.query.kind;
    const q = _s(req.query.q, 100);
    if (q) where[Op.or] = [{ title: { [Op.iLike]: `%${q}%` } }, { description: { [Op.iLike]: `%${q}%` } }];
    const limit = _int(req.query.limit, 12, 60);
    const offset = _int(req.query.offset, 0, 100000);
    const { rows, count } = await SiteMedia.findAndCountAll({
      where, limit, offset, order: [['date', 'DESC NULLS LAST'], ['createdAt', 'DESC']]
    });
    res.json({ items: rows.map(_mediaOut), total: count });
  } catch (e) {
    console.error('site listMedia:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};

const _imageHandler = (Model, pk) => async (req, res) => {
  try {
    const row = await Model.unscoped().findByPk(req.params.id, { attributes: [pk, 'image', 'imageMime', 'updatedAt'] });
    if (!row || !row.image || !row.imageMime) return res.status(404).send('No image');
    return sendBinary(req, res, {
      data: row.image, mime: row.imageMime, cacheSeconds: 7 * 24 * 3600,
      etag: `"${row[pk]}-${new Date(row.updatedAt).getTime()}"`
    });
  } catch (e) {
    console.error('site image:', e);
    res.status(500).send('Server error');
  }
};
exports.mediaImage = _imageHandler(SiteMedia, 'mediaId');
exports.archiveImage = _imageHandler(SiteWorkshopArchive, 'archiveId');
exports.storyImage = _imageHandler(SiteStory, 'storyId');

// ---------- workshops archive ----------
exports.listArchive = async (req, res) => {
  try {
    const limit = _int(req.query.limit, 24, 120);
    const offset = _int(req.query.offset, 0, 100000);
    const { rows, count } = await SiteWorkshopArchive.findAndCountAll({
      where: { isPublished: true }, limit, offset,
      order: [['startDate', 'DESC NULLS LAST'], ['createdAt', 'DESC']]
    });
    res.json({
      total: count,
      items: rows.map(w => ({
        id: w.archiveId, title: w.title, titleEn: w.titleEn, description: w.description, descriptionEn: w.descriptionEn,
        duration: w.duration, link: w.link, startDate: w.startDate, endDate: w.endDate,
        imageUrl: _imgUrl('workshops-archive', { id: w.archiveId, imageMime: w.imageMime, updatedAt: w.updatedAt })
      }))
    });
  } catch (e) {
    console.error('site listArchive:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};

// ---------- success stories ----------
exports.listStories = async (req, res) => {
  try {
    const rows = await SiteStory.findAll({ where: { status: 'approved' }, order: [['createdAt', 'DESC']], limit: 200 });
    res.json({
      items: rows.map(s => ({
        id: s.storyId, name: s.name, title: s.title, titleEn: s.titleEn, story: s.story, storyEn: s.storyEn,
        date: s.createdAt, imageUrl: _imgUrl('stories', { id: s.storyId, imageMime: s.imageMime, updatedAt: s.updatedAt })
      }))
    });
  } catch (e) {
    console.error('site listStories:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};

exports.submitStory = async (req, res) => {
  try {
    if (rateLimited(req, 'story', 5, 60 * 60 * 1000)) return _tooMany(res);
    const b = req.body || {};
    const name = _s(b.name, 150), email = _s(b.email, 150), title = _s(b.title, 300), story = _s(b.story, 8000);
    if (!name || !title || !story) return _bad(res, 'Name, title and story are required', 'الاسم والعنوان والقصة مطلوبة');
    if (!EMAIL_RE.test(email)) return _bad(res, 'Invalid email address', 'البريد الإلكتروني غير صحيح');
    let image = null;
    if (b.image) {
      image = parseImage(b.image);
      if (!image) return _bad(res, 'Image must be PNG/JPG/WEBP up to 8 MB', 'الصورة يجب أن تكون PNG أو JPG أو WEBP بحجم لا يتجاوز 8 ميجابايت');
    }
    await SiteStory.create({
      name, email, phone: _s(b.phone, 30) || null, title, story,
      image: image ? image.data : null, imageMime: image ? image.mime : null, status: 'pending'
    });
    _mail(email, 'استلمنا قصة نجاحك — فاب لاب الأحساء', [['العنوان', title]],
      `<p>مرحباً <b>${_esc(name)}</b>،</p><p>شكراً لمشاركتنا قصتك. سيراجعها فريق فاب لاب الأحساء وتُنشر في صفحة قصص النجاح بعد الاعتماد.</p>`);
    _mail(SITE_INBOX, `قصة نجاح جديدة بانتظار المراجعة — ${name}`, [['الاسم', name], ['البريد', email], ['العنوان', title]],
      '<p>وصلت قصة نجاح جديدة من الموقع الإلكتروني — راجعها من لوحة التحكم ← الموقع الإلكتروني ← قصص النجاح.</p>');
    res.status(201).json({ message: 'Thank you — your story will be published after review', messageAr: 'شكراً لك — ستُنشر قصتك بعد مراجعتها' });
  } catch (e) {
    console.error('site submitStory:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};

// ---------- أنا موهوب ----------
const TALENT_FILE_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'];
exports.submitTalent = async (req, res) => {
  try {
    if (rateLimited(req, 'talent', 5, 60 * 60 * 1000)) return _tooMany(res);
    const b = req.body || {};
    const fullName = _s(b.fullName, 150), educationLevel = _s(b.educationLevel, 120), nationality = _s(b.nationality, 80);
    const phone = _s(b.phone, 30), email = _s(b.email, 150);
    const talentDescription = _s(b.talentDescription, 8000), achievements = _s(b.achievements, 8000);
    const age = parseInt(b.age, 10);
    if (!fullName || !educationLevel || !nationality || !phone || !talentDescription || !achievements) {
      return _bad(res, 'Please fill in all required fields', 'يرجى تعبئة جميع الحقول المطلوبة');
    }
    if (!Number.isInteger(age) || age < 5 || age > 100) return _bad(res, 'Enter a valid age', 'أدخل عمراً صحيحاً');
    if (email && !EMAIL_RE.test(email)) return _bad(res, 'Invalid email address', 'البريد الإلكتروني غير صحيح');
    if (!b.termsAccepted) return _bad(res, 'Please accept the terms', 'يرجى الموافقة على الشروط');
    const raw = Array.isArray(b.files) ? b.files : [];
    if (raw.length > 10) return _bad(res, 'Up to 10 files', 'الحد الأقصى 10 ملفات');
    const files = [];
    for (const f of raw) {
      const parsed = parseFile(f, TALENT_FILE_TYPES);
      if (!parsed) return _bad(res, 'Files must be JPG, PNG, PDF, DOC or DOCX up to 10 MB each', 'الملفات يجب أن تكون JPG أو PNG أو PDF أو DOC أو DOCX بحجم لا يتجاوز 10 ميجابايت لكل ملف');
      files.push(parsed);
    }
    // Stay under the 50 MB JSON body limit once base64-encoded.
    if (files.reduce((n, f) => n + f.fileSize, 0) > 30 * 1024 * 1024) return _bad(res, 'Files total more than 30 MB', 'مجموع الملفات أكبر من 30 ميجابايت');
    const row = await TalentApplication.create({
      fullName, age, educationLevel, nationality, countryCode: _s(b.countryCode, 8) || null, phone,
      email: email || null, talentDescription, achievements,
      files, fileList: files.map(({ fileName, fileType, fileSize }) => ({ fileName, fileType, fileSize })),
      status: 'new', termsAcceptedAt: new Date()
    });
    _mail(email, 'تم استلام تسجيل موهبتك — فاب لاب الأحساء', [['الاسم', fullName], ['المرحلة الدراسية', educationLevel]],
      `<p>مرحباً <b>${_esc(fullName)}</b>،</p><p>شكراً لتسجيل موهبتك في فاب لاب الأحساء. استلمنا بياناتك وسيتواصل معك الفريق قريباً.</p>`);
    _mail(SITE_INBOX, `تسجيل موهبة جديد — ${fullName}`, [['الاسم', fullName], ['العمر', age], ['الجوال', `${b.countryCode || ''} ${phone}`], ['البريد', email || '—'], ['الملفات', files.length]],
      '<p>وصل تسجيل جديد من صفحة «أنا موهوب» — راجعه من لوحة التحكم ← الموقع الإلكتروني ← طلبات المواهب.</p>');
    res.status(201).json({ id: row.applicationId, message: 'Your talent registration was received', messageAr: 'تم استلام تسجيل موهبتك بنجاح' });
  } catch (e) {
    console.error('site submitTalent:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};

// ---------- co-op training ----------
const _oppOut = (o) => ({
  id: o.opportunityId, title: o.title, titleEn: o.titleEn, department: o.department, departmentEn: o.departmentEn,
  description: o.description, descriptionEn: o.descriptionEn, requirements: o.requirements, requirementsEn: o.requirementsEn,
  duration: o.duration, durationEn: o.durationEn, seats: o.seats, deadline: o.deadline, isOpen: o.isOpen
});
const _todayRiyadh = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
const _oppAccepting = (o) => o.isOpen && o.isPublished && (!o.deadline || String(o.deadline) >= _todayRiyadh());

exports.listInternships = async (req, res) => {
  try {
    const rows = await InternshipOpportunity.findAll({ where: { isPublished: true }, order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']] });
    res.json({ items: rows.map(o => ({ ..._oppOut(o), isOpen: _oppAccepting(o) })) });
  } catch (e) {
    console.error('site listInternships:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};

const APPLY_FILE_TYPES = ['pdf', 'doc', 'docx'];
exports.applyInternship = async (req, res) => {
  try {
    if (rateLimited(req, 'internship', 5, 60 * 60 * 1000)) return _tooMany(res);
    const opp = await InternshipOpportunity.findByPk(req.params.id);
    if (!opp || !opp.isPublished) return _bad(res, 'Opening not found', 'الفرصة غير موجودة', 404);
    if (!_oppAccepting(opp)) return _bad(res, 'Applications for this opening are closed', 'التقديم على هذه الفرصة مغلق', 403);
    const b = req.body || {};
    const fullName = _s(b.fullName, 150), email = _s(b.email, 150), phone = _s(b.phone, 30);
    const university = _s(b.university, 200), major = _s(b.major, 200), motivation = _s(b.motivation, 5000);
    if (!fullName || !email || !phone || !university || !major || !motivation) {
      return _bad(res, 'Please fill in all required fields', 'يرجى تعبئة جميع الحقول المطلوبة');
    }
    if (!EMAIL_RE.test(email)) return _bad(res, 'Invalid email address', 'البريد الإلكتروني غير صحيح');
    const gpa = b.gpa === '' || b.gpa == null ? null : Number(b.gpa);
    if (gpa !== null && (!Number.isFinite(gpa) || gpa < 0 || gpa > 5)) return _bad(res, 'GPA must be between 0 and 5', 'المعدل يجب أن يكون بين 0 و 5');
    const cv = parseFile(b.cv, APPLY_FILE_TYPES);
    const letter = parseFile(b.universityLetter, APPLY_FILE_TYPES);
    if (!cv || !letter) return _bad(res, 'Attach your CV and the university letter (PDF/DOC/DOCX, up to 10 MB)', 'أرفق السيرة الذاتية وخطاب الجامعة (PDF أو DOC أو DOCX حتى 10 ميجابايت)');
    const dup = await InternshipApplication.findOne({ where: { opportunityId: opp.opportunityId, email } });
    if (dup) return _bad(res, 'You already applied to this opening', 'سبق أن قدّمت على هذه الفرصة', 409);
    const row = await InternshipApplication.create({
      opportunityId: opp.opportunityId, fullName, email, phone, university, major, gpa,
      motivation, experience: _s(b.experience, 5000) || null,
      cvFile: cv, letterFile: letter, cvFileName: cv.fileName, letterFileName: letter.fileName, status: 'new'
    });
    _mail(email, `تم استلام طلبك للتدريب التعاوني — ${opp.title}`, [['البرنامج', opp.title], ['الجامعة', university], ['التخصص', major]],
      `<p>مرحباً <b>${_esc(fullName)}</b>،</p><p>استلمنا طلبك للتدريب التعاوني في فاب لاب الأحساء. سيراجع فريق القبول طلبك خلال 5-7 أيام عمل ويتواصل معك.</p>`);
    _mail(SITE_INBOX, `طلب تدريب تعاوني جديد — ${fullName}`, [['البرنامج', opp.title], ['الجامعة', university], ['التخصص', major], ['الجوال', phone], ['البريد', email]],
      '<p>وصل طلب جديد للتدريب التعاوني — راجعه من لوحة التحكم ← الموقع الإلكتروني ← التدريب التعاوني.</p>');
    res.status(201).json({ id: row.applicationId, message: 'Your application was received', messageAr: 'تم استلام طلبك بنجاح' });
  } catch (e) {
    console.error('site applyInternship:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};

// ---------- contact form ----------
exports.submitContact = async (req, res) => {
  try {
    if (rateLimited(req, 'contact', 5, 15 * 60 * 1000)) return _tooMany(res);
    const b = req.body || {};
    const name = _s(b.name, 150), email = _s(b.email, 150), message = _s(b.message, 5000);
    if (!name || !message) return _bad(res, 'Name and message are required', 'الاسم والرسالة مطلوبان');
    if (!EMAIL_RE.test(email)) return _bad(res, 'Invalid email address', 'البريد الإلكتروني غير صحيح');
    await SiteContactMessage.create({ name, email, message });
    _mail(SITE_INBOX, `رسالة جديدة من الموقع — ${name}`, [['الاسم', name], ['البريد', email], ['الرسالة', message]],
      '<p>وصلت رسالة جديدة من نموذج «أرسل لنا رسالة» في الموقع الإلكتروني.</p>');
    res.status(201).json({ message: 'Message sent — thank you', messageAr: 'تم إرسال رسالتك — شكراً لك' });
  } catch (e) {
    console.error('site submitContact:', e);
    _bad(res, 'Server error', 'خطأ في الخادم', 500);
  }
};
