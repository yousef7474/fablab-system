// Printable pages of the kit's attachment forms (data.forms — see
// client/src/components/TrainingKits/kitForms.js): the pre / post tests
// (participant sheet or trainer key), the scientific content, the student
// guide, the reference guide, the rubric and the satisfaction survey.
// Used by trainingKitDoc.js for the appendix of the kit document, for the
// standalone pages (?part=) and for the ZIP.

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== '');
const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
const multiline = (v) => esc(v).replace(/\n/g, '<br>');
const dash = (v) => (has(v) ? multiline(v) : '<span class="nil">—</span>');
const arr = (v) => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []);
const ids = (v) => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const fmtNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
// Arabic number agreement: [one, two, 3–10, 11+]
const arN = (n, f) => {
  n = +n;
  if (n === 1) return f[0];
  if (n === 2) return f[1];
  const m = Math.floor(n) % 100;
  return `${fmtNum(n)} ${Number.isInteger(n) && m >= 3 && m <= 10 ? f[2] : f[3]}`;
};
const QS = ['سؤال واحد', 'سؤالان', 'أسئلة', 'سؤالًا'];
const MARKS = ['درجة واحدة', 'درجتان', 'درجات', 'درجة'];
const CRITERIA = ['معيار واحد', 'معياران', 'معايير', 'معيارًا'];
const CONCEPTS = ['مفهوم واحد', 'مفهومان', 'مفاهيم', 'مفهومًا'];
const PARTS = ['قطعة أو أداة واحدة', 'قطعتان أو أداتان', 'قطع وأدوات', 'قطعة وأداة'];
const APPS = ['تطبيق واحد', 'تطبيقان', 'تطبيقات', 'تطبيقًا'];
const STATEMENTS = ['عبارة واحدة', 'عبارتان', 'عبارات', 'عبارة'];
const OPEN_QS = ['سؤال مفتوح واحد', 'سؤالان مفتوحان', 'أسئلة مفتوحة', 'سؤالًا مفتوحًا'];
const REFS = ['مرجع واحد', 'مرجعان', 'مراجع', 'مرجعًا'];
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(String(d).length <= 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(x);
};
const lines = (t) => String(t || '').split('\n').map(x => x.replace(/^\s*(\d+[.)-]|[-•*])\s*/, '').trim()).filter(Boolean);

const FORMS = [
  { key: 'preTest', label: 'الاختبار القبلي', test: true },
  { key: 'postTest', label: 'الاختبار البعدي', test: true },
  { key: 'content', label: 'المحتوى العلمي التدريبي' },
  { key: 'guide', label: 'دليل الطالب' },
  { key: 'reference', label: 'الدليل العلمي المرجعي للطالب' },
  { key: 'rubric', label: 'نموذج تقييم التطبيقات والمخرجات' },
  { key: 'survey', label: 'استبانة رضا المستفيد' }
];
const FORM_META = Object.fromEntries(FORMS.map(f => [f.key, f]));
const FORM_OF = Object.fromEntries(FORMS.map(f => [f.label, f.key]));
const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];
const Q_TYPE = { mcq: 'اختيار من متعدد', tf: 'صح أو خطأ', short: 'إجابة قصيرة', practical: 'مهمة عملية' };
const LIKERT = ['موافق بشدة', 'موافق', 'محايد', 'غير موافق', 'غير موافق بشدة'];
const TECH = ['منتج مصنّع', 'دائرة إلكترونية', 'برنامج أو كود', 'تصميم رقمي'];

// ─────────────── What's filled ───────────────

const formOf = (data, key) => obj(obj(data).forms)[key];

const started = (key, f) => {
  if (!f || typeof f !== 'object') return false;
  switch (key) {
    case 'preTest': case 'postTest': return arr(f.questions).some(q => has(q.text)) || has(f.duration);
    case 'content': return Object.values(obj(f.days)).some(d => Object.entries(obj(d)).some(([k, v]) => (k === 'images' ? arr(v).length > 0 : has(v)))) || Object.values(obj(f.outputs)).some(o => has(obj(o).criteria)) || arr(f.refs).some(r => has(r.source) || has(r.ref));
    case 'guide': return ['dateFrom', 'attendance', 'location', 'phone', 'welcome', 'aboutProgram', 'goals'].some(k => has(f[k])) || has(obj(f.finalOutput).name) || arr(f.schedule).some(r => has(r.day) || has(r.activities));
    case 'reference': return arr(f.concepts).some(x => has(x.term)) || arr(f.parts).some(x => has(x.name)) || arr(f.steps).some(x => has(x.title)) || has(f.intro);
    case 'rubric': return arr(f.items).length > 0 || has(f.passMark);
    case 'survey': return has(f.method) || has(f.timing) || has(f.target);
    default: return false;
  }
};

const filledForms = (data) => FORMS.filter(f => started(f.key, formOf(data, f.key)));

const testTotal = (t) => arr(t.questions).reduce((a, q) => a + (num(q.marks) || 0), 0);
const rubricTotal = (r) => arr(r.items).reduce((a, x) => a + (num(x.marks) || 0), 0);

// One line for the attachments table of the kit document.
const summaryOf = (data, key) => {
  const f = formOf(data, key);
  if (!started(key, f)) return null;
  const d = obj(data);
  switch (key) {
    case 'preTest': case 'postTest': {
      const n = arr(f.questions).filter(q => has(q.text)).length;
      return [arN(n, QS), arN(testTotal(f), MARKS), has(f.duration) ? `${esc(f.duration)} دقيقة` : ''].filter(Boolean).join(' · ');
    }
    case 'content': {
      const days = arr(d.plan);
      const filled = days.filter(p => has(obj(obj(f.days)[p.id]).explanation)).length;
      return `المحتوى العلمي لـ ${filled} من ${days.length} أيام · ${arN(arr(f.refs).filter(r => has(r.source)).length, REFS)}`;
    }
    case 'guide': return `دليل المشارك: بيانات التنفيذ، رحلة ${arr(d.plan).length} أيام، الجدول والتقييم والتعليمات`;
    case 'reference': return `${arN(arr(f.concepts).filter(x => has(x.term)).length, CONCEPTS)} · ${arN(arr(f.parts).filter(x => has(x.name)).length, PARTS)} · ${arN(arr(f.steps).filter(x => has(x.title)).length, APPS)}`;
    case 'rubric': return `${arN(arr(f.items).length, CRITERIA)} · ${arN(rubricTotal(f), MARKS)}${has(f.passMark) ? ` · النجاح ${esc(f.passMark)}` : ''}`;
    case 'survey': return `${arN(arr(f.axes).reduce((a, x) => a + arr(x.items).filter(i => has(i.text)).length, 0), STATEMENTS)} · ${arN(arr(f.open).filter(x => has(x.text)).length, OPEN_QS)}`;
    default: return null;
  }
};

// ─────────────── Pieces ───────────────

const row = (label, value) => `<tr><th>${label}</th><td>${value}</td></tr>`;
const kv = (rows) => `<table class="kv">${rows.join('')}</table>`;
const table = (heads, rows, cls = '') => `<table class="grid ${cls}"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}" class="nil">—</td></tr>`}</tbody></table>`;
const h3 = (t) => `<h3>${t}</h3>`;
const img = (images, fileId, caption) => (images[fileId]
  ? `<figure><img src="${images[fileId]}" alt="">${caption ? `<figcaption>${esc(caption)}</figcaption>` : ''}</figure>`
  : '');

const kitFacts = (data) => {
  const d = obj(data); const c = obj(d.card);
  const objectives = arr(c.objectives);
  const outputs = arr(d.outputs);
  return {
    d, c, objectives, outputs,
    plan: arr(d.plan),
    images: arr(d.images),
    objCode: (id) => { const i = objectives.findIndex(o => o.id === id); return i < 0 ? '' : `ه${i + 1}`; },
    outCode: (id) => { const i = outputs.findIndex(o => o.id === id); return i < 0 ? '' : `م${i + 1}`; },
    outName: (id) => { const i = outputs.findIndex(o => o.id === id); return i < 0 ? '' : `م${i + 1} — ${outputs[i].name || 'مخرج بلا اسم'}`; }
  };
};

// ─────────────── Tests ───────────────

const renderTest = (key, data, { audience }) => {
  const t = obj(formOf(data, key));
  const K = kitFacts(data);
  const qs = arr(t.questions).filter(q => has(q.text));
  const total = testTotal(t);
  const trainer = audience !== 'participant';
  const head = trainer
    ? kv([
      row('عدد الأسئلة', arN(qs.length, QS)),
      row('مجموع الدرجات', arN(total, MARKS)),
      row('زمن الاختبار', has(t.duration) ? `${esc(t.duration)} دقيقة` : dash('')),
      row('درجة النجاح', dash(t.passMark))
    ])
    : `<div class="sheet-head">
        <div><span>الاسم</span><i></i></div><div><span>المجموعة</span><i></i></div><div><span>التاريخ</span><i></i></div>
        <div class="score"><span>الدرجة</span><i></i><b>/ ${fmtNum(total)}</b></div>
      </div>
      <div class="sheet-meta">${arN(qs.length, QS)} · ${has(t.duration) ? `الزمن: ${esc(t.duration)} دقيقة` : ''}</div>`;
  const instructions = has(t.instructions) ? `<div class="instructions"><b>التعليمات</b><p>${multiline(t.instructions)}</p></div>` : '';
  const body = qs.map((q, i) => {
    const opts = arr(q.options).filter(o => has(o.text));
    let answer = '';
    if (q.type === 'mcq') {
      answer = `<ol class="opts">${opts.map((o, j) => `<li class="${trainer && q.correct === o.id ? 'right' : ''}"><span class="mark">${trainer && q.correct === o.id ? '✓' : '○'}</span><b>${LETTERS[j] || j + 1})</b> ${esc(o.text)}</li>`).join('')}</ol>`;
    } else if (q.type === 'tf') {
      answer = trainer
        ? `<p class="key">الإجابة: <b>${q.correct === 'true' ? 'صح' : q.correct === 'false' ? 'خطأ' : '—'}</b></p>`
        : '<p class="tf"><span>( &nbsp; ) صح</span><span>( &nbsp; ) خطأ</span></p>';
    } else if (trainer) {
      answer = `<p class="key">${q.type === 'practical' ? 'معيار التصحيح' : 'الإجابة النموذجية'}: ${dash(q.answer)}</p>`;
    } else {
      answer = q.type === 'practical' ? '<div class="box"></div>' : '<div class="lines"><i></i><i></i><i></i></div>';
    }
    const meta = trainer
      ? `<div class="qmeta"><span>${Q_TYPE[q.type] || ''}</span>${K.objCode(q.objectiveId) ? `<span>الهدف ${K.objCode(q.objectiveId)}</span>` : ''}${has(q.measures) ? `<span>يقيس: ${esc(q.measures)}</span>` : ''}</div>`
      : '';
    return `<li class="q"><div class="qtop"><b class="qn">${i + 1}</b><div class="qtext">${multiline(q.text)}</div><span class="qmarks">${arN(num(q.marks) || 0, MARKS)}</span></div>${meta}${answer}</li>`;
  }).join('');
  const keyTable = trainer && qs.length ? `${h3('مفتاح الإجابة')}${table(['س', 'الإجابة الصحيحة', 'الدرجة', 'الهدف', 'ما يقيسه'], qs.map((q, i) => {
    const opts = arr(q.options);
    const j = opts.findIndex(o => o.id === q.correct);
    const ans = q.type === 'mcq' ? (j >= 0 ? `${LETTERS[j] || j + 1}) ${esc(opts[j].text)}` : '—') : q.type === 'tf' ? (q.correct === 'true' ? 'صح' : q.correct === 'false' ? 'خطأ' : '—') : dash(q.answer);
    return `<tr><td class="code">${i + 1}</td><td>${ans}</td><td>${esc(q.marks)}</td><td>${K.objCode(q.objectiveId) || '—'}</td><td>${dash(q.measures)}</td></tr>`;
  }))}` : '';
  return `${head}${instructions}${qs.length ? `<ol class="qs">${body}</ol>` : '<p class="nil">لا توجد أسئلة.</p>'}${keyTable}`;
};

// ─────────────── Scientific content (Excel layout) ───────────────

const renderContent = (data, { images, version }) => {
  const f = obj(formOf(data, 'content'));
  const K = kitFacts(data); const c = K.c;
  const days = obj(f.days);
  const techFiles = arr((arr(K.d.attachments).find(a => a.label === 'ملفات المخرجات التقنية') || {}).files);
  const sec1 = kv([
    row('اسم البرنامج التدريبي', dash(c.name)),
    row('المستوى', has(c.level) ? `${esc(c.level)}${has(c.sublevel) ? ` ${esc(c.sublevel)}` : ''}` : dash('')),
    row('الفئة العمرية', has(c.ageMin) || has(c.ageMax) ? `من ${esc(c.ageMin || '—')} إلى ${esc(c.ageMax || '—')} سنة` : dash('')),
    row('مدة البرنامج', num(c.days) && num(c.hours) ? `${esc(c.days)} أيام × ${esc(c.hours)} ساعات = ${fmtNum(c.days * c.hours)} ساعة` : dash('')),
    row('إعداد المحتوى العلمي', dash(c.author)),
    row('رقم الإصدار وتاريخه', has(c.version) ? `${esc(c.version)}${c.versionDate ? ` — ${esc(fmtDate(c.versionDate))}` : ''}` : dash(''))
  ]);
  const objs = K.objectives.filter(o => has(o.text));
  const sec1b = objs.length ? `<ol class="objs">${K.objectives.map((o, i) => (has(o.text) ? `<li><b>ه${i + 1}</b> ${multiline(o.text)}</li>` : '')).join('')}</ol>` : '<p class="nil">—</p>';
  const sec2 = K.plan.map((p, i) => {
    const x = obj(days[p.id]);
    const outs = ids(p.outputs).map(K.outName).filter(Boolean).map(esc).join('<br>');
    const ims = arr(x.images).map(im => img(images, im.fileId, im.caption)).join('');
    return `<div class="day"><h4>اليوم التدريبي ${i + 1}</h4>${kv([
      row('مدة اليوم', has(x.duration) ? esc(x.duration) : (num(c.hours) ? `${esc(c.hours)} ساعات` : dash(''))),
      row('ماذا سنتعلم اليوم؟', dash(p.learn)),
      row('الأهداف المرتبطة', ids(p.objectives).map(K.objCode).filter(Boolean).join('، ') || dash('')),
      row('المفاهيم والمصطلحات', dash(x.concepts)),
      row('الشرح العلمي والتقني', dash(x.explanation)),
      row('الأجهزة والبرامج والقطع المستخدمة', dash(x.tools)),
      row('التطبيق العملي أو التحدي', dash(x.challenge)),
      row('خطوات التطبيق', lines(x.steps).length ? `<ol class="steps">${lines(x.steps).map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : dash('')),
      row('نوع التنفيذ والزمن', dash(p.execution)),
      row('المخرج المتوقع', outs || dash('')),
      row('طريقة التحقق ومعيار القبول', dash(p.verify)),
      row('السلامة والأخطاء الشائعة', dash(x.safety)),
      row('الصور أو الرسومات التوضيحية', ims ? `<div class="imgs">${ims}</div>` : dash(''))
    ])}</div>`;
  }).join('') || '<p class="nil">لا توجد أيام في خطة التنفيذ.</p>';
  const techs = K.outputs.map((o, i) => ({ ...o, code: `م${i + 1}` })).filter(o => TECH.includes(o.type));
  const sec3 = techs.map(o => {
    const ims = K.images.filter(im => im.outputId === o.id).map(im => img(images, im.fileId, im.caption)).join('');
    return `<div class="day"><h4>${o.code} — ${esc(o.name || 'مخرج بلا اسم')}</h4>${kv([
      row('رقم واسم المخرج', `${o.code} — ${esc(o.name || '')}`),
      row('وصف المخرج', dash(o.desc)),
      row('معايير القبول', dash(obj(obj(f.outputs)[o.id]).criteria)),
      row('ملفات المخرج', techFiles.length ? techFiles.map(x => esc(x.name)).join('<br>') : '<span class="nil">تُرفع في مرفق «ملفات المخرجات التقنية»</span>'),
      row('الصورة المرجعية للمخرج', ims ? `<div class="imgs">${ims}</div>` : dash(''))
    ])}</div>`;
  }).join('') || '<p class="nil">لا توجد مخرجات تقنية.</p>';
  const v = obj(version);
  const sig = (name, at, ok) => (ok ? `<td>${esc(name || '—')}</td><td>${esc(fmtDate(at))}</td><td class="ok">✓ إلكترونيًا</td>` : '<td class="nil">—</td><td class="nil">—</td><td class="nil">بانتظار الاعتماد</td>');
  const sec4 = `${table(['المصدر', 'الرابط أو بيانات المرجع', 'تاريخ الاطلاع'], arr(f.refs).filter(r => has(r.source) || has(r.ref)).map(r => `<tr><td>${dash(r.source)}</td><td class="ltr">${dash(r.ref)}</td><td>${r.date ? esc(fmtDate(r.date)) : '—'}</td></tr>`))}
    ${h3('مراجعة المحتوى واعتماده')}${table(['الإجراء', 'الاسم', 'التاريخ', 'التوقيع'], [
      `<tr><td><b>إعداد المحتوى</b></td><td>${dash(c.author)}</td><td>${c.versionDate ? esc(fmtDate(c.versionDate)) : '—'}</td><td>—</td></tr>`,
      `<tr><td><b>المراجعة العلمية والتقنية</b></td>${sig(v.pmName, v.pmAt, v.pmDecision === 'approved')}</tr>`,
      `<tr><td><b>اعتماد الحقيبة</b></td>${sig(v.managerName, v.managerAt, v.managerDecision === 'approved')}</tr>`
    ])}`;
  return `${h3('1. بيانات المحتوى')}${sec1}${h3('أهداف التعلم')}${sec1b}${h3('2. المحتوى العلمي حسب الأيام')}${sec2}${h3('3. المخرج التقني المرجعي')}${sec3}${h3('4. المراجع والمصادر')}${sec4}`;
};

// ─────────────── Student guide (Excel layout) ───────────────

const renderGuide = (data, { images }) => {
  const g = obj(formOf(data, 'guide'));
  const K = kitFacts(data);
  const journey = obj(g.journey);
  const fo = obj(g.finalOutput);
  const as = obj(g.assessment);
  const dates = has(g.dateFrom) || has(g.dateTo) ? `${esc(fmtDate(g.dateFrom) || '—')} – ${esc(fmtDate(g.dateTo) || '—')}` : dash('');
  return `${h3('بيانات التنفيذ')}${kv([
    row('اسم البرنامج التدريبي', dash(K.c.name)),
    row('تاريخ البرنامج', dates),
    row('أيام وساعات الحضور', dash(g.attendance)),
    row('موقع التنفيذ والقاعة', dash(g.location)),
    row('رقم التواصل', has(g.phone) ? `<span class="ltr">${esc(g.phone)}</span>` : dash('')),
    ...(has(g.link) ? [row('رابط الموقع أو رمز الوصول', `<span class="ltr">${esc(g.link)}</span>`)] : [])
  ])}
  ${has(g.welcome) ? `${h3('أهلًا بك')}<div class="welcome">${multiline(g.welcome)}</div>` : ''}
  ${h3('التعريف بالبرنامج')}${kv([row('نبذة عن فاب لاب الأحساء', dash(g.aboutLab)), row('نبذة عن البرنامج', dash(g.aboutProgram)), row('أهداف البرنامج', dash(g.goals))])}
  ${h3('ماذا ستتعلم وتصنع؟')}${table(['سأتعلم', 'سأنفذ أو أصنع'], arr(g.learnMake).filter(r => has(r.learn) || has(r.make)).map(r => `<tr><td>${dash(r.learn)}</td><td>${dash(r.make)}</td></tr>`))}
  ${h3('رحلتي في البرنامج')}<p class="muted">من أين أبدأ، وما الذي أعمل عليه كل يوم، وإلى أي مخرج أصل.</p>${table(['اليوم', 'ماذا سأتعلم؟', 'ماذا سأطبق؟', 'مخرج اليوم'], K.plan.map((p, i) => { const j = obj(journey[p.id]); return `<tr><td class="code">${i + 1}</td><td>${dash(j.learn)}</td><td>${dash(j.apply)}</td><td>${dash(j.output)}</td></tr>`; }))}
  ${h3('المخرج النهائي')}${kv([row('اسم المخرج', dash(fo.name)), row('وصفه', dash(fo.desc)), ...(fo.imageFileId && images[fo.imageFileId] ? [row('صورته', `<div class="imgs one">${img(images, fo.imageFileId, '')}</div>`)] : [])])}
  ${h3('الجدول')}${table(['اليوم والتاريخ', 'وقت الحضور', 'وقت الانصراف', 'الجلسات والأنشطة'], arr(g.schedule).filter(r => has(r.day) || has(r.activities)).map(r => `<tr><td>${dash(r.day)}</td><td class="ltr">${dash(r.from)}</td><td class="ltr">${dash(r.to)}</td><td>${dash(r.activities)}</td></tr>`))}
  ${h3('كيف يتم تقييم مشاركتي؟')}${kv([row('الاختبار القبلي والبعدي', dash(as.tests)), row('التطبيقات العملية', dash(as.practice)), row('المخرج النهائي', dash(as.final)), row('الحضور والشهادة', dash(as.attendance))])}
  ${h3('ما الذي أحتاج إلى إحضاره؟')}${table(['المتطلب', 'ملاحظة'], arr(g.bring).filter(r => has(r.item)).map(r => `<tr><td>${dash(r.item)}</td><td>${dash(r.note)}</td></tr>`))}
  ${h3('تعليمات المشاركة والسلامة')}${table(['المجال', 'التعليمات'], arr(g.rules).map(r => `<tr><td><b>${esc(r.domain)}</b></td><td>${dash(r.text)}</td></tr>`))}
  ${h3('فريق البرنامج والتواصل')}${table(['الدور', 'الاسم', 'وسيلة التواصل عند الحاجة'], arr(g.team).filter(t => has(t.name) || has(t.contact)).map(t => `<tr><td><b>${esc(t.role)}</b></td><td>${dash(t.name)}</td><td class="ltr">${dash(t.contact)}</td></tr>`))}`;
};

// ─────────────── Reference guide ───────────────

const renderReference = (data) => {
  const r = obj(formOf(data, 'reference'));
  const K = kitFacts(data);
  const steps = arr(r.steps).filter(x => has(x.title) || has(x.steps));
  return `${has(r.intro) ? `<p class="intro">${multiline(r.intro)}</p>` : ''}
  ${h3('المفاهيم الأساسية')}${table(['المفهوم', 'الشرح المختصر'], arr(r.concepts).filter(x => has(x.term)).map(x => `<tr><td><b>${esc(x.term)}</b></td><td>${dash(x.meaning)}</td></tr>`))}
  ${arr(r.commands).some(x => has(x.cmd)) ? `${h3('الأوامر والأكواد والاختصارات')}${table(['الأمر أو الكود', 'الاستخدام', 'مثال'], arr(r.commands).filter(x => has(x.cmd)).map(x => `<tr><td class="ltr mono">${esc(x.cmd)}</td><td>${dash(x.use)}</td><td>${dash(x.example)}</td></tr>`))}` : ''}
  ${h3('القطع والأدوات')}${table(['القطعة أو الأداة', 'وظيفتها', 'ملاحظات الاستخدام'], arr(r.parts).filter(x => has(x.name)).map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${dash(x.function)}</td><td>${dash(x.note)}</td></tr>`))}
  ${h3('خطوات إعادة التطبيق')}${steps.map((x, i) => `<div class="day"><h4>${i + 1}. ${esc(x.title || '')}${K.outCode(x.outputId) ? ` <small>(${K.outCode(x.outputId)})</small>` : ''}</h4>
    ${lines(x.steps).length ? `<ol class="steps">${lines(x.steps).map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="nil">—</p>'}
    ${has(x.tips) ? `<div class="tips"><b>نصائح وأخطاء شائعة</b>${multiline(x.tips)}</div>` : ''}</div>`).join('') || '<p class="nil">—</p>'}
  ${arr(r.sources).some(x => has(x.title)) ? `${h3('مصادر للاستزادة')}${table(['المصدر', 'الرابط'], arr(r.sources).filter(x => has(x.title)).map(x => `<tr><td>${esc(x.title)}</td><td class="ltr">${dash(x.link)}</td></tr>`))}` : ''}`;
};

// ─────────────── Rubric ───────────────

const renderRubric = (data) => {
  const r = obj(formOf(data, 'rubric'));
  const K = kitFacts(data);
  const items = arr(r.items);
  const total = rubricTotal(r);
  const groups = [...K.outputs.map(o => ({ title: K.outName(o.id), items: items.filter(x => x.outputId === o.id) })), { title: 'تطبيقات أخرى', items: items.filter(x => !x.outputId || !K.outCode(x.outputId)) }].filter(gr => gr.items.length);
  const rows = groups.flatMap(gr => gr.items.map((x, j) => `<tr>${j === 0 ? `<td rowspan="${gr.items.length}"><b>${esc(gr.title === 'تطبيقات أخرى' ? (x.target || gr.title) : gr.title)}</b></td>` : ''}<td><b>${dash(x.criterion)}</b></td><td class="code">${esc(x.marks)}</td><td>${dash(x.excellent)}</td><td>${dash(x.good)}</td><td>${dash(x.weak)}</td><td class="blank"></td></tr>`));
  return `${kv([row('مجموع الدرجات', arN(total, MARKS)), row('درجة النجاح', dash(r.passMark)), row('اسم المشارك / الفريق', '<span class="fill"></span>')])}
  ${table(['المخرج أو التطبيق', 'المعيار', 'الدرجة', 'ممتاز', 'جيد', 'يحتاج تحسين', 'الدرجة المستحقة'], rows, 'rubric')}
  ${has(r.notes) ? `<div class="tips"><b>ملاحظات للمقيِّم</b>${multiline(r.notes)}</div>` : ''}`;
};

// ─────────────── Survey ───────────────

const renderSurvey = (data, { internal }) => {
  const v = obj(formOf(data, 'survey'));
  const K = kitFacts(data);
  const head = internal ? kv([row('طريقة التطبيق', dash(v.method)), row('موعد التطبيق', dash(v.timing)), row('نسبة الرضا المستهدفة', dash(v.target))]) : '';
  let n = 0;
  const axes = arr(v.axes).map(a => {
    const its = arr(a.items).filter(x => has(x.text));
    if (!its.length) return '';
    return `<tr class="axis"><td colspan="${LIKERT.length + 1}">${esc(a.title)}</td></tr>${its.map(x => { n++; return `<tr><td><b class="mono">${n}</b> ${esc(x.text)}</td>${LIKERT.map(() => '<td class="lk">○</td>').join('')}</tr>`; }).join('')}`;
  }).join('');
  return `${head}<p class="intro">نشكر مشاركتك في برنامج «${esc(K.c.name || '')}». رأيك يساعدنا على تطوير برامج فاب لاب الأحساء — ضع علامة في الخانة التي تعبّر عن رأيك.</p>
  <table class="grid likert"><thead><tr><th>العبارة</th>${LIKERT.map(l => `<th>${l}</th>`).join('')}</tr></thead><tbody>${axes || `<tr><td colspan="${LIKERT.length + 1}" class="nil">—</td></tr>`}</tbody></table>
  ${arr(v.open).filter(x => has(x.text)).map((x, i) => `<div class="open"><b>${i + 1}. ${esc(x.text)}</b><div class="lines"><i></i><i></i></div></div>`).join('')}`;
};

// ─────────────── Entry points ───────────────

/**
 * HTML body of one form. audience: tests → 'participant' (sheet without
 * answers) or anything else (trainer key). internal = reviewers' view.
 */
const renderFormBody = (key, data, { images = {}, version = null, audience = null, internal = true } = {}) => {
  switch (key) {
    case 'preTest': case 'postTest': return renderTest(key, data, { audience });
    case 'content': return renderContent(data, { images, version });
    case 'guide': return renderGuide(data, { images });
    case 'reference': return renderReference(data);
    case 'rubric': return renderRubric(data);
    case 'survey': return renderSurvey(data, { internal });
    default: return null;
  }
};

// Extra print CSS for the form pages / appendix.
const FORM_CSS = `
  .appx{break-before:page;page-break-before:always}
  .appx-title{display:flex;align-items:center;gap:10px;font-size:18px;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #0e7490}
  .appx-title .n{display:inline-grid;place-items:center;min-width:34px;height:30px;padding:0 6px;border-radius:8px;background:#0e7490;color:#fff;font-size:13px}
  h4{font-size:13.5px;margin:12px 0 6px;color:#0f172a}
  .day{margin:0 0 12px;break-inside:auto}
  ol.steps{margin:0;padding-inline-start:20px}ol.steps li{margin:2px 0}
  .ltr{direction:ltr;unicode-bidi:isolate;text-align:start}
  .mono{font-family:'JetBrains Mono',monospace}
  .muted{color:#64748b;margin:0 0 6px}
  .intro,.welcome{padding:10px 12px;border-radius:8px;background:#f8fafc;border:1px solid #e5e9f0;margin:0 0 10px}
  .welcome{background:#fdf2f2;border-color:#f1d5d5}
  .tips{margin-top:8px;padding:8px 12px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a}.tips b{display:block;color:#92400e}
  .instructions{margin:10px 0;padding:10px 12px;border-radius:8px;background:#f8fafc;border:1px solid #e5e9f0}.instructions p{margin:4px 0 0}
  ol.qs{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:10px}
  li.q{padding:10px 12px;border:1px solid #e5e9f0;border-radius:10px;break-inside:avoid}
  .qtop{display:flex;gap:10px;align-items:flex-start}
  .qn{flex:none;display:inline-grid;place-items:center;width:26px;height:26px;border-radius:7px;background:#1e293b;color:#fff;font-family:'JetBrains Mono',monospace;font-size:12px}
  .qtext{flex:1;font-weight:600}
  .qmarks{flex:none;font-size:12px;color:#64748b;white-space:nowrap}
  .qmeta{display:flex;flex-wrap:wrap;gap:6px;margin:6px 36px 0 0}.qmeta span{font-size:11.5px;padding:1px 8px;border-radius:5px;background:#f1f5f9;color:#475569}
  ol.opts{list-style:none;margin:8px 36px 0 0;padding:0;display:grid;gap:4px}
  ol.opts li{display:flex;gap:6px;align-items:baseline}ol.opts .mark{color:#94a3b8}
  ol.opts li.right{color:#15803d;font-weight:700}ol.opts li.right .mark{color:#15803d}
  .key{margin:8px 36px 0 0;color:#15803d}
  .tf{display:flex;gap:28px;margin:8px 36px 0 0}
  .lines{margin:8px 36px 0 0;display:grid;gap:18px}.lines i{display:block;border-bottom:1px dotted #94a3b8;height:1px}
  .box{margin:8px 36px 0 0;height:90px;border:1px dashed #94a3b8;border-radius:8px}
  .sheet-head{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;margin:6px 0 4px}
  .sheet-head div{display:flex;align-items:flex-end;gap:6px;font-size:12.5px;color:#475569}
  .sheet-head i{flex:1;border-bottom:1px solid #94a3b8;height:18px}.sheet-head b{white-space:nowrap}
  .sheet-meta{font-size:12px;color:#64748b}
  table.grid td.blank{min-width:70px}
  .fill{display:inline-block;min-width:220px;border-bottom:1px solid #94a3b8;height:16px}
  table.likert th{text-align:center;font-size:11.5px}table.likert th:first-child{text-align:start}
  table.likert td.lk{text-align:center;color:#94a3b8;width:62px}
  table.likert tr.axis td{background:#fdf2f2!important;color:#7f1d1d;font-weight:700}
  .open{margin-top:12px}.open .lines{margin-right:0}
  .imgs.one{grid-template-columns:minmax(0,280px)}
  @media print{li.q,.open{break-inside:avoid}.appx-title .n,table.likert tr.axis td,.qn{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;

// The form pages that go into the ZIP: [{ key, audience, file }].
const partsOf = (data) => filledForms(data).flatMap(f => (f.test
  ? [{ key: f.key, audience: 'participant', file: `${f.label} - نسخة المشارك` }, { key: f.key, audience: 'trainer', file: `${f.label} - نسخة المدرب (مفتاح الإجابة)` }]
  : [{ key: f.key, audience: null, file: f.label }]));

module.exports = { FORMS, FORM_META, FORM_OF, FORM_CSS, filledForms, summaryOf, renderFormBody, partsOf, started };
