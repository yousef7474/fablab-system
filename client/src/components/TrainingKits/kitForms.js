// Attachment forms (نماذج مرفقات الحقيبة) — the seven kit attachments that
// are filled inside the system instead of uploaded as Word / PDF files:
// the pre / post tests, the scientific content and the student guide (from
// the FabLab Excel sheets «البيانات الاسترشادية …»), and the reference
// guide, rubric and satisfaction survey (designed for FabLab Al-Ahsa).
//
// They live in kit.data.forms.<key>, so they travel with the kit through
// saving, versions, the change comparison, review and printing. Anything
// the kit already holds (program card, objectives ه#, plan days, outputs
// م#, images, certificate) is never typed again — the forms refer to it
// by id and show it read-only, or offer a one-click prefill.
import { uid, has, num, isTech } from './kitModel';

// ─────────────── Which attachment is which form ───────────────

export const FORMS = [
  { key: 'preTest', label: 'الاختبار القبلي', icon: '📝', test: true },
  { key: 'postTest', label: 'الاختبار البعدي', icon: '🏁', test: true },
  { key: 'content', label: 'المحتوى العلمي التدريبي', icon: '🔬' },
  { key: 'guide', label: 'دليل الطالب', icon: '🧭' },
  { key: 'reference', label: 'الدليل العلمي المرجعي للطالب', icon: '📘' },
  { key: 'rubric', label: 'نموذج تقييم التطبيقات والمخرجات', icon: '🎯' },
  { key: 'survey', label: 'استبانة رضا المستفيد', icon: '💬' }
];
export const FORM_OF = Object.fromEntries(FORMS.map(f => [f.label, f.key]));
export const FORM_META = Object.fromEntries(FORMS.map(f => [f.key, f]));

// ─────────────── Fixed lists ───────────────

export const Q_TYPES = [
  { v: 'mcq', l: 'اختيار من متعدد' },
  { v: 'tf', l: 'صح أو خطأ' },
  { v: 'short', l: 'إجابة قصيرة' },
  { v: 'practical', l: 'مهمة عملية' }
];
export const Q_TYPE_LABEL = Object.fromEntries(Q_TYPES.map(t => [t.v, t.l]));

export const RULE_DOMAINS = ['الحضور والانصراف', 'التعامل والعمل الجماعي', 'استخدام الأجهزة والبرامج', 'المحافظة على الأدوات والممتلكات', 'التصوير والخصوصية', 'السلامة داخل القاعة', 'الحالات الطارئة', 'الانضباط والسلوك'];
export const TEAM_ROLES = ['المدرب', 'المدرب المساعد', 'مسؤول البرنامج', 'الدعم التقني/الإداري'];
export const LIKERT = ['موافق بشدة', 'موافق', 'محايد', 'غير موافق', 'غير موافق بشدة'];
export const SURVEY_AXES = ['المحتوى', 'المدرب', 'التنظيم', 'التجربة والمخرجات'];
export const SURVEY_METHODS = ['ورقي', 'رابط إلكتروني', 'رمز QR'];
export const RUBRIC_LEVELS = [{ k: 'excellent', l: 'ممتاز' }, { k: 'good', l: 'جيد' }, { k: 'weak', l: 'يحتاج تحسين' }];

export const DEFAULT_ABOUT_LAB = 'فاب لاب الأحساء معمل للتصنيع الرقمي والابتكار تابع لمؤسسة عبدالمنعم الراشد الإنسانية، يضع بين يدي الطلاب والمبتكرين أدوات التصنيع الحديثة — الطباعة ثلاثية الأبعاد والقص بالليزر وCNC والإلكترونيات والبرمجة — ليحوّلوا أفكارهم إلى نماذج حقيقية. يتعلّم المشارك في برامجه بالتجربة: يصمّم ويصنع ويختبر بيده.';

const DEFAULT_RULES = {
  'الحضور والانصراف': 'الحضور قبل بداية الجلسة بخمس دقائق وتسجيل الحضور والانصراف يوميًا. يُبلَّغ مسؤول البرنامج مسبقًا عن أي غياب أو تأخر.',
  'التعامل والعمل الجماعي': 'الاحترام المتبادل والاستماع للآخرين، وتوزيع الأدوار داخل الفريق، ومساعدة الزملاء دون أداء المهمة عنهم.',
  'استخدام الأجهزة والبرامج': 'لا تُشغَّل الأجهزة إلا بعد شرح المدرب وبإذنه، مع الالتزام بالإعدادات المحددة، والإبلاغ فورًا عن أي عطل.',
  'المحافظة على الأدوات والممتلكات': 'تُعاد الأدوات إلى أماكنها بعد الاستخدام، وتُنظَّف طاولة العمل في نهاية كل جلسة، ولا تُخرَج أي قطعة من المعمل دون إذن.',
  'التصوير والخصوصية': 'قد يُصوَّر البرنامج للتوثيق، ولا تُنشر صور المشاركين إلا بموافقتهم أو موافقة أولياء أمورهم، ولا يصوّر المشارك زملاءه دون إذنهم.',
  'السلامة داخل القاعة': 'ارتداء أدوات الوقاية عند الحاجة، وعدم لمس الأجزاء الساخنة أو المتحركة في الأجهزة، والتعامل مع الأدوات الحادة بحذر، وإبقاء الممرات خالية.',
  'الحالات الطارئة': 'يُبلَّغ المدرب فورًا عن أي إصابة أو طارئ. يتعرّف المشارك في الجلسة الأولى على مخارج الطوارئ ومكان صندوق الإسعافات الأولية.',
  'الانضباط والسلوك': 'الالتزام بتعليمات المدرب، ووضع الهاتف على الصامت أثناء الشرح، وعدم تناول الطعام والشراب قرب الأجهزة.'
};

const DEFAULT_SURVEY = {
  'المحتوى': ['كان محتوى البرنامج واضحًا ومنظمًا', 'ارتبطت الأنشطة العملية بما تعلّمته', 'كان مستوى المحتوى مناسبًا لي', 'أضاف البرنامج إلى معرفتي ومهاراتي'],
  'المدرب': ['شرح المدرب المفاهيم بوضوح', 'أجاب المدرب عن الأسئلة وساعد عند الحاجة', 'أدار المدرب الوقت والأنشطة بكفاءة', 'شجّع المدرب على المشاركة والتجريب'],
  'التنظيم': ['كان التواصل قبل البرنامج وأثناءه واضحًا', 'كانت القاعة والأجهزة والمواد جاهزة', 'كان توقيت الجلسات ومدتها مناسبين', 'التزم البرنامج بالجدول المعلن'],
  'التجربة والمخرجات': ['تمكّنت من إنجاز المخرج بنفسي', 'أشعر بالقدرة على تطبيق ما تعلّمته', 'أنصح غيري بالالتحاق بالبرنامج', 'أرغب في الالتحاق ببرنامج متقدم في المجال']
};
const DEFAULT_OPEN = ['ما أكثر ما أعجبك في البرنامج؟', 'ما الذي تقترح تحسينه؟', 'ما البرامج التي تودّ أن يقدّمها فاب لاب الأحساء مستقبلًا؟'];

export const TEST_INSTRUCTIONS = {
  preTest: 'اقرأ كل سؤال بعناية وأجب عن جميع الأسئلة. في أسئلة الاختيار من متعدد اختر إجابة واحدة فقط. هذا الاختبار يقيس معرفتك قبل البرنامج ولا يؤثر على تقييمك — أجب بما تعرفه دون قلق.',
  postTest: 'اقرأ كل سؤال بعناية وأجب عن جميع الأسئلة. في أسئلة الاختيار من متعدد اختر إجابة واحدة فقط. يقيس هذا الاختبار ما تعلّمته خلال البرنامج.'
};

// ─────────────── Makers ───────────────

export const MAKE_F = {
  option: (text = '') => ({ id: uid(), text }),
  question: () => ({ id: uid(), type: 'mcq', text: '', options: [MAKE_F.option(), MAKE_F.option(), MAKE_F.option(), MAKE_F.option()], correct: '', answer: '', marks: 1, objectiveId: '', measures: '' }),
  ref: () => ({ id: uid(), source: '', ref: '', date: '' }),
  learnMake: () => ({ id: uid(), learn: '', make: '' }),
  slot: () => ({ id: uid(), day: '', from: '', to: '', activities: '' }),
  bring: () => ({ id: uid(), item: '', note: '' }),
  concept: () => ({ id: uid(), term: '', meaning: '' }),
  command: () => ({ id: uid(), cmd: '', use: '', example: '' }),
  part: () => ({ id: uid(), name: '', function: '', note: '' }),
  steps: () => ({ id: uid(), outputId: '', title: '', steps: '', tips: '' }),
  source: () => ({ id: uid(), title: '', link: '' }),
  criterion: () => ({ id: uid(), outputId: '', target: '', criterion: '', marks: '', excellent: '', good: '', weak: '' }),
  statement: (text = '') => ({ id: uid(), text }),
  openQ: (text = '') => ({ id: uid(), text }),
  contentDay: () => ({ duration: '', concepts: '', explanation: '', tools: '', challenge: '', steps: '', safety: '', images: [] }),
  journeyDay: () => ({ learn: '', apply: '', output: '' })
};

const blankTest = (key) => ({ duration: '', passMark: '', instructions: TEST_INSTRUCTIONS[key], questions: [MAKE_F.question()] });

export const blankForms = () => ({
  preTest: blankTest('preTest'),
  postTest: blankTest('postTest'),
  content: { days: {}, outputs: {}, refs: [MAKE_F.ref()] },
  guide: {
    dateFrom: '', dateTo: '', attendance: '', location: '', phone: '', link: '',
    welcome: '', aboutLab: DEFAULT_ABOUT_LAB, aboutProgram: '', goals: '',
    learnMake: [MAKE_F.learnMake()],
    journey: {},
    finalOutput: { name: '', desc: '', imageFileId: '' },
    schedule: [MAKE_F.slot()],
    assessment: { tests: '', practice: '', final: '', attendance: '' },
    bring: [MAKE_F.bring()],
    rules: RULE_DOMAINS.map(d => ({ domain: d, text: DEFAULT_RULES[d] })),
    team: TEAM_ROLES.map(r => ({ role: r, name: '', contact: '' }))
  },
  reference: { intro: '', concepts: [MAKE_F.concept()], commands: [], parts: [MAKE_F.part()], steps: [MAKE_F.steps()], sources: [] },
  rubric: { passMark: '', notes: '', items: [] },
  survey: {
    axes: SURVEY_AXES.map(t => ({ title: t, items: DEFAULT_SURVEY[t].map(MAKE_F.statement) })),
    open: DEFAULT_OPEN.map(MAKE_F.openQ),
    method: '', timing: '', target: ''
  }
});

// ─────────────── Normalize (old kits, partial data, deleted links) ───────────────

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const list = (arr, make) => (Array.isArray(arr) ? arr.filter(x => x && typeof x === 'object').map(x => ({ ...make(), ...x })) : null);
const fileRef = (f) => (f && typeof f === 'object' && f.fileId ? { fileId: f.fileId, name: f.name || '', size: f.size || 0, mime: f.mime || '', caption: f.caption || '', id: f.id || f.fileId } : null);

const normTest = (raw, key, ids) => {
  const b = blankTest(key);
  const t = { ...b, ...obj(raw) };
  t.questions = list(raw?.questions, MAKE_F.question) || b.questions;
  t.questions.forEach(q => {
    if (!Q_TYPE_LABEL[q.type]) q.type = 'mcq';
    q.options = (list(q.options, MAKE_F.option) || []);
    if (q.type === 'mcq' && q.correct && !q.options.some(o => o.id === q.correct)) q.correct = '';
    if (q.type === 'tf' && !['true', 'false'].includes(q.correct)) q.correct = '';
    if (q.objectiveId && !ids.objectives.has(q.objectiveId)) q.objectiveId = '';
  });
  return t;
};

/**
 * Fills in missing structure without losing values, and drops links to
 * days / outputs / objectives / images that no longer exist in the kit.
 * `s` is the normalized kit (card, plan, outputs, images).
 */
export const normalizeForms = (raw, s) => {
  const b = blankForms();
  const f = obj(raw);
  const ids = {
    objectives: new Set((s.card.objectives || []).map(o => o.id)),
    days: new Set((s.plan || []).map(d => d.id)),
    outputs: new Set((s.outputs || []).map(o => o.id)),
    images: new Set((s.images || []).map(im => im.fileId))
  };
  const out = {};
  out.preTest = normTest(f.preTest, 'preTest', ids);
  out.postTest = normTest(f.postTest, 'postTest', ids);

  const c = obj(f.content);
  const days = {};
  Object.entries(obj(c.days)).forEach(([id, d]) => {
    if (!ids.days.has(id)) return;
    const x = { ...MAKE_F.contentDay(), ...obj(d) };
    x.images = (Array.isArray(x.images) ? x.images : []).map(fileRef).filter(Boolean);
    days[id] = x;
  });
  const outputs = {};
  Object.entries(obj(c.outputs)).forEach(([id, o]) => { if (ids.outputs.has(id)) outputs[id] = { criteria: '', ...obj(o) }; });
  out.content = { ...c, days, outputs, refs: list(c.refs, MAKE_F.ref) || b.content.refs };

  const g = { ...b.guide, ...obj(f.guide) };
  g.learnMake = list(f.guide?.learnMake, MAKE_F.learnMake) || b.guide.learnMake;
  g.schedule = list(f.guide?.schedule, MAKE_F.slot) || b.guide.schedule;
  g.bring = list(f.guide?.bring, MAKE_F.bring) || b.guide.bring;
  const journey = {};
  Object.entries(obj(f.guide?.journey)).forEach(([id, d]) => { if (ids.days.has(id)) journey[id] = { ...MAKE_F.journeyDay(), ...obj(d) }; });
  g.journey = journey;
  g.finalOutput = { ...b.guide.finalOutput, ...obj(f.guide?.finalOutput) };
  if (g.finalOutput.imageFileId && !ids.images.has(g.finalOutput.imageFileId)) g.finalOutput.imageFileId = '';
  g.assessment = { ...b.guide.assessment, ...obj(f.guide?.assessment) };
  const byDomain = (arr, d) => (Array.isArray(arr) ? arr : []).find(r => r && r.domain === d);
  g.rules = RULE_DOMAINS.map(d => ({ domain: d, text: byDomain(f.guide?.rules, d)?.text ?? DEFAULT_RULES[d] }));
  const byRole = (arr, r) => (Array.isArray(arr) ? arr : []).find(x => x && x.role === r) || {};
  g.team = TEAM_ROLES.map(r => ({ role: r, name: '', contact: '', ...byRole(f.guide?.team, r) }));
  out.guide = g;

  const r = { ...b.reference, ...obj(f.reference) };
  r.concepts = list(f.reference?.concepts, MAKE_F.concept) || b.reference.concepts;
  r.commands = list(f.reference?.commands, MAKE_F.command) || [];
  r.parts = list(f.reference?.parts, MAKE_F.part) || b.reference.parts;
  r.steps = list(f.reference?.steps, MAKE_F.steps) || b.reference.steps;
  r.steps.forEach(x => { if (x.outputId && !ids.outputs.has(x.outputId)) x.outputId = ''; });
  r.sources = list(f.reference?.sources, MAKE_F.source) || [];
  out.reference = r;

  const rb = { ...b.rubric, ...obj(f.rubric) };
  rb.items = list(f.rubric?.items, MAKE_F.criterion) || [];
  rb.items.forEach(x => { if (x.outputId && !ids.outputs.has(x.outputId)) x.outputId = ''; });
  out.rubric = rb;

  const sv = { ...b.survey, ...obj(f.survey) };
  const byTitle = (arr, t) => (Array.isArray(arr) ? arr : []).find(a => a && a.title === t);
  sv.axes = SURVEY_AXES.map(t => {
    const a = byTitle(f.survey?.axes, t);
    return { title: t, items: a ? (list(a.items, MAKE_F.statement) || []) : DEFAULT_SURVEY[t].map(MAKE_F.statement) };
  });
  sv.open = list(f.survey?.open, MAKE_F.openQ) || b.survey.open;
  out.survey = sv;
  return out;
};

// ─────────────── Kit facts the forms show (never retyped) ───────────────

export const objCode = (s, id) => { const i = s.card.objectives.findIndex(o => o.id === id); return i < 0 ? '' : `ه${i + 1}`; };
export const outCode = (s, id) => { const i = s.outputs.findIndex(o => o.id === id); return i < 0 ? '' : `م${i + 1}`; };
export const techOutputs = (s) => s.outputs.map((o, i) => ({ ...o, code: `م${i + 1}` })).filter(o => isTech(o.type));
export const testTotal = (t) => t.questions.reduce((a, q) => a + (num(q.marks) || 0), 0);
export const rubricTotal = (r) => r.items.reduce((a, x) => a + (num(x.marks) || 0), 0);

// Rubric criteria generated from the kit's outputs (one click).
export const rubricFor = (o) => (isTech(o.type)
  ? [
    ['عمل المخرج ووظيفته', 10, 'يعمل المخرج كما هو مطلوب دون أي تدخل أو إصلاح', 'يعمل مع خلل بسيط يُصلح أثناء التقييم', 'لا يعمل أو يعمل جزئيًا'],
    ['الجودة والإتقان', 5, 'تشطيب نظيف وتجميع دقيق دون زوائد أو فراغات', 'جودة مقبولة مع عيوب ظاهرة لا تؤثر على العمل', 'عيوب تؤثر على الشكل أو الأداء'],
    ['السلامة', 5, 'التزم بتعليمات السلامة طوال التنفيذ ويُسلَّم المخرج آمنًا', 'التزم مع تنبيه واحد من المدرب', 'خالف تعليمات السلامة أكثر من مرة'],
    ['المطابقة للمرجع', 5, 'مطابق للصورة والمواصفات المرجعية', 'اختلاف بسيط عن المرجع', 'اختلاف جوهري عن المرجع']
  ]
  : [
    ['الاكتمال', 5, 'مكتمل بجميع عناصره المطلوبة', 'ينقصه عنصر واحد', 'ينقصه أكثر من عنصر'],
    ['الدقة والصحة', 10, 'صحيح بالكامل مع إظهار خطوات العمل', 'أخطاء بسيطة لا تمس الفكرة الأساسية', 'أخطاء جوهرية في الفكرة أو النتائج'],
    ['العرض والتوثيق', 5, 'منظم وواضح ويمكن لغيره فهمه', 'مفهوم مع بعض الغموض', 'غير منظم ويصعب فهمه']
  ]).map(([criterion, marks, excellent, good, weak]) => ({ ...MAKE_F.criterion(), outputId: o.id, criterion, marks, excellent, good, weak }));

// ─────────────── Checks ───────────────

// Field ids inside a form screen: tkf-<form>-<path with dashes>.
export const fid = (key, path) => `tkf-${key}-${String(path).replace(/\./g, '-')}`;

const checkTest = (key, t, s, chk) => {
  const L = (p) => fid(key, p);
  chk(has(t.duration), 'حدد زمن الاختبار بالدقائق', L('duration'));
  chk(has(t.instructions), 'اكتب تعليمات الاختبار', L('instructions'));
  chk(t.questions.length > 0, 'أضف سؤالًا واحدًا على الأقل', `tkf-${key}-questions`);
  t.questions.forEach((q, i) => {
    const n = `س${i + 1}`;
    chk(has(q.text), `${n}: اكتب نص السؤال`, L(`questions.${i}.text`));
    chk(num(q.marks) > 0, `${n}: حدد درجة السؤال`, L(`questions.${i}.marks`));
    if (q.type === 'mcq') {
      chk(q.options.filter(o => has(o.text)).length >= 2, `${n}: اكتب خيارين على الأقل`, L(`questions.${i}.options`));
      chk(!!q.correct && q.options.some(o => o.id === q.correct && has(o.text)), `${n}: حدد الإجابة الصحيحة`, L(`questions.${i}.options`));
    } else if (q.type === 'tf') {
      chk(['true', 'false'].includes(q.correct), `${n}: حدد هل العبارة صحيحة أم خاطئة`, L(`questions.${i}.correct`));
    } else {
      chk(has(q.answer), `${n}: اكتب ${q.type === 'practical' ? 'معيار التصحيح للمهمة' : 'الإجابة النموذجية'}`, L(`questions.${i}.answer`));
    }
    chk(!!q.objectiveId, `${n}: اربط السؤال بهدف من أهداف البرنامج`, L(`questions.${i}.objectiveId`));
    chk(has(q.measures), `${n}: اكتب ما الذي يقيسه السؤال`, L(`questions.${i}.measures`));
  });
  s.card.objectives.forEach((o, i) => {
    if (has(o.text)) chk(t.questions.some(q => q.objectiveId === o.id), `الهدف ه${i + 1} لا يقيسه أي سؤال`, `tkf-${key}-questions`);
  });
};

const checkContent = (c, s, chk) => {
  const L = (p) => fid('content', p);
  s.plan.forEach((p, i) => {
    const d = c.days[p.id] || MAKE_F.contentDay();
    const miss = [['concepts', 'المفاهيم والمصطلحات'], ['explanation', 'الشرح العلمي والتقني'], ['tools', 'الأجهزة والبرامج والقطع'], ['challenge', 'التطبيق العملي أو التحدي'], ['steps', 'خطوات التطبيق'], ['safety', 'السلامة والأخطاء الشائعة']].filter(f => !has(d[f[0]]));
    chk(!miss.length, `اليوم ${i + 1}: أكمل ${miss.map(f => f[1]).join('، ')}`, L(`days.${p.id}.${miss[0] ? miss[0][0] : 'concepts'}`));
  });
  if (!s.plan.length) chk(false, 'أضف أيام البرنامج في «خطة التنفيذ» أولًا', 'tk-list-plan');
  techOutputs(s).forEach(o => chk(has((c.outputs[o.id] || {}).criteria), `المخرج ${o.code}: اكتب معايير القبول`, L(`outputs.${o.id}.criteria`)));
  chk(c.refs.some(r => has(r.source) && has(r.ref)), 'أضف مرجعًا أو مصدرًا واحدًا على الأقل', L('refs.0.source'));
  c.refs.forEach((r, i) => { if ((has(r.source) || has(r.ref)) && !(has(r.source) && has(r.ref))) chk(false, `المرجع ${i + 1}: أكمل المصدر والرابط أو بيانات المرجع`, L(`refs.${i}.${has(r.source) ? 'ref' : 'source'}`)); });
};

const checkGuide = (g, s, chk) => {
  const L = (p) => fid('guide', p);
  [['dateFrom', 'تاريخ بداية البرنامج'], ['dateTo', 'تاريخ نهاية البرنامج'], ['attendance', 'أيام وساعات الحضور'], ['location', 'موقع التنفيذ والقاعة'], ['phone', 'رقم التواصل']]
    .forEach(([k, l]) => chk(has(g[k]), `أكمل «${l}»`, L(k)));
  if (has(g.dateFrom) && has(g.dateTo) && g.dateFrom > g.dateTo) chk(false, 'تاريخ البداية بعد تاريخ النهاية', L('dateFrom'));
  chk(has(g.welcome), 'اكتب رسالة الترحيب', L('welcome'));
  [['aboutLab', 'نبذة عن فاب لاب الأحساء'], ['aboutProgram', 'نبذة عن البرنامج'], ['goals', 'أهداف البرنامج للمشارك']].forEach(([k, l]) => chk(has(g[k]), `أكمل «${l}»`, L(k)));
  chk(g.learnMake.some(r => has(r.learn) && has(r.make)), 'أكمل «ماذا ستتعلم وتصنع؟» بصف واحد على الأقل', L('learnMake.0.learn'));
  s.plan.forEach((p, i) => {
    const j = g.journey[p.id] || MAKE_F.journeyDay();
    const miss = [['learn', 'ماذا سأتعلم؟'], ['apply', 'ماذا سأطبق؟'], ['output', 'مخرج اليوم']].filter(f => !has(j[f[0]]));
    chk(!miss.length, `رحلتي — اليوم ${i + 1}: أكمل ${miss.map(f => f[1]).join('، ')}`, L(`journey.${p.id}.${miss[0] ? miss[0][0] : 'learn'}`));
  });
  chk(has(g.finalOutput.name) && has(g.finalOutput.desc), 'أكمل اسم المخرج النهائي ووصفه', L(`finalOutput.${has(g.finalOutput.name) ? 'desc' : 'name'}`));
  chk(g.schedule.some(r => has(r.day) && has(r.from) && has(r.to) && has(r.activities)), 'أكمل صفًا واحدًا على الأقل في جدول الجلسات', L('schedule.0.day'));
  [['tests', 'الاختبار القبلي والبعدي'], ['practice', 'التطبيقات العملية'], ['final', 'المخرج النهائي'], ['attendance', 'الحضور والشهادة']].forEach(([k, l]) => chk(has(g.assessment[k]), `التقييم: أكمل «${l}»`, L(`assessment.${k}`)));
  chk(g.bring.some(r => has(r.item)), 'أكمل «ما الذي أحتاج إلى إحضاره؟» (أو اكتب: لا يلزم إحضار شيء)', L('bring.0.item'));
  g.rules.forEach((r, i) => chk(has(r.text), `اكتب تعليمات «${r.domain}»`, L(`rules.${i}.text`)));
  [0, 2].forEach(i => chk(has(g.team[i].name) && has(g.team[i].contact), `فريق البرنامج: أكمل اسم «${g.team[i].role}» ووسيلة التواصل`, L(`team.${i}.${has(g.team[i].name) ? 'contact' : 'name'}`)));
};

const checkReference = (r, s, chk) => {
  const L = (p) => fid('reference', p);
  chk(r.concepts.some(x => has(x.term) && has(x.meaning)), 'أضف مفهومًا أساسيًا واحدًا على الأقل مع شرحه', L('concepts.0.term'));
  r.concepts.forEach((x, i) => { if (has(x.term) !== has(x.meaning)) chk(false, `المفهوم ${i + 1}: أكمل المفهوم وشرحه`, L(`concepts.${i}.${has(x.term) ? 'meaning' : 'term'}`)); });
  r.commands.forEach((x, i) => { if ((has(x.cmd) || has(x.use)) && !(has(x.cmd) && has(x.use))) chk(false, `الأمر ${i + 1}: أكمل الأمر واستخدامه`, L(`commands.${i}.${has(x.cmd) ? 'use' : 'cmd'}`)); });
  chk(r.parts.some(x => has(x.name) && has(x.function)), 'أضف قطعة أو أداة واحدة على الأقل مع وظيفتها', L('parts.0.name'));
  chk(r.steps.some(x => has(x.title) && has(x.steps)), 'أضف خطوات إعادة تطبيق واحدة على الأقل', L('steps.0.title'));
  r.steps.forEach((x, i) => { if (has(x.title) !== has(x.steps)) chk(false, `خطوات إعادة التطبيق ${i + 1}: أكمل العنوان والخطوات`, L(`steps.${i}.${has(x.title) ? 'steps' : 'title'}`)); });
};

const checkRubric = (r, s, chk) => {
  const L = (p) => fid('rubric', p);
  chk(r.items.length > 0, 'أضف معايير التقييم — أو أنشئها من مخرجات الحقيبة بضغطة', 'tkf-rubric-items');
  r.items.forEach((x, i) => {
    const miss = [['criterion', 'المعيار'], ['marks', 'الدرجة'], ['excellent', 'وصف «ممتاز»'], ['good', 'وصف «جيد»'], ['weak', 'وصف «يحتاج تحسين»']].filter(f => (f[0] === 'marks' ? !(num(x.marks) > 0) : !has(x[f[0]])));
    if (!x.outputId && !has(x.target)) miss.unshift(['target', 'المخرج أو التطبيق']);
    chk(!miss.length, `المعيار ${i + 1}: أكمل ${miss.map(f => f[1]).join('، ')}`, L(`items.${i}.${miss[0] ? (miss[0][0] === 'target' ? 'outputId' : miss[0][0]) : 'criterion'}`));
  });
  s.outputs.forEach((o, i) => chk(r.items.some(x => x.outputId === o.id), `المخرج م${i + 1} ليس له معيار تقييم`, 'tkf-rubric-items'));
  const total = rubricTotal(r);
  chk(num(r.passMark) > 0, 'حدد درجة النجاح', L('passMark'));
  if (num(r.passMark) > 0 && total && num(r.passMark) > total) chk(false, `درجة النجاح أكبر من مجموع الدرجات (${total})`, L('passMark'));
};

const checkSurvey = (v, s, chk) => {
  const L = (p) => fid('survey', p);
  v.axes.forEach((a, i) => {
    chk(a.items.filter(x => has(x.text)).length >= 2, `محور «${a.title}»: عبارتان على الأقل`, L(`axes.${i}.items`));
  });
  chk(v.open.some(x => has(x.text)), 'أضف سؤالًا مفتوحًا واحدًا على الأقل', L('open.0.text'));
  chk(has(v.method), 'حدد طريقة تطبيق الاستبانة', L('method'));
  chk(has(v.timing), 'حدد موعد تطبيق الاستبانة', L('timing'));
};

const CHECK = { preTest: (f, s, c) => checkTest('preTest', f, s, c), postTest: (f, s, c) => checkTest('postTest', f, s, c), content: checkContent, guide: checkGuide, reference: checkReference, rubric: checkRubric, survey: checkSurvey };

// Has the employee written anything in the form yet (beyond defaults)?
export const formStarted = (key, f) => {
  switch (key) {
    case 'preTest': case 'postTest': return f.questions.some(q => has(q.text)) || has(f.duration);
    case 'content': return Object.values(f.days).some(d => Object.entries(d).some(([k, v]) => (k === 'images' ? v.length > 0 : has(v)))) || Object.values(f.outputs).some(o => has(o.criteria)) || f.refs.some(r => has(r.source) || has(r.ref));
    case 'guide': return ['dateFrom', 'attendance', 'location', 'phone', 'welcome', 'aboutProgram', 'goals'].some(k => has(f[k])) || has(f.finalOutput.name) || f.schedule.some(r => has(r.day) || has(r.activities));
    case 'reference': return f.concepts.some(x => has(x.term)) || f.parts.some(x => has(x.name)) || f.steps.some(x => has(x.title)) || has(f.intro);
    case 'rubric': return f.items.length > 0 || has(f.passMark);
    case 'survey': return has(f.method) || has(f.timing) || has(f.target);
    default: return false;
  }
};

/** { issues: [{ text, target }], done, total, pct, started } for one form. */
export const analyzeForm = (key, s) => {
  const f = s.forms[key];
  const issues = []; let done = 0; let total = 0;
  CHECK[key](f, s, (ok, text, target) => { total++; if (ok) done++; else issues.push({ text, target }); });
  return { issues, done, total, pct: total ? Math.floor((done / total) * 100) : 100, started: formStarted(key, f) };
};

// ─────────────── Change comparison (edit history) ───────────────

/** Adds every form field to the kit's flat list ([key, label, value]). */
export const flattenForms = (s, put) => {
  const f = s.forms;
  const ttl = (k) => FORM_META[k].label;
  ['preTest', 'postTest'].forEach(k => {
    const t = f[k]; const T = ttl(k);
    put(`f.${k}.duration`, `${T} › الزمن بالدقائق`, t.duration);
    put(`f.${k}.passMark`, `${T} › درجة النجاح`, t.passMark);
    put(`f.${k}.instructions`, `${T} › التعليمات`, t.instructions);
    t.questions.forEach((q, i) => {
      const P = `${T} › س${i + 1}`;
      put(`f.${k}.q.${q.id}.type`, `${P} › النوع`, Q_TYPE_LABEL[q.type]);
      put(`f.${k}.q.${q.id}.text`, `${P} › السؤال`, q.text);
      if (q.type === 'mcq') {
        put(`f.${k}.q.${q.id}.options`, `${P} › الخيارات`, q.options.map(o => o.text).filter(has));
        put(`f.${k}.q.${q.id}.correct`, `${P} › الإجابة الصحيحة`, (q.options.find(o => o.id === q.correct) || {}).text || '');
      } else if (q.type === 'tf') {
        put(`f.${k}.q.${q.id}.correct`, `${P} › الإجابة الصحيحة`, q.correct === 'true' ? 'صح' : q.correct === 'false' ? 'خطأ' : '');
      } else {
        put(`f.${k}.q.${q.id}.answer`, `${P} › ${q.type === 'practical' ? 'معيار التصحيح' : 'الإجابة النموذجية'}`, q.answer);
      }
      put(`f.${k}.q.${q.id}.marks`, `${P} › الدرجة`, q.marks);
      put(`f.${k}.q.${q.id}.obj`, `${P} › الهدف المرتبط`, objCode(s, q.objectiveId));
      put(`f.${k}.q.${q.id}.measures`, `${P} › ما يقيسه`, q.measures);
    });
  });
  const C = ttl('content');
  const DAYF = { duration: 'مدة اليوم', concepts: 'المفاهيم والمصطلحات', explanation: 'الشرح العلمي والتقني', tools: 'الأجهزة والبرامج والقطع', challenge: 'التطبيق العملي أو التحدي', steps: 'خطوات التطبيق', safety: 'السلامة والأخطاء الشائعة' };
  s.plan.forEach((p, i) => {
    const d = f.content.days[p.id] || MAKE_F.contentDay();
    Object.entries(DAYF).forEach(([k, l]) => put(`f.content.d.${p.id}.${k}`, `${C} › اليوم ${i + 1} › ${l}`, d[k]));
    put(`f.content.d.${p.id}.images`, `${C} › اليوم ${i + 1} › الصور التوضيحية`, d.images.map(im => im.caption || im.name));
  });
  techOutputs(s).forEach(o => put(`f.content.o.${o.id}`, `${C} › المخرج ${o.code} › معايير القبول`, (f.content.outputs[o.id] || {}).criteria));
  f.content.refs.forEach((r, i) => put(`f.content.r.${r.id}`, `${C} › المراجع › ${i + 1}`, [r.source, r.ref, r.date].filter(has).join(' — ')));

  const G = ttl('guide'); const g = f.guide;
  const GF = { dateFrom: 'تاريخ البداية', dateTo: 'تاريخ النهاية', attendance: 'أيام وساعات الحضور', location: 'موقع التنفيذ والقاعة', phone: 'رقم التواصل', link: 'رابط الموقع أو رمز الوصول', welcome: 'أهلًا بك', aboutLab: 'نبذة عن فاب لاب الأحساء', aboutProgram: 'نبذة عن البرنامج', goals: 'أهداف البرنامج' };
  Object.entries(GF).forEach(([k, l]) => put(`f.guide.${k}`, `${G} › ${l}`, g[k]));
  g.learnMake.forEach((r, i) => put(`f.guide.lm.${r.id}`, `${G} › ماذا ستتعلم وتصنع › ${i + 1}`, [r.learn, r.make].filter(has).join(' ← ')));
  s.plan.forEach((p, i) => {
    const j = g.journey[p.id] || MAKE_F.journeyDay();
    put(`f.guide.j.${p.id}`, `${G} › رحلتي › اليوم ${i + 1}`, [j.learn, j.apply, j.output].filter(has).join(' | '));
  });
  put('f.guide.final', `${G} › المخرج النهائي`, [g.finalOutput.name, g.finalOutput.desc].filter(has).join(' — '));
  g.schedule.forEach((r, i) => put(`f.guide.sc.${r.id}`, `${G} › الجدول › ${i + 1}`, [r.day, r.from && r.to ? `${r.from}–${r.to}` : '', r.activities].filter(has).join(' | ')));
  const AS = { tests: 'الاختبار القبلي والبعدي', practice: 'التطبيقات العملية', final: 'المخرج النهائي', attendance: 'الحضور والشهادة' };
  Object.entries(AS).forEach(([k, l]) => put(`f.guide.as.${k}`, `${G} › التقييم › ${l}`, g.assessment[k]));
  g.bring.forEach((r, i) => put(`f.guide.br.${r.id}`, `${G} › ما أحضره › ${i + 1}`, [r.item, r.note].filter(has).join(' — ')));
  g.rules.forEach(r => put(`f.guide.ru.${r.domain}`, `${G} › التعليمات › ${r.domain}`, r.text));
  g.team.forEach(t => put(`f.guide.tm.${t.role}`, `${G} › الفريق › ${t.role}`, [t.name, t.contact].filter(has).join(' — ')));

  const R = ttl('reference'); const r = f.reference;
  put('f.ref.intro', `${R} › مقدمة`, r.intro);
  r.concepts.forEach((x, i) => put(`f.ref.c.${x.id}`, `${R} › المفاهيم › ${i + 1}`, [x.term, x.meaning].filter(has).join(': ')));
  r.commands.forEach((x, i) => put(`f.ref.k.${x.id}`, `${R} › الأوامر › ${i + 1}`, [x.cmd, x.use, x.example].filter(has).join(' — ')));
  r.parts.forEach((x, i) => put(`f.ref.p.${x.id}`, `${R} › القطع والأدوات › ${i + 1}`, [x.name, x.function, x.note].filter(has).join(' — ')));
  r.steps.forEach((x, i) => put(`f.ref.s.${x.id}`, `${R} › خطوات إعادة التطبيق › ${i + 1}`, [outCode(s, x.outputId), x.title, x.steps, x.tips].filter(has).join(' | ')));
  r.sources.forEach((x, i) => put(`f.ref.src.${x.id}`, `${R} › مصادر للاستزادة › ${i + 1}`, [x.title, x.link].filter(has).join(' — ')));

  const B = ttl('rubric'); const rb = f.rubric;
  put('f.rubric.pass', `${B} › درجة النجاح`, rb.passMark);
  put('f.rubric.notes', `${B} › ملاحظات`, rb.notes);
  rb.items.forEach((x, i) => put(`f.rubric.i.${x.id}`, `${B} › المعيار ${i + 1}`, [outCode(s, x.outputId) || x.target, x.criterion, has(x.marks) ? `${x.marks} درجة` : '', x.excellent, x.good, x.weak].filter(has).join(' | ')));

  const V = ttl('survey'); const v = f.survey;
  v.axes.forEach(a => a.items.forEach((x, i) => put(`f.survey.${a.title}.${x.id}`, `${V} › ${a.title} › ${i + 1}`, x.text)));
  v.open.forEach((x, i) => put(`f.survey.o.${x.id}`, `${V} › سؤال مفتوح ${i + 1}`, x.text));
  put('f.survey.method', `${V} › طريقة التطبيق`, v.method);
  put('f.survey.timing', `${V} › موعد التطبيق`, v.timing);
  put('f.survey.target', `${V} › نسبة الرضا المستهدفة`, v.target);
};

// ─────────────── Printable parts ───────────────

// Forms with something written in them, for the review screen's print
// buttons: [{ key, label, audiences }].
export const formParts = (s) => FORMS
  .filter(f => s.forms && formStarted(f.key, s.forms[f.key]))
  .map(f => ({
    key: f.key,
    label: f.label,
    audiences: f.test ? ['participant', 'trainer'] : [null]
  }));
