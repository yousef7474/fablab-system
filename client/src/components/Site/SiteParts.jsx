import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInView, fileToPayload } from './siteCore';

// Fades/slides children in when they scroll into view.
export const Reveal = ({ as: Tag = 'div', className = '', delay = 0, style, children, ...rest }) => {
  const [ref, inView] = useInView({ threshold: 0.12 });
  return (
    <Tag ref={ref} className={`site-reveal ${inView ? 'in' : ''} ${className}`} style={{ ...style, '--rd': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
};

export const SectionHeader = ({ title, subtitle, tone = 'purple' }) => (
  <div className={`site-section-header tone-${tone}`}>
    <h2>{title}</h2>
    <div className="site-section-line" />
    {subtitle && <p>{subtitle}</p>}
  </div>
);

// Page hero card (title + intro) used by most inner pages.
export const PageHero = ({ title, intro, children, id }) => (
  <section className="site-page-hero" id={id}>
    <Reveal className="site-page-hero-card">
      <h1>{title}</h1>
      <div className="site-section-line gradient" />
      {intro && <p>{intro}</p>}
      {children}
    </Reveal>
  </section>
);

export const EmptyState = ({ icon = 'fa-inbox', title, text }) => (
  <div className="site-empty">
    <i className={`fas ${icon}`} aria-hidden="true" />
    <b>{title}</b>
    {text && <span>{text}</span>}
  </div>
);

export const Spinner = ({ label }) => (
  <div className="site-loading" role="status"><span className="site-spinner" />{label}</div>
);

// Accessible modal rendered in a portal; closes on Escape / backdrop.
export const Modal = ({ open, onClose, title, children, wide = false, dir }) => {
  const panelRef = useRef(null);
  // Keep the latest onClose without re-running the open/close effect
  // (re-running it would steal focus from inputs inside the modal).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusId = setTimeout(() => panelRef.current?.focus(), 30);
    return () => { clearTimeout(focusId); document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="site site-modal-root" dir={dir}>
      <div className="site-modal-scrim" onClick={onClose} />
      <div className={`site-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}>
        <div className="site-modal-head">
          <h3>{title}</h3>
          <button type="button" className="site-modal-close" onClick={onClose} aria-label="close"><i className="fas fa-times" aria-hidden="true" /></button>
        </div>
        <div className="site-modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
};

const fmtSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Drag-and-drop / click file picker that hands back JSON file payloads.
export const FileDrop = ({ label, hint, accept, types, maxBytes, max = 1, files, onChange, isRTL, error }) => {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const add = async (list) => {
    setLocalErr('');
    const incoming = Array.from(list || []);
    const next = [...files];
    for (const f of incoming) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!types.includes(ext)) { setLocalErr(isRTL ? `نوع الملف غير مدعوم: ${f.name}` : `Unsupported file: ${f.name}`); continue; }
      if (f.size > maxBytes) { setLocalErr(isRTL ? `الملف أكبر من الحد المسموح: ${f.name}` : `File is too large: ${f.name}`); continue; }
      if (next.length >= max) { setLocalErr(isRTL ? `الحد الأقصى ${max} ملفات` : `Up to ${max} files`); break; }
      // eslint-disable-next-line no-await-in-loop
      next.push(await fileToPayload(f));
    }
    onChange(max === 1 ? next.slice(-1) : next);
  };
  return (
    <div className="site-filedrop-wrap">
      {label && <span className="site-label">{label}</span>}
      <div
        className={`site-filedrop ${drag ? 'drag' : ''} ${error ? 'has-error' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
      >
        <i className="fas fa-cloud-upload-alt" aria-hidden="true" />
        <span>{isRTL ? 'اسحب الملفات هنا أو اضغط للاختيار' : 'Drag files here or click to choose'}</span>
        {hint && <small>{hint}</small>}
        <input ref={inputRef} type="file" hidden accept={accept} multiple={max > 1} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      {files.length > 0 && (
        <ul className="site-filelist">
          {files.map((f, i) => (
            <li key={`${f.fileName}-${i}`}>
              <i className="fas fa-paperclip" aria-hidden="true" />
              <span className="name">{f.fileName}</span>
              <small dir="ltr">{fmtSize(f.fileSize || 0)}</small>
              <button type="button" onClick={() => onChange(files.filter((_, k) => k !== i))} aria-label={isRTL ? 'إزالة' : 'Remove'}>
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {(localErr || error) && <span className="site-field-err">{localErr || error}</span>}
    </div>
  );
};
