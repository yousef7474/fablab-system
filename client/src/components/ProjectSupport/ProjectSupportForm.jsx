import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
// The registration "studio" frame (rail, top bar, shared form controls).
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import './ProjectSupport.css';

// Public "طلب دعم للمشروع" form. Own standalone page (mirrors the
// FablabVisit / Print3D pattern) because the fields don't fit the
// beneficiary/visitor/volunteer register flow. Users submit personal
// info + a description + up to 10 attachments; the server emails a
// confirmation and lands the request in the admin panel for review.
//
// The page is closed to the public: it opens only with the access code
// the admin shares (typed in, or carried by the shared link as ?code=).
// The code buys a short-lived token kept for this tab; submit sends it.

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const TOKEN_KEY = 'psr_access_token';
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };

const MAX_FILES = 10;
const MAX_FILE_MB = 10;
const SUPPORTED_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'zip'];

// Colour family of an attachment's tile.
const kindFor = (ext) => {
  const e = String(ext || '').toLowerCase();
  if (['doc', 'docx'].includes(e)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'sheet';
  if (['ppt', 'pptx'].includes(e)) return 'slides';
  if (['pdf'].includes(e)) return 'pdf';
  if (['zip', 'rar', '7z'].includes(e)) return 'zip';
  if (['png', 'jpg', 'jpeg'].includes(e)) return 'image';
  return 'file';
};
const humanBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};
// File → { fileData (base64), fileName, fileType, fileSize }
const readAsFilePayload = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const raw = String(reader.result || '');
    const i = raw.indexOf(',');
    const b64 = i >= 0 ? raw.slice(i + 1) : raw;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    resolve({
      fileData: b64,
      fileName: file.name,
      fileType: ext,
      fileSize: file.size
    });
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const IC = {
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  bulb: ['M9 18h6', 'M10 22h4', 'M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z'],
  clip: ['M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  mail: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  plus: ['M12 5v14', 'M5 12h14'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  arrow: ['M5 12h14', 'M12 5l7 7-7 7'],
  money: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  tool: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  box: ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96 12 12.01l8.73-5.05', 'M12 22.08V12'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 13h5'],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z']
};

const SUPPORT_TYPES = [
  { value: 'funding',    ar: 'دعم مالي',        en: 'Funding',     d: IC.money },
  { value: 'tech',       ar: 'دعم تقني',        en: 'Technical',   d: IC.tool },
  { value: 'materials',  ar: 'مواد وأجهزة',     en: 'Materials',   d: IC.box },
  { value: 'mentorship', ar: 'توجيه واستشارة',  en: 'Mentorship',  d: IC.chat },
  { value: 'other',      ar: 'غير ذلك',         en: 'Other',       d: IC.target }
];
const FEATURES = [
  { ar: 'دعم مالي وتقني ومواد واستشارات', en: 'Funding, technical help, materials, mentoring', d: IC.bulb },
  { ar: `أرفق حتى ${MAX_FILES} ملفات داعمة`, en: `Attach up to ${MAX_FILES} supporting files`, d: IC.clip },
  { ar: 'رد خلال 5 أيام عمل عبر البريد', en: 'An answer by email within 5 working days', d: IC.mail }
];
const blankForm = () => ({
  firstName: '',
  lastName: '',
  sex: '',
  nationality: '',
  nationalId: '',
  phoneNumber: '',
  email: '',
  age: '',
  city: '',
  projectTitle: '',
  // Multiple support types can be selected — many requesters need
  // help across categories (e.g. funding + mentorship).
  supportTypes: [],
  description: ''
});

const ProjectSupportForm = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [theme, toggleTheme] = useStudioTheme();

  const [form, setForm] = useState(blankForm);
  const [files, setFiles] = useState([]); // [{ fileName, fileType, fileSize, fileData }]
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { requestNumber }
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [accessToken, setAccessToken] = useState(readToken);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [checking, setChecking] = useState(false);

  const unlock = async (code) => {
    setChecking(true);
    setCodeError('');
    try {
      const { data } = await axios.post(`${API_URL}/public/project-support/access`, { code });
      try { sessionStorage.setItem(TOKEN_KEY, data.token); } catch {}
      setAccessToken(data.token);
    } catch (err) {
      const d = err?.response?.data;
      setCodeError((isRTL ? d?.messageAr : d?.message) || (isRTL ? 'تعذّر التحقق — حاول مجدداً' : 'Could not verify — please retry'));
    } finally {
      setChecking(false);
    }
  };

  // The admin's share link carries the code (?code=…) — open directly
  // and drop it from the address bar.
  useEffect(() => {
    const c = searchParams.get('code');
    if (!c) return;
    searchParams.delete('code');
    setSearchParams(searchParams, { replace: true });
    setCodeInput(c.toUpperCase());
    unlock(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFiles = async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    if (files.length + incoming.length > MAX_FILES) {
      toast.warn(isRTL
        ? `الحد الأقصى ${MAX_FILES} ملفات (لديك ${files.length} حالياً)`
        : `Max ${MAX_FILES} files (you have ${files.length} already)`);
      return;
    }
    const kept = [];
    for (const f of incoming) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      if (!SUPPORTED_EXTS.includes(ext)) {
        toast.error(isRTL
          ? `صيغة غير مدعومة: ${f.name}`
          : `Unsupported: ${f.name}`);
        continue;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(isRTL
          ? `الملف كبير جداً (الحد ${MAX_FILE_MB} MB): ${f.name}`
          : `File too large (max ${MAX_FILE_MB} MB): ${f.name}`);
        continue;
      }
      try {
        const payload = await readAsFilePayload(f);
        kept.push(payload);
      } catch {
        toast.error(isRTL ? `تعذر قراءة الملف: ${f.name}` : `Failed to read: ${f.name}`);
      }
    }
    if (kept.length) setFiles(prev => [...prev, ...kept]);
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    // Basic validation
    if (!form.firstName.trim()) return toast.error(isRTL ? 'أدخل الاسم' : 'Enter first name');
    if (!/^\d{7,}$/.test(form.nationalId.trim())) return toast.error(isRTL ? 'رقم هوية غير صحيح' : 'Invalid national ID');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return toast.error(isRTL ? 'بريد إلكتروني غير صحيح' : 'Invalid email');
    if (!/^[0-9+\-\s()]{9,}$/.test(form.phoneNumber.trim())) return toast.error(isRTL ? 'رقم جوال غير صحيح' : 'Invalid phone');
    if (form.description.trim().length < 20) return toast.error(isRTL ? 'الوصف قصير جداً — اكتب تفاصيل أكثر' : 'Description too short — add more detail');
    if (!terms) return toast.error(isRTL ? 'يرجى الموافقة على الشروط' : 'Please accept the terms');

    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/public/project-support/submit`, {
        ...form,
        age: form.age ? Number(form.age) : null,
        files,
        accessToken
      });
      setResult({ requestNumber: data.requestNumber || 'PSR-—' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      // Code changed or the token expired — back to the code screen;
      // what was typed in the form stays.
      if (err?.response?.data?.code === 'PSR_ACCESS_REQUIRED') {
        try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
        setAccessToken('');
        setCodeError(isRTL ? err.response.data.messageAr : err.response.data.message);
        return;
      }
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'تعذّر إرسال الطلب — حاول مجدداً' : 'Submit failed — please retry'));
    } finally {
      setSubmitting(false);
    }
  };

  const shellProps = {
    isRTL,
    theme,
    onToggleTheme: toggleTheme,
    servicesHref: '/register',
    subtitle: isRTL ? 'طلب دعم للمشروع' : 'Project support request',
    intro: {
      portal: isRTL ? 'طلب دعم للمشروع' : 'Project support',
      title: isRTL ? <>من فكرة مشروعك<br /><em>إلى دعم يحققها</em></> : <>From your project idea<br /><em>to the support it needs</em></>,
      features: FEATURES
    }
  };

  const hero = (title, text) => (
    <motion.div
      className="rgx-hero psr-hero"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <p className="rgx-eyebrow"><i aria-hidden="true" />{isRTL ? 'طلب دعم للمشروع' : 'Project support request'}</p>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </motion.div>
  );

  const secHead = (n, title, desc, done) => (
    <header className="psr-sec-head">
      <span className={`psr-sec-n ${done ? 'is-done' : ''}`}>{done ? <Icon d={IC.check} /> : String(n).padStart(2, '0')}</span>
      <div>
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
    </header>
  );
  const req = <span className="required">*</span>;

  // ─────────────── Access code screen ───────────────
  if (!accessToken && !result) {
    return (
      <StudioShell {...shellProps}>
        {hero(isRTL ? <>طلب دعم للمشروع — <em>برمز دخول</em></> : <>Project support — <em>by access code</em></>)}
        <motion.form
          className="rgx-card psr-gate"
          onSubmit={(e) => { e.preventDefault(); unlock(codeInput); }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span className="psr-gate-ico"><Icon d={IC.lock} /></span>
          <h2>{isRTL ? 'أدخل رمز الدخول' : 'Enter your access code'}</h2>
          <p className="psr-gate-text">
            {isRTL
              ? 'هذه الصفحة مغلقة، ولا يمكن تقديم طلب دعم إلا برمز دخول تزوّدك به إدارة فاب لاب الأحساء. أدخل الرمز للمتابعة.'
              : 'This page is closed. A support request can only be submitted with an access code from the FabLab Al-Ahsa team. Enter it to continue.'}
          </p>
          <input
            className={`form-input psr-code ${codeError ? 'has-error' : ''}`}
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
            placeholder={isRTL ? 'رمز الدخول' : 'Access code'}
            aria-label={isRTL ? 'رمز الدخول' : 'Access code'}
            aria-invalid={!!codeError}
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            dir="ltr"
            autoFocus
          />
          {codeError && <div className="psr-gate-error" role="alert">{codeError}</div>}
          <button type="submit" className="btn btn-primary psr-gate-btn" disabled={!codeInput.trim() || checking}>
            {checking
              ? <><span className="loading-spinner" />{isRTL ? 'جارٍ التحقق…' : 'Checking…'}</>
              : <>{isRTL ? 'متابعة' : 'Continue'}<Icon d={IC.arrow} /></>}
          </button>
          <p className="psr-gate-note">
            {isRTL ? 'ليس لديك رمز؟ تواصل مع فاب لاب الأحساء.' : "Don't have a code? Contact FabLab Al-Ahsa."}
          </p>
        </motion.form>
      </StudioShell>
    );
  }

  // ─────────────── Success screen ───────────────
  if (result) {
    return (
      <StudioShell {...shellProps}>
        <motion.section
          className="rgx-card psr-done"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.span className="psr-done-ico" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }}>
            <Icon d={IC.check} />
          </motion.span>
          <h2>{isRTL ? 'تم استلام طلبك بنجاح' : 'Request submitted successfully'}</h2>
          <div className="psr-done-id">
            <small>{isRTL ? 'رقم الطلب' : 'Request number'}</small>
            <b dir="ltr">{result.requestNumber}</b>
          </div>
          <p className="psr-done-text">
            {isRTL
              ? 'شكراً لك — سيتم مراجعة طلبك من قبل إدارة فاب لاب والرد عليك عبر بريدك الإلكتروني خلال أقصى مدة'
              : 'Thanks — our team will review your request and reply to your email within a maximum of'} <b>5</b> {isRTL ? 'أيام عمل.' : 'working days.'}
          </p>
          <div className="psr-done-note">
            <Icon d={IC.mail} />
            <span>
              {isRTL ? 'تم إرسال بريد التأكيد إلى:' : 'A confirmation email was sent to:'} <b dir="ltr">{form.email}</b>
            </span>
          </div>
          <div className="rgx-closed-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setResult(null);
                setForm(blankForm());
                setFiles([]);
                setTerms(false);
              }}
            >
              <Icon d={IC.plus} />{isRTL ? 'تقديم طلب آخر' : 'Submit another'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/register')}>
              <Icon d={IC.grid} />{isRTL ? 'كل الخدمات' : 'All services'}
            </button>
          </div>
        </motion.section>
      </StudioShell>
    );
  }

  const descLen = form.description.trim().length;
  const personalDone = !!(form.firstName.trim() && /^\d{7,}$/.test(form.nationalId.trim())
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && /^[0-9+\-\s()]{9,}$/.test(form.phoneNumber.trim()));

  return (
    <StudioShell {...shellProps}>
      {hero(
        isRTL ? <>نستقبل طلبك — <em>ونرد خلال 5 أيام عمل</em></> : <>We take your request — <em>and reply within 5 working days</em></>,
        isRTL
          ? 'إذا كنت تسعى للحصول على دعم مالي، تقني، أو استشاري لمشروعك، عبّئ النموذج وأرفق الملفات الداعمة (وصف المشروع، ميزانية، صور، دراسات...) وسنراجعه ونرد عليك.'
          : "If you're seeking funding, technical help, or advice for your project, fill this form and attach supporting files (project brief, budget, photos, studies…) — we'll review and reply."
      )}

      <motion.form
        className="rgx-card psr"
        onSubmit={submit}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* Personal info */}
        <section className="psr-sec">
          {secHead(1, isRTL ? 'البيانات الشخصية' : 'Personal info', isRTL ? 'نحتاجها للتواصل معك بشأن الطلب.' : 'So we can reach out about your request.', personalDone)}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="psr-first">{isRTL ? 'الاسم الأول' : 'First name'} {req}</label>
              <input id="psr-first" className="form-input" value={form.firstName} onChange={(e) => patch('firstName', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="psr-last">{isRTL ? 'اسم العائلة' : 'Last name'}</label>
              <input id="psr-last" className="form-input" value={form.lastName} onChange={(e) => patch('lastName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="psr-sex">{isRTL ? 'الجنس' : 'Gender'}</label>
              <select id="psr-sex" className="form-select" value={form.sex} onChange={(e) => patch('sex', e.target.value)}>
                <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="psr-nat">{isRTL ? 'الجنسية' : 'Nationality'}</label>
              <input id="psr-nat" className="form-input" value={form.nationality} onChange={(e) => patch('nationality', e.target.value)} placeholder={isRTL ? 'مثال: سعودي' : 'e.g. Saudi'} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="psr-nid">{isRTL ? 'رقم الهوية' : 'National ID'} {req}</label>
              <input id="psr-nid" className="form-input" value={form.nationalId} onChange={(e) => patch('nationalId', e.target.value.replace(/\D/g, ''))} dir="ltr" inputMode="numeric" maxLength={15} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="psr-age">{isRTL ? 'العمر' : 'Age'}</label>
              <input id="psr-age" className="form-input" type="number" min="1" max="120" value={form.age} onChange={(e) => patch('age', e.target.value)} dir="ltr" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="psr-phone">{isRTL ? 'رقم الجوال' : 'Phone'} {req}</label>
              <input id="psr-phone" className="form-input" type="tel" value={form.phoneNumber} onChange={(e) => patch('phoneNumber', e.target.value)} dir="ltr" placeholder="05xxxxxxxx" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="psr-email">{isRTL ? 'البريد الإلكتروني' : 'Email'} {req}</label>
              <input id="psr-email" className="form-input" type="email" value={form.email} onChange={(e) => patch('email', e.target.value)} dir="ltr" placeholder="you@example.com" required />
            </div>
            <div className="form-group full-width">
              <label className="form-label" htmlFor="psr-city">{isRTL ? 'المدينة' : 'City'}</label>
              <input id="psr-city" className="form-input" value={form.city} onChange={(e) => patch('city', e.target.value)} placeholder={isRTL ? 'مثال: الأحساء' : 'e.g. Al-Ahsa'} />
            </div>
          </div>
        </section>

        {/* Project + support type */}
        <section className="psr-sec">
          {secHead(2, isRTL ? 'عن المشروع ونوع الدعم' : 'About the project', isRTL ? 'اكتب فكرة مشروعك ونوع الدعم المطلوب.' : 'Describe your project and pick the kind of support you need.', descLen >= 20)}
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label" htmlFor="psr-title">{isRTL ? 'اسم / عنوان المشروع' : 'Project title'}</label>
              <input id="psr-title" className="form-input" value={form.projectTitle} onChange={(e) => patch('projectTitle', e.target.value)} placeholder={isRTL ? 'مثال: صندوق ذكي للتبرع بالطعام' : 'e.g. Smart Food Donation Box'} />
            </div>
            <div className="form-group full-width" role="group" aria-labelledby="psr-types-label">
              <span className="form-label" id="psr-types-label">{isRTL ? 'نوع الدعم المطلوب' : 'Support type'}</span>
              <div className="psr-types">
                {SUPPORT_TYPES.map(st => {
                  const selected = form.supportTypes.includes(st.value);
                  return (
                    <button
                      type="button"
                      key={st.value}
                      className={`psr-type ${selected ? 'is-on' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setForm(f => ({
                        ...f,
                        supportTypes: selected
                          ? f.supportTypes.filter(v => v !== st.value)
                          : [...f.supportTypes, st.value]
                      }))}
                    >
                      <span className="psr-type-ico"><Icon d={selected ? IC.check : st.d} /></span>
                      {isRTL ? st.ar : st.en}
                    </button>
                  );
                })}
              </div>
              <span className="psr-hint">
                {isRTL
                  ? `اختر جميع الأنواع التي تحتاجها (يمكنك اختيار أكثر من نوع) — تم اختيار ${form.supportTypes.length}.`
                  : `Pick every kind you need (multi-select) — ${form.supportTypes.length} selected.`}
              </span>
            </div>
            <div className="form-group full-width">
              <label className="form-label" htmlFor="psr-desc">
                {isRTL ? 'وصف الطلب' : 'Description'} {req}
                <span className="psr-label-sub">{isRTL ? ' — تفاصيل المشروع، الأهداف، وما تحتاجه من فاب لاب' : ' — project details, goals, and what you need from FabLab'}</span>
              </label>
              <textarea
                id="psr-desc"
                className="form-textarea psr-desc"
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
                rows={6}
                placeholder={isRTL
                  ? 'اكتب بالتفصيل: فكرة المشروع، الفئة المستهدفة، ما أنجزت حتى الآن، الميزانية إن وجدت، ونوع الدعم المطلوب من فاب لاب...'
                  : 'Explain in detail: idea, target audience, what you have already done, budget if any, and what you need from FabLab...'}
                required
                minLength={20}
              />
              <span className={`psr-count ${descLen < 20 ? 'is-short' : 'is-ok'}`}>
                <Icon d={descLen < 20 ? IC.clock : IC.check} />
                {descLen < 20
                  ? (isRTL ? `اكتب على الأقل 20 حرفاً (الآن ${descLen})` : `At least 20 chars (currently ${descLen})`)
                  : (isRTL ? `${descLen} حرف` : `${descLen} chars`)}
              </span>
            </div>
          </div>
        </section>

        {/* Files */}
        <section className="psr-sec">
          {secHead(3, isRTL ? 'الملفات المرفقة' : 'Attachments',
            isRTL
              ? `أرفق حتى ${MAX_FILES} ملفات (Word / Excel / PDF / PowerPoint / صور / ZIP) — الحد الأقصى ${MAX_FILE_MB} MB لكل ملف.`
              : `Attach up to ${MAX_FILES} files (Word / Excel / PDF / PowerPoint / images / ZIP) — ${MAX_FILE_MB} MB max each.`,
            false)}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          <div
            className={`psr-drop ${dragging ? 'is-drag' : ''} ${files.length >= MAX_FILES ? 'is-full' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <span className="psr-drop-ico"><Icon d={IC.upload} /></span>
            <span className="psr-drop-text">
              <b>{isRTL ? 'اسحب الملفات هنا أو اضغط للاختيار' : 'Drop files here or click to browse'}</b>
              <small>{SUPPORTED_EXTS.join(' · ').toUpperCase()}</small>
            </span>
            <span className="psr-drop-count" dir="ltr">{files.length}/{MAX_FILES}</span>
          </div>

          {files.length > 0 && (
            <ul className="psr-files">
              {files.map((f, i) => (
                <li key={`${f.fileName}-${i}`}>
                  <span className={`psr-file-ico k-${kindFor(f.fileType)}`}>{String(f.fileType || '').slice(0, 4).toUpperCase()}</span>
                  <span className="psr-file-name"><bdi>{f.fileName}</bdi></span>
                  <span className="psr-file-size" dir="ltr">{humanBytes(f.fileSize)}</span>
                  <button type="button" className="psr-file-remove" onClick={() => removeFile(i)} title={isRTL ? 'حذف' : 'Remove'} aria-label={isRTL ? `حذف ${f.fileName}` : `Remove ${f.fileName}`}>
                    <Icon d={IC.x} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Terms + submit */}
        <section className="psr-sec psr-submit">
          <label className={`rgx-ack ${terms ? 'is-on' : ''}`}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              {isRTL
                ? 'أوافق على معالجة بياناتي ومراجعة طلبي من قبل إدارة فاب لاب الأحساء، وسيتم الرد عليّ خلال 5 أيام عمل عبر البريد الإلكتروني.'
                : 'I agree to have my data processed and reviewed by FABLAB Al-Ahsa. I will receive a decision by email within 5 working days.'}
            </span>
          </label>
          <div className="form-navigation">
            <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
              {submitting
                ? <><span className="loading-spinner" />{isRTL ? 'جاري الإرسال...' : 'Submitting...'}</>
                : <><Icon d={IC.send} />{isRTL ? 'إرسال طلب الدعم' : 'Submit support request'}</>}
            </button>
          </div>
        </section>
      </motion.form>
    </StudioShell>
  );
};

export default ProjectSupportForm;
