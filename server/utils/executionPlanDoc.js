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

// A status tag colour: attached = green, in progress = amber, n/a = grey.
const tone = (status) => {
  if (!has(status)) return 'none';
  if (/^لا يتطلب/.test(status)) return 'na';
  if (/^مرفق/.test(status)) return 'ok';
  return 'wait';
};
const tag = (status) => `<span class="tag ${tone(status)}">${has(status) ? esc(status) : 'لم تُحدد'}</span>`;

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

/**
 * @param {object} o
 *   plan     — ExecutionPlan row (planNumber, status, …)
 *   version  — ExecutionPlanVersion row being shown (or null for the draft)
 *   data     — plan data to render
 *   author   — { name, section }
 *   files    — { [fileId]: { name, size } }
 */
const renderPlanDocument = ({ plan, version, data, author, files = {} }) => {
  const d = data || {};
  const h = d.header || {};
  const targets = Array.isArray(d.targets) ? d.targets : [];
  const period = periodLabel(h);
  const v = version || {};

  const row = (label, value) => `<tr><th>${label}</th><td>${value}</td></tr>`;
  const table = (heads, rows, cls = '') => `<table class="grid ${cls}"><thead><tr>${heads.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}" class="nil">—</td></tr>`}</tbody></table>`;

  const contentCell = (t) => {
    const c = t.content || {};
    const kit = c.kitId ? `<div class="kit">🎒 الحقيبة التدريبية ${esc(c.kitNo || '')}${has(c.kitTitle) ? ` «${esc(c.kitTitle)}»` : ''}</div>` : '';
    return `${tag(c.status)}${kit}${link(c.link)}${fileList(c.files, files)}`;
  };
  const blockCell = (b) => `${tag((b || {}).status)}${link((b || {}).link)}${fileList((b || {}).files, files)}`;
  const volunteerCell = (b) => {
    const x = b || {};
    const body = `${link(x.link)}${fileList(x.files, files)}`;
    return body || '<span class="nil">لا يوجد</span>';
  };

  const summary = table(
    ['رقم', 'اسم العمل المخطط', 'مؤشر الأداء المرتبط', 'المخرج المتوقع والكمية', 'الفئة المستهدفة', 'شهر التنفيذ', 'دور مسؤول القسم', 'المحتوى المعتمد', 'الملف المالي', 'المتطلبات الإعلامية'],
    targets.map((t, i) => `<tr><td class="code">${i + 1}</td><td><b>${dash(t.name)}</b></td><td>${dash(t.kpi)}</td><td>${dash(t.output)}</td><td>${dash(t.audience)}</td><td>${has(t.month) ? esc(monthName(t.month)) : dash('')}</td><td>${dash(t.headRole)}</td><td>${tag((t.content || {}).status)}</td><td>${tag((t.finance || {}).status)}</td><td>${tag((t.media || {}).status)}</td></tr>`),
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
      ${table(['البند', 'الحالة والملف أو الرابط'], [
        `<tr><td><b>المحتوى المعتمد</b></td><td>${contentCell(t)}</td></tr>`,
        `<tr><td><b>الملف المالي التفصيلي</b></td><td>${blockCell(t.finance)}</td></tr>`,
        `<tr><td><b>المتطلبات الإعلامية</b></td><td>${blockCell(t.media)}</td></tr>`,
        `<tr><td><b>تصاميم الفرص التطوعية</b></td><td>${volunteerCell(t.volunteer)}</td></tr>`
      ], 'files')}
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
    <p class="note">ملف كل مستهدف مرفوع داخل النظام أو مُدرج رابطه في الخانة المخصصة، أو مكتوب «لا يتطلب».</p>
    <section class="sec"><h2><span class="n">1</span>المستهدفات المخطط تنفيذها خلال فترة الخطة</h2>${summary}</section>
    ${timeline ? `<section class="sec"><h2><span class="n">2</span>الجدول الزمني لمراحل التنفيذ</h2>${timeline}</section>` : ''}
    <section class="sec"><h2><span class="n">${timeline ? 3 : 2}</span>تفاصيل المستهدفات</h2>${detail || '<p class="nil">لا توجد مستهدفات.</p>'}</section>
    <section class="sec"><h2><span class="n">${timeline ? 4 : 3}</span>الرفع والمراجعة والاعتماد</h2>${approval}
      <div class="done"><span>اكتمال الخطة</span><b>${pct}%</b><div class="bar"><i style="width:${pct}%"></i></div></div>
    </section>
    <div class="foot"><span>فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية</span><span>إعداد وتطوير النموذج والمنهجية: م. نوف عبدالله البوعبيد</span></div>
  </div>
</div></body></html>`;
};

module.exports = { renderPlanDocument, fmtPlanNo, periodLabel, monthName, MONTHS, QUARTERS };
