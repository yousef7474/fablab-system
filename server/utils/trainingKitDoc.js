// Printable document of a training kit version — the same sections as
// the kit template (بطاقة البرنامج، المخرجات، خطة التنفيذ، الاحتياجات،
// المرفقات، الاعتماد، الاكتمال). Used for the reviewers' view, printing
// and the "download everything" ZIP, so it embeds the logos and images.
const fs = require('fs');
const path = require('path');
const { FORM_META, FORM_OF, FORM_CSS, filledForms, summaryOf, renderFormBody, partsOf } = require('./trainingKitForms');

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== '');
const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const fmt = (n) => NF.format(n);
// Arabic number agreement: [one, two, 3–10, 11+]
const DAYS = ['يوم واحد', 'يومان', 'أيام', 'يومًا'];
const HOURS = ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة'];
const GROUPS = ['مجموعة واحدة', 'مجموعتان', 'مجموعات', 'مجموعة'];
const PEOPLE = ['مشارك واحد', 'مشاركان', 'مشاركين', 'مشاركًا'];
const ar = (n, f) => {
  n = +n;
  if (n === 1) return f[0];
  if (n === 2) return f[1];
  const m = Math.floor(n) % 100;
  return `${fmt(n)} ${Number.isInteger(n) && m >= 3 && m <= 10 ? f[2] : f[3]}`;
};
const multiline = (v) => esc(v).replace(/\n/g, '<br>');
const dash = (v) => (has(v) ? multiline(v) : '<span class="nil">—</span>');
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(String(d).length <= 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(x);
};
const humanSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

const ATTACH_DESC = {
  'الاختبار القبلي': 'الأسئلة والدرجات ومفاتيح الإجابة وما يقيسه كل سؤال وربطه بالأهداف.',
  'الاختبار البعدي': 'الأسئلة والدرجات ومفاتيح الإجابة وما يقيسه كل سؤال وربطه بالأهداف.',
  'المحتوى العلمي التدريبي': 'بيانات الإعداد والإصدار والأهداف والمحتوى حسب الأيام والتطبيقات والصور والمصادر والاعتماد.',
  'العرض التقديمي': 'نسخة بصرية مختصرة ومتطابقة مع المحتوى العلمي وخطة التنفيذ.',
  'ملفات المخرجات التقنية': 'التصاميم والأكواد والتطبيقات وملفات التشغيل والتصنيع النهائية المجربة.',
  'دليل الطالب': 'التعريف بالبرنامج ورحلة المشارك والمخرجات والجدول والتقييم والتعليمات والسلامة.',
  'الدليل العلمي المرجعي للطالب': 'ملخص أهم المفاهيم والأوامر والقطع وخطوات إعادة التطبيق.',
  'نموذج تقييم التطبيقات والمخرجات': 'معايير تقييم التطبيقات وعمل المخرج وجودته وسلامته ومطابقته.',
  'استبانة رضا المستفيد': 'النموذج المستخدم لقياس رضا المشاركين عن المحتوى والمدرب والتنظيم والتجربة.'
};
const BASIS = { person: 'للفرد', group: 'للمجموعة', fixed: 'للبرنامج' };

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

const fmtKitNo = (n) => (n == null ? 'TK-—' : `TK-${String(n).padStart(3, '0')}`);

const STATUS_AR = {
  draft: 'مسودة',
  pm_review: 'لدى مسؤول إدارة المشاريع',
  manager_review: 'لدى المدير للاعتماد',
  returned: 'معادة للتعديل',
  approved: 'معتمدة'
};

const DOC_CSS = `
  *{box-sizing:border-box}
  body{margin:0;background:#eef1f5;color:#0f172a;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;font-size:13.5px;line-height:1.7}
  .page{max-width:980px;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.08)}
  .band{background:linear-gradient(135deg,#1a0a0b,#3a0d10 60%,#EE2329);color:#fff;padding:22px 28px 26px;position:relative;overflow:hidden}
  .band::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:24px 24px;pointer-events:none}
  .band .top{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
  .band .logos{display:flex;gap:14px;align-items:center}.band .logos img{height:40px;filter:brightness(0) invert(1)}
  .band .meta{font-family:'JetBrains Mono',monospace;font-size:12px;text-align:left;opacity:.9;line-height:1.6}
  .band h1{position:relative;margin:18px 0 6px;font-size:28px;line-height:1.3}
  .band p.desc{position:relative;margin:0;max-width:70ch;opacity:.85}
  .band ul{position:relative;list-style:none;margin:14px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
  .band li{font-size:12px;padding:2px 10px;border:1px solid rgba(255,255,255,.3);border-radius:6px;background:rgba(255,255,255,.06)}
  .stamp{position:relative;display:inline-block;margin-top:12px;padding:3px 12px;border-radius:999px;background:#fff;color:#b91c1c;font-weight:700;font-size:12px}
  .body{padding:8px 28px 28px}
  .sec{margin-top:22px;break-inside:auto}
  h2{display:flex;align-items:center;gap:10px;font-size:18px;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #EE2329}
  h2 .n{display:inline-grid;place-items:center;min-width:30px;height:30px;border-radius:8px;background:#EE2329;color:#fff;font-family:'JetBrains Mono',monospace;font-size:14px}
  h3{font-size:14.5px;margin:16px 0 8px;color:#7f1d1d}
  h3 small{font-weight:400;color:#64748b;font-size:12px}
  table{width:100%;border-collapse:collapse;margin:0 0 6px}
  table.kv th{width:200px;text-align:start;vertical-align:top;background:#fdf2f2;color:#7f1d1d;font-weight:600;padding:7px 10px;border:1px solid #f1d5d5}
  table.kv td{padding:7px 10px;border:1px solid #eceff3;vertical-align:top}
  table.grid th{background:#1e293b;color:#fff;font-weight:600;font-size:12.5px;padding:7px 8px;text-align:start;border:1px solid #1e293b}
  table.grid td{padding:7px 8px;border:1px solid #e5e9f0;vertical-align:top}
  table.grid tbody tr:nth-child(even) td{background:#f8fafc}
  td.code{font-family:'JetBrains Mono',monospace;font-weight:700;color:#b91c1c;white-space:nowrap}
  td.muted{color:#64748b;font-size:12.5px}
  td.ok{color:#15803d;font-weight:700}
  small{color:#64748b}
  .nil{color:#94a3b8}
  ol.objs{margin:0;padding:0;list-style:none;display:grid;gap:6px}
  ol.objs li{padding:7px 10px;border:1px solid #eceff3;border-radius:8px}
  ol.objs b{display:inline-block;min-width:34px;color:#b91c1c;font-family:'JetBrains Mono',monospace}
  .imgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
  .imgs figure{margin:0;border:1px solid #e5e9f0;border-radius:10px;overflow:hidden}
  .imgs img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#f8fafc}
  .imgs figcaption{padding:6px 10px;font-size:12.5px}
  .noimg{aspect-ratio:4/3;display:grid;place-items:center;color:#94a3b8;background:#f8fafc}
  .file{font-size:12.5px}
  .done{display:flex;align-items:center;gap:14px}.done b{font-size:26px;font-family:'JetBrains Mono',monospace}
  .bar{flex:1;height:8px;border-radius:4px;background:#e5e9f0;overflow:hidden}.bar i{display:block;height:100%;background:#EE2329}
  ul.checks{list-style:none;padding:0;margin:10px 0 0}ul.checks li{padding:4px 0;color:#64748b}ul.checks li.ok{color:#15803d}
  .foot{margin-top:26px;padding-top:10px;border-top:1px solid #e5e9f0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11.5px;color:#64748b}
  @media print{body{background:#fff}.page{box-shadow:none;max-width:none}.band{-webkit-print-color-adjust:exact;print-color-adjust:exact}table.grid th,h2 .n,table.kv th,.bar i{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr,figure{break-inside:avoid}}
  @page{size:A4;margin:12mm}
  .formref{margin-bottom:4px}
${FORM_CSS}`;

/**
 * @param {object} o
 *   kit      — TrainingKit row (kitNumber, status, …)
 *   version  — TrainingKitVersion row being shown (or null for the draft)
 *   data     — kit data to render
 *   author   — { name }
 *   images   — { [fileId]: dataUrl }
 *   files    — { [fileId]: { name, size } }
 */
const renderKitDocument = ({ kit, version, data, author, images = {}, files = {} }) => {
  const d = data || {};
  const c = d.card || {};
  const objectives = (c.objectives || []).filter(o => has(o.text));
  const outputs = d.outputs || [];
  const objCode = (id) => { const i = (c.objectives || []).findIndex(o => o.id === id); return i < 0 ? '' : `ه${i + 1}`; };
  const outCode = (id) => { const i = outputs.findIndex(o => o.id === id); return i < 0 ? '' : `م${i + 1}`; };
  const outLabel = (id) => { const i = outputs.findIndex(o => o.id === id); return i < 0 ? '—' : `م${i + 1} — ${esc(outputs[i].name || 'مخرج بلا اسم')}`; };

  const days = num(c.days); const hours = num(c.hours);
  const pmin = num(c.partMin); const pmax = num(c.partMax); const gs = num(c.groupSize);
  const groups = (p) => (gs && p ? Math.ceil(p / gs) : null);
  const cp = num(c.costPerson) || 0; const cg = num(c.costGroup) || 0;
  const cost = (p) => (p == null || (cg && !gs) ? null : cp * p + cg * (groups(p) || 0));
  const gmax = groups(pmax);
  const needTotal = (x) => {
    const q = num(x.qty);
    if (q == null) return null;
    if (x.basis === 'fixed') return q;
    if (x.basis === 'group') return gmax != null ? q * gmax : null;
    return pmax != null ? q * pmax : null;
  };

  const row = (label, value) => `<tr><th>${label}</th><td>${value}</td></tr>`;
  const table = (heads, rows, cls = '') => `<table class="grid ${cls}"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}" class="nil">—</td></tr>`}</tbody></table>`;
  const section = (n, title, body) => `<section class="sec"><h2><span class="n">${n}</span>${title}</h2>${body}</section>`;

  const level = [c.level, has(c.sublevel) ? `(المستوى ${esc(c.sublevel)})` : ''].filter(Boolean).join(' ');
  const card = `
    <table class="kv">
      ${row('اسم البرنامج التدريبي', dash(c.name))}
      ${row('وصف البرنامج التدريبي', dash(c.description))}
      ${row('نوع البرنامج', dash(c.type))}
      ${row('المستوى', has(level) ? esc(level) : dash(''))}
      ${row('نوع التطبيق العملي', dash(c.practical))}
      ${row('آلية تقديم البرنامج', dash(c.delivery))}
      ${row('لغة البرنامج', dash(c.language))}
      ${row('المجال الأساسي', dash(c.primaryDomain))}
      ${row('المجالات المساندة', (c.supportDomains || []).length ? (c.supportDomains || []).map(esc).join(' • ') : dash(''))}
      ${row('الأجهزة والبرامج', (c.tools || []).length ? (c.tools || []).map(esc).join(' • ') : dash(''))}
      ${row('الفئة المستهدفة', dash(c.target))}
      ${row('الفئة العمرية', has(c.ageMin) || has(c.ageMax) ? `من ${esc(c.ageMin || '—')} إلى ${esc(c.ageMax || '—')} سنة` : dash(''))}
      ${row('عدد المشاركين', has(c.partMin) || has(c.partMax) ? `${esc(c.partMin || '—')} – ${esc(c.partMax || '—')} مشاركًا${has(c.partNote) ? `<br><small>${esc(c.partNote)}</small>` : ''}` : dash(''))}
      ${row('تقسيم المشاركين', gs || has(c.groupNote) ? `${gs ? `${esc(gs)} مشاركين في كل مجموعة${pmax ? ` — ${ar(groups(pmax), GROUPS)} عند الحد الأعلى` : ''}` : ''}${has(c.groupNote) ? `${gs ? '<br>' : ''}<small>${esc(c.groupNote)}</small>` : ''}` : dash(''))}
      ${row('المدة', days && hours ? `${ar(days, DAYS)} × ${ar(hours, HOURS)} يوميًا = ${ar(days * hours, HOURS)} تدريبية` : dash(''))}
      ${row('شروط الالتحاق', dash(c.prereq))}
      ${row('تكلفة المستهلكات', cp || cg ? `${cp ? `${fmt(cp)} ر.س لكل مشارك` : ''}${cp && cg ? ' + ' : ''}${cg ? `${fmt(cg)} ر.س لكل مجموعة` : ''}
        ${cost(pmin) != null ? `<br><small>الإجمالي عند الحد الأدنى: ${fmt(cost(pmin))} ر.س</small>` : ''}
        ${cost(pmax) != null ? `<br><small>الإجمالي عند الحد الأعلى: ${fmt(cost(pmax))} ر.س</small>` : ''}${has(c.costNote) ? `<br><small>${multiline(c.costNote)}</small>` : ''}` : (has(c.costNote) ? multiline(c.costNote) : dash('')))}
      ${row('تكلفة تأسيسية غير متكررة', dash(c.setup))}
      ${row('اعتبارات أخرى', dash(c.other))}
      ${row('مُعدّ المحتوى العلمي', dash(c.author))}
      ${row('رقم الإصدار وتاريخ التحديث', has(c.version) || has(c.versionDate) ? `${esc(c.version || '—')}${c.versionDate ? ` — ${esc(fmtDate(c.versionDate))}` : ''}` : dash(''))}
    </table>
    <h3>أهداف البرنامج</h3>
    ${objectives.length ? `<ol class="objs">${(c.objectives || []).map((o, i) => (has(o.text) ? `<li><b>ه${i + 1}</b> ${multiline(o.text)}</li>` : '')).join('')}</ol>` : '<p class="nil">—</p>'}`;

  const imgs = (d.images || []).filter(im => im.fileId);
  const sec2 = `
    ${table(['رقم', 'اسم المخرج', 'النوع', 'الوصف المختصر', 'العدد', 'الملكية'], outputs.map((o, i) => `<tr><td class="code">م${i + 1}</td><td>${dash(o.name)}</td><td>${dash(o.type)}</td><td>${dash(o.desc)}</td><td>${dash(o.count)}</td><td>${dash(o.owner)}</td></tr>`))}
    <h3>قياس تحقق المخرجات</h3>
    ${table(['رقم واسم المخرج', 'ما الذي سنقيسه؟', 'النتيجة المطلوبة', 'كيف نثبت تحققها؟'], (d.measures || []).map(m => `<tr><td>${outLabel(m.outputId)}</td><td>${dash(m.what)}</td><td>${dash(m.result)}</td><td>${dash(m.proof)}</td></tr>`))}
    <h3>الصور المرجعية للمخرجات التقنية</h3>
    ${imgs.length ? `<div class="imgs">${imgs.map(im => `<figure>${images[im.fileId] ? `<img src="${images[im.fileId]}" alt="">` : '<div class="noimg">الصورة غير متاحة</div>'}<figcaption><b>${esc(outCode(im.outputId) || '—')}</b> ${esc(im.caption || '')}</figcaption></figure>`).join('')}</div>` : '<p class="nil">لا توجد صور مرجعية.</p>'}`;

  const sec3 = table(['اليوم', 'ماذا سنتعلم اليوم؟', 'المحاور', 'الأهداف المرتبطة', 'المخرجات المرتبطة', 'التنفيذ والمدة', 'التحقق'],
    (d.plan || []).map((p, i) => `<tr><td class="code">${i + 1}</td><td>${dash(p.learn)}</td><td>${dash(p.topics)}</td><td>${(p.objectives || []).map(objCode).filter(Boolean).join('، ') || '—'}</td><td>${(p.outputs || []).map(outCode).filter(Boolean).join('، ') || '—'}</td><td>${dash(p.execution)}</td><td>${dash(p.verify)}</td></tr>`), 'plan');

  const sec4 = `
    <h3>الموارد البشرية</h3>
    ${table(['المورد البشري', 'العدد', 'الخبرة أو الشروط المطلوبة', 'المهام'], (d.staff || []).map(s => `<tr><td><b>${dash(s.role)}</b></td><td>${dash(s.count)}</td><td>${dash(s.expertise)}</td><td>${dash(s.tasks)}</td></tr>`))}
    <h3>الاحتياجات المادية والتقنية${pmax != null ? ` <small>— تُحسب الكميات على ${ar(pmax, PEOPLE)}${gmax ? ` في ${ar(gmax, GROUPS)}` : ''}</small>` : ''}</h3>
    ${table(['الاحتياج', 'المواصفات', 'الوحدة', 'الكمية للفرد/المجموعة', 'الكمية الإجمالية', 'ملاحظات'], (d.needs || []).filter(x => has(x.item)).map(x => `<tr><td>${dash(x.item)}</td><td>${dash(x.specs)}</td><td>${dash(x.unit)}</td><td>${has(x.qty) ? `${esc(x.qty)} ${BASIS[x.basis] || ''}` : '—'}</td><td>${needTotal(x) != null ? `${fmt(needTotal(x))} ${esc(x.unit || '')}` : '—'}</td><td>${dash(x.notes)}</td></tr>`))}
    <h3>متطلبات الجاهزية قبل التنفيذ</h3>
    ${table(['بند الجاهزية', 'ما يجب تجهيزه أو التحقق منه', 'المدة اللازمة قبل التنفيذ'], (d.readiness || []).map(r => `<tr><td><b>${esc(r.label)}</b></td><td>${dash(r.prepare)}</td><td>${dash(r.lead)}</td></tr>`))}`;

  // Forms filled in the system go to the appendix (ملحق n); the rest are files.
  const appx = filledForms(d);
  const sec5 = table(['المرفق', 'ما يجب أن يتضمنه', 'النموذج والملفات', 'ملاحظة'], (d.attachments || []).map(a => {
    const list = (a.files || []).map(f => {
      const meta = files[f.fileId] || f;
      return `<div class="file">📎 ${esc(meta.name || f.name)} <small>${meta.size ? humanSize(meta.size) : ''}</small></div>`;
    }).join('');
    const key = FORM_OF[a.label];
    const k = key ? appx.findIndex(f => f.key === key) : -1;
    const form = !key ? '' : k >= 0
      ? `<div class="formref">📝 <b>ملحق ${k + 1}</b> — ${summaryOf(d, key)}</div>`
      : '<div class="nil">النموذج لم يُعبأ بعد</div>';
    return `<tr><td><b>${esc(a.label)}</b></td><td class="muted">${esc(ATTACH_DESC[a.label] || '')}</td><td>${form}${list || (key ? '' : '<span class="nil">لم يُرفق</span>')}</td><td>${dash(a.note)}</td></tr>`;
  }));
  const appendix = appx.map((f, i) => `<section class="sec appx"><h2 class="appx-title"><span class="n">ملحق ${i + 1}</span>${esc(f.label)}</h2>${renderFormBody(f.key, d, { images, version, audience: 'trainer', internal: true })}</section>`).join('');

  const v = version || {};
  const sig = (name, at, decision) => (decision === 'approved'
    ? `<td>${esc(name || '—')}</td><td>${esc(fmtDate(at))}</td><td class="ok">✓ معتمد إلكترونيًا</td>`
    : `<td class="nil">—</td><td class="nil">—</td><td class="nil">${decision === 'returned' ? 'أُعيدت للتعديل' : 'بانتظار المراجعة'}</td>`);
  const cert = d.cert || {};
  const sec6 = `
    ${table(['الإجراء', 'الاسم', 'التاريخ', 'الاعتماد'], [
      `<tr><td><b>المراجعة العلمية والتقنية</b> <small>(مسؤول إدارة المشاريع)</small></td>${sig(v.pmName, v.pmAt, v.pmDecision)}</tr>`,
      `<tr><td><b>اعتماد الحقيبة</b> <small>(المدير)</small></td>${sig(v.managerName, v.managerAt, v.managerDecision)}</tr>`
    ])}
    <table class="kv">${row('نوع الشهادة', dash(cert.type))}${row('معايير استحقاق الشهادة', dash(cert.criteria))}</table>`;

  const manual = d.manual || {};
  const pct = version ? (version.completion || 0) : (kit?.completion || 0);
  const sec7 = `
    <div class="done"><b>${pct}%</b><div class="bar"><i style="width:${pct}%"></i></div></div>
    <ul class="checks">
      <li class="${manual.filesTested ? 'ok' : ''}">${manual.filesTested ? '☑' : '☐'} تمت تجربة جميع الملفات المرفقة</li>
      <li class="${manual.trainerReady ? 'ok' : ''}">${manual.trainerReady ? '☑' : '☐'} يمكن لمدرب متخصص تنفيذ البرنامج من الحقيبة مباشرة</li>
    </ul>`;

  const chips = [c.type, c.level ? `${c.level}${has(c.sublevel) ? ` ${c.sublevel}` : ''}` : '', days && hours ? `${ar(days, DAYS)} × ${ar(hours, HOURS)}` : '',
    num(c.ageMin) != null && num(c.ageMax) != null ? `من ${c.ageMin} إلى ${c.ageMax} سنة` : '', c.delivery, c.language].filter(Boolean);
  const fablab = logo('fablab.png'); const found = logo('found.png');
  const statusText = version
    ? (v.managerDecision === 'approved' ? 'معتمدة' : v.managerDecision === 'returned' || v.pmDecision === 'returned' ? 'أُعيدت للتعديل' : v.pmDecision === 'approved' ? 'لدى المدير للاعتماد' : 'لدى مسؤول إدارة المشاريع')
    : (STATUS_AR[kit?.status] || 'مسودة');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.name || 'حقيبة تدريبية')} — ${fmtKitNo(kit?.kitNumber)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>${DOC_CSS}</style></head>
<body><div class="page">
  <header class="band">
    <div class="top">
      <div class="logos">${fablab ? `<img src="${fablab}" alt="FabLab">` : ''}${found ? `<img src="${found}" alt="">` : ''}</div>
      <div class="meta">${fmtKitNo(kit?.kitNumber)}<br>${version ? `الإصدار ${version.versionNumber}` : 'مسودة'}${version?.submittedAt ? ` · ${esc(fmtDate(version.submittedAt))}` : ''}</div>
    </div>
    <h1>${esc(c.name || 'برنامج تدريبي بلا اسم')}</h1>
    ${has(c.description) ? `<p class="desc">${multiline(c.description)}</p>` : ''}
    ${chips.length ? `<ul>${chips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <span class="stamp">${esc(statusText)}${author?.name ? ` · إعداد: ${esc(author.name)}` : ''}</span>
  </header>
  <div class="body">
    ${section('1', 'بطاقة البرنامج التدريبي', card)}
    ${section('2', 'مخرجات البرنامج وتسليماته', sec2)}
    ${section('3', 'خطة تنفيذ البرنامج', sec3)}
    ${section('4', 'الاحتياجات والموارد', sec4)}
    ${section('5', 'مرفقات الحقيبة', sec5)}
    ${section('6', 'المراجعة العلمية والاعتماد', sec6)}
    ${section('7', 'اكتمال الحقيبة', sec7)}
    ${appendix}
    <div class="foot"><span>فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية</span><span>إعداد وتطوير النماذج والمنهجية: م. نوف عبدالله البوعبيد</span></div>
  </div>
</div></body></html>`;
};

/**
 * One attachment form on its own printable page (?part=<form key>):
 * tests as the participant's sheet (audience 'participant', no answers)
 * or the trainer's key; the student guide, reference guide and survey as
 * handouts. null = no such form.
 */
const renderKitPart = ({ kit, version, data, images = {}, part, audience }) => {
  const meta = FORM_META[part];
  if (!meta) return null;
  const d = data || {};
  const c = d.card || {};
  const participant = audience === 'participant';
  const forParticipant = participant || ['guide', 'reference', 'survey'].includes(part);
  const body = renderFormBody(part, d, { images, version, audience: meta.test ? (participant ? 'participant' : 'trainer') : null, internal: !forParticipant });
  const fablab = logo('fablab.png'); const found = logo('found.png');
  const stamp = meta.test ? (participant ? 'نسخة المشارك' : 'نسخة المدرب — مفتاح الإجابة') : forParticipant ? 'للمشارك' : 'للمدرب';
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.label)} — ${esc(c.name || 'حقيبة تدريبية')}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>${DOC_CSS}
  .band.part{padding:18px 28px 20px}.band.part h1{font-size:24px;margin-top:14px}
</style></head>
<body><div class="page">
  <header class="band part">
    <div class="top">
      <div class="logos">${fablab ? `<img src="${fablab}" alt="FabLab">` : ''}${found ? `<img src="${found}" alt="">` : ''}</div>
      <div class="meta">${fmtKitNo(kit?.kitNumber)}${forParticipant ? '' : `<br>${version ? `الإصدار ${version.versionNumber}` : 'مسودة'}`}</div>
    </div>
    <h1>${esc(meta.label)}</h1>
    <p class="desc">${esc(c.name || 'برنامج تدريبي بلا اسم')}</p>
    <span class="stamp">${esc(stamp)}</span>
  </header>
  <div class="body">
    ${body}
    <div class="foot"><span>فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية</span><span>إعداد وتطوير النماذج والمنهجية: م. نوف عبدالله البوعبيد</span></div>
  </div>
</div></body></html>`;
};
// [{ key, audience, file }] — the form pages that go into the ZIP.
renderKitPart.partsOf = partsOf;

module.exports = { renderKitDocument, renderKitPart, fmtKitNo, STATUS_AR };
