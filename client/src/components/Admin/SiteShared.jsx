import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import api from '../../config/api';

// Shared bits for the "الموقع الإلكتروني" admin tab (SiteManager).

// Lists come back as { items, total } (or a bare array from older shapes).
export const listOf = (d) => (Array.isArray(d) ? d : (d?.items || d?.rows || d?.data || []));
export const totalOf = (d) => (Array.isArray(d) ? d.length : (d?.total ?? listOf(d).length));

export const errMsg = (err, isRTL, fallbackAr = 'حدث خطأ', fallbackEn = 'Something went wrong') => {
  const d = err?.response?.data || {};
  if (err?.response?.status === 403 && !d.messageAr && !d.message) {
    return isRTL ? 'هذا الإجراء متاح للمدير فقط' : 'Only managers can do this';
  }
  return (isRTL ? d.messageAr : d.message) || d.messageAr || d.message || (isRTL ? fallbackAr : fallbackEn);
};

// File input → { fileName, fileType, fileData (base64) } + a preview data URL.
export const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const raw = String(e.target.result || '');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    resolve({
      payload: { fileName: file.name, fileType: ext, fileData: raw.includes(',') ? raw.split(',').pop() : raw },
      preview: raw
    });
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const fmtDate = (d, isRTL) => {
  if (!d) return '—';
  const dt = new Date(String(d).length <= 10 ? `${d}T00:00:00` : d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const fmtDateTime = (d, isRTL) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const fmtSize = (n) => {
  const b = Number(n) || 0;
  if (!b) return '';
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

// Opens an admin-protected file in a new tab (the server accepts ?token=).
export const fileUrl = (path) => {
  let token = '';
  try { token = localStorage.getItem('adminToken') || ''; } catch { /* ignore */ }
  return `${api.defaults.baseURL}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};

// Image URLs from the API are root-relative (/api/site/...): in development
// they live on the API host, not the dev server. Other paths (/site/...) are
// bundled assets served by the client itself.
export const absUrl = (u) => {
  if (!u) return '';
  if (/^(https?:|data:|blob:)/.test(u)) return u;
  const base = String(api.defaults.baseURL || '');
  if (u.startsWith('/api/') && /^https?:/.test(base)) {
    return `${base.replace(/\/api\/?$/, '')}${u}`;
  }
  return u;
};

export const STATUS_META = {
  new:       { ar: 'جديد',          en: 'New',       cls: 'new' },
  reviewing: { ar: 'قيد المراجعة',   en: 'Reviewing', cls: 'reviewing' },
  accepted:  { ar: 'مقبول',          en: 'Accepted',  cls: 'accepted' },
  rejected:  { ar: 'مرفوض',          en: 'Rejected',  cls: 'rejected' },
  pending:   { ar: 'بانتظار المراجعة', en: 'Pending',   cls: 'reviewing' },
  approved:  { ar: 'منشورة',         en: 'Approved',  cls: 'accepted' }
};

export const StatusPill = ({ status, isRTL }) => {
  const m = STATUS_META[status] || { ar: status, en: status, cls: 'new' };
  return <span className={`sm-pill ${m.cls}`}>{isRTL ? m.ar : m.en}</span>;
};

// Modal built on the admin's existing .wsr dialog styles.
export const SmModal = ({ title, kicker, onClose, children, footer, wide, busy }) => {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div className="modal-overlay sm-overlay" onClick={() => !busy && onClose()}>
      <motion.div
        ref={ref}
        className={`modal-content wsr sm-modal ${wide ? 'wide' : ''}`}
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        role="dialog"
        aria-modal="true"
      >
        <div className="wsr-head">
          <div>
            {kicker && <span className="wsr-kicker">{kicker}</span>}
            <h3>{title}</h3>
          </div>
          <button type="button" className="wsr-close" onClick={onClose} disabled={busy} aria-label="✕">✕</button>
        </div>
        <div className="wsr-body">{children}</div>
        {footer && <div className="wsr-foot">{footer}</div>}
      </motion.div>
    </div>
  );
};

// Generic form fields driven by a config: { key, ar, en, type, options, dir, full, rows, min, max }
export const FieldGrid = ({ fields, value, onChange, isRTL, errors = {} }) => (
  <div className="sm-form-grid">
    {fields.map(f => {
      const v = value[f.key];
      const label = isRTL ? f.ar : f.en;
      const set = (nv) => onChange({ ...value, [f.key]: nv });
      let input;
      if (f.type === 'textarea') {
        input = <textarea rows={f.rows || 4} value={v ?? ''} dir={f.dir} onChange={e => set(e.target.value)} />;
      } else if (f.type === 'select') {
        input = (
          <select value={v ?? ''} onChange={e => set(e.target.value)}>
            {f.options.map(o => <option key={o.v} value={o.v}>{isRTL ? o.ar : o.en}</option>)}
          </select>
        );
      } else if (f.type === 'checkbox') {
        input = (
          <label className="sm-check">
            <input type="checkbox" checked={!!v} onChange={e => set(e.target.checked)} />
            <span>{isRTL ? (f.hintAr || label) : (f.hintEn || label)}</span>
          </label>
        );
      } else {
        input = (
          <input
            type={f.type || 'text'}
            value={v ?? ''}
            dir={f.dir}
            min={f.min}
            max={f.max}
            step={f.step}
            onChange={e => set(f.type === 'number' ? e.target.value : e.target.value)}
          />
        );
      }
      return (
        <div key={f.key} className={`sm-field ${f.full ? 'full' : ''} ${errors[f.key] ? 'has-error' : ''}`}>
          {f.type !== 'checkbox' && <label>{label}{f.required ? ' *' : ''}</label>}
          {input}
          {errors[f.key] && <span className="sm-err">{errors[f.key]}</span>}
        </div>
      );
    })}
  </div>
);

// Image picker with preview, replace and remove.
export const ImagePicker = ({ isRTL, currentUrl, preview, onPick, onRemove, removed, label }) => {
  const input = useRef(null);
  const shown = preview || (!removed && currentUrl ? absUrl(currentUrl) : '');
  return (
    <div className="sm-image-picker">
      <div className="sm-image-label">{label || (isRTL ? 'الصورة' : 'Image')}</div>
      <div className="sm-image-row">
        <div className={`sm-image-box ${shown ? '' : 'empty'}`}>
          {shown ? <img src={shown} alt="" /> : <span>{isRTL ? 'لا توجد صورة' : 'No image'}</span>}
        </div>
        <div className="sm-image-actions">
          <input
            ref={input}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={async e => {
              const f = e.target.files && e.target.files[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > 8 * 1024 * 1024) { onPick(null, isRTL ? 'الصورة أكبر من 8 ميجابايت' : 'Image is larger than 8 MB'); return; }
              const r = await readFile(f);
              onPick(r);
            }}
          />
          <button type="button" className="sm-btn" onClick={() => input.current?.click()}>
            ⬆ {shown ? (isRTL ? 'تغيير الصورة' : 'Replace') : (isRTL ? 'رفع صورة' : 'Upload')}
          </button>
          {shown && (
            <button type="button" className="sm-btn ghost danger" onClick={onRemove}>
              {isRTL ? 'إزالة' : 'Remove'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const Pager = ({ isRTL, offset, limit, total, onChange }) => {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="sm-pager">
      <button type="button" className="sm-btn ghost" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}>
        {isRTL ? '→ السابق' : '← Prev'}
      </button>
      <span>{isRTL ? `صفحة ${page} من ${pages} · ${total} عنصر` : `Page ${page} of ${pages} · ${total} items`}</span>
      <button type="button" className="sm-btn ghost" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
        {isRTL ? 'التالي ←' : 'Next →'}
      </button>
    </div>
  );
};

export const EmptyState = ({ icon, text }) => (
  <div className="sm-empty"><span aria-hidden="true">{icon}</span>{text}</div>
);
