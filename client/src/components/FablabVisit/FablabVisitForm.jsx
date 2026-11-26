import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
// The registration "studio" frame (rail, top bar, shared form controls).
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import './FablabVisitForm.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const DAY_SHORT_AR = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
const DAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Every 15 visitors (or part of 15) need at least 2 instructors.
const PER_PAIR = 15;
const requiredInstructors = (visitors) => 2 * Math.max(1, Math.ceil((Number(visitors) || 0) / PER_PAIR));

const initialForm = {
  entityName: '',
  supervisorName: '',
  supervisorJob: '',
  phone: '',
  email: '',
  visitorsCount: '',
  purpose: '',
  notes: ''
};
const blankInstructor = () => ({ name: '', phone: '', job: '' });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 'HH:MM' → '9:30 ص' / '9:30 AM'
const fmtTime = (t, isRTL) => {
  const [h, m] = String(t || '').split(':').map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h < 12 ? (isRTL ? 'ص' : 'AM') : (isRTL ? 'م' : 'PM');
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${suffix}`;
};

const IC = {
  entity: ['M3 21h18', 'M5 21V7l7-4 7 4v14', 'M9 21v-6h6v6', 'M9 10h.01', 'M15 10h.01'],
  team: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  calendar: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  mail: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'M22 6l-10 7L2 6'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  check: ['M20 6 9 17l-5-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  reset: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  pause: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M10 15V9', 'M14 15V9'],
  alert: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
  refresh: ['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  prev: ['M15 18l-6-6 6-6'],
  next: ['M9 18l6-6-6-6']
};
const FEATURES = [
  { ar: 'للمدارس والجهات والوفود', en: 'For schools, entities and groups', d: IC.entity },
  { ar: 'مرافقان لكل 15 زائرًا', en: 'Two instructors per 15 visitors', d: IC.team },
  { ar: 'اختر موعدًا ويصلك الرد بالبريد', en: 'Pick a slot, get the answer by email', d: IC.calendar }
];

const FablabVisitForm = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [theme, toggleTheme] = useStudioTheme();

  const [form, setForm] = useState(initialForm);
  const [supervisorIsInstructor, setSupervisorIsInstructor] = useState(false);
  const [instructors, setInstructors] = useState([blankInstructor(), blankInstructor()]);
  const [slotId, setSlotId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { visitNumber, slot }

  const [slotsState, setSlotsState] = useState({ loading: true, open: true, reason: '', slots: [], error: false });
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const loadSlots = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/public/fablab-visit/slots`);
      setSlotsState({ loading: false, open: data.open !== false, reason: data.reason || '', slots: Array.isArray(data.slots) ? data.slots : [], error: false });
      return data.slots || [];
    } catch (e) {
      setSlotsState(s => ({ ...s, loading: false, error: true }));
      return [];
    }
  }, []);

  useEffect(() => {
    loadSlots().then((slots) => {
      // Open the calendar on the month of the first available slot.
      if (slots.length) {
        const [y, m] = slots[0].date.split('-').map(Number);
        setViewMonth(new Date(y, m - 1, 1));
      }
    });
  }, [loadSlots]);

  const visitors = parseInt(form.visitorsCount, 10) || 0;
  const need = visitors > 0 ? requiredInstructors(visitors) : 2;
  const supervisorEntry = { name: form.supervisorName.trim(), phone: form.phone.trim(), job: form.supervisorJob.trim() };
  // Cards the supervisor still has to fill (the supervisor can be #1).
  const entriesNeeded = Math.max(0, need - (supervisorIsInstructor ? 1 : 0));

  // Keep enough instructor cards for the group size (never drops filled ones).
  useEffect(() => {
    setInstructors(list => {
      if (list.length >= entriesNeeded) {
        // Trim trailing blank cards beyond what's required.
        let end = list.length;
        while (end > entriesNeeded && !list[end - 1].name && !list[end - 1].phone && !list[end - 1].job) end--;
        return end === list.length ? list : list.slice(0, end);
      }
      return [...list, ...Array.from({ length: entriesNeeded - list.length }, blankInstructor)];
    });
  }, [entriesNeeded]);

  const setField = (name, value) => {
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: null }));
  };
  const setInstructor = (i, patch) => {
    setInstructors(list => list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    if (errors.instructors) setErrors(e => ({ ...e, instructors: null }));
  };

  const allInstructors = useMemo(() => {
    const filled = instructors.filter(i => i.name.trim() || i.phone.trim() || i.job.trim());
    return supervisorIsInstructor ? [supervisorEntry, ...filled] : filled;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructors, supervisorIsInstructor, form.supervisorName, form.phone, form.supervisorJob]);

  // Section 1 and 2 are complete (drives the ✓ on each section head).
  const entityDone = !!(form.entityName.trim() && form.supervisorName.trim() && form.supervisorJob.trim() && form.phone.trim() && EMAIL_RE.test(form.email.trim()));
  const instructorsDone = visitors >= 1
    && allInstructors.filter(i => i.name && i.phone).length >= need
    && !instructors.slice(0, entriesNeeded).some(i => !i.name.trim() || !i.phone.trim());

  // What still blocks choosing a slot (the group details come first).
  const missing = useMemo(() => {
    const m = [];
    if (!form.entityName.trim()) m.push(isRTL ? 'اسم الجهة الزائرة' : 'Visiting entity');
    if (!form.supervisorName.trim()) m.push(isRTL ? 'اسم المشرف' : 'Supervisor name');
    if (!form.supervisorJob.trim()) m.push(isRTL ? 'وظيفة المشرف' : 'Supervisor job');
    if (!form.phone.trim()) m.push(isRTL ? 'رقم الجوال' : 'Phone');
    if (!EMAIL_RE.test(form.email.trim())) m.push(isRTL ? 'بريد إلكتروني صحيح' : 'A valid email');
    if (visitors < 1) m.push(isRTL ? 'عدد الزوار' : 'Number of visitors');
    const complete = allInstructors.filter(i => i.name && i.phone).length;
    if (visitors >= 1 && (complete < need || instructors.slice(0, entriesNeeded).some(i => !i.name.trim() || !i.phone.trim()))) {
      m.push(isRTL ? `بيانات ${need} مرافقين (الاسم والجوال)` : `${need} instructors (name and phone)`);
    }
    return m;
  }, [form, visitors, allInstructors, need, instructors, entriesNeeded, isRTL]);
  const slotsUnlocked = missing.length === 0;

  // A chosen slot that no longer fits the group size is dropped.
  const selectedSlot = slotsState.slots.find(s => s.slotId === slotId) || null;
  useEffect(() => {
    if (selectedSlot && visitors > selectedSlot.capacity) setSlotId('');
  }, [visitors, selectedSlot]);

  const slotsByDate = useMemo(() => {
    const map = new Map();
    for (const s of slotsState.slots) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date).push(s);
    }
    return map;
  }, [slotsState.slots]);

  const monthGrid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    const days = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewMonth]);

  const todayISO = toISO(new Date());
  const monthLabel = `${isRTL ? MONTH_NAMES_AR[viewMonth.getMonth()] : MONTH_NAMES_EN[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
  const fmtDateLong = (iso) => {
    const d = new Date(`${iso}T00:00:00`);
    return `${isRTL ? DAY_NAMES_AR[d.getDay()] : DAY_NAMES_EN[d.getDay()]} ${d.getDate()} ${isRTL ? MONTH_NAMES_AR[d.getMonth()] : MONTH_NAMES_EN[d.getMonth()]} ${d.getFullYear()}`;
  };

  const validate = () => {
    const err = {};
    if (!form.entityName.trim()) err.entityName = isRTL ? 'مطلوب' : 'Required';
    if (!form.supervisorName.trim()) err.supervisorName = isRTL ? 'مطلوب' : 'Required';
    if (!form.supervisorJob.trim()) err.supervisorJob = isRTL ? 'مطلوب' : 'Required';
    if (!form.phone.trim()) err.phone = isRTL ? 'مطلوب' : 'Required';
    if (!form.email.trim()) err.email = isRTL ? 'مطلوب' : 'Required';
    else if (!EMAIL_RE.test(form.email.trim())) err.email = isRTL ? 'بريد غير صالح' : 'Invalid email';
    if (visitors < 1) err.visitorsCount = isRTL ? 'أدخل عدد الزوار' : 'Enter the number of visitors';
    if (instructors.slice(0, entriesNeeded).some(i => !i.name.trim() || !i.phone.trim())) {
      err.instructors = isRTL ? 'أكمل اسم ورقم جوال كل مرافق' : "Complete each instructor's name and phone";
    }
    if (!slotId) err.slot = isRTL ? 'اختر موعد الزيارة' : 'Choose a visit slot';
    return err;
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length) {
      toast.error(isRTL ? 'يوجد حقول ناقصة' : 'Please complete the required fields');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/public/fablab-visit/submit`, {
        ...form,
        visitorsCount: visitors,
        instructors: allInstructors,
        slotId
      });
      setSubmitted({ visitNumber: data?.visitNumber ?? null, slot: selectedSlot });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success(isRTL ? 'تم إرسال طلبك' : 'Request submitted');
    } catch (er) {
      const resp = er?.response?.data || {};
      if (resp.code === 'SLOT_UNAVAILABLE') {
        setSlotId('');
        await loadSlots();
      } else if (resp.code === 'VISITS_CLOSED') {
        setSlotsState(s => ({ ...s, open: false, reason: resp.messageAr || resp.message || '' }));
      }
      toast.error((isRTL ? resp.messageAr : resp.message) || resp.messageAr || (isRTL ? 'حدث خطأ' : 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setForm(initialForm);
    setSupervisorIsInstructor(false);
    setInstructors([blankInstructor(), blankInstructor()]);
    setSlotId('');
    setSelectedDate('');
    setErrors({});
  };

  const shellProps = {
    isRTL,
    theme,
    onToggleTheme: toggleTheme,
    servicesHref: '/register',
    subtitle: isRTL ? 'حجز زيارة' : 'Book a visit',
    intro: {
      portal: isRTL ? 'زيارات فاب لاب' : 'FabLab visits',
      title: isRTL ? <>زُر فاب لاب<br /><em>مع مجموعتك</em></> : <>Visit FabLab<br /><em>with your group</em></>,
      features: FEATURES
    }
  };

  const hero = (
    <motion.div
      className="rgx-hero fv-hero"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <p className="rgx-eyebrow"><i aria-hidden="true" />{isRTL ? 'زيارات فاب لاب' : 'FabLab visits'}</p>
      <h1>{isRTL ? <>حجز زيارة لـ <em>فاب لاب الأحساء</em></> : <>Book a visit to <em>FabLab Al-Ahsa</em></>}</h1>
      <p>
        {isRTL
          ? 'للجهات والمدارس والوفود: أدخل بيانات المجموعة والمرافقين، ثم اختر أحد المواعيد المتاحة. يُراجع الطلب من قِبل الإدارة ويصلكم الرد عبر البريد الإلكتروني.'
          : 'For entities, schools and groups: enter your group and instructor details, then pick one of the open slots. The administration reviews the request and replies by email.'}
      </p>
    </motion.div>
  );

  const secHead = (n, title, desc, done) => (
    <header className="fv-sec-head">
      <span className={`fv-sec-n ${done ? 'is-done' : ''}`}>{done ? <Icon d={IC.check} /> : String(n).padStart(2, '0')}</span>
      <div>
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
    </header>
  );

  // One labelled input with its error line.
  const field = (name, label, props = {}, full = false) => (
    <div className={`form-group ${full ? 'full-width' : ''}`}>
      <label className="form-label" htmlFor={`fv-${name}`}>{label} <span className="required">*</span></label>
      <input
        id={`fv-${name}`}
        className={`form-input ${errors[name] ? 'has-error' : ''}`}
        value={form[name]}
        onChange={(e) => setField(name, e.target.value)}
        aria-invalid={!!errors[name]}
        {...props}
      />
      {errors[name] && <span className="fv-err">{errors[name]}</span>}
    </div>
  );

  // ---------- Closed / unavailable states ----------
  if (!slotsState.loading && (!slotsState.open || slotsState.error) && !submitted) {
    return (
      <StudioShell {...shellProps}>
        {hero}
        <motion.section className="rgx-card rgx-closed" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <span className="rgx-closed-ico"><Icon d={slotsState.error ? IC.alert : IC.pause} /></span>
          <h2>
            {slotsState.error
              ? (isRTL ? 'تعذّر تحميل المواعيد' : 'Could not load the visit slots')
              : (isRTL ? 'التسجيل في الزيارات مغلق حالياً' : 'Visit registration is closed for now')}
          </h2>
          {!slotsState.error && slotsState.reason && (
            <div className="rgx-closed-reason"><b>{isRTL ? 'السبب' : 'Reason'}</b><p>{slotsState.reason}</p></div>
          )}
          <p className="rgx-closed-text">
            {slotsState.error
              ? (isRTL ? 'تحقق من اتصالك ثم أعد المحاولة.' : 'Check your connection and try again.')
              : (isRTL ? 'يرجى المحاولة لاحقاً أو التواصل مع فاب لاب.' : 'Please try again later or contact FabLab.')}
          </p>
          <div className="rgx-closed-actions">
            {slotsState.error && (
              <button type="button" className="btn btn-primary" onClick={() => { setSlotsState(s => ({ ...s, loading: true, error: false })); loadSlots(); }}>
                <Icon d={IC.refresh} />{isRTL ? 'إعادة المحاولة' : 'Try again'}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/register')}>
              <Icon d={IC.grid} />{isRTL ? 'كل الخدمات' : 'All services'}
            </button>
          </div>
        </motion.section>
      </StudioShell>
    );
  }

  return (
    <StudioShell {...shellProps}>
      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div key="form" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}>
            {hero}

            <form className="rgx-card fv" onSubmit={submit} noValidate>
              {/* 1 — Entity + supervisor */}
              <section className="fv-sec">
                {secHead(1, isRTL ? 'الجهة الزائرة والمشرف' : 'Visiting entity & supervisor',
                  isRTL ? 'بيانات الجهة والشخص المسؤول عن المجموعة.' : 'The entity and the person in charge of the group.', entityDone)}
                <div className="form-grid">
                  {field('entityName', isRTL ? 'الجهة الزائرة' : 'Visiting entity', { type: 'text', placeholder: isRTL ? 'مثال: مدرسة الأحساء الأهلية' : 'e.g. Al-Ahsa National School' }, true)}
                  {field('supervisorName', isRTL ? 'اسم المشرف' : 'Supervisor name', { type: 'text', placeholder: isRTL ? 'الاسم الكامل' : 'Full name' })}
                  {field('supervisorJob', isRTL ? 'وظيفة المشرف' : 'Supervisor job', { type: 'text', placeholder: isRTL ? 'مثال: معلم علوم، منسق نشاط' : 'e.g. Science teacher, activities coordinator' })}
                  {field('phone', isRTL ? 'رقم الجوال' : 'Phone', { type: 'tel', dir: 'ltr', placeholder: '05XXXXXXXX' })}
                  {field('email', isRTL ? 'البريد الإلكتروني' : 'Email', { type: 'email', dir: 'ltr', placeholder: 'name@example.com' })}
                </div>
              </section>

              {/* 2 — Visitors + instructors */}
              <section className="fv-sec">
                {secHead(2, isRTL ? 'الزوار والمرافقون' : 'Visitors & instructors',
                  isRTL ? 'عدد الطلاب وبيانات المرافقين معهم.' : 'How many students, and who comes with them.', instructorsDone)}
                <div className="fv-visitors">
                  {field('visitorsCount', isRTL ? 'عدد الزوار (الطلاب)' : 'Number of visitors (students)', { type: 'number', min: '1', max: '1000', dir: 'ltr', placeholder: '15', inputMode: 'numeric' })}
                  <div className={`fv-rule ${visitors > 0 ? 'is-live' : ''}`}>
                    <span className="fv-rule-ico"><Icon d={IC.team} /></span>
                    <div>
                      <b>{isRTL ? 'لكل 15 زائراً يلزم مرافقان على الأقل' : 'At least 2 instructors for every 15 visitors'}</b>
                      <small>
                        {visitors > 0
                          ? (isRTL ? `عدد زواركم ${visitors} — يلزم ${need} مرافقين على الأقل.` : `${visitors} visitors — at least ${need} instructors are required.`)
                          : (isRTL ? '1–15 زائراً: مرافقان · 16–30: أربعة مرافقين · 31–45: ستة مرافقين… وهكذا.' : '1–15 visitors: 2 · 16–30: 4 · 31–45: 6 … and so on.')}
                      </small>
                    </div>
                  </div>
                </div>

                <label className={`rgx-ack fv-ack ${supervisorIsInstructor ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={supervisorIsInstructor} onChange={(e) => setSupervisorIsInstructor(e.target.checked)} />
                  <span>{isRTL ? 'المشرف أحد المرافقين مع المجموعة' : 'The supervisor is one of the instructors'}</span>
                </label>

                <div className="fv-insts">
                  {supervisorIsInstructor && (
                    <div className="fv-inst is-supervisor">
                      <div className="fv-inst-head">
                        <span className="fv-inst-n">1</span>
                        <b>{isRTL ? 'المرافق 1 — المشرف' : 'Instructor 1 — supervisor'}</b>
                      </div>
                      <div className="fv-inst-summary">
                        <span>{supervisorEntry.name || (isRTL ? 'اسم المشرف' : 'Supervisor name')}</span>
                        <span dir="ltr">{supervisorEntry.phone || '05XXXXXXXX'}</span>
                        <span>{supervisorEntry.job || (isRTL ? 'الوظيفة' : 'Job')}</span>
                      </div>
                    </div>
                  )}
                  {instructors.map((ins, i) => {
                    const n = i + 1 + (supervisorIsInstructor ? 1 : 0);
                    const required = i < entriesNeeded;
                    const incomplete = errors.instructors && required && (!ins.name.trim() || !ins.phone.trim());
                    return (
                      <div key={i} className={`fv-inst ${incomplete ? 'has-error' : ''}`}>
                        <div className="fv-inst-head">
                          <span className="fv-inst-n">{n}</span>
                          <b>{isRTL ? `المرافق ${n}` : `Instructor ${n}`}</b>
                          {!required && (
                            <button type="button" className="fv-inst-remove" onClick={() => setInstructors(list => list.filter((_, k) => k !== i))}>
                              <Icon d={IC.x} />{isRTL ? 'إزالة' : 'Remove'}
                            </button>
                          )}
                        </div>
                        <div className="fv-inst-grid">
                          <input className={`form-input ${incomplete && !ins.name.trim() ? 'has-error' : ''}`} type="text" value={ins.name} onChange={(e) => setInstructor(i, { name: e.target.value })} placeholder={isRTL ? 'الاسم *' : 'Name *'} aria-label={isRTL ? 'اسم المرافق' : 'Instructor name'} />
                          <input className={`form-input ${incomplete && !ins.phone.trim() ? 'has-error' : ''}`} type="tel" dir="ltr" value={ins.phone} onChange={(e) => setInstructor(i, { phone: e.target.value })} placeholder={isRTL ? 'الجوال *' : 'Phone *'} aria-label={isRTL ? 'جوال المرافق' : 'Instructor phone'} />
                          <input className="form-input" type="text" value={ins.job} onChange={(e) => setInstructor(i, { job: e.target.value })} placeholder={isRTL ? 'الوظيفة' : 'Job'} aria-label={isRTL ? 'وظيفة المرافق' : 'Instructor job'} />
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" className="fv-inst-add" onClick={() => setInstructors(list => [...list, blankInstructor()])}>
                    <Icon d={IC.plus} />{isRTL ? 'إضافة مرافق آخر' : 'Add another instructor'}
                  </button>
                  {errors.instructors && <span className="fv-err">{errors.instructors}</span>}
                </div>
              </section>

              {/* 3 — Slot (unlocks once the group is complete) */}
              <section className={`fv-sec fv-slots ${slotsUnlocked ? '' : 'is-locked'}`}>
                {secHead(3, isRTL ? 'اختر موعد الزيارة' : 'Choose a visit slot',
                  isRTL ? 'تظهر المواعيد بعد اكتمال بيانات المجموعة.' : 'The slots open once the group details are complete.', !!selectedSlot)}

                {!slotsUnlocked ? (
                  <div className="fv-lock">
                    <span className="fv-lock-ico"><Icon d={IC.lock} /></span>
                    <div>
                      <b>{isRTL ? 'أكمل بيانات المجموعة أولاً لعرض المواعيد المتاحة' : 'Complete the group details first to see the open slots'}</b>
                      <ul>{missing.map(m => <li key={m}>{m}</li>)}</ul>
                    </div>
                  </div>
                ) : slotsState.loading ? (
                  <div className="fv-empty">{isRTL ? 'جارٍ تحميل المواعيد…' : 'Loading slots…'}</div>
                ) : slotsState.slots.length === 0 ? (
                  <div className="fv-lock">
                    <span className="fv-lock-ico"><Icon d={IC.calendar} /></span>
                    <div>
                      <b>{isRTL ? 'لا توجد مواعيد متاحة حالياً' : 'No slots are open right now'}</b>
                      <small>{isRTL ? 'تُفتح المواعيد من قِبل إدارة فاب لاب — يرجى المحاولة لاحقاً.' : 'FabLab opens new slots regularly — please check back later.'}</small>
                    </div>
                  </div>
                ) : (
                  <div className="fv-picker">
                    <div className={`fv-cal ${errors.slot ? 'has-error' : ''}`}>
                      <div className="fv-cal-head">
                        <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="fv-cal-nav" aria-label={isRTL ? 'الشهر السابق' : 'Previous month'}>
                          <Icon d={isRTL ? IC.next : IC.prev} />
                        </button>
                        <h3>{monthLabel}</h3>
                        <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="fv-cal-nav" aria-label={isRTL ? 'الشهر التالي' : 'Next month'}>
                          <Icon d={isRTL ? IC.prev : IC.next} />
                        </button>
                      </div>
                      <div className="fv-cal-grid">
                        {(isRTL ? DAY_SHORT_AR : DAY_SHORT_EN).map(d => <div key={d} className="fv-wd">{d}</div>)}
                        {monthGrid.map((d, i) => {
                          if (!d) return <div key={i} className="fv-day blank" aria-hidden="true" />;
                          const iso = toISO(d);
                          const daySlots = slotsByDate.get(iso) || [];
                          const fits = daySlots.some(s => s.capacity >= visitors);
                          const cls = ['fv-day',
                            daySlots.length ? (fits ? 'ok' : 'low') : 'off',
                            iso === todayISO && 'today',
                            selectedDate === iso && 'sel'].filter(Boolean).join(' ');
                          return (
                            <button key={iso} type="button" className={cls} disabled={!daySlots.length}
                              aria-pressed={selectedDate === iso}
                              onClick={() => { setSelectedDate(iso); if (selectedSlot && selectedSlot.date !== iso) setSlotId(''); }}
                              title={daySlots.length ? `${daySlots.length} ${isRTL ? 'موعد' : 'slot(s)'}` : ''}>
                              <span className="n">{d.getDate()}</span>
                              {daySlots.length > 0 && <span className="f">{daySlots.length}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="fv-legend">
                        <span><i className="ok" />{isRTL ? 'يوجد مواعيد' : 'Has slots'}</span>
                        <span><i className="low" />{isRTL ? 'أصغر من مجموعتكم' : 'Too small for you'}</span>
                        <span><i className="sel" />{isRTL ? 'مختار' : 'Selected'}</span>
                        <span><i className="off" />{isRTL ? 'لا مواعيد' : 'No slots'}</span>
                      </div>
                    </div>

                    <div className="fv-day-list">
                      {!selectedDate ? (
                        <div className="fv-empty">
                          <Icon d={IC.calendar} />
                          {isRTL ? 'اختر يوماً من التقويم لعرض مواعيده.' : 'Pick a day on the calendar to see its slots.'}
                        </div>
                      ) : (
                        <>
                          <h3 className="fv-day-title">{fmtDateLong(selectedDate)}</h3>
                          {(slotsByDate.get(selectedDate) || []).map(s => {
                            const tooSmall = s.capacity < visitors;
                            const sel = s.slotId === slotId;
                            return (
                              <button key={s.slotId} type="button" disabled={tooSmall} aria-pressed={sel}
                                className={`fv-slot ${sel ? 'is-sel' : ''} ${tooSmall ? 'is-small' : ''}`}
                                onClick={() => { setSlotId(s.slotId); if (errors.slot) setErrors(e => ({ ...e, slot: null })); }}>
                                <span className="fv-slot-ico"><Icon d={sel ? IC.check : IC.clock} /></span>
                                <span className="fv-slot-text">
                                  <b dir={isRTL ? 'rtl' : 'ltr'}>{fmtTime(s.startTime, isRTL)} – {fmtTime(s.endTime, isRTL)}</b>
                                  <small>
                                    {tooSmall
                                      ? (isRTL ? `يتسع لـ ${s.capacity} زائر فقط` : `Fits only ${s.capacity} visitors`)
                                      : (isRTL ? `حتى ${s.capacity} زائر` : `Up to ${s.capacity} visitors`)}
                                  </small>
                                </span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {errors.slot && slotsUnlocked && <span className="fv-err">{errors.slot}</span>}
              </section>

              {/* 4 — Optional details */}
              <section className="fv-sec">
                {secHead(4, isRTL ? 'تفاصيل إضافية' : 'More details', isRTL ? 'اختياري — يساعدنا على تجهيز الزيارة.' : 'Optional — helps us prepare the visit.', false)}
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label className="form-label" htmlFor="fv-purpose">{isRTL ? 'الغرض من الزيارة' : 'Purpose of the visit'}</label>
                    <textarea id="fv-purpose" className="form-textarea" rows={3} value={form.purpose} onChange={(e) => setField('purpose', e.target.value)}
                      placeholder={isRTL ? 'الفئة العمرية، المواضيع التي تهمّكم…' : 'Age group, topics of interest…'} />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label" htmlFor="fv-notes">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                    <textarea id="fv-notes" className="form-textarea fv-notes" rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)}
                      placeholder={isRTL ? 'احتياجات خاصة، وسيلة الوصول…' : 'Special requirements, transport…'} />
                  </div>
                </div>
              </section>

              {selectedSlot && (
                <div className="fv-picked">
                  <span className="fv-picked-ico"><Icon d={IC.calendar} /></span>
                  <div>
                    <small>{isRTL ? 'الموعد المختار' : 'Selected slot'}</small>
                    <b>{fmtDateLong(selectedSlot.date)}</b>
                    <b dir={isRTL ? 'rtl' : 'ltr'}>{fmtTime(selectedSlot.startTime, isRTL)} – {fmtTime(selectedSlot.endTime, isRTL)}</b>
                  </div>
                </div>
              )}

              <div className="form-navigation">
                <button type="button" className="btn btn-secondary" onClick={resetAll} disabled={submitting}>
                  <Icon d={IC.reset} />{isRTL ? 'مسح' : 'Reset'}
                </button>
                <button type="submit" className="btn btn-primary btn-submit" disabled={submitting || !slotId}>
                  {submitting
                    ? <><span className="loading-spinner" />{isRTL ? 'جارٍ الإرسال...' : 'Submitting...'}</>
                    : <><Icon d={IC.send} />{isRTL ? 'إرسال طلب الحجز' : 'Submit booking'}</>}
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.section key="thanks" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }} className="rgx-card fv-done">
            <motion.span className="fv-done-ico" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }}>
              <Icon d={IC.check} />
            </motion.span>
            <h2>{isRTL ? 'تم استلام طلب الحجز' : 'Booking request received'}</h2>
            {submitted.visitNumber != null && (
              <div className="fv-done-id">
                <small>{isRTL ? 'رقم الطلب' : 'Request no.'}</small>
                <b dir="ltr">V-{String(submitted.visitNumber).padStart(3, '0')}</b>
              </div>
            )}
            <p className="fv-done-text">
              {isRTL
                ? 'تم حجز الموعد لكم مبدئياً وسيُراجع الطلب من قِبل الإدارة، ويصلكم قرار الموافقة على البريد الإلكتروني المسجّل.'
                : 'The slot is held for you while the administration reviews the request; the decision will be sent to your email.'}
            </p>
            <dl className="fv-done-sum">
              <div><dt>{isRTL ? 'الجهة' : 'Entity'}</dt><dd>{form.entityName}</dd></div>
              {submitted.slot && <div><dt>{isRTL ? 'التاريخ' : 'Date'}</dt><dd>{fmtDateLong(submitted.slot.date)}</dd></div>}
              {submitted.slot && <div><dt>{isRTL ? 'الوقت' : 'Time'}</dt><dd dir={isRTL ? 'rtl' : 'ltr'}>{fmtTime(submitted.slot.startTime, isRTL)} – {fmtTime(submitted.slot.endTime, isRTL)}</dd></div>}
              <div><dt>{isRTL ? 'الزوار' : 'Visitors'}</dt><dd>{visitors}</dd></div>
              <div><dt>{isRTL ? 'المرافقون' : 'Instructors'}</dt><dd>{allInstructors.length}</dd></div>
            </dl>
            <div className="rgx-closed-actions">
              <button type="button" className="btn btn-primary" onClick={() => { resetAll(); setSubmitted(null); loadSlots(); }}>
                <Icon d={IC.plus} />{isRTL ? 'حجز زيارة أخرى' : 'Book another'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/register')}>
                <Icon d={IC.grid} />{isRTL ? 'كل الخدمات' : 'All services'}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </StudioShell>
  );
};

export default FablabVisitForm;
