import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  MONTHS, QUARTERS, PERIOD_TYPES, HEAD_ROLES, MAKE,
  normalize, analyze, periodLabel, periodMonths, monthName, idOf, getPath, setPath, has, num, fmtPlanNo, diffData,
  blockStateOf, fmtMediaNo, MEDIA_STAGE, MEDIA_STAGE_TONE, MEDIA_EDITABLE
} from './planModel';
import { FILE_BLOCKS, NA, fmtFinanceNo, MAKE_F, mediaStarted } from './planFiles';
import { MediaForm, VolunteerForm } from './PlanTargetForms';
import { PLAN_KIND } from './planKind';
import { fmtKitNo, fmtDay, humanSize, statusOf, ar, NOTES, blankState as kitBlankState, analyze as kitAnalyze } from '../TrainingKits/kitModel';
import { AutoArea, Seg, Portal, useBodyLock, Modal, KitHistory } from '../TrainingKits/KitParts';
import { uploadFile, downloadFile, printDocument, compressImage, errorText } from '../TrainingKits/kitApi';
import KitEditor from '../TrainingKits/KitEditor';
import KitReview from '../TrainingKits/KitReview';
import { newFinanceData, analyze as financeAnalyze } from '../Requests/finance/frModel';
import FinanceRequestEditor from '../Requests/finance/FinanceRequestEditor';
import { newMediaData, analyze as mediaAnalyze } from '../Requests/media/mediaModel';
import MediaRequestEditor from '../Requests/media/MediaRequestEditor';
import MediaReview from '../Requests/media/MediaReview';
import '../TrainingKits/TrainingKits.css';
import './Plans.css';

const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
const HINTS_KEY = 'tk_hints';
const R = PLAN_KIND.routes.mine;
const KPIS = ['عدد المستفيدين من البرامج التدريبية', 'عدد البرامج والورش المنفذة', 'عدد ساعات التدريب المقدمة', 'نسبة رضا المستفيدين', 'عدد المشاريع والنماذج المنفذة',
  'عدد الزوار والمستفيدين من الفعاليات', 'عدد الشراكات والمبادرات المجتمعية', 'عدد ساعات التطوع', 'نسبة جاهزية الأجهزة والمعدات', 'عدد المنتجات المصنّعة للمستفيدين'];
const AUDIENCES = ['طلاب المرحلة الابتدائية', 'طلاب المرحلة المتوسطة', 'طلاب المرحلة الثانوية', 'طلاب الجامعات', 'المعلمون والمعلمات', 'رواد الأعمال', 'الأسر والأطفال', 'المجتمع العام', 'فريق فاب لاب الداخلي'];
const PLACES = ['فاب لاب الأحساء', 'قاعة التدريب', 'معمل الطباعة ثلاثية الأبعاد', 'معمل الإلكترونيات', 'عن بُعد (أون لاين)'];
const FIN = '/financial-requests/mine';
const MEDIA = '/media-requests/mine';
const DAYS_W = ['يوم واحد', 'يومان', 'أيام', 'يومًا'];
const byId = (list) => (Array.isArray(list) ? Object.fromEntries(list.map(x => [x.id || x.kitId || x.requestId, x])) : undefined);
const docNo = (d) => (d.number != null ? d.number : d.kitNumber != null ? d.kitNumber : d.requestNumber);
const TONE = { ok: 'mint', wait: 'amber', na: 'muted', red: 'red', none: 'red' };

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
  const [kits, setKits] = useState(null); // all the employee's kits (any status)
  const [fins, setFins] = useState(null); // the employee's financial requests
  const [medias, setMedias] = useState(null); // the employee's media design requests
  const [making, setMaking] = useState(''); // target id whose design request is being created
  const [openForms, setOpenForms] = useState(() => new Set()); // 'media-<tid>' / 'volunteer-<tid>'
  const [nested, setNested] = useState(null); // { type: 'kit' | 'kitView' | 'finance' | 'media' | 'mediaView', doc | id }
  const [submitOpen, setSubmitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const dirty = useRef(false);
  const latest = useRef(data);
  const id = plan.id || plan.planId;

  // Live statuses of the linked kits / financial / design requests — they
  // move on their own paths, so the plan reads them rather than storing them.
  const live = useMemo(() => ({ kits: byId(kits), finance: byId(fins), media: byId(medias) }), [kits, fins, medias]);
  const liveRef = useRef(live);
  liveRef.current = live;
  const A = useMemo(() => analyze(data, live), [data, live]);
  const locked = !['draft', 'returned'].includes(plan.status);
  const h = data.header;
  const months = periodMonths(h);
  const planNo = fmtPlanNo(plan.number != null ? plan.number : plan.planNumber);

  // The employee's kits, financial and design requests, to link as a
  // target's content / financial / media file.
  const loadLinks = useCallback(() => {
    api.get('/training-kits/mine').then(({ data: list }) => setKits(Array.isArray(list) ? list : [])).catch(() => {});
    api.get(FIN).then(({ data: list }) => setFins(Array.isArray(list) ? list : [])).catch(() => {});
    api.get(MEDIA).then(({ data: list }) => setMedias(Array.isArray(list) ? list : [])).catch(() => {});
  }, [api]);
  useEffect(() => { loadLinks(); }, [loadLinks]);

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
      await api.put(R.kit(id), { data: latest.current, completion: analyze(latest.current, liveRef.current).pct });
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

  // `open` = an embedded form ('media-<tid>') to open before jumping.
  const goto = (target, open) => {
    if (open && !openForms.has(open)) {
      setOpenForms(s0 => new Set(s0).add(open));
      setTimeout(() => goto(target), 160);
      return;
    }
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
    FILE_BLOCKS.forEach(b => (t[b.key].files || []).forEach(f => dropFile(f.fileId)));
    t.media.form.images.forEach(f => dropFile(f.fileId));
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
  const dropFile = (fileId) => { api.delete(R.dropFile(id, fileId)).catch(() => {}); };
  const download = (f) => downloadFile(api, R.file(f.fileId), f.name).catch(err => toast.error(errorText(err, 'تعذّر التنزيل')));

  // ── linked documents: the content's kit, the financial request ──
  const linkKit = (i, k) => update(n => {
    const c = n.targets[i].content;
    c.kitId = k ? (k.id || k.kitId) : '';
    c.kitNo = k ? fmtKitNo(docNo(k)) : '';
    c.kitTitle = k ? (k.title || '') : '';
    if (k && c.status === NA) c.status = '';
  });
  const linkFinance = (i, r) => update(n => {
    const x = n.targets[i].finance;
    x.requestId = r ? (r.id || r.requestId) : '';
    x.requestNo = r ? fmtFinanceNo(docNo(r)) : '';
    x.requestTitle = r ? (r.title || '') : '';
    if (r && x.status === NA) x.status = '';
  });
  const setNA = (i, key, on) => set(`targets.${i}.${key}.status`, on ? NA : '');

  // A new training kit for the target (named after it), linked and opened.
  const createKit = async (i) => {
    const t = data.targets[i];
    try {
      const kd = kitBlankState();
      kd.card.name = t.name || '';
      const { data: k } = await api.post('/training-kits/mine', { data: kd, completion: kitAnalyze(kd).pct });
      linkKit(i, k);
      loadLinks();
      const { data: full } = await api.get(`/training-kits/mine/${k.id || k.kitId}`);
      setNested({ type: 'kit', doc: full });
      toast.success(`أُنشئت الحقيبة ${fmtKitNo(docNo(k))} وربطت بالمستهدف — تجدها أيضًا في «الحقائب التدريبية»`);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر إنشاء الحقيبة'));
    }
  };
  const openKit = async (kitId) => {
    try {
      const { data: full } = await api.get(`/training-kits/mine/${kitId}`);
      setNested(['draft', 'returned'].includes(full.status) ? { type: 'kit', doc: full } : { type: 'kitView', doc: full });
    } catch (err) {
      toast.error(errorText(err, 'تعذّر فتح الحقيبة'));
    }
  };

  // A new financial request filled from the plan / target, linked and opened.
  const createFinance = async (i) => {
    const t = data.targets[i];
    const kit = t.content.kitId ? live.kits?.[t.content.kitId] : null;
    let kitCard = null;
    if (t.content.kitId) {
      try { kitCard = (await api.get(`/training-kits/mine/${t.content.kitId}`)).data?.data?.card || null; } catch { /* optional */ }
    }
    const phases = t.phases.filter(ph => has(ph.start) || has(ph.end));
    const starts = phases.map(ph => ph.start).filter(has).sort();
    const ends = phases.map(ph => ph.end).filter(has).sort();
    try {
      const fd = newFinanceData({
        title: t.name || '',
        section: h.section || '',
        startDate: starts[0] || '',
        endDate: ends[ends.length - 1] || '',
        days: num(kitCard?.days) || '',
        beneficiaries: num(kitCard?.partMax) || '',
        planId: id,
        planNo,
        targetId: t.id,
        targetName: t.name || '',
        kitId: t.content.kitId || '',
        kitNo: t.content.kitNo || (kit ? fmtKitNo(docNo(kit)) : ''),
        kitTitle: t.content.kitTitle || kit?.title || '',
        kind: t.content.kitId ? 'برنامج تدريبي' : ''
      });
      const { data: r } = await api.post(FIN, { data: fd, completion: financeAnalyze(fd).pct });
      linkFinance(i, r);
      loadLinks();
      const { data: full } = await api.get(`${FIN}/${r.id || r.requestId}`);
      setNested({ type: 'finance', doc: full });
      toast.success(`أُنشئ طلب الصرف ${fmtFinanceNo(docNo(r))} وربط بالمستهدف`);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر إنشاء طلب الصرف'));
    }
  };
  const openFinance = async (rid) => {
    try {
      const { data: full } = await api.get(`${FIN}/${rid}`);
      setNested({ type: 'finance', doc: full });
    } catch (err) {
      toast.error(errorText(err, 'تعذّر فتح طلب الصرف'));
    }
  };
  const closeNested = () => { setNested(null); loadLinks(); };

  // ── the media file: a design request (طلب تصميم إعلان) ──
  const linkMedia = (i, r) => update(n => {
    const x = n.targets[i].media;
    x.requestId = r ? (r.id || r.requestId) : '';
    x.requestNo = r ? fmtMediaNo(docNo(r)) : '';
    x.requestTitle = r ? (r.title || '') : '';
    if (r && x.status === NA) x.status = '';
  });
  // What the request starts from: the target, the plan and the linked kit
  // (name, ages, seats, days, axes from the kit's days, up to 3 images).
  const mediaSeed = async (i) => {
    const t = data.targets[i];
    let kd = null;
    if (t.content.kitId) {
      try { kd = (await api.get(`/training-kits/mine/${t.content.kitId}`)).data?.data || null; } catch { /* optional */ }
    }
    const me = (() => { try { return JSON.parse(localStorage.getItem('employeeData') || 'null'); } catch { return null; } })();
    const card = kd?.card || {};
    const starts = t.phases.map(ph => ph.start).filter(has).sort();
    const ends = t.phases.map(ph => ph.end).filter(has).sort();
    const form = {
      activity: card.name || t.name || '',
      implementer: h.head || me?.name || '',
      ageMin: card.ageMin ?? '',
      ageMax: card.ageMax ?? '',
      beneficiaries: card.partMax ?? '',
      days: has(card.days) ? ar(card.days, DAYS_W) : '',
      dateFrom: starts[0] || '',
      dateTo: ends[ends.length - 1] || ''
    };
    const axes = Array.isArray(kd?.plan) && kd.plan.length
      ? kd.plan.map((d, j) => ({ id: d.id || `ax${j}`, title: d.learn || `اليوم ${j + 1}`, desc: d.topics || '' }))
      : null;
    return { form, axes, kitImages: (kd?.images || []).slice(0, 3) };
  };
  // A new design request for the target, linked and opened. A media form
  // already filled inside the plan (older plans) moves into it — fields
  // and images — and is then cleared from the plan.
  const createMedia = async (i) => {
    const t = data.targets[i];
    const tid = t.id;
    const fromForm = mediaStarted(t.media.form);
    setMaking(tid);
    try {
      let r;
      if (fromForm) {
        if (!(await persist())) throw new Error('save');
        ({ data: r } = await api.post(`${MEDIA}/from-plan`, { planId: id, targetId: tid }));
      } else {
        const seed = await mediaSeed(i);
        const md = newMediaData({
          planId: id, planNo, targetId: tid, targetName: t.name || '',
          kitId: t.content.kitId || '', kitNo: t.content.kitNo || '', kitTitle: t.content.kitTitle || '',
          ...seed.form
        });
        // Whatever newMediaData takes, the empty form fields start from the target.
        md.form = { ...MAKE_F.media(), ...(md.form || {}) };
        Object.entries(seed.form).forEach(([k, v]) => { if (!has(md.form[k]) && has(v)) md.form[k] = v; });
        if (seed.axes && !md.form.axes.some(a => has(a.title))) md.form.axes = seed.axes;
        md.source = { ...(md.source || {}), planId: id, planNo, targetId: tid, targetName: t.name || '', kitId: t.content.kitId || '', kitNo: t.content.kitNo || '' };
        ({ data: r } = await api.post(MEDIA, { data: md, completion: mediaAnalyze(md).pct }));
        const rid0 = r.id || r.requestId;
        // The kit's reference images, copied into the request (it asks for 3).
        let added = 0;
        for (const im of seed.kitImages) {
          try {
            const res = await api.get(`/training-kits/mine/files/${im.fileId}`, { responseType: 'blob' });
            const file = new File([res.data], im.name || 'image.jpg', { type: res.data.type || 'image/jpeg' });
            const up = await uploadFile(api, rid0, file, 'image', `${MEDIA}/${rid0}/files`);
            md.form.images = [...(md.form.images || []), { fileId: up.fileId, name: up.name, size: up.size, mime: up.mime, caption: im.caption || '' }];
            added++;
          } catch { /* skip that image */ }
        }
        if (added) await api.put(`${MEDIA}/${rid0}`, { data: md, completion: mediaAnalyze(md).pct }).catch(() => {});
      }
      const rid = r.id || r.requestId;
      update(n => {
        const x = n.targets.find(y => y.id === tid)?.media;
        if (!x) return;
        x.requestId = rid;
        x.requestNo = fmtMediaNo(docNo(r));
        x.requestTitle = r.title || '';
        if (x.status === NA) x.status = '';
        if (fromForm) x.form = MAKE_F.media();
      });
      // The plan's copies of the moved images are no longer needed.
      if (fromForm) t.media.form.images.forEach(f => dropFile(f.fileId));
      setOpenForms(s0 => { const x = new Set(s0); x.delete(`media-${tid}`); return x; });
      loadLinks();
      const { data: full } = await api.get(`${MEDIA}/${rid}`);
      setNested({ type: 'media', doc: full });
      toast.success(`أُنشئ طلب التصميم ${fmtMediaNo(docNo(r))} وربط بالمستهدف${fromForm ? ' — انتقل إليه ما عبّأته في النموذج' : ''}. أرسله لفريق التصميم من «إرسال لفريق التصميم».`);
    } catch (err) {
      toast.error(err.message === 'save' ? 'تعذّر حفظ الخطة قبل إنشاء الطلب' : errorText(err, 'تعذّر إنشاء طلب التصميم'));
    } finally {
      setMaking('');
    }
  };
  // Editable stages open the request form; the others its review screen
  // (the design, the full timeline, approving / rejecting the design).
  const openMedia = async (rid) => {
    try {
      const { data: full } = await api.get(`${MEDIA}/${rid}`);
      setNested(MEDIA_EDITABLE.includes(full.status) ? { type: 'media', doc: full } : { type: 'mediaView', id: rid });
    } catch (err) {
      toast.error(errorText(err, 'تعذّر فتح طلب التصميم'));
    }
  };

  // ── the media form's images ──
  const addMediaImages = async (i, files) => {
    const tid = data.targets[i].id;
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type));
    if (!list.length) { toast.error('اختر صورة بصيغة PNG أو JPG أو SVG'); return; }
    for (const f of list) {
      markBusy(`${tid}-mimg`, f.name, true);
      try {
        const small = await compressImage(f);
        const up = await uploadFile(api, id, small, 'image', R.upload(id));
        update(n => {
          const t = n.targets.find(x => x.id === tid);
          if (t) t.media.form.images.push({ fileId: up.fileId, name: up.name, size: up.size, mime: up.mime, caption: '' });
        });
      } catch (err) {
        toast.error(errorText(err, `تعذّر رفع الصورة ${f.name}`));
      } finally {
        markBusy(`${tid}-mimg`, f.name, false);
      }
    }
  };

  // Fills the empty media / volunteer fields from the target, the plan and
  // the linked kit (programme name, ages, days, seats, axes, up to 3 of the
  // kit's reference images copied into the plan).
  const prefill = async (i, key) => {
    const t = data.targets[i];
    let kd = null;
    if (t.content.kitId) {
      try { kd = (await api.get(`/training-kits/mine/${t.content.kitId}`)).data?.data || null; } catch { /* optional */ }
    }
    const me = (() => { try { return JSON.parse(localStorage.getItem('employeeData') || 'null'); } catch { return null; } })();
    const card = kd?.card || {};
    const phases = t.phases.filter(ph => has(ph.start));
    const starts = phases.map(ph => ph.start).sort();
    const ends = t.phases.map(ph => ph.end).filter(has).sort();
    const fill = (o, k, v) => { if (!has(o[k]) && has(v)) o[k] = v; };
    if (key === 'media') {
      update(n => {
        const f = n.targets[i].media.form;
        fill(f, 'activity', card.name || t.name);
        fill(f, 'implementer', h.head || me?.name);
        fill(f, 'ageMin', card.ageMin); fill(f, 'ageMax', card.ageMax);
        fill(f, 'beneficiaries', card.partMax);
        fill(f, 'days', has(card.days) ? ar(card.days, ['يوم واحد', 'يومان', 'أيام', 'يومًا']) : '');
        fill(f, 'dateFrom', starts[0]); fill(f, 'dateTo', ends[ends.length - 1]);
        const filledAxes = f.axes.some(a => has(a.title) || has(a.desc));
        if (!filledAxes && Array.isArray(kd?.plan) && kd.plan.length) {
          f.axes = kd.plan.map((d, j) => ({ id: d.id || `ax${j}`, title: d.learn || `اليوم ${j + 1}`, desc: d.topics || '' }));
        }
      });
      // Copy the kit's reference images (the media form needs 3).
      const have = t.media.form.images.length;
      const imgs = (kd?.images || []).slice(0, Math.max(0, 3 - have));
      for (const im of imgs) {
        try {
          const res = await api.get(`/training-kits/mine/files/${im.fileId}`, { responseType: 'blob' });
          const file = new File([res.data], im.name || 'image.jpg', { type: res.data.type || 'image/jpeg' });
          const up = await uploadFile(api, id, file, 'image', R.upload(id));
          update(n => { n.targets[i].media.form.images.push({ fileId: up.fileId, name: up.name, size: up.size, mime: up.mime, caption: im.caption || '' }); });
        } catch { /* skip that image */ }
      }
    } else {
      update(n => {
        const f = n.targets[i].volunteer.form;
        fill(f, 'coordinatorName', h.head || me?.name);
        fill(f, 'location', t.place);
        const r = f.roles[0];
        if (r) { fill(r, 'dateFrom', starts[0]); fill(r, 'dateTo', ends[ends.length - 1]); }
      });
    }
    toast.success('عُبّئت الحقول الفارغة من المستهدف والحقيبة المرتبطة — راجعها وأكمل الباقي');
  };
  const toggleForm = (k) => setOpenForms(s0 => { const x = new Set(s0); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const printPart = async (part) => {
    await persist();
    printDocument(api, R.doc(id), { draft: 1, part }).catch(err => toast.error(errorText(err, 'تعذّر تجهيز الطباعة')));
  };

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
  const timeIn = (path, label) => (
    <input className="tk-in ep-time" type="time" id={idOf(path)} value={val(path)} aria-label={label} disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const numIn = (path, o = {}) => {
    const input = (
      <input className="tk-in num" type="number" inputMode="decimal" id={idOf(path)} value={val(path)} min={o.min == null ? 0 : o.min} step="1"
        placeholder={o.ph || ''} aria-label={o.label} disabled={locked}
        onChange={(e) => { const v = e.target.value; set(path, v === '' ? '' : (isFinite(+v) ? +v : '')); }} />
    );
    return o.sfx ? <span className="tk-affix" style={o.sfxW ? { '--sfx': `${o.sfxW}px` } : undefined}>{input}<span className="sfx">{o.sfx}</span></span> : input;
  };
  const segIn = (path, opts, labelId) => <Seg id={idOf(path)} options={opts} value={val(path)} labelledBy={labelId} onChange={(v) => !locked && set(path, v)} />;
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
  // Builders handed to the embedded media / volunteer forms.
  const C = { field, text, area, num: numIn, date: dateIn, time: timeIn, seg: segIn, id: idOf, update, get: getPath };
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
          <div><b>ملفات المستهدفات — لكل ملف مساره</b>المحتوى المعتمد حقيبة تدريبية تُعتمد من مسؤول إدارة المشاريع ثم المدير، والملف المالي طلب صرف مالي بمساره نفسه، والمتطلبات الإعلامية طلب تصميم إعلان يمر على فريق التصميم ثم يعود إليك لمراجعة التصميم ثم مسؤول إدارة المشاريع والمدير، والفرص التطوعية نموذج يُعبّأ داخل الخطة — أو اختر «لا يتطلب».</div>
        </div>
      </div>
    </section>
  );

  // ── 2. one target ──
  // Files uploaded by older plans (before each file had its own path):
  // still shown, downloadable and removable.
  const legacy = (i, t, key) => {
    const x = t[key];
    if (!x.files.length && !has(x.link)) return null;
    return (
      <div className="ep-legacy">
        <small className="tk-muted-s">مرفق سابق في هذه الخطة:</small>
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
          {has(x.link) && (
            <div className="ep-proof-row">{text(`targets.${i}.${key}.link`, { label: 'رابط الملف', dir: 'auto' })}
              {!locked && <button type="button" className="tk-ibtn danger" title="إزالة الرابط" aria-label="إزالة الرابط" onClick={() => set(`targets.${i}.${key}.link`, '')}>🗑</button>}
            </div>
          )}
        </div>
      </div>
    );
  };
  const naNote = (i, key, text0) => (
    <div className="ep-na">
      <span>{text0}</span>
      {!locked && <button type="button" className="tk-btn sm ghost" onClick={() => setNA(i, key, false)}>تراجع</button>}
    </div>
  );
  const naBtn = (i, key) => !locked && <button type="button" className="tk-btn sm ghost" onClick={() => setNA(i, key, true)}>لا يتطلب</button>;
  const linkedPill = (d, m) => { const s0 = statusOf(d, m); return <span className={`tk-pill ${s0.tone}`}>{s0.label}</span>; };

  const contentBody = (i, t) => {
    const x = t.content;
    if (x.status === NA) return naNote(i, 'content', 'لا يتطلب هذا المستهدف محتوى معتمدًا.');
    if (has(x.kitId)) {
      const k = live.kits?.[x.kitId];
      return (
        <div className="ep-linked">
          <span className="tk-chip ep-kitchip"><bdi>🎒 {x.kitNo} — {k?.title || x.kitTitle || 'حقيبة تدريبية'}</bdi></span>
          {k && linkedPill(k)}
          <span className="tk-sp" />
          <button type="button" className="tk-btn sm" onClick={() => openKit(x.kitId)}>{k && ['draft', 'returned'].includes(k.status) && !locked ? '✎ فتح الحقيبة' : '📄 عرض الحقيبة'}</button>
          {!locked && <button type="button" className="tk-btn sm ghost" onClick={() => linkKit(i, null)}>إلغاء الربط</button>}
        </div>
      );
    }
    return (
      <>
        {!locked && (
          <div className="ep-linkrow">
            <select className="tk-in" value="" aria-label="ربط حقيبة تدريبية" disabled={!kits?.length} onChange={(e) => linkKit(i, (kits || []).find(k => (k.id || k.kitId) === e.target.value))}>
              <option value="">{kits == null ? 'جارٍ تحميل حقائبك…' : kits.length ? '🎒 اربط حقيبة من حقائبك…' : 'لا توجد لديك حقائب بعد'}</option>
              {(kits || []).map(k => <option key={k.id || k.kitId} value={k.id || k.kitId}>{fmtKitNo(docNo(k))} — {k.title || 'بلا اسم'} · {statusOf(k).label}</option>)}
            </select>
            <button type="button" className="tk-btn sm primary" onClick={() => createKit(i)}>＋ حقيبة جديدة لهذا المستهدف</button>
            {naBtn(i, 'content')}
          </div>
        )}
        <p className="tk-hint">تمر الحقيبة على مسؤول إدارة المشاريع ثم المدير، وتصبح الحالة «مرفق ومعتمد» تلقائيًا عند اعتمادها.</p>
      </>
    );
  };
  const financeBody = (i, t) => {
    const x = t.finance;
    if (x.status === NA) return naNote(i, 'finance', 'لا يتطلب هذا المستهدف صرفًا ماليًا.');
    if (has(x.requestId)) {
      const r = live.finance?.[x.requestId];
      return (
        <div className="ep-linked">
          <span className="tk-chip ep-finchip"><bdi>🧾 {x.requestNo} — {r?.title || x.requestTitle || 'طلب صرف مالي'}</bdi></span>
          {r && linkedPill(r, true)}
          <span className="tk-sp" />
          <button type="button" className="tk-btn sm" onClick={() => openFinance(x.requestId)}>{r && ['draft', 'returned'].includes(r.status) && !locked ? '✎ فتح الطلب' : '📄 عرض الطلب'}</button>
          {!locked && <button type="button" className="tk-btn sm ghost" onClick={() => linkFinance(i, null)}>إلغاء الربط</button>}
        </div>
      );
    }
    return (
      <>
        {!locked && (
          <div className="ep-linkrow">
            <button type="button" className="tk-btn sm primary" onClick={() => createFinance(i)}>＋ إنشاء طلب صرف لهذا المستهدف</button>
            {fins?.length > 0 && (
              <select className="tk-in" value="" aria-label="ربط طلب صرف قائم" onChange={(e) => linkFinance(i, fins.find(r => (r.id || r.requestId) === e.target.value))}>
                <option value="">أو اربط طلبًا قائمًا…</option>
                {fins.map(r => <option key={r.id || r.requestId} value={r.id || r.requestId}>{fmtFinanceNo(docNo(r))} — {r.title || 'بلا اسم'} · {statusOf(r, true).label}</option>)}
              </select>
            )}
            {naBtn(i, 'finance')}
          </div>
        )}
        <p className="tk-hint">طلب الصرف يُعبّأ في النظام (البنود والموارد والتكاليف والتمويل) ويمر على مسؤول إدارة المشاريع ثم المدير.</p>
      </>
    );
  };
  const formBody = (i, t, key) => {
    const x = t[key];
    if (x.status === NA) return naNote(i, key, key === 'media' ? 'لا يتطلب هذا المستهدف متطلبات إعلامية.' : 'لا يحتاج هذا المستهدف إلى متطوعين.');
    const k = `${key}-${t.id}`;
    const open = openForms.has(k);
    const st = blockStateOf(t, key, live);
    const base = `targets.${i}.${key}.form`;
    return (
      <>
        <div className="ep-linkrow">
          <button type="button" className={`tk-btn sm ${open ? '' : 'primary'}`} onClick={() => toggleForm(k)} aria-expanded={open}>
            {open ? '▴ إخفاء النموذج' : st.form ? '✎ متابعة التعبئة' : '✎ تعبئة النموذج'}
          </button>
          {st.form && <span className="tk-muted-s">{st.missing.length ? `${ar(st.missing.length, NOTES)} في النموذج` : 'النموذج مكتمل'}</span>}
          <span className="tk-sp" />
          {st.form && <button type="button" className="tk-btn sm" onClick={() => printPart(k)}>🖨 طباعة النموذج</button>}
          {!locked && open && <button type="button" className="tk-btn sm ghost" onClick={() => prefill(i, key)} title="يملأ الحقول الفارغة فقط">⤵ تعبئة من المستهدف والحقيبة</button>}
          {!locked && !st.form && naBtn(i, key)}
        </div>
        {open && (key === 'media'
          ? <MediaForm f={x.form} base={base} c={C} locked={locked} images={{
              api, url: R.file, busy: busy[`${t.id}-mimg`] || [],
              add: (files) => addMediaImages(i, files),
              remove: (j) => { dropFile(x.form.images[j].fileId); update(n => { n.targets[i].media.form.images.splice(j, 1); }); }
            }} />
          : <VolunteerForm f={x.form} base={base} c={C} locked={locked} />)}
      </>
    );
  };
  const mediaBody = (i, t) => {
    const x = t.media;
    if (x.status === NA) return naNote(i, 'media', 'لا يتطلب هذا المستهدف متطلبات إعلامية.');
    if (has(x.requestId)) {
      const r = live.media?.[x.requestId];
      const editable = r && MEDIA_EDITABLE.includes(r.status);
      const check = r?.status === 'employee_check';
      return (
        <div className="ep-linked">
          <span className="tk-chip ep-mediachip"><bdi>📣 {r ? fmtMediaNo(docNo(r)) : (x.requestNo || fmtMediaNo(''))} — {r?.title || x.requestTitle || 'طلب تصميم إعلان'}</bdi></span>
          {r && <span className={`tk-pill ${MEDIA_STAGE_TONE[r.status] || 'muted'}`}>{MEDIA_STAGE[r.status] || r.status}{r.designVersion ? ` · التصميم ${r.designVersion}` : ''}</span>}
          <span className="tk-sp" />
          <button type="button" className={`tk-btn sm ${check ? 'primary' : ''}`} onClick={() => openMedia(x.requestId)}>{editable ? '✎ فتح الطلب' : check ? '👁 راجع التصميم' : '📄 عرض الطلب'}</button>
          {!locked && <button type="button" className="tk-btn sm ghost" onClick={() => linkMedia(i, null)}>إلغاء الربط</button>}
        </div>
      );
    }
    const k = `media-${t.id}`;
    const open = openForms.has(k);
    const legacyForm = mediaStarted(x.form);
    const st = blockStateOf(t, 'media', live);
    const busyHere = making === t.id;
    const linkedIds = new Set(data.targets.map(y => y.media.requestId).filter(has));
    const free = (medias || []).filter(r => !linkedIds.has(r.id || r.requestId));
    return (
      <>
        {legacyForm && (
          <div className="ep-legacy-media">
            <div className="ep-linkrow">
              <span className="tk-muted-s">📝 نموذج معبّأ داخل الخطة ({st.missing?.length ? `${ar(st.missing.length, NOTES)} في النموذج` : 'مكتمل'}) — يُرسل الآن كطلب تصميم يمر على فريق التصميم.</span>
              <span className="tk-sp" />
              {!locked && <button type="button" className="tk-btn sm primary" disabled={busyHere} onClick={() => createMedia(i)}>{busyHere ? '⏳ جارٍ الإنشاء…' : '📨 إرسال كطلب تصميم'}</button>}
              <button type="button" className="tk-btn sm" onClick={() => toggleForm(k)} aria-expanded={open}>{open ? '▴ إخفاء النموذج' : '👁 عرض النموذج'}</button>
              <button type="button" className="tk-btn sm" onClick={() => printPart(k)}>🖨 طباعة</button>
              {!locked && naBtn(i, 'media')}
            </div>
            {open && (
              <MediaForm f={x.form} base={`targets.${i}.media.form`} c={C} locked={locked} images={{
                api, url: R.file, busy: busy[`${t.id}-mimg`] || [],
                add: (files) => addMediaImages(i, files),
                remove: (j) => { dropFile(x.form.images[j].fileId); update(n => { n.targets[i].media.form.images.splice(j, 1); }); }
              }} />
            )}
          </div>
        )}
        {!legacyForm && !locked && (
          <div className="ep-linkrow">
            <button type="button" className="tk-btn sm primary" disabled={busyHere} onClick={() => createMedia(i)}>{busyHere ? '⏳ جارٍ الإنشاء…' : '＋ إنشاء طلب تصميم لهذا المستهدف'}</button>
            {free.length > 0 && (
              <select className="tk-in" value="" aria-label="ربط طلب تصميم قائم" onChange={(e) => linkMedia(i, free.find(r => (r.id || r.requestId) === e.target.value))}>
                <option value="">أو اربط طلبًا قائمًا…</option>
                {free.map(r => <option key={r.id || r.requestId} value={r.id || r.requestId}>{fmtMediaNo(docNo(r))} — {r.title || 'بلا اسم'} · {MEDIA_STAGE[r.status] || r.status}</option>)}
              </select>
            )}
            {naBtn(i, 'media')}
          </div>
        )}
        <p className="tk-hint">يذهب طلب التصميم إلى فريق التصميم، ثم يعود إليك لمراجعة التصميم واعتماده أو إعادته بملاحظات، ثم إلى مسؤول إدارة المشاريع فالمدير. تصبح الحالة «مرفقة» عند اعتماده.</p>
      </>
    );
  };
  const BODY = { content: contentBody, finance: financeBody, media: mediaBody, volunteer: (i, t) => formBody(i, t, 'volunteer') };

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
          {panelHead('ملفات المستهدف', 'لكل ملف مساره: الحالة تتبع الحقيبة أو طلب الصرف أو طلب التصميم المرتبط أو اكتمال النموذج — أو «لا يتطلب».')}
          {FILE_BLOCKS.map(b => {
            const st = blockStateOf(t, b.key, live);
            return (
              <div className="ep-blk" id={`ep-blk-${t.id}-${b.key}`} key={b.key}>
                <div className="ep-blk-name">
                  <span className={`tk-dot ${st.ok && has(st.status) ? 'ok' : ''}`}>✓</span>
                  <span>{b.label}</span><span className="tk-req" aria-hidden="true">*</span>
                  <span className={`tk-pill ${TONE[st.tone] || 'muted'} ep-st`}>{st.status || 'لم يُحدد'}</span>
                </div>
                <div className="ep-blk-body">
                  {BODY[b.key](i, t)}
                  {legacy(i, t, b.key)}
                </div>
              </div>
            );
          })}
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
              {list.map((x, k) => <button type="button" key={k} className="tk-issue" onClick={() => goto(x.target, x.open)}>{x.text}</button>)}
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

        {nested?.type === 'kit' && (
          <KitEditor api={api} kit={nested.doc} portalTarget={portalTarget} theme={theme} onClose={closeNested} onSubmitted={closeNested} />
        )}
        {nested?.type === 'kitView' && (
          <KitReview api={api} scope="mine" kitId={nested.doc.id || nested.doc.kitId} portalTarget={portalTarget} theme={theme} onClose={closeNested} />
        )}
        {nested?.type === 'finance' && (
          <FinanceRequestEditor api={api} doc={nested.doc} portalTarget={portalTarget} theme={theme} onClose={closeNested} onSubmitted={closeNested} />
        )}
        {nested?.type === 'media' && (
          <MediaRequestEditor api={api} doc={nested.doc} portalTarget={portalTarget} theme={theme} onClose={closeNested} onSubmitted={closeNested} />
        )}
        {nested?.type === 'mediaView' && (
          <MediaReview api={api} role="employee" requestId={nested.id} portalTarget={portalTarget} theme={theme}
            onClose={closeNested} onChanged={loadLinks} onEdit={(d) => openMedia(d?.id || d?.requestId || nested.id)} />
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
