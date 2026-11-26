import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import { RULES, POLICY } from './workspaceTerms';
import './WorkspaceRegistration.css';

// /workspace — booking one of FabLab's 8 free workspaces, inside the same
// studio frame as /register. Four steps: the dates + daily time (a month
// calendar and a 10:00–17:00 band that both show what is free and what is
// taken), the workspace, the team (returning users are looked up by ID or
// phone, new ones fill the same details as a new registration), then the
// project + terms. The server re-checks everything.

const DRAFT_KEY = 'fablab_workspace_form';
const STEP_MS = 30;

// ---------- dates / times ----------
const utc = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toYmd = (dt) => dt.toISOString().slice(0, 10);
const addDays = (ymd, n) => { const d = utc(ymd); d.setUTCDate(d.getUTCDate() + n); return toYmd(d); };
const addMonths = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return toYmd(new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))));
};
const monthKey = (ymd) => ymd.slice(0, 7);
const monthStart = (key) => `${key}-01`;
const monthEnd = (key) => { const [y, m] = key.split('-').map(Number); return toYmd(new Date(Date.UTC(y, m, 0))); };
const shiftMonth = (key, n) => addMonths(monthStart(key), n).slice(0, 7);
const weekday = (ymd) => utc(ymd).getUTCDay();
const t2m = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const m2t = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const fmt12 = (t, isRTL) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const h12 = ((h + 11) % 12) + 1;
  const pm = h >= 12;
  return `${h12}:${String(m).padStart(2, '0')} ${isRTL ? (pm ? 'م' : 'ص') : (pm ? 'PM' : 'AM')}`;
};
const fmtDate = (ymd, isRTL, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => (
  ymd ? utc(ymd).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { ...opts, timeZone: 'UTC' }) : ''
);
const monthTitle = (key, isRTL) => utc(monthStart(key)).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const WEEKDAYS = {
  ar: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
};
const datesIn = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digits = (v) => String(v || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\s()-]/g, '');
const PHONE_RE = /^\+?\d{8,15}$/;

const APPLICANT_TYPES = [
  { value: 'Beneficiary', ar: 'مستفيد', en: 'Beneficiary', d: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'] },
  { value: 'Talented', ar: 'موهوب', en: 'Talented', d: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'] },
  { value: 'Visitor', ar: 'زائر', en: 'Visitor', d: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'] },
  { value: 'Entity', ar: 'جهة', en: 'Organization', d: ['M3 21h18', 'M5 21V7l8-4v18', 'M19 21V11l-6-4', 'M9 9v.01', 'M9 12v.01', 'M9 15v.01'] }
];

const ICONS = {
  calendar: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  desk: ['M2 7h20v14H2z', 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'],
  team: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  doc: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 15l2 2 4-4'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  check: ['M20 6 9 17l-5-5'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 8v6', 'M23 11h-6'],
  back: ['M15 18l-6-6 6-6'],
  next: ['M9 18l6-6-6-6'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  refresh: ['M23 4v6h-6', 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10']
};

const blankMember = () => ({
  mode: 'existing', identifier: '', lookup: null, lookupState: 'idle', hint: '',
  firstName: '', lastName: '', sex: '', nationality: '', nationalId: '', phoneNumber: '', email: '', currentJob: '', nationalAddress: ''
});
const blankForm = () => ({
  startDate: '', endDate: '', startTime: '', endTime: '', unitCode: '',
  applicantType: '', organization: '', projectName: '', projectDescription: ''
});

const loadDraft = () => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d || typeof d !== 'object') return null;
    return {
      step: typeof d.step === 'number' ? Math.max(-1, Math.min(3, d.step)) : -1,
      form: { ...blankForm(), ...(d.form || {}) },
      members: Array.isArray(d.members) && d.members.length ? d.members.slice(0, 4).map(m => ({ ...blankMember(), ...m, lookupState: m.lookup ? 'found' : 'idle' })) : [blankMember()]
    };
  } catch { return null; }
};

const WorkspaceRegistration = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const tx = (ar, en) => (isRTL ? ar : en);
  const [theme, toggleTheme] = useStudioTheme();

  const draft = useRef(loadDraft()).current;
  const [status, setStatus] = useState(null);        // GET /status
  const [loadState, setLoadState] = useState('loading'); // loading | ready | closed | error
  const [step, setStep] = useState(draft?.step ?? -1);
  const [form, setForm] = useState(draft?.form || blankForm());
  const [members, setMembers] = useState(draft?.members || [blankMember()]);
  const [accept, setAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);             // requestNumber
  const [banner, setBanner] = useState('');
  const [projErrors, setProjErrors] = useState({});

  // calendar data, by month: { 'YYYY-MM': { 'YYYY-MM-DD': { working, past, bookings } } }
  const [cal, setCal] = useState({});
  const [calLoading, setCalLoading] = useState({});
  const [viewMonth, setViewMonth] = useState(null);
  const [units, setUnits] = useState(null);           // GET /availability for step 2
  const [unitsState, setUnitsState] = useState('idle');

  const unitsList = status?.units || [];
  const unitCount = unitsList.length || 8;
  const hours = status?.hours || { start: '10:00', end: '17:00' };
  const workingDays = useMemo(() => status?.workingDays || [0, 1, 2, 3, 4], [status]);
  const today = status?.today || toYmd(new Date());
  const maxAhead = status?.maxDaysAhead || 90;
  const maxPeople = status?.maxPeople || 4;
  const lastStart = addDays(today, maxAhead);

  // ---------- status ----------
  const loadStatus = useCallback(async () => {
    setLoadState('loading');
    try {
      const { data } = await api.get('/public/workspace/status');
      setStatus(data);
      setLoadState(data.open ? 'ready' : 'closed');
      setViewMonth(v => v || monthKey(data.today || toYmd(new Date())));
    } catch {
      setLoadState('error');
    }
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  // A stale draft (dates in the past) starts the dates again.
  useEffect(() => {
    if (!status) return;
    if (form.startDate && form.startDate < status.today) {
      setForm(f => ({ ...f, startDate: '', endDate: '', unitCode: '' }));
      setStep(s => (s > 0 ? 0 : s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (done) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form, members })); } catch { /* ignore */ }
  }, [step, form, members, done]);

  // ---------- calendar data ----------
  const neededMonths = useMemo(() => {
    const keys = new Set();
    if (viewMonth) keys.add(viewMonth);
    if (form.startDate) keys.add(monthKey(form.startDate));
    if (form.endDate) keys.add(monthKey(form.endDate));
    return [...keys];
  }, [viewMonth, form.startDate, form.endDate]);

  const fetchMonth = useCallback(async (key, force = false) => {
    if (!force && (cal[key] || calLoading[key])) return;
    setCalLoading(l => ({ ...l, [key]: true }));
    try {
      const { data } = await api.get('/public/workspace/calendar', { params: { from: monthStart(key), to: monthEnd(key) } });
      const map = {};
      (data.days || []).forEach(d => { map[d.date] = d; });
      setCal(c => ({ ...c, [key]: map }));
    } catch (err) {
      if (err.response?.data?.code === 'WORKSPACE_CLOSED') { setLoadState('closed'); setStatus(s => ({ ...s, reason: err.response.data.reason })); }
    } finally {
      setCalLoading(l => ({ ...l, [key]: false }));
    }
  }, [cal, calLoading]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    neededMonths.forEach(k => fetchMonth(k));
  }, [neededMonths, loadState, fetchMonth]);

  const refreshCalendar = () => {
    setCal({});
    setUnits(null);
  };

  const dayInfo = useCallback((ymd) => cal[monthKey(ymd)]?.[ymd] || null, [cal]);
  const isWorking = useCallback((ymd) => {
    const info = dayInfo(ymd);
    return info ? !!info.working : workingDays.includes(weekday(ymd));
  }, [dayInfo, workingDays]);
  const busyUnits = useCallback((ymd, s, e) => {
    const info = dayInfo(ymd);
    return new Set((info?.bookings || []).filter(b => b.start < e && s < b.end).map(b => b.unit));
  }, [dayInfo]);

  const rangeDates = useMemo(() => {
    if (!form.startDate) return [];
    return datesIn(form.startDate, form.endDate || form.startDate).filter(isWorking);
  }, [form.startDate, form.endDate, isWorking]);

  const win = form.startTime && form.endTime ? { s: form.startTime, e: form.endTime } : null;

  // Workspaces free on every working day of `dates` during [s, e).
  const freeFor = useCallback((dates, s, e) => {
    if (!dates.length) return 0;
    const busy = new Set();
    dates.forEach(d => busyUnits(d, s, e).forEach(u => busy.add(u)));
    return unitCount - busy.size;
  }, [busyUnits, unitCount]);

  // 30-minute cells of the working day.
  const cells = useMemo(() => {
    const out = [];
    for (let m = t2m(hours.start); m < t2m(hours.end); m += STEP_MS) out.push(m2t(m));
    return out;
  }, [hours.start, hours.end]);

  const dataReady = rangeDates.every(d => cal[monthKey(d)]);
  const cellFree = useMemo(() => {
    const dates = rangeDates;
    return cells.map(c => (dates.length && dataReady ? freeFor(dates, c, m2t(t2m(c) + STEP_MS)) : null));
  }, [cells, rangeDates, freeFor, dataReady]);

  const freeNow = win && rangeDates.length ? freeFor(rangeDates, win.s, win.e) : null;

  // ---------- step 1 actions ----------
  const maxEnd = form.startDate ? addMonths(form.startDate, status?.maxMonths || 1) : null;
  const pickDate = (ymd) => {
    setBanner('');
    setForm(f => {
      if (!f.startDate || f.endDate) return { ...f, startDate: ymd, endDate: '', unitCode: '' };
      if (ymd < f.startDate) return { ...f, startDate: ymd, endDate: '', unitCode: '' };
      if (ymd > addMonths(f.startDate, status?.maxMonths || 1)) {
        toast.info(tx('لا تتجاوز مدة الحجز شهرًا واحدًا', 'A booking can last one month at most'));
        return f;
      }
      return { ...f, endDate: ymd, unitCode: '' };
    });
  };
  // First tap: a half-hour (start); second tap: the end. Tapping before
  // the start moves the start.
  const pickCell = (c) => {
    setBanner('');
    setForm(f => {
      const end = m2t(t2m(c) + STEP_MS);
      if (!f.pending || c < f.startTime) return { ...f, startTime: c, endTime: end, pending: true, unitCode: '' };
      return { ...f, endTime: end, pending: false, unitCode: '' };
    });
  };

  const step1Problem = (() => {
    if (!form.startDate) return tx('اختر يوم البداية من التقويم', 'Pick the first day on the calendar');
    if (!rangeDates.length) return tx('الفترة لا تتضمن أيام عمل فاب لاب', 'The period has no FabLab working days');
    if (!form.startTime || !form.endTime) return tx('اختر وقت البداية والنهاية', 'Pick the start and end time');
    if (t2m(form.endTime) <= t2m(form.startTime)) return tx('وقت النهاية يجب أن يكون بعد وقت البداية', 'The end time must be after the start time');
    if (dataReady && freeNow === 0) return tx('لا توجد مساحة عمل متاحة لهذه الفترة والوقت — جرّب وقتًا أو أيامًا أخرى', 'No workspace is free for this period and time — try another time or days');
    return '';
  })();

  // ---------- step 2 ----------
  const loadUnits = useCallback(async () => {
    if (!form.startDate || !form.startTime || !form.endTime) return;
    setUnitsState('loading');
    try {
      const { data } = await api.get('/public/workspace/availability', {
        params: { startDate: form.startDate, endDate: form.endDate || form.startDate, startTime: form.startTime, endTime: form.endTime }
      });
      setUnits(data.units || []);
      setUnitsState('ready');
      if (form.unitCode && !(data.units || []).find(u => u.code === form.unitCode && u.available)) {
        setForm(f => ({ ...f, unitCode: '' }));
      }
    } catch (err) {
      const d = err.response?.data;
      if (d?.code === 'WORKSPACE_CLOSED') { setStatus(s => ({ ...s, reason: d.reason })); setLoadState('closed'); return; }
      setUnitsState('error');
      setBanner((isRTL ? d?.messageAr : d?.message) || tx('تعذّر تحميل المساحات', 'Could not load the workspaces'));
    }
  }, [form.startDate, form.endDate, form.startTime, form.endTime, form.unitCode, isRTL]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (step === 1) loadUnits(); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- step 3: team ----------
  const setCount = (n) => {
    setMembers(list => {
      const next = list.slice(0, n);
      while (next.length < n) next.push(blankMember());
      return next;
    });
  };
  const patchMember = (i, patch) => setMembers(list => list.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const setMemberField = (i, key, value) => setMembers(list => list.map((m, k) => (k === i ? { ...m, [key]: value, errors: { ...(m.errors || {}), [key]: '' } } : m)));

  const lookup = async (i) => {
    const m = members[i];
    const identifier = digits(m.identifier) || String(m.identifier || '').trim();
    if (identifier.length < 6) {
      patchMember(i, { lookupState: 'error', hint: tx('أدخل رقم الهوية أو رقم الجوال', 'Enter the national ID or mobile number') });
      return;
    }
    patchMember(i, { lookupState: 'loading', hint: '' });
    try {
      const { data } = await api.post('/public/workspace/lookup', { identifier });
      if (data.found) {
        const dup = members.some((o, k) => k !== i && o.mode === 'existing' && o.lookup?.userId === data.member.userId);
        if (dup) {
          patchMember(i, { lookupState: 'error', lookup: null, hint: tx('هذا الشخص مضاف بالفعل في الفريق', 'This person is already on the team') });
          return;
        }
        patchMember(i, { lookupState: 'found', lookup: data.member, hint: '' });
      } else {
        patchMember(i, { lookupState: 'notfound', lookup: null, hint: '' });
      }
    } catch (err) {
      const d = err.response?.data;
      patchMember(i, { lookupState: 'error', hint: (isRTL ? d?.messageAr : d?.message) || tx('تعذّر البحث، حاول مرة أخرى', 'Lookup failed — try again') });
    }
  };

  const switchToNew = (i) => {
    const m = members[i];
    const id = digits(m.identifier);
    const prefill = /^0?5\d{8}$/.test(id) || id.startsWith('+') ? { phoneNumber: id } : (id ? { nationalId: id } : {});
    patchMember(i, { mode: 'new', lookup: null, lookupState: 'idle', hint: '', ...prefill });
  };

  const memberErrors = (m) => {
    const e = {};
    if (m.mode === 'existing') {
      if (!m.lookup) e.identifier = tx('ابحث برقم الهوية أو الجوال، أو اختر «مستخدم جديد»', 'Look up the ID / mobile, or choose "New user"');
      return e;
    }
    const req = ['firstName', 'lastName', 'sex', 'nationality', 'nationalId', 'phoneNumber', 'email', 'currentJob'];
    req.forEach(k => { if (!String(m[k] || '').trim()) e[k] = tx('مطلوب', 'Required'); });
    if (m.email && !EMAIL_RE.test(String(m.email).trim())) e.email = tx('بريد إلكتروني غير صحيح', 'Invalid email');
    if (m.phoneNumber && !PHONE_RE.test(digits(m.phoneNumber))) e.phoneNumber = tx('رقم جوال غير صحيح', 'Invalid mobile number');
    return e;
  };
  // On a new person's card: format problems once something is typed
  // (required fields are named in the hint under the cards).
  const memberErrorsShown = (m) => {
    if (m.mode !== 'new') return {};
    const e = {};
    if (m.email && !EMAIL_RE.test(String(m.email).trim())) e.email = tx('بريد إلكتروني غير صحيح', 'Invalid email');
    if (m.phoneNumber && !PHONE_RE.test(digits(m.phoneNumber))) e.phoneNumber = tx('رقم جوال غير صحيح', 'Invalid mobile number');
    return e;
  };
  const teamProblem = (() => {
    const ids = new Set();
    const phones = new Set();
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const errs = memberErrors(m);
      if (Object.keys(errs).length) return { index: i, text: tx(`أكمل بيانات ${i === 0 ? 'قائد الفريق' : `العضو ${i + 1}`}`, `Complete ${i === 0 ? "the team leader's" : `member ${i + 1}'s`} details`) };
      if (m.mode === 'new') {
        const nid = digits(m.nationalId);
        const ph = digits(m.phoneNumber);
        if (ids.has(nid)) return { index: i, text: tx('رقم هوية مكرر داخل الفريق', 'A national ID appears twice in the team') };
        if (phones.has(ph)) return { index: i, text: tx('رقم جوال مكرر داخل الفريق', 'A mobile number appears twice in the team') };
        ids.add(nid); phones.add(ph);
      }
    }
    return null;
  })();

  // ---------- step 4 ----------
  const projectProblem = (() => {
    if (!form.applicantType) return tx('اختر صفة المسجّل', 'Pick who is registering');
    if (!form.projectName.trim()) return tx('أدخل اسم المشروع', 'Enter the project name');
    if (!accept) return tx('وافق على الشروط والأحكام', 'Accept the terms and conditions');
    return '';
  })();

  // ---------- navigation ----------
  const steps = [
    { key: 'when', label: tx('الموعد', 'Dates & time'), icon: ICONS.calendar },
    { key: 'unit', label: tx('مساحة العمل', 'Workspace'), icon: ICONS.desk },
    { key: 'team', label: tx('الفريق', 'Team'), icon: ICONS.team },
    { key: 'project', label: tx('المشروع والشروط', 'Project & terms'), icon: ICONS.doc }
  ];
  const go = (n) => { setBanner(''); setStep(n); window.scrollTo?.({ top: 0, behavior: 'smooth' }); };
  const startOver = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setForm(blankForm()); setMembers([blankMember()]); setAccept(false); setStep(-1); setBanner(''); setProjErrors({});
  };

  // ---------- submit ----------
  const submit = async () => {
    if (projectProblem || submitting) return;
    setSubmitting(true);
    setBanner('');
    try {
      const body = {
        applicantType: form.applicantType,
        organization: form.organization.trim(),
        projectName: form.projectName.trim(),
        projectDescription: form.projectDescription.trim(),
        unitCode: form.unitCode,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        startTime: form.startTime,
        endTime: form.endTime,
        acceptTerms: true,
        members: members.map(m => (m.mode === 'existing'
          ? { existingUserId: m.lookup.userId }
          : {
            firstName: m.firstName.trim(), lastName: m.lastName.trim(), sex: m.sex, nationality: m.nationality.trim(),
            nationalId: digits(m.nationalId), phoneNumber: digits(m.phoneNumber), email: m.email.trim().toLowerCase(),
            currentJob: m.currentJob.trim(), nationalAddress: m.nationalAddress.trim()
          }))
      };
      const { data } = await api.post('/public/workspace/submit', body);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setDone(data.requestNumber);
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const d = err.response?.data || {};
      const msg = (isRTL ? d.messageAr : d.message) || d.messageAr || tx('تعذّر إرسال الطلب، حاول مرة أخرى', 'Could not send the request — try again');
      if (d.code === 'WORKSPACE_CLOSED') { setStatus(s => ({ ...s, reason: d.reason })); setLoadState('closed'); }
      else if (d.code === 'UNIT_TAKEN') {
        toast.error(msg);
        refreshCalendar();
        setForm(f => ({ ...f, unitCode: '' }));
        go(1);
      } else if (d.code === 'MEMBER_EXISTS' && Number.isInteger(d.index)) {
        const m = members[d.index];
        patchMember(d.index, { mode: 'existing', identifier: m?.nationalId || m?.phoneNumber || '', lookup: null, lookupState: 'idle', hint: msg });
        go(2);
      } else if (typeof d.field === 'string' && d.field.startsWith('members.')) {
        const [, idx, key] = d.field.split('.');
        const i = Number(idx);
        if (members[i]) {
          setMembers(list => list.map((m, k) => (k === i ? { ...m, errors: { ...(m.errors || {}), [key || 'identifier']: msg } } : m)));
          go(2);
        }
        toast.error(msg);
      } else if (['startDate', 'endDate', 'startTime', 'endTime'].includes(d.field)) {
        go(0); setBanner(msg);
      } else if (d.field === 'unitCode') {
        go(1); setBanner(msg);
      } else if (['applicantType', 'projectName', 'organization', 'projectDescription', 'acceptTerms'].includes(d.field)) {
        setProjErrors({ [d.field]: msg }); setBanner(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- rail intro ----------
  const intro = {
    portal: tx('تسجيل مساحات العمل', 'Workspace registration'),
    title: isRTL ? <>مساحة عمل<br /><em>لفريقك ومشروعك</em></> : <>A workspace<br /><em>for your team & project</em></>,
    features: [
      { ar: '8 مساحات عمل مجانية — مساحة واحدة لكل طلب', en: '8 free workspaces — one per request', d: ICONS.desk },
      { ar: 'من 10:00 ص إلى 5:00 م، الأحد – الخميس', en: '10:00 AM – 5:00 PM, Sunday – Thursday', d: ICONS.clock },
      { ar: `حتى شهر واحد، وفريق حتى ${maxPeople} أشخاص`, en: `Up to one month, team of up to ${maxPeople}`, d: ICONS.team }
    ]
  };

  const shellProps = {
    isRTL, theme, onToggleTheme: toggleTheme, intro, servicesHref: '/register',
    subtitle: tx('تسجيل مساحات العمل', 'Workspace registration')
  };

  // ---------- screens ----------
  if (loadState === 'loading' && !status) {
    return (
      <StudioShell {...shellProps}>
        <section className="rgx-card wsx-skeleton" aria-busy="true">
          <i /><i /><i />
        </section>
      </StudioShell>
    );
  }
  if (loadState === 'error') {
    return (
      <StudioShell {...shellProps}>
        <section className="rgx-card rgx-closed">
          <span className="rgx-closed-ico"><Icon d={ICONS.info} /></span>
          <h2>{tx('تعذّر تحميل الصفحة', 'The page could not load')}</h2>
          <p className="rgx-closed-text">{tx('تحقق من الاتصال ثم أعد المحاولة.', 'Check your connection and try again.')}</p>
          <div className="rgx-closed-actions">
            <button type="button" className="btn btn-primary" onClick={loadStatus}><Icon d={ICONS.refresh} />{tx('إعادة المحاولة', 'Try again')}</button>
          </div>
        </section>
      </StudioShell>
    );
  }
  if (loadState === 'closed') {
    return (
      <StudioShell {...shellProps}>
        <motion.section className="rgx-card rgx-closed" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <span className="rgx-closed-ico"><Icon d={ICONS.x} /></span>
          <h2>{tx('التسجيل في مساحات العمل مغلق حاليًا', 'Workspace registration is closed')}</h2>
          {status?.reason && (
            <div className="rgx-closed-reason"><b>{tx('السبب', 'Reason')}</b><p>{status.reason}</p></div>
          )}
          <p className="rgx-closed-text">{tx('يمكنك المحاولة لاحقًا أو التواصل مع فاب لاب.', 'Please try again later or contact FabLab.')}</p>
          <div className="rgx-closed-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/register')}>{tx('صفحة التسجيل', 'Registration page')}</button>
          </div>
        </motion.section>
      </StudioShell>
    );
  }
  if (done) {
    return (
      <StudioShell {...shellProps}>
        <motion.section className="rgx-card wsx-done" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
          <motion.span className="wsx-done-ico" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}>
            <Icon d={ICONS.check} />
          </motion.span>
          <h2>{tx('تم استلام طلبك', 'Your request was received')}</h2>
          <p className="wsx-done-no">{tx('رقم الطلب', 'Request number')} <b dir="ltr">{done}</b></p>
          <p className="wsx-done-text">{tx('سيصلك بريد بالقبول أو الرفض. يُرجى عدم الحضور قبل وصول القبول.', "You'll get an email with the decision. Please don't come in before you're accepted.")}</p>
          <div className="rgx-closed-actions">
            <button type="button" className="btn btn-primary" onClick={() => { setDone(null); startOver(); refreshCalendar(); }}>{tx('طلب جديد', 'New request')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/register')}>{tx('صفحة التسجيل', 'Registration page')}</button>
          </div>
        </motion.section>
      </StudioShell>
    );
  }

  // ---------- landing ----------
  if (step === -1) {
    const hasDraft = !!(form.startDate || members.some(m => m.lookup || m.firstName));
    const resumeStep = form.unitCode ? (members.every(m => (m.mode === 'existing' ? m.lookup : m.firstName)) ? 3 : 2)
      : (form.startDate && form.startTime ? 1 : 0);
    return (
      <StudioShell {...shellProps}>
        <motion.div className="rgx-hero" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="rgx-eyebrow"><i aria-hidden="true" />{tx('فاب لاب الأحساء', 'FabLab Al-Ahsa')}</p>
          <h1>{isRTL ? <>تسجيل <em>مساحات العمل</em></> : <>Workspace <em>registration</em></>}</h1>
          <p>{tx('احجز مساحة عمل مجانية لك ولفريقك لتنفيذ مشروعك داخل فاب لاب — اختر الأيام والوقت، ثم المساحة، ثم أعضاء الفريق.',
            'Book a free workspace for you and your team to build your project at FabLab — pick the days and time, then the workspace, then your team.')}</p>
        </motion.div>
        <motion.section className="rgx-card wsx-landing" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="wsx-free">
            <span className="wsx-free-num">8</span>
            <span>
              <b>{tx('مساحات عمل مجانية', 'free workspaces')}</b>
              <small>{tx('يُحجز لكل طلب مساحة واحدة فقط، لفريق حتى 4 أشخاص', 'Each request books one workspace only, for a team of up to 4')}</small>
            </span>
          </div>
          <ul className="wsx-facts">
            <li><Icon d={ICONS.calendar} /><span>{tx('حتى شهر واحد للحجز، ويبدأ خلال 90 يومًا', 'Up to one month, starting within 90 days')}</span></li>
            <li><Icon d={ICONS.clock} /><span>{tx('يوميًا من 10:00 ص إلى 5:00 م — أيام العمل الأحد إلى الخميس', 'Daily 10:00 AM – 5:00 PM — Sunday to Thursday')}</span></li>
            <li><Icon d={ICONS.team} /><span>{tx('المسجّلون سابقًا يكفيهم رقم الهوية أو الجوال', 'Returning users only need their ID or mobile number')}</span></li>
            <li><Icon d={ICONS.doc} /><span>{tx('يُراجع الطلب ويصلك القرار عبر البريد الإلكتروني', 'The request is reviewed and you get the decision by email')}</span></li>
          </ul>
          <ol className="wsx-how">
            {steps.map((s, i) => (
              <li key={s.key}><span>{i + 1}</span>{s.label}</li>
            ))}
          </ol>
          <div className="wsx-landing-actions">
            <button type="button" className="btn btn-primary" onClick={() => go(hasDraft ? resumeStep : 0)}>
              {hasDraft ? tx('متابعة الطلب', 'Continue my request') : tx('ابدأ الحجز', 'Start booking')}
              <Icon d={isRTL ? ICONS.back : ICONS.next} />
            </button>
            {hasDraft && <button type="button" className="btn btn-secondary" onClick={() => { startOver(); go(0); }}>{tx('طلب جديد', 'New request')}</button>}
          </div>
        </motion.section>
      </StudioShell>
    );
  }

  // ---------- steps ----------
  const nav = (canNext, onNext, nextLabel) => (
    <div className="form-navigation">
      <button type="button" className="btn btn-secondary" onClick={() => go(step - 1)}>
        <Icon d={isRTL ? ICONS.next : ICONS.back} />{step === 0 ? tx('رجوع', 'Back') : tx('السابق', 'Previous')}
      </button>
      {onNext}
      {!onNext && (
        <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => go(step + 1)}>
          {nextLabel || tx('التالي', 'Next')}<Icon d={isRTL ? ICONS.back : ICONS.next} />
        </button>
      )}
    </div>
  );

  const unitLabel = (code) => {
    const u = unitsList.find(x => x.code === code);
    return u ? (isRTL ? u.label : u.labelEn) : code;
  };
  const workDays = rangeDates.length;
  const hoursPerDay = win ? (t2m(win.e) - t2m(win.s)) / 60 : 0;

  return (
    <StudioShell
      {...shellProps}
      onHome={startOver}
      steps={steps}
      activeStep={step}
      onJump={(i) => go(i)}
    >
      <motion.section className="rgx-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="rgx-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
              transition={{ duration: 0.26 }}
            >
              <p className="rgx-step-eyebrow"><span>{String(step + 1).padStart(2, '0')}</span>{steps[step].label}</p>

              {step === 0 && (
                <>
                  <h2 className="step-title">{tx('اختر الأيام والوقت', 'Pick the days and time')}</h2>
                  <p className="step-description">{tx('الأرقام على كل يوم وكل نصف ساعة تُظهر عدد مساحات العمل المتاحة من 8. اضغط يوم البداية ثم يوم النهاية، ثم وقت البداية ثم وقت النهاية.',
                    'The numbers on each day and each half-hour show how many of the 8 workspaces are free. Tap the first and last day, then the start and end time.')}</p>

                  <WsCalendar
                    isRTL={isRTL}
                    viewMonth={viewMonth}
                    setViewMonth={setViewMonth}
                    today={today}
                    lastStart={lastStart}
                    maxEnd={maxEnd}
                    form={form}
                    dayInfo={dayInfo}
                    isWorking={isWorking}
                    loading={!!calLoading[viewMonth] && !cal[viewMonth]}
                    unitCount={unitCount}
                    busyUnits={busyUnits}
                    win={win}
                    hours={hours}
                    onPick={pickDate}
                  />

                  <div className="wsx-band-head">
                    <h3><Icon d={ICONS.clock} />{tx('الوقت اليومي', 'Daily time')}</h3>
                    <span>{form.startDate
                      ? (form.endDate && form.endDate !== form.startDate
                        ? tx(`المتاح طوال الفترة ${fmtDate(form.startDate, true)} ← ${fmtDate(form.endDate, true)}`, `Free for the whole period ${fmtDate(form.startDate, false)} → ${fmtDate(form.endDate, false)}`)
                        : tx(`المتاح يوم ${fmtDate(form.startDate, true)}`, `Free on ${fmtDate(form.startDate, false)}`))
                      : tx('اختر الأيام أولًا', 'Pick the days first')}</span>
                  </div>
                  <div className={`wsx-band${form.startDate ? '' : ' is-off'}`} role="group" aria-label={tx('الوقت اليومي', 'Daily time')}>
                    {cells.map((c, i) => {
                      const free = cellFree[i];
                      const inSel = win && c >= win.s && c < win.e;
                      const level = free == null ? '' : free === 0 ? 'full' : free <= 2 ? 'low' : 'ok';
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`wsx-cell ${level}${inSel ? ' sel' : ''}${inSel && c === win.s ? ' sel-start' : ''}${inSel && m2t(t2m(c) + STEP_MS) === win.e ? ' sel-end' : ''}`}
                          disabled={!form.startDate}
                          onClick={() => pickCell(c)}
                          title={free == null ? c : tx(`${c} — ${free} من ${unitCount} متاحة`, `${c} — ${free} of ${unitCount} free`)}
                        >
                          <small dir="ltr">{c}</small>
                          <b>{free == null ? '–' : free === 0 ? tx('مشغول', 'Full') : free}</b>
                        </button>
                      );
                    })}
                  </div>
                  <div className="wsx-band-selects">
                    <label>
                      <span>{tx('من الساعة', 'From')}</span>
                      <select className="form-select" value={form.startTime} disabled={!form.startDate}
                        onChange={e => setForm(f => ({ ...f, startTime: e.target.value, endTime: f.endTime && f.endTime > e.target.value ? f.endTime : m2t(t2m(e.target.value) + STEP_MS), pending: false, unitCode: '' }))}>
                        <option value="">{tx('اختر', 'Pick')}</option>
                        {cells.map(c => <option key={c} value={c}>{fmt12(c, isRTL)}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>{tx('إلى الساعة', 'To')}</span>
                      <select className="form-select" value={form.endTime} disabled={!form.startTime}
                        onChange={e => setForm(f => ({ ...f, endTime: e.target.value, pending: false, unitCode: '' }))}>
                        <option value="">{tx('اختر', 'Pick')}</option>
                        {cells.map(c => m2t(t2m(c) + STEP_MS)).filter(e => !form.startTime || e > form.startTime).map(e => <option key={e} value={e}>{fmt12(e, isRTL)}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="wsx-summary">
                    <span className="wsx-chip"><Icon d={ICONS.calendar} />{form.startDate
                      ? `${fmtDate(form.startDate, isRTL)}${form.endDate && form.endDate !== form.startDate ? ` ${isRTL ? '←' : '→'} ${fmtDate(form.endDate, isRTL)}` : ''}`
                      : tx('لم تُحدد الأيام', 'No days yet')}</span>
                    <span className="wsx-chip">{tx(`${workDays} ${workDays === 1 ? 'يوم عمل' : workDays === 2 ? 'يوما عمل' : workDays <= 10 ? 'أيام عمل' : 'يوم عمل'}`, `${workDays} working day${workDays === 1 ? '' : 's'}`)}</span>
                    <span className="wsx-chip"><Icon d={ICONS.clock} />{win ? <span>{fmt12(win.s, isRTL)} – {fmt12(win.e, isRTL)}</span> : tx('لم يُحدد الوقت', 'No time yet')}</span>
                    {win && <span className="wsx-chip">{tx(`${hoursPerDay} ${hoursPerDay === 1 ? 'ساعة' : hoursPerDay === 2 ? 'ساعتان' : hoursPerDay <= 10 && Number.isInteger(hoursPerDay) ? 'ساعات' : 'ساعة'} يوميًا`, `${hoursPerDay} h a day`)}</span>}
                    {freeNow != null && dataReady && (
                      <span className={`wsx-chip strong ${freeNow === 0 ? 'bad' : freeNow <= 2 ? 'warn' : 'good'}`}>
                        {tx(`${freeNow} من ${unitCount} مساحات متاحة`, `${freeNow} of ${unitCount} workspaces free`)}
                      </span>
                    )}
                  </div>

                  {banner && <div className="info-banner warning"><Icon d={ICONS.info} /><span>{banner}</span></div>}
                  {step1Problem && form.startDate && <p className="wsx-hint">{step1Problem}</p>}
                  {nav(!step1Problem && dataReady)}
                </>
              )}

              {step === 1 && (
                <>
                  <h2 className="step-title">{tx('اختر مساحة العمل', 'Pick the workspace')}</h2>
                  <p className="step-description">{tx('تظهر المساحات المتاحة طوال الفترة والوقت اللذين اخترتهما. يُحجز لكل طلب مساحة واحدة فقط.',
                    'Workspaces free for your whole period and time can be picked. Each request books one workspace only.')}</p>
                  <div className="wsx-recap">
                    <span><Icon d={ICONS.calendar} />{fmtDate(form.startDate, isRTL)}{form.endDate && form.endDate !== form.startDate ? ` ${isRTL ? '←' : '→'} ${fmtDate(form.endDate, isRTL)}` : ''}</span>
                    <span><Icon d={ICONS.clock} /><span>{fmt12(form.startTime, isRTL)} – {fmt12(form.endTime, isRTL)}</span></span>
                  </div>
                  {unitsState === 'loading' && !units ? (
                    <div className="wsx-units">{Array.from({ length: unitCount }).map((_, i) => <div key={i} className="wsx-unit skeleton" />)}</div>
                  ) : (
                    <div className="wsx-units" role="radiogroup" aria-label={tx('مساحات العمل', 'Workspaces')}>
                      {(units || unitsList.map(u => ({ ...u, available: false }))).map((u, i) => {
                        const on = form.unitCode === u.code;
                        return (
                          <motion.button
                            key={u.code}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={!u.available}
                            className={`wsx-unit${on ? ' on' : ''}${u.available ? '' : ' taken'}`}
                            onClick={() => setForm(f => ({ ...f, unitCode: u.code }))}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                          >
                            <span className="wsx-unit-no">{u.code.replace('WS', '')}</span>
                            <b>{isRTL ? u.label : u.labelEn}</b>
                            <small>{u.available ? (on ? tx('مختارة', 'Selected') : tx('متاحة', 'Free')) : tx('محجوزة', 'Booked')}</small>
                            {on && <span className="wsx-unit-tick"><Icon d={ICONS.check} /></span>}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                  {units && !units.some(u => u.available) && (
                    <div className="info-banner warning"><Icon d={ICONS.info} /><span>{tx('لا توجد مساحة متاحة لهذا الاختيار — ارجع وغيّر الأيام أو الوقت.', 'No workspace is free for this choice — go back and change the days or time.')}</span></div>
                  )}
                  {banner && (
                    <div className="info-banner warning"><Icon d={ICONS.info} /><span>{banner}</span>
                      {unitsState === 'error' && <button type="button" className="wsx-link" onClick={loadUnits}>{tx('إعادة المحاولة', 'Try again')}</button>}
                    </div>
                  )}
                  {nav(!!form.unitCode)}
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="step-title">{tx('أعضاء الفريق', 'Your team')}</h2>
                  <p className="step-description">{tx('حدّد عدد الأشخاص ثم أدخل بيانات كل شخص. من سجّل في فاب لاب سابقًا يكفيه رقم الهوية أو الجوال، ومن يسجّل أول مرة يعبّئ بياناته.',
                    'Set how many people, then add each one. Anyone registered at FabLab before only needs their ID or mobile; first-timers fill in their details.')}</p>
                  <div className="wsx-count">
                    <span>{tx('عدد الأشخاص (مع قائد الفريق)', 'People (including the leader)')}</span>
                    <div className="wsx-seg" role="radiogroup">
                      {Array.from({ length: maxPeople }, (_, i) => i + 1).map(n => (
                        <button key={n} type="button" role="radio" aria-checked={members.length === n} className={members.length === n ? 'on' : ''} onClick={() => setCount(n)}>{n}</button>
                      ))}
                    </div>
                  </div>
                  <div className="wsx-members">
                    {members.map((m, i) => (
                      <MemberCard
                        key={i}
                        index={i}
                        m={m}
                        isRTL={isRTL}
                        errors={{ ...memberErrorsShown(m), ...Object.fromEntries(Object.entries(m.errors || {}).filter(([, v]) => v)) }}
                        onMode={(mode) => (mode === 'new' ? switchToNew(i) : patchMember(i, { mode: 'existing', hint: '' }))}
                        onField={(k, v) => setMemberField(i, k, v)}
                        onIdentifier={(v) => patchMember(i, { identifier: v, lookup: null, lookupState: 'idle', hint: '', errors: { ...(m.errors || {}), identifier: '' } })}
                        onLookup={() => lookup(i)}
                        onClearLookup={() => patchMember(i, { lookup: null, lookupState: 'idle', identifier: '' })}
                        onNewFromNotFound={() => switchToNew(i)}
                      />
                    ))}
                  </div>
                  {teamProblem && <p className="wsx-hint">{teamProblem.text}</p>}
                  {nav(!teamProblem)}
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="step-title">{tx('المشروع والشروط', 'Project & terms')}</h2>
                  <p className="step-description">{tx('أخبرنا عن مشروعك، راجع الملخص، ثم وافق على الشروط لإرسال الطلب.', 'Tell us about your project, check the summary, then accept the terms to send the request.')}</p>

                  <div className="form-group">
                    <span className="form-label">{tx('صفة المسجّل', 'Registering as')} <span className="required">*</span></span>
                    <div className="wsx-types" role="radiogroup">
                      {APPLICANT_TYPES.map(t => (
                        <button key={t.value} type="button" role="radio" aria-checked={form.applicantType === t.value}
                          className={`wsx-type${form.applicantType === t.value ? ' on' : ''}`}
                          onClick={() => { setForm(f => ({ ...f, applicantType: t.value })); setProjErrors(e => ({ ...e, applicantType: '' })); }}>
                          <Icon d={t.d} />{isRTL ? t.ar : t.en}
                        </button>
                      ))}
                    </div>
                    {projErrors.applicantType && <small className="wsx-err">{projErrors.applicantType}</small>}
                  </div>
                  <div className="form-grid wsx-gap">
                    <div className="form-group">
                      <label className="form-label" htmlFor="ws-proj">{tx('اسم المشروع', 'Project name')} <span className="required">*</span></label>
                      <input id="ws-proj" className="form-input" value={form.projectName} maxLength={200}
                        onChange={e => { setForm(f => ({ ...f, projectName: e.target.value })); setProjErrors(x => ({ ...x, projectName: '' })); }}
                        placeholder={tx('مثال: روبوت لفرز النفايات', 'e.g. A waste-sorting robot')} />
                      {projErrors.projectName && <small className="wsx-err">{projErrors.projectName}</small>}
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ws-org">{tx('الجهة / المؤسسة', 'Organization')} <em className="wsx-opt">{tx('اختياري', 'optional')}</em></label>
                      <input id="ws-org" className="form-input" value={form.organization} maxLength={200}
                        onChange={e => setForm(f => ({ ...f, organization: e.target.value }))}
                        placeholder={tx('الجامعة، الشركة، المدرسة…', 'University, company, school…')} />
                    </div>
                    <div className="form-group full-width">
                      <label className="form-label" htmlFor="ws-desc">{tx('وصف مختصر للمشروع', 'Short project description')} <em className="wsx-opt">{tx('اختياري', 'optional')}</em></label>
                      <textarea id="ws-desc" className="form-textarea" rows={3} value={form.projectDescription} maxLength={3000}
                        onChange={e => setForm(f => ({ ...f, projectDescription: e.target.value }))}
                        placeholder={tx('ماذا ستعملون في مساحة العمل؟ وما الأدوات التي تحتاجونها؟', 'What will you work on? Which tools do you need?')} />
                    </div>
                  </div>

                  <div className="wsx-recapcard">
                    <h3>{tx('ملخص الطلب', 'Request summary')}</h3>
                    <dl>
                      <div><dt>{tx('مساحة العمل', 'Workspace')}</dt><dd>{unitLabel(form.unitCode)}</dd></div>
                      <div><dt>{tx('الفترة', 'Period')}</dt><dd>{fmtDate(form.startDate, isRTL)}{form.endDate && form.endDate !== form.startDate ? ` ${isRTL ? '←' : '→'} ${fmtDate(form.endDate, isRTL)}` : ''} · {tx(`${workDays} أيام عمل`, `${workDays} working days`)}</dd></div>
                      <div><dt>{tx('الوقت اليومي', 'Daily time')}</dt><dd>{fmt12(form.startTime, isRTL)} – {fmt12(form.endTime, isRTL)}</dd></div>
                      <div>
                        <dt>{tx('الفريق', 'Team')}</dt>
                        <dd>
                          <ul className="wsx-recap-team">
                            {members.map((m, i) => (
                              <li key={i}>
                                <em>{i === 0 ? tx('القائد', 'Leader') : tx(`عضو ${i + 1}`, `Member ${i + 1}`)}</em>
                                {m.mode === 'existing' && m.lookup
                                  ? <>{m.lookup.firstName} {m.lookup.lastInitial ? `${m.lookup.lastInitial}.` : ''} <small>{tx('· مسجّل سابقًا', '· returning')}</small></>
                                  : <>{m.firstName} {m.lastName} <small>{tx('· مستخدم جديد', '· new user')}</small></>}
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="wsx-terms">
                    <div className="wsx-terms-box" tabIndex={0}>
                      <h4>{tx('شروط وأحكام استخدام مساحة العمل', 'Workspace terms & conditions')}</h4>
                      <ol>{RULES.map((r, i) => <li key={i}>{isRTL ? r.ar : r.en}</li>)}</ol>
                      <h4>{tx('سياسة استخدام مساحة العمل والدعم الفني', 'Workspace use & technical support policy')}</h4>
                      <ol>
                        {POLICY.map((p, i) => {
                          const [title, text] = isRTL ? p.ar : p.en;
                          return <li key={i}><b>{title}</b> — {text}</li>;
                        })}
                      </ol>
                    </div>
                    <label className={`rgx-ack${accept ? ' is-on' : ''}`}>
                      <input type="checkbox" checked={accept} onChange={e => { setAccept(e.target.checked); setProjErrors(x => ({ ...x, acceptTerms: '' })); }} />
                      <span>{tx('قرأت الشروط والأحكام وأوافق عليها', 'I have read and accept the terms and conditions')}</span>
                    </label>
                  </div>

                  {banner && <div className="info-banner warning"><Icon d={ICONS.info} /><span>{banner}</span></div>}
                  {projectProblem && <p className="wsx-hint">{projectProblem}</p>}
                  {nav(false, (
                    <button type="button" className="btn btn-primary btn-submit" disabled={!!projectProblem || submitting} onClick={submit}>
                      {submitting ? <><span className="loading-spinner" />{tx('جارٍ الإرسال…', 'Sending…')}</> : <><Icon d={ICONS.send} />{tx('إرسال الطلب', 'Send request')}</>}
                    </button>
                  ))}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>
    </StudioShell>
  );

};

// ---------- the month calendar ----------
const WsCalendar = ({ isRTL, viewMonth, setViewMonth, today, lastStart, maxEnd, form, dayInfo, isWorking, loading, unitCount, busyUnits, win, hours, onPick }) => {
  if (!viewMonth) return null;
  const first = monthStart(viewMonth);
  const last = monthEnd(viewMonth);
  const lead = weekday(first);
  const days = datesIn(first, last);
  const minMonth = monthKey(today);
  const maxMonth = monthKey(addMonths(lastStart, 1));
  const s = win ? win.s : hours.start;
  const e = win ? win.e : hours.end;
  const choosingEnd = form.startDate && !form.endDate;

  return (
    <div className="wsx-cal">
      <div className="wsx-cal-head">
        <button type="button" className="wsx-cal-nav" disabled={viewMonth <= minMonth} onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}
          aria-label={isRTL ? 'الشهر السابق' : 'Previous month'}>
          <Icon d={isRTL ? ICONS.next : ICONS.back} />
        </button>
        <h3>{monthTitle(viewMonth, isRTL)}</h3>
        <button type="button" className="wsx-cal-nav" disabled={viewMonth >= maxMonth} onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}
          aria-label={isRTL ? 'الشهر التالي' : 'Next month'}>
          <Icon d={isRTL ? ICONS.back : ICONS.next} />
        </button>
      </div>
      <div className="wsx-cal-grid" role="grid" aria-busy={loading}>
        {WEEKDAYS[isRTL ? 'ar' : 'en'].map((w, i) => <span key={w} className={`wsx-wd${i >= 5 ? ' off' : ''}`}>{w}</span>)}
        {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} className="wsx-day blank" />)}
        {days.map(d => {
          const info = dayInfo(d);
          const past = d < today || info?.past;
          const working = isWorking(d);
          const tooFar = !form.startDate || form.endDate ? d > lastStart : d > maxEnd;
          const disabled = past || !working || tooFar;
          const busy = info && working ? busyUnits(d, s, e) : null;
          const free = busy ? unitCount - busy.size : null;
          const level = !working || past ? 'off' : free == null ? 'wait' : free === 0 ? 'full' : free <= 2 ? 'low' : 'ok';
          const inRange = form.startDate && d >= form.startDate && d <= (form.endDate || form.startDate);
          const cls = [
            'wsx-day', level,
            inRange ? 'in' : '',
            d === form.startDate ? 'start' : '',
            (form.endDate ? d === form.endDate : d === form.startDate) ? 'end' : '',
            choosingEnd && d === form.startDate ? 'pending' : '',
            d === today ? 'today' : '',
            tooFar && !past && working ? 'far' : ''
          ].filter(Boolean).join(' ');
          return (
            <button
              key={d}
              type="button"
              className={cls}
              disabled={disabled}
              onClick={() => onPick(d)}
              aria-pressed={!!inRange}
              title={!working ? (isRTL ? 'ليس يوم عمل' : 'Not a working day')
                : free == null ? d
                  : isRTL ? `${free} من ${unitCount} مساحات متاحة` : `${free} of ${unitCount} workspaces free`}
            >
              <span className="n">{Number(d.slice(8))}</span>
              {working && !past && <span className="f">{free == null ? '·' : free === 0 ? (isRTL ? 'ممتلئ' : 'full') : `${free}/${unitCount}`}</span>}
            </button>
          );
        })}
      </div>
      <div className="wsx-legend">
        <span><i className="ok" />{isRTL ? 'متاح' : 'Free'}</span>
        <span><i className="low" />{isRTL ? 'مساحات قليلة' : 'Few left'}</span>
        <span><i className="full" />{isRTL ? 'ممتلئ' : 'Full'}</span>
        <span><i className="off" />{isRTL ? 'غير متاح' : 'Unavailable'}</span>
        <span><i className="sel" />{isRTL ? 'الفترة المختارة' : 'Your period'}</span>
      </div>
      <p className="wsx-cal-note">{win
        ? (isRTL ? 'الأرقام لوقتك المختار' : 'Numbers are for your chosen time')
        : (isRTL ? 'الأرقام لليوم كاملًا (10:00 – 5:00) — اختر الوقت بالأسفل لتُحدَّث' : 'Numbers are for the full day (10:00 – 5:00) — pick a time below to update them')}</p>
    </div>
  );
};

// ---------- one team member ----------
const MemberCard = ({ index, m, isRTL, errors, onMode, onField, onIdentifier, onLookup, onClearLookup, onNewFromNotFound }) => {
  const tx = (ar, en) => (isRTL ? ar : en);
  const field = (k, label, props = {}) => (
    <div className={`form-group${props.full ? ' full-width' : ''}`}>
      <label className="form-label" htmlFor={`m${index}-${k}`}>{label}{props.optional ? <em className="wsx-opt">{tx('اختياري', 'optional')}</em> : <span className="required"> *</span>}</label>
      {props.select ? (
        <select id={`m${index}-${k}`} className="form-select" value={m[k]} onChange={e => onField(k, e.target.value)}>
          <option value="">{tx('اختر', 'Select')}</option>
          <option value="Male">{tx('ذكر', 'Male')}</option>
          <option value="Female">{tx('أنثى', 'Female')}</option>
        </select>
      ) : (
        <input id={`m${index}-${k}`} className="form-input" value={m[k]} onChange={e => onField(k, e.target.value)}
          type={props.type || 'text'} inputMode={props.inputMode} dir={props.ltr ? 'ltr' : undefined} placeholder={props.placeholder || ''} />
      )}
      {errors[k] && <small className="wsx-err">{errors[k]}</small>}
    </div>
  );
  return (
    <motion.article className={`wsx-member${index === 0 ? ' lead' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <header className="wsx-member-head">
        <span className="wsx-member-no">{index + 1}</span>
        <b>{index === 0 ? tx('قائد الفريق', 'Team leader') : tx(`العضو ${index + 1}`, `Member ${index + 1}`)}</b>
        <div className="wsx-mode" role="tablist">
          <button type="button" role="tab" aria-selected={m.mode === 'existing'} className={m.mode === 'existing' ? 'on' : ''} onClick={() => onMode('existing')}>{tx('مسجّل سابقًا', 'Registered before')}</button>
          <button type="button" role="tab" aria-selected={m.mode === 'new'} className={m.mode === 'new' ? 'on' : ''} onClick={() => onMode('new')}>{tx('مستخدم جديد', 'New user')}</button>
        </div>
      </header>

      {m.mode === 'existing' ? (
        <div className="wsx-lookup">
          {m.lookup ? (
            <div className="wsx-found">
              <span className="wsx-found-ico"><Icon d={ICONS.check} /></span>
              <span><b>{m.lookup.firstName} {m.lookup.lastInitial ? `${m.lookup.lastInitial}.` : ''}</b><small dir="ltr">{m.lookup.phoneHint}</small></span>
              <button type="button" className="wsx-link" onClick={onClearLookup}>{tx('تغيير', 'Change')}</button>
            </div>
          ) : (
            <>
              <div className="wsx-lookup-row">
                <input className="form-input" value={m.identifier} onChange={e => onIdentifier(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onLookup(); } }}
                  inputMode="numeric" placeholder={tx('رقم الهوية أو رقم الجوال', 'National ID or mobile number')} aria-label={tx('رقم الهوية أو رقم الجوال', 'National ID or mobile number')} />
                <button type="button" className="btn btn-secondary" onClick={onLookup} disabled={m.lookupState === 'loading'}>
                  {m.lookupState === 'loading' ? <span className="loading-spinner" /> : <Icon d={ICONS.search} />}{tx('بحث', 'Find')}
                </button>
              </div>
              {m.hint && <small className="wsx-err">{m.hint}</small>}
              {errors.identifier && !m.hint && m.identifier && <small className="wsx-err">{errors.identifier}</small>}
              {m.lookupState === 'notfound' && (
                <div className="wsx-notfound">
                  <span>{tx('لم نجد تسجيلًا بهذا الرقم.', 'No registration found with this number.')}</span>
                  <button type="button" className="wsx-link" onClick={onNewFromNotFound}><Icon d={ICONS.userPlus} />{tx('سجّل كمستخدم جديد', 'Register as a new user')}</button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="form-grid">
          {field('firstName', tx('الاسم الأول', 'First name'))}
          {field('lastName', tx('اسم العائلة', 'Last name'))}
          {field('sex', tx('الجنس', 'Gender'), { select: true })}
          {field('nationality', tx('الجنسية', 'Nationality'), { placeholder: tx('مثال: سعودي', 'e.g. Saudi') })}
          {field('nationalId', tx('رقم الهوية الوطنية / الإقامة', 'National ID / Iqama'), { inputMode: 'numeric', ltr: true })}
          {field('phoneNumber', tx('رقم الجوال', 'Mobile number'), { type: 'tel', inputMode: 'tel', ltr: true, placeholder: '05xxxxxxxx' })}
          {field('email', tx('البريد الإلكتروني', 'Email'), { type: 'email', ltr: true, placeholder: 'name@example.com' })}
          {field('currentJob', tx('اسم الجهة التابع لها (مدرسة/جامعة/شركة)', 'Organization (school/university/company)'))}
          {field('nationalAddress', tx('العنوان الوطني', 'National address'), { optional: true, full: true })}
          {m.hint && <small className="wsx-err full">{m.hint}</small>}
        </div>
      )}
    </motion.article>
  );
};

export default WorkspaceRegistration;
