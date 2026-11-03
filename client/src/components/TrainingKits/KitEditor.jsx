import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  OPT, OUT_TYPES, isTech, ATTACH_DESC, CHECKS, SECTIONS, MAKE,
  normalize, analyze, derive, idOf, getPath, setPath, has, ar, fmt,
  DAYS, HOURS, GROUPS, PEOPLE, NOTES, fmtKitNo, fmtDay, humanSize, statusOf
} from './kitModel';
import { AutoArea, TagsInput, Seg, AuthedImage, Portal, useBodyLock, Modal, KitHistory } from './KitParts';
import { KIT_ROUTES, uploadFile, compressImage, downloadFile, printDocument, errorText } from './kitApi';
import './TrainingKits.css';

const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
const HINTS_KEY = 'tk_hints';
const DOMAINS = ['الإلكترونيات', 'البرمجة', 'الروبوتات', 'إنترنت الأشياء', 'التصميم ثنائي الأبعاد', 'التصميم ثلاثي الأبعاد', 'الطباعة ثلاثية الأبعاد', 'القص بالليزر', 'التصنيع باستخدام CNC', 'القص بالفينيل والخياطة الرقمية', 'الذكاء الاصطناعي', 'ريادة الأعمال والابتكار'];
const TOOLS = ['Arduino Uno', 'ESP32', 'Raspberry Pi', 'micro:bit', 'Arduino IDE', 'Tinkercad', 'Fusion 360', 'Shapr3D', 'Inkscape', 'LightBurn', 'Ultimaker Cura', 'Bambu Studio', 'PrusaSlicer', 'جهاز القص بالليزر', 'الطابعة ثلاثية الأبعاد', 'جهاز CNC', 'قاطعة الفينيل', 'الملتيميتر'];
const UNITS = ['قطعة', 'علبة', 'لوح', 'متر', 'بكرة', 'رخصة', 'جهاز', 'طقم', 'نسخة', 'مجموعة'];
const LEAD = ['يوم واحد', 'يومان', '3 أيام', '5 أيام', 'أسبوع', 'أسبوعان', 'شهر'];

/**
 * The employee's kit form (the kit template, in the system's style).
 * Saves to the server as you type; "إرسال للمراجعة" freezes a version and
 * sends it to the project manager.
 */
const KitEditor = ({ api, kit, portalTarget, theme = 'dark', onClose, onSubmitted }) => {
  useBodyLock();
  const [data, setData] = useState(() => normalize(kit.data));
  const [save, setSave] = useState({ state: 'idle', at: null });
  const [hints, setHints] = useState(() => { try { return localStorage.getItem(HINTS_KEY) !== '0'; } catch { return true; } });
  const [active, setActive] = useState('s1');
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState({}); // uploads in progress: { key: [names] }
  const [submitOpen, setSubmitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const dirty = useRef(false);
  const latest = useRef(data);
  const imgInput = useRef(null);

  const A = useMemo(() => analyze(data), [data]);
  const D = useMemo(() => derive(data), [data]);
  const locked = !['draft', 'returned'].includes(kit.status);

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
      await api.put(`/training-kits/mine/${kit.kitId}`, { data: latest.current, completion: analyze(latest.current).pct });
      setSave({ state: 'ok', at: new Date() });
      return true;
    } catch (err) {
      dirty.current = true;
      setSave({ state: 'error', at: null, msg: errorText(err, 'تعذّر الحفظ — تحقق من الاتصال') });
      return false;
    }
  }, [api, kit.kitId]);

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
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) setActive(en.target.id.replace('tk-', '')); }), { root, rootMargin: '-25% 0px -65% 0px' });
    root.querySelectorAll('.tk-sec').forEach(s => io.observe(s));
    return () => io.disconnect();
  }, []);

  const goto = (id) => {
    const el = document.getElementById(id) || document.getElementById(`tk-${id}`);
    if (!el) return;
    if (el.classList.contains('tk-sec')) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const f = el.matches('input,select,textarea,button') ? el : el.querySelector('textarea,input,select,button');
    const ring = el.closest('.tk-field,.tk-rt-row,.tk-olist>li,.tk-itile,.tk-day,.tk-att,.tk-panel') || el;
    setTimeout(() => {
      if (f) f.focus({ preventScroll: true });
      ring.classList.remove('tk-flash'); void ring.offsetWidth; ring.classList.add('tk-flash');
    }, 380);
  };

  // ── lists ──
  const addItem = (path, make) => update(n => { getPath(n, path).push(make()); });
  const removeItem = (path, idx) => update(n => {
    const arr = getPath(n, path);
    const [item] = arr.splice(idx, 1);
    if (!item) return;
    if (path === 'card.objectives') { n.plan.forEach(d => { d.objectives = d.objectives.filter(x => x !== item.id); }); if (!arr.length) arr.push(MAKE.objective()); }
    if (path === 'outputs') {
      n.plan.forEach(d => { d.outputs = d.outputs.filter(x => x !== item.id); });
      n.measures.concat(n.images).forEach(m => { if (m.outputId === item.id) m.outputId = ''; });
    }
  });
  const toggleIn = (path, value) => update(n => {
    const arr = getPath(n, path);
    const k = arr.indexOf(value);
    if (k > -1) arr.splice(k, 1); else arr.push(value);
  });

  // ── files ──
  const markBusy = (key, name, on) => setBusy(b => {
    const list = new Set(b[key] || []);
    if (on) list.add(name); else list.delete(name);
    return { ...b, [key]: [...list] };
  });

  const addImages = async (files) => {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type));
    if (!list.length) { toast.error('اختر صورة بصيغة PNG أو JPG أو SVG'); return; }
    for (const f of list) {
      markBusy('images', f.name, true);
      try {
        const small = await compressImage(f);
        const up = await uploadFile(api, kit.kitId, small, 'image');
        update(n => {
          const next = n.outputs.find(o => isTech(o.type) && !n.images.some(im => im.outputId === o.id));
          n.images.push({ ...MAKE.image(), fileId: up.fileId, name: up.name, outputId: next ? next.id : '' });
        });
      } catch (err) {
        toast.error(errorText(err, `تعذّر رفع الصورة ${f.name}`));
      } finally {
        markBusy('images', f.name, false);
      }
    }
  };

  const addAttachments = async (i, files) => {
    for (const f of Array.from(files || [])) {
      markBusy(`att${i}`, f.name, true);
      try {
        const up = await uploadFile(api, kit.kitId, f, 'attachment');
        update(n => { n.attachments[i].files.push({ fileId: up.fileId, name: up.name, size: up.size, mime: up.mime }); });
      } catch (err) {
        toast.error(errorText(err, `تعذّر رفع الملف ${f.name}`));
      } finally {
        markBusy(`att${i}`, f.name, false);
      }
    }
  };

  const dropFile = (fileId) => { api.delete(`/training-kits/mine/${kit.kitId}/files/${fileId}`).catch(() => {}); };

  const download = (f) => downloadFile(api, KIT_ROUTES.mine.file(f.fileId), f.name).catch(err => toast.error(errorText(err, 'تعذّر التنزيل')));

  const preview = async () => {
    await persist();
    printDocument(api, KIT_ROUTES.mine.doc(kit.kitId), { draft: 1 }).catch(err => toast.error(errorText(err, 'تعذّر تجهيز المعاينة')));
  };

  // ── submit ──
  const resubmission = kit.currentVersion > 0;
  const submit = async () => {
    if (resubmission && !note.trim()) { toast.error('اكتب ما الذي عدّلته في هذا الإصدار'); return; }
    setSending(true);
    try {
      if (!(await persist())) throw new Error('save');
      const { data: updated } = await api.post(`/training-kits/mine/${kit.kitId}/submit`, { note: note.trim() });
      toast.success(`أُرسلت الحقيبة إلى ${kit.pm || 'مسؤول إدارة المشاريع'} — الإصدار ${updated.currentVersion}`);
      setSubmitOpen(false);
      onSubmitted?.(updated);
    } catch (err) {
      toast.error(err.message === 'save' ? 'تعذّر حفظ آخر التعديلات قبل الإرسال' : errorText(err, 'تعذّر الإرسال'));
    } finally {
      setSending(false);
    }
  };

  // ── control builders (plain functions → stable element types) ──
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
  const select = (path, opts, o = {}) => (
    <select className="tk-in" id={idOf(path)} value={val(path)} aria-label={o.label} disabled={locked} onChange={(e) => set(path, e.target.value)}>
      {o.ph !== null && <option value="">{o.ph || 'اختر…'}</option>}
      {opts.map(x => { const ov = typeof x === 'string' ? x : x.v; const ol = typeof x === 'string' ? x : x.l; return <option key={ov} value={ov}>{ol}</option>; })}
    </select>
  );
  const seg = (path, opts, labelId) => <Seg id={idOf(path)} options={opts} value={val(path)} labelledBy={labelId} onChange={(v) => !locked && set(path, v)} />;
  const outputSelect = (path, label) => (
    <select className="tk-in" id={idOf(path)} value={val(path)} aria-label={label || 'المخرج'} disabled={locked} onChange={(e) => set(path, e.target.value)}>
      <option value="">اختر المخرج…</option>
      {data.outputs.map((o, i) => <option key={o.id} value={o.id}>{`م${i + 1} — ${o.name || 'مخرج بلا اسم'}`}</option>)}
    </select>
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
  const rm = (path, i, label) => !locked && (
    <button type="button" className="tk-ibtn danger" onClick={() => removeItem(path, i)} aria-label={label} title={label}>🗑</button>
  );
  const addBtn = (path, make, label) => !locked && (
    <button type="button" className="tk-add" onClick={() => addItem(path, make)}>＋ {label}</button>
  );
  const secHead = (n, title, desc, key) => {
    const count = key === 'done' ? A.issues.length : A.issues.filter(x => x.sec === key).length;
    return (
      <header className="tk-sec-head">
        <span className="tk-sec-num">{n}</span>
        <div><h2>{title}</h2>{desc && <p className="tk-sec-desc">{desc}</p>}</div>
        <span className={`tk-pill ${count ? 'amber' : 'mint'}`}>{count ? ar(count, NOTES) : 'مكتمل'}</span>
      </header>
    );
  };
  const panelHead = (t, note) => (
    <div className="tk-panel-head"><h3 className="tk-panel-title">{t}</h3>{note && <p className="tk-panel-note">{note}</p>}</div>
  );

  // ── 1. card ──
  const c = data.card; const p = 'card.';
  const renderCard = () => (
    <section className="tk-sec" id="tk-s1">
      {secHead('1', 'بطاقة البرنامج التدريبي', 'البيانات الأساسية التي يُعرَّف بها البرنامج في الإعلان والشهادات، وتُبنى عليها بقية أقسام الحقيبة.', 'card')}
      <div className="tk-panel">
        {panelHead('التعريف بالبرنامج')}
        <div className="tk-grid">
          {field({ key: 'name', label: 'اسم البرنامج التدريبي', req: 1, wide: 1, for: idOf(`${p}name`), hint: 'الاسم الرسمي المختصر المستخدم في الإعلان والشهادات.', control: text(`${p}name`, { ph: 'مثال: البيت الذكي المصغّر' }) })}
          {field({ key: 'desc', label: 'وصف البرنامج التدريبي', req: 1, wide: 1, for: idOf(`${p}description`), hint: 'سطران يوضحان فكرة البرنامج والتجربة التي سيخوضها المشارك.', control: area(`${p}description`, { rows: 2 }) })}
          {field({ key: 'type', label: 'نوع البرنامج', req: 1, wide: 1, labelId: 'tkl-type', hint: 'قصير / ممتد / معسكر / سلسلة تدريبية ضمن عضوية.', control: seg(`${p}type`, OPT.type, 'tkl-type') })}
          {field({ key: 'level', label: 'المستوى', req: 1, labelId: 'tkl-level', hint: 'تأسيسي / متوسط / متقدم، مع رقم المستوى داخل كل مستوى عام.', control: <div className="tk-lvl">{seg(`${p}level`, OPT.level, 'tkl-level')}<span className="tk-sub"><label htmlFor={idOf(`${p}sublevel`)}>رقم المستوى</label>{numIn(`${p}sublevel`, { min: 1, ph: '1' })}</span></div> })}
          {field({ key: 'prac', label: 'نوع التطبيق العملي', req: 1, labelId: 'tkl-prac', hint: 'فردي / جماعي / كلاهما.', control: seg(`${p}practical`, OPT.practical, 'tkl-prac') })}
          {field({ key: 'deliv', label: 'آلية تقديم البرنامج', req: 1, labelId: 'tkl-deliv', control: seg(`${p}delivery`, OPT.delivery, 'tkl-deliv') })}
          {field({ key: 'lang', label: 'لغة البرنامج', req: 1, labelId: 'tkl-lang', control: seg(`${p}language`, OPT.language, 'tkl-lang') })}
        </div>
      </div>
      <div className="tk-panel">
        {panelHead('المجالات والأدوات')}
        <div className="tk-grid">
          {field({ key: 'pd', label: 'المجال الأساسي', req: 1, for: idOf(`${p}primaryDomain`), hint: 'المجال العلمي أو التقني الذي يقوم عليه البرنامج.', control: text(`${p}primaryDomain`, { list: 'tk-dl-domains', ph: 'مثال: الإلكترونيات والبرمجة' }) })}
          {field({ key: 'sd', label: 'المجالات المساندة', for: idOf(`${p}supportDomains`), hint: 'يمكن ذكر أكثر من مجال. اضغط Enter بعد كل مجال.', control: <TagsInput id={idOf(`${p}supportDomains`)} value={c.supportDomains} list="tk-dl-domains" placeholder="أضف مجالًا" onChange={(v) => !locked && set(`${p}supportDomains`, v)} /> })}
          {field({ key: 'tools', label: 'الأجهزة والبرامج', req: 1, wide: 1, for: idOf(`${p}tools`), hint: 'الأجهزة والمنصات والبرامج الأساسية المستخدمة في التدريب.', control: <TagsInput id={idOf(`${p}tools`)} value={c.tools} list="tk-dl-tools" placeholder="أضف جهازًا أو برنامجًا ثم اضغط Enter" onChange={(v) => !locked && set(`${p}tools`, v)} /> })}
        </div>
      </div>
      <div className="tk-panel">
        {panelHead(<>أهداف البرنامج <span className="tk-req">*</span></>, 'تُستخدم أرقامها لربط أيام الخطة بها.')}
        <p className="tk-hint" style={{ margin: '-8px 0 14px' }}>ترقم الأهداف وتكتب بصياغة محددة وقابلة للقياس.</p>
        <ol className="tk-olist">
          {c.objectives.map((o, i) => (
            <li key={o.id}>
              <span className="tk-code" aria-hidden="true">ه{i + 1}</span>
              {area(`card.objectives.${i}.text`, { ph: 'أن + فعل قابل للقياس + المحتوى + معيار الأداء', label: `الهدف ${i + 1}` })}
              {rm('card.objectives', i, `حذف الهدف ${i + 1}`)}
            </li>
          ))}
        </ol>
        <div className="tk-list-foot">{addBtn('card.objectives', MAKE.objective, 'إضافة هدف')}</div>
      </div>
      <div className="tk-panel">
        {panelHead('الفئة المستهدفة والمدة')}
        <div className="tk-grid">
          {field({ key: 'target', label: 'الفئة المستهدفة', req: 1, wide: 1, for: idOf(`${p}target`), hint: 'مثل: طلبة، معلمون، مبتدئون أو ممارسون.', control: text(`${p}target`) })}
          {field({ key: 'age', label: 'الفئة العمرية', req: 1, for: idOf(`${p}ageMin`), hint: 'الحد الأدنى والأعلى للعمر.', control: <div className="tk-pair">{numIn(`${p}ageMin`, { sfx: 'سنة', ph: 'من' })}<span className="sep">إلى</span>{numIn(`${p}ageMax`, { sfx: 'سنة', ph: 'إلى', label: 'الحد الأعلى للعمر' })}</div> })}
          {field({ key: 'part', label: 'عدد المشاركين', req: 1, for: idOf(`${p}partMin`), hint: 'العدد الإجمالي وتوزيعه حسب الفئات عند الحاجة.', control: <><div className="tk-pair">{numIn(`${p}partMin`, { sfx: 'مشارك', sfxW: 52, ph: 'الأدنى' })}<span className="sep">إلى</span>{numIn(`${p}partMax`, { sfx: 'مشارك', sfxW: 52, ph: 'الأعلى', label: 'الحد الأعلى للمشاركين' })}</div>{text(`${p}partNote`, { ph: 'التوزيع حسب الفئات (اختياري)', label: 'توزيع المشاركين حسب الفئات' })}</> })}
          {field({ key: 'groups', label: 'تقسيم المشاركين', for: idOf(`${p}groupSize`), hint: 'عدد المجموعات وعدد المشاركين في كل مجموعة.', control: numIn(`${p}groupSize`, { sfx: 'مشاركين في كل مجموعة', sfxW: 150, min: 1, ph: '4' }),
            calc: D.gs && D.pmax ? `= ${ar(D.groups(D.pmax), GROUPS)} عند الحد الأعلى${D.pmin ? ` · ${ar(D.groups(D.pmin), GROUPS)} عند الحد الأدنى` : ''}` : '', idle: 'يُحسب عدد المجموعات من عدد المشاركين وحجم المجموعة.' })}
          {field({ key: 'dur', label: 'المدة', req: 1, for: idOf(`${p}days`), hint: 'عدد الأيام × الساعات اليومية، مع إجمالي الساعات.', control: <div className="tk-pair">{numIn(`${p}days`, { sfx: 'أيام', min: 1, ph: '4' })}<span className="sep">×</span>{numIn(`${p}hours`, { sfx: 'ساعات يوميًا', sfxW: 86, step: '0.5', ph: '3', label: 'الساعات اليومية' })}</div>,
            calc: D.d && D.h ? `= ${ar(D.d * D.h, HOURS)} تدريبية إجمالًا` : '', idle: 'يُحسب إجمالي الساعات من عدد الأيام والساعات اليومية.' })}
          {field({ key: 'prereq', label: 'شروط الالتحاق', req: 1, wide: 1, for: idOf(`${p}prereq`), hint: 'المعرفة أو البرامج السابقة المطلوبة، أو لا يوجد.', control: text(`${p}prereq`) })}
        </div>
      </div>
      <div className="tk-panel">
        {panelHead('التكلفة')}
        <div className="tk-grid">
          {field({ key: 'cost', label: 'تكلفة المستهلكات', req: 1, wide: 1, labelId: 'tkl-cost', hint: 'التكلفة لكل مشارك أو مجموعة، والإجمالي عند الحدين الأدنى والأعلى.', control: (
            <>
              <div className="tk-pair2">
                <div><label className="tk-mini" htmlFor={idOf(`${p}costPerson`)}>لكل مشارك</label>{numIn(`${p}costPerson`, { sfx: 'ر.س', step: 'any', ph: '0' })}</div>
                <div><label className="tk-mini" htmlFor={idOf(`${p}costGroup`)}>لكل مجموعة</label>{numIn(`${p}costGroup`, { sfx: 'ر.س', step: 'any', ph: '0' })}</div>
              </div>
              <div className="tk-tiles" aria-live="polite">
                {[['الإجمالي عند الحد الأدنى', D.pmin], ['الإجمالي عند الحد الأعلى', D.pmax]].map(([l, pp]) => {
                  const v = D.cost(pp);
                  return <div className="tk-tile" key={l}><span>{l}{pp != null ? ` (${ar(pp, PEOPLE)})` : ''}</span>{v == null || (!D.cp && !D.cg) ? <b className="dim">—</b> : <b>{fmt(v)}<small>ر.س</small></b>}</div>;
                })}
                {D.cg && !D.gs ? <p className="tk-tiles-note">حدد عدد المشاركين في كل مجموعة لاحتساب تكلفة المجموعات.</p> : null}
              </div>
            </>
          ) })}
          {field({ key: 'setup', label: 'تكلفة تأسيسية غير متكررة', for: idOf(`${p}setup`), hint: 'قيمة جهاز أو أداة غير متوفرة، أو لا يوجد.', control: text(`${p}setup`) })}
          {field({ key: 'other', label: 'اعتبارات أخرى', for: idOf(`${p}other`), hint: 'أي شرط مؤثر في الفئات أو المقاعد أو التنفيذ.', control: area(`${p}other`, { rows: 2 }) })}
        </div>
      </div>
      <div className="tk-panel">
        {panelHead('الإعداد والإصدار')}
        <div className="tk-grid">
          {field({ key: 'author', label: 'مُعدّ المحتوى العلمي', req: 1, for: idOf(`${p}author`), hint: 'اسم المسؤول أو فريق الإعداد.', control: text(`${p}author`) })}
          {field({ key: 'ver', label: 'رقم الإصدار وتاريخ التحديث', req: 1, for: idOf(`${p}version`), hint: 'رقم النسخة وتاريخ آخر تحديث معتمد.', control: <div className="tk-pair">{text(`${p}version`, { ph: '1.0', cls: 'num ver' })}{dateIn(`${p}versionDate`, 'تاريخ التحديث')}</div> })}
        </div>
      </div>
    </section>
  );

  // ── 2. outputs ──
  const renderOutputs = () => (
    <section className="tk-sec" id="tk-s2">
      {secHead('2', 'مخرجات البرنامج وتسليماته', 'ترقم جميع المخرجات، ويستخدم الوصف والصورة المرجعية لمطابقة المنفذ فعليًا بما تم اعتماده.', 'outputs')}
      <div className="tk-panel">
        {panelHead('المخرجات', 'المخرج التقني يحتاج صورة مرجعية في الأسفل.')}
        <div className="tk-items" id="tk-list-outputs">
          {!data.outputs.length && <p className="tk-empty">لا توجد مخرجات بعد.</p>}
          {data.outputs.map((o, i) => {
            const q = `outputs.${i}.`;
            return (
              <div className="tk-item" key={o.id}>
                <div className="tk-code-col"><span className="tk-code out" title="رقم المخرج">م{i + 1}</span>{isTech(o.type) && <span className="tk-tech">تقني</span>}</div>
                <div className="tk-grid g-out">
                  {field({ key: 'n', label: 'اسم المخرج', req: 1, for: idOf(`${q}name`), control: text(`${q}name`) })}
                  {field({ key: 't', label: 'النوع', req: 1, for: idOf(`${q}type`), control: (
                    <select className="tk-in" id={idOf(`${q}type`)} value={o.type} disabled={locked} onChange={(e) => set(`${q}type`, e.target.value)}>
                      <option value="">اختر النوع…</option>
                      <optgroup label="مخرجات تقنية (تتطلب صورة مرجعية)">{OUT_TYPES.filter(t => t.tech).map(t => <option key={t.v} value={t.v}>{t.v}</option>)}</optgroup>
                      <optgroup label="مخرجات أخرى">{OUT_TYPES.filter(t => !t.tech).map(t => <option key={t.v} value={t.v}>{t.v}</option>)}</optgroup>
                    </select>
                  ) })}
                  {field({ key: 'c', label: 'العدد', req: 1, for: idOf(`${q}count`), control: numIn(`${q}count`, { ph: '0' }) })}
                  {field({ key: 'o', label: 'الملكية', req: 1, for: idOf(`${q}owner`), control: select(`${q}owner`, OPT.owner) })}
                  {field({ key: 'd', label: 'الوصف المختصر', req: 1, wide: 1, for: idOf(`${q}desc`), control: area(`${q}desc`, { ph: 'شكله ووظيفته وما الذي ينفذه المشارك بنفسه' }) })}
                </div>
                {rm('outputs', i, `حذف المخرج م${i + 1}`)}
              </div>
            );
          })}
        </div>
        <div className="tk-list-foot">{addBtn('outputs', MAKE.output, 'إضافة مخرج')}</div>
      </div>
      <div className="tk-panel">
        {panelHead('قياس تحقق المخرجات', 'معيار مكتمل واحد على الأقل لكل مخرج.')}
        <div style={{ '--cols': 'minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1.3fr) 36px' }}>
          <div className="tk-rt-head"><span>رقم واسم المخرج</span><span>ما الذي سنقيسه؟</span><span>النتيجة المطلوبة</span><span>كيف نثبت تحققها؟</span><span /></div>
          <div className="tk-rt-body" id="tk-list-measures">
            {!data.measures.length && <p className="tk-empty">لا توجد معايير قياس بعد.</p>}
            {data.measures.map((m, i) => {
              const q = `measures.${i}.`;
              return (
                <div className="tk-rt-row" key={m.id}>
                  <div className="tk-cell"><span className="tk-cell-lbl">رقم واسم المخرج</span>{outputSelect(`${q}outputId`, 'رقم واسم المخرج')}</div>
                  <div className="tk-cell"><span className="tk-cell-lbl">ما الذي سنقيسه؟</span>{area(`${q}what`, { label: 'ما الذي سنقيسه؟' })}</div>
                  <div className="tk-cell"><span className="tk-cell-lbl">النتيجة المطلوبة</span>{area(`${q}result`, { label: 'النتيجة المطلوبة' })}</div>
                  <div className="tk-cell"><span className="tk-cell-lbl">كيف نثبت تحققها؟</span>{area(`${q}proof`, { label: 'كيف نثبت تحققها؟' })}</div>
                  <div className="tk-cell act">{rm('measures', i, 'حذف معيار القياس')}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="tk-list-foot">{addBtn('measures', () => ({ ...MAKE.measure(), outputId: (data.outputs.find(o => !data.measures.some(m => m.outputId === o.id)) || {}).id || '' }), 'إضافة معيار قياس')}</div>
      </div>
      <div className="tk-panel">
        {panelHead('الصور المرجعية للمخرجات التقنية', 'تُصغَّر الصور تلقائيًا وتُحفظ مع الحقيبة.')}
        <div className="tk-igrid" id="tk-list-images">
          {data.images.map((im, i) => (
            <figure className="tk-itile" key={im.id}>
              <div className="ph"><AuthedImage api={api} url={KIT_ROUTES.mine.file(im.fileId)} alt={im.caption || 'صورة مرجعية'} /></div>
              <figcaption className="meta">
                <div><label className="tk-mini" htmlFor={idOf(`images.${i}.outputId`)}>رقم المخرج</label>{outputSelect(`images.${i}.outputId`)}</div>
                {text(`images.${i}.caption`, { ph: 'وصف قصير للصورة', label: 'وصف الصورة' })}
              </figcaption>
              {!locked && <button type="button" className="tk-ibtn danger over" aria-label="حذف الصورة" title="حذف الصورة" onClick={() => { dropFile(im.fileId); removeItem('images', i); }}>🗑</button>}
            </figure>
          ))}
          {(busy.images || []).map(n => <div key={n} className="tk-drop" aria-busy="true"><span className="big">⏳</span><b>جارٍ رفع الصورة…</b><span>{n}</span></div>)}
          {!locked && (
            <button type="button" className="tk-drop" onClick={() => imgInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('over')}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); addImages(e.dataTransfer.files); }}>
              <span className="big">🖼</span><b>أضف صورة مرجعية</b><span>اسحب الصورة إلى هنا أو اضغط للاختيار. PNG أو JPG أو SVG.</span>
            </button>
          )}
          <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} />
        </div>
      </div>
    </section>
  );

  // ── 3. plan ──
  const picker = (kind, i) => {
    const isObj = kind === 'obj';
    const list = isObj ? c.objectives : data.outputs;
    const sel = data.plan[i][isObj ? 'objectives' : 'outputs'];
    if (!list.length) return <span className="tk-muted-s">{isObj ? 'أضف أهداف البرنامج في بطاقة البرنامج أولًا.' : 'أضف المخرجات في القسم 2 أولًا.'}</span>;
    return list.map((x, j) => {
      const t = isObj ? String(x.text || '').replace(/^أن\s+/, '') : x.name;
      return (
        <button key={x.id} type="button" className={`tk-pk ${kind}`} aria-pressed={sel.includes(x.id)} title={(isObj ? x.text : x.name) || ''}
          disabled={locked} onClick={() => toggleIn(`plan.${i}.${isObj ? 'objectives' : 'outputs'}`, x.id)}>
          <b>{isObj ? 'ه' : 'م'}{j + 1}</b>{t && <span className="t">{t}</span>}
        </button>
      );
    });
  };
  const renderPlan = () => (
    <section className="tk-sec" id="tk-s3">
      {secHead('3', 'خطة تنفيذ البرنامج', 'تذكر الأهداف والمخرجات بالرقم أو الاسم المعتمد في بطاقة البرنامج، دون إعادة وصفها كاملًا.', 'plan')}
      <div className="tk-days" id="tk-list-plan">
        {!data.plan.length && <p className="tk-empty">لا توجد أيام في الخطة بعد.</p>}
        {data.plan.map((d, i) => {
          const q = `plan.${i}.`;
          return (
            <article className="tk-day" id={`tk-day-${d.id}`} key={d.id}>
              <header className="tk-day-head"><h3 className="tk-day-n">اليوم<b>{i + 1}</b></h3>{rm('plan', i, `حذف اليوم ${i + 1}`)}</header>
              <div className="tk-day-body tk-grid">
                {field({ key: 'l', label: 'ماذا سنتعلم اليوم؟', req: 1, wide: 1, for: idOf(`${q}learn`), control: area(`${q}learn`) })}
                {field({ key: 't', label: 'المحاور', req: 1, wide: 1, for: idOf(`${q}topics`), control: area(`${q}topics`, { rows: 2, ph: 'افصل بين المحاور بفاصلة' }) })}
                {field({ key: 'o', label: 'الأهداف المرتبطة', req: 1, labelId: `tkl-po-${i}`, control: <div className="tk-picker" role="group" aria-labelledby={`tkl-po-${i}`}>{picker('obj', i)}</div> })}
                {field({ key: 'u', label: 'المخرجات المرتبطة', req: 1, labelId: `tkl-pu-${i}`, control: <div className="tk-picker" role="group" aria-labelledby={`tkl-pu-${i}`}>{picker('out', i)}</div> })}
                {field({ key: 'e', label: 'التنفيذ والمدة', req: 1, for: idOf(`${q}execution`), control: area(`${q}execution`, { ph: 'مثال: فردي · 3 ساعات (ساعة شرح وساعتان تطبيق)' }) })}
                {field({ key: 'v', label: 'التحقق', req: 1, for: idOf(`${q}verify`), control: area(`${q}verify`, { ph: 'كيف نتأكد أن المشارك حقق هدف اليوم؟' }) })}
              </div>
            </article>
          );
        })}
      </div>
      <div className="tk-list-foot" style={{ marginTop: 0 }}>
        {addBtn('plan', MAKE.day, 'إضافة يوم')}
        {D.d ? <span className="tk-muted-s">مدة البرنامج في البطاقة: {ar(D.d, DAYS)} · في الخطة: {ar(data.plan.length, DAYS)}</span> : null}
      </div>
    </section>
  );

  // ── 4. resources ──
  const renderResources = () => (
    <section className="tk-sec" id="tk-s4">
      {secHead('4', 'الاحتياجات والموارد', 'الموارد البشرية والمادية ومتطلبات الجاهزية قبل التنفيذ.', 'resources')}
      <div className="tk-panel">
        {panelHead('الموارد البشرية')}
        <div style={{ '--cols': 'minmax(0,.9fr) 84px minmax(0,1.6fr) minmax(0,1.6fr) 36px' }}>
          <div className="tk-rt-head"><span>المورد البشري</span><span>العدد</span><span>الخبرة أو الشروط المطلوبة</span><span>المهام</span><span /></div>
          <div className="tk-rt-body">
            {data.staff.map((s, i) => {
              const q = `staff.${i}.`;
              return (
                <div className="tk-rt-row" key={s.id}>
                  <div className="tk-cell half"><span className="tk-cell-lbl">المورد البشري</span>{s.fixed ? <span className="tk-role">{s.role}</span> : text(`${q}role`, { ph: 'اسم الدور', label: 'المورد البشري' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">العدد</span>{numIn(`${q}count`, { label: `العدد: ${s.role || 'الدور'}`, ph: '0' })}</div>
                  <div className="tk-cell"><span className="tk-cell-lbl">الخبرة أو الشروط المطلوبة</span>{area(`${q}expertise`, { label: 'الخبرة أو الشروط المطلوبة' })}</div>
                  <div className="tk-cell"><span className="tk-cell-lbl">المهام</span>{area(`${q}tasks`, { label: 'المهام' })}</div>
                  <div className="tk-cell act">{!s.fixed && rm('staff', i, 'حذف الدور')}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="tk-list-foot">{addBtn('staff', MAKE.staff, 'إضافة دور')}</div>
      </div>
      <div className="tk-panel">
        {panelHead('الاحتياجات المادية والتقنية', D.pmax != null ? `تُحسب الكميات على الحد الأعلى: ${ar(D.pmax, PEOPLE)}${D.gmax ? ` في ${ar(D.gmax, GROUPS)}` : ''}` : 'حدد الحد الأعلى للمشاركين في بطاقة البرنامج لحساب الكميات.')}
        <p className="tk-hint" style={{ margin: '-8px 0 14px' }}>المواد والمستهلكات والأجهزة والأدوات والقطع والبرامج والتراخيص.</p>
        <div style={{ '--cols': 'minmax(0,1.3fr) minmax(0,1.5fr) minmax(0,.8fr) minmax(0,1.7fr) minmax(0,.8fr) minmax(0,1.1fr) 36px' }}>
          <div className="tk-rt-head"><span>الاحتياج</span><span>المواصفات</span><span>الوحدة</span><span>الكمية للفرد/المجموعة</span><span>الكمية الإجمالية</span><span>ملاحظات</span><span /></div>
          <div className="tk-rt-body" id="tk-list-needs">
            {!data.needs.length && <p className="tk-empty">لا توجد احتياجات بعد.</p>}
            {data.needs.map((x, i) => {
              const q = `needs.${i}.`;
              const t = D.needTotal(x);
              return (
                <div className="tk-rt-row" key={x.id}>
                  <div className="tk-cell"><span className="tk-cell-lbl">الاحتياج</span>{area(`${q}item`, { label: 'الاحتياج' })}</div>
                  <div className="tk-cell"><span className="tk-cell-lbl">المواصفات</span>{area(`${q}specs`, { label: 'المواصفات' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">الوحدة</span>{text(`${q}unit`, { list: 'tk-dl-units', label: 'الوحدة' })}</div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">الكمية للفرد/المجموعة</span><div className="tk-qb">{numIn(`${q}qty`, { step: 'any', label: 'الكمية' })}{select(`${q}basis`, OPT.basis, { ph: null, label: 'أساس الحساب' })}</div></div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">الكمية الإجمالية</span><output className="tk-total">{t == null ? <span className="dim">—</span> : <>{fmt(t)}{x.unit && <small>{x.unit}</small>}</>}</output></div>
                  <div className="tk-cell half"><span className="tk-cell-lbl">ملاحظات</span>{area(`${q}notes`, { label: 'ملاحظات' })}</div>
                  <div className="tk-cell act">{rm('needs', i, 'حذف الاحتياج')}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="tk-list-foot">{addBtn('needs', MAKE.need, 'إضافة احتياج')}</div>
      </div>
      <div className="tk-panel">
        {panelHead('متطلبات الجاهزية قبل التنفيذ')}
        <div style={{ '--cols': 'minmax(0,.8fr) minmax(0,2.2fr) minmax(0,1fr)' }}>
          <div className="tk-rt-head"><span>بند الجاهزية</span><span>ما يجب تجهيزه أو التحقق منه</span><span>المدة اللازمة قبل التنفيذ</span></div>
          <div className="tk-rt-body">
            {data.readiness.map((r, i) => (
              <div className="tk-rt-row" key={r.label}>
                <div className="tk-cell"><span className="tk-role">{r.label}</span></div>
                <div className="tk-cell"><span className="tk-cell-lbl">ما يجب تجهيزه أو التحقق منه</span>{area(`readiness.${i}.prepare`, { label: `ما يجب تجهيزه: ${r.label}` })}</div>
                <div className="tk-cell"><span className="tk-cell-lbl">المدة اللازمة قبل التنفيذ</span>{text(`readiness.${i}.lead`, { list: 'tk-dl-lead', ph: 'مثال: أسبوع', label: `المدة اللازمة قبل التنفيذ: ${r.label}` })}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  // ── 5. attachments ──
  const renderAttachments = () => (
    <section className="tk-sec" id="tk-s5">
      {secHead('5', 'مرفقات الحقيبة', 'ارفع ملف كل مرفق هنا مباشرة — يصل نسخة منه إلى المراجعين ويُحفظ مع الحقيبة.', 'attachments')}
      <div className="tk-panel">
        {data.attachments.map((a, i) => (
          <div className="tk-att" id={`tk-att-${i}`} key={a.label}>
            <div className="tk-att-name"><span className={`tk-dot ${a.files.length ? 'ok' : ''}`}>✓</span>{a.label}</div>
            <p className="tk-att-inc">{ATTACH_DESC[a.label]}</p>
            <div className="tk-files">
              {a.files.map((f, j) => (
                <div className="tk-file" key={f.fileId}>
                  <span aria-hidden="true">📎</span>
                  <span className="name" title={f.name}>{f.name}</span>
                  <span className="size">{f.size ? humanSize(f.size) : ''}</span>
                  <button type="button" className="tk-ibtn" title="تنزيل" aria-label={`تنزيل ${f.name}`} onClick={() => download(f)}>⬇</button>
                  {!locked && <button type="button" className="tk-ibtn danger" title="حذف" aria-label={`حذف ${f.name}`} onClick={() => { dropFile(f.fileId); update(n => { n.attachments[i].files.splice(j, 1); }); }}>🗑</button>}
                </div>
              ))}
              {(busy[`att${i}`] || []).map(n => <div className="tk-file busy" key={n}><span>⏳</span><span className="name">{n}</span><span className="size">جارٍ الرفع…</span></div>)}
              {!locked && (
                <label className="tk-up">
                  ⬆ {a.files.length ? 'إضافة ملف آخر' : 'رفع الملف'}
                  <input type="file" multiple hidden onChange={(e) => { addAttachments(i, e.target.files); e.target.value = ''; }} />
                </label>
              )}
              <AutoArea value={a.note} disabled={locked} placeholder="ملاحظة أو رابط (اختياري)" aria-label={`ملاحظة ${a.label}`} onChange={(v) => set(`attachments.${i}.note`, v)} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  // ── 6. approval + certificate ──
  const lastV = (kit.versions || [])[(kit.versions || []).length - 1];
  const flowRow = (label, who, decision, at) => (
    <div className="tk-flow-row">
      <div><b>{label}</b><small>{who}</small></div>
      {decision === 'approved' ? <span className="tk-pill mint">✓ معتمد · {fmtDay(at)}</span>
        : decision === 'returned' ? <span className="tk-pill red">↩ أُعيدت للتعديل</span>
          : <span className="tk-pill muted">بانتظار المراجعة</span>}
    </div>
  );
  const renderApproval = () => (
    <section className="tk-sec" id="tk-s6">
      {secHead('6', 'المراجعة العلمية والاعتماد', 'يُعتمد إلكترونيًا بالاسم والتاريخ عند موافقة مسؤول إدارة المشاريع ثم المدير.', 'approval')}
      <div className="tk-panel">
        <div className="tk-flow">
          {flowRow('المراجعة العلمية والتقنية', lastV?.pmName || kit.pm || 'مسؤول إدارة المشاريع', lastV?.pmDecision, lastV?.pmAt)}
          {flowRow('اعتماد الحقيبة', lastV?.managerName || 'المدير', lastV?.managerDecision, lastV?.managerAt)}
        </div>
      </div>
      <div className="tk-panel">
        <div className="tk-grid">
          {field({ key: 'ct', label: 'نوع الشهادة', req: 1, wide: 1, labelId: 'tkl-cert', hint: 'ارتباطها بمعايير القياس التابعة للحقيبة واستحقاقها ونوعها، مثل: شهادة حضور أو شهادة اجتياز أو شهادة تميز.', control: seg('cert.type', OPT.cert, 'tkl-cert') })}
          {field({ key: 'cc', label: 'معايير استحقاق الشهادة', req: 1, wide: 1, for: idOf('cert.criteria'), control: area('cert.criteria', { rows: 2, ph: 'مثال: حضور 75٪ من الساعات واجتياز المخرج م3 في العرض النهائي' }) })}
        </div>
      </div>
    </section>
  );

  // ── 7. completion ──
  const issuesList = (list, key) => {
    if (!list.length) return null;
    const open = expanded.has(key);
    const shown = open ? list : list.slice(0, 5);
    return (
      <div className="tk-issues">
        {shown.map((x, i) => <button type="button" key={i} className="tk-issue" onClick={() => goto(x.target)}>{x.text}</button>)}
        {list.length > 5 && <button type="button" className="tk-more" onClick={() => setExpanded(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; })}>{open ? 'عرض أقل' : `عرض الكل (${list.length})`}</button>}
      </div>
    );
  };
  const renderDone = () => {
    const others = A.issues.filter(x => ['measures', 'resources', 'approval'].includes(x.group));
    return (
      <section className="tk-sec" id="tk-s7">
        {secHead('7', 'اكتمال الحقيبة', 'تُفحص البنود آليًا من بيانات الحقيبة، ويبقى التأكيد النهائي لمُعدّ الحقيبة.', 'done')}
        <div className="tk-panel">
          <div className="tk-done-top">
            <b className="tk-big">{A.pct}%</b>
            <div><div className="tk-meter lg"><i style={{ width: `${A.pct}%` }} /></div><p className="tk-done-sum">{A.issues.length ? `عدد الملاحظات المتبقية: ${A.issues.length}. اضغط أي ملاحظة للانتقال إلى موضعها.` : 'اكتملت جميع البنود القابلة للفحص.'}</p></div>
          </div>
          <ol className="tk-checks">
            {CHECKS.map((k, i) => {
              const list = A.issues.filter(x => k.g.includes(x.group));
              const manOk = k.manual ? !!data.manual[k.manual] : true;
              const ok = !list.length && manOk;
              return (
                <li key={k.t} className={`tk-ck ${ok ? 'ok' : ''}`}>
                  <span className="tk-box">✓</span>
                  <div>
                    <div className="tk-ck-t">{k.t}</div>
                    <div className="tk-ck-sub">{k.g.length ? (k.manual ? 'فحص تلقائي وتأكيد من مُعدّ الحقيبة' : 'فحص تلقائي') : 'تأكيد من مُعدّ الحقيبة'}</div>
                    {k.manual && (
                      <label className="tk-manual">
                        <input type="checkbox" checked={!!data.manual[k.manual]} disabled={locked} onChange={(e) => set(`manual.${k.manual}`, e.target.checked)} />
                        <span>{k.ml}</span>
                      </label>
                    )}
                    {issuesList(list, `ck${i}`)}
                  </div>
                  <span className={`tk-pill ${ok ? 'mint' : list.length ? 'amber' : 'muted'}`}>{ok ? 'تم' : list.length ? ar(list.length, NOTES) : 'بانتظار التأكيد'}</span>
                </li>
              );
            })}
          </ol>
          {others.length > 0 && <div className="tk-others"><h4>ملاحظات أخرى في الحقيبة</h4>{issuesList(others, 'others')}</div>}
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
  const amin = c.ageMin; const amax = c.ageMax;
  const chips = [c.type, c.level ? `${c.level}${has(c.sublevel) ? ` ${c.sublevel}` : ''}` : '', D.d && D.h ? `${ar(D.d, DAYS)} × ${ar(D.h, HOURS)}` : '',
    has(amin) && has(amax) ? `من ${amin} إلى ${amax} سنة` : '', c.delivery, c.language].filter(Boolean);
  const returnedFrom = kit.status === 'returned' && lastV ? (kit.returnedBy === 'manager'
    ? { who: lastV.managerName || 'المدير', at: lastV.managerAt, text: lastV.managerComment }
    : { who: lastV.pmName || 'مسؤول إدارة المشاريع', at: lastV.pmAt, text: lastV.pmComment }) : null;
  const saveText = save.state === 'pending' ? 'جارٍ الحفظ…' : save.state === 'error' ? (save.msg || 'تعذّر الحفظ') : save.state === 'ok' ? `محفوظ · ${save.at?.toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}` : 'التعديلات تُحفظ تلقائيًا';

  return (
    <Portal target={portalTarget}>
      <div ref={scrollRef} className={`tk tk-overlay ${hints ? '' : 'no-hints'}`} data-theme={theme} dir="rtl" lang="ar">
        <header className="tk-top">
          <button type="button" className="tk-btn ghost" onClick={close}>→ <span className="hide-sm">الحقائب</span></button>
          <div className="tk-top-title"><b>{c.name || 'حقيبة تدريبية جديدة'}</b><span className="mono">{fmtKitNo(kit.kitNumber)}</span></div>
          <span className="tk-sp" />
          <span className={`tk-save ${save.state === 'pending' ? 'pending' : save.state === 'error' ? 'err' : ''}`} role="status"><i aria-hidden="true" /><span className="hide-sm">{saveText}</span></span>
          {(kit.versions || []).length > 0 && <button type="button" className="tk-btn" onClick={() => setHistoryOpen(true)}>🕘 <span className="hide-sm">السجل</span></button>}
          <button type="button" className="tk-btn" onClick={preview} title="معاينة الحقيبة كمستند وطباعتها">🖨 <span className="hide-sm">معاينة</span></button>
          {!locked && <button type="button" className="tk-btn primary" onClick={() => setSubmitOpen(true)}>📨 <span className="hide-sm">{resubmission ? 'إعادة الإرسال' : 'إرسال للمراجعة'}</span></button>}
        </header>

        <section className="tk-band" aria-label="ملخص الحقيبة">
          <div className="tk-band-in">
            <div>
              <p className="tk-eyebrow"><span>الحقيبة التدريبية · {fmtKitNo(kit.kitNumber)}</span></p>
              <h1 className={c.name ? '' : 'empty'}>{c.name || 'برنامج تدريبي بلا اسم'}</h1>
              {has(c.description) && <p className="tk-band-desc">{c.description}</p>}
              {chips.length > 0 && <ul className="tk-chips">{chips.map(t => <li key={t}>{t}</li>)}</ul>}
            </div>
            <dl className="tk-tblock">
              <div><dt>رقم الإصدار</dt><dd className="mono">{has(c.version) ? c.version : '—'}</dd></div>
              <div><dt>الحالة</dt><dd>{statusOf(kit).label}</dd></div>
              <div className="span"><dt>إصدارات مُرسلة</dt><dd>{kit.currentVersion ? `${kit.currentVersion} — آخرها ${fmtDay(kit.submittedAt)}` : 'لم تُرسل بعد'}</dd></div>
              <div className="span"><dt>اكتمال الحقيبة</dt><dd className="tk-pct"><span className="mono">{A.pct}%</span><span className="tk-meter"><i style={{ width: `${A.pct}%` }} /></span></dd></div>
            </dl>
          </div>
        </section>

        {(returnedFrom || locked) && (
          <div className="tk-wrap">
            {returnedFrom && (
              <div className="tk-note red">
                <span className="tk-note-ico">↩</span>
                <div>
                  <b>أعاد {returnedFrom.who} الحقيبة للتعديل (الإصدار {kit.currentVersion}) · {fmtDay(returnedFrom.at)}</b>
                  <div className="tk-quote">{returnedFrom.text}</div>
                  <div className="tk-muted-s" style={{ marginTop: 6 }}>عدّل ما يلزم ثم اضغط «إعادة الإرسال» — تُحفظ النسخة السابقة في السجل.</div>
                </div>
              </div>
            )}
            {locked && <div className="tk-note cyan"><span className="tk-note-ico">🔒</span><div><b>الحقيبة قيد المراجعة</b>لا يمكن تعديلها حتى يصدر قرار المراجعة.</div></div>}
          </div>
        )}

        <div className="tk-layout">
          <nav className="tk-nav" aria-label="أقسام الحقيبة">
            <ol>
              {SECTIONS.map(s => {
                const pct = ringFor(s.key);
                return (
                  <li key={s.id}>
                    <a className={active === s.id ? 'on' : ''} onClick={(e) => { e.preventDefault(); goto(`tk-${s.id}`); }} href={`#tk-${s.id}`}>
                      <span className="n">{s.n}</span><span>{s.t}</span>
                      {pct >= 100 ? <span className="tk-ring done">✓</span> : <span className="tk-ring part" style={{ '--p': pct }} title={`اكتمال ${pct}%`} />}
                    </a>
                  </li>
                );
              })}
            </ol>
            <div className="tk-nav-foot">
              <div className="row"><span>اكتمال الحقيبة</span><b>{A.pct}%</b></div>
              <div className="tk-meter"><i style={{ width: `${A.pct}%` }} /></div>
              <button type="button" className={`tk-linkbtn ${A.issues.length ? '' : 'ok'}`} onClick={() => goto('tk-s7')}>{A.issues.length ? `${ar(A.issues.length, NOTES)} للمراجعة` : 'الحقيبة مكتملة'}</button>
              <label className="tk-hints-toggle"><input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} /> إرشادات التعبئة</label>
            </div>
          </nav>
          <main className="tk-main">
            {renderCard()}
            {renderOutputs()}
            {renderPlan()}
            {renderResources()}
            {renderAttachments()}
            {renderApproval()}
            {renderDone()}
          </main>
        </div>

        <datalist id="tk-dl-domains">{DOMAINS.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="tk-dl-tools">{TOOLS.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="tk-dl-units">{UNITS.map(x => <option key={x} value={x} />)}</datalist>
        <datalist id="tk-dl-lead">{LEAD.map(x => <option key={x} value={x} />)}</datalist>

        {submitOpen && (
          <Modal onClose={() => !sending && setSubmitOpen(false)} labelledBy="tk-submit-title">
            <h3 id="tk-submit-title">{resubmission ? `إعادة إرسال الحقيبة — الإصدار ${kit.currentVersion + 1}` : 'إرسال الحقيبة للمراجعة'}</h3>
            <p>تُرسل الحقيبة إلى <b>{kit.pm || 'مسؤول إدارة المشاريع'}</b> للمراجعة العلمية والتقنية، ثم إلى المدير للاعتماد. لا يمكن تعديلها أثناء المراجعة.</p>
            <div className="tk-stat-row">
              <b>{A.pct}%</b>
              <div>
                <div>اكتمال الحقيبة</div>
                <div className="tk-muted-s">{A.issues.length ? `${ar(A.issues.length, NOTES)} لم تُستكمل بعد — يراها المراجعون أيضًا.` : 'جميع البنود مكتملة.'}</div>
              </div>
            </div>
            <div className="tk-field">
              <label className="tk-lbl" htmlFor="tk-submit-note">{resubmission ? <>ما الذي عدّلته في هذا الإصدار؟ <span className="tk-req">*</span></> : 'ملاحظة للمراجِعة (اختياري)'}</label>
              <AutoArea id="tk-submit-note" rows={3} value={note} onChange={setNote} placeholder={resubmission ? 'مثال: أضفت معايير القياس للمخرج م2، وعدّلت خطة اليوم الثالث حسب الملاحظات.' : ''} />
            </div>
            <div className="tk-modal-actions">
              <button type="button" className="tk-btn ghost" onClick={() => setSubmitOpen(false)} disabled={sending}>إلغاء</button>
              <button type="button" className="tk-btn primary" onClick={submit} disabled={sending || (resubmission && !note.trim())}>{sending ? 'جارٍ الإرسال…' : '📨 إرسال'}</button>
            </div>
          </Modal>
        )}

        {historyOpen && (
          <Modal onClose={() => setHistoryOpen(false)} labelledBy="tk-hist-title">
            <h3 id="tk-hist-title">سجل الإصدارات والملاحظات</h3>
            <KitHistory versions={kit.versions} currentVersion={kit.currentVersion}
              onView={(n) => printDocument(api, KIT_ROUTES.mine.doc(kit.kitId), { version: n }).catch(err => toast.error(errorText(err, 'تعذّر فتح الإصدار')))} />
            <div className="tk-modal-actions"><button type="button" className="tk-btn" onClick={() => setHistoryOpen(false)}>إغلاق</button></div>
          </Modal>
        )}
      </div>
    </Portal>
  );
};

export default KitEditor;
