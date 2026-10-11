import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

// Teacher / instructor registration through an education workshop's
// shareable link: personal details, one of the FabLab rooms (rooms held
// by another workshop at the same time come back unavailable), and what
// they need prepared — written and/or as an uploaded file.
const FILE_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg', 'webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fmtSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const EducationTeacherForm = ({ meta, isRTL, deadlineLabel, onBack }) => {
  const [form, setForm] = useState({ fullName: '', jobTitle: '', phone: '', email: '', nationalId: '', requirements: '' });
  const [room, setRoom] = useState('');
  const [rooms, setRooms] = useState(meta.rooms || []);
  const [file, setFile] = useState(null); // { fileName, fileType, fileSize, fileData }
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [serverError, setServerError] = useState('');
  const fileInput = useRef(null);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (errors[k]) setErrors(e => ({ ...e, [k]: null })); };

  const pickFile = (fileList) => {
    const f = fileList && fileList[0];
    if (!f) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!FILE_TYPES.includes(ext)) {
      setErrors(e => ({ ...e, file: isRTL ? 'نوع الملف غير مدعوم — PDF أو Word أو Excel أو صورة' : 'Unsupported file — use PDF, Word, Excel or an image' }));
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setErrors(e => ({ ...e, file: isRTL ? 'حجم الملف أكبر من 10 ميجابايت' : 'The file is larger than 10 MB' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = String(ev.target.result || '');
      setFile({ fileName: f.name, fileType: ext, fileSize: f.size, fileData: raw.includes(',') ? raw.split(',').pop() : raw });
      setErrors(e => ({ ...e, file: null, requirements: null }));
    };
    reader.readAsDataURL(f);
  };

  const validate = () => {
    const e = {};
    const req = isRTL ? 'مطلوب' : 'Required';
    if (!form.fullName.trim()) e.fullName = req;
    if (!form.jobTitle.trim()) e.jobTitle = req;
    if (!form.phone.trim()) e.phone = req;
    if (!form.email.trim()) e.email = req;
    else if (!EMAIL_RE.test(form.email.trim())) e.email = isRTL ? 'بريد غير صالح' : 'Invalid email';
    if (!room) e.room = isRTL ? 'اختر قاعة' : 'Choose a room';
    if (!form.requirements.trim() && !file) e.requirements = isRTL ? 'اكتب متطلباتك أو ارفع ملفاً بها' : 'Write your requirements or upload a file';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setServerError('');
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/workshops/edu/${meta.workshopId}/teachers`, {
        ...form,
        room,
        requirementsFile: file || undefined
      });
      setDone(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const d = err?.response?.data || {};
      if (d.code === 'ROOM_TAKEN') {
        // Someone took it a moment ago — refresh availability.
        setRoom('');
        try {
          const fresh = await axios.get(`${API_URL}/workshops/edu/${meta.workshopId}`);
          setRooms(fresh.data.rooms || []);
        } catch { /* keep the old list */ }
      }
      setServerError((isRTL ? d.messageAr : d.message) || d.messageAr || (isRTL ? 'تعذّر التسجيل — حاول مرة أخرى' : 'Could not register — please try again'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <motion.div className="workshop-step-content edu-teacher-done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="edu-done-icon" aria-hidden="true">✓</div>
        <h3>{isRTL ? 'تم تسجيلك بنجاح' : 'You are registered'}</h3>
        <p>
          {isRTL
            ? 'أرسلنا تأكيد التسجيل إلى بريدك الإلكتروني، وسنجهّز متطلباتك قبل موعد الورشة.'
            : 'A confirmation was sent to your email, and we will prepare your requirements before the workshop.'}
        </p>
        <div className="edu-done-summary">
          <div><span>{isRTL ? 'الورشة' : 'Workshop'}</span><b>{meta.title}</b></div>
          <div><span>{isRTL ? 'القاعة' : 'Room'}</span><b>{isRTL ? done.room?.ar : done.room?.en}</b></div>
          <div><span>{isRTL ? 'الاسم' : 'Name'}</span><b>{form.fullName}</b></div>
        </div>
      </motion.div>
    );
  }

  if (!meta.teacherIsOpen) {
    return (
      <div className="workshop-step-content">
        <div className="edu-closed">
          <div className="edu-closed-icon" aria-hidden="true">⏸️</div>
          <h3>{isRTL ? 'التسجيل في هذه الورشة مغلق' : 'Registration for this workshop is closed'}</h3>
          <p>
            {meta.teacherClosedReason === 'deadline'
              ? (isRTL ? 'يُغلق التسجيل قبل بدء الورشة بـ 24 ساعة. للتسجيل المتأخر يرجى التواصل مع فاب لاب.' : 'Registration closes 24 hours before the workshop starts. For late registration please contact FabLab.')
              : (isRTL ? 'يرجى التواصل مع إدارة فاب لاب لمزيد من المعلومات.' : 'Please contact the FabLab admin for more information.')}
          </p>
        </div>
        <button type="button" className="edu-back-link" onClick={onBack}>{isRTL ? '→ رجوع' : '← Back'}</button>
      </div>
    );
  }

  const field = (key, label, props = {}) => (
    <div className="workshop-field">
      <label>{label}</label>
      <input value={form[key]} onChange={e => set(key, e.target.value)} className={errors[key] ? 'error' : ''} {...props} />
      {errors[key] && <span className="edu-err">{errors[key]}</span>}
    </div>
  );

  return (
    <motion.form className="workshop-step-content edu-teacher" onSubmit={submit} noValidate initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="edu-teacher-head">
        <h3>{isRTL ? 'تسجيل معلم / مدرب' : 'Teacher / Instructor Registration'}</h3>
        <button type="button" className="edu-back-link" onClick={onBack}>{isRTL ? 'تغيير نوع التسجيل' : 'Change registration type'}</button>
      </div>
      {deadlineLabel && <div className="edu-deadline">⏰ {deadlineLabel}</div>}

      <div className="edu-block-title">{isRTL ? 'البيانات الشخصية' : 'Personal details'}</div>
      <div className="workshop-form-grid">
        {field('fullName', isRTL ? 'الاسم الكامل *' : 'Full name *', { placeholder: isRTL ? 'الاسم الثلاثي' : 'Full name' })}
        {field('jobTitle', isRTL ? 'الوظيفة / التخصص *' : 'Job / specialty *', { placeholder: isRTL ? 'مثال: معلم حاسب آلي' : 'e.g. Computer teacher' })}
        {field('phone', isRTL ? 'رقم الجوال *' : 'Phone *', { type: 'tel', dir: 'ltr', placeholder: '05XXXXXXXX' })}
        {field('email', isRTL ? 'البريد الإلكتروني *' : 'Email *', { type: 'email', dir: 'ltr', placeholder: 'name@school.sa' })}
        {field('nationalId', isRTL ? 'رقم الهوية (اختياري)' : 'National ID (optional)', { dir: 'ltr', inputMode: 'numeric' })}
      </div>

      <div className="edu-block-title">{isRTL ? 'اختر القاعة *' : 'Choose a room *'}</div>
      <div className="edu-rooms" role="radiogroup">
        {rooms.map(r => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={room === r.id}
            disabled={!r.available}
            className={`edu-room ${room === r.id ? 'on' : ''} ${!r.available ? 'taken' : ''}`}
            onClick={() => { setRoom(r.id); if (errors.room) setErrors(e => ({ ...e, room: null })); }}
          >
            <span className="edu-room-name">{isRTL ? r.ar : r.en}</span>
            <span className="edu-room-state">
              {r.available ? (room === r.id ? (isRTL ? '✓ مختارة' : '✓ Selected') : (isRTL ? 'متاحة' : 'Available')) : (isRTL ? 'محجوزة في هذا الوقت' : 'Booked at this time')}
            </span>
          </button>
        ))}
      </div>
      {errors.room && <span className="edu-err">{errors.room}</span>}

      <div className="edu-block-title">{isRTL ? 'المتطلبات *' : 'Requirements *'}</div>
      <p className="edu-hint">
        {isRTL
          ? 'اكتب ما تحتاجه لتجهيزه قبل الورشة (أجهزة، أدوات، مواد، برامج…) أو ارفع ملفاً بالقائمة — أو كليهما.'
          : 'List what you need prepared before the workshop (devices, tools, materials, software…) or upload a file with the list — or both.'}
      </p>
      <div className="workshop-field">
        <textarea
          rows={5}
          value={form.requirements}
          onChange={e => set('requirements', e.target.value)}
          className={errors.requirements ? 'error' : ''}
          placeholder={isRTL ? 'مثال: 20 جهاز حاسب مثبت عليه Tinkercad، بروجكتر، 10 أطقم أردوينو…' : 'e.g. 20 computers with Tinkercad, a projector, 10 Arduino kits…'}
          maxLength={5000}
        />
      </div>
      <div className={`edu-file ${file ? 'has-file' : ''}`}>
        <input ref={fileInput} type="file" hidden accept={FILE_TYPES.map(t => `.${t}`).join(',')} onChange={e => { pickFile(e.target.files); e.target.value = ''; }} />
        {file ? (
          <>
            <span className="edu-file-name">📎 {file.fileName} <small>({fmtSize(file.fileSize)})</small></span>
            <button type="button" onClick={() => setFile(null)}>{isRTL ? 'إزالة' : 'Remove'}</button>
          </>
        ) : (
          <button type="button" className="edu-file-pick" onClick={() => fileInput.current?.click()}>
            ⬆ {isRTL ? 'رفع ملف المتطلبات (PDF / Word / Excel / صورة — حتى 10MB)' : 'Upload a requirements file (PDF / Word / Excel / image — up to 10MB)'}
          </button>
        )}
      </div>
      {(errors.requirements || errors.file) && <span className="edu-err">{errors.file || errors.requirements}</span>}

      {serverError && <div className="edu-server-error" role="alert">{serverError}</div>}

      <div className="workshop-actions">
        <button type="button" className="workshop-btn-back" onClick={onBack}>{isRTL ? 'رجوع' : 'Back'}</button>
        <button type="submit" className="workshop-btn-next" disabled={submitting}>
          {submitting ? (isRTL ? 'جارٍ التسجيل…' : 'Registering…') : (isRTL ? 'تأكيد التسجيل' : 'Confirm registration')}
        </button>
      </div>
    </motion.form>
  );
};

export default EducationTeacherForm;
