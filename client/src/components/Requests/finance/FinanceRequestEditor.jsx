import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  KINDS, SECTIONS, SOURCES, METHODS, BASES, MAKE, VAT_RATE,
  normalize, analyze, idOf, getPath, setPath, has, num, money, pct, cleanIban, fmtReqNo, diffData
} from './frModel';
import { FR_KIND } from './frKind';
import { normalize as normalizeKit, derive as deriveKit, fmtKitNo, fmtDay, humanSize, statusOf, ar, NOTES } from '../../TrainingKits/kitModel';
import { AutoArea, Seg, Portal, useBodyLock, Modal, KitHistory } from '../../TrainingKits/KitParts';
import { uploadFile, downloadFile, printDocument, errorText } from '../../TrainingKits/kitApi';
import '../../TrainingKits/TrainingKits.css';
import './Finance.css';

const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
const HINTS_KEY = 'tk_hints';
const R = FR_KIND.routes.mine;
const SECTION_NAMES = ['الإلكترونيات والبرمجة', 'الليزر CNC', 'الخشب CNC', 'المعادن CNC', 'الطباعة ثلاثية الأبعاد', 'الروبوتات والذكاء الاصطناعي', 'نادي الأطفال', 'قطع الفينيل', 'طباعة UV والملصقات'];
// Item section guessed from the request's section (for imported rows).
const guessSection = (s) => SECTIONS.find(x => x !== 'عام / أخرى' && String(s || '').includes(x.split(' ')[0])) || '';
const rs = (n) => <>{money(n)}<small> ر.س</small></>;
const docNo = (d) => fmtReqNo(d.number != null ? d.number : d.requestNumber);
const kitNo = (k) => fmtKitNo(k.number != null ? k.number : k.kitNumber);
const planNo = (p) => `EP-${String(p.number != null ? p.number : p.planNumber).padStart(3, '0')}`;

/**
 * The employee's financial request (طلب صرف مالي — «الملف المالي
 * التفصيلي»): the Excel's costing, in the system's style. Saves as you
 * type; «إرسال للمراجعة» freezes a version and sends it to the project
 * manager, then the manager, who prints and signs it.
 */
const FinanceRequestEditor = ({ api, doc, portalTarget, theme = 'dark', onClose, onSubmitted }) => {
  useBodyLock();
  const [data, setData] = useState(() => normalize(doc.data));
  const [save, setSave] = useState({ state: 'idle', at: null });
  const [hints, setHints] = useState(() => { try { return localStorage.getItem(HINTS_KEY) !== '0'; } catch { return true; } });
  const [active, setActive] = useState('fr-s-header');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState([]);
  const [kits, setKits] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planTargets, setPlanTargets] = useState(null); // targets of the plan being linked
  const [importing, setImporting] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const dirty = useRef(false);
  const latest = useRef(data);
  const quoteInput = useRef(null);
  const id = doc.id || doc.requestId;

  const A = useMemo(() => analyze(data), [data]);
  const C = A.C;
  const locked = !['draft', 'returned'].includes(doc.status);
  const h = data.header;
  const f = data.funding;

  // The employee's kits and plans, to link the request to.
  useEffect(() => {
    api.get('/training-kits/mine').then(({ data: list }) => setKits(Array.isArray(list) ? list : [])).catch(() => {});
    api.get('/execution-plans/mine').then(({ data: list }) => setPlans(Array.isArray(list) ? list : [])).catch(() => {});
  }, [api]);

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
    const fe = el.matches('input,select,textarea,button') ? el : el.querySelector('textarea,input,select,button');
    const ring = el.closest('.tk-field,.tk-rt-row,.tk-panel') || el;
    setTimeout(() => {
      if (fe) fe.focus({ preventScroll: true });
      ring.classList.remove('tk-flash'); void ring.offsetWidth; ring.classList.add('tk-flash');
    }, 380);
  };

  // ── lists ──
  const addItem = (i) => update(n => {
    const p = n.projects[i];
    const last = p.items[p.items.length - 1];
    p.items.push(MAKE.item(last?.section || guessSection(n.header.section)));
  });
  const removeAt = (path, j) => update(n => { getPath(n, path).splice(j, 1); });
  const addProject = () => {
    const p = MAKE.project();
    p.items[0].section = guessSection(h.section);
    update(n => { n.projects.push(p); });
    setTimeout(() => goto(`fr-p-${p.id}`), 120);
  };
  const removeProject = (i) => {
    const p = data.projects[i];
    if (p.items.some(x => has(x.item)) && !window.confirm(`حذف «${p.name || `المشروع ${i + 1}`}» بكل بنوده؟`)) return;
    removeAt('projects', i);
  };

  // The linked kit's needs (with its computed totals) as item rows.
  const importKitNeeds = async (i) => {
    if (!h.kitId) return;
    setImporting(i);
    try {
      const { data: kit } = await api.get(`/training-kits/mine/${h.kitId}`);
      const k = normalizeKit(kit.data);
      const D = deriveKit(k);
      const needs = k.needs.filter(x => has(x.item));
      if (!needs.length) { toast.info('لا توجد احتياجات مسجّلة في الحقيبة'); return; }
      const section = guessSection(h.section);
      update(n => {
        const p = n.projects[i];
        p.items = p.items.filter(x => has(x.item) || has(x.qty) || has(x.unit));
        needs.forEach(x => {
          const t = D.needTotal(x);
          p.items.push({
            ...MAKE.item(section),
            item: x.item,
            specs: x.specs || '',
            qty: t != null ? t : (num(x.qty) != null ? num(x.qty) : ''),
            notes: [x.unit, x.notes].filter(Boolean).join(' — ')
          });
        });
      });
      toast.success(`أُضيف ${needs.length === 1 ? 'بند واحد' : needs.length === 2 ? 'بندان' : `${needs.length} بنود`} من الحقيبة — اكتب تكلفة المفرد لكل بند`);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر قراءة احتياجات الحقيبة'));
    } finally {
      setImporting(null);
    }
  };

  // ── links ──
  const linkKit = (kid) => update(n => {
    const k = kits.find(x => (x.id || x.kitId) === kid);
    n.header.kitId = k ? kid : '';
    n.header.kitNo = k ? kitNo(k) : '';
    n.header.kitTitle = k ? (k.title || '') : '';
  });
  const pickPlan = async (pid) => {
    if (!pid) { setPlanTargets(null); return; }
    try {
      const { data: p } = await api.get(`/execution-plans/mine/${pid}`);
      setPlanTargets({ plan: p, targets: (p.data?.targets || []).map((t, i) => ({ id: t.id, label: `المستهدف ${i + 1}${t.name ? ` — ${t.name}` : ''}`, name: t.name || '' })) });
    } catch (err) {
      toast.error(errorText(err, 'تعذّر فتح الخطة'));
    }
  };
  const linkTarget = (tid) => {
    const t = planTargets?.targets.find(x => x.id === tid);
    if (!t) return;
    update(n => {
      n.header.planId = planTargets.plan.id || planTargets.plan.planId;
      n.header.planNo = planNo(planTargets.plan);
      n.header.targetId = t.id;
      n.header.targetName = t.name;
    });
    setPlanTargets(null);
  };
  const unlinkPlan = () => update(n => { n.header.planId = ''; n.header.planNo = ''; n.header.targetId = ''; n.header.targetName = ''; });

  // ── quotations ──
  const addQuotes = async (files) => {
    for (const file of Array.from(files || [])) {
      setBusy(b => [...b, file.name]);
      try {
        const up = await uploadFile(api, id, file, 'attachment', R.upload(id));
        update(n => { n.quotes.push({ fileId: up.fileId, name: up.name, size: up.size, mime: up.mime }); });
      } catch (err) {
        toast.error(errorText(err, `تعذّر رفع الملف ${file.name}`));
      } finally {
        setBusy(b => b.filter(x => x !== file.name));
      }
    }
  };
  const dropQuote = (j) => {
    const q = data.quotes[j];
    if (q) api.delete(R.dropFile(id, q.fileId)).catch(() => {});
    removeAt('quotes', j);
  };
  const download = (q) => downloadFile(api, R.file(q.fileId), q.name).catch(err => toast.error(errorText(err, 'تعذّر التنزيل')));

  const preview = async () => {
    await persist();
    printDocument(api, R.doc(id), { draft: 1 }).catch(err => toast.error(errorText(err, 'تعذّر تجهيز المعاينة')));
  };

  // ── submit ──
  const resubmission = doc.currentVersion > 0;
  const openSubmit = () => {
    if (!has(h.title)) { toast.error('اكتب اسم البرنامج أو النشاط قبل الإرسال'); goto(idOf('header.title')); return; }
    setSubmitOpen(true);
  };
  const submit = async () => {
    if (resubmission && !note.trim()) { toast.error('اكتب ما الذي عدّلته في هذا الإصدار'); return; }
    setSending(true);
    try {
      if (!(await persist())) throw new Error('save');
      const { data: updated } = await api.post(R.submit(id), { note: note.trim() });
      toast.success(`أُرسل طلب الصرف إلى ${doc.pm || 'مسؤول إدارة المشاريع'} — الإصدار ${updated.currentVersion}`);
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
    <input className={`tk-in ${o.cls || ''}`} type="text" id={idOf(path)} value={val(path)} placeholder={o.ph || ''} list={o.list} dir={o.dir}
      aria-label={o.label} autoComplete="off" disabled={locked} onChange={(e) => set(path, o.transform ? o.transform(e.target.value) : e.target.value)} />
  );
  const area = (path, o = {}) => (
    <AutoArea id={idOf(path)} value={val(path)} rows={o.rows || 1} placeholder={o.ph || ''} aria-label={o.label} disabled={locked} onChange={(v) => set(path, v)} />
  );
  const numIn = (path, o = {}) => {
    const input = (
      <input className="tk-in num" type="number" inputMode="decimal" id={idOf(path)} value={val(path)} min={o.min == null ? 0 : o.min} step={o.step || 'any'}
        placeholder={o.ph == null ? '' : String(o.ph)} aria-label={o.label} disabled={locked}
        onChange={(e) => { const v = e.target.value; set(path, v === '' ? '' : (isFinite(+v) ? +v : '')); }} />
    );
    return o.sfx ? <span className="tk-affix" style={o.sfxW ? { '--sfx': `${o.sfxW}px` } : undefined}>{input}<span className="sfx">{o.sfx}</span></span> : input;
  };
  const dateIn = (path, label) => (
    <input className="tk-in" type="date" id={idOf(path)} value={val(path)} aria-label={label} disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const select = (path, opts, o = {}) => (
    <select className="tk-in" id={idOf(path)} value={val(path)} aria-label={o.label} disabled={locked} onChange={(e) => set(path, e.target.value)}>
      {o.ph !== null && <option value="">{o.ph || 'اختر…'}</option>}
      {opts.map(x => { const v = typeof x === 'string' ? x : x.v; const l = typeof x === 'string' ? x : x.l; return <option key={v} value={v}>{l}</option>; })}
    </select>
  );
  const seg = (path, opts, labelId) => <Seg id={idOf(path)} options={opts} value={val(path)} labelledBy={labelId} onChange={(v) => !locked && set(path, v)} />;
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
  const panelHead = (t, n) => (
    <div className="tk-panel-head"><h3 className="tk-panel-title">{t}</h3>{n && <p className="tk-panel-note">{n}</p>}</div>
  );
  const rm = (path, j, label) => !locked && (
    <button type="button" className="tk-ibtn danger" onClick={() => removeAt(path, j)} aria-label={label} title={label}>🗑</button>
  );
  const secHead = (n, title, desc, key) => {
    const c = key === 'done' ? A.issues.length : A.issues.filter(x => x.sec === key).length;
    return (
      <header className="tk-sec-head">
        <span className="tk-sec-num">{n}</span>
        <div><h2>{title}</h2>{desc && <p className="tk-sec-desc">{desc}</p>}</div>
        <span className={`tk-pill ${c ? 'amber' : 'mint'}`}>{c ? ar(c, NOTES) : 'مكتمل'}</span>
      </header>
    );
  };

  // ── 1. header ──
  const renderHeader = () => (
    <section className="tk-sec" id="fr-s-header">
      {secHead('◆', 'بيانات الطلب', 'البرنامج أو النشاط الذي يُطلب له الصرف، ومدته وعدد المستفيدين — تُبنى عليها حسابات الطلب.', 'header')}
      <div className="tk-panel">
        <div className="tk-grid">
          {field({ key: 't', label: 'اسم البرنامج / النشاط', req: 1, wide: 1, for: idOf('header.title'), control: text('header.title', { ph: 'مثال: معسكر الذراع الآلي' }) })}
          {field({ key: 'k', label: 'نوع النشاط', req: 1, wide: 1, labelId: 'frl-kind', control: seg('header.kind', KINDS, 'frl-kind') })}
          {field({ key: 's', label: 'القسم', req: 1, for: idOf('header.section'), control: text('header.section', { list: 'fr-dl-sections' }) })}
          {field({ key: 'r', label: 'مقدم الطلب', req: 1, for: idOf('header.requester'), control: text('header.requester') })}
          {field({ key: 'd', label: 'تاريخ التنفيذ', req: 1, for: idOf('header.startDate'), hint: 'من — إلى', control: <div className="tk-pair">{dateIn('header.startDate', 'تاريخ البداية')}<span className="sep">إلى</span>{dateIn('header.endDate', 'تاريخ النهاية')}</div> })}
          {field({ key: 'n', label: 'عدد الأيام والمستفيدين', req: 1, for: idOf('header.days'), hint: 'تُحسب منها أجور الموارد البشرية والضيافة وقيمة التسجيل.', control: (
            <div className="tk-pair">{numIn('header.days', { sfx: 'أيام', min: 1, step: '1', ph: '6', label: 'عدد الأيام' })}<span className="sep">·</span>{numIn('header.beneficiaries', { sfx: 'مستفيد', sfxW: 54, min: 1, step: '1', ph: '15', label: 'عدد المستفيدين' })}</div>
          ) })}
        </div>
      </div>
      <div className="tk-panel">
        {panelHead('الارتباط بالخطة والحقيبة', 'اختياري — يربط الطلب بمستهدف في خطتك التنفيذية، وبالحقيبة التدريبية لاستيراد احتياجاتها.')}
        <div className="tk-grid">
          {field({ key: 'pl', label: 'المستهدف في الخطة التنفيذية', labelId: 'frl-plan', control: has(h.targetId) ? (
            <span className="tk-chip fr-link"><bdi>🗓 {h.planNo} — {h.targetName || 'مستهدف'}</bdi>{!locked && <button type="button" aria-label="إلغاء الربط بالخطة" onClick={unlinkPlan}>×</button>}</span>
          ) : (
            <div className="fr-linkpick" aria-labelledby="frl-plan">
              <select className="tk-in" value={planTargets ? (planTargets.plan.id || planTargets.plan.planId) : ''} disabled={locked || !plans.length} aria-label="الخطة التنفيذية" onChange={(e) => pickPlan(e.target.value)}>
                <option value="">{plans.length ? 'اختر الخطة…' : 'لا توجد لديك خطط تنفيذية'}</option>
                {plans.map(p => <option key={p.id || p.planId} value={p.id || p.planId}>{planNo(p)} — {p.title || 'خطة بلا فترة'}</option>)}
              </select>
              {planTargets && (
                <select className="tk-in" value="" disabled={locked} aria-label="المستهدف" onChange={(e) => linkTarget(e.target.value)}>
                  <option value="">{planTargets.targets.length ? 'اختر المستهدف…' : 'لا توجد مستهدفات في الخطة'}</option>
                  {planTargets.targets.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              )}
            </div>
          ) })}
          {field({ key: 'kt', label: 'الحقيبة التدريبية', labelId: 'frl-kit', control: has(h.kitId) ? (
            <span className="tk-chip fr-link"><bdi>🎒 {h.kitNo} — {h.kitTitle || 'حقيبة تدريبية'}</bdi>{!locked && <button type="button" aria-label="إلغاء ربط الحقيبة" onClick={() => linkKit('')}>×</button>}</span>
          ) : (
            <select className="tk-in" value="" disabled={locked || !kits.length} aria-labelledby="frl-kit" onChange={(e) => linkKit(e.target.value)}>
              <option value="">{kits.length ? 'اربط حقيبة من حقائبك…' : 'لا توجد لديك حقائب تدريبية'}</option>
              {kits.map(k => <option key={k.id || k.kitId} value={k.id || k.kitId}>{kitNo(k)} — {k.title || 'بلا اسم'} ({statusOf(k).label})</option>)}
            </select>
          ) })}
        </div>
      </div>
    </section>
  );

  // ── 2. projects ──
  const renderProjects = () => (
    <section className="tk-sec" id="fr-s-projects">
      {secHead('1', 'الاحتياجات لكل مشروع', 'بنود المواد والقطع لكل مشروع، مصنفة حسب القسم. الإجمالي = العدد × تكلفة المفرد، وتُضاف ضريبة القيمة المضافة 15٪ للبند الخاضع لها.', 'projects')}
      {data.projects.map((p, i) => {
        const P = C.projects[i];
        const q = `projects.${i}.`;
        const sections = Object.entries(P.bySection).filter(([, v]) => v > 0);
        return (
          <div className="tk-panel fr-proj" id={`fr-p-${p.id}`} key={p.id}>
            <div className="fr-proj-head">
              <span className="tk-code">{i + 1}</span>
              <div className="fr-proj-name">
                <label className="tk-mini" htmlFor={idOf(`${q}name`)}>اسم المشروع <span className="tk-req" aria-hidden="true">*</span></label>
                {text(`${q}name`, { ph: 'مثال: مشروع الذراع الآلي' })}
              </div>
              <div className="fr-proj-total"><span>إجمالي ميزانية المشروع</span><b>{rs(P.total)}</b></div>
              {!locked && data.projects.length > 1 && <button type="button" className="tk-ibtn danger" onClick={() => removeProject(i)} aria-label={`حذف المشروع ${i + 1}`} title="حذف المشروع">🗑</button>}
            </div>
            <div style={{ '--cols': 'minmax(0,1.2fr) minmax(0,1.5fr) minmax(0,1.2fr) 78px 112px 46px 116px minmax(0,.9fr) 32px' }} id={`fr-items-${p.id}`}>
              <div className="tk-rt-head"><span>القسم</span><span>بند الاحتياج</span><span>المواصفات / رابط المورد</span><span>العدد</span><span>تكلفة المفرد</span><span title={`ضريبة القيمة المضافة ${VAT_RATE * 100}٪`}>ض.ق.م</span><span>إجمالي التكلفة</span><span>ملاحظات</span><span /></div>
              <div className="tk-rt-body">
                {!p.items.length && <p className="tk-empty">لا توجد بنود بعد.</p>}
                {p.items.map((x, j) => {
                  const iq = `${q}items.${j}.`;
                  const t = P.items[j];
                  return (
                    <div className="tk-rt-row" key={x.id}>
                      <div className="tk-cell half"><span className="tk-cell-lbl">القسم</span>{select(`${iq}section`, SECTIONS, { label: `قسم البند ${j + 1}` })}</div>
                      <div className="tk-cell"><span className="tk-cell-lbl">بند الاحتياج</span>{area(`${iq}item`, { label: `البند ${j + 1}`, ph: 'مثال: محرك سيرفو بتروس معدنية' })}</div>
                      <div className="tk-cell"><span className="tk-cell-lbl">المواصفات / رابط المورد</span>{area(`${iq}specs`, { label: `مواصفات البند ${j + 1}`, ph: 'المواصفات أو رابط المنتج' })}</div>
                      <div className="tk-cell half"><span className="tk-cell-lbl">العدد</span>{numIn(`${iq}qty`, { label: `عدد البند ${j + 1}`, step: '1' })}</div>
                      <div className="tk-cell half"><span className="tk-cell-lbl">تكلفة المفرد</span>{numIn(`${iq}unit`, { label: `تكلفة مفرد البند ${j + 1}`, sfx: 'ر.س', sfxW: 30, step: '0.01' })}</div>
                      <div className="tk-cell half fr-vat"><span className="tk-cell-lbl">ض.ق.م 15٪</span>
                        <label className="fr-check" title="خاضع لضريبة القيمة المضافة 15٪"><input type="checkbox" checked={!!x.vat} disabled={locked} onChange={(e) => set(`${iq}vat`, e.target.checked)} aria-label={`ضريبة القيمة المضافة للبند ${j + 1}`} /><span className="hide-wide">خاضع للضريبة 15٪</span></label>
                      </div>
                      <div className="tk-cell half"><span className="tk-cell-lbl">إجمالي التكلفة</span><output className="tk-total">{t.total ? <>{money(t.total)}<small>ر.س</small></> : <span className="dim">—</span>}</output>{t.vat > 0 && <small className="fr-vatnote">منها ضريبة {money(t.vat)}</small>}</div>
                      <div className="tk-cell"><span className="tk-cell-lbl">ملاحظات</span>{area(`${iq}notes`, { label: `ملاحظات البند ${j + 1}` })}</div>
                      <div className="tk-cell act">{rm(`${q}items`, j, `حذف البند ${j + 1}`)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="tk-list-foot fr-proj-foot">
              {!locked && <button type="button" className="tk-add" onClick={() => addItem(i)}>＋ إضافة بند</button>}
              {!locked && has(h.kitId) && <button type="button" className="tk-add" onClick={() => importKitNeeds(i)} disabled={importing === i}>📥 {importing === i ? 'جارٍ الاستيراد…' : 'استيراد الاحتياجات من الحقيبة'}</button>}
              {sections.length > 0 && (
                <div className="fr-secsum" aria-label="التكلفة الكلية لكل قسم">
                  {sections.map(([k, v]) => <span key={k}>{k}: <b>{money(v)}</b></span>)}
                  {P.vat > 0 && <span>منها ضريبة: <b>{money(P.vat)}</b></span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {!locked && (
        <div className="fr-add-wrap" id="fr-add-project">
          <button type="button" className="tk-btn" onClick={addProject}>＋ إضافة مشروع</button>
          <span className="tk-muted-s">مثل: مشروع الذراع الآلي، مشروع pinball… لكل مشروع بنوده وإجماليه.</span>
        </div>
      )}
    </section>
  );

  // ── 3. staff ──
  const renderStaff = () => (
    <section className="tk-sec" id="fr-s-staff">
      {secHead('2', 'الموارد البشرية', `تكلفة اليوم = أجر الساعة × الساعات اليومية، والإجمالي = العدد × تكلفة اليوم × الأيام${C.days ? ` (${ar(C.days, ['يوم واحد', 'يومان', 'أيام', 'يومًا'])} ما لم تحدد غير ذلك)` : ''}.`, 'staff')}
      <div className="tk-panel">
        <div style={{ '--cols': 'minmax(0,1.3fr) 76px 112px 84px 104px 76px 118px minmax(0,1fr) 36px' }}>
          <div className="tk-rt-head"><span>البند</span><span>العدد</span><span>أجر الساعة</span><span>ساعات/يوم</span><span>تكلفة اليوم</span><span>الأيام</span><span>التكلفة الإجمالية</span><span>ملاحظات</span><span /></div>
          <div className="tk-rt-body">
            {data.staff.map((x, i) => {
              const q = `staff.${i}.`;
              const S = C.staff[i];
              return (
                <div className={`tk-rt-row ${(num(x.count) || 0) > 0 ? '' : 'fr-idle'}`} key={x.id}>
                  <div className="tk-cell"><span className="tk-cell-lbl">البند</span>{x.fixed ? <span className="tk-role">{x.role}</span> : text(`${q}role`, { ph: 'مسمى الدور', label: 'مسمى الدور' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">العدد</span>{numIn(`${q}count`, { label: `عدد: ${x.role || 'الدور'}`, step: '1', ph: '0' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">أجر الساعة</span>{numIn(`${q}rate`, { label: `أجر الساعة: ${x.role || 'الدور'}`, sfx: 'ر.س', sfxW: 30 })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">ساعات/يوم</span>{numIn(`${q}hours`, { label: `الساعات اليومية: ${x.role || 'الدور'}`, step: '0.5' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">تكلفة اليوم</span><output className="tk-total">{S.perDay ? money(S.perDay) : <span className="dim">—</span>}</output></div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">الأيام</span>{numIn(`${q}days`, { label: `الأيام: ${x.role || 'الدور'}`, step: '1', ph: C.days || '' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">التكلفة الإجمالية</span><output className="tk-total">{S.total ? <>{money(S.total)}<small>ر.س</small></> : <span className="dim">—</span>}</output></div>
                  <div className="tk-cell"><span className="tk-cell-lbl">ملاحظات</span>{area(`${q}notes`, { label: `ملاحظات: ${x.role || 'الدور'}` })}</div>
                  <div className="tk-cell act">{!x.fixed && rm('staff', i, 'حذف الدور')}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="tk-list-foot">
          {!locked && <button type="button" className="tk-add" onClick={() => update(n => { n.staff.push(MAKE.staff('', '', false)); })}>＋ إضافة دور</button>}
          <span className="fr-subtotal">إجمالي الموارد البشرية: <b>{rs(C.staffTotal)}</b></span>
        </div>
      </div>
    </section>
  );

  // ── 4. hospitality & other ──
  const renderHosp = () => (
    <section className="tk-sec" id="fr-s-hosp">
      {secHead('3', 'الضيافة والبنود الأخرى', 'الحفل الختامي والهدايا (لكل مستفيد)، والسناكات (لكل مستفيد يوميًا)، وأي بند آخر بالعدد.', 'hosp')}
      <div className="tk-panel">
        <div style={{ '--cols': 'minmax(0,1.3fr) 150px 84px 118px 76px 118px minmax(0,1fr) 36px' }}>
          <div className="tk-rt-head"><span>البند</span><span>أساس الحساب</span><span>العدد</span><span>التكلفة للفرد / للوحدة</span><span>الأيام</span><span>التكلفة الإجمالية</span><span>ملاحظات</span><span /></div>
          <div className="tk-rt-body">
            {data.hospitality.map((x, i) => {
              const q = `hospitality.${i}.`;
              const H = C.hospitality[i];
              const byPerson = x.basis !== 'unit';
              return (
                <div className="tk-rt-row" key={x.id}>
                  <div className="tk-cell"><span className="tk-cell-lbl">البند</span>{x.fixed ? <span className="tk-role">{x.item}</span> : text(`${q}item`, { ph: 'مثال: نقل المشاركين', label: 'البند' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">أساس الحساب</span>{select(`${q}basis`, BASES, { ph: null, label: `أساس حساب ${x.item || 'البند'}` })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">العدد</span>{byPerson ? <output className="tk-total fr-auto" title="= عدد المستفيدين">{C.ben || '—'}</output> : numIn(`${q}count`, { label: `عدد ${x.item || 'البند'}`, step: '1' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">التكلفة للفرد / للوحدة</span>{numIn(`${q}unit`, { label: `تكلفة ${x.item || 'البند'}`, sfx: 'ر.س', sfxW: 30, ph: x.fixed ? (x.basis === 'person' ? '40' : '5') : '' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">الأيام</span>{x.basis === 'unit' ? numIn(`${q}days`, { label: `أيام ${x.item || 'البند'}`, step: '1', ph: '1' }) : <output className="tk-total fr-auto" title={x.basis === 'personDay' ? '= أيام البرنامج' : 'مرة واحدة'}>{H.usedDays || '—'}</output>}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">التكلفة الإجمالية</span><output className="tk-total">{H.total ? <>{money(H.total)}<small>ر.س</small></> : <span className="dim">—</span>}</output></div>
                  <div className="tk-cell"><span className="tk-cell-lbl">ملاحظات</span>{area(`${q}notes`, { label: `ملاحظات ${x.item || 'البند'}` })}</div>
                  <div className="tk-cell act">{!x.fixed && rm('hospitality', i, 'حذف البند')}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="tk-list-foot">
          {!locked && <button type="button" className="tk-add" onClick={() => update(n => { n.hospitality.push(MAKE.hosp('', 'unit', false)); })}>＋ إضافة بند</button>}
          <span className="fr-subtotal">إجمالي الضيافة والبنود الأخرى: <b>{rs(C.hospTotal)}</b></span>
        </div>
      </div>
    </section>
  );

  // ── 5. pricing ──
  const renderPricing = () => (
    <section className="tk-sec" id="fr-s-pricing">
      {secHead('4', 'التكلفة الإجمالية والتسعير', 'تُحسب آليًا من البنود أعلاه. حدد نسبة الدخل وقيمة التسجيل المقترحة بعد الخصم.', 'pricing')}
      <div className="tk-panel">
        <div className="fr-sum">
          <div className="fr-sum-rows">
            <div><span>المشاريع (المواد والاحتياجات)</span><b>{rs(C.projectsTotal)}</b></div>
            <div><span>الموارد البشرية</span><b>{rs(C.staffTotal)}</b></div>
            <div><span>الضيافة والبنود الأخرى</span><b>{rs(C.hospTotal)}</b></div>
            <div className="tot"><span>المجموع — تكلفة البرنامج</span><b>{rs(C.cost)}</b></div>
          </div>
          <div className="tk-grid fr-pricing">
            {field({ key: 'ir', label: 'نسبة الدخل', req: 1, for: idOf('pricing.incomeRate'), hint: 'النسبة المضافة إلى التكلفة (30٪ في النموذج).', control: numIn('pricing.incomeRate', { sfx: '٪', sfxW: 20, step: '1' }),
              calc: `الدخل ${money(C.income)} ر.س · المجموع الكلي ${money(C.grand)} ر.س` })}
            {field({ key: 'fee', label: 'قيمة تسجيل المستفيد بعد الخصم', req: 1, for: idOf('pricing.fee'), hint: '0 إذا كان البرنامج مجانيًا للمستفيد.', control: numIn('pricing.fee', { sfx: 'ر.س', sfxW: 30 }),
              calc: C.perBen != null ? `قبل الخصم: ${money(C.perBen)} ر.س للمستفيد${C.discountPct != null ? ` · الخصم ${pct(Math.max(0, C.discountPct))}` : ''}${C.revenue != null ? ` · الإيراد المتوقع ${money(C.revenue)} ر.س` : ''}` : '',
              idle: 'حدد عدد المستفيدين لحساب قيمة التسجيل قبل الخصم.' })}
          </div>
        </div>
      </div>
    </section>
  );

  // ── 6. funding ──
  const renderFunding = () => (
    <section className="tk-sec" id="fr-s-funding">
      {secHead('5', 'التمويل والصرف', 'من أين يُموَّل الطلب وكيف يُصرف ولمن — تظهر كاملة في النسخة المطبوعة التي يوقّعها المدير.', 'funding')}
      <div className="tk-panel">
        <div className="tk-grid">
          {field({ key: 'src', label: 'مصدر التمويل', req: 1, wide: 1, labelId: 'frl-src', control: <>{seg('funding.source', SOURCES, 'frl-src')}{f.source === 'أخرى' && text('funding.sourceOther', { ph: 'اذكر مصدر التمويل', label: 'مصدر التمويل (أخرى)' })}</> })}
          {field({ key: 'mt', label: 'طريقة الصرف', req: 1, wide: 1, labelId: 'frl-method', control: <>{seg('funding.method', METHODS, 'frl-method')}{f.method === 'أخرى' && text('funding.methodOther', { ph: 'اذكر طريقة الصرف', label: 'طريقة الصرف (أخرى)' })}</> })}
          {field({ key: 'bl', label: 'بند الميزانية / مركز التكلفة', for: idOf('funding.budgetLine'), hint: 'إن وُجد في ميزانية القسم أو المؤسسة.', control: text('funding.budgetLine') })}
          {field({ key: 'nb', label: 'تاريخ الحاجة للصرف', req: 1, for: idOf('funding.neededBy'), control: dateIn('funding.neededBy', 'تاريخ الحاجة للصرف') })}
          {field({ key: 'py', label: 'المستفيد من الصرف (المورد / المستلم)', req: f.method === 'تحويل للمورد', for: idOf('funding.payee'), control: text('funding.payee', { ph: 'اسم المورد أو مستلم العهدة' }) })}
          {field({ key: 'bk', label: 'البنك ورقم الآيبان', for: idOf('funding.bank'), hint: 'عند التحويل فقط.', control: (
            <div className="tk-pair">{text('funding.bank', { ph: 'اسم البنك', label: 'البنك' })}{text('funding.iban', { ph: 'SA0000000000000000000000', label: 'رقم الآيبان', dir: 'ltr', cls: 'mono', transform: cleanIban })}</div>
          ) })}
          {field({ key: 'am', label: 'المبلغ المطلوب صرفه', for: idOf('funding.amount'), hint: 'اتركه فارغًا ليساوي تكلفة البرنامج، أو اكتب مبلغًا آخر (مثل دفعة أولى).', control: numIn('funding.amount', { sfx: 'ر.س', sfxW: 30, ph: money(C.cost).replace(/,/g, '') }),
            calc: `المطلوب: ${money(C.amount)} ر.س` })}
          {field({ key: 'js', label: 'مبررات الطلب', req: 1, wide: 1, for: idOf('funding.justification'), control: area('funding.justification', { rows: 2, ph: 'لماذا يلزم هذا الصرف، وما الذي يحققه للبرنامج' }) })}
        </div>
      </div>
      <div className="tk-panel">
        {panelHead('عروض الأسعار والمستندات', 'عروض أسعار الموردين أو فواتير تقديرية — تصل للمراجعين ضمن الطلب (اختياري).')}
        <div className="tk-files">
          {data.quotes.map((q, j) => (
            <div className="tk-file" key={q.fileId}>
              <span aria-hidden="true">📎</span>
              <span className="name" title={q.name}>{q.name}</span>
              <span className="size">{q.size ? humanSize(q.size) : ''}</span>
              <button type="button" className="tk-ibtn" title="تنزيل" aria-label={`تنزيل ${q.name}`} onClick={() => download(q)}>⬇</button>
              {!locked && <button type="button" className="tk-ibtn danger" title="حذف" aria-label={`حذف ${q.name}`} onClick={() => dropQuote(j)}>🗑</button>}
            </div>
          ))}
          {busy.map(n => <div className="tk-file busy" key={n}><span>⏳</span><span className="name">{n}</span><span className="size">جارٍ الرفع…</span></div>)}
          {!locked && (
            <label className="tk-up">
              ⬆ {data.quotes.length ? 'إضافة ملف آخر' : 'رفع عرض سعر أو مستند'}
              <input ref={quoteInput} type="file" multiple hidden onChange={(e) => { addQuotes(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
        <div className="tk-field" style={{ marginTop: 16 }}>
          <label className="tk-lbl" htmlFor={idOf('notes')}>ملاحظات</label>
          {area('notes', { rows: 2, ph: 'أي ملاحظة للمراجعين (اختياري)' })}
        </div>
      </div>
    </section>
  );

  // ── 7. completion ──
  const renderDone = () => {
    const list = showAll ? A.issues : A.issues.slice(0, 8);
    return (
      <section className="tk-sec" id="fr-done">
        {secHead('✓', 'اكتمال الطلب', 'تُفحص الحقول آليًا. اضغط أي ملاحظة للانتقال إلى موضعها.', 'done')}
        <div className="tk-panel">
          <div className="tk-done-top">
            <b className="tk-big">{A.pct}%</b>
            <div><div className="tk-meter lg"><i style={{ width: `${A.pct}%` }} /></div><p className="tk-done-sum">{A.issues.length ? `عدد الملاحظات المتبقية: ${A.issues.length}.` : 'اكتملت جميع حقول الطلب.'}</p></div>
          </div>
          {A.issues.length > 0 && (
            <div className="tk-issues">
              {list.map((x, k) => <button type="button" key={k} className="tk-issue" onClick={() => goto(x.target)}>{x.text}</button>)}
              {A.issues.length > 8 && <button type="button" className="tk-more" onClick={() => setShowAll(v => !v)}>{showAll ? 'عرض أقل' : `عرض الكل (${A.issues.length})`}</button>}
            </div>
          )}
        </div>
      </section>
    );
  };

  // ── chrome ──
  const ringFor = (key) => {
    if (key === 'done') return A.pct;
    const s = A.sec[key] || { done: 0, total: 0 };
    return s.total ? Math.floor((s.done / s.total) * 100) : 100;
  };
  const navItems = [
    { id: 'fr-s-header', n: '◆', t: 'بيانات الطلب', key: 'header' },
    { id: 'fr-s-projects', n: '1', t: 'الاحتياجات لكل مشروع', key: 'projects' },
    { id: 'fr-s-staff', n: '2', t: 'الموارد البشرية', key: 'staff' },
    { id: 'fr-s-hosp', n: '3', t: 'الضيافة والبنود الأخرى', key: 'hosp' },
    { id: 'fr-s-pricing', n: '4', t: 'التكلفة والتسعير', key: 'pricing' },
    { id: 'fr-s-funding', n: '5', t: 'التمويل والصرف', key: 'funding' },
    { id: 'fr-done', n: '✓', t: 'اكتمال الطلب', key: 'done' }
  ];
  const lastV = (doc.versions || [])[(doc.versions || []).length - 1];
  const returnedFrom = doc.status === 'returned' && lastV ? (doc.returnedBy === 'manager'
    ? { who: lastV.managerName || 'المدير', at: lastV.managerAt, text: lastV.managerComment }
    : { who: lastV.pmName || 'مسؤول إدارة المشاريع', at: lastV.pmAt, text: lastV.pmComment }) : null;
  const saveText = save.state === 'pending' ? 'جارٍ الحفظ…' : save.state === 'error' ? (save.msg || 'تعذّر الحفظ') : save.state === 'ok' ? `محفوظ · ${save.at?.toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}` : 'التعديلات تُحفظ تلقائيًا';
  const chips = [h.kind, h.section, C.days ? ar(C.days, ['يوم واحد', 'يومان', 'أيام', 'يومًا']) : '', C.ben ? `${C.ben} مستفيد` : '', has(h.targetId) ? `🗓 ${h.planNo}` : '', has(h.kitId) ? `🎒 ${h.kitNo}` : ''].filter(Boolean);

  return (
    <Portal target={portalTarget}>
      <div ref={scrollRef} className={`tk tk-overlay fr ${hints ? '' : 'no-hints'}`} data-theme={theme} dir="rtl" lang="ar">
        <header className="tk-top">
          <button type="button" className="tk-btn ghost" onClick={close}>→ <span className="hide-sm">الطلبات</span></button>
          <div className="tk-top-title"><b>{h.title || 'طلب صرف مالي جديد'}</b><span className="mono">{docNo(doc)}</span></div>
          <span className="tk-sp" />
          <span className={`tk-save ${save.state === 'pending' ? 'pending' : save.state === 'error' ? 'err' : ''}`} role="status"><i aria-hidden="true" /><span className="hide-sm">{saveText}</span></span>
          {(doc.versions || []).length > 0 && <button type="button" className="tk-btn" onClick={() => setHistoryOpen(true)}>🕘 <span className="hide-sm">السجل</span></button>}
          <button type="button" className="tk-btn" onClick={preview} title="معاينة الطلب كما يُطبع">🖨 <span className="hide-sm">معاينة</span></button>
          {!locked && <button type="button" className="tk-btn primary" onClick={openSubmit}>📨 <span className="hide-sm">{resubmission ? 'إعادة الإرسال' : 'إرسال للمراجعة'}</span></button>}
        </header>

        <section className="tk-band" aria-label="ملخص الطلب">
          <div className="tk-band-in">
            <div>
              <p className="tk-eyebrow"><span>طلب صرف مالي · {docNo(doc)}</span></p>
              <h1 className={h.title ? '' : 'empty'}>{h.title || 'برنامج بلا اسم'}</h1>
              <p className="tk-band-desc">الملف المالي التفصيلي: احتياجات كل مشروع، والموارد البشرية، والضيافة، والتسعير، والتمويل.</p>
              {chips.length > 0 && <ul className="tk-chips">{chips.map(c => <li key={c}>{c}</li>)}</ul>}
            </div>
            <dl className="tk-tblock">
              <div className="span"><dt>المبلغ المطلوب صرفه</dt><dd className="mono fr-amount">{money(C.amount)} <small>ر.س</small></dd></div>
              <div><dt>الحالة</dt><dd>{statusOf(doc, true).label}</dd></div>
              <div><dt>الإصدارات</dt><dd>{doc.currentVersion ? `${doc.currentVersion} — ${fmtDay(doc.submittedAt)}` : 'لم يُرسل'}</dd></div>
              <div className="span"><dt>اكتمال الطلب</dt><dd className="tk-pct"><span className="mono">{A.pct}%</span><span className="tk-meter"><i style={{ width: `${A.pct}%` }} /></span></dd></div>
            </dl>
          </div>
        </section>

        {(returnedFrom || locked) && (
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
            {locked && <div className="tk-note cyan"><span className="tk-note-ico">🔒</span><div><b>الطلب قيد المراجعة</b>لا يمكن تعديله حتى يصدر قرار المراجعة.</div></div>}
          </div>
        )}

        <div className="tk-layout">
          <nav className="tk-nav" aria-label="أقسام الطلب">
            <ol>
              {navItems.map(s => {
                const p = ringFor(s.key);
                return (
                  <li key={s.id}>
                    <a className={active === s.id ? 'on' : ''} onClick={(e) => { e.preventDefault(); goto(s.id); }} href={`#${s.id}`}>
                      <span className="n">{s.n}</span><span>{s.t}</span>
                      {p >= 100 ? <span className="tk-ring done">✓</span> : <span className="tk-ring part" style={{ '--p': p }} title={`اكتمال ${p}%`} />}
                    </a>
                  </li>
                );
              })}
            </ol>
            <div className="tk-nav-foot">
              <div className="row"><span>المبلغ المطلوب</span><b className="mono">{money(C.amount)}</b></div>
              <div className="row"><span>اكتمال الطلب</span><b>{A.pct}%</b></div>
              <div className="tk-meter"><i style={{ width: `${A.pct}%` }} /></div>
              <button type="button" className={`tk-linkbtn ${A.issues.length ? '' : 'ok'}`} onClick={() => goto('fr-done')}>{A.issues.length ? `${ar(A.issues.length, NOTES)} للمراجعة` : 'الطلب مكتمل'}</button>
              <label className="tk-hints-toggle"><input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} /> إرشادات التعبئة</label>
            </div>
          </nav>
          <main className="tk-main">
            {renderHeader()}
            {renderProjects()}
            {renderStaff()}
            {renderHosp()}
            {renderPricing()}
            {renderFunding()}
            {renderDone()}
          </main>
        </div>

        <datalist id="fr-dl-sections">{SECTION_NAMES.map(x => <option key={x} value={x} />)}</datalist>

        {submitOpen && (
          <Modal onClose={() => !sending && setSubmitOpen(false)} labelledBy="fr-submit-title">
            <h3 id="fr-submit-title">{resubmission ? `إعادة إرسال طلب الصرف — الإصدار ${doc.currentVersion + 1}` : 'إرسال طلب الصرف للمراجعة'}</h3>
            <p>يُرسل طلب صرف <b>{money(C.amount)} ر.س</b> لـ«{h.title}» إلى <b>{doc.pm || 'مسؤول إدارة المشاريع'}</b> للمراجعة، ثم إلى المدير للاعتماد النهائي والتوقيع. لا يمكن تعديله أثناء المراجعة.</p>
            <div className="tk-stat-row">
              <b>{A.pct}%</b>
              <div>
                <div>اكتمال الطلب</div>
                <div className="tk-muted-s">{A.issues.length ? `${ar(A.issues.length, NOTES)} لم تُستكمل بعد — يراها المراجعون أيضًا.` : 'جميع الحقول مكتملة.'}</div>
              </div>
            </div>
            <div className="tk-field">
              <label className="tk-lbl" htmlFor="fr-submit-note">{resubmission ? <>ما الذي عدّلته في هذا الإصدار؟ <span className="tk-req">*</span></> : 'ملاحظة للمراجِعة (اختياري)'}</label>
              <AutoArea id="fr-submit-note" rows={3} value={note} onChange={setNote} placeholder={resubmission ? 'مثال: خفّضت عدد السيرفوهات وأرفقت عرض السعر الجديد.' : ''} />
            </div>
            <div className="tk-modal-actions">
              <button type="button" className="tk-btn ghost" onClick={() => setSubmitOpen(false)} disabled={sending}>إلغاء</button>
              <button type="button" className="tk-btn primary" onClick={submit} disabled={sending || (resubmission && !note.trim())}>{sending ? 'جارٍ الإرسال…' : '📨 إرسال'}</button>
            </div>
          </Modal>
        )}

        {historyOpen && (
          <Modal onClose={() => setHistoryOpen(false)} labelledBy="fr-hist-title">
            <h3 id="fr-hist-title">سجل الإصدارات والملاحظات</h3>
            <KitHistory versions={doc.versions} currentVersion={doc.currentVersion} diff={diffData} the="الطلب"
              onView={(n) => printDocument(api, R.doc(id), { version: n }).catch(err => toast.error(errorText(err, 'تعذّر فتح الإصدار')))} />
            <div className="tk-modal-actions"><button type="button" className="tk-btn" onClick={() => setHistoryOpen(false)}>إغلاق</button></div>
          </Modal>
        )}
      </div>
    </Portal>
  );
};

export default FinanceRequestEditor;
