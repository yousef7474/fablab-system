import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  SECTIONS, normalize, analyze, derive, fillFromKit, kitData, idOf, getPath, setPath, has, num, fmtWrNo, fmtTime, diffData
} from './wrModel';
import { WR_KIND } from './wrKind';
import { fmtDay, ar, fmt, NOTES, DAYS, HOURS, statusOf } from '../../TrainingKits/kitModel';
import { fmtPlanNo } from '../../ExecutionPlans/planModel';
import { AutoArea, Seg, Portal, useBodyLock, Modal, KitHistory, AuthedImage } from '../../TrainingKits/KitParts';
import { uploadFile, printDocument, errorText, compressImage } from '../../TrainingKits/kitApi';
import '../../TrainingKits/TrainingKits.css';
import './WorkshopRequest.css';

const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
const HINTS_KEY = 'tk_hints';
const R = WR_KIND.routes.mine;
const VIS = ['عامة — تظهر في صفحة التسجيل', 'خاصة — التسجيل برابط مباشر'];
const SEATS = ['مقعد واحد', 'مقعدان', 'مقاعد', 'مقعدًا'];
const range = (a, b) => (has(a) && has(b) ? `من ${a} إلى ${b}` : has(b) ? `حتى ${b}` : `${a} فأكثر`);
const ROOMS = ['فاب لاب الأحساء — قاعة التدريب', 'معمل الإلكترونيات', 'معمل الطباعة ثلاثية الأبعاد', 'معمل الليزر', 'معمل الخشب', 'عن بُعد (أون لاين)'];

/**
 * The employee's workshop request (طلب ورشة) — built from one of their
 * approved training kits. Saves as you type; «إرسال للمراجعة» freezes a
 * version and sends it to the project manager, then the manager, whose
 * approval creates the workshop in the workshops system.
 */
const WorkshopRequestEditor = ({ api, doc, portalTarget, theme = 'dark', onClose, onSubmitted }) => {
  useBodyLock();
  const [data, setData] = useState(() => normalize(doc.data));
  const [save, setSave] = useState({ state: 'idle', at: null });
  const [hints, setHints] = useState(() => { try { return localStorage.getItem(HINTS_KEY) !== '0'; } catch { return true; } });
  const [active, setActive] = useState('wr-s1');
  const [showAll, setShowAll] = useState(false);
  const [kitFull, setKitFull] = useState(null);
  const [plans, setPlans] = useState([]);
  const [planFull, setPlanFull] = useState(null);
  const [coverBusy, setCoverBusy] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const dirty = useRef(false);
  const latest = useRef(data);
  const coverInput = useRef(null);
  const id = doc.id || doc.requestId;

  const A = useMemo(() => analyze(data), [data]);
  const D = useMemo(() => derive(data), [data]);
  const locked = !['draft', 'returned'].includes(doc.status);

  // The linked kit (its images can become the cover) and the employee's
  // plans (to link the target this workshop delivers).
  const kitId = data.kit.kitId;
  useEffect(() => {
    if (!kitId) return;
    api.get(`/training-kits/mine/${kitId}`).then(({ data: k }) => setKitFull(k)).catch(() => setKitFull(null));
  }, [api, kitId]);
  useEffect(() => {
    api.get('/execution-plans/mine').then(({ data: list }) => setPlans(Array.isArray(list) ? list : [])).catch(() => {});
  }, [api]);
  const planId = data.plan.planId;
  useEffect(() => {
    if (!planId) { setPlanFull(null); return; }
    api.get(`/execution-plans/mine/${planId}`).then(({ data: p }) => setPlanFull(p)).catch(() => setPlanFull(null));
  }, [api, planId]);

  // ── state updates ──
  const update = useCallback((fn) => {
    setData(prev => { const n = clone(prev); fn(n); return n; });
    dirty.current = true;
  }, []);
  const set = useCallback((path, value) => update(n => setPath(n, path, value)), [update]);
  const val = (path) => { const v = getPath(data, path); return v == null ? '' : v; };

  // ── autosave ──
  const persist = useCallback(async () => {
    if (!dirty.current) return true;
    dirty.current = false;
    setSave(s => ({ ...s, state: 'pending' }));
    try {
      await api.put(R.kit(id), { data: latest.current, completion: analyze(latest.current).pct });
      setSave({ state: 'ok', at: new Date() });
      return true;
    } catch (err) {
      dirty.current = true;
      setSave({ state: 'error', at: null, msg: errorText(err, 'تعذّر الحفظ — تحقق من الاتصال') });
      return false;
    }
  }, [api, id]);

  useEffect(() => {
    latest.current = data;
    if (!dirty.current) return undefined;
    setSave(s => ({ ...s, state: 'pending' }));
    const t = setTimeout(persist, 900);
    return () => clearTimeout(t);
  }, [data, persist]);

  const close = async () => {
    if (dirty.current && !(await persist())) {
      if (!window.confirm('لم تُحفظ آخر التعديلات. هل تريد الخروج على أي حال؟')) return;
    }
    onClose?.();
  };

  useEffect(() => { try { localStorage.setItem(HINTS_KEY, hints ? '1' : '0'); } catch { /* ignore */ } }, [hints]);

  // ── section spy ──
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) setActive(en.target.id); }), { root, rootMargin: '-25% 0px -65% 0px' });
    root.querySelectorAll('.tk-sec').forEach(s => io.observe(s));
    return () => io.disconnect();
  }, []);

  const goto = (target) => {
    const el = document.getElementById(target);
    if (!el) return;
    if (el.classList.contains('tk-sec')) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const f = el.matches('input,select,textarea,button') ? el : el.querySelector('textarea,input,select,button');
    const ring = el.closest('.tk-field,.tk-panel') || el;
    setTimeout(() => {
      if (f) f.focus({ preventScroll: true });
      ring.classList.remove('tk-flash'); void ring.offsetWidth; ring.classList.add('tk-flash');
    }, 380);
  };

  // ── kit ──
  const kd = kitFull ? kitData(kitFull) : null;
  const kitImages = (kd?.images || []).filter(im => im.fileId);
  const kitOk = kitFull && kitFull.status === 'approved';
  const refreshFromKit = () => {
    if (!kitFull) return;
    if (!window.confirm('نسخ العنوان والوصف والأهداف والمحتوى والأعمار والمقاعد والساعات من الحقيبة؟ ستُستبدل القيم الحالية في هذه الحقول.')) return;
    update(n => {
      fillFromKit(n, kitData(kitFull));
      n.kit.kitTitle = kitFull.title || n.kit.kitTitle;
      n.kit.approvedVersion = kitFull.approvedVersion || n.kit.approvedVersion;
    });
    toast.success('نُسخت بيانات الحقيبة');
  };

  // ── cover ──
  const dropFile = (fileId) => { api.delete(R.dropFile(id, fileId)).catch(() => {}); };
  const setCover = async (file, label) => {
    setCoverBusy(label || file.name);
    try {
      const small = await compressImage(file);
      const up = await uploadFile(api, id, small, 'image', R.upload(id));
      const old = latest.current.cover;
      update(n => { n.cover = { fileId: up.fileId, name: up.name, size: up.size, mime: up.mime }; });
      if (old?.fileId) dropFile(old.fileId);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر رفع الصورة'));
    } finally {
      setCoverBusy('');
    }
  };
  const pickCover = (files) => {
    const f = Array.from(files || []).find(x => /^image\//.test(x.type));
    if (!f) { toast.error('اختر صورة بصيغة PNG أو JPG'); return; }
    setCover(f);
  };
  // A kit reference image becomes the cover (copied into the request).
  const coverFromKit = async (im) => {
    setPickOpen(false);
    try {
      const res = await api.get(`/training-kits/mine/files/${im.fileId}`, { responseType: 'blob' });
      const type = res.data.type || 'image/jpeg';
      await setCover(new File([res.data], im.name || 'cover.jpg', { type }), im.caption || im.name);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر نسخ صورة الحقيبة'));
    }
  };
  const removeCover = () => {
    const old = data.cover;
    update(n => { n.cover = null; });
    if (old?.fileId) dropFile(old.fileId);
  };

  // ── plan link ──
  const linkPlan = (pid) => update(n => {
    const p = plans.find(x => (x.id || x.planId) === pid);
    n.plan = p ? { planId: pid, planNo: fmtPlanNo(p.number != null ? p.number : p.planNumber), planTitle: p.title || '', targetId: '', targetName: '' }
      : { planId: '', planNo: '', planTitle: '', targetId: '', targetName: '' };
  });
  const planTargets = (planFull?.data?.targets || []).filter(t => t && t.id);
  const linkTarget = (tid) => update(n => {
    const t = planTargets.find(x => x.id === tid);
    n.plan.targetId = t ? tid : '';
    n.plan.targetName = t ? (t.name || '') : '';
  });

  const preview = async () => {
    await persist();
    printDocument(api, R.doc(id), { draft: 1 }).catch(err => toast.error(errorText(err, 'تعذّر تجهيز المعاينة')));
  };

  // ── submit ──
  const resubmission = doc.currentVersion > 0;
  const openSubmit = () => {
    const need = !has(data.kit.kitId) ? 'wr-s1' : !has(data.title) ? idOf('title') : !has(data.presenter) ? idOf('presenter') : !has(data.startDate) ? idOf('startDate') : null;
    if (need) { toast.error('اختر الحقيبة وأكمل عنوان الورشة والمقدم وتاريخ البداية قبل الإرسال'); goto(need); return; }
    if (kitFull && kitFull.status !== 'approved') { toast.error(`الحقيبة ${data.kit.kitNo} لم تعد معتمدة — لا يمكن إرسال الطلب`); return; }
    setSubmitOpen(true);
  };
  const submit = async () => {
    if (resubmission && !note.trim()) { toast.error('اكتب ما الذي عدّلته في هذا الإصدار'); return; }
    setSending(true);
    try {
      if (!(await persist())) throw new Error('save');
      const { data: updated } = await api.post(R.submit(id), { note: note.trim() });
      toast.success(`أُرسل الطلب إلى ${doc.pm || 'مسؤول إدارة المشاريع'} — الإصدار ${updated.currentVersion}`);
      setSubmitOpen(false);
      onSubmitted?.(updated);
    } catch (err) {
      toast.error(err.message === 'save' ? 'تعذّر حفظ آخر التعديلات قبل الإرسال' : errorText(err, 'تعذّر الإرسال'));
    } finally {
      setSending(false);
    }
  };

  // ── control builders ──
  const text = (path, o = {}) => (
    <input className={`tk-in ${o.cls || ''}`} type="text" id={idOf(path)} value={val(path)} placeholder={o.ph || ''} list={o.list}
      aria-label={o.label} autoComplete="off" disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const area = (path, o = {}) => (
    <AutoArea id={idOf(path)} value={val(path)} rows={o.rows || 1} placeholder={o.ph || ''} aria-label={o.label} disabled={locked} onChange={(v) => set(path, v)} />
  );
  const numIn = (path, o = {}) => {
    const input = (
      <input className="tk-in num" type="number" inputMode="decimal" id={idOf(path)} value={val(path)} min={o.min == null ? 0 : o.min} step={o.step || '1'}
        placeholder={o.ph || ''} aria-label={o.label} disabled={locked}
        onChange={(e) => { const v = e.target.value; set(path, v === '' ? '' : (isFinite(+v) ? +v : '')); }} />
    );
    return o.sfx ? <span className="tk-affix" style={o.sfxW ? { '--sfx': `${o.sfxW}px` } : undefined}>{input}<span className="sfx">{o.sfx}</span></span> : input;
  };
  const dateIn = (path, label) => (
    <input className="tk-in" type="date" id={idOf(path)} value={val(path)} aria-label={label} disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const timeIn = (path, label) => (
    <input className="tk-in" type="time" id={idOf(path)} value={val(path)} aria-label={label} disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const field = (o) => (
    <div className={`tk-field${o.wide ? ' wide' : ''}`} key={o.key}>
      {o.for
        ? <label className="tk-lbl" htmlFor={o.for}>{o.label}{o.req && <span className="tk-req" aria-hidden="true">*</span>}</label>
        : <span className="tk-lbl" id={o.labelId}>{o.label}{o.req && <span className="tk-req" aria-hidden="true">*</span>}</span>}
      {o.hint && <p className="tk-hint">{o.hint}</p>}
      {o.control}
      {o.calc !== undefined && <p className={`tk-calc ${o.calc ? '' : 'idle'}`} aria-live="polite">{o.calc || o.idle}</p>}
    </div>
  );
  const secHead = (s, desc) => {
    const count = s.key === 'done' ? A.issues.length : A.issues.filter(x => x.sec === s.key).length;
    const optional = s.key === 'plan';
    return (
      <header className="tk-sec-head">
        <span className="tk-sec-num">{s.n}</span>
        <div><h2>{s.t}</h2>{desc && <p className="tk-sec-desc">{desc}</p>}</div>
        {optional ? <span className="tk-pill muted">اختياري</span> : <span className={`tk-pill ${count ? 'amber' : 'mint'}`}>{count ? ar(count, NOTES) : 'مكتمل'}</span>}
      </header>
    );
  };
  const S = Object.fromEntries(SECTIONS.map(s => [s.key, s]));

  // ── 1. kit ──
  const renderKit = () => (
    <section className="tk-sec" id="wr-s1">
      {secHead(S.kit, 'الورشة تُبنى على حقيبة تدريبية معتمدة من حقائبك — محتواها وأهدافها ومدتها تأتي من الحقيبة.')}
      <div className="tk-panel">
        {has(data.kit.kitId) ? (
          <div className="wr-kit">
            <span className="wr-kit-ico" aria-hidden="true">🎒</span>
            <div className="wr-kit-main">
              <div className="wr-kit-no mono">{data.kit.kitNo}{data.kit.approvedVersion ? ` · الإصدار المعتمد ${data.kit.approvedVersion}` : ''}</div>
              <b className="wr-kit-title">{kitFull?.title || data.kit.kitTitle || 'حقيبة تدريبية'}</b>
              <div className="wr-kit-meta">
                {kitFull && <span className={`tk-pill ${kitOk ? 'mint' : 'red'}`}>{kitOk ? `معتمدة · ${fmtDay(kitFull.approvedAt)}` : `لم تعد معتمدة — ${statusOf(kitFull).label}`}</span>}
                {has(data.kitHint.days) && has(data.kitHint.hours) && <span>المدة في الحقيبة: {ar(data.kitHint.days, DAYS)} × {ar(data.kitHint.hours, HOURS)} يوميًا</span>}
                {(has(data.kitHint.partMin) || has(data.kitHint.partMax)) && <span>المشاركون في الحقيبة: {range(data.kitHint.partMin, data.kitHint.partMax)}</span>}
              </div>
            </div>
            {!locked && kitFull && <button type="button" className="tk-btn sm" onClick={refreshFromKit} title="انسخ بيانات الحقيبة من جديد">↻ تحديث من الحقيبة</button>}
          </div>
        ) : <p className="tk-empty">لم تُربط حقيبة — ابدأ الطلب من «🛠 طلب ورشة» في حقيبة معتمدة.</p>}
      </div>
    </section>
  );

  // ── 2. workshop info ──
  const coverImg = data.cover ? <AuthedImage api={api} url={R.file(data.cover.fileId)} alt="صورة غلاف الورشة" /> : null;
  const renderInfo = () => (
    <section className="tk-sec" id="wr-s2">
      {secHead(S.info, 'ما يراه المشاركون في صفحة التسجيل. يمكنك تعديل ما نُسخ من الحقيبة ليناسب هذه الورشة.')}
      <div className="tk-panel">
        <div className="tk-grid">
          {field({ key: 't', label: 'عنوان الورشة', req: 1, wide: 1, for: idOf('title'), control: text('title', { ph: 'مثال: تعلّم الحركة الميكانيكية' }) })}
          {field({ key: 'p', label: 'المقدم / المدرب', req: 1, for: idOf('presenter'), hint: 'يظهر اسمه في صفحة الورشة والشهادات.', control: text('presenter') })}
          {field({ key: 'd', label: 'وصف الورشة', req: 1, wide: 1, for: idOf('description'), control: area('description', { rows: 2, ph: 'سطران يعرّفان المشارك بالورشة وما سيصنعه فيها' }) })}
          {field({ key: 'o', label: 'أهداف الورشة', req: 1, wide: 1, for: idOf('objectives'), hint: 'هدف في كل سطر — منسوخة من أهداف الحقيبة.', control: area('objectives', { rows: 3 }) })}
          {field({ key: 'c', label: 'محتوى الورشة ومحاورها', req: 1, wide: 1, for: idOf('content'), hint: 'يوم أو محور في كل سطر — منسوخ من خطة تنفيذ الحقيبة.', control: area('content', { rows: 3 }) })}
        </div>
      </div>
      <div className="tk-panel" id="wr-cover">
        <div className="tk-panel-head"><h3 className="tk-panel-title">صورة الغلاف</h3><p className="tk-panel-note">تظهر في بطاقة الورشة بصفحة التسجيل. ارفع صورة أو اختر صورة من الحقيبة.</p></div>
        <div className="wr-cover">
          <div className={`wr-cover-ph ${data.cover ? '' : 'empty'}`}>
            {coverBusy ? <span className="tk-muted-s">⏳ جارٍ رفع {coverBusy}…</span> : coverImg || <span className="tk-muted-s">لا توجد صورة غلاف بعد</span>}
          </div>
          {!locked && (
            <div className="wr-cover-act">
              <button type="button" className="tk-btn sm" onClick={() => coverInput.current?.click()} disabled={!!coverBusy}>⬆ {data.cover ? 'استبدال الصورة' : 'رفع صورة'}</button>
              {kitImages.length > 0 && <button type="button" className="tk-btn sm" onClick={() => setPickOpen(true)} disabled={!!coverBusy}>🖼 من صور الحقيبة ({kitImages.length})</button>}
              {data.cover && <button type="button" className="tk-btn sm danger" onClick={removeCover}>🗑 إزالة</button>}
              <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => { pickCover(e.target.files); e.target.value = ''; }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );

  // ── 3. schedule ──
  const renderSchedule = () => (
    <section className="tk-sec" id="wr-s3">
      {secHead(S.schedule, 'موعد الورشة ومكانها كما سيظهران في صفحة التسجيل.')}
      <div className="tk-panel">
        <div className="tk-grid">
          {field({ key: 'sd', label: 'التاريخ', req: 1, wide: 1, for: idOf('startDate'), hint: 'من تاريخ البداية إلى تاريخ النهاية — نفس اليوم لورشة يوم واحد.', control: (
            <div className="tk-pair">{dateIn('startDate', 'تاريخ البداية')}<span className="sep">إلى</span>{dateIn('endDate', 'تاريخ النهاية')}</div>
          ), calc: D.days ? `= ${ar(D.days, DAYS)}${has(data.kitHint.days) ? ` · مدة البرنامج في الحقيبة ${ar(data.kitHint.days, DAYS)}` : ''}` : '', idle: 'يُحسب عدد الأيام من التاريخين.' })}
          {field({ key: 'tm', label: 'الوقت اليومي', req: 1, wide: 1, for: idOf('startTime'), control: (
            <div className="tk-pair">{timeIn('startTime', 'وقت البداية')}<span className="sep">إلى</span>{timeIn('endTime', 'وقت النهاية')}</div>
          ), calc: D.daily ? `من ${fmtTime(data.startTime)} إلى ${fmtTime(data.endTime)} = ${ar(D.daily, HOURS)} يوميًا` : '', idle: 'يُحسب عدد الساعات اليومية من الوقتين.' })}
          {field({ key: 'th', label: 'إجمالي ساعات الورشة', req: 1, for: idOf('totalHours'), control: (
            <div className="wr-hours">
              {numIn('totalHours', { sfx: 'ساعة', step: '0.5', ph: '12' })}
              {!locked && D.suggested && num(data.totalHours) !== D.suggested && (
                <button type="button" className="tk-btn sm" onClick={() => set('totalHours', D.suggested)}>استخدم {fmt(D.suggested)}</button>
              )}
            </div>
          ), calc: D.suggested ? `الأيام × الساعات اليومية = ${ar(D.suggested, HOURS)}` : '', idle: 'حدد التاريخ والوقت لاقتراح الإجمالي.' })}
          {field({ key: 'rm', label: 'المكان / القاعة', req: 1, for: idOf('room'), control: text('room', { list: 'wr-dl-rooms' }) })}
        </div>
      </div>
    </section>
  );

  // ── 4. registration ──
  const vis = data.isPublic ? VIS[0] : VIS[1];
  const renderReg = () => (
    <section className="tk-sec" id="wr-s4">
      {secHead(S.reg, 'المقاعد والفئة العمرية والرسوم وطريقة الظهور للتسجيل.')}
      <div className="tk-panel">
        <div className="tk-grid">
          {field({ key: 'mp', label: 'عدد المقاعد', req: 1, for: idOf('maxParticipants'), hint: has(data.kitHint.partMax) ? `الحقيبة مصممة لعدد ${range(data.kitHint.partMin, data.kitHint.partMax)} مشارك.` : '', control: numIn('maxParticipants', { min: 1, sfx: 'مقعد', ph: '20' }) })}
          {field({ key: 'pr', label: 'رسوم التسجيل', req: 1, for: idOf('price'), hint: 'اكتب 0 للورشة المجانية.', control: numIn('price', { step: 'any', sfx: 'ر.س', ph: '0' }) })}
          {field({ key: 'ag', label: 'الفئة العمرية', for: idOf('minAge'), hint: 'اتركها فارغة لورشة بلا حد عمري.', control: (
            <div className="tk-pair">{numIn('minAge', { sfx: 'سنة', ph: 'من' })}<span className="sep">إلى</span>{numIn('maxAge', { sfx: 'سنة', ph: 'إلى', label: 'الحد الأعلى للعمر' })}</div>
          ) })}
          {field({ key: 'vs', label: 'الظهور', req: 1, wide: 1, labelId: 'wrl-vis', hint: 'العامة تظهر في صفحة تسجيل الورش؛ الخاصة لا تظهر ويُشارك رابطها مباشرة.', control: (
            <Seg id={idOf('isPublic')} options={VIS} value={vis} labelledBy="wrl-vis" onChange={(v) => !locked && set('isPublic', v === VIS[0])} />
          ) })}
        </div>
      </div>
    </section>
  );

  // ── 5. plan link ──
  const renderPlan = () => (
    <section className="tk-sec" id="wr-s5">
      {secHead(S.plan, 'إن كانت الورشة تنفّذ مستهدفًا في خطتك التنفيذية، اربطها به ليظهر ذلك للمراجعين.')}
      <div className="tk-panel">
        <div className="tk-grid">
          {field({ key: 'pl', label: 'الخطة التنفيذية', for: 'wr-plan', control: (
            <select className="tk-in" id="wr-plan" value={data.plan.planId} disabled={locked || !plans.length} onChange={(e) => linkPlan(e.target.value)}>
              <option value="">{plans.length ? 'بدون ربط' : 'لا توجد لديك خطط تنفيذية'}</option>
              {plans.map(p => <option key={p.id || p.planId} value={p.id || p.planId}>{fmtPlanNo(p.number != null ? p.number : p.planNumber)} — {p.title || 'خطة بلا فترة'}</option>)}
            </select>
          ) })}
          {field({ key: 'tg', label: 'المستهدف', for: 'wr-target', control: (
            <select className="tk-in" id="wr-target" value={data.plan.targetId} disabled={locked || !data.plan.planId} onChange={(e) => linkTarget(e.target.value)}>
              <option value="">{data.plan.planId ? 'اختر المستهدف…' : 'اختر الخطة أولًا'}</option>
              {planTargets.map((t, i) => <option key={t.id} value={t.id}>{i + 1}. {t.name || 'مستهدف بلا اسم'}</option>)}
              {data.plan.targetId && !planTargets.some(t => t.id === data.plan.targetId) && <option value={data.plan.targetId}>{data.plan.targetName || 'المستهدف المرتبط'}</option>}
            </select>
          ) })}
        </div>
      </div>
    </section>
  );

  // ── 6. notes + completion ──
  const renderDone = () => {
    const list = showAll ? A.issues : A.issues.slice(0, 8);
    return (
      <section className="tk-sec" id="wr-s6">
        {secHead(S.done, 'ما يحتاج المراجعون معرفته، ثم ما تبقى قبل الإرسال.')}
        <div className="tk-panel">
          {field({ key: 'nt', label: 'ملاحظات للمراجعين', for: idOf('notes'), control: area('notes', { rows: 2, ph: 'مثال: الورشة ضمن برنامج الإجازة، والخامات متوفرة في المعمل.' }) })}
        </div>
        <div className="tk-panel">
          <div className="tk-done-top">
            <b className="tk-big">{A.pct}%</b>
            <div><div className="tk-meter lg"><i style={{ width: `${A.pct}%` }} /></div><p className="tk-done-sum">{A.issues.length ? `عدد الملاحظات المتبقية: ${A.issues.length}. اضغط أي ملاحظة للانتقال إلى موضعها.` : 'اكتملت جميع بيانات الطلب.'}</p></div>
          </div>
          {A.issues.length > 0 && (
            <div className="tk-issues">
              {list.map((x, k) => <button type="button" key={k} className="tk-issue" onClick={() => goto(x.target)}>{x.text}</button>)}
              {A.issues.length > 8 && <button type="button" className="tk-more" onClick={() => setShowAll(v => !v)}>{showAll ? 'عرض أقل' : `عرض الكل (${A.issues.length})`}</button>}
            </div>
          )}
          <p className="tk-muted-s" style={{ marginTop: 12 }}>عند اعتماد المدير للطلب تُنشأ الورشة تلقائيًا في نظام الورش التدريبية بهذه البيانات.</p>
        </div>
      </section>
    );
  };

  // ── chrome ──
  const ringFor = (key) => {
    if (key === 'done') return A.pct;
    if (key === 'plan') return 100;
    const s = A.sec[key] || { done: 0, total: 0 };
    return s.total ? Math.floor((s.done / s.total) * 100) : 100;
  };
  const no = fmtWrNo(doc.number != null ? doc.number : doc.requestNumber);
  const lastV = (doc.versions || [])[(doc.versions || []).length - 1];
  const returnedFrom = doc.status === 'returned' && lastV ? (doc.returnedBy === 'manager'
    ? { who: lastV.managerName || 'المدير', at: lastV.managerAt, text: lastV.managerComment }
    : { who: lastV.pmName || 'مسؤول إدارة المشاريع', at: lastV.pmAt, text: lastV.pmComment }) : null;
  const saveText = save.state === 'pending' ? 'جارٍ الحفظ…' : save.state === 'error' ? (save.msg || 'تعذّر الحفظ') : save.state === 'ok' ? `محفوظ · ${save.at?.toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}` : 'التعديلات تُحفظ تلقائيًا';
  const chips = [
    data.kit.kitNo,
    D.days ? ar(D.days, DAYS) : '',
    num(data.maxParticipants) ? ar(num(data.maxParticipants), SEATS) : '',
    num(data.price) === 0 ? 'مجانية' : num(data.price) ? `${fmt(num(data.price))} ر.س` : '',
    data.isPublic ? 'عامة' : 'خاصة'
  ].filter(Boolean);

  return (
    <Portal target={portalTarget}>
      <div ref={scrollRef} className={`tk tk-overlay wr ${hints ? '' : 'no-hints'}`} data-theme={theme} dir="rtl" lang="ar">
        <header className="tk-top">
          <button type="button" className="tk-btn ghost" onClick={close}>→ <span className="hide-sm">رجوع</span></button>
          <div className="tk-top-title"><b>{data.title || 'طلب ورشة جديد'}</b><span className="mono">{no}</span></div>
          <span className="tk-sp" />
          <span className={`tk-save ${save.state === 'pending' ? 'pending' : save.state === 'error' ? 'err' : ''}`} role="status"><i aria-hidden="true" /><span className="hide-sm">{saveText}</span></span>
          {(doc.versions || []).length > 0 && <button type="button" className="tk-btn" onClick={() => setHistoryOpen(true)}>🕘 <span className="hide-sm">السجل</span></button>}
          <button type="button" className="tk-btn" onClick={preview} title="معاينة الطلب كمستند وطباعته">🖨 <span className="hide-sm">معاينة</span></button>
          {!locked && <button type="button" className="tk-btn primary" onClick={openSubmit}>📨 <span className="hide-sm">{resubmission ? 'إعادة الإرسال' : 'إرسال للمراجعة'}</span></button>}
        </header>

        <section className="tk-band" aria-label="ملخص الطلب">
          <div className="tk-band-in">
            <div>
              <p className="tk-eyebrow"><span>طلب ورشة · {no}</span></p>
              <h1 className={data.title ? '' : 'empty'}>{data.title || 'ورشة بلا عنوان'}</h1>
              {has(data.description) && <p className="tk-band-desc">{data.description}</p>}
              {chips.length > 0 && <ul className="tk-chips">{chips.map(c => <li key={c}>{c}</li>)}</ul>}
            </div>
            <dl className="tk-tblock">
              <div><dt>تاريخ البداية</dt><dd>{has(data.startDate) ? fmtDay(data.startDate) : '—'}</dd></div>
              <div><dt>الحالة</dt><dd>{statusOf(doc, true).label}</dd></div>
              <div className="span"><dt>إصدارات مُرسلة</dt><dd>{doc.currentVersion ? `${doc.currentVersion} — آخرها ${fmtDay(doc.submittedAt)}` : 'لم يُرسل بعد'}</dd></div>
              <div className="span"><dt>اكتمال الطلب</dt><dd className="tk-pct"><span className="mono">{A.pct}%</span><span className="tk-meter"><i style={{ width: `${A.pct}%` }} /></span></dd></div>
            </dl>
          </div>
        </section>

        {(returnedFrom || locked || (kitFull && !kitOk)) && (
          <div className="tk-wrap" style={{ display: 'grid', gap: 10 }}>
            {returnedFrom && (
              <div className="tk-note red">
                <span className="tk-note-ico">↩</span>
                <div>
                  <b>أعاد {returnedFrom.who} الطلب للتعديل (الإصدار {doc.currentVersion}) · {fmtDay(returnedFrom.at)}</b>
                  <div className="tk-quote">{returnedFrom.text}</div>
                  <div className="tk-muted-s" style={{ marginTop: 6 }}>عدّل ما يلزم ثم اضغط «إعادة الإرسال» — تُحفظ النسخة السابقة في السجل.</div>
                </div>
              </div>
            )}
            {kitFull && !kitOk && !locked && (
              <div className="tk-note red"><span className="tk-note-ico">⚠</span><div><b>الحقيبة {data.kit.kitNo} لم تعد معتمدة</b>لا يمكن إرسال الطلب حتى تُعتمد الحقيبة من جديد.</div></div>
            )}
            {locked && <div className="tk-note cyan"><span className="tk-note-ico">🔒</span><div><b>الطلب قيد المراجعة</b>لا يمكن تعديله حتى يصدر قرار المراجعة.</div></div>}
          </div>
        )}

        <div className="tk-layout">
          <nav className="tk-nav" aria-label="أقسام الطلب">
            <ol>
              {SECTIONS.map(s => {
                const pct = ringFor(s.key);
                return (
                  <li key={s.id}>
                    <a className={active === s.id ? 'on' : ''} onClick={(e) => { e.preventDefault(); goto(s.id); }} href={`#${s.id}`}>
                      <span className="n">{s.n}</span><span>{s.t}</span>
                      {pct >= 100 ? <span className="tk-ring done">✓</span> : <span className="tk-ring part" style={{ '--p': pct }} title={`اكتمال ${pct}%`} />}
                    </a>
                  </li>
                );
              })}
            </ol>
            <div className="tk-nav-foot">
              <div className="row"><span>اكتمال الطلب</span><b>{A.pct}%</b></div>
              <div className="tk-meter"><i style={{ width: `${A.pct}%` }} /></div>
              <button type="button" className={`tk-linkbtn ${A.issues.length ? '' : 'ok'}`} onClick={() => goto('wr-s6')}>{A.issues.length ? `${ar(A.issues.length, NOTES)} للمراجعة` : 'الطلب مكتمل'}</button>
              <label className="tk-hints-toggle"><input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} /> إرشادات التعبئة</label>
            </div>
          </nav>
          <main className="tk-main">
            {renderKit()}
            {renderInfo()}
            {renderSchedule()}
            {renderReg()}
            {renderPlan()}
            {renderDone()}
          </main>
        </div>

        <datalist id="wr-dl-rooms">{ROOMS.map(x => <option key={x} value={x} />)}</datalist>

        {pickOpen && (
          <Modal onClose={() => setPickOpen(false)} labelledBy="wr-pick-title">
            <h3 id="wr-pick-title">اختر صورة الغلاف من صور الحقيبة</h3>
            <div className="tk-igrid wr-pick">
              {kitImages.map(im => (
                <button type="button" className="tk-itile wr-pick-btn" key={im.fileId} onClick={() => coverFromKit(im)}>
                  <div className="ph"><AuthedImage api={api} url={`/training-kits/mine/files/${im.fileId}`} alt={im.caption || 'صورة مرجعية'} /></div>
                  <span className="meta">{im.caption || im.name}</span>
                </button>
              ))}
            </div>
            <div className="tk-modal-actions"><button type="button" className="tk-btn" onClick={() => setPickOpen(false)}>إلغاء</button></div>
          </Modal>
        )}

        {submitOpen && (
          <Modal onClose={() => !sending && setSubmitOpen(false)} labelledBy="wr-submit-title">
            <h3 id="wr-submit-title">{resubmission ? `إعادة إرسال الطلب — الإصدار ${doc.currentVersion + 1}` : 'إرسال طلب الورشة للمراجعة'}</h3>
            <p>يُرسل الطلب إلى <b>{doc.pm || 'مسؤول إدارة المشاريع'}</b> للمراجعة، ثم إلى المدير. عند اعتماد المدير تُنشأ الورشة «{data.title}» في نظام الورش تلقائيًا. لا يمكن تعديل الطلب أثناء المراجعة.</p>
            <div className="tk-stat-row">
              <b>{A.pct}%</b>
              <div>
                <div>اكتمال الطلب</div>
                <div className="tk-muted-s">{A.issues.length ? `${ar(A.issues.length, NOTES)} لم تُستكمل بعد — يراها المراجعون أيضًا.` : 'جميع البيانات مكتملة.'}</div>
              </div>
            </div>
            <div className="tk-field">
              <label className="tk-lbl" htmlFor="wr-submit-note">{resubmission ? <>ما الذي عدّلته في هذا الإصدار؟ <span className="tk-req">*</span></> : 'ملاحظة للمراجِعة (اختياري)'}</label>
              <AutoArea id="wr-submit-note" rows={3} value={note} onChange={setNote} placeholder={resubmission ? 'مثال: غيّرت موعد الورشة وأضفت صورة الغلاف.' : ''} />
            </div>
            <div className="tk-modal-actions">
              <button type="button" className="tk-btn ghost" onClick={() => setSubmitOpen(false)} disabled={sending}>إلغاء</button>
              <button type="button" className="tk-btn primary" onClick={submit} disabled={sending || (resubmission && !note.trim())}>{sending ? 'جارٍ الإرسال…' : '📨 إرسال'}</button>
            </div>
          </Modal>
        )}

        {historyOpen && (
          <Modal onClose={() => setHistoryOpen(false)} labelledBy="wr-hist-title">
            <h3 id="wr-hist-title">سجل الإصدارات والملاحظات</h3>
            <KitHistory versions={doc.versions} currentVersion={doc.currentVersion} diff={diffData} the="الطلب"
              onView={(n) => printDocument(api, R.doc(id), { version: n }).catch(err => toast.error(errorText(err, 'تعذّر فتح الإصدار')))} />
            <div className="tk-modal-actions"><button type="button" className="tk-btn" onClick={() => setHistoryOpen(false)}>إغلاق</button></div>
          </Modal>
        )}
      </div>
    </Portal>
  );
};

export default WorkshopRequestEditor;
