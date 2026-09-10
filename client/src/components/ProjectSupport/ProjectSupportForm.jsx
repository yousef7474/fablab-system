import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import './ProjectSupport.css';

// Public "طلب دعم للمشروع" form. Own standalone page (mirrors the
// FablabVisit / Print3D pattern) because the fields don't fit the
// beneficiary/visitor/volunteer register flow. Users submit personal
// info + a description + up to 10 attachments; the server emails a
// confirmation and lands the request in the admin panel for review.

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const MAX_FILES = 10;
const MAX_FILE_MB = 10;
const SUPPORTED_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'zip'];

const iconFor = (ext) => {
  const e = String(ext || '').toLowerCase();
  if (['doc', 'docx'].includes(e)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📊';
  if (['ppt', 'pptx'].includes(e)) return '📽️';
  if (['pdf'].includes(e)) return '📕';
  if (['zip', 'rar', '7z'].includes(e)) return '📦';
  if (['png', 'jpg', 'jpeg'].includes(e)) return '🖼️';
  return '📎';
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

const SUPPORT_TYPES = [
  { value: 'funding',    ar: '💰 دعم مالي',      en: '💰 Funding' },
  { value: 'tech',       ar: '🛠 دعم تقني',      en: '🛠 Technical' },
  { value: 'materials',  ar: '📦 مواد وأجهزة',   en: '📦 Materials' },
  { value: 'mentorship', ar: '👨‍🏫 توجيه واستشارة', en: '👨‍🏫 Mentorship' },
  { value: 'other',      ar: '🎯 غير ذلك',        en: '🎯 Other' }
];

const ProjectSupportForm = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [form, setForm] = useState({
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
    supportType: '',
    description: ''
  });
  const [files, setFiles] = useState([]); // [{ fileName, fileType, fileSize, fileData }]
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { requestNumber }
  const fileInputRef = useRef(null);

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
        files
      });
      setResult({ requestNumber: data.requestNumber || 'PSR-—' });
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'تعذّر إرسال الطلب — حاول مجدداً' : 'Submit failed — please retry'));
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────── Success screen ───────────────
  if (result) {
    return (
      <div className="psr" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="psr-container">
          <motion.div
            className="psr-success"
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 22 }}
          >
            <div className="psr-success-icon">✓</div>
            <h1>{isRTL ? 'تم استلام طلبك بنجاح' : 'Request submitted successfully'}</h1>
            <div className="psr-success-num">{result.requestNumber}</div>
            <p>
              {isRTL
                ? 'شكراً لك — سيتم مراجعة طلبك من قبل إدارة فاب لاب والرد عليك عبر بريدك الإلكتروني خلال أقصى مدة'
                : 'Thanks — our team will review your request and reply to your email within a maximum of'} <b>5</b> {isRTL ? 'أيام عمل.' : 'working days.'}
            </p>
            <div className="psr-success-note">
              📧 {isRTL
                ? 'تم إرسال بريد التأكيد إلى:'
                : 'A confirmation email was sent to:'} <b dir="ltr">{form.email}</b>
            </div>
            <div className="psr-success-actions">
              <button type="button" className="psr-btn primary" onClick={() => navigate('/register')}>
                {isRTL ? 'العودة للرئيسية' : 'Back to home'}
              </button>
              <button
                type="button"
                className="psr-btn ghost"
                onClick={() => {
                  setResult(null);
                  setForm({
                    firstName: '', lastName: '', sex: '', nationality: '',
                    nationalId: '', phoneNumber: '', email: '', age: '', city: '',
                    projectTitle: '', supportType: '', description: ''
                  });
                  setFiles([]);
                  setTerms(false);
                }}
              >
                {isRTL ? 'تقديم طلب آخر' : 'Submit another'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="psr" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <header className="psr-topbar">
        <button type="button" className="psr-brand" onClick={() => navigate('/register')}>
          <img src="/logo.png" alt="" />
          <div>
            <div className="psr-brand-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</div>
            <div className="psr-brand-sub">{isRTL ? 'طلب دعم للمشروع' : 'Project Support Request'}</div>
          </div>
        </button>
        <div className="psr-topbar-actions">
          <button
            type="button"
            className="psr-lang"
            onClick={() => i18n.changeLanguage(isRTL ? 'en' : 'ar')}
          >{isRTL ? 'EN' : 'ع'}</button>
          <button type="button" className="psr-home" onClick={() => navigate('/register')}>
            {isRTL ? 'الرئيسية' : 'Home'}
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="psr-hero">
        <div className="psr-hero-inner">
          <span className="psr-hero-eyebrow">
            {isRTL ? '💜 طلب دعم للمشروع' : '💜 PROJECT SUPPORT REQUEST'}
          </span>
          <h1>{isRTL ? 'نستقبل طلبك — نرد خلال 5 أيام عمل' : 'We accept your request — reply within 5 working days'}</h1>
          <p>
            {isRTL
              ? 'إذا كنت تسعى للحصول على دعم مالي، تقني، أو استشاري لمشروعك، عبّئ النموذج وأرفق الملفات الداعمة (وصف المشروع، ميزانية، صور، دراسات...) وسنراجعه ونرد عليك.'
              : "If you're seeking funding, technical help, or advice for your project, fill this form and attach supporting files (project brief, budget, photos, studies…) — we'll review and reply."}
          </p>
        </div>
      </div>

      <form className="psr-form" onSubmit={submit}>
        {/* Personal info */}
        <motion.section
          className="psr-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="psr-card-head">
            <div className="psr-card-index">1</div>
            <div>
              <h2>{isRTL ? 'البيانات الشخصية' : 'Personal Info'}</h2>
              <p>{isRTL ? 'نحتاجها للتواصل معك بشأن الطلب.' : 'So we can reach out about your request.'}</p>
            </div>
          </div>
          <div className="psr-grid">
            <label className="psr-field">
              <span>{isRTL ? 'الاسم الأول *' : 'First name *'}</span>
              <input value={form.firstName} onChange={(e) => patch('firstName', e.target.value)} required />
            </label>
            <label className="psr-field">
              <span>{isRTL ? 'اسم العائلة' : 'Last name'}</span>
              <input value={form.lastName} onChange={(e) => patch('lastName', e.target.value)} />
            </label>
            <label className="psr-field">
              <span>{isRTL ? 'الجنس' : 'Gender'}</span>
              <select value={form.sex} onChange={(e) => patch('sex', e.target.value)}>
                <option value="">—</option>
                <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
              </select>
            </label>
            <label className="psr-field">
              <span>{isRTL ? 'الجنسية' : 'Nationality'}</span>
              <input value={form.nationality} onChange={(e) => patch('nationality', e.target.value)} placeholder={isRTL ? 'مثال: سعودي' : 'e.g. Saudi'} />
            </label>
            <label className="psr-field">
              <span>{isRTL ? 'رقم الهوية *' : 'National ID *'}</span>
              <input value={form.nationalId} onChange={(e) => patch('nationalId', e.target.value.replace(/\D/g, ''))} dir="ltr" maxLength={15} required />
            </label>
            <label className="psr-field">
              <span>{isRTL ? 'العمر' : 'Age'}</span>
              <input type="number" min="1" max="120" value={form.age} onChange={(e) => patch('age', e.target.value)} />
            </label>
            <label className="psr-field">
              <span>{isRTL ? 'رقم الجوال *' : 'Phone *'}</span>
              <input value={form.phoneNumber} onChange={(e) => patch('phoneNumber', e.target.value)} dir="ltr" placeholder="05xxxxxxxx" required />
            </label>
            <label className="psr-field">
              <span>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</span>
              <input type="email" value={form.email} onChange={(e) => patch('email', e.target.value)} dir="ltr" placeholder="you@example.com" required />
            </label>
            <label className="psr-field" style={{ gridColumn: 'span 2' }}>
              <span>{isRTL ? 'المدينة' : 'City'}</span>
              <input value={form.city} onChange={(e) => patch('city', e.target.value)} placeholder={isRTL ? 'مثال: الأحساء' : 'e.g. Al-Ahsa'} />
            </label>
          </div>
        </motion.section>

        {/* Project + support type */}
        <motion.section
          className="psr-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="psr-card-head">
            <div className="psr-card-index">2</div>
            <div>
              <h2>{isRTL ? 'عن المشروع ونوع الدعم' : 'About the Project'}</h2>
              <p>{isRTL ? 'اكتب فكرة مشروعك ونوع الدعم المطلوب.' : 'Describe your project and pick the kind of support you need.'}</p>
            </div>
          </div>
          <div className="psr-grid">
            <label className="psr-field" style={{ gridColumn: 'span 2' }}>
              <span>{isRTL ? 'اسم / عنوان المشروع' : 'Project title'}</span>
              <input value={form.projectTitle} onChange={(e) => patch('projectTitle', e.target.value)} placeholder={isRTL ? 'مثال: صندوق ذكي للتبرع بالطعام' : 'e.g. Smart Food Donation Box'} />
            </label>
            <label className="psr-field" style={{ gridColumn: 'span 2' }}>
              <span>{isRTL ? 'نوع الدعم المطلوب' : 'Support type'}</span>
              <div className="psr-support-types">
                {SUPPORT_TYPES.map(st => (
                  <button
                    type="button"
                    key={st.value}
                    className={`psr-support-chip ${form.supportType === st.value ? 'active' : ''}`}
                    onClick={() => patch('supportType', form.supportType === st.value ? '' : st.value)}
                  >
                    {isRTL ? st.ar : st.en}
                  </button>
                ))}
              </div>
            </label>
            <label className="psr-field" style={{ gridColumn: 'span 2' }}>
              <span>{isRTL ? 'وصف الطلب * — تفاصيل المشروع، الأهداف، وما تحتاجه من فاب لاب' : 'Description * — project details, goals, and what you need from FabLab'}</span>
              <textarea
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
                rows={6}
                placeholder={isRTL
                  ? 'اكتب بالتفصيل: فكرة المشروع، الفئة المستهدفة، ما أنجزت حتى الآن، الميزانية إن وجدت، ونوع الدعم المطلوب من فاب لاب...'
                  : 'Explain in detail: idea, target audience, what you have already done, budget if any, and what you need from FabLab...'}
                required
                minLength={20}
              />
              <span className="psr-hint">
                {form.description.trim().length < 20
                  ? (isRTL ? `⚠️ اكتب على الأقل 20 حرفاً (الآن ${form.description.trim().length})` : `⚠️ At least 20 chars (currently ${form.description.trim().length})`)
                  : (isRTL ? `✓ ${form.description.trim().length} حرف` : `✓ ${form.description.trim().length} chars`)}
              </span>
            </label>
          </div>
        </motion.section>

        {/* Files */}
        <motion.section
          className="psr-card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.10 }}
        >
          <div className="psr-card-head">
            <div className="psr-card-index">3</div>
            <div>
              <h2>{isRTL ? 'الملفات المرفقة' : 'Attachments'}</h2>
              <p>
                {isRTL
                  ? `أرفق حتى ${MAX_FILES} ملفات (Word / Excel / PDF / PowerPoint / صور / ZIP) — الحد الأقصى ${MAX_FILE_MB} MB لكل ملف.`
                  : `Attach up to ${MAX_FILES} files (Word / Excel / PDF / PowerPoint / images / ZIP) — ${MAX_FILE_MB} MB max each.`}
              </p>
            </div>
          </div>

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
            className="psr-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('is-drag'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('is-drag')}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('is-drag');
              handleFiles(e.dataTransfer.files);
            }}
          >
            <div className="psr-dropzone-icon">📎</div>
            <div className="psr-dropzone-title">
              {isRTL ? 'اسحب الملفات هنا أو اضغط للاختيار' : 'Drop files here or click to browse'}
            </div>
            <div className="psr-dropzone-hint">
              {files.length}/{MAX_FILES} · {SUPPORTED_EXTS.join(' · ').toUpperCase()}
            </div>
          </div>

          {files.length > 0 && (
            <ul className="psr-file-list">
              {files.map((f, i) => (
                <li key={`${f.fileName}-${i}`}>
                  <span className="psr-file-icon">{iconFor(f.fileType)}</span>
                  <span className="psr-file-name">{f.fileName}</span>
                  <span className="psr-file-size">{humanBytes(f.fileSize)}</span>
                  <button type="button" className="psr-file-remove" onClick={() => removeFile(i)} title={isRTL ? 'حذف' : 'Remove'}>×</button>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* Terms + submit */}
        <motion.section
          className="psr-card psr-card--submit"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <label className="psr-terms">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>
              {isRTL
                ? 'أوافق على معالجة بياناتي ومراجعة طلبي من قبل إدارة فاب لاب الأحساء، وسيتم الرد عليّ خلال 5 أيام عمل عبر البريد الإلكتروني.'
                : 'I agree to have my data processed and reviewed by FABLAB Al-Ahsa. I will receive a decision by email within 5 working days.'}
            </span>
          </label>
          <button type="submit" className="psr-btn primary psr-btn-submit" disabled={submitting}>
            {submitting
              ? (isRTL ? '⏳ جاري الإرسال...' : '⏳ Submitting...')
              : (isRTL ? '📨 إرسال طلب الدعم' : '📨 Submit support request')}
          </button>
        </motion.section>
      </form>
    </div>
  );
};

export default ProjectSupportForm;
