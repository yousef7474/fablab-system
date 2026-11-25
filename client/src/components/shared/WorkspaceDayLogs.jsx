import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Day-by-day rating of an accepted workspace booking: a 1–5 rating,
// notes and photos for each day (photos are shrunk in the browser first).

const MAX_PHOTOS = 6;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
const fmtDay = (ymd, isRTL) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

// A picked photo → a JPEG data URL no wider / taller than 1280px.
const shrink = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

const Stars = ({ value, onChange, size = 26 }) => (
  <span className="wsl-stars" role={onChange ? 'radiogroup' : undefined}>
    {[1, 2, 3, 4, 5].map(n => (
      <button
        key={n}
        type="button"
        className={n <= value ? 'on' : ''}
        onClick={onChange ? () => onChange(n) : undefined}
        disabled={!onChange}
        style={{ fontSize: size }}
        aria-label={`${n}`}
      >★</button>
    ))}
  </span>
);

const WorkspaceDayLogs = ({ request, isRTL, onClose, onChanged }) => {
  const [logs, setLogs] = useState(null);
  const [form, setForm] = useState({ date: today() >= request.startDate && today() <= request.endDate ? today() : request.startDate, rating: 0, notes: '', images: [] });
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState(null);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/workspace-requests/${request.requestId}/logs`);
      setLogs(data.logs || []);
    } catch {
      toast.error(isRTL ? 'تعذّر تحميل التقييمات' : 'Could not load the ratings');
      setLogs([]);
    }
  }, [request.requestId, isRTL]);
  useEffect(() => { load(); }, [load]);

  const addPhotos = async (files) => {
    const list = [...files].filter(f => /^image\//.test(f.type)).slice(0, MAX_PHOTOS - form.images.length);
    try {
      const shrunk = await Promise.all(list.map(shrink));
      setForm(f => ({ ...f, images: [...f.images, ...shrunk].slice(0, MAX_PHOTOS) }));
    } catch {
      toast.error(isRTL ? 'تعذّرت قراءة الصورة' : 'Could not read the photo');
    }
  };

  const save = async () => {
    if (!form.rating) { toast.error(isRTL ? 'اختر التقييم من 1 إلى 5' : 'Pick a rating from 1 to 5'); return; }
    setSaving(true);
    try {
      await api.post(`/workspace-requests/${request.requestId}/logs`, form);
      toast.success(isRTL ? 'تم حفظ تقييم اليوم' : 'Day rating saved');
      setForm(f => ({ ...f, rating: 0, notes: '', images: [] }));
      load();
      onChanged?.();
    } catch (err) {
      toast.error((isRTL ? err.response?.data?.messageAr : err.response?.data?.message) || (isRTL ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (log) => {
    if (!window.confirm(isRTL ? 'حذف تقييم هذا اليوم؟' : 'Delete this day rating?')) return;
    try {
      await api.delete(`/workspace-requests/logs/${log.logId}`);
      load();
      onChanged?.();
    } catch {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  const avg = logs && logs.length ? (logs.reduce((s, l) => s + l.rating, 0) / logs.length).toFixed(1) : null;

  return (
    <motion.div className="wsr-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="wsr-modal wsl"
        dir={isRTL ? 'rtl' : 'ltr'}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="wsl-head">
          <div>
            <h3>{isRTL ? 'التقييم اليومي' : 'Daily rating'}</h3>
            <p>{request.requestNumber} · {request.projectName}{avg ? ` · ${isRTL ? 'المتوسط' : 'avg'} ${avg}/5` : ''}</p>
          </div>
          <button type="button" className="wsl-x" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
        </div>

        <div className="wsl-form">
          <div className="wsl-row">
            <label>
              {isRTL ? 'اليوم' : 'Day'}
              <input type="date" value={form.date} min={request.startDate} max={request.endDate} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </label>
            <div className="wsl-rate">
              <span>{isRTL ? 'التقييم' : 'Rating'}</span>
              <Stars value={form.rating} onChange={(n) => setForm(f => ({ ...f, rating: n }))} />
            </div>
          </div>
          <label>
            {isRTL ? 'ملاحظات (نظافة المساحة، الالتزام بالوقت، الأدوات…)' : 'Notes (cleanliness, timing, tools…)'}
            <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </label>
          <div className="wsl-photos">
            {form.images.map((src, i) => (
              <span key={i} className="wsl-thumb">
                <img src={src} alt="" />
                <button type="button" onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, k) => k !== i) }))} aria-label={isRTL ? 'إزالة' : 'Remove'}>×</button>
              </span>
            ))}
            {form.images.length < MAX_PHOTOS && (
              <button type="button" className="wsl-add" onClick={() => fileRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                {isRTL ? 'إضافة صور' : 'Add photos'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addPhotos(e.target.files); e.target.value = ''; }} />
          </div>
          <div className="wsr-modal-foot">
            <button type="button" className="wsr-btn ok" onClick={save} disabled={saving}>{saving ? (isRTL ? 'جاري الحفظ…' : 'Saving…') : (isRTL ? 'حفظ تقييم اليوم' : 'Save day rating')}</button>
          </div>
        </div>

        <div className="wsl-list">
          {logs === null ? (
            <p className="wsl-empty">{isRTL ? 'جاري التحميل…' : 'Loading…'}</p>
          ) : logs.length === 0 ? (
            <p className="wsl-empty">{isRTL ? 'لا توجد تقييمات بعد' : 'No ratings yet'}</p>
          ) : logs.map(l => (
            <article key={l.logId} className="wsl-item">
              <div className="wsl-item-top">
                <b>{fmtDay(l.date, isRTL)}</b>
                <Stars value={l.rating} size={17} />
                <button type="button" className="wsl-del" onClick={() => remove(l)}>{isRTL ? 'حذف' : 'Delete'}</button>
              </div>
              {l.notes && <p>{l.notes}</p>}
              {Array.isArray(l.images) && l.images.length > 0 && (
                <div className="wsl-photos">
                  {l.images.map((src, i) => (
                    <button key={i} type="button" className="wsl-thumb view" onClick={() => setViewer(src)}><img src={src} alt="" /></button>
                  ))}
                </div>
              )}
              <small>{l.createdBy || ''}</small>
            </article>
          ))}
        </div>

        {viewer && (
          <div className="wsl-viewer" onClick={() => setViewer(null)}><img src={viewer} alt="" /></div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default WorkspaceDayLogs;
