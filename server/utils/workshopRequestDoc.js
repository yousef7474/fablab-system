// Printable document of a workshop request version (طلب ورشة تدريبية):
// the workshop as it will be created — schedule, registration, content —
// plus the approved training kit it comes from, the optional plan target,
// and the electronic approvals. Used for the reviewers' view, printing
// and the "download everything" ZIP, so it embeds the logos and cover.
const fs = require('fs');
const path = require('path');

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== '');
const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const fmt = (n) => NF.format(n);
const multiline = (v) => esc(v).replace(/\n/g, '<br>');
const dash = (v) => (has(v) ? multiline(v) : '<span class="nil">—</span>');
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(String(d).length <= 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(x);
};
const fmtDay = (d) => {
  if (!d) return '';
  const x = new Date(String(d).length <= 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(x);
};
// '16:30' → '4:30 م'
const fmtTime = (t) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'ص' : 'م'}`;
};
const DAYS = ['يوم واحد', 'يومان', 'أيام', 'يومًا'];
const HOURS = ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة'];
const PEOPLE = ['مشارك واحد', 'مشاركان', 'مشاركين', 'مشاركًا'];
const ar = (n, f) => {
  n = +n;
  if (n === 1) return f[0];
  if (n === 2) return f[1];
  const m = Math.floor(n) % 100;
  return `${fmt(n)} ${Number.isInteger(n) && m >= 3 && m <= 10 ? f[2] : f[3]}`;
};
// Calendar days between two ISO dates, inclusive.
const spanDays = (a, b) => {
  const x = new Date(`${a}T12:00:00`); const y = new Date(`${b || a}T12:00:00`);
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime()) || y < x) return null;
  return Math.round((y - x) / 86400000) + 1;
};

const fmtWrNo = (n) => (n == null ? 'WR-—' : `WR-${String(n).padStart(3, '0')}`);
const fmtKitNo = (n) => (n == null ? 'TK-—' : `TK-${String(n).padStart(3, '0')}`);

const STATUS_AR = {
  draft: 'مسودة',
  pm_review: 'لدى مسؤول إدارة المشاريع',
  manager_review: 'لدى المدير للاعتماد',
  returned: 'معاد للتعديل',
  approved: 'معتمد'
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

/**
 * @param {object} o
 *   request  — WorkshopRequest row (requestNumber, status, workshopId, …)
 *   version  — WorkshopRequestVersion row being shown (or null for the draft)
 *   data     — request data to render
 *   author   — { name, section }
 *   images   — { [fileId]: dataUrl }
 *   extra    — { kit: {…approved kit summary} | null, workshop: {…} | null }
 */
const renderWorkshopRequestDocument = ({ request, version, data, author, images = {}, extra = {} }) => {
  const d = data || {};
  const v = version || {};
  const kit = extra.kit || null;
  const ws = extra.workshop || null;
  const row = (label, value) => `<tr><th>${label}</th><td>${value}</td></tr>`;
  const table = (heads, rows) => `<table class="grid"><thead><tr>${heads.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}" class="nil">—</td></tr>`}</tbody></table>`;
  const section = (n, title, body) => `<section class="sec"><h2><span class="n">${n}</span>${title}</h2>${body}</section>`;

  const days = spanDays(d.startDate, d.endDate);
  const hours = num(d.totalHours);
  const price = num(d.price);
  const cap = num(d.maxParticipants);
  const dates = has(d.startDate)
    ? (has(d.endDate) && d.endDate !== d.startDate ? `من ${esc(fmtDate(d.startDate))}<br>إلى ${esc(fmtDate(d.endDate))}` : esc(fmtDate(d.startDate)))
    : dash('');
  const times = has(d.startTime) || has(d.endTime) ? `من ${esc(fmtTime(d.startTime) || '—')} إلى ${esc(fmtTime(d.endTime) || '—')} يوميًا` : dash('');
  const ages = has(d.minAge) || has(d.maxAge)
    ? (has(d.minAge) && has(d.maxAge) ? `من ${esc(d.minAge)} إلى ${esc(d.maxAge)} سنة` : has(d.minAge) ? `${esc(d.minAge)} سنة فأكثر` : `حتى ${esc(d.maxAge)} سنة`)
    : 'بلا حد عمري';
  const cover = d.cover?.fileId && images[d.cover.fileId];

  const sec1 = `
    <div class="wsgrid${cover ? '' : ' nocover'}">
      <table class="kv">
        ${row('عنوان الورشة', `<b>${dash(d.title)}</b>`)}
        ${row('المقدم / المدرب', dash(d.presenter))}
        ${row('التاريخ', `${dates}${days ? `<br><small>${ar(days, DAYS)}</small>` : ''}`)}
        ${row('الوقت', times)}
        ${row('إجمالي الساعات', hours ? ar(hours, HOURS) : dash(''))}
        ${row('المكان / القاعة', dash(d.room))}
        ${row('عدد المقاعد', cap ? ar(cap, PEOPLE) : dash(''))}
        ${row('الفئة العمرية', ages)}
        ${row('رسوم التسجيل', price == null ? dash('') : price === 0 ? 'مجانية' : `${fmt(price)} ر.س`)}
        ${row('الظهور', d.isPublic === false ? 'خاصة — التسجيل برابط مباشر فقط' : 'عامة — تظهر في صفحة تسجيل الورش')}
      </table>
      ${cover ? `<figure class="cover"><img src="${cover}" alt=""><figcaption>صورة الغلاف</figcaption></figure>` : ''}
    </div>
    <h3>وصف الورشة</h3><div class="box">${dash(d.description)}</div>
    <h3>أهداف الورشة</h3><div class="box">${dash(d.objectives)}</div>
    <h3>محتوى الورشة ومحاورها</h3><div class="box">${dash(d.content)}</div>`;

  const k = d.kit || {};
  const kitState = kit
    ? (kit.deleted ? '<span class="tag no">حُذفت الحقيبة</span>' : kit.status === 'approved' ? `<span class="tag ok">معتمدة${kit.approvedAt ? ` · ${esc(fmtDay(kit.approvedAt))}` : ''}</span>` : '<span class="tag wait">لم تعد معتمدة</span>')
    : '';
  const sec2 = `
    <table class="kv">
      ${row('الحقيبة التدريبية', has(k.kitId) ? `<b class="code">${esc(k.kitNo || (kit ? fmtKitNo(kit.number) : ''))}</b> ${esc(kit?.title || k.kitTitle || '')} ${kitState}` : '<span class="nil">لم تُختر حقيبة</span>')}
      ${kit && kit.approvedVersion ? row('الإصدار المعتمد', `الإصدار ${esc(kit.approvedVersion)}`) : ''}
      ${kit && (has(kit.days) || has(kit.hours)) ? row('مدة البرنامج في الحقيبة', `${has(kit.days) ? ar(kit.days, DAYS) : '—'}${has(kit.hours) ? ` × ${ar(kit.hours, HOURS)} يوميًا` : ''}`) : ''}
      ${kit && (has(kit.partMin) || has(kit.partMax)) ? row('عدد المشاركين في الحقيبة', `${esc(kit.partMin || '—')} – ${esc(kit.partMax || '—')}`) : ''}
      ${kit && has(kit.level) ? row('المستوى', esc(kit.level)) : ''}
    </table>
    ${kit && kit.outputs?.length ? `<h3>مخرجات الحقيبة</h3><ol class="lst">${kit.outputs.map((o, i) => `<li><b>م${i + 1}</b> ${esc(o)}</li>`).join('')}</ol>` : ''}`;

  const p = d.plan || {};
  const sec3 = has(p.planId)
    ? `<table class="kv">${row('الخطة التنفيذية', `<b class="code">${esc(p.planNo || '')}</b> ${esc(p.planTitle || '')}`)}${row('المستهدف', dash(p.targetName))}</table>`
    : '<p class="nil">الطلب غير مرتبط بمستهدف في خطة تنفيذية.</p>';

  const sig = (name, at, decision) => (decision === 'approved'
    ? `<td>${esc(name || '—')}</td><td>${esc(fmtDay(at))}</td><td class="ok">✓ معتمد إلكترونيًا</td>`
    : `<td class="nil">—</td><td class="nil">—</td><td class="nil">${decision === 'returned' ? 'أُعيد للتعديل' : 'بانتظار المراجعة'}</td>`);
  const sec4 = `
    ${table(['الإجراء', 'الاسم', 'التاريخ', 'الاعتماد'], [
      `<tr><td><b>تقديم الطلب</b> <small>(الموظف)</small></td><td>${esc(author?.name || '—')}</td><td>${version?.submittedAt ? esc(fmtDay(version.submittedAt)) : '<span class="nil">لم يُرسل بعد</span>'}</td><td>${version ? `الإصدار ${version.versionNumber}` : '<span class="nil">مسودة</span>'}</td></tr>`,
      `<tr><td><b>مراجعة الطلب</b> <small>(مسؤول إدارة المشاريع)</small></td>${sig(v.pmName, v.pmAt, v.pmDecision)}</tr>`,
      `<tr><td><b>اعتماد الطلب</b> <small>(المدير)</small></td>${sig(v.managerName, v.managerAt, v.managerDecision)}</tr>`
    ])}
    ${has(d.notes) ? `<div class="notes"><b>ملاحظات مقدم الطلب:</b> ${multiline(d.notes)}</div>` : ''}
    ${ws ? `<div class="created">✓ أُنشئت الورشة «${esc(ws.title)}» في نظام الورش التدريبية${ws.startDate ? ` — تبدأ ${esc(fmtDay(ws.startDate))}` : ''} · ${ws.isPublic ? 'عامة في صفحة التسجيل' : 'خاصة برابط مباشر'}.</div>` : ''}`;

  const fablab = logo('fablab.png'); const found = logo('found.png');
  const statusText = version
    ? (v.managerDecision === 'approved' ? 'معتمد' : v.managerDecision === 'returned' || v.pmDecision === 'returned' ? 'أُعيد للتعديل' : v.pmDecision === 'approved' ? 'لدى المدير للاعتماد' : 'لدى مسؤول إدارة المشاريع')
    : (STATUS_AR[request?.status] || 'مسودة');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>طلب ورشة — ${esc(d.title || 'بلا عنوان')} — ${fmtWrNo(request?.requestNumber)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#eef1f5;color:#0f172a;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;font-size:13.5px;line-height:1.7}
  .page{max-width:980px;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.08)}
  .band{background:linear-gradient(135deg,#1a0a0b,#3a0d10 60%,#EE2329);color:#fff;padding:22px 28px 24px;position:relative;overflow:hidden}
  .band::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:24px 24px;pointer-events:none}
  .band .top{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
  .band .logos{display:flex;gap:14px;align-items:center}.band .logos img{height:40px;filter:brightness(0) invert(1)}
  .band .meta{font-family:'JetBrains Mono',monospace;font-size:12px;text-align:left;opacity:.9;line-height:1.6}
  .band .kind{position:relative;margin-top:16px;font-size:13px;opacity:.85}
  .band h1{position:relative;margin:4px 0 6px;font-size:26px;line-height:1.3}
  .stamp{position:relative;display:inline-block;margin-top:10px;padding:3px 12px;border-radius:999px;background:#fff;color:#b91c1c;font-weight:700;font-size:12px}
  .body{padding:8px 28px 28px}
  .sec{margin-top:22px}
  h2{display:flex;align-items:center;gap:10px;font-size:18px;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #EE2329}
  h2 .n{display:inline-grid;place-items:center;min-width:30px;height:30px;border-radius:8px;background:#EE2329;color:#fff;font-family:'JetBrains Mono',monospace;font-size:14px}
  h3{font-size:14.5px;margin:16px 0 8px;color:#7f1d1d}
  table{width:100%;border-collapse:collapse;margin:0 0 6px}
  table.kv th{width:190px;text-align:start;vertical-align:top;background:#fdf2f2;color:#7f1d1d;font-weight:600;padding:7px 10px;border:1px solid #f1d5d5}
  table.kv td{padding:7px 10px;border:1px solid #eceff3;vertical-align:top}
  table.grid th{background:#1e293b;color:#fff;font-weight:600;font-size:12.5px;padding:7px 8px;text-align:start;border:1px solid #1e293b}
  table.grid td{padding:7px 8px;border:1px solid #e5e9f0;vertical-align:top}
  td.ok{color:#15803d;font-weight:700}
  .code{font-family:'JetBrains Mono',monospace;font-weight:700;color:#b91c1c}
  small{color:#64748b}
  .nil{color:#94a3b8}
  .wsgrid{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:14px;align-items:start}
  .wsgrid.nocover{grid-template-columns:minmax(0,1fr)}
  .cover{margin:0;border:1px solid #e5e9f0;border-radius:10px;overflow:hidden}
  .cover img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f8fafc}
  .cover figcaption{padding:5px 10px;font-size:12px;color:#64748b}
  .box{padding:9px 12px;border:1px solid #eceff3;border-radius:8px}
  ol.lst{margin:0;padding:0;list-style:none;display:grid;gap:5px}
  ol.lst li{padding:6px 10px;border:1px solid #eceff3;border-radius:8px}
  ol.lst b{display:inline-block;min-width:34px;color:#b91c1c;font-family:'JetBrains Mono',monospace}
  .tag{display:inline-block;margin-inline-start:6px;padding:1px 9px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
  .tag.ok{background:#dcfce7;color:#14532d}.tag.wait{background:#fef3c7;color:#78350f}.tag.no{background:#fee2e2;color:#991b1b}
  .notes{margin-top:10px;padding:8px 12px;border-radius:8px;background:#f8fafc}
  .created{margin-top:12px;padding:10px 14px;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;font-weight:600}
  .foot{margin-top:26px;padding-top:10px;border-top:1px solid #e5e9f0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11.5px;color:#64748b}
  @media (max-width:720px){.wsgrid{grid-template-columns:minmax(0,1fr)}}
  @media print{body{background:#fff}.page{box-shadow:none;max-width:none}.band,table.grid th,h2 .n,table.kv th,.tag,.created{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr,figure{break-inside:avoid}}
  @page{size:A4;margin:12mm}
</style></head>
<body><div class="page">
  <header class="band">
    <div class="top">
      <div class="logos">${fablab ? `<img src="${fablab}" alt="FabLab">` : ''}${found ? `<img src="${found}" alt="">` : ''}</div>
      <div class="meta">${fmtWrNo(request?.requestNumber)}<br>${version ? `الإصدار ${version.versionNumber}` : 'مسودة'}${version?.submittedAt ? ` · ${esc(fmtDay(version.submittedAt))}` : ''}</div>
    </div>
    <div class="kind">طلب ورشة تدريبية من حقيبة معتمدة${has(k.kitNo) ? ` · ${esc(k.kitNo)}` : ''}</div>
    <h1>${esc(d.title || 'ورشة بلا عنوان')}</h1>
    <span class="stamp">${esc(statusText)}${author?.name ? ` · مقدم الطلب: ${esc(author.name)}` : ''}</span>
  </header>
  <div class="body">
    ${section('1', 'بيانات الورشة المطلوبة', sec1)}
    ${section('2', 'الحقيبة التدريبية المعتمدة', sec2)}
    ${section('3', 'الارتباط بالخطة التنفيذية', sec3)}
    ${section('4', 'المراجعة والاعتماد', sec4)}
    <div class="foot"><span>فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية</span><span>تُنشأ الورشة في نظام الورش تلقائيًا عند اعتماد المدير للطلب</span></div>
  </div>
</div></body></html>`;
};

module.exports = { renderWorkshopRequestDocument, fmtWrNo, fmtKitNo };
