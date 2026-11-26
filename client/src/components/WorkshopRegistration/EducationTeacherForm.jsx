import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Icon } from '../RegistrationForm/StudioShell';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

// Teacher / instructor registration through an education workshop's
// shareable link: personal details, one of the FabLab rooms (rooms held
// by another workshop at the same time come back unavailable), and what
// they need prepared — written and/or as an uploaded file.
const FILE_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'png', 'jpg', 'jpeg', 'webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const I = {
  check: ['M20 6 9 17l-5-5'],
  pause: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M10 15V9', 'M14 15V9'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  clip: ['M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  room: ['M3 21h18', 'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16', 'M14 12h.01'],
  alert: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
  left: ['M19 12H5', 'M12 19l-7-7 7-7'],
  right: ['M5 12h14', 'M12 5l7 7-7 7']
};

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

  const arrowBack = isRTL ? I.right : I.left;

  if (done) {
    return (
      <motion.div className="wkr-done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="wkr-done-ico" aria-hidden="true"><Icon d={I.check} /></span>
        <h2>{isRTL ? 'تم تسجيلك بنجاح' : 'You are registered'}</h2>
        <p>
          {isRTL
            ? 'أرسلنا تأكيد التسجيل إلى بريدك الإلكتروني، وسنجهّز متطلباتك قبل موعد الورشة.'
            : 'A confirmation was sent to your email, and we will prepare your requirements before the workshop.'}
        </p>
        <div className="wkr-done-sum">
          <div><small>{isRTL ? 'الورشة' : 'Workshop'}</small><b>{meta.title}</b></div>
          <div><small>{isRTL ? 'القاعة' : 'Room'}</small><b>{isRTL ? done.room?.ar : done.room?.en}</b></div>
          <div><small>{isRTL ? 'الاسم' : 'Name'}</small><b>{form.fullName}</b></div>
        </div>
      </motion.div>
    );
  }

  if (!meta.teacherIsOpen) {
    return (
      <div className="rgx-closed wkr-teacher-closed">
        <span className="rgx-closed-ico"><Icon d={I.pause} /></span>
        <h2>{isRTL ? 'التسجيل في هذه الورشة مغلق' : 'Registration for this workshop is closed'}</h2>
        <p className="rgx-closed-text">
          {meta.teacherClosedReason === 'deadline'
            ? (isRTL ? 'يُغلق التسجيل قبل بدء الورشة بـ 24 ساعة. للتسجيل المتأخر يرجى التواصل مع فاب لاب.' : 'Registration closes 24 hours before the workshop starts. For late registration please contact FabLab.')
            : (isRTL ? 'يرجى التواصل مع إدارة فاب لاب لمزيد من المعلومات.' : 'Please contact the FabLab admin for more information.')}
        </p>
        <div className="rgx-closed-actions">
          <button type="button" className="btn btn-secondary" onClick={onBack}><Icon d={arrowBack} />{isRTL ? 'رجوع' : 'Back'}</button>
        </div>
      </div>
    );
  }

  const field = (key, label, required, props = {}) => (
    <div className="form-group">
      <label className="form-label">{label}{required && <> <span className="required">*</span></>}</label>
      <input value={form[key]} onChange={e => set(key, e.target.value)} className={`form-input${errors[key] ? ' wkr-bad' : ''}`} {...props} />
      {errors[key] && <span className="wkr-err">{errors[key]}</span>}
    </div>
  );

  return (
    <motion.form className="rgx-content wkr-teacher-form" onSubmit={submit} noValidate initial={{ opacity: 0, x: isRTL ? -20 : 20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="wkr-teacher-head">
        <div>
          <h2 className="step-title">{isRTL ? 'تسجيل معلم / مدرب' : 'Teacher / Instructor Registration'}</h2>
          <p className="step-description">{meta.title}</p>
        </div>
        <button type="button" className="wkr-linkbtn" onClick={onBack}>{isRTL ? 'تغيير نوع التسجيل' : 'Change registration type'}</button>
      </div>
      {deadlineLabel && <div className="wkr-chip amber wkr-deadline"><Icon d={I.clock} />{deadlineLabel}</div>}

      <h3 className="wkr-sub">{isRTL ? 'البيانات الشخصية' : 'Personal details'}</h3>
      <div className="form-grid">
        {field('fullName', isRTL ? 'الاسم الكامل' : 'Full name', true, { placeholder: isRTL ? 'الاسم الثلاثي' : 'Full name' })}
        {field('jobTitle', isRTL ? 'الوظيفة / التخصص' : 'Job / specialty', true, { placeholder: isRTL ? 'مثال: معلم حاسب آلي' : 'e.g. Computer teacher' })}
        {field('phone', isRTL ? 'رقم الجوال' : 'Phone', true, { type: 'tel', dir: 'ltr', placeholder: '05XXXXXXXX' })}
        {field('email', isRTL ? 'البريد الإلكتروني' : 'Email', true, { type: 'email', dir: 'ltr', placeholder: 'name@school.sa' })}
        {field('nationalId', isRTL ? 'رقم الهوية (اختياري)' : 'National ID (optional)', false, { dir: 'ltr', inputMode: 'numeric' })}
      </div>

      <h3 className="wkr-sub">{isRTL ? 'اختر القاعة' : 'Choose a room'} <span className="required">*</span></h3>
      <div className="wkr-rooms" role="radiogroup">
        {rooms.map(r => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={room === r.id}
            disabled={!r.available}
            className={`wkr-room${room === r.id ? ' on' : ''}${!r.available ? ' taken' : ''}`}
            onClick={() => { setRoom(r.id); if (errors.room) setErrors(e => ({ ...e, room: null })); }}
          >
            <span className="wkr-room-ico"><Icon d={room === r.id ? I.check : I.room} /></span>
            <span className="wkr-room-text">
              <b>{isRTL ? r.ar : r.en}</b>
              <small>{r.available ? (room === r.id ? (isRTL ? 'مختارة' : 'Selected') : (isRTL ? 'متاحة' : 'Available')) : (isRTL ? 'محجوزة في هذا الوقت' : 'Booked at this time')}</small>
            </span>
          </button>
        ))}
      </div>
      {errors.room && <span className="wkr-err">{errors.room}</span>}

      <h3 className="wkr-sub">{isRTL ? 'المتطلبات' : 'Requirements'} <span className="required">*</span></h3>
      <p className="wkr-hint">
        {isRTL
          ? 'اكتب ما تحتاجه لتجهيزه قبل الورشة (أجهزة، أدوات، مواد، برامج…) أو ارفع ملفاً بالقائمة — أو كليهما.'
          : 'List what you need prepared before the workshop (devices, tools, materials, software…) or upload a file with the list — or both.'}
      </p>
      <textarea
        rows={4}
        value={form.requirements}
        onChange={e => set('requirements', e.target.value)}
        className={`form-textarea${errors.requirements ? ' wkr-bad' : ''}`}
        placeholder={isRTL ? 'مثال: 20 جهاز حاسب مثبت عليه Tinkercad، بروجكتر، 10 أطقم أردوينو…' : 'e.g. 20 computers with Tinkercad, a projector, 10 Arduino kits…'}
        maxLength={5000}
      />
      <input ref={fileInput} type="file" hidden accept={FILE_TYPES.map(t => `.${t}`).join(',')} onChange={e => { pickFile(e.target.files); e.target.value = ''; }} />
      {file ? (
        <div className="wkr-upload has-file">
          <span className="wkr-upload-ico"><Icon d={I.clip} /></span>
          <span className="wkr-upload-text"><b>{file.fileName}</b><small>{fmtSize(file.fileSize)}</small></span>
          <button type="button" className="wkr-linkbtn danger" onClick={() => setFile(null)}>{isRTL ? 'إزالة' : 'Remove'}</button>
        </div>
      ) : (
        <button type="button" className="wkr-upload" onClick={() => fileInput.current?.click()}>
          <span className="wkr-upload-ico"><Icon d={I.upload} /></span>
          <span className="wkr-upload-text">
            <b>{isRTL ? 'رفع ملف المتطلبات' : 'Upload a requirements file'}</b>
            <small>{isRTL ? 'PDF / Word / Excel / صورة — حتى 10MB' : 'PDF / Word / Excel / image — up to 10MB'}</small>
          </span>
        </button>
      )}
      {(errors.requirements || errors.file) && <span className="wkr-err">{errors.file || errors.requirements}</span>}

      {serverError && <div className="info-banner warning" role="alert"><Icon d={I.alert} /><span>{serverError}</span></div>}

      <div className="form-navigation">
        <button type="button" className="btn btn-secondary" onClick={onBack}><Icon d={arrowBack} />{isRTL ? 'رجوع' : 'Back'}</button>
        <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
          {submitting ? <span className="loading-spinner" /> : <Icon d={I.check} />}
          {submitting ? (isRTL ? 'جارٍ التسجيل…' : 'Registering…') : (isRTL ? 'تأكيد التسجيل' : 'Confirm registration')}
        </button>
      </div>
    </motion.form>
  );
};

export default EducationTeacherForm;
