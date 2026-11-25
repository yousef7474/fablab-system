import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import api from '../../config/api';
import { FormQuestions, visibleFields, tr } from '../FabForm/FabFormPage';
import '../FabForm/FabFormPage.css';
import './FabFormsTab.css';

// Admin "نماذج فاب لاب": our own forms instead of Google Forms. Build a
// form (questions + settings), share /forms/:slug, switch it on / off or
// give it an open and close time, read the answers and export them to
// Excel. Managers build and switch; any admin can read and export.

const fmtDateTime = (d, isRTL) => (d ? new Date(d).toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
  timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
}) : '—');
// <input type="datetime-local"> works in local time; the server stores UTC.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const isManager = () => {
  try { return ['manager', 'admin'].includes(JSON.parse(localStorage.getItem('adminData') || '{}').role); } catch { return false; }
};
const errMsg = (err, isRTL, fallback) => {
  const d = err?.response?.data;
  return (isRTL ? d?.messageAr : d?.message) || d?.messageAr || fallback;
};
const copyText = (text, isRTL) => {
  const ok = () => toast.success(isRTL ? 'تم نسخ الرابط' : 'Link copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(ok, () => toast.error(isRTL ? 'تعذّر النسخ' : 'Copy failed'));
};
const newId = () => `f_${Math.random().toString(16).slice(2, 10)}`;
const CHOICE = ['radio', 'dropdown', 'checkbox'];

const I = ({ d, children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d ? <path d={d} /> : children}</svg>
);

const TYPES = {
  short: { ar: 'إجابة قصيرة', en: 'Short answer', icon: <I d="M4 7V5h16v2M9 19h6M12 5v14" /> },
  paragraph: { ar: 'فقرة', en: 'Paragraph', icon: <I d="M4 6h16M4 10h16M4 14h16M4 18h10" /> },
  email: { ar: 'بريد إلكتروني', en: 'Email', icon: <I><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></I> },
  phone: { ar: 'رقم جوال', en: 'Phone', icon: <I><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></I> },
  number: { ar: 'رقم', en: 'Number', icon: <I d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /> },
  date: { ar: 'تاريخ', en: 'Date', icon: <I><rect x="3" y="4" width="18" height="18" rx="2.5" /><path d="M16 2v4M8 2v4M3 10h18" /></I> },
  time: { ar: 'وقت', en: 'Time', icon: <I><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I> },
  radio: { ar: 'اختيار واحد', en: 'Multiple choice', icon: <I><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" fill="currentColor" /></I> },
  dropdown: { ar: 'قائمة منسدلة', en: 'Dropdown', icon: <I><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m9 11 3 3 3-3" /></I> },
  checkbox: { ar: 'اختيار متعدد', en: 'Checkboxes', icon: <I><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8 12 3 3 5-6" /></I> },
  consent: { ar: 'إقرار / موافقة', en: 'Consent', icon: <I><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></I> },
  section: { ar: 'عنوان قسم', en: 'Section heading', icon: <I d="M4 6h16M4 12h10M4 18h7" /> }
};
const TYPE_ORDER = ['short', 'paragraph', 'radio', 'checkbox', 'dropdown', 'email', 'phone', 'number', 'date', 'time', 'consent', 'section'];

const STATUS = {
  live: { ar: 'مفعّل الآن', en: 'Live', cls: 'live' },
  inactive: { ar: 'متوقف', en: 'Off', cls: 'off' },
  not_yet: { ar: 'مجدول', en: 'Scheduled', cls: 'soon' },
  ended: { ar: 'انتهت المدة', en: 'Ended', cls: 'ended' },
  full: { ar: 'اكتمل العدد', en: 'Full', cls: 'full' }
};

const blankField = (type) => {
  const f = { id: newId(), type, label: '', help: '', required: false, showIf: null };
  if (CHOICE.includes(type)) f.options = ['الخيار 1', 'الخيار 2'];
  if (type === 'consent') { f.options = ['أوافق']; f.required = true; }
  if (['short', 'paragraph', 'email', 'phone', 'number'].includes(type)) f.placeholder = '';
  if (type === 'number') { f.min = null; f.max = null; }
  if (type === 'short' || type === 'paragraph') f.maxWords = null;
  return f;
};
const NEW_FORM = () => ({
  title: '', description: '', slug: '', isActive: false, opensAt: '', closesAt: '', maxResponses: '',
  successMessage: '', closedMessage: '', sendConfirmation: true,
  titleEn: '', descriptionEn: '', successMessageEn: '', closedMessageEn: '',
  fields: [
    { ...blankField('short'), label: 'الاسم الكامل', required: true },
    { ...blankField('phone'), label: 'رقم الجوال', required: true, placeholder: '05xxxxxxxx' },
    { ...blankField('email'), label: 'البريد الإلكتروني', required: true, placeholder: 'name@example.com' }
  ]
});
const toDraft = (form) => ({
  title: form.title || '', description: form.description || '', slug: form.slug || '', isActive: !!form.isActive,
  opensAt: toLocalInput(form.opensAt), closesAt: toLocalInput(form.closesAt),
  maxResponses: form.maxResponses ?? '', successMessage: form.successMessage || '', closedMessage: form.closedMessage || '',
  sendConfirmation: form.sendConfirmation !== false,
  titleEn: form.titleEn || '', descriptionEn: form.descriptionEn || '',
  successMessageEn: form.successMessageEn || '', closedMessageEn: form.closedMessageEn || '',
  fields: (form.fields || []).map(f => ({ help: '', showIf: null, ...f }))
});

// An answer as text (table, detail, Excel).
const answerText = (field, value) => {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.join('، ');
  if (field?.type === 'consent') return value ? (field.options?.[0] || 'نعم') : '';
  return String(value);
};

// Options' English, padded to the options' length (index-aligned).
const enList = (field) => {
  const en = [...(field.optionsEn || [])];
  while (en.length < (field.options || []).length) en.push('');
  return en.slice(0, (field.options || []).length);
};
const hasEnglish = (field) => !!(field.labelEn || field.helpEn || field.placeholderEn || (field.optionsEn || []).some(Boolean));

const Portal = ({ children }) => createPortal(children, document.querySelector('.admin-layout.fx') || document.body);

// ─────────────────────────── Question card (editor) ───────────────────────────
const QuestionCard = ({ field, index, fields, isRTL, open, onOpen, onChange, onMove, onDuplicate, onDelete, error }) => {
  const meta = TYPES[field.type];
  const controllers = fields.slice(0, index).filter(f => CHOICE.includes(f.type) && (f.options || []).length);
  const ctl = field.showIf ? fields.find(f => f.id === field.showIf.field) : null;
  const ctlLater = field.showIf && !controllers.some(c => c.id === field.showIf.field);
  const set = (patch) => onChange({ ...field, ...patch });

  const [enOpen, setEnOpen] = useState(() => hasEnglish(field));
  const setOption = (i, v) => {
    const opts = [...field.options];
    const en = enList(field);
    const lines = v.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (lines.length > 1) { // pasted several lines → several options
      opts.splice(i, 1, ...lines);
      en.splice(i, 1, en[i] || '', ...lines.slice(1).map(() => ''));
    } else opts[i] = v;
    set({ options: opts, optionsEn: en });
  };
  const setOptionEn = (i, v) => {
    const en = enList(field);
    en[i] = v;
    set({ optionsEn: en });
  };
  const moveOption = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= field.options.length) return;
    const opts = [...field.options];
    const en = enList(field);
    [opts[i], opts[j]] = [opts[j], opts[i]];
    [en[i], en[j]] = [en[j], en[i]];
    set({ options: opts, optionsEn: en });
  };
  const removeOption = (i) => set({ options: field.options.filter((_, j) => j !== i), optionsEn: enList(field).filter((_, j) => j !== i) });
  const changeType = (type) => {
    const next = blankField(type);
    const keep = {
      id: field.id, label: field.label, help: field.help, labelEn: field.labelEn, helpEn: field.helpEn,
      required: type === 'section' ? false : field.required, showIf: field.showIf
    };
    if ((CHOICE.includes(type) || type === 'consent') && field.options?.length) {
      next.options = type === 'consent' ? [field.options[0]] : field.options;
      next.optionsEn = type === 'consent' ? [enList(field)[0] || ''] : enList(field);
    }
    onChange({ ...next, ...keep });
  };

  if (!open) {
    return (
      <motion.div layout className={`ffa-q is-closed${error ? ' has-error' : ''}`} onClick={onOpen} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
        <span className={`ffa-q-num t-${field.type}`}>{field.type === 'section' ? '§' : index + 1}</span>
        <span className="ffa-q-icon">{meta.icon}</span>
        <span className="ffa-q-sum">
          <b>{field.label || <em>{isRTL ? 'سؤال بلا عنوان' : 'Untitled question'}</em>}</b>
          <small>
            {isRTL ? meta.ar : meta.en}
            {field.required && <i className="ffa-tag red">{isRTL ? 'إلزامي' : 'Required'}</i>}
            {field.showIf && <i className="ffa-tag blue">{isRTL ? 'مشروط' : 'Conditional'}</i>}
            {hasEnglish(field) && <i className="ffa-tag en">EN</i>}
            {CHOICE.includes(field.type) && <i className="ffa-tag">{field.options.length} {isRTL ? 'خيارات' : 'options'}</i>}
          </small>
        </span>
        <span className="ffa-q-chev"><I d="m6 9 6 6 6-6" /></span>
      </motion.div>
    );
  }

  return (
    <motion.div layout className={`ffa-q is-open${error ? ' has-error' : ''}`} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}>
      <div className="ffa-q-head">
        <span className={`ffa-q-num t-${field.type}`}>{field.type === 'section' ? '§' : index + 1}</span>
        <label className="ffa-type">
          <span className="ffa-q-icon">{meta.icon}</span>
          <select value={field.type} onChange={(e) => changeType(e.target.value)} aria-label={isRTL ? 'نوع السؤال' : 'Question type'}>
            {TYPE_ORDER.map(t => <option key={t} value={t}>{isRTL ? TYPES[t].ar : TYPES[t].en}</option>)}
          </select>
        </label>
        <div className="ffa-q-tools">
          <button type="button" onClick={() => onMove(-1)} title={isRTL ? 'لأعلى' : 'Move up'}><I d="m18 15-6-6-6 6" /></button>
          <button type="button" onClick={() => onMove(1)} title={isRTL ? 'لأسفل' : 'Move down'}><I d="m6 9 6 6 6-6" /></button>
          <button type="button" onClick={onDuplicate} title={isRTL ? 'تكرار' : 'Duplicate'}><I><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></I></button>
          <button type="button" className="danger" onClick={onDelete} title={isRTL ? 'حذف' : 'Delete'}><I d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></button>
        </div>
      </div>

      <label className="ffa-field">
        <span>{field.type === 'section' ? (isRTL ? 'عنوان القسم' : 'Section title') : field.type === 'consent' ? (isRTL ? 'نص الإقرار' : 'Statement') : (isRTL ? 'السؤال' : 'Question')} *</span>
        <textarea rows={field.label.length > 70 ? 3 : 1} value={field.label} onChange={(e) => set({ label: e.target.value })}
          placeholder={isRTL ? 'اكتب نص السؤال' : 'Type the question'} className={error && !field.label.trim() ? 'bad' : ''} />
      </label>
      <label className="ffa-field">
        <span>{field.type === 'section' ? (isRTL ? 'نص توضيحي' : 'Text') : (isRTL ? 'وصف / ملاحظة (اختياري)' : 'Help text (optional)')}</span>
        <textarea rows={1} value={field.help || ''} onChange={(e) => set({ help: e.target.value })}
          placeholder={isRTL ? 'يظهر تحت السؤال بخط أصغر' : 'Shown under the question'} />
      </label>

      {['short', 'paragraph', 'email', 'phone', 'number'].includes(field.type) && (
        <label className="ffa-field">
          <span>{isRTL ? 'نص إرشادي داخل الحقل' : 'Placeholder'}</span>
          <input value={field.placeholder || ''} onChange={(e) => set({ placeholder: e.target.value })} />
        </label>
      )}

      {CHOICE.includes(field.type) && (
        <div className="ffa-options">
          <span className="ffa-mini-label">{isRTL ? 'الخيارات' : 'Options'} <small>{isRTL ? '(الصق عدة أسطر لإضافة عدة خيارات)' : '(paste several lines to add several)'}</small></span>
          {field.options.map((o, i) => (
            <div className="ffa-opt" key={i}>
              <i className={`ffa-opt-mark ${field.type}`} aria-hidden="true" />
              <input value={o} onChange={(e) => setOption(i, e.target.value)}
                onPaste={(e) => { const txt = e.clipboardData.getData('text'); if (/\n/.test(txt)) { e.preventDefault(); setOption(i, txt); } }}
                className={error && !o.trim() ? 'bad' : ''} />
              <button type="button" onClick={() => moveOption(i, -1)} title={isRTL ? 'لأعلى' : 'Up'}><I d="m18 15-6-6-6 6" /></button>
              <button type="button" onClick={() => moveOption(i, 1)} title={isRTL ? 'لأسفل' : 'Down'}><I d="m6 9 6 6 6-6" /></button>
              <button type="button" className="danger" disabled={field.options.length <= 1} onClick={() => removeOption(i)} title={isRTL ? 'حذف' : 'Remove'}><I d="M18 6 6 18M6 6l12 12" /></button>
            </div>
          ))}
          <button type="button" className="ffa-add-opt" onClick={() => set({ options: [...field.options, `${isRTL ? 'الخيار' : 'Option'} ${field.options.length + 1}`], optionsEn: [...enList(field), ''] })}>
            ＋ {isRTL ? 'إضافة خيار' : 'Add option'}
          </button>
        </div>
      )}

      {field.type === 'consent' && (
        <label className="ffa-field">
          <span>{isRTL ? 'نص مربع الموافقة' : 'Tick-box text'}</span>
          <input value={field.options?.[0] || ''} onChange={(e) => set({ options: [e.target.value] })} placeholder={isRTL ? 'أتعهد وأوافق' : 'I agree'} />
        </label>
      )}

      {(field.type === 'number' || field.type === 'short' || field.type === 'paragraph') && (
        <div className="ffa-row">
          {field.type === 'number' ? (
            <>
              <label className="ffa-field"><span>{isRTL ? 'أقل قيمة' : 'Minimum'}</span>
                <input type="number" value={field.min ?? ''} onChange={(e) => set({ min: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label className="ffa-field"><span>{isRTL ? 'أعلى قيمة' : 'Maximum'}</span>
                <input type="number" value={field.max ?? ''} onChange={(e) => set({ max: e.target.value === '' ? null : Number(e.target.value) })} /></label>
            </>
          ) : (
            <label className="ffa-field"><span>{isRTL ? 'أقصى عدد كلمات (اختياري)' : 'Max words (optional)'}</span>
              <input type="number" min="1" value={field.maxWords ?? ''} onChange={(e) => set({ maxWords: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          )}
        </div>
      )}

      <div className={`ffa-en${enOpen ? ' open' : ''}`}>
        <button type="button" className="ffa-en-toggle" onClick={() => setEnOpen(o => !o)} aria-expanded={enOpen}>
          <span className="ffa-en-badge">EN</span>
          {isRTL ? 'الترجمة الإنجليزية (اختياري)' : 'English translation (optional)'}
          {hasEnglish(field) && !enOpen && <i className="ffa-tag en">✓</i>}
          <span className="ffa-en-chev"><I d="m6 9 6 6 6-6" /></span>
        </button>
        {enOpen && (
          <div className="ffa-en-body">
            <p className="ffa-note">{isRTL
              ? 'تظهر للزائر عند اختيار English. اتركها فارغة ليظهر النص العربي.'
              : 'Shown when the visitor picks English. Leave empty to show the Arabic.'}</p>
            <label className="ffa-field">
              <span>{field.type === 'section' ? (isRTL ? 'عنوان القسم بالإنجليزية' : 'Section title (English)') : field.type === 'consent' ? (isRTL ? 'نص الإقرار بالإنجليزية' : 'Statement (English)') : (isRTL ? 'السؤال بالإنجليزية' : 'Question (English)')}</span>
              <textarea dir="ltr" rows={(field.labelEn || '').length > 70 ? 3 : 1} value={field.labelEn || ''} onChange={(e) => set({ labelEn: e.target.value })} placeholder="e.g. Full name" />
            </label>
            <label className="ffa-field">
              <span>{isRTL ? 'الوصف بالإنجليزية' : 'Help text (English)'}</span>
              <textarea dir="ltr" rows={1} value={field.helpEn || ''} onChange={(e) => set({ helpEn: e.target.value })} />
            </label>
            {['short', 'paragraph', 'email', 'phone', 'number'].includes(field.type) && (
              <label className="ffa-field">
                <span>{isRTL ? 'النص الإرشادي بالإنجليزية' : 'Placeholder (English)'}</span>
                <input dir="ltr" value={field.placeholderEn || ''} onChange={(e) => set({ placeholderEn: e.target.value })} />
              </label>
            )}
            {(CHOICE.includes(field.type) || field.type === 'consent') && (
              <div className="ffa-en-opts">
                <span className="ffa-mini-label">{field.type === 'consent' ? (isRTL ? 'نص مربع الموافقة بالإنجليزية' : 'Tick-box text (English)') : (isRTL ? 'الخيارات بالإنجليزية' : 'Options (English)')}</span>
                {(field.type === 'consent' ? field.options.slice(0, 1) : field.options).map((o, i) => (
                  <div className="ffa-en-opt" key={i}>
                    <span className="ffa-en-ar" title={o}>{o || '—'}</span>
                    <I d={isRTL ? 'M19 12H5M11 18l-6-6 6-6' : 'M5 12h14M13 6l6 6-6 6'} />
                    <input dir="ltr" value={enList(field)[i] || ''} onChange={(e) => setOptionEn(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ffa-q-foot">
        <div className="ffa-cond">
          <span className="ffa-mini-label">{isRTL ? 'متى يظهر؟' : 'Show'}</span>
          <select value={field.showIf?.field || ''} onChange={(e) => {
            const c = controllers.find(x => x.id === e.target.value);
            set({ showIf: c ? { field: c.id, value: c.options[0] } : null });
          }}>
            <option value="">{isRTL ? 'دائمًا' : 'Always'}</option>
            {controllers.map(c => <option key={c.id} value={c.id}>{isRTL ? 'عند إجابة: ' : 'When: '}{(c.label || '…').slice(0, 48)}</option>)}
            {ctlLater && ctl && <option value={ctl.id}>{(ctl.label || '…').slice(0, 48)}</option>}
          </select>
          {field.showIf && ctl && (
            <>
              <span className="ffa-eq">=</span>
              <select value={field.showIf.value} onChange={(e) => set({ showIf: { ...field.showIf, value: e.target.value } })}>
                {(ctl.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </>
          )}
          {ctlLater && <small className="ffa-warn">{isRTL ? 'الشرط يعتمد على سؤال لاحق وسيُلغى عند الحفظ' : 'Depends on a later question — will be dropped on save'}</small>}
        </div>
        {field.type !== 'section' && (
          <button type="button" className={`ffa-switch${field.required ? ' on' : ''}`} onClick={() => set({ required: !field.required })} aria-pressed={field.required}>
            <i />{isRTL ? 'إلزامي' : 'Required'}
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ─────────────────────────── Form editor (modal) ───────────────────────────
const FormEditor = ({ isRTL, form, onClose, onSaved }) => {
  const [draft, setDraft] = useState(() => (form ? toDraft(form) : NEW_FORM()));
  const [initial] = useState(() => JSON.stringify(form ? toDraft(form) : NEW_FORM()));
  const [view, setView] = useState('questions'); // questions | settings | preview
  const [openId, setOpenId] = useState(() => draft.fields[0]?.id || null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState({});
  const [preview, setPreview] = useState({});
  const [previewLang, setPreviewLang] = useState('ar');
  const dirty = JSON.stringify(draft) !== initial;
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const hasEmail = draft.fields.some(f => f.type === 'email');

  const close = () => {
    if (dirty && !window.confirm(isRTL ? 'لديك تغييرات غير محفوظة. إغلاق دون حفظ؟' : 'Discard unsaved changes?')) return;
    onClose();
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const updateField = (i, f) => setDraft(d => ({ ...d, fields: d.fields.map((x, j) => (j === i ? f : x)) }));
  const moveField = (i, dir) => setDraft(d => {
    const j = i + dir;
    if (j < 0 || j >= d.fields.length) return d;
    const fields = [...d.fields];
    [fields[i], fields[j]] = [fields[j], fields[i]];
    return { ...d, fields };
  });
  const duplicateField = (i) => setDraft(d => {
    const copy = {
      ...d.fields[i], id: newId(),
      options: d.fields[i].options ? [...d.fields[i].options] : undefined,
      optionsEn: d.fields[i].optionsEn ? [...d.fields[i].optionsEn] : undefined
    };
    const fields = [...d.fields];
    fields.splice(i + 1, 0, copy);
    setOpenId(copy.id);
    return { ...d, fields };
  });
  const deleteField = (i) => setDraft(d => {
    const gone = d.fields[i];
    const fields = d.fields.filter((_, j) => j !== i).map(f => (f.showIf?.field === gone.id ? { ...f, showIf: null } : f));
    return { ...d, fields };
  });
  const addField = (type) => {
    const f = blankField(type);
    setDraft(d => ({ ...d, fields: [...d.fields, f] }));
    setOpenId(f.id);
    setAdding(false);
    setTimeout(() => document.getElementById(`ffa-q-${f.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };

  const save = async () => {
    const bad = {};
    draft.fields.forEach(f => {
      if (!f.label.trim() || (CHOICE.includes(f.type) && f.options.some(o => !o.trim()))) bad[f.id] = true;
    });
    if (!draft.title.trim()) { setView('settings'); toast.error(isRTL ? 'عنوان النموذج مطلوب' : 'The title is required'); return; }
    if (Object.keys(bad).length) {
      setProblems(bad); setView('questions'); setOpenId(Object.keys(bad)[0]);
      toast.error(isRTL ? 'أكمل نص كل سؤال وخياراته' : 'Fill in every question and option');
      return;
    }
    setProblems({});
    const payload = {
      title: draft.title, description: draft.description, isActive: draft.isActive,
      opensAt: fromLocalInput(draft.opensAt), closesAt: fromLocalInput(draft.closesAt),
      maxResponses: draft.maxResponses === '' ? null : Number(draft.maxResponses),
      successMessage: draft.successMessage, closedMessage: draft.closedMessage, sendConfirmation: draft.sendConfirmation,
      titleEn: draft.titleEn, descriptionEn: draft.descriptionEn,
      successMessageEn: draft.successMessageEn, closedMessageEn: draft.closedMessageEn,
      fields: draft.fields.map(f => ({
        ...f, label: f.label.trim(), options: f.options?.map(o => o.trim()),
        optionsEn: f.options ? enList(f).map(o => (o || '').trim()) : undefined
      }))
    };
    if (draft.slug.trim()) payload.slug = draft.slug.trim().toLowerCase();
    setSaving(true);
    try {
      const { data } = form ? await api.put(`/fablab-forms/${form.formId}`, payload) : await api.post('/fablab-forms', payload);
      toast.success(isRTL ? 'تم حفظ النموذج' : 'Form saved');
      onSaved(data.form);
    } catch (err) {
      toast.error(errMsg(err, isRTL, isRTL ? 'تعذّر الحفظ' : 'Could not save'));
    } finally { setSaving(false); }
  };

  const qCount = draft.fields.filter(f => f.type !== 'section').length;

  return (
    <Portal>
      <motion.div className="ffa-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <motion.div className="ffa-modal ffa-editor" dir={isRTL ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25 }}>
          <div className="ffa-modal-head">
            <div className="ffa-modal-title">
              <span className="ffa-kicker">{form ? (isRTL ? 'تعديل نموذج' : 'Edit form') : (isRTL ? 'نموذج جديد' : 'New form')}</span>
              <h3>{draft.title || (isRTL ? 'نموذج بلا عنوان' : 'Untitled form')}</h3>
            </div>
            <div className="ffa-seg" role="tablist">
              {[['questions', isRTL ? 'الأسئلة' : 'Questions', qCount], ['settings', isRTL ? 'الإعدادات' : 'Settings'], ['preview', isRTL ? 'معاينة' : 'Preview']].map(([k, label, n]) => (
                <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>
                  {label}{n != null && <i>{n}</i>}
                </button>
              ))}
            </div>
            <button type="button" className="ffa-x" onClick={close} aria-label={isRTL ? 'إغلاق' : 'Close'}><I d="M18 6 6 18M6 6l12 12" /></button>
          </div>

          <div className="ffa-modal-body">
            {view === 'questions' && (
              <div className="ffa-builder">
                <div className="ffa-title-card">
                  <input className="ffa-title-input" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={isRTL ? 'عنوان النموذج *' : 'Form title *'} />
                  <textarea className="ffa-desc-input" rows={3} value={draft.description} onChange={(e) => set({ description: e.target.value })}
                    placeholder={isRTL ? 'وصف النموذج: تفاصيل الفعالية، الشروط، المواعيد…' : 'Description: event details, conditions, dates…'} />
                </div>
                <div className="ffa-qs">
                  {draft.fields.map((f, i) => (
                    <div key={f.id} id={`ffa-q-${f.id}`}>
                      <QuestionCard field={f} index={i} fields={draft.fields} isRTL={isRTL} open={openId === f.id} error={!!problems[f.id]}
                        onOpen={() => setOpenId(f.id)} onChange={(nf) => updateField(i, nf)} onMove={(dir) => moveField(i, dir)}
                        onDuplicate={() => duplicateField(i)} onDelete={() => deleteField(i)} />
                    </div>
                  ))}
                  {!draft.fields.length && <div className="ffa-empty small">{isRTL ? 'لا توجد أسئلة بعد — أضف أول سؤال.' : 'No questions yet — add the first one.'}</div>}
                </div>
                <div className="ffa-add">
                  <button type="button" className="ffa-btn primary" onClick={() => setAdding(a => !a)}>＋ {isRTL ? 'إضافة سؤال' : 'Add question'}</button>
                  <AnimatePresence>
                    {adding && (
                      <motion.div className="ffa-types" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                        {TYPE_ORDER.map(t => (
                          <button key={t} type="button" onClick={() => addField(t)}>
                            <span className={`ffa-type-ico t-${t}`}>{TYPES[t].icon}</span>{isRTL ? TYPES[t].ar : TYPES[t].en}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {view === 'settings' && (
              <div className="ffa-settings">
                <section className="ffa-panel">
                  <h4>{isRTL ? 'الأساسيات' : 'Basics'}</h4>
                  <label className="ffa-field"><span>{isRTL ? 'عنوان النموذج' : 'Title'} *</span>
                    <input value={draft.title} onChange={(e) => set({ title: e.target.value })} /></label>
                  <label className="ffa-field"><span>{isRTL ? 'الوصف' : 'Description'}</span>
                    <textarea rows={5} value={draft.description} onChange={(e) => set({ description: e.target.value })} /></label>
                  <div className="ffa-en-block">
                    <span className="ffa-mini-label"><span className="ffa-en-badge">EN</span>{isRTL ? 'بالإنجليزية (اختياري) — يظهر زر English للزائر عند تعبئتها' : 'English (optional) — visitors get an English button once filled'}</span>
                    <label className="ffa-field"><span>{isRTL ? 'العنوان بالإنجليزية' : 'Title (English)'}</span>
                      <input dir="ltr" value={draft.titleEn} onChange={(e) => set({ titleEn: e.target.value })} /></label>
                    <label className="ffa-field"><span>{isRTL ? 'الوصف بالإنجليزية' : 'Description (English)'}</span>
                      <textarea dir="ltr" rows={4} value={draft.descriptionEn} onChange={(e) => set({ descriptionEn: e.target.value })} /></label>
                  </div>
                  <label className="ffa-field"><span>{isRTL ? 'اسم الرابط (اختياري)' : 'Link name (optional)'}</span>
                    <div className="ffa-slug" dir="ltr">
                      <em>fablabsahsa.com/forms/</em>
                      <input value={draft.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder={isRTL ? 'تلقائي' : 'auto'} />
                    </div>
                    <small>{isRTL ? 'حروف إنجليزية صغيرة وأرقام وشرطة. اتركه فارغًا لرابط عشوائي.' : 'Lower-case letters, digits and dashes. Leave empty for a random link.'}</small>
                  </label>
                </section>

                <section className="ffa-panel">
                  <h4>{isRTL ? 'الإتاحة' : 'Availability'}</h4>
                  <button type="button" className={`ffa-switch big${draft.isActive ? ' on' : ''}`} onClick={() => set({ isActive: !draft.isActive })} aria-pressed={draft.isActive}>
                    <i />{draft.isActive ? (isRTL ? 'النموذج مفعّل' : 'Form is on') : (isRTL ? 'النموذج متوقف' : 'Form is off')}
                  </button>
                  <div className="ffa-row">
                    <label className="ffa-field"><span>{isRTL ? 'يُفتح في (اختياري)' : 'Opens at (optional)'}</span>
                      <input type="datetime-local" value={draft.opensAt} onChange={(e) => set({ opensAt: e.target.value })} /></label>
                    <label className="ffa-field"><span>{isRTL ? 'يُغلق في (اختياري)' : 'Closes at (optional)'}</span>
                      <input type="datetime-local" value={draft.closesAt} onChange={(e) => set({ closesAt: e.target.value })} /></label>
                  </div>
                  <label className="ffa-field"><span>{isRTL ? 'الحد الأقصى للردود (اختياري)' : 'Max responses (optional)'}</span>
                    <input type="number" min="1" value={draft.maxResponses} onChange={(e) => set({ maxResponses: e.target.value })} placeholder={isRTL ? 'بلا حد' : 'No limit'} /></label>
                  <p className="ffa-note">{isRTL
                    ? 'يستقبل النموذج الردود فقط عندما يكون مفعّلًا وضمن وقت الفتح والإغلاق (إن حُدِّد) ولم يكتمل العدد.'
                    : 'The form takes answers only while it is on, within the open/close times (if set) and below the limit.'}</p>
                </section>

                <section className="ffa-panel">
                  <h4>{isRTL ? 'الرسائل' : 'Messages'}</h4>
                  <label className="ffa-field"><span>{isRTL ? 'رسالة بعد الإرسال' : 'After submitting'}</span>
                    <textarea rows={2} value={draft.successMessage} onChange={(e) => set({ successMessage: e.target.value })} placeholder={isRTL ? 'شكرًا لك، وصلتنا إجابتك.' : 'Thank you — we received your answers.'} /></label>
                  <label className="ffa-field"><span>{isRTL ? 'رسالة عند إغلاق النموذج' : 'When the form is closed'}</span>
                    <textarea rows={2} value={draft.closedMessage} onChange={(e) => set({ closedMessage: e.target.value })} placeholder={isRTL ? 'هذا النموذج لا يستقبل ردودًا حاليًا' : 'This form is not taking responses right now'} /></label>
                  <div className="ffa-en-block">
                    <span className="ffa-mini-label"><span className="ffa-en-badge">EN</span>{isRTL ? 'الرسائل بالإنجليزية (اختياري)' : 'Messages in English (optional)'}</span>
                    <label className="ffa-field"><span>{isRTL ? 'بعد الإرسال' : 'After submitting'}</span>
                      <textarea dir="ltr" rows={2} value={draft.successMessageEn} onChange={(e) => set({ successMessageEn: e.target.value })} placeholder="Thank you — we received your answers." /></label>
                    <label className="ffa-field"><span>{isRTL ? 'عند إغلاق النموذج' : 'When the form is closed'}</span>
                      <textarea dir="ltr" rows={2} value={draft.closedMessageEn} onChange={(e) => set({ closedMessageEn: e.target.value })} placeholder="This form is not taking responses right now" /></label>
                  </div>
                  <button type="button" className={`ffa-switch${draft.sendConfirmation ? ' on' : ''}`} onClick={() => set({ sendConfirmation: !draft.sendConfirmation })} aria-pressed={draft.sendConfirmation}>
                    <i />{isRTL ? 'إرسال نسخة من الإجابات لبريد المسجّل' : 'Email the respondent a copy'}
                  </button>
                  {draft.sendConfirmation && !hasEmail && (
                    <p className="ffa-note warn">{isRTL ? 'أضف سؤالًا من نوع «بريد إلكتروني» حتى تصل النسخة للمسجّل.' : 'Add an “Email” question so the copy can be sent.'}</p>
                  )}
                </section>
              </div>
            )}

            {view === 'preview' && (
              <div className="ffp ffp--embed" dir={previewLang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="ffa-preview-lang" role="tablist" dir={isRTL ? 'rtl' : 'ltr'}>
                  <span>{isRTL ? 'معاينة بـ' : 'Preview in'}</span>
                  {[['ar', 'العربية'], ['en', 'English']].map(([k, label]) => (
                    <button key={k} type="button" role="tab" aria-selected={previewLang === k} className={previewLang === k ? 'on' : ''} onClick={() => setPreviewLang(k)}>{label}</button>
                  ))}
                </div>
                <div className="ffp-hero">
                  <span className="ffp-hero-strip" aria-hidden="true" />
                  <h1>{tr(draft, 'title', previewLang) || (isRTL ? 'نموذج بلا عنوان' : 'Untitled form')}</h1>
                  {tr(draft, 'description', previewLang) && <p className="ffp-desc">{tr(draft, 'description', previewLang)}</p>}
                </div>
                <div style={{ height: 14 }} />
                <FormQuestions fields={draft.fields.filter(f => f.label.trim())} answers={preview} lang={previewLang}
                  onChange={(id, v) => setPreview(p => {
                    const next = { ...p, [id]: v };
                    const still = new Set(visibleFields(draft.fields, next).map(f => f.id));
                    Object.keys(next).forEach(k => { if (!still.has(k)) delete next[k]; });
                    return next;
                  })} />
                <p className="ffa-note center">{isRTL ? 'معاينة فقط — الإجابات هنا لا تُرسل.' : 'Preview only — nothing here is sent.'}</p>
              </div>
            )}
          </div>

          <div className="ffa-modal-foot">
            <span className="ffa-dirty">{dirty ? (isRTL ? '● تغييرات غير محفوظة' : '● Unsaved changes') : ''}</span>
            <button type="button" className="ffa-btn ghost" onClick={close}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
            <button type="button" className="ffa-btn primary" onClick={save} disabled={saving}>
              {saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ النموذج' : 'Save form')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
};

// ─────────────────────────── Responses ───────────────────────────
const Responses = ({ isRTL, formId, manager, onBack }) => {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    try { const { data: d } = await api.get(`/fablab-forms/${formId}/responses`); setData(d); }
    catch (err) { toast.error(errMsg(err, isRTL, isRTL ? 'تعذّر تحميل الردود' : 'Could not load responses')); setData({ form: null, responses: [] }); }
  }, [formId, isRTL]);
  useEffect(() => { load(); }, [load]);

  // Columns: the form's questions now, plus any older question only found in answers.
  const columns = useMemo(() => {
    if (!data?.form) return [];
    const cols = (data.form.fields || []).filter(f => f.type !== 'section');
    const ids = new Set(cols.map(c => c.id));
    (data.responses || []).forEach(r => (r.fieldsSnapshot || []).forEach(f => {
      if (f.type !== 'section' && !ids.has(f.id)) { ids.add(f.id); cols.push({ ...f, old: true }); }
    }));
    return cols;
  }, [data]);

  const rows = useMemo(() => {
    const list = data?.responses || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(r => r.reference.toLowerCase().includes(needle)
      || columns.some(c => answerText(c, r.answers?.[c.id]).toLowerCase().includes(needle)));
  }, [data, q, columns]);

  const exportXlsx = () => {
    const form = data.form;
    const header = [isRTL ? 'رقم التسجيل' : 'Reference', isRTL ? 'تاريخ الإرسال' : 'Submitted', ...columns.map(c => c.label)];
    const body = (data.responses || []).map(r => [
      r.reference, fmtDateTime(r.createdAt, isRTL),
      ...columns.map(c => answerText(c, r.answers?.[c.id]))
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws['!cols'] = header.map((h, i) => ({ wch: Math.min(60, Math.max(12, String(h).length + 2, ...body.map(row => String(row[i] ?? '').length + 2))) }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: header.length - 1 } }) };
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: isRTL }] };
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? 'الردود' : 'Responses');
    const day = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${form.slug}-responses-${day}.xlsx`);
  };

  const removeResponse = async (r) => {
    if (!window.confirm(isRTL ? `حذف الرد ${r.reference} نهائيًا؟` : `Delete response ${r.reference} for good?`)) return;
    try {
      await api.delete(`/fablab-forms/responses/${r.responseId}`);
      toast.success(isRTL ? 'تم حذف الرد' : 'Response deleted');
      setOpen(null); load();
    } catch (err) { toast.error(errMsg(err, isRTL, 'Error')); }
  };

  const form = data?.form;
  return (
    <motion.div className="ffa-resp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="ffa-resp-head">
        <button type="button" className="ffa-btn ghost" onClick={onBack}>
          <I d={isRTL ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} />{isRTL ? 'كل النماذج' : 'All forms'}
        </button>
        <div className="ffa-resp-title">
          <h3>{form?.title || '…'}</h3>
          <span>{data ? `${(data.responses || []).length} ${isRTL ? 'ردًا' : 'responses'}` : ''}</span>
        </div>
        <div className="ffa-resp-tools">
          <label className="ffa-search">
            <I><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></I>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isRTL ? 'بحث في الردود…' : 'Search responses…'} />
          </label>
          <button type="button" className="ffa-btn excel" onClick={exportXlsx} disabled={!data?.responses?.length}>
            <I><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 13l6 6M15 13l-6 6" /></I>
            {isRTL ? 'تصدير Excel' : 'Export Excel'}
          </button>
        </div>
      </div>

      {!data ? <div className="ffa-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
        : !rows.length ? (
          <div className="ffa-empty">
            <span>📭</span>
            <b>{q ? (isRTL ? 'لا نتائج مطابقة' : 'No matches') : (isRTL ? 'لا توجد ردود بعد' : 'No responses yet')}</b>
            {!q && (isRTL ? 'شارك رابط النموذج لتبدأ الردود بالوصول.' : 'Share the form link to start getting answers.')}
          </div>
        ) : (
          <div className="ffa-table-wrap">
            <table className="ffa-table">
              <thead>
                <tr>
                  <th>{isRTL ? 'الرقم' : 'Ref'}</th>
                  <th>{isRTL ? 'التاريخ' : 'Date'}</th>
                  {columns.map(c => <th key={c.id} title={c.label} className={c.old ? 'old' : ''}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.responseId} onClick={() => setOpen(r)}>
                    <td><b className="ffa-ref" dir="ltr">{r.reference}</b></td>
                    <td className="nowrap">{fmtDateTime(r.createdAt, isRTL)}</td>
                    {columns.map(c => {
                      const txt = answerText(c, r.answers?.[c.id]);
                      return <td key={c.id} title={txt}>{txt.length > 60 ? `${txt.slice(0, 60)}…` : (txt || <span className="ffa-dash">—</span>)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <AnimatePresence>
        {open && (
          <Portal>
            <motion.div className="ffa-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
              <motion.div className="ffa-modal ffa-detail" dir={isRTL ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
                <div className="ffa-modal-head">
                  <div className="ffa-modal-title">
                    <span className="ffa-kicker">{fmtDateTime(open.createdAt, isRTL)}</span>
                    <h3 dir="ltr">{open.reference}</h3>
                  </div>
                  <button type="button" className="ffa-x" onClick={() => setOpen(null)} aria-label={isRTL ? 'إغلاق' : 'Close'}><I d="M18 6 6 18M6 6l12 12" /></button>
                </div>
                <div className="ffa-modal-body">
                  <dl className="ffa-answers">
                    {(open.fieldsSnapshot?.length ? open.fieldsSnapshot : columns).filter(f => f.type !== 'section' && open.answers?.[f.id] != null).map(f => (
                      <div key={f.id}><dt>{f.label}</dt><dd>{answerText(f, open.answers[f.id])}</dd></div>
                    ))}
                  </dl>
                </div>
                <div className="ffa-modal-foot">
                  {manager && <button type="button" className="ffa-btn danger" onClick={() => removeResponse(open)}>{isRTL ? 'حذف الرد' : 'Delete response'}</button>}
                  <span className="ffa-grow" />
                  <button type="button" className="ffa-btn ghost" onClick={() => setOpen(null)}>{isRTL ? 'إغلاق' : 'Close'}</button>
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─────────────────────────── Tab ───────────────────────────
const FabFormsTab = ({ isRTL }) => {
  const [forms, setForms] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | form
  const [viewing, setViewing] = useState(null); // formId
  const manager = isManager();

  const load = useCallback(async () => {
    try { const { data } = await api.get('/fablab-forms'); setForms(data.forms || []); }
    catch (err) { setForms(f => f || []); toast.error(errMsg(err, isRTL, isRTL ? 'تعذّر تحميل النماذج' : 'Could not load forms')); }
  }, [isRTL]);
  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => (forms || []).reduce((t, f) => ({
    live: t.live + (f.closedReason ? 0 : 1), responses: t.responses + (f.responseCount || 0)
  }), { live: 0, responses: 0 }), [forms]);

  const replace = (f) => setForms(list => list.map(x => (x.formId === f.formId ? f : x)));
  const toggle = async (f) => {
    try {
      const { data } = await api.patch(`/fablab-forms/${f.formId}/active`, { isActive: !f.isActive });
      replace(data.form);
      toast.success(data.form.isActive ? (isRTL ? 'تم تفعيل النموذج' : 'Form switched on') : (isRTL ? 'تم إيقاف النموذج' : 'Form switched off'));
    } catch (err) { toast.error(errMsg(err, isRTL, 'Error')); }
  };
  const duplicate = async (f) => {
    try {
      await api.post(`/fablab-forms/${f.formId}/duplicate`);
      toast.success(isRTL ? 'تم إنشاء نسخة (متوقفة)' : 'Copy created (off)');
      load();
    } catch (err) { toast.error(errMsg(err, isRTL, 'Error')); }
  };
  const remove = async (f) => {
    if (!window.confirm(isRTL ? `حذف النموذج «${f.title}»؟` : `Delete the form "${f.title}"?`)) return;
    try {
      await api.delete(`/fablab-forms/${f.formId}`);
      toast.success(isRTL ? 'تم حذف النموذج' : 'Form deleted'); load();
    } catch (err) {
      if (err.response?.status !== 409) { toast.error(errMsg(err, isRTL, 'Error')); return; }
      const n = err.response.data?.responseCount;
      const word = isRTL ? 'حذف' : 'DELETE';
      const typed = window.prompt(isRTL
        ? `لهذا النموذج ${n} ردًا. الحذف سيمحو النموذج وكل ردوده نهائيًا — لا توجد نسخة احتياطية.\nصدّر الردود إلى Excel أولًا إن احتجتها.\n\nاكتب «${word}» للتأكيد:`
        : `This form has ${n} responses. Deleting removes the form and every response for good — there is no backup.\nExport to Excel first if you need them.\n\nType "${word}" to confirm:`);
      if ((typed || '').trim() !== word) return;
      try {
        await api.delete(`/fablab-forms/${f.formId}?withResponses=1`);
        toast.success(isRTL ? 'تم حذف النموذج وردوده' : 'Form and responses deleted'); load();
      } catch (e2) { toast.error(errMsg(e2, isRTL, 'Error')); }
    }
  };

  return (
    <motion.div className="ffa" dir={isRTL ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {viewing ? (
        <Responses isRTL={isRTL} formId={viewing} manager={manager} onBack={() => { setViewing(null); load(); }} />
      ) : (
        <>
          <div className="ffa-header">
            <div>
              <span className="ffa-kicker"><i className="ffa-live" />{isRTL ? 'نماذج فاب لاب' : 'FabLab forms'}</span>
              <h2>{isRTL ? 'نماذج التسجيل' : 'Registration forms'}</h2>
              <p>{isRTL
                ? 'أنشئ نماذجك الخاصة بدل Google Forms، شارك الرابط، تحكّم بوقت الإتاحة، وصدّر الردود إلى Excel.'
                : 'Build your own forms instead of Google Forms, share the link, control when they are open and export answers to Excel.'}</p>
            </div>
            {manager && <button type="button" className="ffa-btn primary big" onClick={() => setEditing('new')}>＋ {isRTL ? 'نموذج جديد' : 'New form'}</button>}
          </div>

          <div className="ffa-kpis">
            <div className="ffa-kpi"><b>{forms ? forms.length : '—'}</b><span>{isRTL ? 'نموذج' : 'Forms'}</span></div>
            <div className="ffa-kpi green"><b>{forms ? totals.live : '—'}</b><span>{isRTL ? 'مفعّل الآن' : 'Live now'}</span></div>
            <div className="ffa-kpi navy"><b>{forms ? totals.responses : '—'}</b><span>{isRTL ? 'إجمالي الردود' : 'Responses'}</span></div>
          </div>

          {!forms ? <div className="ffa-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
            : !forms.length ? (
              <div className="ffa-empty">
                <span>📝</span>
                <b>{isRTL ? 'لا توجد نماذج بعد' : 'No forms yet'}</b>
                {isRTL ? 'أنشئ أول نموذج وشارك رابطه.' : 'Create your first form and share its link.'}
                {manager && <button type="button" className="ffa-btn primary" onClick={() => setEditing('new')}>＋ {isRTL ? 'نموذج جديد' : 'New form'}</button>}
              </div>
            ) : (
              <div className="ffa-cards">
                {forms.map((f, i) => {
                  const st = STATUS[f.closedReason || 'live'];
                  const qn = (f.fields || []).filter(x => x.type !== 'section').length;
                  return (
                    <motion.article key={f.formId} className={`ffa-card ${st.cls}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <div className="ffa-card-top">
                        <span className={`ffa-state ${st.cls}`}><i />{isRTL ? st.ar : st.en}</span>
                        <button type="button" className="ffa-count" onClick={() => setViewing(f.formId)} title={isRTL ? 'الردود' : 'Responses'}>
                          <b>{f.responseCount}</b><small>{f.maxResponses ? `/ ${f.maxResponses} ` : ''}{isRTL ? 'رد' : 'resp.'}</small>
                        </button>
                      </div>
                      <h4>{f.title}</h4>
                      {f.description && <p className="ffa-card-desc">{f.description}</p>}
                      <div className="ffa-card-meta">
                        <span><I d="M9 11l3 3L22 4" />{qn} {isRTL ? 'سؤال' : 'questions'}</span>
                        {f.opensAt && <span><I><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>{isRTL ? 'يُفتح' : 'Opens'} {fmtDateTime(f.opensAt, isRTL)}</span>}
                        {f.closesAt && <span><I><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></I>{isRTL ? 'يُغلق' : 'Closes'} {fmtDateTime(f.closesAt, isRTL)}</span>}
                      </div>
                      <div className="ffa-link">
                        <span dir="ltr">{f.url.replace(/^https?:\/\//, '')}</span>
                        <button type="button" onClick={() => copyText(f.url, isRTL)} title={isRTL ? 'نسخ الرابط' : 'Copy link'}><I><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></I></button>
                        <a href={`/forms/${f.slug}`} target="_blank" rel="noopener noreferrer" title={isRTL ? 'فتح' : 'Open'}><I d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></a>
                      </div>
                      <div className="ffa-card-foot">
                        <button type="button" className="ffa-btn primary" onClick={() => setViewing(f.formId)}>{isRTL ? 'الردود' : 'Responses'}</button>
                        {manager && (
                          <>
                            <button type="button" className={`ffa-switch${f.isActive ? ' on' : ''}`} onClick={() => toggle(f)} aria-pressed={f.isActive}
                              title={f.isActive ? (isRTL ? 'إيقاف النموذج' : 'Switch off') : (isRTL ? 'تفعيل النموذج' : 'Switch on')}>
                              <i />{f.isActive ? (isRTL ? 'مفعّل' : 'On') : (isRTL ? 'متوقف' : 'Off')}
                            </button>
                            <span className="ffa-grow" />
                            <button type="button" className="ffa-icon-btn" onClick={() => setEditing(f)} title={isRTL ? 'تعديل' : 'Edit'}><I d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></button>
                            <button type="button" className="ffa-icon-btn" onClick={() => duplicate(f)} title={isRTL ? 'نسخ النموذج' : 'Duplicate'}><I><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></I></button>
                            <button type="button" className="ffa-icon-btn danger" onClick={() => remove(f)} title={isRTL ? 'حذف' : 'Delete'}><I d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></button>
                          </>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
        </>
      )}

      <AnimatePresence>
        {editing && (
          <FormEditor key={editing === 'new' ? 'new' : editing.formId} isRTL={isRTL} form={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default FabFormsTab;
