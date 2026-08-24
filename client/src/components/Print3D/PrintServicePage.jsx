import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import './PrintService.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

// Curated palette for the multi-color part picker + single-color chip row.
const COLOR_PALETTE = [
  { name: 'أبيض',     hex: '#ffffff', border: true },
  { name: 'أسود',     hex: '#111111' },
  { name: 'رمادي',    hex: '#6b7280' },
  { name: 'أحمر',     hex: '#dc2626' },
  { name: 'برتقالي',  hex: '#f97316' },
  { name: 'أصفر',     hex: '#facc15' },
  { name: 'أخضر',     hex: '#16a34a' },
  { name: 'تركوازي',  hex: '#06b6d4' },
  { name: 'أزرق',     hex: '#2563eb' },
  { name: 'بنفسجي',   hex: '#7c3aed' },
  { name: 'زهري',     hex: '#ec4899' },
  { name: 'بني',      hex: '#78350f' },
  { name: 'شفاف',     hex: '#e5e7eb', border: true, translucent: true },
  { name: 'ذهبي',     hex: '#d4af37' },
  { name: 'فضي',      hex: '#c0c0c0' }
];

const MATERIALS = [
  { key: 'PLA',  labelAr: 'PLA — عام ومتعدد الاستخدام',   labelEn: 'PLA — General purpose',   hintAr: 'أفضل للمجسمات الديكورية والنماذج', hintEn: 'Best for decorative models and prototypes' },
  { key: 'PETG', labelAr: 'PETG — قوي ومقاوم للماء',       labelEn: 'PETG — Strong & waterproof', hintAr: 'مناسب للاستخدام الوظيفي والحاويات', hintEn: 'Great for functional parts and containers' },
  { key: 'TPU',  labelAr: 'TPU — مرن كالمطاط',              labelEn: 'TPU — Rubber-like flexible', hintAr: 'للأجزاء المرنة والحماية والإطارات', hintEn: 'For flexible parts, protection, gaskets' }
];

const MAX_FILE_MB = 40;
const MAX_FILES = 5;

const PrintServicePage = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [supported, setSupported] = useState(['stl','obj','3mf','step','stp','ply','gcode','zip']);

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerNationalId: '',
    deliveryAddress: '',
    notes: '',
    material: 'PLA',
    colorMode: 'single',
    singleColor: '#dc2626',
    multiColorParts: [{ part: '', color: '#dc2626' }]
  });

  // Array of up to MAX_FILES uploaded files. Each entry:
  //   { name, size, type, dataUrl }
  const [files, setFiles] = useState([]);
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { requestNumber }
  const [showTerms, setShowTerms] = useState(false);

  // Fetch supported file extensions from public settings? The
  // supported list is on print3d settings, but there's no public
  // rates endpoint (admin-only). Fall back to the safe default above.
  useEffect(() => { /* no-op for now */ }, []);

  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Accept a FileList (or array) and add every valid file up to the
  // MAX_FILES ceiling. Rejects silently on empty input, toasts on
  // unsupported extension / oversize / limit-exceeded.
  const handleFiles = (list) => {
    const incoming = Array.from(list || []);
    if (incoming.length === 0) return;

    setFiles(prev => {
      const remainingSlots = MAX_FILES - prev.length;
      if (remainingSlots <= 0) {
        toast.warning(isRTL
          ? `الحد الأقصى ${MAX_FILES} ملفات — ضع الملفات الزائدة داخل مجلد وارفعها كملف مضغوط (.zip)`
          : `Max ${MAX_FILES} files — for more, please zip them together (.zip)`);
        return prev;
      }
      if (incoming.length > remainingSlots) {
        toast.warning(isRTL
          ? `تجاوزت الحد الأقصى (${MAX_FILES}) — سيتم رفع أول ${remainingSlots} ملفات فقط. للمزيد، اضغطها في ملف .zip`
          : `Over the ${MAX_FILES} limit — only the first ${remainingSlots} will be added. Zip the rest.`);
      }
      return prev;
    });

    // Filter + read outside the setState so async doesn't race.
    const remaining = MAX_FILES - files.length;
    const toAdd = incoming.slice(0, Math.max(0, remaining));
    for (const f of toAdd) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!supported.includes(ext)) {
        toast.error(isRTL
          ? `صيغة الملف .${ext} غير مدعومة — المدعوم: ${supported.join(', ').toUpperCase()}`
          : `.${ext} not supported. Supported: ${supported.join(', ').toUpperCase()}`);
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(isRTL
          ? `حجم "${f.name}" يجب أن يكون أقل من ${MAX_FILE_MB} ميجابايت`
          : `"${f.name}" must be under ${MAX_FILE_MB} MB`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setFiles(prev => {
          if (prev.length >= MAX_FILES) return prev;
          return [...prev, {
            name: f.name,
            size: f.size,
            type: ext,
            dataUrl: e.target.result
          }];
        });
      };
      reader.onerror = () => toast.error(isRTL ? `تعذّر قراءة "${f.name}"` : `Failed to read "${f.name}"`);
      reader.readAsDataURL(f);
    }
  };

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const addPart = () => setForm(f => ({
    ...f,
    multiColorParts: [...f.multiColorParts, { part: '', color: '#2563eb' }]
  }));
  const removePart = (idx) => setForm(f => ({
    ...f,
    multiColorParts: f.multiColorParts.filter((_, i) => i !== idx)
  }));
  const setPart = (idx, key, value) => setForm(f => ({
    ...f,
    multiColorParts: f.multiColorParts.map((p, i) => i === idx ? { ...p, [key]: value } : p)
  }));

  const canSubmit = useMemo(() => {
    if (!form.customerName.trim() || !form.customerPhone.trim() || !form.customerEmail.trim()) return false;
    if (files.length === 0) return false;
    if (!terms) return false;
    if (form.colorMode === 'multi') {
      const validParts = form.multiColorParts.filter(p => p.part.trim() && p.color.trim());
      if (validParts.length === 0) return false;
    }
    return true;
  }, [form, files, terms]);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error(isRTL ? 'يرجى تعبئة جميع الحقول المطلوبة' : 'Fill all required fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail.trim())) {
      toast.error(isRTL ? 'بريد إلكتروني غير صالح' : 'Invalid email');
      return;
    }
    setSubmitting(true);
    try {
      // Strip the data-URI prefix from each file — the server just
      // needs the raw base64 payload.
      const filesPayload = files.map(f => {
        const b64 = String(f.dataUrl).includes(',')
          ? String(f.dataUrl).split(',').pop()
          : f.dataUrl;
        return {
          fileName: f.name,
          fileType: f.type,
          fileSize: f.size,
          fileData: b64
        };
      });

      const payload = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim(),
        customerNationalId: form.customerNationalId.trim() || null,
        deliveryAddress: form.deliveryAddress.trim() || null,
        notes: form.notes.trim() || null,
        files: filesPayload,
        material: form.material,
        colorMode: form.colorMode,
        singleColor: form.colorMode === 'single' ? form.singleColor : null,
        multiColorParts: form.colorMode === 'multi'
          ? form.multiColorParts.filter(p => p.part.trim() && p.color.trim())
          : [],
        termsAccepted: true
      };

      const { data } = await axios.post(`${API_URL}/public/print3d`, payload);
      setResult({
        requestNumber: data.requestNumber,
        requestId: data.requestId
      });
      toast.success(isRTL ? 'تم استلام طلبك بنجاح' : 'Request received');
    } catch (err) {
      const body = err?.response?.data || {};
      toast.error(body.messageAr || body.message || (isRTL ? 'تعذّر إرسال الطلب' : 'Submit failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const fmtRequestNumber = (n) => `P3D-${String(n).padStart(4, '0')}`;

  if (result) {
    return (
      <div className="p3d" dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div
          className="p3d-success"
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="p3d-success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2>{isRTL ? 'تم استلام طلب الطباعة بنجاح' : 'Print request received'}</h2>
          <div className="p3d-success-number">
            <span>{isRTL ? 'رقم الطلب' : 'Request'}</span>
            <b>{fmtRequestNumber(result.requestNumber)}</b>
          </div>
          <p>
            {isRTL
              ? 'سنقوم بمراجعة الملف وإرسال عرض السعر إلى بريدك الإلكتروني قريباً. ستتمكن من الموافقة أو الرفض عبر الرابط في البريد.'
              : 'We will review the file and email you a quote shortly. You can accept or reject via the link in that email.'}
          </p>
          <div className="p3d-success-actions">
            <button type="button" onClick={() => navigate('/register')}>{isRTL ? 'الرئيسية' : 'Home'}</button>
            <button type="button" className="ghost" onClick={() => { setResult(null); setFiles([]); setTerms(false); setForm(f => ({ ...f, notes: '' })); }}>
              {isRTL ? 'طلب طباعة آخر' : 'Another request'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p3d" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Topbar */}
      <header className="p3d-topbar">
        <button type="button" className="p3d-brand" onClick={() => navigate('/register')}>
          <img src="/logo.png" alt="" />
          <div>
            <div className="p3d-brand-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</div>
            <div className="p3d-brand-sub">{isRTL ? 'خدمة الطباعة ثلاثية الأبعاد' : '3D Printing Service'}</div>
          </div>
        </button>
        <div className="p3d-topbar-actions">
          <button
            type="button"
            className="p3d-lang"
            onClick={() => i18n.changeLanguage(isRTL ? 'en' : 'ar')}
          >{isRTL ? 'EN' : 'ع'}</button>
          <button type="button" className="p3d-home" onClick={() => navigate('/register')}>
            {isRTL ? 'الرئيسية' : 'Home'}
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="p3d-hero">
        <div className="p3d-hero-inner">
          <span className="p3d-hero-eyebrow">
            {isRTL ? '🖨️ خدمة الطباعة ثلاثية الأبعاد' : '🖨️ 3D PRINTING SERVICE'}
          </span>
          <h1>{isRTL ? 'ارفع تصميمك — نطبعه لك بأعلى دقة' : 'Upload your design — we print it precisely'}</h1>
          <p>{isRTL
            ? 'ارفع ملف الطباعة، اختر الخامة واللون، وستصلك تكلفة الطباعة قبل البدء.'
            : 'Upload your file, pick material and color — we quote before printing.'}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="p3d-form">
        {/* SECTION: Personal Info */}
        <motion.section
          className="p3d-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        >
          <div className="p3d-card-head">
            <span className="p3d-step">1</span>
            <div>
              <h3>{isRTL ? 'البيانات الشخصية' : 'Your Information'}</h3>
              <p>{isRTL ? 'حتى نتواصل معك حول طلبك' : 'So we can reach you about your order'}</p>
            </div>
          </div>
          <div className="p3d-grid">
            <div className="p3d-field">
              <label>{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</label>
              <input type="text" value={form.customerName} onChange={e => patch('customerName', e.target.value)} required />
            </div>
            <div className="p3d-field">
              <label>{isRTL ? 'الجوال *' : 'Phone *'}</label>
              <input type="tel" dir="ltr" value={form.customerPhone} onChange={e => patch('customerPhone', e.target.value)} placeholder="05XXXXXXXX" required />
            </div>
            <div className="p3d-field">
              <label>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
              <input type="email" dir="ltr" value={form.customerEmail} onChange={e => patch('customerEmail', e.target.value)} placeholder="name@example.com" required />
            </div>
            <div className="p3d-field">
              <label>{isRTL ? 'رقم الهوية (اختياري)' : 'National ID (optional)'}</label>
              <input type="text" dir="ltr" value={form.customerNationalId} onChange={e => patch('customerNationalId', e.target.value)} />
            </div>
            <div className="p3d-field p3d-field--wide">
              <label>{isRTL ? 'عنوان التسليم (اختياري)' : 'Delivery Address (optional)'}</label>
              <input type="text" value={form.deliveryAddress} onChange={e => patch('deliveryAddress', e.target.value)} />
            </div>
          </div>
        </motion.section>

        {/* SECTION: File Upload */}
        <motion.section
          className="p3d-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="p3d-card-head">
            <span className="p3d-step">2</span>
            <div>
              <h3>{isRTL ? 'ملفات التصميم' : 'Design Files'}</h3>
              <p>
                {isRTL
                  ? `يمكنك رفع حتى ${MAX_FILES} ملفات — الصيغ المدعومة: `
                  : `Upload up to ${MAX_FILES} files — supported formats: `}
                <b>{supported.map(s => s.toUpperCase()).join(', ')}</b>
                {isRTL ? ` — الحد الأقصى ${MAX_FILE_MB} ميجا لكل ملف` : ` — max ${MAX_FILE_MB}MB per file`}
              </p>
              <p style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
                💡 {isRTL
                  ? `للأعمال التي تزيد عن ${MAX_FILES} ملفات، ضعها في مجلد وارفعها كملف مضغوط .zip`
                  : `Need more than ${MAX_FILES} files? Put them in a folder and upload as a .zip archive.`}
              </p>
            </div>
          </div>

          {/* List of already-added files */}
          {files.length > 0 && (
            <div className="p3d-file-list">
              <AnimatePresence initial={false}>
                {files.map((f, idx) => (
                  <motion.div
                    key={`${f.name}-${idx}`}
                    className="p3d-file"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <div className="p3d-file-icon">
                      {f.type === 'zip' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="12" x2="12" y2="18"/><line x1="10" y1="14" x2="14" y2="14"/><line x1="10" y1="16" x2="14" y2="16"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      )}
                    </div>
                    <div className="p3d-file-body">
                      <div className="p3d-file-name">{f.name}</div>
                      <div className="p3d-file-meta">
                        <span>{(f.size / 1024).toFixed(1)} KB</span>
                        <span>·</span>
                        <span className="p3d-file-ext">.{f.type}</span>
                      </div>
                    </div>
                    <button type="button" className="p3d-file-remove" onClick={() => removeFile(idx)}>
                      {isRTL ? 'حذف' : 'Remove'}
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Dropzone stays visible until MAX_FILES reached */}
          {files.length < MAX_FILES && (
            <label className="p3d-dropzone" style={files.length > 0 ? { marginTop: 12 } : undefined}>
              <input
                type="file"
                multiple
                accept={supported.map(s => `.${s}`).join(',')}
                onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="p3d-dropzone-title">
                {files.length === 0
                  ? (isRTL ? 'اضغط لرفع ملفات الطباعة' : 'Click to upload print files')
                  : (isRTL
                      ? `إضافة المزيد (${files.length}/${MAX_FILES})`
                      : `Add more (${files.length}/${MAX_FILES})`)}
              </span>
              <span className="p3d-dropzone-sub">
                {supported.map(s => `.${s}`).join(' · ')}
              </span>
            </label>
          )}
          {files.length >= MAX_FILES && (
            <div style={{
              marginTop: 12, padding: '12px 14px',
              background: 'rgba(14,165,233,0.08)',
              border: '1px solid rgba(14,165,233,0.28)',
              borderRadius: 10, fontSize: 13, color: '#0369a1',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>
                {isRTL
                  ? `تم بلوغ الحد الأقصى (${MAX_FILES} ملفات). احذف ملفاً لإضافة آخر، أو للمزيد اضغطها في ملف .zip.`
                  : `Reached the ${MAX_FILES}-file limit. Remove one to add more — or zip them all for a single upload.`}
              </span>
            </div>
          )}
        </motion.section>

        {/* SECTION: Material */}
        <motion.section
          className="p3d-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="p3d-card-head">
            <span className="p3d-step">3</span>
            <div>
              <h3>{isRTL ? 'الخامة' : 'Material'}</h3>
              <p>{isRTL ? 'اختر الخامة المناسبة لاستخدامك' : 'Pick the right material for your use'}</p>
            </div>
          </div>
          <div className="p3d-materials">
            {MATERIALS.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => patch('material', m.key)}
                className={`p3d-material ${form.material === m.key ? 'is-active' : ''}`}
              >
                <span className="p3d-material-badge">{m.key}</span>
                <span className="p3d-material-label">{isRTL ? m.labelAr : m.labelEn}</span>
                <span className="p3d-material-hint">{isRTL ? m.hintAr : m.hintEn}</span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* SECTION: Color */}
        <motion.section
          className="p3d-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
        >
          <div className="p3d-card-head">
            <span className="p3d-step">4</span>
            <div>
              <h3>{isRTL ? 'اللون' : 'Color'}</h3>
              <p>{isRTL ? 'اختر لوناً واحداً، أو حدد لوناً لكل جزء' : 'Pick one color or specify per-part colors'}</p>
            </div>
          </div>

          <div className="p3d-color-mode">
            <button type="button" className={`p3d-mode ${form.colorMode === 'single' ? 'is-active' : ''}`} onClick={() => patch('colorMode', 'single')}>
              {isRTL ? 'لون واحد' : 'Single color'}
            </button>
            <button type="button" className={`p3d-mode ${form.colorMode === 'multi' ? 'is-active' : ''}`} onClick={() => patch('colorMode', 'multi')}>
              {isRTL ? 'ألوان متعددة' : 'Multi-color'}
            </button>
          </div>

          {form.colorMode === 'single' ? (
            <div>
              <div className="p3d-palette">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c.hex + c.name}
                    type="button"
                    onClick={() => patch('singleColor', c.hex)}
                    className={`p3d-swatch ${form.singleColor === c.hex ? 'is-active' : ''}`}
                    style={{ background: c.hex, border: c.border ? '1px solid #d1d5db' : '1px solid transparent' }}
                    title={c.name}
                  >
                    {form.singleColor === c.hex && (
                      <svg viewBox="0 0 24 24" fill="none" stroke={['#ffffff','#facc15','#c0c0c0','#e5e7eb','#d4af37'].includes(c.hex) ? '#000' : '#fff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
                <label className="p3d-swatch-custom" title={isRTL ? 'لون مخصص' : 'Custom color'}>
                  <input type="color" value={form.singleColor} onChange={e => patch('singleColor', e.target.value)} />
                </label>
              </div>
              <div className="p3d-color-current">
                <span>{isRTL ? 'اللون المختار:' : 'Selected:'}</span>
                <span className="p3d-color-chip" style={{ background: form.singleColor }} />
                <b style={{ fontFamily: 'monospace' }}>{form.singleColor}</b>
              </div>
            </div>
          ) : (
            <div className="p3d-multi">
              <div className="p3d-multi-head">
                <span>#</span>
                <span>{isRTL ? 'اسم الجزء' : 'Part name'}</span>
                <span>{isRTL ? 'اللون' : 'Color'}</span>
                <span />
              </div>
              <AnimatePresence initial={false}>
                {form.multiColorParts.map((p, idx) => (
                  <motion.div
                    key={idx}
                    className="p3d-multi-row"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <span className="p3d-multi-idx">{idx + 1}</span>
                    <input
                      type="text"
                      value={p.part}
                      onChange={e => setPart(idx, 'part', e.target.value)}
                      placeholder={isRTL ? 'مثال: الجسم / الغطاء / الأزرار' : 'e.g., Body / Lid / Buttons'}
                    />
                    <div className="p3d-multi-color">
                      <label className="p3d-multi-chip" style={{ background: p.color }}>
                        <input type="color" value={p.color} onChange={e => setPart(idx, 'color', e.target.value)} />
                      </label>
                      <div className="p3d-multi-palette">
                        {COLOR_PALETTE.slice(0, 10).map(c => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => setPart(idx, 'color', c.hex)}
                            className={`p3d-swatch p3d-swatch--sm ${p.color === c.hex ? 'is-active' : ''}`}
                            style={{ background: c.hex, border: c.border ? '1px solid #d1d5db' : '1px solid transparent' }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p3d-multi-del"
                      onClick={() => removePart(idx)}
                      disabled={form.multiColorParts.length <= 1}
                      title={isRTL ? 'حذف' : 'Remove'}
                    >✕</button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <button type="button" className="p3d-multi-add" onClick={addPart}>
                + {isRTL ? 'إضافة جزء جديد' : 'Add another part'}
              </button>
            </div>
          )}
        </motion.section>

        {/* SECTION: Notes */}
        <motion.section
          className="p3d-card"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="p3d-card-head">
            <span className="p3d-step">5</span>
            <div>
              <h3>{isRTL ? 'ملاحظات إضافية' : 'Additional Notes'}</h3>
              <p>{isRTL ? 'أي تفاصيل تودّ إخبارنا بها (اختياري)' : 'Anything else we should know (optional)'}</p>
            </div>
          </div>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => patch('notes', e.target.value)}
            placeholder={isRTL ? 'مثال: أحتاج طباعة عالية الدقة، أو أفضّل جودة معينة...' : 'e.g., I need high-detail printing, or prefer a specific finish...'}
          />
        </motion.section>

        {/* SECTION: Terms & Submit */}
        <motion.section
          className="p3d-card p3d-card--action"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 }}
        >
          <label className="p3d-terms">
            <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>
              {isRTL ? 'أوافق على ' : 'I agree to the '}
              <button type="button" className="p3d-terms-link" onClick={() => setShowTerms(true)}>
                {isRTL ? 'الشروط والأحكام' : 'terms & conditions'}
              </button>
              {isRTL ? ' الخاصة بخدمة الطباعة ثلاثية الأبعاد' : ' of the 3D printing service'}
            </span>
          </label>

          <div className="p3d-quote-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>
              {isRTL
                ? 'سيتم حساب التكلفة تلقائياً بناءً على وزن التصميم والخامة وعدد الألوان، وستصلك على بريدك للموافقة أو الرفض قبل بدء الطباعة.'
                : 'Cost is auto-calculated from weight, material and color count. You will receive the quote by email to accept or reject before printing begins.'}
            </span>
          </div>

          <button
            type="submit"
            className="p3d-submit"
            disabled={!canSubmit || submitting}
          >
            {submitting
              ? (isRTL ? 'جاري الإرسال...' : 'Submitting...')
              : (isRTL ? 'إرسال طلب الطباعة' : 'Submit print request')}
          </button>
        </motion.section>
      </form>

      {/* Terms modal */}
      <AnimatePresence>
        {showTerms && (
          <motion.div
            className="p3d-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowTerms(false)}
          >
            <motion.div
              className="p3d-modal"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="p3d-modal-head">
                <h3>{isRTL ? 'الشروط والأحكام — خدمة الطباعة ثلاثية الأبعاد' : 'Terms & Conditions — 3D Printing Service'}</h3>
                <button type="button" onClick={() => setShowTerms(false)}>✕</button>
              </div>
              <div className="p3d-modal-body">
                {isRTL ? (
                  <ol>
                    <li><b>الملفات المدعومة:</b> يقبل النظام صيغ STL, OBJ, 3MF, STEP/STP, PLY, GCODE، بالإضافة إلى الملفات المضغوطة ZIP. الحد الأقصى {MAX_FILES} ملفات في الطلب الواحد، وحجم كل ملف لا يزيد عن {MAX_FILE_MB} ميجابايت. للأعمال الأكبر يرجى ضغط الملفات في مجلد واحد ورفعه كملف .zip.</li>
                    <li><b>عرض السعر:</b> يتم حساب التكلفة بناءً على الوزن التقديري للتصميم والخامة المختارة وعدد الألوان. يُرسل عرض السعر إلى بريدك الإلكتروني وسنبدأ الطباعة فقط بعد موافقتك الكتابية.</li>
                    <li><b>الحق في الرفض:</b> يحق لك رفض عرض السعر دون أي التزام مالي، كما يحق للفاب لاب رفض أي طلب يتعارض مع سياسات المنشأة.</li>
                    <li><b>المحتوى الفكري:</b> أنت مسؤول عن ملكية التصميم أو حصولك على إذن باستخدامه، ولا يتحمل الفاب لاب أي مسؤولية قانونية عن ملفات المستخدمين.</li>
                    <li><b>الجودة:</b> جودة الطباعة تعتمد على جودة الملف المرسل. لن يتم استرداد المبالغ في حال كانت مشاكل الطباعة ناتجة عن ملف تصميم غير صالح.</li>
                    <li><b>مدة التنفيذ:</b> تختلف مدة الطباعة حسب حجم وتعقيد التصميم، وسنتواصل معك لتحديد موعد الاستلام.</li>
                    <li><b>الدفع:</b> يتم الدفع نقداً عند الاستلام. ستُصدر فاتورة رسمية لكل طلب مكتمل.</li>
                    <li><b>الاستلام:</b> يجب استلام الطلب خلال 14 يوماً من إشعار الجاهزية، وبعدها لا يضمن الفاب لاب الاحتفاظ بالنسخة المطبوعة.</li>
                    <li><b>البيانات:</b> يتم حفظ ملفاتك بشكل آمن ولا تُشارك مع أي طرف ثالث. يمكنك طلب حذف ملفاتك في أي وقت.</li>
                    <li><b>التعديلات:</b> يحتفظ الفاب لاب بحق تحديث هذه الشروط في أي وقت.</li>
                  </ol>
                ) : (
                  <ol>
                    <li><b>Supported files:</b> STL, OBJ, 3MF, STEP/STP, PLY, GCODE, plus ZIP archives. Up to {MAX_FILES} files per request, each up to {MAX_FILE_MB}MB. For larger jobs, please put everything in a folder and upload it as a .zip.</li>
                    <li><b>Quote:</b> Cost is calculated from estimated weight, material and color count. You receive a quote by email and printing only begins after your written acceptance.</li>
                    <li><b>Right to refuse:</b> You may reject the quote with no obligation. FabLab may also decline any request that violates lab policies.</li>
                    <li><b>Intellectual property:</b> You are responsible for owning or licensing your design. FabLab assumes no legal responsibility for user-submitted files.</li>
                    <li><b>Quality:</b> Print quality depends on the source file. No refunds for issues caused by invalid design files.</li>
                    <li><b>Turnaround:</b> Time varies with size and complexity. We will contact you to arrange pickup.</li>
                    <li><b>Payment:</b> Cash on pickup. A formal invoice is issued for every completed order.</li>
                    <li><b>Pickup:</b> Please pick up within 14 days of the ready notification; after that we cannot guarantee holding your print.</li>
                    <li><b>Data:</b> Your files are stored securely and never shared. You can request deletion at any time.</li>
                    <li><b>Changes:</b> FabLab reserves the right to update these terms.</li>
                  </ol>
                )}
              </div>
              <div className="p3d-modal-foot">
                <button type="button" onClick={() => { setTerms(true); setShowTerms(false); }}>
                  {isRTL ? 'قبول والمتابعة' : 'Accept & continue'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PrintServicePage;
