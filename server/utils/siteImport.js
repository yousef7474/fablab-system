// One-off import of the old public website (main.fablabsahsa.com) into
// our tables: media center items, past workshops and success stories.
// Idempotent — rows are matched by the old site's id (legacyId), so it
// can be run again to pick up anything added there in the meantime.
const https = require('https');
const { SiteMedia, SiteWorkshopArchive, SiteStory } = require('../models');

const OLD_SITE = 'https://main.fablabsahsa.com';

const getJson = (url, timeoutMs = 180000) => new Promise((resolve, reject) => {
  const req = https.get(url, { headers: { Accept: 'application/json', 'User-Agent': 'FabLab-Importer' } }, (res) => {
    if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${url} → HTTP ${res.statusCode}`)); }
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new Error(`${url} → invalid JSON`)); }
    });
  });
  req.setTimeout(timeoutMs, () => req.destroy(new Error(`${url} → timed out`)));
  req.on('error', reject);
});

const _dataUri = (v) => {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/is.exec(String(v || ''));
  return m ? { mime: m[1].toLowerCase(), data: m[2] } : null;
};
const _date = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : null);
const _kind = (t) => {
  const s = String(t || '').trim().toLowerCase();
  if (s === 'news') return 'news';
  if (s === 'media' || s === 'coverage') return 'coverage';
  if (s === 'report' || s === 'reports' || s === 'تقارير' || s === 'تقرير') return 'report';
  return 'news';
};
const _mediaType = (t) => (['image', 'video', 'text'].includes(String(t)) ? String(t) : 'image');
// Old free-text fields can be longer than our columns.
const _cut = (v, max) => (v == null || v === '' ? null : String(v).slice(0, max));

async function _upsert(Model, legacyId, values) {
  const existing = await Model.unscoped().findOne({ where: { legacyId }, attributes: [Model.primaryKeyAttribute, 'legacyId'] });
  if (existing) { await existing.update(values); return 'updated'; }
  await Model.create({ legacyId, ...values });
  return 'created';
}

async function importOldSite({ base = OLD_SITE, log = () => {}, onProgress = () => {} } = {}) {
  const result = {
    media: { created: 0, updated: 0, failed: 0 },
    workshops: { created: 0, updated: 0, failed: 0 },
    stories: { created: 0, updated: 0, failed: 0 }
  };

  log('media…');
  onProgress({ stage: 'downloading-media', done: 0, total: 0 });
  const media = await getJson(`${base}/api/media/get/`);
  const mediaList = (media && media.data) || [];
  for (const [i, m] of mediaList.entries()) {
    onProgress({ stage: 'media', done: i, total: mediaList.length });
    try {
      const img = _dataUri(m.image) || _dataUri(m.thumbnail);
      const outcome = await _upsert(SiteMedia, Number(m.id), {
        kind: _kind(m.type),
        mediaType: _mediaType(m.media_type),
        title: String(m.title || '').trim() || '—',
        titleEn: m.title_en || null,
        description: m.description || null,
        descriptionEn: m.description_en || null,
        image: img ? img.data : null,
        imageMime: img ? img.mime : null,
        videoUrl: m.video_url || null,
        link: m.link || (/^https?:/.test(m.image || '') ? m.image : null),
        date: _date(m.date) || _date(m.created_at),
        duration: _cut(m.duration, 255),
        views: Number.isFinite(Number(m.views)) ? Number(m.views) : null,
        category: _cut(m.category, 255),
        isPublished: true
      });
      result.media[outcome]++;
    } catch (e) {
      result.media.failed++;
      console.error('import media', m && m.id, e.message);
    }
  }

  log('workshops…');
  onProgress({ stage: 'downloading-workshops', done: 0, total: 0 });
  const ws = await getJson(`${base}/api/workshops/`);
  const wsList = (ws && ws.data) || [];
  for (const [i, w] of wsList.entries()) {
    onProgress({ stage: 'workshops', done: i, total: wsList.length });
    try {
      const img = _dataUri(w.image);
      const outcome = await _upsert(SiteWorkshopArchive, Number(w.id), {
        title: String(w.name || '').trim() || '—',
        titleEn: w.name_en || null,
        description: w.description || null,
        descriptionEn: w.description_en || null,
        duration: _cut(w.duration, 255),
        image: img ? img.data : null,
        imageMime: img ? img.mime : null,
        link: w.link || null,
        startDate: _date(w.start_date),
        endDate: _date(w.end_date),
        isPublished: true
      });
      result.workshops[outcome]++;
    } catch (e) {
      result.workshops.failed++;
      console.error('import workshop', w && w.id, e.message);
    }
  }

  log('stories…');
  onProgress({ stage: 'stories', done: 0, total: 0 });
  const st = await getJson(`${base}/api/success-stories/`);
  for (const s of (st && st.data) || []) {
    try {
      const img = _dataUri(s.image || s.photo);
      const outcome = await _upsert(SiteStory, Number(s.id), {
        name: String(s.name || s.full_name || s.author || '—').trim(),
        email: s.email || null,
        phone: s.phone || null,
        title: String(s.title || s.name || '—').trim(),
        titleEn: s.title_en || null,
        story: String(s.story || s.content || s.description || '').trim() || '—',
        storyEn: s.story_en || s.content_en || s.description_en || null,
        image: img ? img.data : null,
        imageMime: img ? img.mime : null,
        status: 'approved'
      });
      result.stories[outcome]++;
    } catch (e) {
      result.stories.failed++;
      console.error('import story', s && s.id, e.message);
    }
  }
  return result;
}

module.exports = { importOldSite, OLD_SITE };
