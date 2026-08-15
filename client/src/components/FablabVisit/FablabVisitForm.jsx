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

const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT_AR = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
const DAY_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const initialForm = {
  entityName: '',
  personInCharge: '',
  nationalId: '',
  phone: '',
  email: '',
  visitorsCount: 1,
  visitDate: '',
  visitStartTime: '',
  visitEndTime: '',
  purpose: '',
  notes: '',
  overrideCode: ''
};

// Format Date → 'YYYY-MM-DD' in local time (no UTC drift).
const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Generate 30-min slots from HH:MM start (inclusive) to HH:MM end (exclusive for start slots).
const generateSlots = (startHHMM, endHHMM) => {
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin   = eh * 60 + em;
  const slots = [];
  for (let m = startMin; m <= endMin; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return slots;
};

const FablabVisitForm = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedNumber, setSubmittedNumber] = useState(null);
  const [errors, setErrors] = useState({});

  const [workingHours, setWorkingHours] = useState({ startTime: '11:00', endTime: '19:00', workingDays: [0, 1, 2, 3, 4] });
  const [closures, setClosures] = useState([]);
  const [overrideMode, setOverrideMode] = useState(false); // toggled by user when they need to bypass restrictions

  // Calendar view state
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [viewMonth, setViewMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => {
    (async () => {
      try {
        const [wh, cl] = await Promise.all([
          axios.get(`${API_URL}/settings/working-hours`),
          axios.get(`${API_URL}/closures`)
        ]);
        setWorkingHours(wh.data || workingHours);
        setClosures(Array.isArray(cl.data) ? cl.data : []);
      } catch (er) {
        console.warn('Failed to load working hours/closures — using defaults', er?.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (name, value) => {
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: null }));
  };

  // Given a Date, describe why it can't be picked (or null if it can).
  const dayBlockReason = useCallback((d) => {
    const dayDate = new Date(d); dayDate.setHours(0, 0, 0, 0);
    if (dayDate < today) return 'past';
    const dow = dayDate.getDay();
    if (!workingHours.workingDays.includes(dow)) return 'off-day';
    const iso = toISO(dayDate);
    for (const c of closures) {
      const s = String(c.startDate).slice(0, 10);
      const e = String(c.endDate).slice(0, 10);
      if (iso >= s && iso <= e) return { type: 'closure', reasonAr: c.reasonAr, reasonEn: c.reasonEn, from: s, to: e };
    }
    return null;
  }, [today, workingHours.workingDays, closures]);

  // Time slots respect working hours; when override is on, allow the full day.
  const startSlots = useMemo(() => {
    if (overrideMode) return generateSlots('06:00', '22:00');
    // Start slots: workingStart .. workingEnd - 30 min
    const [eh, em] = workingHours.endTime.split(':').map(Number);
    const lastStartMin = eh * 60 + em - 30;
    const lastStart = `${String(Math.floor(lastStartMin/60)).padStart(2,'0')}:${String(lastStartMin%60).padStart(2,'0')}`;
    return generateSlots(workingHours.startTime, lastStart);
  }, [workingHours, overrideMode]);

  const endSlots = useMemo(() => {
    if (!form.visitStartTime) return [];
    const [sh, sm] = form.visitStartTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const [eh, em] = (overrideMode ? '22:00' : workingHours.endTime).split(':').map(Number);
    const endBound = eh * 60 + em;
    const firstEndMin = startMin + 30;
    if (firstEndMin > endBound) return [];
    const firstEnd = `${String(Math.floor(firstEndMin/60)).padStart(2,'0')}:${String(firstEndMin%60).padStart(2,'0')}`;
    return generateSlots(firstEnd, overrideMode ? '22:00' : workingHours.endTime);
  }, [form.visitStartTime, workingHours, overrideMode]);

  // When override toggles off, clear anything that's now invalid.
  useEffect(() => {
    if (overrideMode) return;
    if (form.visitDate) {
      const reason = dayBlockReason(new Date(`${form.visitDate}T00:00:00`));
      if (reason) setForm(f => ({ ...f, visitDate: '', visitStartTime: '', visitEndTime: '' }));
    }
  }, [overrideMode, dayBlockReason, form.visitDate]);

  // If end < start, drop end
  useEffect(() => {
    if (form.visitStartTime && form.visitEndTime && form.visitEndTime <= form.visitStartTime) {
      setForm(f => ({ ...f, visitEndTime: '' }));
    }
  }, [form.visitStartTime, form.visitEndTime]);

  const validate = () => {
    const err = {};
    if (!form.entityName.trim())     err.entityName = isRTL ? 'مطلوب' : 'Required';
    if (!form.personInCharge.trim()) err.personInCharge = isRTL ? 'مطلوب' : 'Required';
    if (!form.nationalId.trim())     err.nationalId = isRTL ? 'مطلوب' : 'Required';
    if (!form.phone.trim())          err.phone = isRTL ? 'مطلوب' : 'Required';
    if (!form.email.trim())          err.email = isRTL ? 'مطلوب' : 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      err.email = isRTL ? 'بريد غير صالح' : 'Invalid email';
    if (!form.visitDate)      err.visitDate      = isRTL ? 'اختر تاريخاً' : 'Pick a date';
    if (!form.visitStartTime) err.visitStartTime = isRTL ? 'اختر بداية' : 'Pick a start';
    if (!form.visitEndTime)   err.visitEndTime   = isRTL ? 'اختر نهاية' : 'Pick an end';
    if (!form.purpose.trim())        err.purpose = isRTL ? 'مطلوب' : 'Required';
    if (!(Number(form.visitorsCount) > 0)) err.visitorsCount = isRTL ? 'قيمة غير صحيحة' : 'Invalid';
    if (overrideMode && !form.overrideCode.trim()) {
      err.overrideCode = isRTL
        ? 'الرمز مطلوب للتسجيل خارج الأوقات المتاحة'
        : 'Code required to submit outside allowed times';
    }
    return err;
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length) {
      toast.error(isRTL ? 'يوجد حقول ناقصة' : 'Please fill in required fields');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API_URL}/public/fablab-visit/submit`, {
        ...form,
        visitorsCount: Number(form.visitorsCount) || 1,
        overrideCode: overrideMode ? form.overrideCode.trim() : null
      });
      setSubmittedNumber(data?.visitNumber ?? null);
      setSubmitted(true);
      toast.success(isRTL ? 'تم إرسال طلبك' : 'Request submitted');
    } catch (er) {
      const resp = er?.response?.data;
      if (resp?.requiresOverride) {
        setOverrideMode(true);
        setErrors(e2 => ({ ...e2, overrideCode: isRTL ? 'الرمز مطلوب / غير صالح' : 'Code required / invalid' }));
      }
      toast.error(resp?.messageAr || resp?.message || (isRTL ? 'حدث خطأ' : 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  const activeClosures = closures.slice(0, 4);
  const workingDaysLabel = workingHours.workingDays
    .map(d => (isRTL ? DAY_NAMES_AR[d] : DAY_NAMES_EN[d]))
    .join('، ');

  // ---------- Calendar rendering ----------
  const monthGrid = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const last  = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    const days = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null); // pad
    for (let d = 1; d <= last.getDate(); d++) {
      days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [viewMonth]);

  const goPrev = () => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNext = () => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const monthLabel = `${isRTL ? MONTH_NAMES_AR[viewMonth.getMonth()] : MONTH_NAMES_EN[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;

  return (
    <div className="fv" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="fv-topbar">
        <div className="fv-topbar-inner">
          <button className="fv-topbar-brand" onClick={() => navigate('/register')} type="button">
            <img src="/logo.png" alt="" className="fv-topbar-logo" />
            <div className="fv-topbar-titles">
              <span className="fv-topbar-title">{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</span>
              <span className="fv-topbar-sub">{isRTL ? 'طلب زيارة' : 'Visit Request'}</span>
            </div>
          </button>
          <button
            className="fv-topbar-back"
            type="button"
            onClick={() => navigate('/register')}
            title={isRTL ? 'العودة' : 'Back'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>{isRTL ? 'الرئيسية' : 'Home'}</span>
          </button>
        </div>
      </header>

      <main className="fv-main">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <header className="fv-hero">
                <span className="fv-hero-eyebrow">{isRTL ? 'زيارات فاب لاب' : 'FABLAB VISITS'}</span>
                <h1 className="fv-hero-title">
                  {isRTL ? 'طلب زيارة لفاب لاب الأحساء' : 'Request a Visit to FabLab Al-Ahsa'}
                </h1>
                <p className="fv-hero-sub">
                  {isRTL
                    ? 'يمكن للجهات والمدارس والوفود تقديم طلب زيارة تعريفية أو استكشافية. سيتم مراجعة الطلب من قِبل الإدارة والرد عليكم عبر البريد الإلكتروني.'
                    : 'Entities, schools, and groups can request an introductory or exploratory tour. The administration will review your request and reply by email.'}
                </p>
              </header>

              <div className="fv-availability">
                <div className="fv-availability-row">
                  <div className="fv-availability-cell">
                    <span className="fv-availability-label">{isRTL ? 'أيام العمل' : 'Working Days'}</span>
                    <span className="fv-availability-value">{workingDaysLabel}</span>
                  </div>
                  <div className="fv-availability-cell">
                    <span className="fv-availability-label">{isRTL ? 'ساعات العمل' : 'Working Hours'}</span>
                    <span className="fv-availability-value" dir="ltr">{workingHours.startTime} – {workingHours.endTime}</span>
                  </div>
                </div>
                {activeClosures.length > 0 && (
                  <div className="fv-closures">
                    <span className="fv-closures-title">{isRTL ? 'فترات إغلاق' : 'Closures'}</span>
                    <ul>
                      {activeClosures.map(c => (
                        <li key={c.closureId}>
                          <span dir="ltr">{String(c.startDate).slice(0,10)} → {String(c.endDate).slice(0,10)}</span>
                          {' — '}{isRTL ? (c.reasonAr || c.reasonEn) : c.reasonEn}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <form className="fv-card" onSubmit={submit} noValidate>
                <div className="fv-section">
                  <div className="fv-section-title">{isRTL ? 'معلومات الجهة' : 'Entity Information'}</div>
                  <div className="fv-grid">
                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'اسم الجهة / المدرسة *' : 'Entity / School Name *'}</label>
                      <input
                        type="text"
                        value={form.entityName}
                        onChange={(e) => setField('entityName', e.target.value)}
                        className={errors.entityName ? 'has-error' : ''}
                        placeholder={isRTL ? 'مثال: مدرسة الأحساء الأهلية' : 'e.g. Al-Ahsa National School'}
                      />
                      {errors.entityName && <span className="fv-err">{errors.entityName}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'الشخص المسؤول *' : 'Person in Charge *'}</label>
                      <input
                        type="text"
                        value={form.personInCharge}
                        onChange={(e) => setField('personInCharge', e.target.value)}
                        className={errors.personInCharge ? 'has-error' : ''}
                        placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
                      />
                      {errors.personInCharge && <span className="fv-err">{errors.personInCharge}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'رقم الهوية *' : 'National ID *'}</label>
                      <input
                        type="text"
                        value={form.nationalId}
                        onChange={(e) => setField('nationalId', e.target.value)}
                        className={errors.nationalId ? 'has-error' : ''}
                        inputMode="numeric"
                        dir="ltr"
                        placeholder={isRTL ? '10 أرقام' : '10 digits'}
                      />
                      {errors.nationalId && <span className="fv-err">{errors.nationalId}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'رقم الجوال *' : 'Phone *'}</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                        className={errors.phone ? 'has-error' : ''}
                        dir="ltr"
                        placeholder="05XXXXXXXX"
                      />
                      {errors.phone && <span className="fv-err">{errors.phone}</span>}
                    </div>

                    <div className="fv-field">
                      <label>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setField('email', e.target.value)}
                        className={errors.email ? 'has-error' : ''}
                        dir="ltr"
                        placeholder="name@example.com"
                      />
                      {errors.email && <span className="fv-err">{errors.email}</span>}
                    </div>
                  </div>
                </div>

                <div className="fv-section">
                  <div className="fv-section-title">{isRTL ? 'تفاصيل الزيارة' : 'Visit Details'}</div>

                  <div className="fv-grid">
                    <div className="fv-field">
                      <label>{isRTL ? 'عدد الزوار *' : 'Number of Visitors *'}</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={form.visitorsCount}
                        onChange={(e) => setField('visitorsCount', e.target.value)}
                        className={errors.visitorsCount ? 'has-error' : ''}
                        dir="ltr"
                      />
                      {errors.visitorsCount && <span className="fv-err">{errors.visitorsCount}</span>}
                    </div>
                  </div>

                  {/* Override toggle */}
                  <label className={`fv-override-toggle ${overrideMode ? 'is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={overrideMode}
                      onChange={(e) => setOverrideMode(e.target.checked)}
                    />
                    <div className="fv-override-toggle-body">
                      <div className="fv-override-toggle-title">
                        {isRTL ? 'أحتاج لتقديم الطلب خارج الأوقات المتاحة' : 'I need to submit outside allowed times'}
                      </div>
                      <div className="fv-override-toggle-hint">
                        {isRTL
                          ? 'لتفعيل هذا الخيار يجب التواصل مع إدارة فاب لاب للحصول على رمز خاص صالح لمدة 5 دقائق. بدون تفعيله، لن تتمكن من اختيار أيام أو أوقات خارج جدول العمل.'
                          : 'To enable this you must contact FABLAB administration for a special 5-minute code. Without it, you can only pick days and times within the working schedule.'}
                      </div>
                    </div>
                  </label>

                  {/* Calendar */}
                  <div className="fv-cal-block">
                    <label className="fv-cal-label">
                      {isRTL ? 'اختر تاريخ الزيارة *' : 'Select Visit Date *'}
                    </label>

                    <div className={`fv-cal ${errors.visitDate ? 'has-error' : ''}`}>
                      <div className="fv-cal-header">
                        <button type="button" onClick={goPrev} className="fv-cal-nav" aria-label="prev">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRTL ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/></svg>
                        </button>
                        <div className="fv-cal-month">{monthLabel}</div>
                        <button type="button" onClick={goNext} className="fv-cal-nav" aria-label="next">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={isRTL ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}/></svg>
                        </button>
                      </div>

                      <div className="fv-cal-weekdays">
                        {(isRTL ? DAY_SHORT_AR : DAY_SHORT_EN).map(d => <div key={d}>{d}</div>)}
                      </div>

                      <div className="fv-cal-grid">
                        {monthGrid.map((d, i) => {
                          if (!d) return <div key={i} className="fv-cal-day fv-cal-day--empty" />;
                          const iso = toISO(d);
                          const isSelected = form.visitDate === iso;
                          const isToday = iso === toISO(today);
                          const block = dayBlockReason(d);
                          const isDisabled = !!block && !overrideMode;
                          const cls = [
                            'fv-cal-day',
                            isSelected && 'is-selected',
                            isToday && !isSelected && 'is-today',
                            block === 'past' && 'is-past',
                            block === 'off-day' && 'is-off',
                            block && typeof block === 'object' && 'is-closure',
                            overrideMode && block && 'is-override'
                          ].filter(Boolean).join(' ');
                          const title = (block && typeof block === 'object')
                            ? `${isRTL ? 'إغلاق' : 'Closure'}: ${isRTL ? (block.reasonAr || block.reasonEn) : block.reasonEn}`
                            : block === 'off-day' ? (isRTL ? 'خارج أيام العمل' : 'Not a working day')
                            : block === 'past' ? (isRTL ? 'تاريخ منقضٍ' : 'Past date')
                            : '';
                          return (
                            <button
                              key={iso}
                              type="button"
                              disabled={block === 'past' || isDisabled}
                              onClick={() => {
                                if (block === 'past' || isDisabled) return;
                                setField('visitDate', iso);
                                setField('visitStartTime', '');
                                setField('visitEndTime', '');
                              }}
                              className={cls}
                              title={title}
                            >
                              {d.getDate()}
                            </button>
                          );
                        })}
                      </div>

                      <div className="fv-cal-legend">
                        <span className="fv-cal-legend-item"><span className="fv-cal-dot is-avail" />{isRTL ? 'متاح' : 'Available'}</span>
                        <span className="fv-cal-legend-item"><span className="fv-cal-dot is-sel" />{isRTL ? 'مختار' : 'Selected'}</span>
                        <span className="fv-cal-legend-item"><span className="fv-cal-dot is-block" />{isRTL ? 'غير متاح' : 'Unavailable'}</span>
                        {overrideMode && (
                          <span className="fv-cal-legend-item"><span className="fv-cal-dot is-override" />{isRTL ? 'متاح بالرمز' : 'Available with code'}</span>
                        )}
                      </div>
                    </div>
                    {errors.visitDate && <span className="fv-err">{errors.visitDate}</span>}
                  </div>

                  {/* Time slots */}
                  {form.visitDate && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="fv-slot-block"
                    >
                      <label className="fv-cal-label">
                        {isRTL ? 'وقت الزيارة *' : 'Visit Time *'}
                        <span className="fv-cal-label-hint" dir="ltr">
                          {overrideMode ? '06:00–22:00' : `${workingHours.startTime}–${workingHours.endTime}`}
                        </span>
                      </label>

                      <div className="fv-slot-row">
                        <div className="fv-slot-col">
                          <div className="fv-slot-col-title">{isRTL ? 'البداية' : 'Start'}</div>
                          <div className="fv-slot-grid">
                            {startSlots.map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setField('visitStartTime', t)}
                                className={`fv-slot ${form.visitStartTime === t ? 'is-sel' : ''}`}
                              >{t}</button>
                            ))}
                          </div>
                          {errors.visitStartTime && <span className="fv-err">{errors.visitStartTime}</span>}
                        </div>

                        <div className="fv-slot-col">
                          <div className="fv-slot-col-title">{isRTL ? 'النهاية' : 'End'}</div>
                          {form.visitStartTime ? (
                            <div className="fv-slot-grid">
                              {endSlots.length ? endSlots.map(t => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setField('visitEndTime', t)}
                                  className={`fv-slot ${form.visitEndTime === t ? 'is-sel' : ''}`}
                                >{t}</button>
                              )) : (
                                <div className="fv-slot-empty">{isRTL ? 'لا توجد أوقات نهاية بعد البداية المختارة' : 'No end slots after the selected start'}</div>
                              )}
                            </div>
                          ) : (
                            <div className="fv-slot-empty">{isRTL ? 'اختر وقت البداية أولاً' : 'Pick a start time first'}</div>
                          )}
                          {errors.visitEndTime && <span className="fv-err">{errors.visitEndTime}</span>}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="fv-grid" style={{ marginTop: 16 }}>
                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'الغرض من الزيارة *' : 'Purpose of Visit *'}</label>
                      <textarea
                        rows={4}
                        value={form.purpose}
                        onChange={(e) => setField('purpose', e.target.value)}
                        className={errors.purpose ? 'has-error' : ''}
                        placeholder={isRTL
                          ? 'اشرح باختصار الغرض من الزيارة، الفئة المستفيدة، والاهتمامات...'
                          : 'Briefly describe the purpose, audience, and topics of interest...'}
                      />
                      {errors.purpose && <span className="fv-err">{errors.purpose}</span>}
                    </div>

                    <div className="fv-field fv-field--full">
                      <label>{isRTL ? 'ملاحظات إضافية (اختياري)' : 'Additional Notes (optional)'}</label>
                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setField('notes', e.target.value)}
                        placeholder={isRTL
                          ? 'احتياجات خاصة، لغة التعريف، وسيلة الوصول...'
                          : 'Special requirements, language preference, transport...'}
                      />
                    </div>
                  </div>
                </div>

                {/* Override code field — only when override mode is on */}
                {overrideMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fv-override"
                  >
                    <div className="fv-override-badge">🔑 {isRTL ? 'رمز الإدارة' : 'Administration Code'}</div>
                    <div className="fv-override-body">
                      <p className="fv-override-explain">
                        {isRTL
                          ? 'أدخل الرمز الذي حصلت عليه من إدارة فاب لاب. الرمز مكوّن من 6 أحرف/أرقام وصالح لمدة 5 دقائق فقط.'
                          : 'Enter the code you received from FABLAB administration. It is 6 characters and valid for 5 minutes only.'}
                      </p>
                      <div className="fv-field fv-field--full">
                        <label>{isRTL ? 'السماح بالتسجيل من قبل إدارة فاب لاب' : 'FABLAB Administration Override Code'}</label>
                        <input
                          type="text"
                          value={form.overrideCode}
                          onChange={(e) => setField('overrideCode', e.target.value.toUpperCase())}
                          className={errors.overrideCode ? 'has-error' : ''}
                          placeholder="ABC123"
                          maxLength={12}
                          dir="ltr"
                          style={{ letterSpacing: '4px', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', fontSize: 18, fontWeight: 700 }}
                        />
                        {errors.overrideCode && <span className="fv-err">{errors.overrideCode}</span>}
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className="fv-actions">
                  <button
                    type="button"
                    className="fv-btn fv-btn--ghost"
                    onClick={() => { setForm(initialForm); setOverrideMode(false); }}
                    disabled={submitting}
                  >
                    {isRTL ? 'مسح' : 'Reset'}
                  </button>
                  <button
                    type="submit"
                    className="fv-btn fv-btn--primary"
                    disabled={submitting}
                  >
                    {submitting
                      ? (isRTL ? 'جارٍ الإرسال...' : 'Submitting...')
                      : (isRTL ? 'إرسال الطلب' : 'Submit Request')}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.2, 0.9, 0.2, 1] }}
              className="fv-card fv-thanks"
            >
              <div className="fv-thanks-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="fv-thanks-title">
                {isRTL ? 'تم استلام طلبك' : 'Request Received'}
              </h2>
              {submittedNumber != null && (
                <div className="fv-thanks-number">
                  {isRTL ? 'رقم الطلب' : 'Request No.'}: <b dir="ltr">V-{String(submittedNumber).padStart(3, '0')}</b>
                </div>
              )}
              <p className="fv-thanks-body">
                {isRTL
                  ? 'سيتم مراجعة طلب الزيارة من قِبل الإدارة، والرد عليكم على البريد الإلكتروني المسجّل خلال أيام العمل التالية.'
                  : 'The administration will review your request and reply to your registered email within the next business days.'}
              </p>
              <div className="fv-thanks-summary">
                <div><span>{isRTL ? 'الجهة' : 'Entity'}</span><b>{form.entityName}</b></div>
                <div><span>{isRTL ? 'التاريخ' : 'Date'}</span><b dir="ltr">{form.visitDate}</b></div>
                <div><span>{isRTL ? 'الوقت' : 'Time'}</span><b dir="ltr">{form.visitStartTime} → {form.visitEndTime}</b></div>
                <div><span>{isRTL ? 'الزوار' : 'Visitors'}</span><b>{form.visitorsCount}</b></div>
              </div>
              <div className="fv-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
                <button className="fv-btn fv-btn--ghost" onClick={() => { setForm(initialForm); setSubmitted(false); setSubmittedNumber(null); setOverrideMode(false); }}>
                  {isRTL ? 'تقديم طلب آخر' : 'Submit Another'}
                </button>
                <button className="fv-btn fv-btn--primary" onClick={() => navigate('/register')}>
                  {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default FablabVisitForm;
