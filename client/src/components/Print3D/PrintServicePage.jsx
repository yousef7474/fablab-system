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

const PrintServicePage = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [supported, setSupported] = useState(['stl','obj','3mf','step','stp','ply','gcode']);

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

  const [file, setFile] = useState(null); // { name, size, type, dataUrl }
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { requestNumber }
  const [showTerms, setShowTerms] = useState(false);

  // Fetch supported file extensions from public settings? The
  // supported list is on print3d settings, but there's no public
  // rates endpoint (admin-only). Fall back to the safe default above.
  useEffect(() => { /* no-op for now */ }, []);

  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (f) => {
    if (!f) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!supported.includes(ext)) {
      toast.error(isRTL
        ? `صيغة الملف .${ext} غير مدعومة — المدعوم: ${supported.join(', ').toUpperCase()}`
        : `.${ext} not supported. Supported: ${supported.join(', ').toUpperCase()}`);
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(isRTL
        ? `حجم الملف يجب أن يكون أقل من ${MAX_FILE_MB} ميجابايت`
        : `File must be under ${MAX_FILE_MB} MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setFile({
        name: f.name,
        size: f.size,
        type: ext,
        dataUrl: e.target.result
      });
    };
    reader.onerror = () => toast.error(isRTL ? 'تعذّر قراءة الملف' : 'Failed to read file');
    reader.readAsDataURL(f);
  };

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
    if (!file) return false;
    if (!terms) return false;
    if (form.colorMode === 'multi') {
      const validParts = form.multiColorParts.filter(p => p.part.trim() && p.color.trim());
      if (validParts.length === 0) return false;
    }
    return true;
  }, [form, file, terms]);

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
      // Strip the data-URI prefix — server only needs the base64 payload.
      const b64 = String(file.dataUrl).includes(',')
        ? String(file.dataUrl).split(',').pop()
        : file.dataUrl;

      const payload = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim(),
        customerNationalId: form.customerNationalId.trim() || null,
        deliveryAddress: form.deliveryAddress.trim() || null,
        notes: form.notes.trim() || null,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: b64,
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
            <button type="button" className="ghost" onClick={() => { setResult(null); setFile(null); setTerms(false); setForm(f => ({ ...f, notes: '' })); }}>
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
              <h3>{isRTL ? 'ملف التصميم' : 'Design File'}</h3>
              <p>
                {isRTL ? 'الصيغ المدعومة: ' : 'Supported formats: '}
                <b>{supported.map(s => s.toUpperCase()).join(', ')}</b>
                {isRTL ? ` — الحد الأقصى ${MAX_FILE_MB} ميجا` : ` — max ${MAX_FILE_MB}MB`}
              </p>
            </div>
          </div>

          {!file ? (
            <label className="p3d-dropzone">
              <input
                type="file"
                accept={supported.map(s => `.${s}`).join(',')}
                onChange={e => handleFile(e.target.files?.[0])}
              />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="p3d-dropzone-title">{isRTL ? 'اضغط لرفع ملف الطباعة' : 'Click to upload your file'}</span>
              <span className="p3d-dropzone-sub">
                {supported.map(s => `.${s}`).join(' · ')}
              </span>
            </label>
          ) : (
            <div className="p3d-file">
              <div className="p3d-file-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="p3d-file-body">
                <div className="p3d-file-name">{file.name}</div>
                <div className="p3d-file-meta">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  <span>·</span>
                  <span className="p3d-file-ext">.{file.type}</span>
                </div>
              </div>
              <button type="button" className="p3d-file-remove" onClick={() => setFile(null)}>
                {isRTL ? 'حذف' : 'Remove'}
              </button>
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
                    <li><b>الملفات المدعومة:</b> يقبل النظام صيغ STL, OBJ, 3MF, STEP/STP, PLY, GCODE فقط. الحد الأقصى لحجم الملف {MAX_FILE_MB} ميجابايت.</li>
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
                    <li><b>Supported files:</b> STL, OBJ, 3MF, STEP/STP, PLY, GCODE only. Max file size {MAX_FILE_MB}MB.</li>
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
