import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import { RULES, POLICY } from './workspaceTerms';
import './WorkspaceRegistration.css';

// Public workspace registration (/workspace): a beneficiary fills their
// details, picks a period (up to one month) and a daily time inside
// FabLab hours, then one of the 8 workspaces that is free for all of it,
// and accepts the workspace terms. The admin / manager accept or reject
// the request and the person is told by email.

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const APPLICANT_TYPES = [
  { value: 'Beneficiary', ar: 'مستفيد', en: 'Beneficiary' },
  { value: 'Talented', ar: 'موهوب', en: 'Talented' },
  { value: 'Visitor', ar: 'زائر', en: 'Visitor' },
  { value: 'Entity', ar: 'جهة', en: 'Entity' }
];

const DEFAULT_HOURS = { start: '10:00', end: '17:00' };
const DEFAULT_DAYS = [0, 1, 2, 3, 4];
const DEFAULT_DAYS_AHEAD = 90;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const initialForm = {
  fullName: '',
  phone: '',
  email: '',
  applicantType: '',
  organization: '',
  projectName: '',
  projectDescription: '',
  peopleCount: '1'
};
const initialPeriod = { startDate: '', endDate: '', startTime: '', endTime: '' };

// ---------- date / time helpers (local calendar dates, 'YYYY-MM-DD') ----------
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
// One calendar month later (31 Jan → 28/29 Feb).
const addOneMonth = (iso) => {
  const d = parseISO(iso);
  if (!d) return '';
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISO(t);
};
const toMin = (t) => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isNaN(h) ? NaN : h * 60 + (m || 0);
};
const fromMin = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
const fmtTime = (t, isRTL) => {
  const [h, m] = String(t || '').split(':').map(Number);
  if (Number.isNaN(h)) return t;
  const suffix = h < 12 ? (isRTL ? 'ص' : 'AM') : (isRTL ? 'م' : 'PM');
  return `${((h + 11) % 12) + 1}:${pad(m || 0)} ${suffix}`;
};
const fmtDate = (iso, isRTL) => {
  const d = parseISO(iso);
  if (!d) return iso;
  return isRTL
    ? `${DAY_NAMES_AR[d.getDay()]} ${d.getDate()} ${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`
    : `${DAY_NAMES_EN[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES_EN[d.getMonth()]} ${d.getFullYear()}`;
};
const addDays = (iso, n) => {
  const d = parseISO(iso);
  if (!d) return '';
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const countWorkingDays = (startIso, endIso, days) => {
  const s = parseISO(startIso);
  const e = parseISO(endIso);
  if (!s || !e || e < s) return 0;
  let n = 0;
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) if (days.includes(d.getDay())) n++;
  return n;
};
// 05xxxxxxxx — also accepts Arabic digits, spaces and +966 / 966.
const normalisePhone = (v) => {
  let p = String(v || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\s()-]/g, '');
  if (p.startsWith('+966')) p = `0${p.slice(4)}`;
  else if (p.startsWith('966')) p = `0${p.slice(3)}`;
  return p;
};
const hoursLabel = (mins, isRTL) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (isRTL) {
    const hh = h === 0 ? '' : h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : `${h} ${h <= 10 ? 'ساعات' : 'ساعة'}`;
    const mm = m ? `${m} دقيقة` : '';
    return hh && mm ? `${hh} و${mm}` : (hh || mm);
  }
  return m ? `${h}h ${m}m` : `${h} hour${h === 1 ? '' : 's'}`;
};

const Icon = ({ d, children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

const WorkspaceRegistration = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [status, setStatus] = useState({ loading: true, open: true, reason: '', error: false, units: [], hours: DEFAULT_HOURS, workingDays: DEFAULT_DAYS, today: toISO(new Date()), maxDaysAhead: DEFAULT_DAYS_AHEAD });
  const [form, setForm] = useState(initialForm);
  const [period, setPeriod] = useState(initialPeriod);
  const [unitCode, setUnitCode] = useState('');
  const [avail, setAvail] = useState({ loading: false, units: null, error: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  // A 400 from the server names the field it refused.
  const [serverErr, setServerErr] = useState(null); // { field, text }
  const availReq = useRef(0);

  useEffect(() => { document.documentElement.lang = isRTL ? 'ar' : 'en'; }, [isRTL]);
  useEffect(() => {
    document.title = isRTL ? 'تسجيل مساحات العمل — فاب لاب الأحساء' : 'Workspace Registration — FabLab Al-Ahsa';
  }, [isRTL]);

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/public/workspace/status`);
      setStatus({
        loading: false,
        error: false,
        open: data.open !== false,
        reason: data.reason || '',
        units: Array.isArray(data.units) ? data.units : [],
        hours: data.hours?.start && data.hours?.end ? data.hours : DEFAULT_HOURS,
        workingDays: Array.isArray(data.workingDays) && data.workingDays.length ? data.workingDays : DEFAULT_DAYS,
        today: data.today || toISO(new Date()),
        maxDaysAhead: Number(data.maxDaysAhead) > 0 ? Number(data.maxDaysAhead) : DEFAULT_DAYS_AHEAD
      });
    } catch (e) {
      setStatus(s => ({ ...s, loading: false, error: true }));
    }
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const { hours, workingDays, today, maxDaysAhead } = status;
  const lastStart = addDays(today, maxDaysAhead);
  const openMin = toMin(hours.start);
  const closeMin = toMin(hours.end);
  const startTimes = useMemo(() => {
    const out = [];
    for (let t = openMin; t <= closeMin - 30; t += 30) out.push(fromMin(t));
    return out;
  }, [openMin, closeMin]);
  const endTimes = useMemo(() => {
    const from = period.startTime ? toMin(period.startTime) + 30 : openMin + 30;
    const out = [];
    for (let t = from; t <= closeMin; t += 30) out.push(fromMin(t));
    return out;
  }, [period.startTime, openMin, closeMin]);

  const maxEnd = period.startDate ? addOneMonth(period.startDate) : '';

  // What is wrong with the period / time (null when it can be checked).
  const periodError = useMemo(() => {
    const { startDate, endDate, startTime, endTime } = period;
    if (startDate && startDate < today) return isRTL ? 'تاريخ البداية لا يمكن أن يكون في الماضي' : 'The start date cannot be in the past';
    if (startDate && startDate > lastStart) return isRTL ? `يمكن الحجز قبل ${maxDaysAhead} يومًا كحد أقصى` : `You can book at most ${maxDaysAhead} days ahead`;
    if (startDate && endDate && endDate < startDate) return isRTL ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'The end date must be on or after the start date';
    if (startDate && endDate && endDate > addOneMonth(startDate)) return isRTL ? 'لا تتجاوز مدة الحجز شهرًا واحدًا' : 'A booking cannot be longer than one month';
    if (startTime && endTime) {
      const s = toMin(startTime);
      const e = toMin(endTime);
      if (s < openMin || e > closeMin) return isRTL ? `الوقت يجب أن يكون بين ${fmtTime(hours.start, true)} و${fmtTime(hours.end, true)}` : `The time must be between ${fmtTime(hours.start, false)} and ${fmtTime(hours.end, false)}`;
      if (e <= s) return isRTL ? 'وقت الانتهاء يجب أن يكون بعد وقت البدء' : 'The end time must be after the start time';
    }
    if (startDate && endDate && endDate >= startDate && countWorkingDays(startDate, endDate, workingDays) === 0) {
      return isRTL ? 'الفترة المختارة لا تتضمن أي يوم عمل (الأحد – الخميس)' : 'The period has no working day (Sunday – Thursday)';
    }
    return null;
  }, [period, today, lastStart, maxDaysAhead, openMin, closeMin, hours, workingDays, isRTL]);

  const periodReady = !!(period.startDate && period.endDate && period.startTime && period.endTime) && !periodError;
  const workDays = periodReady ? countWorkingDays(period.startDate, period.endDate, workingDays) : 0;
  const dailyMins = periodReady ? toMin(period.endTime) - toMin(period.startTime) : 0;

  const loadAvailability = useCallback(async (p) => {
    const id = ++availReq.current;
    setAvail(a => ({ ...a, loading: true, error: '' }));
    try {
      const { data } = await axios.get(`${API_URL}/public/workspace/availability`, { params: p });
      if (id !== availReq.current) return;
      const units = Array.isArray(data.units) ? data.units : [];
      setAvail({ loading: false, units, error: '' });
      setUnitCode(code => (code && units.some(u => u.code === code && u.available) ? code : ''));
    } catch (e) {
      if (id !== availReq.current) return;
      const d = e.response?.data || {};
      if (e.response?.status === 403 && d.code === 'WORKSPACE_CLOSED') {
        setStatus(s => ({ ...s, open: false, reason: d.reason || d.messageAr || '' }));
        return;
      }
      setAvail({
        loading: false,
        units: null,
        error: (isRTL ? d.messageAr : d.message) || (isRTL ? 'تعذّر التحقق من المساحات المتاحة' : 'Could not check the free workspaces')
      });
      setUnitCode('');
    }
  }, [isRTL]);

  // Re-check the free workspaces whenever a complete, valid period is set.
  useEffect(() => {
    if (!periodReady) {
      availReq.current++;
      setAvail({ loading: false, units: null, error: '' });
      setUnitCode('');
      return undefined;
    }
    const t = setTimeout(() => loadAvailability({ ...period }), 250);
    return () => clearTimeout(t);
  }, [periodReady, period, loadAvailability]);

  const clearServerErr = (name) => setServerErr(e => (e && e.field === name ? null : e));
  const setField = (name, value) => { setForm(f => ({ ...f, [name]: value })); clearServerErr(name); };
  const touch = (name) => setTouched(t => ({ ...t, [name]: true }));
  const setPeriodField = (name, value) => { clearServerErr(name); setPeriod(p => {
    const next = { ...p, [name]: value };
    // Keep the end date / time consistent with a new start.
    if (name === 'startDate' && value) {
      if (next.endDate && (next.endDate < value || next.endDate > addOneMonth(value))) next.endDate = '';
    }
    if (name === 'startTime' && value && next.endTime && toMin(next.endTime) <= toMin(value)) next.endTime = '';
    return next;
  }); };

  // Field problems (shown once a field was touched or on a send attempt).
  const fieldErrors = useMemo(() => {
    const e = {};
    if (form.fullName.trim().length < 3) e.fullName = isRTL ? 'اكتب الاسم الكامل' : 'Enter your full name';
    if (!/^05\d{8}$/.test(normalisePhone(form.phone))) e.phone = isRTL ? 'رقم جوال سعودي يبدأ بـ 05 (10 أرقام)' : 'A Saudi mobile starting with 05 (10 digits)';
    if (!EMAIL_RE.test(form.email.trim())) e.email = isRTL ? 'بريد إلكتروني غير صحيح' : 'Invalid email';
    if (!form.applicantType) e.applicantType = isRTL ? 'اختر صفة المسجّل' : 'Choose who you are';
    if (!form.projectName.trim()) e.projectName = isRTL ? 'اكتب اسم المشروع' : 'Enter the project name';
    const n = Number(form.peopleCount);
    if (!(n >= 1 && n <= 4)) e.peopleCount = isRTL ? 'من 1 إلى 4 أشخاص' : '1 to 4 people';
    return e;
  }, [form, isRTL]);
  const showErr = (k) => (serverErr?.field === k && serverErr.text) || ((touched[k] || touched.__all) && fieldErrors[k]);
  const PERIOD_FIELDS = ['startDate', 'endDate', 'startTime', 'endTime'];
  const periodServerErr = serverErr && PERIOD_FIELDS.includes(serverErr.field) ? serverErr.text : null;

  // What still blocks sending, in order.
  const missing = useMemo(() => {
    const m = [];
    if (Object.keys(fieldErrors).length) m.push(isRTL ? 'البيانات الشخصية' : 'your details');
    if (!periodReady) m.push(isRTL ? 'الفترة والوقت' : 'the period and time');
    else if (!unitCode) m.push(isRTL ? 'مساحة العمل' : 'a workspace');
    if (!acceptTerms) m.push(isRTL ? 'الموافقة على الشروط' : 'accepting the terms');
    return m;
  }, [fieldErrors, periodReady, unitCode, acceptTerms, isRTL]);
  const canSubmit = missing.length === 0 && !submitting;

  const units = useMemo(() => {
    const base = status.units.length ? status.units : Array.from({ length: 8 }, (_, i) => ({ code: `WS${i + 1}`, label: `مساحة العمل ${i + 1}`, labelEn: `Workspace ${i + 1}` }));
    const byCode = Object.fromEntries((avail.units || []).map(u => [u.code, u]));
    return base.map(u => ({ ...u, ...(byCode[u.code] || {}), available: avail.units ? !!byCode[u.code]?.available : null }));
  }, [status.units, avail.units]);
  const freeCount = avail.units ? units.filter(u => u.available).length : 0;
  const selectedUnit = units.find(u => u.code === unitCode);
  const unitName = (u) => (u ? (isRTL ? u.label : (u.labelEn || u.label)) : '');

  const submit = async (e) => {
    e.preventDefault();
    setTouched(t => ({ ...t, __all: true }));
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: normalisePhone(form.phone),
        email: form.email.trim(),
        applicantType: form.applicantType,
        organization: form.organization.trim(),
        projectName: form.projectName.trim(),
        projectDescription: form.projectDescription.trim(),
        peopleCount: Number(form.peopleCount),
        unitCode,
        ...period,
        acceptTerms: true
      };
      const { data } = await axios.post(`${API_URL}/public/workspace/submit`, payload);
      setSubmitted({ requestNumber: data.requestNumber, unit: selectedUnit, period: { ...period }, workDays, dailyMins });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const d = err.response?.data || {};
      const msg = (isRTL ? d.messageAr : d.message) || d.messageAr || d.message;
      if (err.response?.status === 403 && d.code === 'WORKSPACE_CLOSED') {
        setStatus(s => ({ ...s, open: false, reason: d.reason || d.messageAr || '' }));
      } else if (err.response?.status === 409 && d.code === 'UNIT_TAKEN') {
        toast.error(msg || (isRTL ? 'حُجزت هذه المساحة للتو، اختر مساحة أخرى' : 'This workspace was just taken — pick another one'));
        setUnitCode('');
        loadAvailability({ ...period });
      } else if (!err.response) {
        toast.error(isRTL ? 'تعذّر الاتصال بالخادم، حاول مرة أخرى' : 'Could not reach the server — try again');
      } else {
        if (d.field) setServerErr({ field: d.field, text: msg });
        if (d.field === 'unitCode') { setUnitCode(''); loadAvailability({ ...period }); }
        toast.error(msg || (isRTL ? 'تعذّر إرسال الطلب' : 'Could not send the request'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setForm(initialForm);
    setPeriod(initialPeriod);
    setUnitCode('');
    setAcceptTerms(false);
    setTouched({});
    setServerErr(null);
  };

  const toggleLang = () => i18n.changeLanguage(isRTL ? 'en' : 'ar');

  // ---------- pieces ----------
  const topbar = (
    <header className="wr-topbar">
      <div className="wr-topbar-inner">
        <button className="wr-brand" onClick={() => navigate('/register')} type="button">
          <img src="/logo.png" alt="" className="wr-brand-logo" />
          <span className="wr-brand-text">
            <strong>{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</strong>
            <small>{isRTL ? 'تسجيل مساحات العمل' : 'Workspace registration'}</small>
          </span>
        </button>
        <div className="wr-topbar-tools">
          <button className="wr-pill" type="button" onClick={toggleLang}>
            <Icon><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Icon>
            <span>{isRTL ? 'English' : 'العربية'}</span>
          </button>
          <button className="wr-pill" type="button" onClick={() => navigate('/register')} title={isRTL ? 'الرئيسية' : 'Home'}>
            <Icon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Icon>
            <span className="wr-hide-sm">{isRTL ? 'الرئيسية' : 'Home'}</span>
          </button>
        </div>
      </div>
    </header>
  );

  const facts = [
    { k: 'units', text: isRTL ? '8 مساحات عمل' : '8 workspaces', icon: <Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon> },
    { k: 'hours', text: isRTL ? `${fmtTime(hours.start, true)} – ${fmtTime(hours.end, true)}` : `${fmtTime(hours.start, false)} – ${fmtTime(hours.end, false)}`, icon: <Icon><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></Icon> },
    { k: 'days', text: isRTL ? 'الأحد – الخميس' : 'Sunday – Thursday', icon: <Icon><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Icon> },
    { k: 'max', text: isRTL ? 'حتى شهر واحد' : 'Up to one month', icon: <Icon><path d="M6 2h12M6 22h12" /><path d="M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4" /></Icon> }
  ];

  const hero = (
    <section className="wr-hero">
      <span className="wr-eyebrow"><i aria-hidden="true" />{isRTL ? 'مساحات العمل' : 'Workspaces'}</span>
      <h1>{isRTL ? 'تسجيل مساحات العمل' : 'Workspace registration'}</h1>
      <p>
        {isRTL
          ? 'احجز إحدى مساحات العمل في فاب لاب الأحساء لتنفيذ مشروعك: اختر الفترة والوقت اليومي، ثم المساحة المتاحة. تُراجع الإدارة الطلب ويصلك الرد عبر البريد الإلكتروني.'
          : 'Book one of the FabLab Al-Ahsa workspaces for your project: choose the period and the daily time, then a free workspace. The administration reviews the request and replies by email.'}
      </p>
      <ul className="wr-facts">
        {facts.map(f => <li key={f.k}>{f.icon}<span>{f.text}</span></li>)}
      </ul>
    </section>
  );

  // ---------- closed / error ----------
  if (status.loading) {
    return (
      <div className="wr" dir={isRTL ? 'rtl' : 'ltr'}>
        {topbar}
        <main className="wr-main">
          {hero}
          <div className="wr-card wr-loading"><span className="wr-spin" aria-hidden="true" />{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
        </main>
      </div>
    );
  }
  if ((!status.open || status.error) && !submitted) {
    return (
      <div className="wr" dir={isRTL ? 'rtl' : 'ltr'}>
        {topbar}
        <main className="wr-main">
          {hero}
          <motion.div className="wr-card wr-closed" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="wr-closed-icon" aria-hidden="true">
              {status.error
                ? <Icon><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>
                : <Icon><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></Icon>}
            </div>
            <h2>
              {status.error
                ? (isRTL ? 'تعذّر تحميل الصفحة' : 'Could not load the page')
                : (isRTL ? 'التسجيل في مساحات العمل مغلق حاليًا' : 'Workspace registration is closed for now')}
            </h2>
            <p>
              {status.error
                ? (isRTL ? 'تحقق من اتصالك ثم أعد المحاولة.' : 'Check your connection and try again.')
                : (status.reason || (isRTL ? 'يرجى المحاولة لاحقًا أو التواصل مع فاب لاب.' : 'Please try again later or contact FabLab.'))}
            </p>
            {status.error && (
              <button type="button" className="wr-btn wr-btn--ghost" onClick={() => { setStatus(s => ({ ...s, loading: true })); loadStatus(); }}>
                {isRTL ? 'إعادة المحاولة' : 'Try again'}
              </button>
            )}
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="wr" dir={isRTL ? 'rtl' : 'ltr'}>
      {topbar}
      <main className="wr-main">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div key="form" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}>
              {hero}

              <form className="wr-form" onSubmit={submit} noValidate>
                {/* 1 — personal details */}
                <section className="wr-card">
                  <h2 className="wr-section-title"><span className="wr-step">1</span>{isRTL ? 'البيانات الشخصية' : 'Your details'}</h2>
                  <div className="wr-grid">
                    <label className="wr-field wr-field--full">
                      <span className="wr-label">{isRTL ? 'الاسم الكامل' : 'Full name'} <em>*</em></span>
                      <input type="text" name="fullName" value={form.fullName} onChange={e => setField('fullName', e.target.value)} onBlur={() => touch('fullName')}
                        className={showErr('fullName') ? 'has-error' : ''} placeholder={isRTL ? 'الاسم الثلاثي' : 'First and last name'} autoComplete="name" />
                      {showErr('fullName') && <span className="wr-err">{fieldErrors.fullName}</span>}
                    </label>
                    <label className="wr-field">
                      <span className="wr-label">{isRTL ? 'رقم الجوال' : 'Mobile'} <em>*</em></span>
                      <input type="tel" name="phone" inputMode="tel" dir="ltr" value={form.phone} onChange={e => setField('phone', e.target.value)} onBlur={() => touch('phone')}
                        className={showErr('phone') ? 'has-error' : ''} placeholder="05XXXXXXXX" autoComplete="tel" />
                      {showErr('phone') && <span className="wr-err">{fieldErrors.phone}</span>}
                    </label>
                    <label className="wr-field">
                      <span className="wr-label">{isRTL ? 'البريد الإلكتروني' : 'Email'} <em>*</em></span>
                      <input type="email" name="email" dir="ltr" value={form.email} onChange={e => setField('email', e.target.value)} onBlur={() => touch('email')}
                        className={showErr('email') ? 'has-error' : ''} placeholder="name@example.com" autoComplete="email" />
                      {showErr('email') && <span className="wr-err">{fieldErrors.email}</span>}
                    </label>
                    <div className="wr-field wr-field--full">
                      <span className="wr-label">{isRTL ? 'صفة المسجّل' : 'You are'} <em>*</em></span>
                      <div className="wr-chips" role="radiogroup">
                        {APPLICANT_TYPES.map(t => (
                          <button key={t.value} type="button" role="radio" aria-checked={form.applicantType === t.value}
                            className={`wr-chip${form.applicantType === t.value ? ' is-on' : ''}`}
                            onClick={() => { setField('applicantType', t.value); touch('applicantType'); }}>
                            {isRTL ? t.ar : t.en}
                          </button>
                        ))}
                      </div>
                      {showErr('applicantType') && <span className="wr-err">{fieldErrors.applicantType}</span>}
                    </div>
                    <label className="wr-field">
                      <span className="wr-label">{isRTL ? 'الجهة / المؤسسة' : 'Organization'} <small>{isRTL ? '(اختياري)' : '(optional)'}</small></span>
                      <input type="text" name="organization" value={form.organization} onChange={e => setField('organization', e.target.value)}
                        placeholder={isRTL ? 'الجامعة، الشركة، المدرسة…' : 'University, company, school…'} />
                    </label>
                    <label className="wr-field">
                      <span className="wr-label">{isRTL ? 'عدد الأشخاص' : 'Number of people'} <em>*</em></span>
                      <select name="peopleCount" value={form.peopleCount} onChange={e => setField('peopleCount', e.target.value)} className={showErr('peopleCount') ? 'has-error' : ''}>
                        {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <label className="wr-field wr-field--full">
                      <span className="wr-label">{isRTL ? 'اسم المشروع' : 'Project name'} <em>*</em></span>
                      <input type="text" name="projectName" value={form.projectName} onChange={e => setField('projectName', e.target.value)} onBlur={() => touch('projectName')}
                        className={showErr('projectName') ? 'has-error' : ''} placeholder={isRTL ? 'مثال: روبوت لفرز النفايات' : 'e.g. A waste-sorting robot'} />
                      {showErr('projectName') && <span className="wr-err">{fieldErrors.projectName}</span>}
                    </label>
                    <label className="wr-field wr-field--full">
                      <span className="wr-label">{isRTL ? 'وصف مختصر للمشروع' : 'Short project description'} <small>{isRTL ? '(اختياري)' : '(optional)'}</small></span>
                      <textarea name="projectDescription" rows={3} value={form.projectDescription} onChange={e => setField('projectDescription', e.target.value)} maxLength={1000}
                        placeholder={isRTL ? 'ماذا ستعمل في مساحة العمل؟ وما الأدوات التي تحتاجها؟' : 'What will you work on? Which tools do you need?'} />
                    </label>
                  </div>
                </section>

                {/* 2 — period & time */}
                <section className="wr-card">
                  <h2 className="wr-section-title"><span className="wr-step">2</span>{isRTL ? 'الفترة والوقت' : 'Period & time'}</h2>
                  <p className="wr-hint">
                    {isRTL
                      ? `يسري الحجز في أيام عمل فاب لاب (الأحد – الخميس) خلال الفترة المختارة، والوقت اليومي بين ${fmtTime(hours.start, true)} و${fmtTime(hours.end, true)}. لا تتجاوز مدة الحجز شهرًا واحدًا، ويمكن أن يبدأ خلال ${maxDaysAhead} يومًا من اليوم.`
                      : `The booking applies on FabLab working days (Sunday – Thursday) in the chosen period, with a daily time between ${fmtTime(hours.start, false)} and ${fmtTime(hours.end, false)}. A booking cannot be longer than one month and must start within ${maxDaysAhead} days.`}
                  </p>
                  <div className="wr-grid wr-grid--4">
                    <label className="wr-field">
                      <span className="wr-label">{isRTL ? 'من تاريخ' : 'From date'} <em>*</em></span>
                      <input type="date" name="startDate" value={period.startDate} min={today} max={lastStart || undefined} onChange={e => setPeriodField('startDate', e.target.value)} />
                    </label>
                    <label className="wr-field">
                      <span className="wr-label">{isRTL ? 'إلى تاريخ' : 'To date'} <em>*</em></span>
                      <input type="date" name="endDate" value={period.endDate} min={period.startDate || today} max={maxEnd || undefined}
                        disabled={!period.startDate} onChange={e => setPeriodField('endDate', e.target.value)} />
                    </label>
                    <label className="wr-field">
                      <span className="wr-label">{isRTL ? 'من الساعة' : 'From'} <em>*</em></span>
                      <select name="startTime" value={period.startTime} onChange={e => setPeriodField('startTime', e.target.value)}>
                        <option value="">{isRTL ? 'اختر' : 'Choose'}</option>
                        {startTimes.map(t => <option key={t} value={t}>{fmtTime(t, isRTL)}</option>)}
                      </select>
                    </label>
                    <label className="wr-field">
                      <span className="wr-label">{isRTL ? 'إلى الساعة' : 'To'} <em>*</em></span>
                      <select name="endTime" value={period.endTime} onChange={e => setPeriodField('endTime', e.target.value)} disabled={!period.startTime}>
                        <option value="">{isRTL ? 'اختر' : 'Choose'}</option>
                        {endTimes.map(t => <option key={t} value={t}>{fmtTime(t, isRTL)}</option>)}
                      </select>
                    </label>
                  </div>
                  {(periodError || periodServerErr) && <div className="wr-alert">{periodError || periodServerErr}</div>}
                  {periodReady && (
                    <div className="wr-summary">
                      <div><span>{isRTL ? 'الفترة' : 'Period'}</span><b>{fmtDate(period.startDate, isRTL)} {isRTL ? '←' : '→'} {fmtDate(period.endDate, isRTL)}</b></div>
                      <div><span>{isRTL ? 'أيام العمل' : 'Working days'}</span><b>{workDays} {isRTL ? (workDays === 1 ? 'يوم' : workDays === 2 ? 'يومان' : workDays <= 10 ? 'أيام' : 'يومًا') : (workDays === 1 ? 'day' : 'days')}</b></div>
                      <div><span>{isRTL ? 'يوميًا' : 'Daily'}</span><b dir={isRTL ? 'rtl' : 'ltr'}>{fmtTime(period.startTime, isRTL)} – {fmtTime(period.endTime, isRTL)} · {hoursLabel(dailyMins, isRTL)}</b></div>
                    </div>
                  )}
                </section>

                {/* 3 — workspace */}
                <section className="wr-card">
                  <h2 className="wr-section-title">
                    <span className="wr-step">3</span>{isRTL ? 'اختر مساحة العمل' : 'Choose a workspace'}
                    {avail.units && !avail.loading && (
                      <span className={`wr-count${freeCount ? '' : ' is-none'}`}>
                        {isRTL ? `${freeCount} من ${units.length} متاحة` : `${freeCount} of ${units.length} free`}
                      </span>
                    )}
                  </h2>
                  {!periodReady && <p className="wr-hint">{isRTL ? 'اختر الفترة والوقت أولًا لعرض المساحات المتاحة.' : 'Choose the period and time first to see the free workspaces.'}</p>}
                  {avail.error && <div className="wr-alert">{avail.error}</div>}
                  {serverErr?.field === 'unitCode' && <div className="wr-alert">{serverErr.text}</div>}
                  {avail.units && !avail.loading && freeCount === 0 && (
                    <div className="wr-alert">{isRTL ? 'لا توجد مساحة متاحة لكامل هذه الفترة والوقت — جرّب فترة أو وقتًا آخر.' : 'No workspace is free for all of this period and time — try another period or time.'}</div>
                  )}
                  <div className={`wr-units${avail.loading ? ' is-loading' : ''}`} role="radiogroup" aria-label={isRTL ? 'مساحات العمل' : 'Workspaces'}>
                    {units.map((u, i) => {
                      const state = u.available === null ? 'idle' : u.available ? 'free' : 'taken';
                      const on = unitCode === u.code;
                      return (
                        <button key={u.code} type="button" role="radio" aria-checked={on}
                          className={`wr-unit is-${state}${on ? ' is-on' : ''}`}
                          disabled={state !== 'free' || avail.loading}
                          onClick={() => setUnitCode(u.code)}>
                          <span className="wr-unit-num">{i + 1}</span>
                          <span className="wr-unit-name">{unitName(u)}</span>
                          <span className="wr-unit-state">
                            {avail.loading ? (isRTL ? 'جارٍ التحقق…' : 'Checking…')
                              : state === 'free' ? (on ? (isRTL ? 'مختارة' : 'Selected') : (isRTL ? 'متاحة' : 'Free'))
                                : state === 'taken' ? (isRTL ? 'محجوزة' : 'Taken')
                                  : '—'}
                          </span>
                          {on && <span className="wr-unit-tick" aria-hidden="true"><Icon d="M20 6 9 17l-5-5" /></span>}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 4 — terms */}
                <section className="wr-card">
                  <h2 className="wr-section-title"><span className="wr-step">4</span>{isRTL ? 'الشروط والأحكام' : 'Terms & conditions'}</h2>
                  <div className="wr-terms" tabIndex={0}>
                    <h3>{isRTL ? 'شروط وأحكام استخدام مساحة العمل' : 'Workspace terms & conditions'}</h3>
                    <ol className="wr-rules">
                      {RULES.map((r, i) => <li key={i}><span className="wr-rule-num">{i + 1}</span><span>{isRTL ? r.ar : r.en}</span></li>)}
                    </ol>
                    <h3>{isRTL ? 'سياسة استخدام مساحة العمل والدعم الفني' : 'Workspace & technical support policy'}</h3>
                    <ol className="wr-policy">
                      {POLICY.map((p, i) => {
                        const [title, text] = isRTL ? p.ar : p.en;
                        return <li key={i}><b>{title}</b><span>{text}</span></li>;
                      })}
                    </ol>
                  </div>
                  <label className={`wr-accept${acceptTerms ? ' is-on' : ''}${(touched.__all && !acceptTerms) || serverErr?.field === 'acceptTerms' ? ' has-error' : ''}`}>
                    <input type="checkbox" checked={acceptTerms} onChange={e => { setAcceptTerms(e.target.checked); clearServerErr('acceptTerms'); }} />
                    <span className="wr-box" aria-hidden="true"><Icon d="M20 6 9 17l-5-5" /></span>
                    <span>{isRTL ? 'قرأت الشروط والأحكام وأوافق عليها' : 'I have read and accept the terms and conditions'}</span>
                  </label>
                </section>

                <div className="wr-actions">
                  {missing.length > 0 && (
                    <p className="wr-missing">
                      {isRTL ? 'لإرسال الطلب أكمل: ' : 'To send, complete: '}
                      {missing.join(isRTL ? '، ' : ', ')}
                    </p>
                  )}
                  <div className="wr-actions-row">
                    <button type="button" className="wr-btn wr-btn--ghost" onClick={resetAll} disabled={submitting}>{isRTL ? 'مسح' : 'Reset'}</button>
                    <button type="submit" className="wr-btn wr-btn--primary" disabled={!canSubmit}>
                      {submitting
                        ? <><span className="wr-spin wr-spin--light" aria-hidden="true" />{isRTL ? 'جارٍ الإرسال…' : 'Sending…'}</>
                        : <>{isRTL ? 'إرسال طلب الحجز' : 'Send the request'}<Icon d={isRTL ? 'M19 12H5M11 18l-6-6 6-6' : 'M5 12h14M13 6l6 6-6 6'} /></>}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div key="thanks" className="wr-card wr-thanks" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.2, 0.9, 0.2, 1] }}>
              <div className="wr-thanks-check"><Icon d="M20 6 9 17l-5-5" /></div>
              <h2>{isRTL ? 'تم استلام طلب الحجز' : 'Request received'}</h2>
              {submitted.requestNumber && (
                <div className="wr-thanks-number">{isRTL ? 'رقم الطلب' : 'Request no.'} <b dir="ltr">{submitted.requestNumber}</b></div>
              )}
              <p>
                {isRTL
                  ? 'تُراجع الإدارة طلبك، وسيصلك بريد بالقبول أو الرفض على بريدك الإلكتروني المسجّل.'
                  : 'The administration will review your request — you will get an email with the acceptance or rejection.'}
              </p>
              <div className="wr-summary wr-summary--thanks">
                <div><span>{isRTL ? 'مساحة العمل' : 'Workspace'}</span><b>{unitName(submitted.unit)}</b></div>
                <div><span>{isRTL ? 'الفترة' : 'Period'}</span><b>{fmtDate(submitted.period.startDate, isRTL)} {isRTL ? '←' : '→'} {fmtDate(submitted.period.endDate, isRTL)}</b></div>
                <div><span>{isRTL ? 'يوميًا' : 'Daily'}</span><b dir={isRTL ? 'rtl' : 'ltr'}>{fmtTime(submitted.period.startTime, isRTL)} – {fmtTime(submitted.period.endTime, isRTL)}</b></div>
                <div><span>{isRTL ? 'أيام العمل' : 'Working days'}</span><b>{submitted.workDays}</b></div>
              </div>
              <div className="wr-actions-row wr-actions-row--center">
                <button type="button" className="wr-btn wr-btn--ghost" onClick={() => { resetAll(); setSubmitted(null); loadStatus(); }}>{isRTL ? 'طلب آخر' : 'Another request'}</button>
                <button type="button" className="wr-btn wr-btn--primary" onClick={() => navigate('/register')}>{isRTL ? 'العودة للرئيسية' : 'Back to home'}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default WorkspaceRegistration;
