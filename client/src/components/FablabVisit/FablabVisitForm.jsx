import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
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

const FablabVisitForm = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

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

  const topbar = (
    <header className="fv-topbar">
      <div className="fv-topbar-inner">
        <button className="fv-topbar-brand" onClick={() => navigate('/register')} type="button">
          <img src="/logo.png" alt="" className="fv-topbar-logo" />
          <div className="fv-topbar-titles">
            <span className="fv-topbar-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</span>
            <span className="fv-topbar-sub">{isRTL ? 'حجز زيارة' : 'Book a Visit'}</span>
          </div>
        </button>
        <button className="fv-topbar-back" type="button" onClick={() => navigate('/register')} title={isRTL ? 'العودة' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
        </button>
      </div>
    </header>
  );

  const hero = (
    <header className="fv-hero">
      <span className="fv-hero-eyebrow">{isRTL ? 'زيارات فاب لاب' : 'FABLAB VISITS'}</span>
      <h1 className="fv-hero-title">{isRTL ? 'حجز زيارة لفاب لاب الأحساء' : 'Book a Visit to FabLab Al-Ahsa'}</h1>
      <p className="fv-hero-sub">
        {isRTL
          ? 'للجهات والمدارس والوفود: أدخل بيانات المجموعة والمرافقين، ثم اختر أحد المواعيد المتاحة. يُراجع الطلب من قِبل الإدارة ويصلكم الرد عبر البريد الإلكتروني.'
          : 'For entities, schools and groups: enter your group and instructor details, then pick one of the open slots. The administration reviews the request and replies by email.'}
      </p>
    </header>
  );

  // ---------- Closed / unavailable states ----------
  if (!slotsState.loading && (!slotsState.open || slotsState.error) && !submitted) {
    return (
      <div className="fv" dir={isRTL ? 'rtl' : 'ltr'}>
        {topbar}
        <main className="fv-main">
          {hero}
          <div className="fv-card fv-closed">
            <div className="fv-closed-icon" aria-hidden="true">{slotsState.error ? '⚠️' : '⏸️'}</div>
            <h2>
              {slotsState.error
                ? (isRTL ? 'تعذّر تحميل المواعيد' : 'Could not load the visit slots')
                : (isRTL ? 'التسجيل في الزيارات مغلق حالياً' : 'Visit registration is closed for now')}
            </h2>
            <p>
              {slotsState.error
                ? (isRTL ? 'تحقق من اتصالك ثم أعد تحميل الصفحة.' : 'Check your connection and reload the page.')
                : (slotsState.reason || (isRTL ? 'يرجى المحاولة لاحقاً أو التواصل مع فاب لاب.' : 'Please try again later or contact FabLab.'))}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fv" dir={isRTL ? 'rtl' : 'ltr'}>
      {topbar}
      <main className="fv-main">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div key="form" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}>
              {hero}

              <form className="fv-card" onSubmit={submit} noValidate>
                {/* 1 — Entity + supervisor */}
                <div className="fv-section">
                  <div className="fv-section-title"><span className="fv-step-num">1</span>{isRTL ? 'الجهة الزائرة والمشرف' : 'Visiting Entity & Supervisor'}</div>
                  <div className="fv-grid">
                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'الجهة الزائرة *' : 'Visiting Entity *'}</label>
                      <input type="text" value={form.entityName} onChange={(e) => setField('entityName', e.target.value)} className={errors.entityName ? 'has-error' : ''}
                        placeholder={isRTL ? 'مثال: مدرسة الأحساء الأهلية' : 'e.g. Al-Ahsa National School'} />
                      {errors.entityName && <span className="fv-err">{errors.entityName}</span>}
                    </div>
                    <div className="fv-field">
                      <label>{isRTL ? 'اسم المشرف *' : 'Supervisor Name *'}</label>
                      <input type="text" value={form.supervisorName} onChange={(e) => setField('supervisorName', e.target.value)} className={errors.supervisorName ? 'has-error' : ''}
                        placeholder={isRTL ? 'الاسم الكامل' : 'Full name'} />
                      {errors.supervisorName && <span className="fv-err">{errors.supervisorName}</span>}
                    </div>
                    <div className="fv-field">
                      <label>{isRTL ? 'وظيفة المشرف *' : 'Supervisor Job *'}</label>
                      <input type="text" value={form.supervisorJob} onChange={(e) => setField('supervisorJob', e.target.value)} className={errors.supervisorJob ? 'has-error' : ''}
                        placeholder={isRTL ? 'مثال: معلم علوم، منسق نشاط' : 'e.g. Science teacher, activities coordinator'} />
                      {errors.supervisorJob && <span className="fv-err">{errors.supervisorJob}</span>}
                    </div>
                    <div className="fv-field">
                      <label>{isRTL ? 'رقم الجوال *' : 'Phone *'}</label>
                      <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={errors.phone ? 'has-error' : ''} dir="ltr" placeholder="05XXXXXXXX" />
                      {errors.phone && <span className="fv-err">{errors.phone}</span>}
                    </div>
                    <div className="fv-field">
                      <label>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
                      <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={errors.email ? 'has-error' : ''} dir="ltr" placeholder="name@example.com" />
                      {errors.email && <span className="fv-err">{errors.email}</span>}
                    </div>
                  </div>
                </div>

                {/* 2 — Visitors + instructors */}
                <div className="fv-section">
                  <div className="fv-section-title"><span className="fv-step-num">2</span>{isRTL ? 'الزوار والمرافقون' : 'Visitors & Instructors'}</div>
                  <div className="fv-grid">
                    <div className="fv-field">
                      <label>{isRTL ? 'عدد الزوار (الطلاب) *' : 'Number of Visitors (students) *'}</label>
                      <input type="number" min="1" max="1000" value={form.visitorsCount} onChange={(e) => setField('visitorsCount', e.target.value)}
                        className={errors.visitorsCount ? 'has-error' : ''} dir="ltr" placeholder="15" />
                      {errors.visitorsCount && <span className="fv-err">{errors.visitorsCount}</span>}
                    </div>
                  </div>

                  <div className={`fv-rule ${visitors > 0 ? 'is-live' : ''}`}>
                    <div className="fv-rule-icon" aria-hidden="true">👥</div>
                    <div>
                      <b>{isRTL ? 'لكل 15 زائراً يلزم مرافقان على الأقل' : 'At least 2 instructors for every 15 visitors'}</b>
                      <div className="fv-rule-sub">
                        {visitors > 0
                          ? (isRTL ? `عدد زواركم ${visitors} — يلزم ${need} مرافقين على الأقل.` : `${visitors} visitors — at least ${need} instructors are required.`)
                          : (isRTL ? '1–15 زائراً: مرافقان · 16–30: أربعة مرافقين · 31–45: ستة مرافقين… وهكذا.' : '1–15 visitors: 2 · 16–30: 4 · 31–45: 6 … and so on.')}
                      </div>
                    </div>
                  </div>

                  <label className="fv-check">
                    <input type="checkbox" checked={supervisorIsInstructor} onChange={(e) => setSupervisorIsInstructor(e.target.checked)} />
                    <span>{isRTL ? 'المشرف أحد المرافقين مع المجموعة' : 'The supervisor is one of the instructors'}</span>
                  </label>

                  <div className="fv-instructors">
                    {supervisorIsInstructor && (
                      <div className="fv-inst is-supervisor">
                        <div className="fv-inst-head">
                          <span className="fv-inst-num">1</span>
                          {isRTL ? 'المرافق 1 — المشرف' : 'Instructor 1 — supervisor'}
                        </div>
                        <div className="fv-inst-summary">
                          {supervisorEntry.name || (isRTL ? 'اسم المشرف' : 'Supervisor name')}
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
                            <span className="fv-inst-num">{n}</span>
                            {isRTL ? `المرافق ${n}` : `Instructor ${n}`}
                            {!required && (
                              <button type="button" className="fv-inst-remove" onClick={() => setInstructors(list => list.filter((_, k) => k !== i))}>
                                {isRTL ? 'إزالة' : 'Remove'}
                              </button>
                            )}
                          </div>
                          <div className="fv-inst-grid">
                            <input type="text" value={ins.name} onChange={(e) => setInstructor(i, { name: e.target.value })} placeholder={isRTL ? 'الاسم *' : 'Name *'} aria-label={isRTL ? 'اسم المرافق' : 'Instructor name'} />
                            <input type="tel" dir="ltr" value={ins.phone} onChange={(e) => setInstructor(i, { phone: e.target.value })} placeholder={isRTL ? 'الجوال *' : 'Phone *'} aria-label={isRTL ? 'جوال المرافق' : 'Instructor phone'} />
                            <input type="text" value={ins.job} onChange={(e) => setInstructor(i, { job: e.target.value })} placeholder={isRTL ? 'الوظيفة' : 'Job'} aria-label={isRTL ? 'وظيفة المرافق' : 'Instructor job'} />
                          </div>
                        </div>
                      );
                    })}
                    <button type="button" className="fv-inst-add" onClick={() => setInstructors(list => [...list, blankInstructor()])}>
                      + {isRTL ? 'إضافة مرافق آخر' : 'Add another instructor'}
                    </button>
                    {errors.instructors && <span className="fv-err">{errors.instructors}</span>}
                  </div>
                </div>

                {/* 3 — Slot (unlocks once the group is complete) */}
                <div className={`fv-section fv-slots ${slotsUnlocked ? '' : 'is-locked'}`}>
                  <div className="fv-section-title"><span className="fv-step-num">3</span>{isRTL ? 'اختر موعد الزيارة' : 'Choose a Visit Slot'}</div>

                  {!slotsUnlocked ? (
                    <div className="fv-lock">
                      <div className="fv-lock-icon" aria-hidden="true">🔒</div>
                      <div>
                        <b>{isRTL ? 'أكمل بيانات المجموعة أولاً لعرض المواعيد المتاحة' : 'Complete the group details first to see the open slots'}</b>
                        <ul>{missing.map(m => <li key={m}>{m}</li>)}</ul>
                      </div>
                    </div>
                  ) : slotsState.loading ? (
                    <div className="fv-slot-empty">{isRTL ? 'جارٍ تحميل المواعيد…' : 'Loading slots…'}</div>
                  ) : slotsState.slots.length === 0 ? (
                    <div className="fv-lock">
                      <div className="fv-lock-icon" aria-hidden="true">🗓️</div>
                      <div><b>{isRTL ? 'لا توجد مواعيد متاحة حالياً' : 'No slots are open right now'}</b>
                        <div className="fv-rule-sub">{isRTL ? 'تُفتح المواعيد من قِبل إدارة فاب لاب — يرجى المحاولة لاحقاً.' : 'FabLab opens new slots regularly — please check back later.'}</div></div>
                    </div>
                  ) : (
                    <div className="fv-slot-picker">
                      <div className={`fv-cal ${errors.slot ? 'has-error' : ''}`}>
                        <div className="fv-cal-header">
                          <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="fv-cal-nav" aria-label="prev">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRTL ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} /></svg>
                          </button>
                          <div className="fv-cal-month">{monthLabel}</div>
                          <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="fv-cal-nav" aria-label="next">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRTL ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} /></svg>
                          </button>
                        </div>
                        <div className="fv-cal-weekdays">{(isRTL ? DAY_SHORT_AR : DAY_SHORT_EN).map(d => <div key={d}>{d}</div>)}</div>
                        <div className="fv-cal-grid">
                          {monthGrid.map((d, i) => {
                            if (!d) return <div key={i} className="fv-cal-day fv-cal-day--empty" />;
                            const iso = toISO(d);
                            const daySlots = slotsByDate.get(iso) || [];
                            const fits = daySlots.some(s => s.capacity >= visitors);
                            const cls = ['fv-cal-day',
                              daySlots.length ? (fits ? 'has-slots' : 'has-small') : 'is-off',
                              selectedDate === iso && 'is-selected'].filter(Boolean).join(' ');
                            return (
                              <button key={iso} type="button" className={cls} disabled={!daySlots.length}
                                onClick={() => { setSelectedDate(iso); if (selectedSlot && selectedSlot.date !== iso) setSlotId(''); }}
                                title={daySlots.length ? `${daySlots.length} ${isRTL ? 'موعد' : 'slot(s)'}` : ''}>
                                {d.getDate()}
                                {daySlots.length > 0 && <span className="fv-cal-count">{daySlots.length}</span>}
                              </button>
                            );
                          })}
                        </div>
                        <div className="fv-cal-legend">
                          <span className="fv-cal-legend-item"><span className="fv-cal-dot is-avail" />{isRTL ? 'يوجد مواعيد' : 'Has slots'}</span>
                          <span className="fv-cal-legend-item"><span className="fv-cal-dot is-sel" />{isRTL ? 'مختار' : 'Selected'}</span>
                          <span className="fv-cal-legend-item"><span className="fv-cal-dot is-block" />{isRTL ? 'لا مواعيد' : 'No slots'}</span>
                        </div>
                      </div>

                      <div className="fv-daylist">
                        {!selectedDate ? (
                          <div className="fv-slot-empty">{isRTL ? 'اختر يوماً من التقويم لعرض مواعيده.' : 'Pick a day on the calendar to see its slots.'}</div>
                        ) : (
                          <>
                            <div className="fv-daylist-title">{fmtDateLong(selectedDate)}</div>
                            {(slotsByDate.get(selectedDate) || []).map(s => {
                              const tooSmall = s.capacity < visitors;
                              const sel = s.slotId === slotId;
                              return (
                                <button key={s.slotId} type="button" disabled={tooSmall}
                                  className={`fv-slotcard ${sel ? 'is-sel' : ''} ${tooSmall ? 'is-small' : ''}`}
                                  onClick={() => { setSlotId(s.slotId); if (errors.slot) setErrors(e => ({ ...e, slot: null })); }}>
                                  <span className="fv-slotcard-time" dir={isRTL ? 'rtl' : 'ltr'}>{fmtTime(s.startTime, isRTL)} – {fmtTime(s.endTime, isRTL)}</span>
                                  <span className="fv-slotcard-cap">
                                    {tooSmall
                                      ? (isRTL ? `يتسع لـ ${s.capacity} زائر فقط` : `Fits only ${s.capacity} visitors`)
                                      : (isRTL ? `حتى ${s.capacity} زائر` : `Up to ${s.capacity} visitors`)}
                                  </span>
                                  {sel && <span className="fv-slotcard-check" aria-hidden="true">✓</span>}
                                </button>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {errors.slot && slotsUnlocked && <span className="fv-err">{errors.slot}</span>}
                </div>

                {/* 4 — Optional details */}
                <div className="fv-section">
                  <div className="fv-section-title"><span className="fv-step-num">4</span>{isRTL ? 'تفاصيل إضافية (اختياري)' : 'More Details (optional)'}</div>
                  <div className="fv-grid">
                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'الغرض من الزيارة' : 'Purpose of the visit'}</label>
                      <textarea rows={3} value={form.purpose} onChange={(e) => setField('purpose', e.target.value)}
                        placeholder={isRTL ? 'الفئة العمرية، المواضيع التي تهمّكم…' : 'Age group, topics of interest…'} />
                    </div>
                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                      <textarea rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)}
                        placeholder={isRTL ? 'احتياجات خاصة، وسيلة الوصول…' : 'Special requirements, transport…'} />
                    </div>
                  </div>
                </div>

                {selectedSlot && (
                  <div className="fv-selected-summary">
                    <span>{isRTL ? 'الموعد المختار:' : 'Selected slot:'}</span>
                    <b>{fmtDateLong(selectedSlot.date)}</b>
                    <b dir={isRTL ? 'rtl' : 'ltr'}>{fmtTime(selectedSlot.startTime, isRTL)} – {fmtTime(selectedSlot.endTime, isRTL)}</b>
                  </div>
                )}

                <div className="fv-actions">
                  <button type="button" className="fv-btn fv-btn--ghost" onClick={resetAll} disabled={submitting}>{isRTL ? 'مسح' : 'Reset'}</button>
                  <button type="submit" className="fv-btn fv-btn--primary" disabled={submitting || !slotId}>
                    {submitting ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال طلب الحجز' : 'Submit Booking')}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div key="thanks" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.2, 0.9, 0.2, 1] }} className="fv-card fv-thanks">
              <div className="fv-thanks-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="fv-thanks-title">{isRTL ? 'تم استلام طلب الحجز' : 'Booking Request Received'}</h2>
              {submitted.visitNumber != null && (
                <div className="fv-thanks-number">{isRTL ? 'رقم الطلب' : 'Request No.'}: <b dir="ltr">V-{String(submitted.visitNumber).padStart(3, '0')}</b></div>
              )}
              <p className="fv-thanks-body">
                {isRTL
                  ? 'تم حجز الموعد لكم مبدئياً وسيُراجع الطلب من قِبل الإدارة، ويصلكم قرار الموافقة على البريد الإلكتروني المسجّل.'
                  : 'The slot is held for you while the administration reviews the request; the decision will be sent to your email.'}
              </p>
              <div className="fv-thanks-summary">
                <div><span>{isRTL ? 'الجهة' : 'Entity'}</span><b>{form.entityName}</b></div>
                {submitted.slot && <div><span>{isRTL ? 'التاريخ' : 'Date'}</span><b>{fmtDateLong(submitted.slot.date)}</b></div>}
                {submitted.slot && <div><span>{isRTL ? 'الوقت' : 'Time'}</span><b dir={isRTL ? 'rtl' : 'ltr'}>{fmtTime(submitted.slot.startTime, isRTL)} – {fmtTime(submitted.slot.endTime, isRTL)}</b></div>}
                <div><span>{isRTL ? 'الزوار' : 'Visitors'}</span><b>{visitors}</b></div>
                <div><span>{isRTL ? 'المرافقون' : 'Instructors'}</span><b>{allInstructors.length}</b></div>
              </div>
              <div className="fv-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
                <button className="fv-btn fv-btn--ghost" onClick={() => { resetAll(); setSubmitted(null); loadSlots(); }}>{isRTL ? 'حجز زيارة أخرى' : 'Book Another'}</button>
                <button className="fv-btn fv-btn--primary" onClick={() => navigate('/register')}>{isRTL ? 'العودة للرئيسية' : 'Back to Home'}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default FablabVisitForm;
