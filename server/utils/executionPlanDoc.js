// Printable document of an execution plan version (نموذج الخطة التنفيذية —
// فاب لاب الأحساء): the plan header, a summary table of its targets, then
// each target in full — phases timeline and its attached / linked files.
// Used for the reviewers' view, printing and the "download everything"
// ZIP, so it embeds the logos. Landscape A4, like the Excel template.
const fs = require('fs');
const path = require('path');

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== '');
const multiline = (v) => esc(v).replace(/\n/g, '<br>');
const dash = (v) => (has(v) ? multiline(v) : '<span class="nil">—</span>');
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(String(d).length <= 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(x);
};
const shortDate = (d) => {
  if (!d) return '';
  const x = new Date(`${String(d).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short' }).format(x);
};
const humanSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const QUARTERS = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
const monthName = (m) => MONTHS[Number(m) - 1] || '';

// «الربع الأول 2027» / «يناير 2027» / '' when not chosen yet.
const periodLabel = (h = {}) => {
  const y = has(h.year) ? ` ${h.year}` : '';
  if (h.periodType === 'quarter' && QUARTERS[Number(h.quarter) - 1]) return `${QUARTERS[Number(h.quarter) - 1]}${y}`;
  if (h.periodType === 'month' && monthName(h.month)) return `${monthName(h.month)}${y}`;
  return '';
};

const fmtPlanNo = (n) => (n == null ? 'EP-—' : `EP-${String(n).padStart(3, '0')}`);

const STATUS_AR = {
  draft: 'مسودة',
  pm_review: 'لدى مسؤول إدارة المشاريع',
  manager_review: 'لدى المدير للاعتماد',
  returned: 'معادة للتعديل',
  approved: 'معتمدة'
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

// ─────────────── «ملفات المستهدف» — each file on its own path ───────────────
// Mirrors client/src/components/ExecutionPlans/planFiles.js: the content
// is a training kit, the financial file a financial request (both with
// their own review flow — their live status comes from `extra.live`), the
// media and volunteer files are forms filled inside the plan. Statuses are
// derived, never typed; 'لا يتطلب' is the only stored choice. Older plans'
// typed statuses with an uploaded file or link still count.
const NA = 'لا يتطلب';
const FILE_BLOCKS = [
  { key: 'content', label: 'المحتوى المعتمد', attached: 'مرفق ومعتمد', pending: 'بانتظار الاعتماد' },
  { key: 'finance', label: 'الملف المالي التفصيلي', attached: 'مرفق', pending: 'قيد الإعداد' },
  { key: 'media', label: 'المتطلبات الإعلامية', attached: 'مرفقة', pending: 'قيد الإعداد' },
  { key: 'volunteer', label: 'تصاميم الفرص التطوعية', attached: 'مرفق', pending: 'قيد الإعداد' }
];
const BLOCK_OF = Object.fromEntries(FILE_BLOCKS.map(b => [b.key, b]));
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MEDIA_MIN_IMAGES = 3;
const MEDIA_SIGNERS = [
  { role: 'تم تأكيد المحتوى العلمي من: مدير البرامج والمشاريع', name: 'م. نوف بوعبيد' },
  { role: 'الإعلام', name: 'أ. دانة الدوسري' },
  { role: 'مشاريع المؤسسة', name: 'أ. لولوة عادل' }
];
const fmtKitNo = (n) => (n == null ? 'TK-—' : `TK-${String(n).padStart(3, '0')}`);
const fmtFinanceNo = (n) => (n == null ? 'FR-—' : `FR-${String(n).padStart(3, '0')}`);
const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);
const LIVE_STATUS = {
  draft: 'مسودة', pm_review: 'لدى مسؤول إدارة المشاريع', manager_review: 'لدى المدير للاعتماد', returned: 'معادة للتعديل', approved: 'معتمدة'
};
const LIVE_STATUS_M = { ...LIVE_STATUS, returned: 'معاد للتعديل', approved: 'معتمد' };

const mediaForm = (t) => {
  const f = obj(obj(t.media).form);
  return { ...f, axes: arr(f.axes), images: arr(f.images).filter(im => im && im.fileId) };
};
const volunteerForm = (t) => {
  const f = obj(obj(t.volunteer).form);
  return { ...f, roles: arr(f.roles).map(r => ({ ...obj(r), weekdays: arr(obj(r).weekdays) })) };
};

const minutes = (hm) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hoursBetween = (a0, b0) => { const a = minutes(a0); const b = minutes(b0); return a == null || b == null || b <= a ? null : Math.round(((b - a) / 60) * 100) / 100; };
const parseDay = (d) => { const x = new Date(`${String(d).slice(0, 10)}T12:00:00`); return Number.isNaN(x.getTime()) ? null : x; };
const weekdayOf = (d) => { const x = has(d) ? parseDay(d) : null; return x ? WEEKDAYS[x.getDay()] : ''; };
const roleDays = (r) => {
  const a = has(r.dateFrom) ? parseDay(r.dateFrom) : null;
  const b = has(r.dateTo) ? parseDay(r.dateTo) : null;
  if (a && b) {
    if (b < a) return null;
    const pick = new Set(arr(r.weekdays).map(w => WEEKDAYS.indexOf(w)).filter(i => i >= 0));
    let n = 0;
    for (let d = new Date(a); d <= b && n < 400; d.setDate(d.getDate() + 1)) if (!pick.size || pick.has(d.getDay())) n++;
    return n;
  }
  const n = num(r.days);
  if (a && !b) return n && n > 0 ? n : 1;
  return n && n > 0 ? n : null;
};
const roleHours = (r) => {
  const h = hoursBetween(r.timeFrom, r.timeTo); const d = roleDays(r); const c = num(r.count) || 0;
  return { perDay: h, days: d, perVolunteer: h != null && d != null ? h * d : null, total: h != null && d != null ? h * d * c : null };
};
const volunteerTotals = (f) => f.roles.reduce((a, r) => ({ volunteers: a.volunteers + (num(r.count) || 0), hours: a.hours + (roleHours(r).total || 0) }), { volunteers: 0, hours: 0 });

const mediaMissing = (f) => {
  const miss = [];
  const need = (ok, label) => { if (!ok) miss.push(label); };
  need(has(f.activity), 'اسم النشاط'); need(has(f.implementer), 'اسم المنفذ');
  need(has(f.ageMin) && has(f.ageMax) && !(num(f.ageMin) > num(f.ageMax)), 'العمر المستهدف');
  need(has(f.timeFrom) && has(f.timeTo), 'الفترة الزمنية'); need(has(f.dayPart), 'صباحًا أو مساءً');
  need(has(f.dateFrom) && has(f.dateTo) && !(String(f.dateTo) < String(f.dateFrom)), 'تاريخ النشاط');
  need(num(f.beneficiaries) > 0, 'عدد المستفيدين'); need(has(f.days), 'عدد الأيام الفعلية'); need(has(f.gender), 'الفئة المستهدفة');
  need(f.axes.some(a => has(obj(a).title)), 'المحاور'); need(f.images.length >= MEDIA_MIN_IMAGES, `${MEDIA_MIN_IMAGES} صور على الأقل`);
  need(has(f.dueDate), 'تاريخ انتهاء التصميم'); need(has(f.urgency), 'مستعجل أو غير مستعجل'); need(has(f.cost), 'تكلفة البرنامج');
  return miss;
};
const mediaStarted = (f) => ['activity', 'implementer', 'ageMin', 'ageMax', 'timeFrom', 'timeTo', 'dayPart', 'dateFrom', 'dateTo', 'beneficiaries', 'seatsNote', 'days', 'gender', 'dueDate', 'urgency', 'cost', 'notes']
  .some(k => has(f[k])) || f.images.length > 0 || f.axes.some(a => has(obj(a).title) || has(obj(a).desc));
const volunteerMissing = (f) => {
  const miss = [];
  const need = (ok, label) => { if (!ok) miss.push(label); };
  need(has(f.coordinatorName), 'اسم منسق الفرص'); need(has(f.coordinatorPhone), 'جوال المنسق'); need(has(f.location), 'مكان التطوع'); need(has(f.mode), 'طريقة التطوع');
  need(f.roles.length > 0, 'دور تطوعي واحد على الأقل');
  f.roles.forEach((r, j) => {
    const n = `الدور ${j + 1}`;
    need(has(r.title), `${n}: المسمى`); need(has(r.field), `${n}: المجال`); need(num(r.count) > 0, `${n}: العدد`); need(has(r.tasks), `${n}: المهام`);
    need(has(r.gender), `${n}: الجنس`); need(roleDays(r) != null, `${n}: الأيام`); need(hoursBetween(r.timeFrom, r.timeTo) != null, `${n}: الساعات`);
  });
  return miss;
};
const volunteerStarted = (f) => ['coordinatorName', 'coordinatorPhone', 'location', 'mode', 'support', 'risks'].some(k => has(f[k]))
  || f.roles.some(r => ['title', 'field', 'count', 'tasks', 'skills', 'timeFrom', 'dateFrom', 'days'].some(k => has(r[k])));

// { status, tone: ok|wait|na|none|gone, linked, missing }
const blockState = (t, key, live = {}) => {
  const b = BLOCK_OF[key]; const x = obj(t[key]);
  if (x.status === NA) return { status: NA, tone: 'na' };
  if (key === 'content' && has(x.kitId)) {
    const k = live.kits ? live.kits[x.kitId] : undefined;
    if (live.kits && !k) return { status: 'الحقيبة غير متاحة', tone: 'none', gone: true };
    const ok = k?.status === 'approved';
    return { status: ok ? b.attached : b.pending, tone: ok ? 'ok' : 'wait', linked: k || null };
  }
  if (key === 'finance' && has(x.requestId)) {
    const r = live.finance ? live.finance[x.requestId] : undefined;
    if (live.finance && !r) return { status: 'الطلب غير متاح', tone: 'none', gone: true };
    const ok = r?.status === 'approved';
    return { status: ok ? b.attached : b.pending, tone: ok ? 'ok' : 'wait', linked: r || null };
  }
  if (key === 'media' || key === 'volunteer') {
    const f = key === 'media' ? mediaForm(t) : volunteerForm(t);
    if (key === 'media' ? mediaStarted(f) : volunteerStarted(f)) {
      const miss = key === 'media' ? mediaMissing(f) : volunteerMissing(f);
      return { status: miss.length ? b.pending : b.attached, tone: miss.length ? 'wait' : 'ok', form: f, missing: miss };
    }
  }
  if (arr(x.files).length || has(x.link)) {
    const st = has(x.status) ? x.status : b.attached;
    return { status: st, tone: /^مرفق/.test(st) ? 'ok' : 'wait', legacy: true };
  }
  // Older plans: a typed "not attached yet" status still stands.
  if (has(x.status)) return { status: x.status, tone: /^مرفق/.test(x.status) ? 'none' : 'wait', legacy: true };
  return { status: '', tone: 'none' };
};

const tag = (st) => `<span class="tag ${st.tone === 'gone' ? 'none' : st.tone}">${has(st.status) ? esc(st.status) : 'لم تُحدد'}</span>`;
const fmtH = (n) => (n == null ? '—' : String(Math.round(n * 100) / 100));
// Arabic number agreement: [one, two, 3–10, 11+] (decimals take the last).
const arN = (n, f) => {
  n = Math.round(+n * 100) / 100;
  if (n === 1) return f[0];
  if (n === 2) return f[1];
  const m = Math.floor(n) % 100;
  return `${n} ${Number.isInteger(n) && m >= 3 && m <= 10 ? f[2] : f[3]}`;
};
const DAYS_W = ['يوم واحد', 'يومان', 'أيام', 'يومًا'];
const HOURS_W = ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة'];
const VOLS_W = ['متطوع واحد', 'متطوعان', 'متطوعين', 'متطوعًا'];
const ROLES_W = ['دور واحد', 'دوران', 'أدوار', 'دورًا'];

const safeHref = (v) => /^https?:\/\//i.test(String(v || '').trim()) ? esc(String(v).trim()) : null;
const link = (v) => {
  if (!has(v)) return '';
  const href = safeHref(v);
  return `<div class="lnk">🔗 ${href ? `<a href="${href}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v)}</div>`;
};
const fileList = (list, files) => (list || []).map(f => {
  const meta = files[f.fileId] || f;
  return `<div class="file">📎 ${esc(meta.name || f.name)} <small>${meta.size ? humanSize(meta.size) : ''}</small></div>`;
}).join('');

// ─────────────── The two forms, as HTML ───────────────

const kvRow = (label, value) => `<tr><th>${label}</th><td>${value}</td></tr>`;
const imgGrid = (list, images) => (list.length
  ? `<div class="imgs">${list.map(im => `<figure>${images[im.fileId] ? `<img src="${images[im.fileId]}" alt="">` : '<div class="noimg">الصورة غير متاحة</div>'}${has(im.caption) ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`
  : '<p class="nil">لم تُرفق صور.</p>');
const datePair = (a, b) => (has(a) || has(b)
  ? `من يوم: <b>${esc(weekdayOf(a) || '—')}</b> تاريخ: <b>${has(a) ? esc(fmtDate(a)) : '—'}</b> &nbsp; إلى يوم: <b>${esc(weekdayOf(b) || '—')}</b> تاريخ: <b>${has(b) ? esc(fmtDate(b)) : '—'}</b>`
  : dash(''));

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

const volunteerBody = (f) => {
  const tot = volunteerTotals(f);
  return `
  <table class="kv">
    ${kvRow('منسق الفرص التطوعية', dash(f.coordinatorName))}
    ${kvRow('جوال المنسق', has(f.coordinatorPhone) ? `<span dir="ltr">${esc(f.coordinatorPhone)}</span>` : dash(''))}
    ${kvRow('مكان التطوع', dash(f.location))}
    ${kvRow('طريقة التطوع', dash(f.mode))}
  </table>
  <h4>الأدوار التطوعية</h4>
  <table class="grid roles"><thead><tr><th>#</th><th>الدور / المسمى</th><th>المجال أو التخصص</th><th>العدد</th><th>المهام والمسؤوليات</th><th>الشروط</th><th>الأيام</th><th>الساعات</th><th>ساعات المتطوع</th></tr></thead><tbody>
    ${f.roles.map((r, j) => {
      const x = roleHours(r);
      const cond = [has(r.gender) ? `الجنس: ${esc(r.gender)}` : '', has(r.ageMin) || has(r.ageMax) ? `العمر: ${esc(r.ageMin || '—')}–${esc(r.ageMax || '—')}` : '', has(r.education) ? `المؤهل: ${esc(r.education)}` : '', has(r.skills) ? `المهارات: ${multiline(r.skills)}` : ''].filter(Boolean).join('<br>');
      const days = has(r.dateFrom)
        ? `${esc(fmtDate(r.dateFrom))}${has(r.dateTo) && r.dateTo !== r.dateFrom ? ` – ${esc(fmtDate(r.dateTo))}` : ''}${r.weekdays.length ? `<br><small>${r.weekdays.map(esc).join('، ')}</small>` : ''}<br><small>${x.days != null ? arN(x.days, DAYS_W) : ''}</small>`
        : (x.days != null ? arN(x.days, DAYS_W) : dash(''));
      return `<tr><td class="code">${j + 1}</td><td><b>${dash(r.title)}</b></td><td>${dash(r.field)}</td><td class="code">${esc(r.count || '—')}</td><td>${dash(r.tasks)}</td><td>${cond || '<span class="nil">—</span>'}</td><td>${days}</td><td class="dt">${has(r.timeFrom) ? `${esc(r.timeFrom)}–${esc(r.timeTo || '')}<br><small>${x.perDay != null ? `${arN(x.perDay, HOURS_W)} يوميًا` : ''}</small>` : dash('')}</td><td class="code">${fmtH(x.perVolunteer)}</td></tr>`;
    }).join('') || '<tr><td colspan="9" class="nil">—</td></tr>'}
  </tbody></table>
  <p class="total">الإجمالي: <b>${tot.volunteers ? arN(tot.volunteers, VOLS_W) : '—'}</b> · <b>${fmtH(tot.hours)}</b> ساعة تطوعية</p>
  <table class="kv">
    ${kvRow('الدعم المقدم للمتطوع', dash(f.support))}
    ${kvRow('المخاطر والتحديات', dash(f.risks))}
  </table>`;
};

const linkedLine = (icon, label, no, title, l, m) => `<div class="kit">${icon} ${label} ${esc(no)}${has(title) ? ` «${esc(title)}»` : ''}${l ? ` <small>— ${esc((m ? LIVE_STATUS_M : LIVE_STATUS)[l.status] || l.status || '')}${l.status === 'approved' && l.approvedAt ? ` ${esc(fmtDate(l.approvedAt))}` : ''}</small>` : ''}</div>`;

/**
 * @param {object} o
 *   plan     — ExecutionPlan row (planNumber, status, …)
 *   version  — ExecutionPlanVersion row being shown (or null for the draft)
 *   data     — plan data to render
 *   author   — { name, section }
 *   files    — { [fileId]: { name, size } }
 *   images   — { [fileId]: dataUrl }
 *   extra    — { live: { kits, finance } } from the controller's prepare()
 */
const renderPlanDocument = ({ plan, version, data, author, files = {}, images = {}, extra = {} }) => {
  const d = data || {};
  const h = d.header || {};
  const targets = Array.isArray(d.targets) ? d.targets : [];
  const period = periodLabel(h);
  const v = version || {};
  const live = extra.live || {};

  const row = (label, value) => `<tr><th>${label}</th><td>${value}</td></tr>`;
  const table = (heads, rows, cls = '') => `<table class="grid ${cls}"><thead><tr>${heads.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}" class="nil">—</td></tr>`}</tbody></table>`;

  // Appendix numbers of the filled media / volunteer forms.
  const appx = [];
  targets.forEach((t, i) => ['media', 'volunteer'].forEach(key => {
    const st = blockState(t, key, live);
    if (st.form) appx.push({ i, t, key, st, n: appx.length + 1 });
  }));
  const appxOf = (t, key) => appx.find(a => a.t === t && a.key === key);
  const legacyProof = (x) => `${link(obj(x).link)}${fileList(obj(x).files, files)}`;

  const fileCell = (t, key) => {
    const x = obj(t[key]);
    const st = blockState(t, key, live);
    let body = '';
    if (key === 'content' && has(x.kitId)) body = linkedLine('🎒', 'الحقيبة التدريبية', x.kitNo || fmtKitNo(st.linked?.number), st.linked?.title || x.kitTitle, st.linked, false);
    if (key === 'finance' && has(x.requestId)) body = linkedLine('🧾', 'طلب الصرف المالي', x.requestNo || fmtFinanceNo(st.linked?.number), st.linked?.title || x.requestTitle, st.linked, true);
    if (st.form) {
      const a = appxOf(t, key);
      const f = st.form;
      const sumLine = key === 'media'
        ? [has(f.dateFrom) ? `النشاط: ${esc(fmtDate(f.dateFrom))}` : '', has(f.dueDate) ? `انتهاء التصميم: ${esc(fmtDate(f.dueDate))}` : '', has(f.urgency) ? esc(f.urgency) : '', (f.images.length ? arN(f.images.length, ['صورة واحدة', 'صورتان', 'صور', 'صورة']) : 'بلا صور')].filter(Boolean).join(' · ')
        : (() => { const tt = volunteerTotals(f); return `${arN(f.roles.length, ROLES_W)} · ${tt.volunteers ? arN(tt.volunteers, VOLS_W) : '—'} · ${fmtH(tt.hours)} ساعة تطوعية`; })();
      body = `<div class="kit">📝 ${key === 'media' ? 'نموذج طلب تصميم الإعلان' : 'نموذج الفرص التطوعية'}${a ? ` — الملحق ${a.n}` : ''}</div><div class="file">${sumLine}</div>${st.missing.length ? `<div class="file nil">ناقص: ${st.missing.slice(0, 4).map(esc).join('، ')}${st.missing.length > 4 ? '…' : ''}</div>` : ''}`;
    }
    return `${tag(st)}${body}${legacyProof(x)}`;
  };

  const summary = table(
    ['رقم', 'اسم العمل المخطط', 'مؤشر الأداء المرتبط', 'المخرج المتوقع والكمية', 'الفئة المستهدفة', 'شهر التنفيذ', 'دور مسؤول القسم', 'المحتوى المعتمد', 'الملف المالي', 'المتطلبات الإعلامية', 'الفرص التطوعية'],
    targets.map((t, i) => `<tr><td class="code">${i + 1}</td><td><b>${dash(t.name)}</b></td><td>${dash(t.kpi)}</td><td>${dash(t.output)}</td><td>${dash(t.audience)}</td><td>${has(t.month) ? esc(monthName(t.month)) : dash('')}</td><td>${dash(t.headRole)}</td>${FILE_BLOCKS.map(b => `<td>${tag(blockState(t, b.key, live))}</td>`).join('')}</tr>`),
    'sum'
  );

  const detail = targets.map((t, i) => {
    const phases = (t.phases || []).filter(p => has(p.task) || has(p.start) || has(p.end) || has(p.criterion));
    return `<article class="target">
      <h3><span class="n">${i + 1}</span>${esc(t.name || 'مستهدف بلا اسم')}</h3>
      <div class="cols">
        <table class="kv">
          ${row('مؤشر الأداء المرتبط', dash(t.kpi))}
          ${row('وصف مختصر', dash(t.desc))}
          ${row('المخرج المتوقع والكمية', dash(t.output))}
          ${row('الفئة المستهدفة', dash(t.audience))}
        </table>
        <table class="kv">
          ${row('شهر التنفيذ', has(t.month) ? `${esc(monthName(t.month))}${has(h.year) ? ` ${esc(h.year)}` : ''}` : dash(''))}
          ${row('مكان التنفيذ', dash(t.place))}
          ${row('وقت التنفيذ', dash(t.time))}
          ${row('دور القسم', dash(t.sectionRole))}
          ${row('دور مسؤول القسم', dash(t.headRole))}
        </table>
      </div>
      <h4>الخطة الزمنية لمراحل تنفيذ المستهدف</h4>
      ${table(['#', 'المرحلة / المهمة', 'تاريخ البداية', 'تاريخ النهاية', 'مخرج المرحلة / معيار اكتمالها'],
        phases.map((p, j) => `<tr><td class="code">${j + 1}</td><td>${dash(p.task)}</td><td class="dt">${has(p.start) ? esc(fmtDate(p.start)) : dash('')}</td><td class="dt">${has(p.end) ? esc(fmtDate(p.end)) : dash('')}</td><td>${dash(p.criterion)}</td></tr>`))}
      <h4>الملفات المرتبطة بالمستهدف</h4>
      ${table(['البند', 'الحالة والمسار'], FILE_BLOCKS.map(b => `<tr><td><b>${b.label}</b></td><td>${fileCell(t, b.key)}</td></tr>`), 'files')}
      ${has(t.notes) ? `<div class="notes"><b>ملاحظات:</b> ${multiline(t.notes)}</div>` : ''}
    </article>`;
  }).join('');

  // A compact month-by-month view of every phase across the plan.
  const allPhases = targets.flatMap((t, i) => (t.phases || []).filter(p => has(p.task) && has(p.start)).map(p => ({ i, t, p })))
    .sort((a, b) => String(a.p.start).localeCompare(String(b.p.start)));
  const timeline = allPhases.length ? table(['من', 'إلى', 'المستهدف', 'المرحلة / المهمة'],
    allPhases.map(x => `<tr><td class="dt">${esc(shortDate(x.p.start))}</td><td class="dt">${has(x.p.end) ? esc(shortDate(x.p.end)) : '—'}</td><td><b class="code">${x.i + 1}</b> ${esc(x.t.name || '')}</td><td>${esc(x.p.task)}</td></tr>`), 'tl') : '';

  const sig = (name, at, decision) => (decision === 'approved'
    ? `<td>${esc(name || '—')}</td><td>${esc(fmtDate(at))}</td><td class="ok">✓ معتمد إلكترونيًا</td>`
    : `<td class="nil">—</td><td class="nil">—</td><td class="nil">${decision === 'returned' ? 'أُعيدت للتعديل' : 'بانتظار المراجعة'}</td>`);
  const approval = table(['الإجراء', 'الاسم', 'التاريخ', 'الاعتماد'], [
    `<tr><td><b>رفع الخطة</b> <small>(مسؤول القسم)</small></td><td>${esc(h.head || author?.name || '—')}</td><td>${version?.submittedAt ? esc(fmtDate(version.submittedAt)) : '<span class="nil">لم تُرفع بعد</span>'}</td><td>${version ? `الإصدار ${version.versionNumber}` : '<span class="nil">مسودة</span>'}</td></tr>`,
    `<tr><td><b>مراجعة الخطة</b> <small>(مسؤول إدارة المشاريع)</small></td>${sig(v.pmName, v.pmAt, v.pmDecision)}</tr>`,
    `<tr><td><b>اعتماد الخطة</b> <small>(المدير)</small></td>${sig(v.managerName, v.managerAt, v.managerDecision)}</tr>`
  ]);

  const fablab = logo('fablab.png'); const found = logo('found.png');
  const statusText = version
    ? (v.managerDecision === 'approved' ? 'معتمدة' : v.managerDecision === 'returned' || v.pmDecision === 'returned' ? 'أُعيدت للتعديل' : v.pmDecision === 'approved' ? 'لدى المدير للاعتماد' : 'لدى مسؤول إدارة المشاريع')
    : (STATUS_AR[plan?.status] || 'مسودة');
  const pct = version ? (version.completion || 0) : (plan?.completion || 0);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>الخطة التنفيذية${period ? ` — ${esc(period)}` : ''} — ${fmtPlanNo(plan?.planNumber)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#eef1f5;color:#0f172a;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;font-size:13px;line-height:1.65}
  .page{max-width:1240px;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.08)}
  .band{background:linear-gradient(135deg,#1a0a0b,#3a0d10 60%,#EE2329);color:#fff;padding:20px 26px 22px;position:relative;overflow:hidden}
  .band::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:24px 24px;pointer-events:none}
  .band .top{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
  .band .logos{display:flex;gap:14px;align-items:center}.band .logos img{height:38px;filter:brightness(0) invert(1)}
  .band .meta{font-family:'JetBrains Mono',monospace;font-size:12px;text-align:left;opacity:.9;line-height:1.6}
  .band h1{position:relative;margin:14px 0 4px;font-size:26px;line-height:1.3}
  .band .sub{position:relative;opacity:.85;font-size:13px}
  .hdr{position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;margin-top:14px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.18);border-radius:10px;overflow:hidden}
  .hdr div{background:rgba(10,4,5,.35);padding:8px 12px}
  .hdr dt{font-size:11px;opacity:.75}.hdr dd{margin:2px 0 0;font-weight:700}
  .stamp{position:relative;display:inline-block;margin-top:12px;padding:3px 12px;border-radius:999px;background:#fff;color:#b91c1c;font-weight:700;font-size:12px}
  .body{padding:6px 26px 26px}
  .note{margin:16px 0 0;padding:9px 12px;border-radius:8px;background:#fff7ed;border-right:4px solid #f59e0b;color:#7c2d12;font-size:12.5px}
  .sec{margin-top:20px}
  h2{display:flex;align-items:center;gap:10px;font-size:17px;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #EE2329}
  h2 .n{display:inline-grid;place-items:center;min-width:28px;height:28px;border-radius:8px;background:#EE2329;color:#fff;font-family:'JetBrains Mono',monospace;font-size:13px}
  h4{font-size:13.5px;margin:12px 0 6px;color:#7f1d1d}
  table{width:100%;border-collapse:collapse;margin:0 0 6px}
  table.kv th{width:170px;text-align:start;vertical-align:top;background:#fdf2f2;color:#7f1d1d;font-weight:600;padding:6px 10px;border:1px solid #f1d5d5}
  table.kv td{padding:6px 10px;border:1px solid #eceff3;vertical-align:top}
  table.grid th{background:#1e293b;color:#fff;font-weight:600;font-size:12px;padding:6px 8px;text-align:start;border:1px solid #1e293b}
  table.grid td{padding:6px 8px;border:1px solid #e5e9f0;vertical-align:top}
  table.grid tbody tr:nth-child(even) td{background:#f8fafc}
  table.sum td{font-size:12.5px}
  table.files td:first-child{width:200px}
  td.code,b.code{font-family:'JetBrains Mono',monospace;font-weight:700;color:#b91c1c;white-space:nowrap}
  td.dt{white-space:nowrap}
  td.ok{color:#15803d;font-weight:700}
  small{color:#64748b}
  .nil{color:#94a3b8}
  .tag{display:inline-block;padding:1px 9px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
  .tag.ok{background:#dcfce7;color:#14532d}.tag.wait{background:#fef3c7;color:#78350f}.tag.na{background:#f1f5f9;color:#475569}.tag.none{background:#fee2e2;color:#991b1b}
  .lnk,.file,.kit{font-size:12px;margin-top:3px;word-break:break-all}.lnk a{color:#1d4ed8}
  .kit{font-weight:600;color:#7f1d1d}
  .target{margin-top:16px;padding:12px 14px 10px;border:1px solid #e5e9f0;border-radius:12px;break-inside:avoid-page}
  .target h3{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:15.5px}
  .target h3 .n{display:inline-grid;place-items:center;min-width:26px;height:26px;border-radius:7px;background:#1e293b;color:#fff;font-family:'JetBrains Mono',monospace;font-size:12.5px}
  .cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .notes{margin-top:6px;padding:7px 10px;border-radius:8px;background:#f8fafc;font-size:12.5px}
  .imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
  .imgs figure{margin:0;border:1px solid #e5e9f0;border-radius:10px;overflow:hidden;break-inside:avoid}
  .imgs img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f8fafc}
  .imgs figcaption{padding:5px 9px;font-size:12px}
  .noimg{aspect-ratio:4/3;display:grid;place-items:center;color:#94a3b8;background:#f8fafc}
  ol.axes{margin:0;padding-inline-start:20px;display:grid;gap:4px}
  table.roles td{font-size:12px}
  p.total{margin:6px 0 10px;color:#334155}
  .appx .target h3 small{font-weight:500;color:#64748b;font-size:12.5px}
  .done{display:flex;align-items:center;gap:12px;margin-top:8px}.done b{font-size:20px;font-family:'JetBrains Mono',monospace}
  .bar{flex:1;max-width:320px;height:8px;border-radius:4px;background:#e5e9f0;overflow:hidden}.bar i{display:block;height:100%;background:#EE2329}
  .foot{margin-top:24px;padding-top:10px;border-top:1px solid #e5e9f0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11.5px;color:#64748b}
  @media (max-width:760px){.hdr{grid-template-columns:repeat(2,minmax(0,1fr))}.cols{grid-template-columns:minmax(0,1fr)}}
  @media print{body{background:#fff}.page{box-shadow:none;max-width:none}.band,table.grid th,h2 .n,.target h3 .n,table.kv th,.tag,.bar i{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}}
  @page{size:A4 landscape;margin:10mm}
</style></head>
<body><div class="page">
  <header class="band">
    <div class="top">
      <div class="logos">${fablab ? `<img src="${fablab}" alt="FabLab">` : ''}${found ? `<img src="${found}" alt="">` : ''}</div>
      <div class="meta">${fmtPlanNo(plan?.planNumber)}<br>${version ? `الإصدار ${version.versionNumber}` : 'مسودة'}${version?.submittedAt ? ` · ${esc(fmtDate(version.submittedAt))}` : ''}</div>
    </div>
    <h1>نموذج الخطة التنفيذية</h1>
    <div class="sub">فاب لاب الأحساء</div>
    <dl class="hdr">
      <div><dt>فترة الخطة: الشهر/الربع والسنة</dt><dd>${period ? esc(period) : '—'}</dd></div>
      <div><dt>القسم أو المسار</dt><dd>${has(h.section) ? esc(h.section) : '—'}</dd></div>
      <div><dt>اسم مسؤول القسم</dt><dd>${has(h.head) ? esc(h.head) : esc(author?.name || '—')}</dd></div>
      <div><dt>تاريخ رفع الخطة</dt><dd>${version?.submittedAt ? esc(fmtDate(version.submittedAt)) : 'لم تُرفع بعد'}</dd></div>
    </dl>
    <span class="stamp">${esc(statusText)}${author?.name ? ` · إعداد: ${esc(author.name)}` : ''}</span>
  </header>
  <div class="body">
    <p class="note">لكل ملف من ملفات المستهدف مساره: المحتوى المعتمد حقيبة تدريبية والملف المالي طلب صرف مالي (يعتمدهما مسؤول إدارة المشاريع ثم المدير، وحالتهما هنا هي حالتهما الحالية)، والمتطلبات الإعلامية والفرص التطوعية نموذجان مرفقان في الملاحق — أو «لا يتطلب».</p>
    <section class="sec"><h2><span class="n">1</span>المستهدفات المخطط تنفيذها خلال فترة الخطة</h2>${summary}</section>
    ${timeline ? `<section class="sec"><h2><span class="n">2</span>الجدول الزمني لمراحل التنفيذ</h2>${timeline}</section>` : ''}
    <section class="sec"><h2><span class="n">${timeline ? 3 : 2}</span>تفاصيل المستهدفات</h2>${detail || '<p class="nil">لا توجد مستهدفات.</p>'}</section>
    <section class="sec"><h2><span class="n">${timeline ? 4 : 3}</span>الرفع والمراجعة والاعتماد</h2>${approval}
      <div class="done"><span>اكتمال الخطة</span><b>${pct}%</b><div class="bar"><i style="width:${pct}%"></i></div></div>
    </section>
    ${appx.length ? `<section class="sec appx"><h2><span class="n">${timeline ? 5 : 4}</span>الملاحق — نماذج المستهدفات</h2>
      ${appx.map(a => `<article class="target">
        <h3><span class="n">م${a.n}</span>${a.key === 'media' ? 'نموذج اعتماد طلب تصميم إعلان' : 'تصاميم الفرص التطوعية'} <small>— المستهدف ${a.i + 1}: ${esc(a.t.name || '')}</small> ${tag(a.st)}</h3>
        ${a.key === 'media' ? mediaBody(a.st.form, images) : volunteerBody(a.st.form)}
      </article>`).join('')}
    </section>` : ''}
    <div class="foot"><span>فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية</span><span>إعداد وتطوير النموذج والمنهجية: م. نوف عبدالله البوعبيد</span></div>
  </div>
</div></body></html>`;
};

// ─────────────── One form on its own page (?part=…) ───────────────

const PART_CSS = `
  *{box-sizing:border-box}
  body{margin:0;background:#eef1f5;color:#0f172a;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;font-size:13.5px;line-height:1.75}
  .page{max-width:860px;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.08);padding:0 0 26px}
  .head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 26px;border-bottom:3px solid #EE2329}
  .head img{height:44px}.head .meta{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#64748b;text-align:left}
  h1{margin:18px 26px 4px;font-size:21px;text-align:center}
  .sub{margin:0 26px 14px;text-align:center;color:#64748b;font-size:12.5px}
  .body{padding:0 26px}
  h4{font-size:14px;margin:16px 0 6px;color:#7f1d1d}
  h4 small{font-weight:400;color:#64748b}
  table{width:100%;border-collapse:collapse;margin:0 0 6px}
  table.kv th{width:190px;text-align:start;vertical-align:top;background:#fdf2f2;color:#7f1d1d;font-weight:600;padding:7px 10px;border:1px solid #f1d5d5}
  table.kv td{padding:7px 10px;border:1px solid #eceff3;vertical-align:top}
  table.grid th{background:#1e293b;color:#fff;font-weight:600;font-size:12px;padding:6px 8px;text-align:start;border:1px solid #1e293b}
  table.grid td{padding:6px 8px;border:1px solid #e5e9f0;vertical-align:top;font-size:12.5px}
  td.code{font-family:'JetBrains Mono',monospace;font-weight:700;color:#b91c1c;white-space:nowrap}
  td.dt{white-space:nowrap}
  small{color:#64748b}.nil{color:#94a3b8}
  ol.axes{margin:0;padding-inline-start:22px;display:grid;gap:6px}
  .imgs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .imgs figure{margin:0;border:1px solid #e5e9f0;border-radius:10px;overflow:hidden;break-inside:avoid}
  .imgs img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f8fafc}
  .imgs figcaption{padding:5px 9px;font-size:12px}
  .noimg{aspect-ratio:4/3;display:grid;place-items:center;color:#94a3b8;background:#f8fafc}
  p.total{margin:6px 0 10px;color:#334155}
  .note{margin:14px 0 0;padding:9px 12px;border-radius:8px;background:#fff7ed;border-right:4px solid #f59e0b;color:#7c2d12;font-size:12.5px}
  .sigs{margin-top:18px;display:grid;gap:12px}
  .sig{border:1px solid #e5e9f0;border-radius:10px;padding:10px 14px;break-inside:avoid}
  .sig .row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px}
  .sig .line{display:inline-block;min-width:170px;border-bottom:1px dotted #94a3b8;height:22px;vertical-align:bottom}
  .sig .notes{margin-top:8px;color:#64748b}
  .sig .notes span{display:block;border-bottom:1px dotted #cbd5e1;height:24px}
  .foot{margin:22px 26px 0;padding-top:10px;border-top:1px solid #e5e9f0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11.5px;color:#64748b}
  @media print{body{background:#fff}.page{box-shadow:none;max-width:none}table.grid th,table.kv th,.head{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr,figure,.sig{break-inside:avoid}}
  @page{size:A4;margin:12mm}`;

const sigBox = (role, name, withNote = true) => `<div class="sig"><div class="row"><span><b>${esc(role)}:</b> ${esc(name || '')}</span><span>التوقيع: <span class="line"></span></span></div>${withNote ? '<div class="notes">ملاحظة:<span></span><span></span></div>' : ''}</div>`;

/**
 * One target's media or volunteer form as a standalone printable page.
 * part = 'media-<targetId>' | 'volunteer-<targetId>'; null if unknown.
 */
const renderPlanPart = ({ plan, version, data, author, images = {}, part }) => {
  const m = /^(media|volunteer)-(.+)$/.exec(String(part || ''));
  if (!m) return null;
  const [, key, tid] = m;
  const targets = Array.isArray(data?.targets) ? data.targets : [];
  const i = targets.findIndex(t => t && t.id === tid);
  if (i < 0) return null;
  const t = targets[i];
  if (obj(t[key]).status === NA) return null;
  const h = data.header || {};
  const fablab = logo('fablab.png'); const found = logo('found.png');
  const meta = `${fmtPlanNo(plan?.planNumber)} · المستهدف ${i + 1}<br>${version ? `الإصدار ${version.versionNumber}` : 'مسودة'}`;
  let title; let body;
  if (key === 'media') {
    const f = mediaForm(t);
    title = 'نموذج اعتماد طلب تصميم إعلان ( لقسم ، ورشة ، برامج )';
    body = `${mediaBody(f, images)}
      <p class="note">يُرجى إرفاق ${MEDIA_MIN_IMAGES} صور مناسبة للحقيبة التدريبية على الأقل، وإرسال الصور نفسها بشكل منفصل للاطلاع عليها واعتمادها قبل النشر.<br>ملحوظة: الرجاء إرسال التصميم للفريق التقني قبل النشر للمراجعة.</p>
      <div class="sigs">
        ${MEDIA_SIGNERS.map(x => sigBox(x.role, x.name)).join('')}
        <div class="sig"><div class="row"><span><b>توقيع منفذ الطلب:</b> ${esc(f.implementer || author?.name || '')} <span class="line"></span></span><span><b>المسؤول التنفيذي:</b> أ. زكي اللويم <span class="line"></span></span></div></div>
      </div>`;
  } else {
    const f = volunteerForm(t);
    title = 'تصاميم الفرص التطوعية';
    body = `${volunteerBody(f)}
      <div class="sigs">
        ${sigBox('منسق الفرص التطوعية', f.coordinatorName || '', false)}
        ${sigBox('مسؤول القسم', h.head || author?.name || '', false)}
      </div>`;
  }
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ${esc(t.name || '')}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>${PART_CSS}</style></head>
<body><div class="page">
  <header class="head"><div>${fablab ? `<img src="${fablab}" alt="FabLab">` : ''}${found ? ` <img src="${found}" alt="">` : ''}</div><div class="meta">${meta}</div></header>
  <h1>${esc(title)}</h1>
  <p class="sub">الخطة التنفيذية — ${esc(periodLabel(h) || '')}${has(h.section) ? ` · ${esc(h.section)}` : ''} · المستهدف ${i + 1}: ${esc(t.name || '')}</p>
  <div class="body">${body}</div>
  <div class="foot"><span>فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية</span><span>${version?.submittedAt ? `رُفعت الخطة ${esc(fmtDate(version.submittedAt))}` : 'من مسودة الخطة'}</span></div>
</div></body></html>`;
};

// [{ key, file }] — the form pages a plan's ZIP carries.
const planParts = (data) => (Array.isArray(data?.targets) ? data.targets : []).flatMap((t, i) => ['media', 'volunteer']
  .filter(key => blockState(t, key).form)
  .map(key => ({ key: `${key}-${t.id}`, file: `المستهدف ${i + 1} - ${key === 'media' ? 'نموذج طلب تصميم الإعلان' : 'الفرص التطوعية'}` })));

module.exports = { renderPlanDocument, renderPlanPart, planParts, fmtPlanNo, periodLabel, monthName, MONTHS, QUARTERS };
