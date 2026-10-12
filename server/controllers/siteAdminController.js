// Admin API for the public website (/api/site-admin): content, media
// center, workshops archive, stories, talent + co-op applications,
// contact messages and the one-off import from the old site.
const { Op } = require('sequelize');
const {
  Settings, SiteMedia, SiteWorkshopArchive, SiteStory, TalentApplication,
  InternshipOpportunity, InternshipApplication, SiteContactMessage
} = require('../models');
const {
  SITE_CONTENT_KEY, loadSiteContent, normaliseSiteContent, parseImage, sendBinary, DOC_TYPES
} = require('../utils/siteContent');
const { importOldSite } = require('../utils/siteImport');

const _s = (v, max = 500) => (v == null ? null : String(v).trim().slice(0, max) || null);
const _bad = (res, message, messageAr, status = 400) => res.status(status).json({ message, messageAr });
const _err = (res, where, e) => { console.error(`site-admin ${where}:`, e); res.status(500).json({ message: 'Server error', messageAr: 'خطأ في الخادم' }); };
const _int = (v, d, max) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : d; };
const _date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const _bool = (v, d) => (v === undefined ? d : !!v);
const STATUSES = ['new', 'reviewing', 'accepted', 'rejected'];

// Apply an image upload / removal from the request body to `values`.
const _applyImage = (b, values) => {
  if (b.removeImage) { values.image = null; values.imageMime = null; return true; }
  if (b.image) {
    const img = parseImage(b.image);
    if (!img) return false;
    values.image = img.data; values.imageMime = img.mime;
  }
  return true;
};
const _imgUrl = (base, id, row) => (row.imageMime ? `/api/site/${base}/${id}/image?v=${new Date(row.updatedAt).getTime() || 0}` : null);

// ---------- summary + import ----------
exports.summary = async (req, res) => {
  try {
    const [talentNew, internshipNew, messagesUnread, storiesPending, media, archive] = await Promise.all([
      TalentApplication.count({ where: { status: 'new' } }),
      InternshipApplication.count({ where: { status: 'new' } }),
      SiteContactMessage.count({ where: { isRead: false } }),
      SiteStory.count({ where: { status: 'pending' } }),
      SiteMedia.count(),
      SiteWorkshopArchive.count()
    ]);
    res.json({ talentNew, internshipNew, messagesUnread, storiesPending, mediaCount: media, archiveCount: archive });
  } catch (e) { _err(res, 'summary', e); }
};

// The import downloads ~80 MB from the old site and takes minutes —
// longer than the proxy timeout — so it runs in the background:
// POST starts it (202), GET reports progress / the result.
const _importJob = { running: false, startedAt: null, finishedAt: null, progress: null, result: null, error: null };
exports.importStatus = (req, res) => res.json(_importJob);
exports.importOldSite = async (req, res) => {
  if (_importJob.running) return _bad(res, 'An import is already running', 'الاستيراد قيد التنفيذ بالفعل', 409);
  Object.assign(_importJob, { running: true, startedAt: new Date(), finishedAt: null, progress: { stage: 'starting', done: 0, total: 0 }, result: null, error: null });
  importOldSite({ onProgress: (p) => { _importJob.progress = p; } })
    .then((result) => { _importJob.result = result; })
    .catch((e) => {
      console.error('site import:', e);
      _importJob.error = { message: `Could not import from the old site: ${e.message}`, messageAr: 'تعذّر الاستيراد من الموقع القديم — تأكد أنه ما زال يعمل ثم أعد المحاولة' };
    })
    .finally(() => { _importJob.running = false; _importJob.finishedAt = new Date(); });
  res.status(202).json({ ..._importJob, message: 'Import started', messageAr: 'بدأ الاستيراد — قد يستغرق عدة دقائق' });
};

// ---------- content ----------
exports.getContent = async (req, res) => {
  try { res.json(await loadSiteContent(Settings)); } catch (e) { _err(res, 'getContent', e); }
};
exports.updateContent = async (req, res) => {
  try {
    const current = await loadSiteContent(Settings);
    const { content, error } = normaliseSiteContent(req.body, current);
    if (error) return res.status(400).json(error);
    await Settings.upsert({ key: SITE_CONTENT_KEY, value: content });
    res.json(content);
  } catch (e) { _err(res, 'updateContent', e); }
};

// ---------- media ----------
const KINDS = ['news', 'coverage', 'report'];
const MEDIA_TYPES = ['image', 'video', 'text'];
const _mediaOut = (m) => ({
  id: m.mediaId, kind: m.kind, mediaType: m.mediaType, title: m.title, titleEn: m.titleEn,
  description: m.description, descriptionEn: m.descriptionEn, videoUrl: m.videoUrl, link: m.link,
  date: m.date, duration: m.duration, views: m.views, category: m.category, isPublished: m.isPublished,
  imageUrl: _imgUrl('media', m.mediaId, m), legacyId: m.legacyId, createdAt: m.createdAt, updatedAt: m.updatedAt
});
const _mediaValues = (b, partial) => {
  const v = {};
  const set = (k, val) => { if (!partial || b[k] !== undefined) v[k] = val; };
  set('kind', KINDS.includes(b.kind) ? b.kind : 'news');
  set('mediaType', MEDIA_TYPES.includes(b.mediaType) ? b.mediaType : 'image');
  set('title', _s(b.title, 2000));
  set('titleEn', _s(b.titleEn, 2000));
  set('description', _s(b.description, 20000));
  set('descriptionEn', _s(b.descriptionEn, 20000));
  set('videoUrl', _s(b.videoUrl, 2000));
  set('link', _s(b.link, 2000));
  set('date', _date(b.date));
  set('duration', _s(b.duration, 255));
  set('views', b.views === '' || b.views == null ? null : _int(b.views, null, 100000000));
  set('category', _s(b.category, 255));
  set('isPublished', _bool(b.isPublished, true));
  return v;
};
exports.listMedia = async (req, res) => {
  try {
    const where = {};
    if (KINDS.includes(req.query.kind)) where.kind = req.query.kind;
    const q = _s(req.query.q, 100);
    if (q) where[Op.or] = [{ title: { [Op.iLike]: `%${q}%` } }, { description: { [Op.iLike]: `%${q}%` } }];
    const { rows, count } = await SiteMedia.findAndCountAll({
      where, limit: _int(req.query.limit, 30, 200), offset: _int(req.query.offset, 0, 100000),
      order: [['date', 'DESC NULLS LAST'], ['createdAt', 'DESC']]
    });
    res.json({ items: rows.map(_mediaOut), total: count });
  } catch (e) { _err(res, 'listMedia', e); }
};
exports.createMedia = async (req, res) => {
  try {
    const b = req.body || {};
    const values = _mediaValues(b, false);
    if (!values.title) return _bad(res, 'Title is required', 'العنوان مطلوب');
    if (!_applyImage(b, values)) return _bad(res, 'Image must be PNG/JPG/WEBP up to 8 MB', 'الصورة يجب أن تكون PNG أو JPG أو WEBP حتى 8 ميجابايت');
    const row = await SiteMedia.create(values);
    res.status(201).json(_mediaOut(row));
  } catch (e) { _err(res, 'createMedia', e); }
};
exports.updateMedia = async (req, res) => {
  try {
    const row = await SiteMedia.findByPk(req.params.id);
    if (!row) return _bad(res, 'Not found', 'غير موجود', 404);
    const b = req.body || {};
    const values = _mediaValues(b, true);
    if ('title' in values && !values.title) return _bad(res, 'Title is required', 'العنوان مطلوب');
    if (!_applyImage(b, values)) return _bad(res, 'Image must be PNG/JPG/WEBP up to 8 MB', 'الصورة يجب أن تكون PNG أو JPG أو WEBP حتى 8 ميجابايت');
    await row.update(values);
    res.json(_mediaOut(row));
  } catch (e) { _err(res, 'updateMedia', e); }
};
exports.deleteMedia = async (req, res) => {
  try {
    const n = await SiteMedia.destroy({ where: { mediaId: req.params.id } });
    if (!n) return _bad(res, 'Not found', 'غير موجود', 404);
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (e) { _err(res, 'deleteMedia', e); }
};

// ---------- workshops archive ----------
const _archOut = (w) => ({
  id: w.archiveId, title: w.title, titleEn: w.titleEn, description: w.description, descriptionEn: w.descriptionEn,
  duration: w.duration, link: w.link, startDate: w.startDate, endDate: w.endDate, isPublished: w.isPublished,
  imageUrl: _imgUrl('workshops-archive', w.archiveId, w), legacyId: w.legacyId, updatedAt: w.updatedAt
});
const _archValues = (b, partial) => {
  const v = {};
  const set = (k, val) => { if (!partial || b[k] !== undefined) v[k] = val; };
  set('title', _s(b.title, 2000));
  set('titleEn', _s(b.titleEn, 2000));
  set('description', _s(b.description, 20000));
  set('descriptionEn', _s(b.descriptionEn, 20000));
  set('duration', _s(b.duration, 255));
  set('link', _s(b.link, 2000));
  set('startDate', _date(b.startDate));
  set('endDate', _date(b.endDate));
  set('isPublished', _bool(b.isPublished, true));
  return v;
};
exports.listArchive = async (req, res) => {
  try {
    const where = {};
    const q = _s(req.query.q, 100);
    if (q) where.title = { [Op.iLike]: `%${q}%` };
    const { rows, count } = await SiteWorkshopArchive.findAndCountAll({
      where, limit: _int(req.query.limit, 30, 200), offset: _int(req.query.offset, 0, 100000),
      order: [['startDate', 'DESC NULLS LAST'], ['createdAt', 'DESC']]
    });
    res.json({ items: rows.map(_archOut), total: count });
  } catch (e) { _err(res, 'listArchive', e); }
};
exports.createArchive = async (req, res) => {
  try {
    const b = req.body || {};
    const values = _archValues(b, false);
    if (!values.title) return _bad(res, 'Title is required', 'العنوان مطلوب');
    if (!_applyImage(b, values)) return _bad(res, 'Image must be PNG/JPG/WEBP up to 8 MB', 'الصورة يجب أن تكون PNG أو JPG أو WEBP حتى 8 ميجابايت');
    const row = await SiteWorkshopArchive.create(values);
    res.status(201).json(_archOut(row));
  } catch (e) { _err(res, 'createArchive', e); }
};
exports.updateArchive = async (req, res) => {
  try {
    const row = await SiteWorkshopArchive.findByPk(req.params.id);
    if (!row) return _bad(res, 'Not found', 'غير موجود', 404);
    const b = req.body || {};
    const values = _archValues(b, true);
    if ('title' in values && !values.title) return _bad(res, 'Title is required', 'العنوان مطلوب');
    if (!_applyImage(b, values)) return _bad(res, 'Image must be PNG/JPG/WEBP up to 8 MB', 'الصورة يجب أن تكون PNG أو JPG أو WEBP حتى 8 ميجابايت');
    await row.update(values);
    res.json(_archOut(row));
  } catch (e) { _err(res, 'updateArchive', e); }
};
exports.deleteArchive = async (req, res) => {
  try {
    const n = await SiteWorkshopArchive.destroy({ where: { archiveId: req.params.id } });
    if (!n) return _bad(res, 'Not found', 'غير موجود', 404);
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (e) { _err(res, 'deleteArchive', e); }
};

// ---------- stories ----------
const _storyOut = (s) => ({
  id: s.storyId, name: s.name, email: s.email, phone: s.phone, title: s.title, titleEn: s.titleEn,
  story: s.story, storyEn: s.storyEn, status: s.status, imageUrl: _imgUrl('stories', s.storyId, s),
  createdAt: s.createdAt, updatedAt: s.updatedAt
});
exports.listStories = async (req, res) => {
  try {
    const where = {};
    if (['pending', 'approved', 'rejected'].includes(req.query.status)) where.status = req.query.status;
    const rows = await SiteStory.findAll({ where, order: [['createdAt', 'DESC']], limit: 500 });
    res.json({ items: rows.map(_storyOut) });
  } catch (e) { _err(res, 'listStories', e); }
};
exports.updateStory = async (req, res) => {
  try {
    const row = await SiteStory.findByPk(req.params.id);
    if (!row) return _bad(res, 'Not found', 'غير موجود', 404);
    const b = req.body || {};
    const v = {};
    for (const [k, max] of [['name', 150], ['email', 150], ['phone', 30], ['title', 300], ['titleEn', 300], ['story', 8000], ['storyEn', 8000]]) {
      if (b[k] !== undefined) v[k] = _s(b[k], max);
    }
    if ((v.name === null) || (v.title === null) || (v.story === null)) return _bad(res, 'Name, title and story are required', 'الاسم والعنوان والقصة مطلوبة');
    if (b.status !== undefined) {
      if (!['pending', 'approved', 'rejected'].includes(b.status)) return _bad(res, 'Invalid status', 'حالة غير صحيحة');
      v.status = b.status;
    }
    if (!_applyImage(b, v)) return _bad(res, 'Image must be PNG/JPG/WEBP up to 8 MB', 'الصورة يجب أن تكون PNG أو JPG أو WEBP حتى 8 ميجابايت');
    await row.update(v);
    res.json(_storyOut(row));
  } catch (e) { _err(res, 'updateStory', e); }
};
exports.deleteStory = async (req, res) => {
  try {
    const n = await SiteStory.destroy({ where: { storyId: req.params.id } });
    if (!n) return _bad(res, 'Not found', 'غير موجود', 404);
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (e) { _err(res, 'deleteStory', e); }
};

// ---------- talent applications ----------
const _talentOut = (t) => ({
  id: t.applicationId, fullName: t.fullName, age: t.age, educationLevel: t.educationLevel, nationality: t.nationality,
  countryCode: t.countryCode, phone: t.phone, email: t.email, talentDescription: t.talentDescription,
  achievements: t.achievements, files: t.fileList || [], status: t.status, adminNote: t.adminNote,
  createdAt: t.createdAt, updatedAt: t.updatedAt
});
exports.listTalent = async (req, res) => {
  try {
    const where = {};
    if (STATUSES.includes(req.query.status)) where.status = req.query.status;
    const rows = await TalentApplication.findAll({ where, order: [['createdAt', 'DESC']], limit: 1000 });
    res.json({ items: rows.map(_talentOut) });
  } catch (e) { _err(res, 'listTalent', e); }
};
exports.updateTalent = async (req, res) => {
  try {
    const row = await TalentApplication.findByPk(req.params.id);
    if (!row) return _bad(res, 'Not found', 'غير موجود', 404);
    const b = req.body || {};
    const v = {};
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return _bad(res, 'Invalid status', 'حالة غير صحيحة');
      v.status = b.status;
    }
    if (b.adminNote !== undefined) v.adminNote = _s(b.adminNote, 5000);
    await row.update(v);
    res.json(_talentOut(row));
  } catch (e) { _err(res, 'updateTalent', e); }
};
exports.deleteTalent = async (req, res) => {
  try {
    const n = await TalentApplication.destroy({ where: { applicationId: req.params.id } });
    if (!n) return _bad(res, 'Not found', 'غير موجود', 404);
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (e) { _err(res, 'deleteTalent', e); }
};
exports.talentFile = async (req, res) => {
  try {
    const row = await TalentApplication.unscoped().findByPk(req.params.id, { attributes: ['applicationId', 'files'] });
    const f = row && Array.isArray(row.files) ? row.files[parseInt(req.params.index, 10)] : null;
    if (!f || !f.fileData) return res.status(404).send('No file');
    const inline = ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(f.fileType);
    return sendBinary(req, res, { data: f.fileData, mime: DOC_TYPES[f.fileType], fileName: f.fileName, inline });
  } catch (e) { console.error('talentFile:', e); res.status(500).send('Server error'); }
};

// ---------- internship openings ----------
const _oppOut = (o) => ({
  id: o.opportunityId, title: o.title, titleEn: o.titleEn, department: o.department, departmentEn: o.departmentEn,
  description: o.description, descriptionEn: o.descriptionEn, requirements: o.requirements, requirementsEn: o.requirementsEn,
  duration: o.duration, durationEn: o.durationEn, seats: o.seats, deadline: o.deadline,
  isOpen: o.isOpen, isPublished: o.isPublished, sortOrder: o.sortOrder, createdAt: o.createdAt
});
const _oppValues = (b, partial) => {
  const v = {};
  const set = (k, val) => { if (!partial || b[k] !== undefined) v[k] = val; };
  for (const [k, max] of [['title', 250], ['titleEn', 250], ['department', 250], ['departmentEn', 250], ['description', 8000], ['descriptionEn', 8000], ['requirements', 8000], ['requirementsEn', 8000], ['duration', 80], ['durationEn', 80]]) set(k, _s(b[k], max));
  set('seats', b.seats === '' || b.seats == null ? null : _int(b.seats, null, 10000));
  set('deadline', _date(b.deadline));
  set('isOpen', _bool(b.isOpen, true));
  set('isPublished', _bool(b.isPublished, true));
  set('sortOrder', _int(b.sortOrder, 0, 100000));
  return v;
};
exports.listOpportunities = async (req, res) => {
  try {
    const rows = await InternshipOpportunity.findAll({ order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']] });
    const counts = await InternshipApplication.findAll({
      attributes: ['opportunityId', [InternshipApplication.sequelize.fn('COUNT', InternshipApplication.sequelize.col('applicationId')), 'n']],
      group: ['opportunityId'], raw: true
    });
    const byId = new Map(counts.map(c => [c.opportunityId, Number(c.n) || 0]));
    res.json({ items: rows.map(o => ({ ..._oppOut(o), applications: byId.get(o.opportunityId) || 0 })) });
  } catch (e) { _err(res, 'listOpportunities', e); }
};
exports.createOpportunity = async (req, res) => {
  try {
    const values = _oppValues(req.body || {}, false);
    if (!values.title) return _bad(res, 'Title is required', 'العنوان مطلوب');
    const row = await InternshipOpportunity.create(values);
    res.status(201).json(_oppOut(row));
  } catch (e) { _err(res, 'createOpportunity', e); }
};
exports.updateOpportunity = async (req, res) => {
  try {
    const row = await InternshipOpportunity.findByPk(req.params.id);
    if (!row) return _bad(res, 'Not found', 'غير موجود', 404);
    const values = _oppValues(req.body || {}, true);
    if ('title' in values && !values.title) return _bad(res, 'Title is required', 'العنوان مطلوب');
    await row.update(values);
    res.json(_oppOut(row));
  } catch (e) { _err(res, 'updateOpportunity', e); }
};
exports.deleteOpportunity = async (req, res) => {
  try {
    const apps = await InternshipApplication.count({ where: { opportunityId: req.params.id } });
    if (apps) return _bad(res, 'This opening has applications — close or unpublish it instead', 'لهذه الفرصة طلبات مقدّمة — أغلقها أو أخفِها بدلاً من الحذف', 409);
    const n = await InternshipOpportunity.destroy({ where: { opportunityId: req.params.id } });
    if (!n) return _bad(res, 'Not found', 'غير موجود', 404);
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (e) { _err(res, 'deleteOpportunity', e); }
};

// ---------- internship applications ----------
const _appOut = (a, oppTitles) => ({
  id: a.applicationId, opportunityId: a.opportunityId, opportunityTitle: oppTitles ? oppTitles.get(a.opportunityId) || null : undefined,
  fullName: a.fullName, email: a.email, phone: a.phone, university: a.university, major: a.major,
  gpa: a.gpa != null ? Number(a.gpa) : null, motivation: a.motivation, experience: a.experience,
  cvFileName: a.cvFileName, letterFileName: a.letterFileName, status: a.status, adminNote: a.adminNote,
  createdAt: a.createdAt, updatedAt: a.updatedAt
});
exports.listApplications = async (req, res) => {
  try {
    const where = {};
    if (/^[0-9a-f-]{36}$/i.test(String(req.query.opportunityId || ''))) where.opportunityId = req.query.opportunityId;
    if (STATUSES.includes(req.query.status)) where.status = req.query.status;
    const rows = await InternshipApplication.findAll({ where, order: [['createdAt', 'DESC']], limit: 1000 });
    const opps = await InternshipOpportunity.findAll({ attributes: ['opportunityId', 'title'] });
    const titles = new Map(opps.map(o => [o.opportunityId, o.title]));
    res.json({ items: rows.map(a => _appOut(a, titles)) });
  } catch (e) { _err(res, 'listApplications', e); }
};
exports.updateApplication = async (req, res) => {
  try {
    const row = await InternshipApplication.findByPk(req.params.id);
    if (!row) return _bad(res, 'Not found', 'غير موجود', 404);
    const b = req.body || {};
    const v = {};
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return _bad(res, 'Invalid status', 'حالة غير صحيحة');
      v.status = b.status;
    }
    if (b.adminNote !== undefined) v.adminNote = _s(b.adminNote, 5000);
    await row.update(v);
    res.json(_appOut(row));
  } catch (e) { _err(res, 'updateApplication', e); }
};
exports.deleteApplication = async (req, res) => {
  try {
    const n = await InternshipApplication.destroy({ where: { applicationId: req.params.id } });
    if (!n) return _bad(res, 'Not found', 'غير موجود', 404);
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (e) { _err(res, 'deleteApplication', e); }
};
exports.applicationFile = async (req, res) => {
  try {
    const col = req.params.which === 'cv' ? 'cvFile' : req.params.which === 'letter' ? 'letterFile' : null;
    if (!col) return res.status(404).send('No file');
    const row = await InternshipApplication.unscoped().findByPk(req.params.id, { attributes: ['applicationId', col] });
    const f = row && row[col];
    if (!f || !f.fileData) return res.status(404).send('No file');
    return sendBinary(req, res, { data: f.fileData, mime: DOC_TYPES[f.fileType], fileName: f.fileName, inline: f.fileType === 'pdf' });
  } catch (e) { console.error('applicationFile:', e); res.status(500).send('Server error'); }
};

// ---------- contact messages ----------
exports.listMessages = async (req, res) => {
  try {
    const rows = await SiteContactMessage.findAll({ order: [['createdAt', 'DESC']], limit: 1000 });
    res.json({ items: rows.map(m => ({ id: m.messageId, name: m.name, email: m.email, message: m.message, isRead: m.isRead, createdAt: m.createdAt })) });
  } catch (e) { _err(res, 'listMessages', e); }
};
exports.updateMessage = async (req, res) => {
  try {
    const row = await SiteContactMessage.findByPk(req.params.id);
    if (!row) return _bad(res, 'Not found', 'غير موجود', 404);
    await row.update({ isRead: !!(req.body && req.body.isRead) });
    res.json({ id: row.messageId, isRead: row.isRead });
  } catch (e) { _err(res, 'updateMessage', e); }
};
exports.deleteMessage = async (req, res) => {
  try {
    const n = await SiteContactMessage.destroy({ where: { messageId: req.params.id } });
    if (!n) return _bad(res, 'Not found', 'غير موجود', 404);
    res.json({ message: 'Deleted', messageAr: 'تم الحذف' });
  } catch (e) { _err(res, 'deleteMessage', e); }
};
