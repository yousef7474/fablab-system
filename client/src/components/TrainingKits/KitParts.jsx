import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { diffData, fmtDateTime, statusOf } from './kitModel';

// ── Inputs ──────────────────────────────────────────────────────

// Textarea that grows with its content (the template's autosize).
export const AutoArea = ({ value, onChange, rows = 1, ...rest }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${t.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} className="tk-in" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />;
};

// Chips input: Enter / comma adds, Backspace on empty removes the last.
export const TagsInput = ({ id, value = [], onChange, list, placeholder }) => {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const add = (text) => {
    const next = [...value];
    String(text).split(/[,،]/).map(s => s.trim()).filter(Boolean).forEach(v => { if (!next.includes(v)) next.push(v); });
    setDraft('');
    if (next.length !== value.length) onChange(next);
  };
  return (
    <div className="tk-tags" onClick={() => inputRef.current?.focus()}>
      {value.map((t, i) => (
        <span className="tk-chip" key={`${t}-${i}`}>
          <bdi>{t}</bdi>
          <button type="button" aria-label={`إزالة ${t}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter((_, j) => j !== i)); }}>×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        id={id}
        value={draft}
        list={list}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter' || e.key === ',' || e.key === '،') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => { if (draft.trim()) add(draft); }}
      />
    </div>
  );
};

// Single-choice buttons (radio group).
export const Seg = ({ id, options, value, onChange, labelledBy }) => (
  <div className="tk-seg" id={id} role="radiogroup" aria-labelledby={labelledBy}>
    {options.map(o => (
      <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onChange(o)}>{o}</button>
    ))}
  </div>
);

// ── Files ───────────────────────────────────────────────────────

// Authenticated image (kit files need the bearer token, so <img src>
// can't load them directly). Cached per URL for the session.
const _imgCache = new Map();
export const AuthedImage = ({ api, url, alt }) => {
  const [src, setSrc] = useState(() => _imgCache.get(url) || '');
  useEffect(() => {
    let live = true;
    if (!url || _imgCache.has(url)) { setSrc(_imgCache.get(url) || ''); return undefined; }
    api.get(url, { responseType: 'blob' })
      .then(res => { const u = URL.createObjectURL(res.data); _imgCache.set(url, u); if (live) setSrc(u); })
      .catch(() => {});
    return () => { live = false; };
  }, [api, url]);
  return src ? <img src={src} alt={alt || ''} /> : <span className="tk-muted-s">…</span>;
};

// ── Layout helpers ──────────────────────────────────────────────

export const Portal = ({ target, children }) => createPortal(children, target || document.body);

// Locks the page behind a full-screen layer.
export const useBodyLock = () => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
};

export const StatusPill = ({ kit }) => {
  const s = statusOf(kit);
  return <span className={`tk-pill ${s.tone}`}>{s.label}</span>;
};

export const Modal = ({ children, onClose, labelledBy }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="tk-modal-scrim" onClick={onClose}>
      <div className="tk-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

// ── History of versions + reviewer comments + what changed ──────

const Step = ({ who, role, decision, comment, at }) => {
  if (!decision) {
    return (
      <div className="tk-step">
        <span className="ico wait">…</span>
        <div><span className="who">{role}</span> <span className="when">— بانتظار المراجعة</span></div>
      </div>
    );
  }
  const ok = decision === 'approved';
  return (
    <div className="tk-step">
      <span className={`ico ${ok ? 'ok' : 'back'}`}>{ok ? '✓' : '↩'}</span>
      <div>
        <span className="who">{who || role}</span>{' '}
        <span>{ok ? (role === 'المدير' ? 'اعتمد الحقيبة' : 'اعتمدت المراجعة وأرسلتها للمدير') : 'أعاد الحقيبة للتعديل'}</span>{' '}
        <span className="when">· {fmtDateTime(at)}</span>
        {comment && <div className="cmt">{comment}</div>}
      </div>
    </div>
  );
};

export const KitHistory = ({ versions = [], onView, currentVersion }) => {
  const [open, setOpen] = useState(() => new Set());
  if (!versions.length) {
    return <div className="tk-blank"><span className="big">🗂</span><b>لا توجد إصدارات بعد</b><span>يظهر هنا كل إصدار تُرسله للمراجعة مع ملاحظات المراجعين.</span></div>;
  }
  const list = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const toggle = (n) => setOpen(s => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  return (
    <div className="tk-history">
      {list.map(v => {
        const prev = versions.find(x => x.versionNumber === v.versionNumber - 1);
        const showDiff = open.has(v.versionNumber);
        const changes = showDiff && prev ? diffData(prev.data, v.data) : [];
        return (
          <article key={v.versionId || v.versionNumber} className={`tk-ver ${v.versionNumber === currentVersion ? 'latest' : ''}`}>
            <div className="tk-ver-head">
              <h4>الإصدار <span className="mono">{v.versionNumber}</span></h4>
              <span className="when">أُرسل {fmtDateTime(v.submittedAt)}</span>
              <span className="tk-pill muted">اكتمال {v.completion || 0}%</span>
              {v.managerDecision === 'approved' && <span className="tk-pill mint">الإصدار المعتمد</span>}
            </div>
            {v.note && <div className="tk-ver-note"><b>ما الذي تغيّر (من مُعدّ الحقيبة):</b>{v.note}</div>}
            <Step role="مسؤول إدارة المشاريع" who={v.pmName} decision={v.pmDecision} comment={v.pmComment} at={v.pmAt} />
            {(v.pmDecision === 'approved' || v.managerDecision) && (
              <Step role="المدير" who={v.managerName} decision={v.managerDecision} comment={v.managerComment} at={v.managerAt} />
            )}
            <div className="tk-ver-actions">
              {onView && <button type="button" className="tk-btn sm" onClick={() => onView(v.versionNumber)}>📄 عرض هذا الإصدار</button>}
              {prev && (
                <button type="button" className="tk-btn sm ghost" onClick={() => toggle(v.versionNumber)} aria-expanded={showDiff}>
                  {showDiff ? 'إخفاء التعديلات' : `ما الذي تغيّر عن الإصدار ${prev.versionNumber}؟`}
                </button>
              )}
            </div>
            {showDiff && (
              <div className="tk-diff">
                {!changes.length && <p className="tk-diff-empty">لا توجد تغييرات في البيانات بين الإصدارين.</p>}
                {changes.slice(0, 80).map((c, i) => (
                  <div key={i} className="tk-diff-row">
                    <span className="lbl">{c.label} <span className={`tk-pill ${c.kind === 'added' ? 'mint' : c.kind === 'removed' ? 'red' : 'amber'}`}>{c.kind === 'added' ? 'أُضيف' : c.kind === 'removed' ? 'حُذف' : 'عُدّل'}</span></span>
                    {c.before && <del>{c.before.length > 400 ? `${c.before.slice(0, 400)}…` : c.before}</del>}
                    {c.after && <ins>{c.after.length > 400 ? `${c.after.slice(0, 400)}…` : c.after}</ins>}
                  </div>
                ))}
                {changes.length > 80 && <p className="tk-diff-empty">و{changes.length - 80} تعديلًا آخر.</p>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};
