// «نموذج اعتماد طلب تصميم إعلان ( لقسم ، ورشة ، برامج )» as HTML — shared
// by the execution plan's document (the form embedded in a plan target)
// and the media design request's own document. Mirrors
// client/src/components/Requests/media/mediaForm.js.
const fs = require('fs');
const path = require('path');

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== '');
const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const multiline = (v) => esc(v).replace(/\n/g, '<br>');
const dash = (v) => (has(v) ? multiline(v) : '<span class="nil">—</span>');
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(String(d).length <= 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(x);
};
const fmtDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(x);
};
const humanSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const parseDay = (d) => { const x = new Date(`${String(d).slice(0, 10)}T12:00:00`); return Number.isNaN(x.getTime()) ? null : x; };
const weekdayOf = (d) => { const x = has(d) ? parseDay(d) : null; return x ? WEEKDAYS[x.getDay()] : ''; };

const MEDIA_MIN_IMAGES = 3;
// The reviewers named on the paper form.
const MEDIA_SIGNERS = [
  { role: 'تم تأكيد المحتوى العلمي من: مدير البرامج والمشاريع', name: 'م. نوف بوعبيد' },
  { role: 'الإعلام', name: 'أ. دانة الدوسري' },
  { role: 'مشاريع المؤسسة', name: 'أ. لولوة عادل' }
];
const MEDIA_EXEC = { role: 'المسؤول التنفيذي', name: 'أ. زكي اللويم' };

// A stored form with its lists made safe.
const normalizeMediaForm = (raw) => {
  const f = obj(raw);
  return { ...f, axes: arr(f.axes).map(obj), images: arr(f.images).filter(im => im && im.fileId) };
};

// What the form still misses (labels) — the same checks as the client.
const mediaMissing = (raw) => {
  const f = normalizeMediaForm(raw);
  const miss = [];
  const need = (ok, label) => { if (!ok) miss.push(label); };
  need(has(f.activity), 'اسم النشاط');
  need(has(f.implementer), 'اسم المنفذ');
  need(has(f.ageMin) && has(f.ageMax), 'العمر المستهدف');
  if (num(f.ageMin) != null && num(f.ageMax) != null && num(f.ageMin) > num(f.ageMax)) need(false, 'العمر: الحد الأدنى أكبر من الأعلى');
  need(has(f.timeFrom) && has(f.timeTo), 'الفترة الزمنية');
  need(has(f.dayPart), 'صباحًا أو مساءً');
  need(has(f.dateFrom) && has(f.dateTo), 'تاريخ النشاط');
  if (has(f.dateFrom) && has(f.dateTo) && f.dateTo < f.dateFrom) need(false, 'تاريخ النهاية قبل البداية');
  need(num(f.beneficiaries) > 0, 'عدد المستفيدين');
  need(has(f.days), 'عدد الأيام الفعلية');
  need(has(f.gender), 'الفئة المستهدفة');
  need(f.axes.some(a => has(a.title)), 'المحاور');
  need(f.images.length >= MEDIA_MIN_IMAGES, `${MEDIA_MIN_IMAGES} صور على الأقل`);
  need(has(f.dueDate), 'تاريخ انتهاء التصميم');
  need(has(f.urgency), 'مستعجل أو غير مستعجل');
  need(has(f.cost), 'تكلفة البرنامج');
  return miss;
};

const _logoCache = {};
const logo = (name) => {
  if (_logoCache[name] === undefined) {
    try {
      _logoCache[name] = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'public', name)).toString('base64')}`;
    } catch {
      _logoCache[name] = null;
    }
  }
  return _logoCache[name];
};

const kvRow = (label, value) => `<tr><th>${label}</th><td>${value}</td></tr>`;
const imgGrid = (list, images) => (list.length
  ? `<div class="imgs">${list.map(im => `<figure>${images[im.fileId] ? `<img src="${images[im.fileId]}" alt="">` : '<div class="noimg">الصورة غير متاحة</div>'}${has(im.caption) ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`
  : '<p class="nil">لم تُرفق صور.</p>');
const datePair = (a, b) => (has(a) || has(b)
  ? `من يوم: <b>${esc(weekdayOf(a) || '—')}</b> تاريخ: <b>${has(a) ? esc(fmtDate(a)) : '—'}</b> &nbsp; إلى يوم: <b>${esc(weekdayOf(b) || '—')}</b> تاريخ: <b>${has(b) ? esc(fmtDate(b)) : '—'}</b>`
  : dash(''));

// The form's fields, axes and images (f with arrays — normalizeMediaForm).
const mediaBody = (f, images) => `
  <table class="kv">
    ${kvRow('اسم النشاط', dash(f.activity))}
    ${kvRow('اسم المنفذ', dash(f.implementer))}
    ${kvRow('العمر المستهدف من النشاط', has(f.ageMin) || has(f.ageMax) ? `${esc(f.ageMin || '—')} إلى ${esc(f.ageMax || '—')} سنة` : dash(''))}
    ${kvRow('الفترة الزمنية', has(f.timeFrom) || has(f.timeTo) ? `من ${esc(f.timeFrom || '—')} إلى ${esc(f.timeTo || '—')} &nbsp; ${['صباحًا', 'مساءً'].map(x => `${f.dayPart === x ? '☑' : '☐'} ${x}`).join(' &nbsp; ')}` : dash(''))}
    ${kvRow('التاريخ', datePair(f.dateFrom, f.dateTo))}
    ${kvRow('عدد المستفيدين', has(f.beneficiaries) ? `${esc(f.beneficiaries)}${has(f.seatsNote) ? ` <small>(${esc(f.seatsNote)})</small>` : ''}` : dash(''))}
    ${kvRow('عدد الأيام الفعلية', dash(f.days))}
    ${kvRow('الفئة المستهدفة', ['أولاد', 'بنات', 'مختلط'].map(x => `${f.gender === x ? '☑' : '☐'} ${x}`).join(' &nbsp; '))}
    ${kvRow('تكلفة البرنامج', dash(f.cost))}
    ${kvRow('تاريخ انتهاء التصميم', `${has(f.dueDate) ? esc(fmtDate(f.dueDate)) : '—'} &nbsp; ${['مستعجل', 'غير مستعجل'].map(x => `${f.urgency === x ? '☑' : '☐'} ${x}`).join(' &nbsp; ')}`)}
    ${has(f.notes) ? kvRow('ملاحظات للتصميم', multiline(f.notes)) : ''}
  </table>
  <h4>المحاور</h4>
  ${f.axes.filter(a => has(obj(a).title) || has(obj(a).desc)).length
    ? `<ol class="axes">${f.axes.filter(a => has(obj(a).title) || has(obj(a).desc)).map(a => `<li><b>${esc(a.title || '')}</b>${has(a.desc) ? `<div>${multiline(a.desc)}</div>` : ''}</li>`).join('')}</ol>`
    : '<p class="nil">—</p>'}
  <h4>صور الإعلان <small>(${f.images.length} من ${MEDIA_MIN_IMAGES} على الأقل)</small></h4>
  ${imgGrid(f.images, images)}`;

module.exports = {
  esc, has, num, obj, arr, multiline, dash, fmtDate, fmtDateTime, humanSize, weekdayOf, logo, kvRow, imgGrid,
  MEDIA_MIN_IMAGES, MEDIA_SIGNERS, MEDIA_EXEC, normalizeMediaForm, mediaMissing, mediaBody
};
