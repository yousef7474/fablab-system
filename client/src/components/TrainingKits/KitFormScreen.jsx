import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { ar, NOTES, fmtKitNo } from './kitModel';
import { FORM_META, MAKE_F, analyzeForm } from './kitForms';
import { makeControls } from './KitFormControls';
import { BODIES, FORM_SECTIONS } from './KitFormBodies';
import { uploadFile, compressImage, errorText } from './kitApi';
import './KitFormScreen.css';

// Missing containers created on first write (content days / outputs and
// guide journey are keyed by the kit's plan-day and output ids).
const FILL = {
  content: { days: MAKE_F.contentDay, outputs: () => ({ criteria: '' }) },
  guide: { journey: MAKE_F.journeyDay }
};
const setDeep = (root, path, v, fill = {}) => {
  const ks = String(path).split('.');
  const last = ks.pop();
  let o = root; let prev = null;
  ks.forEach(k => {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = fill[prev] ? fill[prev]() : {};
    prev = k;
    o = o[k];
  });
  o[last] = v;
};

/**
 * One attachment form, full screen over the kit editor. Edits go straight
 * into the kit's data (same autosave, versions and review as the kit).
 * `focus` = { id } scrolls to and highlights a field (from an issue).
 */
const KitFormScreen = ({ fkey, data, update, locked, api, kit, theme, focus, onClose, onPrint, save }) => {
  const meta = FORM_META[fkey];
  const form = data.forms[fkey];
  const rootRef = useRef(null);
  const [active, setActive] = useState('tkf-sec-1');
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState({});
  const R = useMemo(() => analyzeForm(fkey, data), [fkey, data]);

  const setF = useCallback((path, v) => update(n => setDeep(n.forms[fkey], path, v, FILL[fkey])), [update, fkey]);
  const updF = useCallback((fn) => update(n => fn(n.forms[fkey], n)), [update, fkey]);
  const C = makeControls({ fkey, form, setF, locked });

  const markBusy = (key, name, on) => setBusy(b => {
    const l = new Set(b[key] || []);
    if (on) l.add(name); else l.delete(name);
    return { ...b, [key]: [...l] };
  });
  const addImages = async (files, key, onEach) => {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type));
    if (!list.length) { toast.error('اختر صورة بصيغة PNG أو JPG أو SVG'); return; }
    for (const f of list) {
      markBusy(key, f.name, true);
      try {
        const up = await uploadFile(api, kit.kitId, await compressImage(f), 'image');
        onEach({ id: up.fileId, fileId: up.fileId, name: up.name, size: up.size, mime: up.mime, caption: '' });
      } catch (err) {
        toast.error(errorText(err, `تعذّر رفع الصورة ${f.name}`));
      } finally {
        markBusy(key, f.name, false);
      }
    }
  };
  const dropFile = (fileId) => { api.delete(`/training-kits/mine/${kit.kitId}/files/${fileId}`).catch(() => {}); };

  // Field from an issue: scroll, focus, highlight — inside this screen
  // only (the kit editor underneath has its own ids).
  const goto = useCallback((id) => {
    const root = rootRef.current;
    if (!root || !id) return;
    const el = root.querySelector(`#${CSS.escape(id)}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const f = el.matches('input,select,textarea,button') ? el : el.querySelector('textarea,input:not([type=file]),select,button');
    const ring = el.closest('.tk-field,.tk-rt-row,.tkf-q,.tk-item,.tkf-rb,.tk-panel') || el;
    setTimeout(() => {
      if (f) f.focus({ preventScroll: true });
      ring.classList.remove('tk-flash'); void ring.offsetWidth; ring.classList.add('tk-flash');
    }, 380);
  }, []);
  useEffect(() => {
    if (!focus?.id) return undefined;
    const t = setTimeout(() => goto(focus.id), 120);
    return () => clearTimeout(t);
  }, [focus, goto]);

  // section spy
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) setActive(en.target.id); }), { root, rootMargin: '-25% 0px -65% 0px' });
    root.querySelectorAll('.tk-sec').forEach(s => io.observe(s));
    return () => io.disconnect();
  }, [fkey]);

  const Body = BODIES[fkey];
  const sections = FORM_SECTIONS[fkey];
  const issues = showAll ? R.issues : R.issues.slice(0, 5);
  const ctx = { fkey, s: data, form, C, setF, updF, locked, api, kit, addImages, dropFile, busy };

  return (
    <div ref={rootRef} className="tk tk-overlay tkf" data-theme={theme} dir="rtl" lang="ar" role="dialog" aria-label={`نموذج ${meta.label}`}>
      <header className="tk-top">
        <button type="button" className="tk-btn ghost" onClick={onClose}>→ <span className="hide-sm">مرفقات الحقيبة</span></button>
        <div className="tk-top-title"><b>{meta.icon} {meta.label}</b><span>{data.card.name || 'حقيبة تدريبية'} · <span className="mono">{fmtKitNo(kit.kitNumber)}</span></span></div>
        <span className="tk-sp" />
        <span className={`tk-save ${save.state === 'pending' ? 'pending' : save.state === 'error' ? 'err' : ''}`} role="status"><i aria-hidden="true" /><span className="hide-sm">{save.text}</span></span>
        {meta.test
          ? <>
            <button type="button" className="tk-btn" onClick={() => onPrint(fkey, 'participant')} title="ورقة الاختبار بلا إجابات">🖨 <span className="hide-sm">نسخة المشارك</span></button>
            <button type="button" className="tk-btn" onClick={() => onPrint(fkey, 'trainer')} title="مع مفتاح الإجابة">🔑 <span className="hide-sm">نسخة المدرب</span></button>
          </>
          : <button type="button" className="tk-btn" onClick={() => onPrint(fkey, null)}>🖨 <span className="hide-sm">معاينة وطباعة</span></button>}
        <button type="button" className="tk-btn primary" onClick={onClose}>✓ <span className="hide-sm">تم</span></button>
      </header>

      <div className="tk-wrap tkf-summary">
        <div className="tkf-progress">
          <b className="mono">{R.pct}%</b>
          <div>
            <div className="tk-meter lg"><i style={{ width: `${R.pct}%` }} /></div>
            <p>{locked ? 'الحقيبة قيد المراجعة — النموذج للاطلاع فقط.' : R.issues.length ? `${ar(R.issues.length, NOTES)} لاكتمال النموذج — اضغط أي ملاحظة للانتقال إليها.` : 'اكتمل النموذج — يُحفظ تلقائيًا مع الحقيبة.'}</p>
          </div>
        </div>
        {R.issues.length > 0 && !locked && (
          <div className="tk-issues">
            {issues.map((x, i) => <button type="button" key={i} className="tk-issue" onClick={() => goto(x.target)}>{x.text}</button>)}
            {R.issues.length > 5 && <button type="button" className="tk-more" onClick={() => setShowAll(v => !v)}>{showAll ? 'عرض أقل' : `عرض الكل (${R.issues.length})`}</button>}
          </div>
        )}
      </div>

      <div className="tk-layout tkf-layout">
        <nav className="tk-nav" aria-label="أقسام النموذج">
          <ol>
            {sections.map((t, i) => (
              <li key={t}>
                <a className={active === `tkf-sec-${i + 1}` ? 'on' : ''} href={`#tkf-sec-${i + 1}`}
                  onClick={(e) => { e.preventDefault(); rootRef.current?.querySelector(`#tkf-sec-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                  <span className="n">{i + 1}</span><span>{t}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <main className="tk-main">
          <Body ctx={ctx} />
          <div className="tkf-done-bar">
            <button type="button" className="tk-btn primary" onClick={onClose}>✓ تم — العودة إلى مرفقات الحقيبة</button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default KitFormScreen;
