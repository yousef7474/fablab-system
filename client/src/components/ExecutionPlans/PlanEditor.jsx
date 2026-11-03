import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  MONTHS, QUARTERS, PERIOD_TYPES, HEAD_ROLES, BLOCKS, VOLUNTEER_LABEL, MAKE,
  normalize, analyze, periodLabel, periodMonths, monthName, idOf, getPath, setPath, has, fmtPlanNo, diffData
} from './planModel';
import { PLAN_KIND } from './planKind';
import { fmtKitNo, fmtDay, humanSize, statusOf, ar, NOTES } from '../TrainingKits/kitModel';
import { AutoArea, Seg, Portal, useBodyLock, Modal, KitHistory } from '../TrainingKits/KitParts';
import { uploadFile, downloadFile, printDocument, errorText } from '../TrainingKits/kitApi';
import '../TrainingKits/TrainingKits.css';
import './Plans.css';

const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
const HINTS_KEY = 'tk_hints';
const R = PLAN_KIND.routes.mine;
const KPIS = ['عدد المستفيدين من البرامج التدريبية', 'عدد البرامج والورش المنفذة', 'عدد ساعات التدريب المقدمة', 'نسبة رضا المستفيدين', 'عدد المشاريع والنماذج المنفذة',
  'عدد الزوار والمستفيدين من الفعاليات', 'عدد الشراكات والمبادرات المجتمعية', 'عدد ساعات التطوع', 'نسبة جاهزية الأجهزة والمعدات', 'عدد المنتجات المصنّعة للمستفيدين'];
const AUDIENCES = ['طلاب المرحلة الابتدائية', 'طلاب المرحلة المتوسطة', 'طلاب المرحلة الثانوية', 'طلاب الجامعات', 'المعلمون والمعلمات', 'رواد الأعمال', 'الأسر والأطفال', 'المجتمع العام', 'فريق فاب لاب الداخلي'];
const PLACES = ['فاب لاب الأحساء', 'قاعة التدريب', 'معمل الطباعة ثلاثية الأبعاد', 'معمل الإلكترونيات', 'عن بُعد (أون لاين)'];

/**
 * The employee's execution plan form (نموذج الخطة التنفيذية, in the
 * system's style). Saves as you type; «إرسال للمراجعة» freezes a version
 * and sends it to the project manager, then the manager.
 */
const PlanEditor = ({ api, plan, portalTarget, theme = 'dark', onClose, onSubmitted }) => {
  useBodyLock();
  const [data, setData] = useState(() => normalize(plan.data));
  const [save, setSave] = useState({ state: 'idle', at: null });
  const [hints, setHints] = useState(() => { try { return localStorage.getItem(HINTS_KEY) !== '0'; } catch { return true; } });
  const [active, setActive] = useState('ep-s1');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState({});
  const [kits, setKits] = useState([]);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const dirty = useRef(false);
  const latest = useRef(data);
  const id = plan.id || plan.planId;

  const A = useMemo(() => analyze(data), [data]);
  const locked = !['draft', 'returned'].includes(plan.status);
  const h = data.header;
  const months = periodMonths(h);

  // The employee's approved training kits, to link as a target's content.
  useEffect(() => {
    api.get('/training-kits/mine').then(({ data: list }) => setKits((Array.isArray(list) ? list : []).filter(k => k.status === 'approved'))).catch(() => {});
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

  // ── section spy (re-attached when targets are added / removed) ──
  const targetKeys = data.targets.map(t => t.id).join(',');
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) setActive(en.target.id); }), { root, rootMargin: '-25% 0px -65% 0px' });
    root.querySelectorAll('.tk-sec').forEach(s => io.observe(s));
    return () => io.disconnect();
  }, [targetKeys]);

  const goto = (target) => {
    const el = document.getElementById(target);
    if (!el) return;
    if (el.classList.contains('tk-sec')) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const f = el.matches('input,select,textarea,button') ? el : el.querySelector('textarea,input,select,button');
    const ring = el.closest('.tk-field,.tk-rt-row,.ep-blk,.tk-panel') || el;
    setTimeout(() => {
      if (f) f.focus({ preventScroll: true });
      ring.classList.remove('tk-flash'); void ring.offsetWidth; ring.classList.add('tk-flash');
    }, 380);
  };

  // ── targets ──
  const addTarget = () => {
    const t = MAKE.target();
    if (months.length === 1) t.month = months[0];
    update(n => { n.targets.push(t); });
    setTimeout(() => goto(`ep-t-${t.id}`), 120);
  };
  const removeTarget = (i) => {
    const t = data.targets[i];
    if (!window.confirm(`حذف «المستهدف ${i + 1}${t.name ? ` — ${t.name}` : ''}» بكل مراحله وملفاته؟`)) return;
    [...BLOCKS.map(b => b.key), 'volunteer'].forEach(k => (t[k].files || []).forEach(f => dropFile(f.fileId)));
    update(n => { n.targets.splice(i, 1); });
  };
  const moveTarget = (i, dir) => update(n => {
    const j = i + dir;
    if (j < 0 || j >= n.targets.length) return;
    [n.targets[i], n.targets[j]] = [n.targets[j], n.targets[i]];
  });

  // ── files ──
  const markBusy = (key, name, on) => setBusy(b => {
    const list = new Set(b[key] || []);
    if (on) list.add(name); else list.delete(name);
    return { ...b, [key]: [...list] };
  });
  const addFiles = async (i, key, files) => {
    const tid = data.targets[i].id;
    for (const f of Array.from(files || [])) {
      markBusy(`${tid}-${key}`, f.name, true);
      try {
        const up = await uploadFile(api, id, f, 'attachment', R.upload(id));
        update(n => {
          const t = n.targets.find(x => x.id === tid);
          if (t) t[key].files.push({ fileId: up.fileId, name: up.name, size: up.size, mime: up.mime });
        });
      } catch (err) {
        toast.error(errorText(err, `تعذّر رفع الملف ${f.name}`));
      } finally {
        markBusy(`${tid}-${key}`, f.name, false);
      }
    }
  };
  const dropFile = (fileId) => { api.delete(R.dropFile(id, fileId)).catch(() => {}); };
  const download = (f) => downloadFile(api, R.file(f.fileId), f.name).catch(err => toast.error(errorText(err, 'تعذّر التنزيل')));

  const linkKit = (i, kitId) => update(n => {
    const c = n.targets[i].content;
    const k = kits.find(x => (x.id || x.kitId) === kitId);
    if (!k) { c.kitId = ''; c.kitNo = ''; c.kitTitle = ''; return; }
    c.kitId = kitId;
    c.kitNo = fmtKitNo(k.number != null ? k.number : k.kitNumber);
    c.kitTitle = k.title || '';
    if (!c.status) c.status = 'مرفق ومعتمد';
  });

  const preview = async () => {
    await persist();
    printDocument(api, R.doc(id), { draft: 1 }).catch(err => toast.error(errorText(err, 'تعذّر تجهيز المعاينة')));
  };

  // ── submit ──
  const resubmission = plan.currentVersion > 0;
  const openSubmit = () => {
    if (!periodLabel(h) || !/^\d{4}$/.test(String(h.year || ''))) { toast.error('حدد فترة الخطة (الشهر أو الربع، والسنة) قبل الإرسال'); goto(idOf('header.period')); return; }
    setSubmitOpen(true);
  };
  const submit = async () => {
    if (resubmission && !note.trim()) { toast.error('اكتب ما الذي عدّلته في هذا الإصدار'); return; }
    setSending(true);
    try {
      if (!(await persist())) throw new Error('save');
      const { data: updated } = await api.post(R.submit(id), { note: note.trim() });
      toast.success(`أُرسلت الخطة إلى ${plan.pm || 'مسؤول إدارة المشاريع'} — الإصدار ${updated.currentVersion}`);
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
      aria-label={o.label} autoComplete="off" disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const area = (path, o = {}) => (
    <AutoArea id={idOf(path)} value={val(path)} rows={o.rows || 1} placeholder={o.ph || ''} aria-label={o.label} disabled={locked} onChange={(v) => set(path, v)} />
  );
  const dateIn = (path, label) => (
    <input className="tk-in" type="date" id={idOf(path)} value={val(path)} aria-label={label} disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const field = (o) => (
    <div className={`tk-field${o.wide ? ' wide' : ''}`} key={o.key}>
      {o.for
        ? <label className="tk-lbl" htmlFor={o.for}>{o.label}{o.req && <span className="tk-req" aria-hidden="true">*</span>}</label>
        : <span className="tk-lbl" id={o.labelId}>{o.label}{o.req && <span className="tk-req" aria-hidden="true">*</span>}</span>}
      {o.hint && <p className="tk-hint">{o.hint}</p>}
      {o.control}
    </div>
  );
  const panelHead = (t, n) => (
    <div className="tk-panel-head"><h3 className="tk-panel-title">{t}</h3>{n && <p className="tk-panel-note">{n}</p>}</div>
  );
  const issuesOf = (key) => A.issues.filter(x => x.sec === key);
  const pill = (key) => {
    const c = issuesOf(key).length;
    return <span className={`tk-pill ${c ? 'amber' : 'mint'}`}>{c ? ar(c, NOTES) : 'مكتمل'}</span>;
  };

  // ── 1. header ──
  const typeLabel = (PERIOD_TYPES.find(p => p.v === h.periodType) || {}).l || '';
  const renderHeader = () => (
    <section className="tk-sec" id="ep-s1">
      <header className="tk-sec-head">
        <span className="tk-sec-num">◆</span>
        <div><h2>بيانات الخطة</h2><p className="tk-sec-desc">فترة الخطة والقسم ومسؤوله. تاريخ رفع الخطة يُسجَّل تلقائيًا عند إرسالها.</p></div>
        {pill('header')}
      </header>
      <div className="tk-panel">
        <div className="tk-grid">
          {field({ key: 'pt', label: 'فترة الخطة: الشهر/الربع والسنة', req: 1, wide: 1, labelId: 'epl-period', hint: 'خطة شهرية أو ربع سنوية، ثم الشهر أو الربع، والسنة.', control: (
            <div className="ep-period" id={idOf('header.period')}>
              <Seg options={PERIOD_TYPES.map(p => p.l)} value={typeLabel} labelledBy="epl-period"
                onChange={(l) => !locked && update(n => { n.header.periodType = (PERIOD_TYPES.find(p => p.l === l) || {}).v || ''; })} />
              {h.periodType === 'quarter' && (
                <Seg options={QUARTERS} value={QUARTERS[Number(h.quarter) - 1] || ''} labelledBy="epl-period"
                  onChange={(q) => !locked && set('header.quarter', QUARTERS.indexOf(q) + 1)} />
              )}
              {h.periodType === 'month' && (
                <select className="tk-in ep-month" value={val('header.month')} aria-label="شهر الخطة" disabled={locked} onChange={(e) => set('header.month', e.target.value ? Number(e.target.value) : '')}>
                  <option value="">اختر الشهر…</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              )}
              <input className="tk-in num ep-year" type="number" inputMode="numeric" id={idOf('header.year')} min="2024" max="2100" value={val('header.year')} aria-label="سنة الخطة" disabled={locked}
                onChange={(e) => set('header.year', e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
          ) })}
          {field({ key: 'sec', label: 'القسم أو المسار', req: 1, for: idOf('header.section'), control: text('header.section', { list: 'ep-dl-sections' }) })}
          {field({ key: 'head', label: 'اسم مسؤول القسم', req: 1, for: idOf('header.head'), control: text('header.head') })}
          {field({ key: 'date', label: 'تاريخ رفع الخطة', labelId: 'epl-date', control: <div className="ep-readonly" aria-labelledby="epl-date">{plan.submittedAt ? `${fmtDay(plan.submittedAt)} — الإصدار ${plan.currentVersion}` : 'يُسجَّل تلقائيًا عند إرسال الخطة'}</div> })}
        </div>
        <div className="tk-note amber" style={{ marginTop: 18 }}>
          <span className="tk-note-ico">📁</span>
          <div><b>ملفات المستهدفات</b>ارفع ملف كل مستهدف داخل الخطة مباشرة أو ضع رابطه في الخانة المخصصة، أو اختر «لا يتطلب».</div>
        </div>
      </div>
    </section>
  );

  // ── 2. one target ──
  const statusSeg = (i, b) => (
    <Seg id={idOf(`targets.${i}.${b.key}.status`)} options={b.statuses} value={data.targets[i][b.key].status} labelledBy={`epl-${b.key}-${i}`}
      onChange={(v) => !locked && set(`targets.${i}.${b.key}.status`, v)} />
  );
  const proof = (i, t, key) => {
    const x = t[key];
    return (
      <div className="tk-files">
        {x.files.map((f, j) => (
          <div className="tk-file" key={f.fileId}>
            <span aria-hidden="true">📎</span>
            <span className="name" title={f.name}>{f.name}</span>
            <span className="size">{f.size ? humanSize(f.size) : ''}</span>
            <button type="button" className="tk-ibtn" title="تنزيل" aria-label={`تنزيل ${f.name}`} onClick={() => download(f)}>⬇</button>
            {!locked && <button type="button" className="tk-ibtn danger" title="حذف" aria-label={`حذف ${f.name}`} onClick={() => { dropFile(f.fileId); update(n => { n.targets[i][key].files.splice(j, 1); }); }}>🗑</button>}
          </div>
        ))}
        {(busy[`${t.id}-${key}`] || []).map(n => <div className="tk-file busy" key={n}><span>⏳</span><span className="name">{n}</span><span className="size">جارٍ الرفع…</span></div>)}
        <div className="ep-proof-row">
          {!locked && (
            <label className="tk-up">
              ⬆ {x.files.length ? 'ملف آخر' : 'رفع ملف'}
              <input type="file" multiple hidden onChange={(e) => { addFiles(i, key, e.target.files); e.target.value = ''; }} />
            </label>
          )}
          {text(`targets.${i}.${key}.link`, { ph: 'أو الصق رابط الملف (Google Drive، OneDrive…)', label: 'رابط الملف', dir: 'auto' })}
        </div>
      </div>
    );
  };
  const renderTarget = (t, i) => {
    const q = `targets.${i}.`;
    const inPeriod = (m) => !months.length || months.includes(m);
    return (
      <section className="tk-sec" id={`ep-t-${t.id}`} key={t.id}>
        <header className="tk-sec-head">
          <span className="tk-sec-num">{i + 1}</span>
          <div>
            <h2>المستهدف {i + 1}{has(t.name) ? <span className="ep-tname"> — {t.name}</span> : ''}</h2>
            <p className="tk-sec-desc">{[has(t.month) ? monthName(t.month) : '', t.headRole ? `دور مسؤول القسم: ${t.headRole}` : ''].filter(Boolean).join(' · ') || 'عمل مخطط تنفيذه خلال فترة الخطة.'}</p>
          </div>
          {pill(t.id)}
        </header>
        {!locked && (
          <div className="ep-tactions">
            <button type="button" className="tk-btn sm ghost" onClick={() => moveTarget(i, -1)} disabled={i === 0} aria-label="نقل لأعلى" title="نقل لأعلى">↑</button>
            <button type="button" className="tk-btn sm ghost" onClick={() => moveTarget(i, 1)} disabled={i === data.targets.length - 1} aria-label="نقل لأسفل" title="نقل لأسفل">↓</button>
            <button type="button" className="tk-btn sm danger" onClick={() => removeTarget(i)}>🗑 حذف المستهدف</button>
          </div>
        )}
        <div className="tk-panel">
          {panelHead('التعريف بالمستهدف')}
          <div className="tk-grid">
            {field({ key: 'n', label: 'اسم العمل المخطط', req: 1, wide: 1, for: idOf(`${q}name`), control: text(`${q}name`, { ph: 'مثال: تنفيذ البرنامج التدريبي «تعلّم الحركة الميكانيكية»' }) })}
            {field({ key: 'k', label: 'مؤشر الأداء المرتبط', req: 1, wide: 1, for: idOf(`${q}kpi`), hint: 'المؤشر الذي يقيس هذا العمل في خطة القسم — اختر من المقترحات أو اكتب مؤشرًا.', control: text(`${q}kpi`, { list: 'ep-dl-kpis' }) })}
            {field({ key: 'd', label: 'وصف مختصر', req: 1, wide: 1, for: idOf(`${q}desc`), control: area(`${q}desc`, { rows: 2, ph: 'ما العمل، ولماذا، وكيف سيُنفَّذ باختصار' }) })}
            {field({ key: 'o', label: 'المخرج المتوقع والكمية', req: 1, for: idOf(`${q}output`), control: area(`${q}output`, { ph: 'مثال: 20 متدربًا · 20 نموذجًا مطبوعًا' }) })}
            {field({ key: 'a', label: 'الفئة المستهدفة', req: 1, for: idOf(`${q}audience`), control: text(`${q}audience`, { list: 'ep-dl-aud' }) })}
          </div>
        </div>
        <div className="tk-panel">
          {panelHead('التنفيذ والأدوار')}
          <div className="tk-grid">
            {field({ key: 'm', label: 'شهر التنفيذ', req: 1, for: idOf(`${q}month`), control: (
              <select className="tk-in" id={idOf(`${q}month`)} value={val(`${q}month`)} disabled={locked} onChange={(e) => set(`${q}month`, e.target.value ? Number(e.target.value) : '')}>
                <option value="">اختر الشهر…</option>
                {months.length > 0 && <optgroup label="ضمن فترة الخطة">{months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}</optgroup>}
                <optgroup label={months.length ? 'أشهر أخرى' : 'الأشهر'}>{MONTHS.map((m, k) => (inPeriod(k + 1) && months.length ? null : <option key={m} value={k + 1}>{m}</option>))}</optgroup>
              </select>
            ) })}
            {field({ key: 'p', label: 'مكان التنفيذ', req: 1, for: idOf(`${q}place`), control: text(`${q}place`, { list: 'ep-dl-places' }) })}
            {field({ key: 't', label: 'وقت التنفيذ', req: 1, for: idOf(`${q}time`), hint: 'الأيام والساعات، مثال: الأحد–الأربعاء 4:00–7:00 م.', control: text(`${q}time`) })}
            {field({ key: 'hr', label: 'دور مسؤول القسم', req: 1, labelId: `epl-hr-${i}`, control: <Seg id={idOf(`${q}headRole`)} options={HEAD_ROLES} value={t.headRole} labelledBy={`epl-hr-${i}`} onChange={(v) => !locked && set(`${q}headRole`, v)} /> })}
            {field({ key: 'sr', label: 'دور القسم', req: 1, wide: 1, for: idOf(`${q}sectionRole`), control: area(`${q}sectionRole`, { ph: 'ما الذي يقدمه القسم في هذا العمل؟ مثال: إعداد المحتوى وتنفيذ التدريب وتوفير الأجهزة والخامات' }) })}
          </div>
        </div>
        <div className="tk-panel">
          {panelHead('الخطة الزمنية لمراحل تنفيذ المستهدف', 'المرحلة أو المهمة، وتاريخ بدايتها ونهايتها، ومخرجها أو معيار اكتمالها.')}
          <div style={{ '--cols': '30px minmax(0,1.5fr) 150px 150px minmax(0,1.5fr) 36px' }} id={`ep-phases-${t.id}`}>
            <div className="tk-rt-head"><span>#</span><span>المرحلة / المهمة</span><span>تاريخ البداية</span><span>تاريخ النهاية</span><span>مخرج المرحلة / معيار اكتمالها</span><span /></div>
            <div className="tk-rt-body">
              {!t.phases.length && <p className="tk-empty">لا توجد مراحل بعد.</p>}
              {t.phases.map((p, j) => {
                const pq = `${q}phases.${j}.`;
                return (
                  <div className="tk-rt-row" key={p.id}>
                    <div className="tk-cell"><span className="ep-pn">{j + 1}</span></div>
                    <div className="tk-cell"><span className="tk-cell-lbl">المرحلة / المهمة</span>{area(`${pq}task`, { label: `المرحلة ${j + 1}`, ph: 'مثال: الإعلان والتسجيل' })}</div>
                    <div className="tk-cell half"><span className="tk-cell-lbl">تاريخ البداية</span>{dateIn(`${pq}start`, `تاريخ بداية المرحلة ${j + 1}`)}</div>
                    <div className="tk-cell half"><span className="tk-cell-lbl">تاريخ النهاية</span>{dateIn(`${pq}end`, `تاريخ نهاية المرحلة ${j + 1}`)}</div>
                    <div className="tk-cell"><span className="tk-cell-lbl">مخرج المرحلة / معيار اكتمالها</span>{area(`${pq}criterion`, { label: `معيار اكتمال المرحلة ${j + 1}`, ph: 'مثال: 20 مسجلًا مؤكدًا' })}</div>
                    <div className="tk-cell act">{!locked && <button type="button" className="tk-ibtn danger" onClick={() => update(n => { n.targets[i].phases.splice(j, 1); })} aria-label={`حذف المرحلة ${j + 1}`} title="حذف المرحلة">🗑</button>}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {!locked && <div className="tk-list-foot"><button type="button" className="tk-add" onClick={() => update(n => { n.targets[i].phases.push(MAKE.phase()); })}>＋ إضافة مرحلة</button></div>}
        </div>
        <div className="tk-panel">
          {panelHead('ملفات المستهدف', 'لكل بند: الحالة، ثم ارفع الملف أو ضع رابطه — أو «لا يتطلب».')}
          {BLOCKS.map(b => {
            const x = t[b.key];
            const needs = x.status === b.attached;
            const ok = !needs || x.files.length > 0 || has(x.link) || (b.key === 'content' && has(x.kitId));
            return (
              <div className="ep-blk" id={`ep-blk-${t.id}-${b.key}`} key={b.key}>
                <div className="ep-blk-name"><span className={`tk-dot ${has(x.status) && ok ? 'ok' : ''}`}>✓</span><span id={`epl-${b.key}-${i}`}>{b.label}</span><span className="tk-req" aria-hidden="true">*</span></div>
                <div className="ep-blk-body">
                  {statusSeg(i, b)}
                  {b.key === 'content' && (
                    <div className="ep-kit">
                      {x.kitId
                        ? <span className="tk-chip ep-kitchip"><bdi>🎒 {x.kitNo} — {x.kitTitle || 'حقيبة تدريبية'}</bdi>{!locked && <button type="button" aria-label="إلغاء ربط الحقيبة" onClick={() => linkKit(i, '')}>×</button>}</span>
                        : (
                          <select className="tk-in" value="" disabled={locked || !kits.length} aria-label="ربط حقيبة تدريبية معتمدة" onChange={(e) => linkKit(i, e.target.value)}>
                            <option value="">{kits.length ? '🎒 اربط حقيبة تدريبية معتمدة من حقائبك…' : 'لا توجد لديك حقائب تدريبية معتمدة بعد'}</option>
                            {kits.map(k => <option key={k.id || k.kitId} value={k.id || k.kitId}>{fmtKitNo(k.number != null ? k.number : k.kitNumber)} — {k.title || 'بلا اسم'}</option>)}
                          </select>
                        )}
                    </div>
                  )}
                  {x.status !== 'لا يتطلب' && proof(i, t, b.key)}
                  {needs && !ok && <p className="ep-need">«{b.attached}» — ارفع الملف أو ضع رابطه{b.key === 'content' ? ' أو اربط حقيبة معتمدة' : ''}.</p>}
                </div>
              </div>
            );
          })}
          <div className="ep-blk" id={`ep-blk-${t.id}-volunteer`}>
            <div className="ep-blk-name"><span className={`tk-dot ${t.volunteer.files.length || has(t.volunteer.link) ? 'ok' : ''}`}>✓</span><span>{VOLUNTEER_LABEL}</span><small className="ep-opt">إن وجدت</small></div>
            <div className="ep-blk-body">{proof(i, t, 'volunteer')}</div>
          </div>
        </div>
        <div className="tk-panel">
          {field({ key: 'nt', label: 'ملاحظات', for: idOf(`${q}notes`), control: area(`${q}notes`, { rows: 2, ph: 'أي ملاحظة على هذا المستهدف (اختياري)' }) })}
        </div>
      </section>
    );
  };

  // ── 3. completion ──
  const renderDone = () => {
    const list = showAll ? A.issues : A.issues.slice(0, 8);
    return (
      <section className="tk-sec" id="ep-done">
        <header className="tk-sec-head">
          <span className="tk-sec-num">✓</span>
          <div><h2>اكتمال الخطة</h2><p className="tk-sec-desc">تُفحص الحقول آليًا. اضغط أي ملاحظة للانتقال إلى موضعها.</p></div>
          <span className={`tk-pill ${A.issues.length ? 'amber' : 'mint'}`}>{A.issues.length ? ar(A.issues.length, NOTES) : 'مكتملة'}</span>
        </header>
        <div className="tk-panel">
          <div className="tk-done-top">
            <b className="tk-big">{A.pct}%</b>
            <div><div className="tk-meter lg"><i style={{ width: `${A.pct}%` }} /></div><p className="tk-done-sum">{A.issues.length ? `عدد الملاحظات المتبقية: ${A.issues.length}.` : 'اكتملت جميع حقول الخطة.'}</p></div>
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
    { id: 'ep-s1', n: '◆', t: 'بيانات الخطة', key: 'header' },
    ...data.targets.map((t, i) => ({ id: `ep-t-${t.id}`, n: String(i + 1), t: t.name || `المستهدف ${i + 1}`, key: t.id })),
    { id: 'ep-done', n: '✓', t: 'اكتمال الخطة', key: 'done' }
  ];
  const lastV = (plan.versions || [])[(plan.versions || []).length - 1];
  const returnedFrom = plan.status === 'returned' && lastV ? (plan.returnedBy === 'manager'
    ? { who: lastV.managerName || 'المدير', at: lastV.managerAt, text: lastV.managerComment }
    : { who: lastV.pmName || 'مسؤول إدارة المشاريع', at: lastV.pmAt, text: lastV.pmComment }) : null;
  const saveText = save.state === 'pending' ? 'جارٍ الحفظ…' : save.state === 'error' ? (save.msg || 'تعذّر الحفظ') : save.state === 'ok' ? `محفوظ · ${save.at?.toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}` : 'التعديلات تُحفظ تلقائيًا';
  const period = periodLabel(h);
  const chips = [h.section, h.head, data.targets.length ? `${data.targets.length} ${data.targets.length === 1 ? 'مستهدف' : data.targets.length === 2 ? 'مستهدفان' : data.targets.length <= 10 ? 'مستهدفات' : 'مستهدفًا'}` : ''].filter(Boolean);

  return (
    <Portal target={portalTarget}>
      <div ref={scrollRef} className={`tk tk-overlay ep ${hints ? '' : 'no-hints'}`} data-theme={theme} dir="rtl" lang="ar">
        <header className="tk-top">
          <button type="button" className="tk-btn ghost" onClick={close}>→ <span className="hide-sm">الخطط</span></button>
          <div className="tk-top-title"><b>{period ? `الخطة التنفيذية — ${period}` : 'خطة تنفيذية جديدة'}</b><span className="mono">{fmtPlanNo(plan.number != null ? plan.number : plan.planNumber)}</span></div>
          <span className="tk-sp" />
          <span className={`tk-save ${save.state === 'pending' ? 'pending' : save.state === 'error' ? 'err' : ''}`} role="status"><i aria-hidden="true" /><span className="hide-sm">{saveText}</span></span>
          {(plan.versions || []).length > 0 && <button type="button" className="tk-btn" onClick={() => setHistoryOpen(true)}>🕘 <span className="hide-sm">السجل</span></button>}
          <button type="button" className="tk-btn" onClick={preview} title="معاينة الخطة كمستند وطباعتها">🖨 <span className="hide-sm">معاينة</span></button>
          {!locked && <button type="button" className="tk-btn primary" onClick={openSubmit}>📨 <span className="hide-sm">{resubmission ? 'إعادة الإرسال' : 'إرسال للمراجعة'}</span></button>}
        </header>

        <section className="tk-band" aria-label="ملخص الخطة">
          <div className="tk-band-in">
            <div>
              <p className="tk-eyebrow"><span>الخطة التنفيذية · {fmtPlanNo(plan.number != null ? plan.number : plan.planNumber)}</span></p>
              <h1 className={period ? '' : 'empty'}>{period || 'خطة بلا فترة محددة'}</h1>
              <p className="tk-band-desc">المستهدفات المخطط تنفيذها خلال فترة الخطة، ومراحل كل مستهدف وملفاته.</p>
              {chips.length > 0 && <ul className="tk-chips">{chips.map(c => <li key={c}>{c}</li>)}</ul>}
            </div>
            <dl className="tk-tblock">
              <div><dt>المستهدفات</dt><dd className="mono">{data.targets.length}</dd></div>
              <div><dt>الحالة</dt><dd>{statusOf(plan).label}</dd></div>
              <div className="span"><dt>إصدارات مُرسلة</dt><dd>{plan.currentVersion ? `${plan.currentVersion} — آخرها ${fmtDay(plan.submittedAt)}` : 'لم تُرسل بعد'}</dd></div>
              <div className="span"><dt>اكتمال الخطة</dt><dd className="tk-pct"><span className="mono">{A.pct}%</span><span className="tk-meter"><i style={{ width: `${A.pct}%` }} /></span></dd></div>
            </dl>
          </div>
        </section>

        {(returnedFrom || locked || data.example) && (
          <div className="tk-wrap" style={{ display: 'grid', gap: 10 }}>
            {data.example && !locked && (
              <div className="tk-note cyan">
                <span className="tk-note-ico">📖</span>
                <div style={{ flex: 1 }}>
                  <b>هذه خطة مثال مكتملة</b>
                  تعرض طريقة تعبئة بيانات الخطة والمستهدفات ومراحلها وحالات الملفات. يمكنك التعديل عليها وإرسالها للمراجعة لتجربة مسار الاعتماد، أو العودة وبدء خطة جديدة لقسمك.
                </div>
                <button type="button" className="tk-btn sm ghost" onClick={() => set('example', false)}>إخفاء</button>
              </div>
            )}
            {returnedFrom && (
              <div className="tk-note red">
                <span className="tk-note-ico">↩</span>
                <div>
                  <b>أعاد {returnedFrom.who} الخطة للتعديل (الإصدار {plan.currentVersion}) · {fmtDay(returnedFrom.at)}</b>
                  <div className="tk-quote">{returnedFrom.text}</div>
                  <div className="tk-muted-s" style={{ marginTop: 6 }}>عدّل ما يلزم ثم اضغط «إعادة الإرسال» — تُحفظ النسخة السابقة في السجل.</div>
                </div>
              </div>
            )}
            {locked && <div className="tk-note cyan"><span className="tk-note-ico">🔒</span><div><b>الخطة قيد المراجعة</b>لا يمكن تعديلها حتى يصدر قرار المراجعة.</div></div>}
          </div>
        )}

        <div className="tk-layout">
          <nav className="tk-nav" aria-label="أقسام الخطة">
            <ol>
              {navItems.map(s => {
                const pct = ringFor(s.key);
                return (
                  <li key={s.id}>
                    <a className={active === s.id ? 'on' : ''} onClick={(e) => { e.preventDefault(); goto(s.id); }} href={`#${s.id}`}>
                      <span className="n">{s.n}</span><span className="ep-navt">{s.t}</span>
                      {pct >= 100 ? <span className="tk-ring done">✓</span> : <span className="tk-ring part" style={{ '--p': pct }} title={`اكتمال ${pct}%`} />}
                    </a>
                  </li>
                );
              })}
            </ol>
            {!locked && <button type="button" className="tk-add ep-navadd" onClick={addTarget}>＋ مستهدف جديد</button>}
            <div className="tk-nav-foot">
              <div className="row"><span>اكتمال الخطة</span><b>{A.pct}%</b></div>
              <div className="tk-meter"><i style={{ width: `${A.pct}%` }} /></div>
              <button type="button" className={`tk-linkbtn ${A.issues.length ? '' : 'ok'}`} onClick={() => goto('ep-done')}>{A.issues.length ? `${ar(A.issues.length, NOTES)} للمراجعة` : 'الخطة مكتملة'}</button>
              <label className="tk-hints-toggle"><input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} /> إرشادات التعبئة</label>
            </div>
          </nav>
          <main className="tk-main">
            {renderHeader()}
            {data.targets.map(renderTarget)}
            {!data.targets.length && <div className="tk-blank"><span className="big">🎯</span><b>لا توجد مستهدفات بعد</b><span>أضف أول عمل مخطط تنفيذه خلال فترة الخطة.</span></div>}
            {!locked && (
              <div className="ep-add-wrap" id="ep-add-target">
                <button type="button" className="tk-btn primary" onClick={addTarget}>＋ إضافة مستهدف</button>
                <span className="tk-muted-s">نموذج الخطة يتسع لـ 15 مستهدفًا — أضف ما تحتاجه.</span>
              </div>
            )}
            {renderDone()}
          </main>
        </div>

        <datalist id="ep-dl-kpis">{KPIS.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="ep-dl-aud">{AUDIENCES.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="ep-dl-places">{PLACES.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="ep-dl-sections">{['الإلكترونيات والبرمجة', 'الليزر CNC', 'الخشب CNC', 'المعادن CNC', 'الطباعة ثلاثية الأبعاد', 'الروبوتات والذكاء الاصطناعي', 'نادي الأطفال', 'قطع الفينيل', 'طباعة UV والملصقات'].map(x => <option key={x} value={x} />)}</datalist>

        {submitOpen && (
          <Modal onClose={() => !sending && setSubmitOpen(false)} labelledBy="ep-submit-title">
            <h3 id="ep-submit-title">{resubmission ? `إعادة إرسال الخطة — الإصدار ${plan.currentVersion + 1}` : 'إرسال الخطة للمراجعة'}</h3>
            <p>تُرسل «{periodLabel(h)}» إلى <b>{plan.pm || 'مسؤول إدارة المشاريع'}</b> للمراجعة، ثم إلى المدير للاعتماد. لا يمكن تعديلها أثناء المراجعة، ويُسجَّل تاريخ اليوم تاريخًا لرفع الخطة.</p>
            <div className="tk-stat-row">
              <b>{A.pct}%</b>
              <div>
                <div>اكتمال الخطة</div>
                <div className="tk-muted-s">{A.issues.length ? `${ar(A.issues.length, NOTES)} لم تُستكمل بعد — يراها المراجعون أيضًا.` : 'جميع الحقول مكتملة.'}</div>
              </div>
            </div>
            <div className="tk-field">
              <label className="tk-lbl" htmlFor="ep-submit-note">{resubmission ? <>ما الذي عدّلته في هذا الإصدار؟ <span className="tk-req">*</span></> : 'ملاحظة للمراجِعة (اختياري)'}</label>
              <AutoArea id="ep-submit-note" rows={3} value={note} onChange={setNote} placeholder={resubmission ? 'مثال: عدّلت مراحل المستهدف 2 وأرفقت الملف المالي.' : ''} />
            </div>
            <div className="tk-modal-actions">
              <button type="button" className="tk-btn ghost" onClick={() => setSubmitOpen(false)} disabled={sending}>إلغاء</button>
              <button type="button" className="tk-btn primary" onClick={submit} disabled={sending || (resubmission && !note.trim())}>{sending ? 'جارٍ الإرسال…' : '📨 إرسال'}</button>
            </div>
          </Modal>
        )}

        {historyOpen && (
          <Modal onClose={() => setHistoryOpen(false)} labelledBy="ep-hist-title">
            <h3 id="ep-hist-title">سجل الإصدارات والملاحظات</h3>
            <KitHistory versions={plan.versions} currentVersion={plan.currentVersion} diff={diffData} the="الخطة"
              onView={(n) => printDocument(api, R.doc(id), { version: n }).catch(err => toast.error(errorText(err, 'تعذّر فتح الإصدار')))} />
            <div className="tk-modal-actions"><button type="button" className="tk-btn" onClick={() => setHistoryOpen(false)}>إغلاق</button></div>
          </Modal>
        )}
      </div>
    </Portal>
  );
};

export default PlanEditor;
