// Shared helpers for the public website (/api/site) and its admin
// (/api/site-admin): editable site content kept in Settings, file and
// image handling, and a small per-IP rate limiter for public forms.
const SITE_CONTENT_KEY = 'site_content';

const P = (file) => `/site/partners/${file}`;
const DEFAULT_SITE_CONTENT = {
  stats: { beneficiaries: 999, projects: 150, workshops: 999 },
  partners: [
    { id: 'kfu', name: 'جامعة الملك فيصل', nameEn: 'King Faisal University', logoUrl: P('kfu.jpg') },
    { id: 'chamber', name: 'غرفة الأحساء', nameEn: 'Al-Ahsa Chamber', logoUrl: P('ALahsa.jpg') },
    { id: 'moe', name: 'وزارة التعليم', nameEn: 'Ministry of Education', logoUrl: P('moe.png') },
    { id: 'saip', name: 'الهيئة السعودية للملكية الفكرية', nameEn: 'Saudi Authority for Intellectual Property', logoUrl: P('safip.avif') },
    { id: 'mawhiba', name: 'مؤسسة الملك عبدالعزيز ورجاله للموهبة والإبداع', nameEn: 'Mawhiba', logoUrl: P('kaahcffgac.png') },
    { id: 'safcsp', name: 'الاتحاد السعودي للأمن السيبراني والبرمجة والدرونز', nameEn: 'SAFCSP', logoUrl: P('sffcpd.png') },
    { id: 'tuwaiq', name: 'أكاديمية طويق', nameEn: 'Tuwaiq Academy', logoUrl: P('ta.jpg') },
    { id: 'tvtc', name: 'المؤسسة العامة للتدريب التقني والمهني', nameEn: 'TVTC', logoUrl: P('tavtc.jpg') },
    { id: 'dow', name: 'Dow', nameEn: 'Dow', logoUrl: P('dow.webp') }
  ],
  contact: {
    email: 'info@fablabahsa.org',
    phone: '013-58-40004',
    whatsapp: '',
    addressAr: 'الأحساء - حي الحزام الذهبي - شارع عين نجم',
    addressEn: 'Al-Ahsa - Golden Belt District - Ain Najm Street',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3603.8507641559995!2d49.56045308498625!3d25.409805583797752!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e37972ec8390af5%3A0x4a3f469489c0fcd9!2z2YHYp9ioINmE2KfYqCDYp9mE2KPYrdiz2KfYoQ!5e0!3m2!1sar!2ssa!4v1759741737132!5m2!1sar!2ssa'
  },
  social: {
    x: 'https://x.com/fablabahsa',
    instagram: 'https://instagram.com/fablabahsa',
    youtube: 'https://youtube.com/@fablabahsa',
    snapchat: 'https://snapchat.com/add/fablabahsa'
  },
  workingHoursAr: 'الأحد - الخميس: 9:00 ص - 6:00 م',
  workingHoursEn: 'Sunday - Thursday: 9:00 AM - 6:00 PM',
  internshipUniversities: [
    { id: 'kfu', name: 'جامعة الملك فيصل', nameEn: 'King Faisal University', logoUrl: null },
    { id: 'tech', name: 'الكلية التقنية بالأحساء', nameEn: 'Al-Ahsa Technical College', logoUrl: null },
    { id: 'community', name: 'كلية المجتمع بالأحساء', nameEn: 'Al-Ahsa Community College', logoUrl: null },
    { id: 'iau', name: 'جامعة الإمام عبدالرحمن بن فيصل', nameEn: 'Imam Abdulrahman Bin Faisal University', logoUrl: null }
  ]
};

const _str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
const _num = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? Math.min(n, 10000000) : d; };

// Logos: keep a site path or http(s) URL, or turn an uploaded image into
// a data: URL (≤ 600 KB).
const LOGO_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', gif: 'image/gif' };
const _logo = (entry) => {
  const up = entry && entry.logo;
  if (up && up.fileData) {
    const type = _str(up.fileType || String(up.fileName || '').split('.').pop(), 8).toLowerCase();
    const data = String(up.fileData).replace(/^data:[^;]+;base64,/, '');
    if (!LOGO_TYPES[type] || type === 'svg' || data.length > 600 * 1024 * 1.37) return { error: true };
    return { url: `data:${LOGO_TYPES[type]};base64,${data}` };
  }
  const url = _str(entry && entry.logoUrl, 2000000);
  if (!url) return { url: null };
  if (url.startsWith('/site/') || /^https?:\/\//.test(url) || /^data:image\/(png|jpeg|webp|avif|gif);base64,/.test(url)) return { url };
  return { url: null };
};

// Validate + normalise an admin PUT of the site content.
const normaliseSiteContent = (input, current = DEFAULT_SITE_CONTENT) => {
  const b = input || {};
  const out = { ...current };
  if (b.stats) {
    out.stats = {
      beneficiaries: _num(b.stats.beneficiaries, current.stats.beneficiaries),
      projects: _num(b.stats.projects, current.stats.projects),
      workshops: _num(b.stats.workshops, current.stats.workshops)
    };
  }
  for (const key of ['partners', 'internshipUniversities']) {
    if (!Array.isArray(b[key])) continue;
    const list = [];
    for (let i = 0; i < Math.min(b[key].length, 40); i++) {
      const e = b[key][i] || {};
      const name = _str(e.name, 200);
      if (!name) continue;
      const logo = _logo(e);
      if (logo.error) return { error: { message: `Logo for "${name}" must be PNG/JPG/WEBP/AVIF up to 600 KB`, messageAr: `شعار «${name}» يجب أن يكون PNG أو JPG أو WEBP بحجم لا يتجاوز 600 كيلوبايت` } };
      list.push({ id: _str(e.id, 60) || `p${Date.now().toString(36)}${i}`, name, nameEn: _str(e.nameEn, 200), logoUrl: logo.url });
    }
    out[key] = list;
  }
  if (b.contact) {
    const c = b.contact;
    const map = _str(c.mapEmbedUrl, 2000);
    out.contact = {
      email: _str(c.email, 200), phone: _str(c.phone, 40), whatsapp: _str(c.whatsapp, 40),
      addressAr: _str(c.addressAr, 300), addressEn: _str(c.addressEn, 300),
      mapEmbedUrl: /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(map) ? map : ''
    };
  }
  if (b.social) {
    const s = {};
    for (const k of ['x', 'instagram', 'youtube', 'snapchat', 'linkedin', 'tiktok']) {
      const v = _str(b.social[k], 300);
      if (v && /^https?:\/\//.test(v)) s[k] = v;
    }
    out.social = s;
  }
  if (b.workingHoursAr !== undefined) out.workingHoursAr = _str(b.workingHoursAr, 200);
  if (b.workingHoursEn !== undefined) out.workingHoursEn = _str(b.workingHoursEn, 200);
  return { content: out };
};

const loadSiteContent = async (Settings) => {
  const row = await Settings.findByPk(SITE_CONTENT_KEY);
  const v = row && row.value && typeof row.value === 'object' ? row.value : {};
  return { ...DEFAULT_SITE_CONTENT, ...v };
};

// ---------- files / images ----------
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// { fileName, fileType, fileData } or a data: URL → { data, mime } | null
const parseImage = (input) => {
  if (!input) return null;
  let data, mime;
  if (typeof input === 'string') {
    const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(input);
    if (!m) return null;
    mime = m[1].toLowerCase(); data = m[2];
  } else {
    const type = _str(input.fileType || String(input.fileName || '').split('.').pop(), 8).toLowerCase();
    mime = IMAGE_TYPES[type];
    data = input.fileData ? String(input.fileData).replace(/^data:[^;]+;base64,/, '') : '';
  }
  if (!mime || !Object.values(IMAGE_TYPES).includes(mime) || !data) return null;
  if (data.length > MAX_IMAGE_BYTES * 1.37) return null;
  return { data, mime };
};

const DOC_TYPES = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp'
};
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const parseFile = (input, allowed) => {
  if (!input || typeof input !== 'object') return null;
  const name = _str(input.fileName, 200);
  const type = _str(input.fileType || name.split('.').pop(), 8).toLowerCase().replace(/^\./, '');
  const data = input.fileData ? String(input.fileData).replace(/^data:[^;]+;base64,/, '') : '';
  if (!name || !data || !allowed.includes(type)) return null;
  if (data.length > MAX_DOC_BYTES * 1.37) return null;
  return { fileName: name, fileType: type, fileSize: Math.round(data.length * 0.75), fileData: data };
};

// Send a stored base64 image/file with caching headers.
const sendBinary = (req, res, { data, mime, fileName, inline = true, cacheSeconds = 0, etag }) => {
  if (etag) {
    res.setHeader('ETag', etag);
    if (req.headers && req.headers['if-none-match'] === etag) return res.status(304).end();
  }
  res.setHeader('Content-Type', mime || 'application/octet-stream');
  res.setHeader('Cache-Control', cacheSeconds ? `public, max-age=${cacheSeconds}` : 'private, no-store');
  if (fileName) res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  return res.send(Buffer.from(String(data), 'base64'));
};

// ---------- rate limiting for public forms ----------
const _hits = new Map();
const rateLimited = (req, bucket, limit, windowMs) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const list = (_hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= limit) return true;
  list.push(now);
  _hits.set(key, list);
  if (_hits.size > 10000) for (const [k, v] of _hits) if (!v.some(t => now - t < windowMs)) _hits.delete(k);
  return false;
};

module.exports = {
  SITE_CONTENT_KEY, DEFAULT_SITE_CONTENT, normaliseSiteContent, loadSiteContent,
  IMAGE_TYPES, DOC_TYPES, parseImage, parseFile, sendBinary, rateLimited
};
