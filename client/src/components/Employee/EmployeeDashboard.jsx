import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import employeeApi from '../../config/employeeApi';
import { EVALUATION_CATEGORIES } from '../../config/evaluationStructure';
import YearCalendar from '../YearCalendar/YearCalendar';
import './Employee.css';

const SECTION_COLORS = {
  'Electronics and Programming': '#6366f1',
  'CNC Laser': '#22c55e',
  'CNC Wood': '#f59e0b',
  'CNC Metal': '#64748b',
  '3D': '#ef4444',
  'Robotic and AI': '#8b5cf6',
  "Kid's Club": '#06b6d4',
  'Vinyl Cutting': '#ec4899',
  'UV Printing and Sticker Making': '#14b8a6'
};

// ---------- Animated integer counter ----------
// Rolls from 0 to `target` over ~800ms with an easing that decelerates
// sharply, so numbers arrive with a satisfying "settle". Runs once per
// target change; if target is not numeric it just returns it verbatim.
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const numeric = Number(target);
    if (!Number.isFinite(numeric)) {
      setValue(target);
      return;
    }
    fromRef.current = value;
    startRef.current = null;
    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutQuint for a snappy settle
      const eased = 1 - Math.pow(1 - t, 5);
      const next = fromRef.current + (numeric - fromRef.current) * eased;
      setValue(numeric % 1 === 0 ? Math.round(next) : Number(next.toFixed(1)));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

// Small display component that uses the count-up hook. Simpler than
// scattering the hook everywhere.
const CountUp = ({ value, className, prefix = '', suffix = '' }) => {
  const n = useCountUp(value);
  return <span className={className}>{prefix}{n}{suffix}</span>;
};

// Framer-motion orchestration presets for staggered section reveals.
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 }
  }
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1, y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 22 }
  }
};

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [employeeData, setEmployeeData] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('employeeActiveTab');
    return saved || 'overview';
  });
  // Theme = 'dark' | 'light'. Defaults to dark (the original launch look).
  const [theme, setTheme] = useState(() => localStorage.getItem('employeeTheme') || 'dark');

  useEffect(() => {
    localStorage.setItem('employeeActiveTab', activeTab);
  }, [activeTab]);
  useEffect(() => {
    localStorage.setItem('employeeTheme', theme);
  }, [theme]);
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [ratings, setRatings] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [myEvaluations, setMyEvaluations] = useState(null);
  const [myWorkshops, setMyWorkshops] = useState([]);
  const [workshopViewFilter, setWorkshopViewFilter] = useState('active');
  // Attendance UX state — per-workshop mode toggle (rollcall|matrix) +
  // search text. Keyed by workshopId so switching modes on one workshop
  // doesn't affect others. Also tracks in-flight PATCH keys to disable
  // toggles during a network roundtrip.
  const [attMode, setAttMode] = useState({});           // { [workshopId]: 'rollcall' | 'matrix' }
  const [attSearch, setAttSearch] = useState({});       // { [workshopId]: string }
  const [attBusy, setAttBusy] = useState(() => new Set()); // Set of `${studentId}:${date}` in flight

  // Today's date as YYYY-MM-DD (local); used to highlight the "today"
  // day + drive the Roll Call toggles.
  const _todayISO = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const [activityStats, setActivityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');

  // Employee-owned overtime requests
  const [myOvertime, setMyOvertime] = useState([]);
  const [otStatusFilter, setOtStatusFilter] = useState('all');
  const [otFormOpen, setOtFormOpen] = useState(false);
  const [otEditingId, setOtEditingId] = useState(null);
  const [otForm, setOtForm] = useState({
    employeeName: '', nationalId: '', phone: '', email: '', position: '',
    periodStart: '', periodEnd: '', note: '', sanadDetails: '',
    days: [{ date: '', startTime: '', endTime: '', hours: '', task: '' }]
  });
  const [otBusy, setOtBusy] = useState(false);
  const [otSendModal, setOtSendModal] = useState(null); // { id, managerEmail }
  // Auto-overtime rows fetched from FabLab staff attendance so the
  // employee can import them into the days grid instead of retyping.
  const [otAutoRows, setOtAutoRows] = useState([]);
  const [otAutoPicked, setOtAutoPicked] = useState(() => new Set());
  const [otAutoLinked, setOtAutoLinked] = useState(true);

  // My attendance records (staff QR scans)
  const [myAttendance, setMyAttendance] = useState([]);
  const [myAttendanceLinked, setMyAttendanceLinked] = useState(true);
  // Preset approver dropdown — same list the admin sees.
  const OT_APPROVERS = [
    { name: 'أ. زكي اللويم',        email: 'zakiallwoaim@gmail.com' },
    { name: 'م. نوف البوعبيد',      email: '' },
    { name: 'أ. عبدالله الصفي',     email: '' },
    { name: 'أ. عبدالمحسن السلطان', email: '' }
  ].filter(a => a.email);

  // Section-scoped registration requests
  const [registrations, setRegistrations] = useState([]);
  const [regStatusFilter, setRegStatusFilter] = useState('pending');
  const [regDecideModal, setRegDecideModal] = useState(null); // { id, mode: 'approve'|'reject', name, section }
  const [regDecideBusy, setRegDecideBusy] = useState(false);
  const [regNote, setRegNote] = useState('');
  const [regRejectReason, setRegRejectReason] = useState('');
  const [regSendMessage, setRegSendMessage] = useState(true);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  // Create task modal
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '', dueDateEnd: '', dueTime: '', priority: 'medium', notes: '' });
  const [taskFormLoading, setTaskFormLoading] = useState(false);

  // Change password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const sectionLabels = {
    'Electronics and Programming': isRTL ? 'الإلكترونيات والبرمجة' : 'Electronics & Programming',
    'CNC Laser': isRTL ? 'ليزر CNC' : 'CNC Laser',
    'CNC Wood': isRTL ? 'خشب CNC' : 'CNC Wood',
    'CNC Metal': isRTL ? 'معادن CNC' : 'CNC Metal',
    '3D': isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing',
    'Robotic and AI': isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI',
    "Kid's Club": isRTL ? 'نادي الأطفال' : "Kid's Club",
    'Vinyl Cutting': isRTL ? 'قص الفينيل' : 'Vinyl Cutting',
    'UV Printing and Sticker Making': isRTL ? 'طباعة UV والملصقات' : 'UV Printing & Stickers'
  };

  const statusLabels = {
    pending: isRTL ? 'قيد الانتظار' : 'Pending',
    in_progress: isRTL ? 'قيد التنفيذ' : 'In Progress',
    completed: isRTL ? 'مكتمل' : 'Completed',
    cancelled: isRTL ? 'ملغى' : 'Cancelled',
    uncompleted: isRTL ? 'غير مكتمل' : 'Uncompleted',
    pending_review: isRTL ? 'بانتظار مراجعة المدير' : 'Pending Manager Review'
  };

  useEffect(() => {
    const data = localStorage.getItem('employeeData');
    if (!data) {
      navigate('/employee/login');
      return;
    }
    const parsed = JSON.parse(data);
    setEmployeeData(parsed);

    // If must change password on first login, show modal
    if (parsed.mustChangePassword) {
      setShowPasswordModal(true);
    }
  }, [navigate]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await employeeApi.get('/employee/profile');
      setProfile(response.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await employeeApi.get('/employee/my-tasks');
      const list = Array.isArray(response.data) ? response.data : [];
      // Sort by due date ascending (soonest first) — tasks without a
      // date sink to the bottom. Tie-break on createdAt so items on
      // the same day render in the order they were assigned.
      list.sort((a, b) => {
        const ad = a.startDate || a.dueDate || '';
        const bd = b.startDate || b.dueDate || '';
        if (ad && !bd) return -1;
        if (!ad && bd) return 1;
        if (ad !== bd) return ad < bd ? -1 : 1;
        const ac = a.createdAt || '';
        const bc = b.createdAt || '';
        return ac < bc ? -1 : ac > bc ? 1 : 0;
      });
      setTasks(list);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  }, []);

  const fetchRatings = useCallback(async () => {
    try {
      const response = await employeeApi.get('/employee/my-ratings');
      setRatings(response.data);
    } catch (error) {
      console.error('Error fetching ratings:', error);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await employeeApi.get('/employee/my-schedule');
      setSchedule(response.data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
  }, []);

  // Overtime — my own submissions only.
  const fetchMyOvertime = useCallback(async () => {
    try {
      const { data } = await employeeApi.get('/employee/my-overtime');
      setMyOvertime(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching my overtime:', error);
    }
  }, []);

  // Auto-overtime rows (from linked FabLab staff attendance).
  const fetchMyStaffOvertime = useCallback(async () => {
    try {
      const { data } = await employeeApi.get('/employee/my-staff-overtime');
      setOtAutoLinked(!!data?.linked);
      setOtAutoRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (error) {
      console.error('Error fetching staff overtime:', error);
      setOtAutoRows([]);
    }
  }, []);

  // My attendance history (staff QR scans).
  const fetchMyAttendance = useCallback(async () => {
    try {
      const { data } = await employeeApi.get('/employee/my-attendance');
      setMyAttendanceLinked(!!data?.linked);
      setMyAttendance(Array.isArray(data?.records) ? data.records : []);
    } catch (error) {
      console.error('Error fetching my attendance:', error);
      setMyAttendance([]);
    }
  }, []);

  const otToggleAutoPick = (attId) => {
    setOtAutoPicked(prev => {
      const next = new Set(prev);
      if (next.has(attId)) next.delete(attId); else next.add(attId);
      return next;
    });
  };
  const otPickAllAuto = () => setOtAutoPicked(new Set(otAutoRows.map(r => r.attendanceId)));
  const otClearAutoPick = () => setOtAutoPicked(new Set());

  // Merge selected auto rows into the days grid — dates already
  // present are skipped so we don't duplicate.
  const otImportAutoPicked = () => {
    if (otAutoPicked.size === 0) return;
    const picked = otAutoRows.filter(r => otAutoPicked.has(r.attendanceId));
    const iso = (v) => v ? String(v).slice(0, 10) : '';
    const fmtHM = (iso2) => {
      if (!iso2) return '';
      const d = new Date(iso2);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setOtForm(prev => {
      const existingDates = new Set((prev.days || []).map(d => iso(d.date)));
      const additions = picked
        .filter(r => !existingDates.has(iso(r.date)))
        .map(r => ({
          date: iso(r.date),
          startTime: fmtHM(r.checkInAt),
          endTime: fmtHM(r.checkOutAt),
          hours: (r.overtimeMinutes / 60).toFixed(2),
          task: r.reason || ''
        }));
      const filteredExisting = (prev.days || []).filter(
        d => d.date || d.hours || d.task || d.startTime || d.endTime
      );
      const nextDays = [...filteredExisting, ...additions];
      const dates = nextDays.map(d => d.date).filter(Boolean).sort();
      return {
        ...prev,
        days: nextDays.length ? nextDays : [{ date: '', hours: '', task: '' }],
        periodStart: prev.periodStart || (dates[0] || ''),
        periodEnd:   prev.periodEnd   || (dates[dates.length - 1] || '')
      };
    });
    toast.success(isRTL
      ? `تم استيراد ${picked.length} يوم`
      : `Imported ${picked.length} day(s)`);
    setOtAutoPicked(new Set());
  };

  const otResetForm = useCallback((prof) => {
    setOtEditingId(null);
    setOtForm({
      employeeName: prof?.name || '',
      nationalId: '',
      phone: '',
      email: prof?.email || '',
      position: prof?.section || '',
      periodStart: '',
      periodEnd: '',
      note: '',
      sanadDetails: '',
      days: [{ date: '', startTime: '', endTime: '', hours: '', task: '' }]
    });
  }, []);

  // Auto-compute hours for a day from start/end times.
  const otRecomputeDayHours = (day) => {
    if (!day.startTime || !day.endTime) return day;
    try {
      const [sh, sm] = String(day.startTime).split(':').map(n => Number(n));
      const [eh, em] = String(day.endTime).split(':').map(n => Number(n));
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      const h = +(mins / 60).toFixed(2);
      return { ...day, hours: h > 0 ? String(h) : day.hours };
    } catch { return day; }
  };

  const otUpdateDay = (idx, patch) => {
    setOtForm(f => ({
      ...f,
      days: f.days.map((d, i) => i === idx ? otRecomputeDayHours({ ...d, ...patch }) : d)
    }));
  };
  const otAddDay = () => setOtForm(f => ({
    ...f,
    days: [...f.days, { date: '', startTime: '', endTime: '', hours: '', task: '' }]
  }));
  const otRemoveDay = (idx) => setOtForm(f => ({
    ...f,
    days: f.days.length > 1 ? f.days.filter((_, i) => i !== idx) : f.days
  }));

  const otTotalHours = otForm.days.reduce((s, d) => s + (Number(d.hours) || 0), 0);

  const otOpenCreate = () => {
    otResetForm(profile);
    setOtAutoPicked(new Set());
    fetchMyStaffOvertime();
    setOtFormOpen(true);
  };

  const otOpenEdit = (row) => {
    setOtAutoPicked(new Set());
    fetchMyStaffOvertime();
    setOtEditingId(row.overtimeId);
    setOtForm({
      employeeName: row.employeeName || '',
      nationalId: row.nationalId || '',
      phone: row.phone || '',
      email: row.email || '',
      position: row.position || '',
      periodStart: row.periodStart || '',
      periodEnd: row.periodEnd || '',
      note: row.note || '',
      sanadDetails: row.sanadDetails || '',
      days: (row.days && row.days.length ? row.days : [{ date: '', startTime: '', endTime: '', hours: '', task: '' }])
        .map(d => ({
          date: d.date || '',
          startTime: d.startTime || '',
          endTime: d.endTime || '',
          hours: d.hours != null ? String(d.hours) : '',
          task: d.task || ''
        }))
    });
    setOtFormOpen(true);
  };

  const otCloseForm = () => { setOtFormOpen(false); setOtEditingId(null); };

  const otSubmitForm = async () => {
    if (!otForm.employeeName.trim()) return toast.error(isRTL ? 'اسم الموظف مطلوب' : 'Name required');
    if (otTotalHours <= 0) return toast.error(isRTL ? 'أضف أياماً بساعات صحيحة' : 'Add day(s) with hours');
    setOtBusy(true);
    try {
      const payload = {
        ...otForm,
        totalHours: otTotalHours,
        days: otForm.days.map(d => ({
          date: d.date || null,
          startTime: d.startTime || null,
          endTime: d.endTime || null,
          hours: Number(d.hours) || 0,
          task: d.task || ''
        })).filter(d => d.date || d.hours > 0)
      };
      if (otEditingId) {
        await employeeApi.put(`/employee/my-overtime/${otEditingId}`, payload);
        toast.success(isRTL ? 'تم تحديث الطلب' : 'Request updated');
      } else {
        await employeeApi.post('/employee/my-overtime', payload);
        toast.success(isRTL ? 'تم حفظ المسودة' : 'Draft saved');
      }
      otCloseForm();
      fetchMyOvertime();
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message
        || (isRTL ? 'تعذّر الحفظ' : 'Save failed');
      toast.error(msg);
    } finally {
      setOtBusy(false);
    }
  };

  const otDelete = async (row) => {
    if (!window.confirm(isRTL
      ? 'حذف هذه المسودة نهائياً؟'
      : 'Delete this draft permanently?')) return;
    try {
      await employeeApi.delete(`/employee/my-overtime/${row.overtimeId}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      fetchMyOvertime();
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message
        || (isRTL ? 'تعذّر الحذف' : 'Delete failed');
      toast.error(msg);
    }
  };

  const otOpenSend = (row) => {
    setOtSendModal({
      id: row.overtimeId,
      managerEmail: row.managerEmail || OT_APPROVERS[0]?.email || ''
    });
  };
  const otCloseSend = () => setOtSendModal(null);
  const otSubmitSend = async () => {
    if (!otSendModal) return;
    const email = String(otSendModal.managerEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error(isRTL ? 'بريد المدير غير صحيح' : 'Invalid manager email');
    }
    setOtBusy(true);
    try {
      const { data } = await employeeApi.post(
        `/employee/my-overtime/${otSendModal.id}/send-for-approval`,
        { managerEmail: email }
      );
      if (data?.emailFailed) {
        toast.warn(isRTL
          ? 'تم إرسال الطلب — لكن فشل تسليم البريد للمدير'
          : 'Marked pending — email delivery failed');
      } else {
        toast.success(isRTL ? '✅ أُرسل الطلب للمدير للاعتماد' : '✅ Sent to manager for approval');
      }
      otCloseSend();
      fetchMyOvertime();
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message
        || (isRTL ? 'تعذّر الإرسال' : 'Send failed');
      toast.error(msg);
    } finally {
      setOtBusy(false);
    }
  };

  // Registrations for the employee's own sections. The server does
  // the section filter; we just take what comes.
  const fetchRegistrations = useCallback(async () => {
    try {
      const { data } = await employeeApi.get('/employee/my-registrations');
      setRegistrations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    }
  }, []);

  const openRegDecide = (row, mode) => {
    setRegDecideModal({
      id: row.registrationId,
      mode,
      name: row.user?.name || `${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim() || '—',
      section: row.fablabSection
    });
    setRegNote('');
    setRegRejectReason('');
    setRegSendMessage(true);
  };
  const closeRegDecide = () => {
    setRegDecideModal(null);
    setRegNote('');
    setRegRejectReason('');
    setRegSendMessage(true);
  };

  const submitRegDecision = async () => {
    if (!regDecideModal) return;
    const { id, mode } = regDecideModal;
    if (mode === 'reject' && !regRejectReason.trim()) {
      return toast.error(isRTL ? 'يرجى ذكر سبب الرفض' : 'Reason required for rejection');
    }
    setRegDecideBusy(true);
    try {
      employeeApi.post('/employee/activity/interaction').catch(() => {});
      await employeeApi.patch(`/employee/my-registrations/${encodeURIComponent(id)}/status`, {
        status: mode === 'approve' ? 'approved' : 'rejected',
        rejectionReason: mode === 'reject' ? regRejectReason.trim() : null,
        adminMessage: regNote.trim() || null,
        sendMessageInEmail: regSendMessage
      });
      toast.success(mode === 'approve'
        ? (isRTL ? '✅ تم الاعتماد وإرسال البريد للمستفيد' : '✅ Approved — beneficiary emailed')
        : (isRTL ? '✕ تم الرفض وإرسال البريد للمستفيد' : '✕ Rejected — beneficiary emailed'));
      closeRegDecide();
      fetchRegistrations();
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message
        || (isRTL ? 'تعذّر تحديث الحالة' : 'Failed to update status');
      toast.error(msg);
    } finally {
      setRegDecideBusy(false);
    }
  };

  const fetchEvaluations = useCallback(async () => {
    try {
      const response = await employeeApi.get('/employee/my-evaluations');
      setMyEvaluations(response.data);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    }
  }, []);

  const fetchMyWorkshops = useCallback(async () => {
    try {
      const response = await employeeApi.get('/workshops/employee/my-workshops');
      setMyWorkshops(response.data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    }
  }, []);

  // Optimistic toggle: flips the student's attendance for one date
  // locally first (instant UI), then fires the PATCH; rolls back on
  // failure. Marks the `studentId:date` pair as busy while in flight
  // to prevent double-tap races.
  const toggleAttendance = useCallback(async (workshopId, studentId, date, wantPresent) => {
    const key = `${studentId}:${date}`;
    setAttBusy(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    const applyPatch = (present) => {
      setMyWorkshops(prev => prev.map(w => {
        if (w.workshopId !== workshopId) return w;
        return {
          ...w,
          students: (w.students || []).map(s => {
            if (s.studentId !== studentId) return s;
            const dates = Array.isArray(s.attendanceDates) ? [...s.attendanceDates] : [];
            const has = dates.includes(date);
            let next;
            if (present && !has) next = [...dates, date].sort();
            else if (!present && has) next = dates.filter(d => d !== date);
            else next = dates;
            return { ...s, attendanceDates: next, attended: next.length > 0 };
          })
        };
      }));
    };
    // optimistic
    applyPatch(wantPresent);
    try {
      await employeeApi.patch(`/workshops/employee/students/${studentId}/attendance`, {
        date, present: wantPresent
      });
    } catch (err) {
      // roll back on failure
      applyPatch(!wantPresent);
      toast.error(isRTL ? 'تعذر التحديث' : 'Update failed');
    } finally {
      setAttBusy(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [isRTL]);

  // Mark or clear TODAY for every student in a workshop in one shot.
  // Fires one PATCH per student that actually changes, using the same
  // optimistic pattern.
  const bulkToggleToday = useCallback(async (workshop, wantPresent) => {
    if (!workshop?.students?.length) return;
    const workshopDays = [];
    if (workshop.startDate) {
      const start = new Date(workshop.startDate);
      const end = workshop.endDate ? new Date(workshop.endDate) : new Date(workshop.startDate);
      const cursor = new Date(start);
      while (cursor <= end) {
        workshopDays.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    if (!workshopDays.includes(_todayISO)) {
      toast.warn(isRTL ? 'اليوم ليس ضمن أيام الورشة' : 'Today is not a workshop day');
      return;
    }
    const targets = workshop.students.filter(s => {
      const has = Array.isArray(s.attendanceDates) && s.attendanceDates.includes(_todayISO);
      return wantPresent ? !has : has;
    });
    if (targets.length === 0) {
      toast.info(isRTL ? 'لا يوجد تغييرات' : 'Nothing to update');
      return;
    }
    // Kick off all toggles in parallel — toggleAttendance handles
    // busy state + rollback per row.
    await Promise.all(targets.map(s =>
      toggleAttendance(workshop.workshopId, s.studentId, _todayISO, wantPresent)
    ));
    toast.success(wantPresent
      ? (isRTL ? `تم تعليم ${targets.length} طالب حاضر` : `Marked ${targets.length} present`)
      : (isRTL ? `تم مسح ${targets.length} تسجيل` : `Cleared ${targets.length} check-ins`));
  }, [_todayISO, toggleAttendance, isRTL]);

  const fetchActivityStats = useCallback(async () => {
    try {
      const response = await employeeApi.get('/employee/activity/my-weekly');
      setActivityStats(response.data);
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  }, []);

  useEffect(() => {
    if (employeeData) {
      // Record login
      employeeApi.post('/employee/activity/login').catch(() => {});

      // Only the small overview requests gate the loading screen. The
      // tab-specific lists (workshops, registrations, overtime,
      // attendance) fill in as they arrive, so one slow response on a
      // weak connection can't hold the whole dashboard hostage.
      Promise.all([fetchProfile(), fetchTasks(), fetchRatings(), fetchSchedule(), fetchEvaluations(), fetchActivityStats()])
        .finally(() => setLoading(false));
      fetchMyWorkshops();
      fetchRegistrations();
      fetchMyOvertime();
      fetchMyAttendance();

      // Heartbeat every 5 minutes
      const heartbeatInterval = setInterval(() => {
        employeeApi.post('/employee/activity/heartbeat').catch(() => {});
      }, 5 * 60 * 1000);

      return () => clearInterval(heartbeatInterval);
    }
  }, [employeeData, fetchProfile, fetchTasks, fetchRatings, fetchSchedule, fetchEvaluations, fetchActivityStats, fetchMyWorkshops, fetchRegistrations, fetchMyOvertime, fetchMyAttendance]);

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      employeeApi.post('/employee/activity/interaction').catch(() => {});
      const response = await employeeApi.patch(`/employee/my-tasks/${taskId}/status`, { status: newStatus });
      if (response.data.awardedRating) {
        toast.success(isRTL ? 'تم إكمال المهمة! تم منحك نقطة واحدة' : 'Task completed! 1 point awarded');
        fetchRatings();
        fetchProfile();
      } else if (response.data.deductedRating) {
        toast.warn(isRTL ? 'تم تحديد المهمة كغير مكتملة. تم خصم نقطة واحدة' : 'Task marked uncompleted. 1 point deducted');
        fetchRatings();
        fetchProfile();
      } else {
        toast.success(isRTL ? 'تم تحديث حالة المهمة' : 'Task status updated');
      }
      fetchTasks();
      fetchSchedule();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title || !taskForm.dueDate) {
      toast.error(isRTL ? 'العنوان وتاريخ الاستحقاق مطلوبان' : 'Title and due date are required');
      return;
    }
    setTaskFormLoading(true);
    try {
      await employeeApi.post('/employee/my-tasks', taskForm);
      toast.success(isRTL ? 'تم إنشاء المهمة بنجاح' : 'Task created successfully');
      setShowCreateTaskModal(false);
      setTaskForm({ title: '', description: '', dueDate: '', dueDateEnd: '', dueTime: '', priority: 'medium', notes: '' });
      fetchTasks();
      fetchSchedule();
      fetchProfile();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في إنشاء المهمة' : 'Error creating task');
    } finally {
      setTaskFormLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error(isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    setPasswordLoading(true);
    try {
      await employeeApi.post('/employee/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      toast.success(isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      const data = JSON.parse(localStorage.getItem('employeeData'));
      data.mustChangePassword = false;
      localStorage.setItem('employeeData', JSON.stringify(data));
      setEmployeeData(data);
    } catch (error) {
      toast.error(error.response?.data?.message || (isRTL ? 'خطأ في تغيير كلمة المرور' : 'Error changing password'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('employeeToken');
    localStorage.removeItem('employeeData');
    toast.success(isRTL ? 'تم تسجيل الخروج' : 'Logged out');
    navigate('/employee/login');
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  // Calendar helpers
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const getEventsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return schedule.filter(event => {
      if (!event.date) return false;
      const startStr = event.date instanceof Date ? format(event.date, 'yyyy-MM-dd') : String(event.date).substring(0, 10);
      const endDate = event.endDate || event.date;
      const endStr = endDate instanceof Date ? format(endDate, 'yyyy-MM-dd') : String(endDate).substring(0, 10);
      return dayStr >= startStr && dayStr <= endStr;
    });
  };

  const formatTimeAMPM = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? (isRTL ? 'م' : 'PM') : (isRTL ? 'ص' : 'AM');
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="employee-loading">
        <div className="loading-spinner-large" />
        <p>{isRTL ? 'جاري تهيئة الوحدة...' : 'Initializing terminal...'}</p>
      </div>
    );
  }

  const filteredTasks = taskStatusFilter === 'all' ? tasks : tasks.filter(t => t.status === taskStatusFilter);

  const tabs = [
    { key: 'overview',      label: isRTL ? 'نظرة عامة' : 'Overview',       icon: '◈' },
    { key: 'tasks',         label: isRTL ? 'المهام' : 'Tasks',              icon: '⬢' },
    { key: 'registrations', label: isRTL ? 'طلبات التسجيل' : 'Registrations', icon: '✎' },
    { key: 'overtime',      label: isRTL ? 'ساعات إضافية' : 'Overtime',      icon: '🕓' },
    { key: 'attendance',    label: isRTL ? 'الحضور' : 'Attendance',          icon: '✅' },
    { key: 'schedule',      label: isRTL ? 'الجدول' : 'Schedule',           icon: '◱' },
    { key: 'year-calendar', label: isRTL ? 'التقويم السنوي' : 'Year Calendar', icon: '▦' },
    { key: 'ratings',       label: isRTL ? 'التقييمات' : 'Ratings',         icon: '★' },
    { key: 'workshops',     label: isRTL ? 'الورش' : 'Workshops',           icon: '⬡' },
    { key: 'profile',       label: isRTL ? 'الملف الشخصي' : 'Profile',      icon: '◉' },
  ];

  // Compute the activity ring's stroke dashoffset. Ring circumference = 2πr,
  // r = 92 → C ≈ 578. Progress% maps to dashoffset.
  const RING_R = 92;
  const RING_C = 2 * Math.PI * RING_R;
  const activityPct = Math.min(100, Math.max(0, activityStats?.percentage || 0));
  const ringOffset = RING_C - (RING_C * activityPct) / 100;

  return (
    <div className="employee-dashboard" dir={isRTL ? 'rtl' : 'ltr'} data-page="employee" data-theme={theme}>
      {/* Top Bar */}
      <motion.div
        className="emp-topbar"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="emp-topbar-left">
          <div className="emp-brand-mark" aria-hidden="true" />
          <div className="emp-brand-block">
            <h2 className="emp-logo">FABLAB</h2>
            <span className="emp-badge">{isRTL ? 'وحدة الموظفين · OPS' : 'EMPLOYEE OPS · TERMINAL'}</span>
          </div>
        </div>
        <div className="emp-topbar-right">
          <button
            className="emp-theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark'
              ? (isRTL ? 'الوضع الفاتح' : 'Light mode')
              : (isRTL ? 'الوضع الداكن' : 'Dark mode')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              /* sun icon → we're currently dark, click for light */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              /* moon icon → we're currently light, click for dark */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <button className="emp-lang-btn" onClick={toggleLanguage}>
            {i18n.language === 'ar' ? 'EN' : 'ع'}
          </button>
          <div className="emp-user-info">
            <span className="emp-user-name">{employeeData?.name}</span>
            <span className="emp-user-section">
              {(Array.isArray(employeeData?.sections) && employeeData.sections.length
                ? employeeData.sections
                : (employeeData?.section ? [employeeData.section] : [])
              ).map(s => sectionLabels[s] || s).join(' · ') || '—'}
            </span>
          </div>
          <button className="emp-logout-btn" onClick={handleLogout} title={isRTL ? 'خروج' : 'Logout'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div
        className="emp-tabs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        {tabs.map((tab, idx) => (
          <button
            key={tab.key}
            className={`emp-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="emp-tab-key">{String(idx + 1).padStart(2, '0')}</span>
            <span className="emp-tab-icon">{tab.icon}</span>
            <span className="emp-tab-label">{tab.label}</span>
            {activeTab === tab.key && (
              <motion.span
                layoutId="emp-tab-indicator"
                className="emp-tab-indicator"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      <div className="emp-content">
        <AnimatePresence mode="wait">

          {/* ═══════════════════════════════════════════════════ OVERVIEW */}
          {activeTab === 'overview' && profile && (
            <motion.div
              key="overview"
              className="emp-overview"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -12 }}
            >
              {/* Stat cards */}
              <motion.div variants={itemVariants}>
                <div className="emp-headline">
                  <span className="emp-headline-tag">[01] {isRTL ? 'حالة الوحدة' : 'Unit Status'}</span>
                  <h2 className="emp-headline-title">{isRTL ? 'لوحة الأداء' : 'Performance Board'}</h2>
                  <span className="emp-headline-rest" />
                </div>
                <div className="emp-stats-grid">
                  <div className="emp-stat-card points">
                    <div className="emp-stat-head">
                      <span>{isRTL ? 'صافي النقاط' : 'Net Points'}</span>
                      <span className="emp-stat-icon">◆</span>
                    </div>
                    <CountUp className="emp-stat-value" value={profile.netPoints} />
                    <span className="emp-stat-label">{isRTL ? 'إجمالي التقييم' : 'Overall rating'}</span>
                  </div>
                  <div className="emp-stat-card tasks-total">
                    <div className="emp-stat-head">
                      <span>{isRTL ? 'إجمالي المهام' : 'Total Tasks'}</span>
                      <span className="emp-stat-icon">▤</span>
                    </div>
                    <CountUp className="emp-stat-value" value={profile.taskStats.total} />
                    <span className="emp-stat-label">{isRTL ? 'كل المهام المسجلة' : 'All-time assignments'}</span>
                  </div>
                  <div className="emp-stat-card completed">
                    <div className="emp-stat-head">
                      <span>{isRTL ? 'مكتملة' : 'Completed'}</span>
                      <span className="emp-stat-icon">✓</span>
                    </div>
                    <CountUp className="emp-stat-value" value={profile.taskStats.completed} />
                    <span className="emp-stat-label">{isRTL ? 'مهام منجزة' : 'Successfully closed'}</span>
                  </div>
                  <div className="emp-stat-card in-progress">
                    <div className="emp-stat-head">
                      <span>{isRTL ? 'قيد التنفيذ' : 'Active'}</span>
                      <span className="emp-stat-icon">◐</span>
                    </div>
                    <CountUp className="emp-stat-value" value={profile.taskStats.in_progress} />
                    <span className="emp-stat-label">{isRTL ? 'مهام مفتوحة الآن' : 'Currently in flight'}</span>
                  </div>
                </div>
              </motion.div>

              {/* Weekly Activity */}
              {activityStats && (
                <motion.div className="emp-section-card" variants={itemVariants}>
                  <h3>
                    {isRTL ? 'نشاط الأسبوع الحالي' : 'Weekly Cycle Activity'}
                    {activityStats.successfulWeeks > 0 && (
                      <span className="emp-activity-weeks-pill">
                        {activityStats.successfulWeeks} {isRTL ? 'أسابيع ناجحة' : 'streaks'}
                      </span>
                    )}
                  </h3>
                  <div className="emp-activity">
                    <div className="emp-activity-ring">
                      <svg width="220" height="220" viewBox="0 0 220 220">
                        <defs>
                          <linearGradient id="emp-ring-grad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#EE2329" />
                            <stop offset="100%" stopColor="#ff5a5f" />
                          </linearGradient>
                        </defs>
                        <circle className="emp-activity-ring-track" cx="110" cy="110" r={RING_R} />
                        <motion.circle
                          className="emp-activity-ring-progress"
                          cx="110" cy="110" r={RING_R}
                          strokeDasharray={RING_C}
                          initial={{ strokeDashoffset: RING_C }}
                          animate={{ strokeDashoffset: ringOffset }}
                          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </svg>
                      <div className="emp-activity-ring-inner">
                        <div className="emp-activity-percent">
                          <CountUp value={activityStats.percentage} /><sup>%</sup>
                        </div>
                        <span className={`emp-activity-status ${activityStats.passed ? 'passed' : ''}`}>
                          {activityStats.passed
                            ? (isRTL ? '✓ الهدف محقق' : '✓ Target Hit')
                            : (isRTL ? 'قيد التقدم' : 'In progress')}
                        </span>
                      </div>
                    </div>
                    <div className="emp-activity-meta">
                      <div className="emp-activity-row">
                        <span className="emp-activity-row-label">{isRTL ? 'الساعات' : 'Hours'}</span>
                        <div className="emp-activity-row-bar">
                          <div
                            className="emp-activity-row-bar-fill"
                            style={{ width: `${Math.min(100, (activityStats.totalHours / activityStats.targetHours) * 100)}%` }}
                          />
                        </div>
                        <span className="emp-activity-row-value">
                          {activityStats.totalHours}h / {activityStats.targetHours}h
                        </span>
                      </div>
                      <div className="emp-activity-row">
                        <span className="emp-activity-row-label">{isRTL ? 'أيام نشطة' : 'Active days'}</span>
                        <div className="emp-activity-row-bar">
                          <div
                            className="emp-activity-row-bar-fill"
                            style={{ width: `${Math.min(100, (activityStats.daysActive / 7) * 100)}%`, background: 'linear-gradient(90deg, #22d3ee, #22d3eeaa)' }}
                          />
                        </div>
                        <span className="emp-activity-row-value">{activityStats.daysActive}</span>
                      </div>
                      {activityStats.daysRemaining > 0 && (
                        <div className="emp-activity-row">
                          <span className="emp-activity-row-label">{isRTL ? 'أيام متبقية' : 'Days remaining'}</span>
                          <div className="emp-activity-row-bar">
                            <div
                              className="emp-activity-row-bar-fill"
                              style={{ width: `${Math.min(100, (activityStats.daysRemaining / 7) * 100)}%`, background: 'linear-gradient(90deg, #f59e0b, #eab308)' }}
                            />
                          </div>
                          <span className="emp-activity-row-value">{activityStats.daysRemaining}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="emp-activity-footer">
                    <span className="emp-activity-cycle">
                      {isRTL ? 'الدورة' : 'Cycle'}: {activityStats.cycleStart}
                      <span className="emp-activity-cycle-arrow">→</span>
                      {activityStats.cycleEnd}
                    </span>
                    {activityStats.passed && (
                      <span className="emp-activity-success-badge">
                        +1 {isRTL ? 'نقطة مكتسبة' : 'credit earned'}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Recent Tasks + Ratings — side by side on large screens */}
              <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 22 }}>
                <div className="emp-section-card">
                  <h3>{isRTL ? '⬢ آخر المهام' : '⬢ Recent Tasks'}</h3>
                  <div className="emp-task-list">
                    {tasks.slice(0, 5).map(task => (
                      <div key={task.taskId} className={`emp-task-item priority-${task.priority}`}>
                        <div className="emp-task-header">
                          <span className="emp-task-title">{task.title}</span>
                          <span className={`emp-status-badge ${task.status}`}>{statusLabels[task.status]}</span>
                        </div>
                        <div className="emp-task-meta">
                          {task.section && (
                            <span className="emp-section-tag" style={{ backgroundColor: SECTION_COLORS[task.section] || '#666' }}>
                              {sectionLabels[task.section] || task.section}
                            </span>
                          )}
                          <span className="emp-task-date">{task.startDate}</span>
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && <p className="emp-empty">{isRTL ? '— لا توجد مهام —' : '— No tasks yet —'}</p>}
                  </div>
                </div>

                <div className="emp-section-card">
                  <h3>{isRTL ? '★ آخر التقييمات' : '★ Recent Ratings'}</h3>
                  <div className="emp-ratings-list">
                    {profile.recentRatings.map(r => (
                      <div key={r.ratingId} className={`emp-rating-item ${r.type}`}>
                        <span className={`emp-rating-badge ${r.type}`}>
                          {r.type === 'award' ? '+' : '−'}{r.points}
                        </span>
                        <div className="emp-rating-info">
                          <span className="emp-rating-criteria">{r.criteria || (isRTL ? 'تقييم عام' : 'General rating')}</span>
                          <span className="emp-rating-date">{r.ratingDate}</span>
                        </div>
                        <span className="emp-rating-by">{r.ratedBy?.fullName}</span>
                      </div>
                    ))}
                    {profile.recentRatings.length === 0 && <p className="emp-empty">{isRTL ? '— لا توجد تقييمات —' : '— No ratings yet —'}</p>}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════ TASKS */}
          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              className="emp-tasks-tab"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -12 }}
            >
              <motion.div variants={itemVariants} className="emp-tasks-tab-head">
                <div className="emp-headline" style={{ margin: 0 }}>
                  <span className="emp-headline-tag">[02] {isRTL ? 'قائمة المهام' : 'Task Queue'}</span>
                  <h2 className="emp-headline-title">{isRTL ? 'المهام' : 'Tasks'}</h2>
                </div>
                <button className="emp-btn-primary" style={{ padding: '9px 18px' }} onClick={() => setShowCreateTaskModal(true)}>
                  + {isRTL ? 'مهمة جديدة' : 'New Task'}
                </button>
              </motion.div>

              <motion.div variants={itemVariants}>
                <div className="emp-filter-tabs">
                  {[
                    { key: 'all', label: isRTL ? 'الكل' : 'All', count: tasks.length, color: '#94a3b8' },
                    { key: 'in_progress', label: isRTL ? 'قيد التنفيذ' : 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, color: '#22d3ee' },
                    { key: 'pending', label: isRTL ? 'قيد الانتظار' : 'Pending', count: tasks.filter(t => t.status === 'pending').length, color: '#f59e0b' },
                    { key: 'completed', label: isRTL ? 'مكتمل' : 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: '#4ade80' },
                    { key: 'uncompleted', label: isRTL ? 'غير مكتمل' : 'Uncompleted', count: tasks.filter(t => t.status === 'uncompleted').length, color: '#EE2329' },
                    { key: 'cancelled', label: isRTL ? 'ملغى' : 'Cancelled', count: tasks.filter(t => t.status === 'cancelled').length, color: '#5b6577' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      className={`emp-filter-tab ${taskStatusFilter === tab.key ? 'active' : ''}`}
                      onClick={() => setTaskStatusFilter(tab.key)}
                    >
                      <span className="emp-filter-dot" style={{ background: tab.color, color: tab.color }} />
                      {tab.label}
                      <span className="emp-filter-count">{tab.count}</span>
                    </button>
                  ))}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="emp-task-cards">
                <AnimatePresence mode="popLayout">
                  {filteredTasks.length === 0 ? (
                    <motion.div
                      key="empty"
                      className="emp-empty-state"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <p>{isRTL ? '— لا توجد مهام في هذا التصنيف —' : '— No tasks in this queue —'}</p>
                    </motion.div>
                  ) : filteredTasks.map((task, i) => (
                    <motion.div
                      key={task.taskId}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                      transition={{ delay: i * 0.03, type: 'spring', stiffness: 260, damping: 22 }}
                      className={`emp-task-card priority-${task.priority} status-${task.status}`}
                    >
                      <div className="emp-task-card-header">
                        <div>
                          <h4>{task.title}</h4>
                          {task.selfCreated
                            ? <span className="emp-assigned-by" style={{ color: '#22d3ee' }}>{isRTL ? '◆ مهمة ذاتية' : '◆ Self-created'}</span>
                            : task.creator && <span className="emp-assigned-by">{isRTL ? 'من المدير:' : 'ASSIGNED BY:'} {task.creator.fullName}</span>
                          }
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select
                            className="emp-status-select"
                            value={task.status}
                            onChange={(e) => handleUpdateTaskStatus(task.taskId, e.target.value)}
                          >
                            <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                            <option value="in_progress">{isRTL ? 'قيد التنفيذ' : 'In Progress'}</option>
                            <option value="completed">{isRTL ? 'مكتمل' : 'Completed'}</option>
                            <option value="uncompleted">{isRTL ? 'غير مكتمل' : 'Uncompleted'}</option>
                            <option value="cancelled">{isRTL ? 'ملغى' : 'Cancelled'}</option>
                          </select>
                          {/* "Submit for review" is only relevant for
                              self-created tasks — that's how the
                              employee asks a manager to grade their
                              own work. Manager-assigned tasks skip it. */}
                          {task.selfCreated && (
                            task.status !== 'pending_review' ? (
                              <button
                                className="emp-review-btn"
                                onClick={() => handleUpdateTaskStatus(task.taskId, 'pending_review')}
                              >
                                {isRTL ? '↑ مراجعة' : '↑ REVIEW'}
                              </button>
                            ) : (
                              <span className="emp-review-pill">
                                {isRTL ? '⏳ مراجعة' : '⏳ Reviewing'}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      {task.description && <p className="emp-task-desc">{task.description}</p>}
                      <div className="emp-task-card-footer">
                        {task.section && (
                          <span className="emp-section-tag" style={{ backgroundColor: SECTION_COLORS[task.section] || '#666' }}>
                            {sectionLabels[task.section] || task.section}
                          </span>
                        )}
                        <span className={`emp-priority-tag ${task.priority}`}>{task.priority}</span>
                        <span className="emp-task-date">
                          {task.startDate}{task.startDate !== task.endDate ? ` → ${task.endDate}` : ''}
                        </span>
                        {task.dueTime && <span className="emp-task-time">◷ {formatTimeAMPM(task.dueTime)}</span>}
                      </div>
                      {task.notes && (
                        <div className="emp-task-notes">
                          <strong>{isRTL ? 'ملاحظات:' : 'Notes:'}</strong> {task.notes}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════ REGISTRATIONS */}
          {activeTab === 'registrations' && (
            <motion.div
              key="registrations"
              className="emp-tasks-tab"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
            >
              <motion.div variants={itemVariants} className="emp-tasks-tab-head">
                <div>
                  <h2 style={{ margin: 0 }}>
                    {isRTL ? 'طلبات التسجيل — أقسامي' : 'Registration Requests — My Sections'}
                  </h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--ink-muted, #94a3b8)', fontSize: 13 }}>
                    {isRTL
                      ? 'تظهر هنا طلبات المستفيدين الخاصة بأقسامك فقط. الموافقة أو الرفض ترسل رسالة تلقائية للمستفيد بالبريد.'
                      : 'Requests for your assigned sections. Approving or rejecting emails the beneficiary automatically.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { key: 'pending',  ar: 'قيد المراجعة', en: 'Pending',  color: '#f59e0b' },
                    { key: 'approved', ar: 'المعتمدة',    en: 'Approved', color: '#16a34a' },
                    { key: 'rejected', ar: 'المرفوضة',    en: 'Rejected', color: '#dc2626' },
                    { key: 'on-hold',  ar: 'معلقة',       en: 'On hold',  color: '#0ea5e9' },
                    { key: 'all',      ar: 'الكل',        en: 'All',      color: '#64748b' }
                  ].map(f => {
                    const active = regStatusFilter === f.key;
                    const count = f.key === 'all'
                      ? registrations.length
                      : registrations.filter(r => r.status === f.key).length;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setRegStatusFilter(f.key)}
                        style={{
                          padding: '6px 14px', borderRadius: 999,
                          border: active ? 'none' : '1px solid var(--term-divider, #334155)',
                          background: active ? f.color : 'transparent',
                          color: active ? '#fff' : 'var(--emp-text, #cbd5e1)',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        {isRTL ? f.ar : f.en} · {count}
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="emp-tasks-grid">
                <AnimatePresence>
                  {(regStatusFilter === 'all'
                    ? registrations
                    : registrations.filter(r => r.status === regStatusFilter)
                  ).length === 0 ? (
                    <div className="emp-empty" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                      {isRTL ? '— لا توجد طلبات مطابقة —' : '— No matching requests —'}
                    </div>
                  ) : (regStatusFilter === 'all'
                        ? registrations
                        : registrations.filter(r => r.status === regStatusFilter)
                      ).map((r, i) => {
                        const uName = r.user?.name || `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.trim() || '—';
                        const appointment = r.appointmentDate || r.visitDate || r.startDate;
                        const appointmentTime = r.appointmentTime || r.visitStartTime || r.startTime;
                        const statusColor = r.status === 'approved' ? '#16a34a'
                          : r.status === 'rejected' ? '#dc2626'
                          : r.status === 'on-hold' ? '#0ea5e9'
                          : '#f59e0b';
                        const services = Array.isArray(r.requiredServices) ? r.requiredServices : [];
                        return (
                          <motion.div
                            key={r.registrationId}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                            transition={{ delay: i * 0.03, type: 'spring', stiffness: 260, damping: 22 }}
                            className="emp-task-card"
                            style={{ borderInlineStart: `4px solid ${statusColor}`, padding: 16 }}
                          >
                            <div className="emp-task-card-header">
                              <div>
                                <h4 style={{ margin: 0 }}>{uName}</h4>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                                  {r.fablabSection} · {r.registrationId}
                                </div>
                              </div>
                              <span
                                className={`emp-status-badge`}
                                style={{ background: `${statusColor}25`, color: statusColor, padding: '3px 10px', borderRadius: 999, fontWeight: 800, fontSize: 12 }}
                              >
                                {r.status === 'approved' ? (isRTL ? 'معتمدة' : 'Approved')
                                : r.status === 'rejected' ? (isRTL ? 'مرفوضة' : 'Rejected')
                                : r.status === 'on-hold' ? (isRTL ? 'معلقة' : 'On hold')
                                : (isRTL ? 'قيد المراجعة' : 'Pending')}
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, margin: '12px 0' }}>
                              {r.user?.phoneNumber && (
                                <div><div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.6 }}>{isRTL ? 'الجوال' : 'PHONE'}</div><div dir="ltr" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{r.user.phoneNumber}</div></div>
                              )}
                              {r.user?.email && (
                                <div><div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.6 }}>{isRTL ? 'البريد' : 'EMAIL'}</div><div dir="ltr" style={{ fontSize: 12 }}>{r.user.email}</div></div>
                              )}
                              {appointment && (
                                <div><div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.6 }}>{isRTL ? 'الموعد' : 'APPOINTMENT'}</div><div dir="ltr" style={{ fontSize: 13 }}>{appointment}{appointmentTime ? ` · ${String(appointmentTime).slice(0,5)}` : ''}</div></div>
                              )}
                            </div>

                            {services.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                {services.map((s, si) => (
                                  <span key={si} style={{ fontSize: 11.5, background: 'rgba(148,163,184,0.15)', padding: '3px 10px', borderRadius: 999 }}>
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}

                            {r.serviceDetails && (
                              <div style={{ background: 'rgba(148,163,184,0.08)', padding: '10px 14px', borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap', marginBottom: 10 }}>
                                {r.serviceDetails}
                              </div>
                            )}

                            {r.rejectionReason && (
                              <div style={{ background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 10, color: '#dc2626' }}>
                                <b>{isRTL ? 'سبب الرفض: ' : 'Rejection reason: '}</b>{r.rejectionReason}
                              </div>
                            )}
                            {r.adminNotes && (
                              <div style={{ background: 'rgba(14,165,233,0.10)', border: '1px solid rgba(14,165,233,0.25)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 10, color: '#0ea5e9' }}>
                                <b>{isRTL ? 'ملاحظات: ' : 'Notes: '}</b>{r.adminNotes}
                              </div>
                            )}

                            {(r.status === 'pending' || r.status === 'on-hold') && (
                              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                <button
                                  className="emp-review-btn"
                                  style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                  onClick={() => openRegDecide(r, 'reject')}
                                >
                                  ✕ {isRTL ? 'رفض' : 'Reject'}
                                </button>
                                <button
                                  className="emp-review-btn"
                                  style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                  onClick={() => openRegDecide(r, 'approve')}
                                >
                                  ✓ {isRTL ? 'اعتماد' : 'Approve'}
                                </button>
                              </div>
                            )}
                            {r.approvedBy && (
                              <div style={{ marginTop: 8, fontSize: 11.5, color: '#94a3b8' }}>
                                {isRTL ? 'اتخذ القرار: ' : 'Decided by: '}<b>{r.approvedBy}</b>
                                {r.approvedAt && <> · {new Date(r.approvedAt).toLocaleString(isRTL ? 'ar-SA' : undefined, { dateStyle: 'short', timeStyle: 'short' })}</>}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}

          {/* Decision modal (approve / reject registration) */}
          <AnimatePresence>
            {regDecideModal && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={closeRegDecide}
                style={{ position: 'fixed', inset: 0, background: 'var(--term-modal-scrim, rgba(15,23,42,0.6))', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: 'var(--term-panel-solid, #0f172a)', color: 'var(--ink-primary, #e2e8f0)', borderRadius: 14, maxWidth: 520, width: '100%', border: '1px solid var(--term-divider, #334155)' }}
                >
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--term-divider, #334155)' }}>
                    <div style={{ fontSize: 11, letterSpacing: 1.2, color: regDecideModal.mode === 'approve' ? '#16a34a' : '#dc2626', textTransform: 'uppercase', fontWeight: 800 }}>
                      {regDecideModal.mode === 'approve'
                        ? (isRTL ? 'اعتماد الطلب' : 'Approve Registration')
                        : (isRTL ? 'رفض الطلب' : 'Reject Registration')}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{regDecideModal.name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{regDecideModal.section}</div>
                  </div>
                  <div style={{ padding: 22 }}>
                    {regDecideModal.mode === 'reject' && (
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                          {isRTL ? 'سبب الرفض *' : 'Rejection reason *'}
                        </label>
                        <textarea
                          value={regRejectReason}
                          onChange={(e) => setRegRejectReason(e.target.value)}
                          rows={2}
                          placeholder={isRTL ? 'اذكر سبب الرفض بوضوح للمستفيد' : 'Explain the rejection clearly'}
                          style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                      </div>
                    )}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        {regDecideModal.mode === 'approve'
                          ? (isRTL ? 'رسالة إضافية (اختياري)' : 'Additional message (optional)')
                          : (isRTL ? 'ملاحظة داخلية (اختياري)' : 'Internal note (optional)')}
                      </label>
                      <textarea
                        value={regNote}
                        onChange={(e) => setRegNote(e.target.value)}
                        rows={3}
                        placeholder={isRTL ? 'رسالة تظهر في بريد المستفيد إن اخترت إرسالها' : 'Message shown in the beneficiary email if enabled'}
                        style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                    </div>
                    {regNote.trim() && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14 }}>
                        <input type="checkbox" checked={regSendMessage} onChange={(e) => setRegSendMessage(e.target.checked)} />
                        {isRTL ? 'إرفاق الرسالة مع بريد المستفيد' : 'Include this message in the email to the beneficiary'}
                      </label>
                    )}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={closeRegDecide} disabled={regDecideBusy} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        onClick={submitRegDecision}
                        disabled={regDecideBusy}
                        style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: regDecideModal.mode === 'approve' ? '#16a34a' : '#dc2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}
                      >
                        {regDecideBusy
                          ? '…'
                          : regDecideModal.mode === 'approve'
                            ? (isRTL ? '✓ اعتماد وإرسال' : '✓ Approve & email')
                            : (isRTL ? '✕ رفض وإرسال' : '✕ Reject & email')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════════════════════════════════════════════ OVERTIME */}
          {activeTab === 'overtime' && (
            <motion.div
              key="overtime"
              className="emp-tasks-tab"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
            >
              <motion.div variants={itemVariants} className="emp-tasks-tab-head">
                <div>
                  <h2 style={{ margin: 0 }}>{isRTL ? '🕓 ساعاتي الإضافية' : '🕓 My Overtime'}</h2>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
                    {isRTL
                      ? 'أنشئ طلب ساعات إضافية، أرسله للمدير للاعتماد، وتابع حالته.'
                      : 'Create an overtime request, send it to the manager, and track its status.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { key: 'all',      ar: 'الكل',     en: 'All',      color: '#64748b' },
                      { key: 'draft',    ar: 'مسودات',   en: 'Drafts',   color: '#94a3b8' },
                      { key: 'pending',  ar: 'قيد الاعتماد', en: 'Pending', color: '#f59e0b' },
                      { key: 'approved', ar: 'معتمدة',   en: 'Approved', color: '#16a34a' },
                      { key: 'rejected', ar: 'مرفوضة',   en: 'Rejected', color: '#dc2626' }
                    ].map(f => {
                      const active = otStatusFilter === f.key;
                      const count = f.key === 'all'
                        ? myOvertime.length
                        : myOvertime.filter(r => r.approvalStatus === f.key).length;
                      return (
                        <button
                          key={f.key}
                          onClick={() => setOtStatusFilter(f.key)}
                          style={{
                            padding: '6px 14px', borderRadius: 999,
                            border: active ? 'none' : '1px solid var(--term-divider, #334155)',
                            background: active ? f.color : 'transparent',
                            color: active ? '#fff' : 'var(--emp-text, #cbd5e1)',
                            fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer'
                          }}
                        >
                          {isRTL ? f.ar : f.en} · {count}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={otOpenCreate}
                    style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #d97706, #92400e)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    + {isRTL ? 'طلب جديد' : 'New Request'}
                  </button>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="emp-tasks-grid">
                <AnimatePresence>
                  {(otStatusFilter === 'all' ? myOvertime : myOvertime.filter(r => r.approvalStatus === otStatusFilter)).length === 0 ? (
                    <div className="emp-empty" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                      {isRTL ? '— لا توجد طلبات —' : '— No requests —'}
                    </div>
                  ) : (otStatusFilter === 'all' ? myOvertime : myOvertime.filter(r => r.approvalStatus === otStatusFilter)).map((r, i) => {
                    const statusColor = r.approvalStatus === 'approved' ? '#16a34a'
                      : r.approvalStatus === 'rejected' ? '#dc2626'
                      : r.approvalStatus === 'pending' ? '#f59e0b'
                      : '#94a3b8';
                    const statusLabel = r.approvalStatus === 'approved' ? (isRTL ? 'معتمد' : 'Approved')
                      : r.approvalStatus === 'rejected' ? (isRTL ? 'مرفوض' : 'Rejected')
                      : r.approvalStatus === 'pending' ? (isRTL ? 'قيد الاعتماد' : 'Pending')
                      : (isRTL ? 'مسودة' : 'Draft');
                    return (
                      <motion.div
                        key={r.overtimeId}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                        transition={{ delay: i * 0.03, type: 'spring', stiffness: 260, damping: 22 }}
                        className="emp-task-card"
                        style={{ borderInlineStart: `4px solid ${statusColor}`, padding: 16 }}
                      >
                        <div className="emp-task-card-header">
                          <div>
                            <h4 style={{ margin: 0 }}>{r.employeeName}</h4>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                              {r.periodStart && r.periodEnd ? `${r.periodStart} → ${r.periodEnd}` : (r.periodStart || '—')}
                            </div>
                          </div>
                          <span style={{ background: `${statusColor}25`, color: statusColor, padding: '3px 10px', borderRadius: 999, fontWeight: 800, fontSize: 12 }}>
                            {statusLabel}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, margin: '12px 0' }}>
                          <div><div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.6 }}>{isRTL ? 'إجمالي الساعات' : 'TOTAL HOURS'}</div><div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 15, color: statusColor }}>{Number(r.totalHours || 0).toFixed(2)}</div></div>
                          <div><div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.6 }}>{isRTL ? 'عدد الأيام' : 'DAYS'}</div><div style={{ fontSize: 14 }}>{(r.days || []).length}</div></div>
                          {r.sentForApprovalAt && (
                            <div><div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.6 }}>{isRTL ? 'أُرسل' : 'SENT'}</div><div style={{ fontSize: 12 }} dir="ltr">{new Date(r.sentForApprovalAt).toLocaleString(isRTL ? 'ar-SA' : undefined, { dateStyle: 'short', timeStyle: 'short' })}</div></div>
                          )}
                        </div>

                        {r.sanadDetails && (
                          <div style={{ background: 'rgba(148,163,184,0.08)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                            <b>{isRTL ? 'تفاصيل السند: ' : 'Sanad details: '}</b>{r.sanadDetails}
                          </div>
                        )}
                        {r.managerNote && (
                          <div style={{ background: `${statusColor}12`, border: `1px solid ${statusColor}44`, padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 10, color: statusColor }}>
                            <b>{isRTL ? 'ملاحظة المدير: ' : 'Manager note: '}</b>{r.managerNote}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                          {(r.approvalStatus === 'draft' || r.approvalStatus === 'rejected') && (
                            <>
                              <button
                                onClick={() => otOpenEdit(r)}
                                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}
                              >
                                ✎ {isRTL ? 'تعديل' : 'Edit'}
                              </button>
                              <button
                                onClick={() => otDelete(r)}
                                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}
                              >
                                🗑 {isRTL ? 'حذف' : 'Delete'}
                              </button>
                              <button
                                onClick={() => otOpenSend(r)}
                                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12 }}
                              >
                                📤 {isRTL ? 'إرسال للمدير' : 'Send to Manager'}
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}

          {/* Overtime form modal */}
          <AnimatePresence>
            {otFormOpen && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={otCloseForm}
                style={{ position: 'fixed', inset: 0, background: 'var(--term-modal-scrim, rgba(15,23,42,0.7))', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: 'var(--term-panel-solid, #0f172a)', color: 'var(--ink-primary, #e2e8f0)', borderRadius: 14, maxWidth: 780, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--term-divider, #334155)' }}
                >
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--term-divider, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: 1.2, color: '#f59e0b', textTransform: 'uppercase', fontWeight: 800 }}>
                        {otEditingId ? (isRTL ? 'تعديل طلب' : 'Edit Request') : (isRTL ? 'طلب ساعات إضافية' : 'New Overtime Request')}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                        {isRTL ? `إجمالي الساعات: ${otTotalHours.toFixed(2)}` : `Total hours: ${otTotalHours.toFixed(2)}`}
                      </div>
                    </div>
                    <button onClick={otCloseForm} style={{ background: 'rgba(148,163,184,0.16)', border: 'none', color: 'inherit', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                  <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
                      <label style={{ fontSize: 12 }}>
                        {isRTL ? 'الاسم *' : 'Name *'}
                        <input value={otForm.employeeName} onChange={(e) => setOtForm(f => ({ ...f, employeeName: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: 9, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit' }} />
                      </label>
                      <label style={{ fontSize: 12 }}>
                        {isRTL ? 'الوظيفة / القسم' : 'Position'}
                        <input value={otForm.position} onChange={(e) => setOtForm(f => ({ ...f, position: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: 9, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit' }} />
                      </label>
                      <label style={{ fontSize: 12 }}>
                        {isRTL ? 'رقم الهوية' : 'National ID'}
                        <input dir="ltr" value={otForm.nationalId} onChange={(e) => setOtForm(f => ({ ...f, nationalId: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: 9, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit' }} />
                      </label>
                      <label style={{ fontSize: 12 }}>
                        {isRTL ? 'الجوال' : 'Phone'}
                        <input dir="ltr" value={otForm.phone} onChange={(e) => setOtForm(f => ({ ...f, phone: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: 9, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit' }} />
                      </label>
                      <label style={{ fontSize: 12 }}>
                        {isRTL ? 'من تاريخ' : 'Period start'}
                        <input type="date" value={otForm.periodStart} onChange={(e) => setOtForm(f => ({ ...f, periodStart: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: 9, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit' }} />
                      </label>
                      <label style={{ fontSize: 12 }}>
                        {isRTL ? 'إلى تاريخ' : 'Period end'}
                        <input type="date" value={otForm.periodEnd} onChange={(e) => setOtForm(f => ({ ...f, periodEnd: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: 9, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit' }} />
                      </label>
                    </div>

                    {/* Import from staff attendance (QR scans). Only
                        shown when the employee has a linked FabLab-
                        staff record with detected overtime. */}
                    {otAutoLinked && otAutoRows.length > 0 && (
                      <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 1, color: '#f59e0b' }}>
                              {isRTL ? '📥 استيراد من الحضور التلقائي (QR)' : '📥 IMPORT FROM ATTENDANCE (QR)'}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                              {isRTL
                                ? `${otAutoRows.length} يوم مسجل تجاوز الوقت الرسمي`
                                : `${otAutoRows.length} scanned day(s) with overtime detected`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={otPickAllAuto} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--term-divider, #334155)', background: 'transparent', color: '#f59e0b', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {isRTL ? 'اختر الكل' : 'Pick all'}
                            </button>
                            <button type="button" onClick={otClearAutoPick} disabled={otAutoPicked.size === 0} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--term-divider, #334155)', background: 'transparent', color: 'inherit', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: otAutoPicked.size === 0 ? 0.5 : 1 }}>
                              {isRTL ? 'مسح' : 'Clear'}
                            </button>
                            <button
                              type="button"
                              onClick={otImportAutoPicked}
                              disabled={otAutoPicked.size === 0}
                              style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 11.5, cursor: otAutoPicked.size === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 800, opacity: otAutoPicked.size === 0 ? 0.5 : 1 }}
                            >
                              📥 {isRTL ? `استيراد (${otAutoPicked.size})` : `Import (${otAutoPicked.size})`}
                            </button>
                          </div>
                        </div>
                        <div style={{ marginTop: 10, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--term-divider, #334155)', borderRadius: 8 }}>
                          {otAutoRows.map(r => {
                            const picked = otAutoPicked.has(r.attendanceId);
                            const hrs = (r.overtimeMinutes / 60).toFixed(2);
                            const fmtT = (iso) => {
                              if (!iso) return '—';
                              const d = new Date(iso);
                              if (isNaN(d.getTime())) return '—';
                              return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                            };
                            return (
                              <div
                                key={r.attendanceId}
                                onClick={() => otToggleAutoPick(r.attendanceId)}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '24px 1fr 1fr 1fr 80px',
                                  gap: 8, alignItems: 'center',
                                  padding: '7px 10px',
                                  background: picked ? 'rgba(245,158,11,0.15)' : 'transparent',
                                  borderBottom: '1px solid rgba(148,163,184,0.1)',
                                  cursor: 'pointer', fontSize: 12
                                }}
                              >
                                <input type="checkbox" checked={picked} onChange={() => otToggleAutoPick(r.attendanceId)} onClick={(e) => e.stopPropagation()} />
                                <span dir="ltr">{String(r.date).slice(0, 10)}</span>
                                <span dir="ltr" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtT(r.checkInAt)} → {fmtT(r.checkOutAt)}</span>
                                <span style={{ color: '#94a3b8', fontSize: 11.5 }}>{r.reason || (isRTL ? '—' : '—')}</span>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#f59e0b', textAlign: 'end' }}>{hrs} h</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {otAutoLinked && otAutoRows.length === 0 && (
                      <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(148,163,184,0.05)', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                        {isRTL ? 'لا يوجد ساعات إضافية مسجلة من الحضور بعد.' : 'No overtime detected from QR attendance yet.'}
                      </div>
                    )}
                    {!otAutoLinked && (
                      <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.25)', fontSize: 12, color: '#dc2626', textAlign: 'center' }}>
                        {isRTL
                          ? '⚠️ حسابك غير مربوط بسجل موظف فاب لاب — لن تظهر خيارات الاستيراد من الحضور. راجع المدير لمطابقة البريد الإلكتروني في السجلين.'
                          : '⚠️ Your account is not linked to a FabLab-staff record — import is unavailable. Ask your manager to align the email between the two records.'}
                      </div>
                    )}

                    <div style={{ marginTop: 10, marginBottom: 6, fontSize: 11.5, fontWeight: 800, letterSpacing: 1, color: '#f59e0b' }}>
                      {isRTL ? 'الأيام والساعات' : 'DAYS & HOURS'}
                    </div>
                    <div className="ot-days-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {otForm.days.map((d, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 1fr 2fr auto', gap: 6, alignItems: 'center', background: 'rgba(148,163,184,0.06)', padding: 8, borderRadius: 8 }}>
                          <input type="date" value={d.date} onChange={(e) => otUpdateDay(idx, { date: e.target.value })} style={{ padding: 7, borderRadius: 6, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontSize: 12, fontFamily: 'inherit' }} />
                          <input type="time" value={d.startTime} onChange={(e) => otUpdateDay(idx, { startTime: e.target.value })} style={{ padding: 7, borderRadius: 6, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontSize: 12, fontFamily: 'inherit' }} />
                          <input type="time" value={d.endTime} onChange={(e) => otUpdateDay(idx, { endTime: e.target.value })} style={{ padding: 7, borderRadius: 6, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontSize: 12, fontFamily: 'inherit' }} />
                          <input type="number" step="0.25" min="0" placeholder="hrs" value={d.hours} onChange={(e) => otUpdateDay(idx, { hours: e.target.value })} style={{ padding: 7, borderRadius: 6, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} />
                          <input type="text" placeholder={isRTL ? 'المهمة المنجزة' : 'Task performed'} value={d.task} onChange={(e) => otUpdateDay(idx, { task: e.target.value })} style={{ padding: 7, borderRadius: 6, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontSize: 12, fontFamily: 'inherit' }} />
                          <button type="button" onClick={() => otRemoveDay(idx)} disabled={otForm.days.length <= 1} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', cursor: otForm.days.length <= 1 ? 'not-allowed' : 'pointer', fontSize: 12, opacity: otForm.days.length <= 1 ? 0.5 : 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={otAddDay} style={{ marginTop: 8, padding: '7px 14px', borderRadius: 8, border: '1px dashed var(--term-divider, #334155)', background: 'transparent', color: '#f59e0b', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                      + {isRTL ? 'إضافة يوم' : 'Add day'}
                    </button>

                    <div style={{ marginTop: 14 }}>
                      <label style={{ fontSize: 12 }}>
                        {isRTL ? 'تفاصيل السند (اختياري)' : 'Sanad details (optional)'}
                        <textarea rows={2} value={otForm.sanadDetails} onChange={(e) => setOtForm(f => ({ ...f, sanadDetails: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: 9, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }} />
                      </label>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 12 }}>
                        {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                        <textarea rows={2} value={otForm.note} onChange={(e) => setOtForm(f => ({ ...f, note: e.target.value }))} style={{ width: '100%', marginTop: 4, padding: 9, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }} />
                      </label>
                    </div>
                  </div>
                  <div style={{ padding: '14px 22px', borderTop: '1px solid var(--term-divider, #334155)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={otCloseForm} disabled={otBusy} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button onClick={otSubmitForm} disabled={otBusy} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}>
                      {otBusy ? '…' : otEditingId ? (isRTL ? '✓ حفظ التعديلات' : '✓ Save changes') : (isRTL ? '✓ حفظ كمسودة' : '✓ Save draft')}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Send-for-approval modal */}
          <AnimatePresence>
            {otSendModal && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={otCloseSend}
                style={{ position: 'fixed', inset: 0, background: 'var(--term-modal-scrim, rgba(15,23,42,0.7))', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: 'var(--term-panel-solid, #0f172a)', color: 'var(--ink-primary, #e2e8f0)', borderRadius: 14, maxWidth: 480, width: '100%', border: '1px solid var(--term-divider, #334155)' }}
                >
                  <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--term-divider, #334155)' }}>
                    <div style={{ fontSize: 11, letterSpacing: 1.2, color: '#f59e0b', textTransform: 'uppercase', fontWeight: 800 }}>
                      {isRTL ? 'إرسال للاعتماد' : 'Send for approval'}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      {isRTL
                        ? 'سيتم إرسال الطلب لبريد المدير للمراجعة والاعتماد.'
                        : 'The request will be emailed to the manager for review and approval.'}
                    </div>
                  </div>
                  <div style={{ padding: 22 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {isRTL ? 'بريد المدير *' : 'Manager email *'}
                    </label>
                    {OT_APPROVERS.length > 0 && (
                      <select
                        value={OT_APPROVERS.some(a => a.email === otSendModal.managerEmail) ? otSendModal.managerEmail : '__custom__'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') return;
                          setOtSendModal(s => ({ ...s, managerEmail: val }));
                        }}
                        style={{ width: '100%', marginTop: 6, padding: 10, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'inherit', fontSize: 13 }}
                      >
                        {OT_APPROVERS.map(a => (
                          <option key={a.email} value={a.email}>{a.name} · {a.email}</option>
                        ))}
                        <option value="__custom__">{isRTL ? 'بريد آخر...' : 'Other email...'}</option>
                      </select>
                    )}
                    <input
                      type="email"
                      dir="ltr"
                      value={otSendModal.managerEmail}
                      onChange={(e) => setOtSendModal(s => ({ ...s, managerEmail: e.target.value }))}
                      placeholder="manager@example.com"
                      style={{ width: '100%', marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'var(--term-inline-panel, #020617)', color: 'inherit', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                      <button onClick={otCloseSend} disabled={otBusy} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--term-divider, #334155)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button onClick={otSubmitSend} disabled={otBusy} style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}>
                        {otBusy ? '…' : (isRTL ? '📤 إرسال للمدير' : '📤 Send to Manager')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════════════════════════════════════════════ ATTENDANCE */}
          {activeTab === 'attendance' && (
            <motion.div
              key="attendance"
              className="emp-tasks-tab"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
            >
              <motion.div variants={itemVariants} className="emp-tasks-tab-head">
                <div>
                  <h2 style={{ margin: 0 }}>{isRTL ? '✅ سجل الحضور' : '✅ Attendance Log'}</h2>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
                    {isRTL
                      ? 'حضورك المُسجّل عبر QR في محطة الحضور. يتم إحتساب الساعات الإضافية تلقائياً بعد 9 ساعات.'
                      : 'Your QR-scanned attendance history from the check-in station. Overtime accrues after 9 hours.'}
                  </p>
                </div>
                {!myAttendanceLinked && (
                  <div style={{ padding: '6px 12px', background: 'rgba(220,38,38,0.15)', color: '#dc2626', borderRadius: 6, fontSize: 11.5, fontWeight: 700 }}>
                    {isRTL
                      ? 'لا يوجد ربط بسجل حضور فاب لاب — راجع المدير'
                      : 'No linked FabLab-staff record — contact your manager'}
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants}>
                {myAttendance.length === 0 ? (
                  <div className="emp-empty" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                    {myAttendanceLinked
                      ? (isRTL ? '— لا توجد سجلات حضور بعد —' : '— No attendance records yet —')
                      : (isRTL ? '— لا يوجد ربط بحساب حضور —' : '— No linked staff record —')}
                  </div>
                ) : (
                  <div style={{ background: 'var(--term-panel-solid, #0f172a)', border: '1px solid var(--term-divider, #334155)', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'rgba(148,163,184,0.06)' }}>
                          <th style={{ padding: '10px 12px', textAlign: 'start', fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.6 }}>{isRTL ? 'التاريخ' : 'DATE'}</th>
                          <th style={{ padding: '10px 12px', textAlign: 'start', fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.6 }}>{isRTL ? 'دخول' : 'CHECK-IN'}</th>
                          <th style={{ padding: '10px 12px', textAlign: 'start', fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.6 }}>{isRTL ? 'خروج' : 'CHECK-OUT'}</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.6 }}>{isRTL ? 'المدة' : 'DURATION'}</th>
                          <th style={{ padding: '10px 12px', textAlign: 'start', fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.6 }}>{isRTL ? 'ملاحظة' : 'REASON'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myAttendance.map(r => {
                          const fmtT = (iso) => {
                            if (!iso) return '—';
                            const d = new Date(iso);
                            if (isNaN(d.getTime())) return '—';
                            return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                          };
                          let dur = '—';
                          if (r.checkInAt && r.checkOutAt) {
                            const mins = Math.max(0, Math.round((new Date(r.checkOutAt) - new Date(r.checkInAt)) / 60000));
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            dur = `${h}h ${String(m).padStart(2, '0')}m`;
                          } else if (r.checkInAt && !r.checkOutAt) {
                            dur = isRTL ? 'لم يخرج' : 'Open';
                          }
                          const dayName = (() => {
                            try {
                              return new Date(r.date).toLocaleDateString(isRTL ? 'ar-SA' : undefined, { weekday: 'long' });
                            } catch { return ''; }
                          })();
                          return (
                            <tr key={r.attendanceId} style={{ borderTop: '1px solid rgba(148,163,184,0.08)' }}>
                              <td style={{ padding: '10px 12px' }}>
                                <div dir="ltr" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{String(r.date).slice(0, 10)}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{dayName}</div>
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{fmtT(r.checkInAt)}</td>
                              <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{fmtT(r.checkOutAt)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: r.checkOutAt ? '#16a34a' : '#f59e0b' }}>{dur}</td>
                              <td style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>{r.reason || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════ SCHEDULE */}
          {activeTab === 'schedule' && (
            <motion.div
              key="schedule"
              className="emp-schedule-tab"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -12 }}
            >
              <motion.div variants={itemVariants}>
                <div className="emp-headline">
                  <span className="emp-headline-tag">[03] {isRTL ? 'الجدول الزمني' : 'Timeline'}</span>
                  <h2 className="emp-headline-title">{isRTL ? 'التقويم' : 'Calendar'}</h2>
                  <span className="emp-headline-rest" />
                </div>
                <div className="emp-calendar">
                  <div className="emp-calendar-header">
                    <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))}>&lt;</button>
                    <h3>{format(calendarDate, 'MMMM yyyy', { locale: isRTL ? ar : enUS })}</h3>
                    <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))}>&gt;</button>
                  </div>
                  <div className="emp-calendar-weekdays">
                    {(isRTL ? ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(d => (
                      <div key={d} className="emp-weekday">{d}</div>
                    ))}
                  </div>
                  <div className="emp-calendar-grid">
                    {Array.from({ length: startDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="emp-calendar-day empty" />
                    ))}
                    {daysInMonth.map(day => {
                      const events = getEventsForDay(day);
                      const hasEvents = events.length > 0;
                      return (
                        <motion.div
                          key={day.toISOString()}
                          className={`emp-calendar-day ${isToday(day) ? 'today' : ''} ${hasEvents ? 'has-events' : ''} ${selectedDay && isSameDay(day, selectedDay) ? 'selected' : ''}`}
                          onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <span className="emp-day-number">{format(day, 'd')}</span>
                          {hasEvents && <span className="emp-event-count">{events.length}</span>}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>

              <AnimatePresence>
                {selectedDay && (
                  <motion.div
                    className="emp-day-events"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  >
                    <h4>▸ {format(selectedDay, 'EEEE, d MMMM', { locale: isRTL ? ar : enUS })}</h4>
                    {getEventsForDay(selectedDay).length === 0 ? (
                      <p className="emp-empty">{isRTL ? '— لا توجد أحداث لهذا اليوم —' : '— No events for this day —'}</p>
                    ) : getEventsForDay(selectedDay).map((event, i) => (
                      <motion.div
                        key={event.id}
                        className={`emp-event-card ${event.type === 'task' ? `priority-${event.priority}` : 'appointment'}`}
                        initial={{ opacity: 0, x: isRTL ? -12 : 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <div className="emp-event-header">
                          <span className="emp-event-title">
                            {event.type === 'appointment' && <span style={{ color: '#4ade80', marginInlineEnd: 6 }}>●</span>}
                            {event.title}
                          </span>
                          {event.type === 'task' ? (
                            <select
                              className="emp-status-select small"
                              value={event.status}
                              onChange={(e) => handleUpdateTaskStatus(event.id, e.target.value)}
                            >
                              <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                              <option value="in_progress">{isRTL ? 'قيد التنفيذ' : 'In Progress'}</option>
                              <option value="completed">{isRTL ? 'مكتمل' : 'Completed'}</option>
                              <option value="uncompleted">{isRTL ? 'غير مكتمل' : 'Uncompleted'}</option>
                              <option value="cancelled">{isRTL ? 'ملغى' : 'Cancelled'}</option>
                            </select>
                          ) : (
                            <span className="emp-status-badge completed">
                              {isRTL ? 'موعد' : 'Appointment'}
                            </span>
                          )}
                        </div>
                        <div className="emp-event-meta">
                          {event.startTime && <span>◷ {formatTimeAMPM(event.startTime)}{event.endTime ? ` — ${formatTimeAMPM(event.endTime)}` : ''}</span>}
                          {event.duration && <span>({event.duration} {isRTL ? 'د' : 'min'})</span>}
                          {event.section && (
                            <span className="emp-section-tag" style={{ backgroundColor: SECTION_COLORS[event.section] || '#666' }}>
                              {sectionLabels[event.section] || event.section}
                            </span>
                          )}
                          {event.type === 'appointment' && event.phone && <span>☎ {event.phone}</span>}
                        </div>
                        {event.description && <p className="emp-event-desc">{event.description}</p>}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════ RATINGS */}
          {activeTab === 'ratings' && ratings && (
            <motion.div
              key="ratings"
              className="emp-ratings-tab"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -12 }}
            >
              <motion.div variants={itemVariants}>
                <div className="emp-headline">
                  <span className="emp-headline-tag">[04] {isRTL ? 'التقييمات' : 'Ratings'}</span>
                  <h2 className="emp-headline-title">{isRTL ? 'ملخص النقاط' : 'Points Summary'}</h2>
                  <span className="emp-headline-rest" />
                </div>
                <div className="emp-points-summary">
                  <div className="emp-points-card net">
                    <CountUp className="emp-points-value" value={ratings.netPoints} />
                    <span className="emp-points-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</span>
                  </div>
                  <div className="emp-points-card awards">
                    <CountUp className="emp-points-value" value={ratings.totalAwards} prefix="+" />
                    <span className="emp-points-label">{isRTL ? 'نقاط مكتسبة' : 'Awards'}</span>
                  </div>
                  <div className="emp-points-card deductions">
                    <CountUp className="emp-points-value" value={ratings.totalDeductions} prefix="−" />
                    <span className="emp-points-label">{isRTL ? 'نقاط مخصومة' : 'Deductions'}</span>
                  </div>
                </div>
              </motion.div>

              <motion.div className="emp-section-card" variants={itemVariants}>
                <h3>{isRTL ? '⌘ سجل التقييمات' : '⌘ Rating History'}</h3>
                <div className="emp-ratings-history">
                  {ratings.ratings.map((r, i) => (
                    <motion.div
                      key={r.ratingId}
                      className={`emp-rating-row ${r.type}`}
                      initial={{ opacity: 0, x: isRTL ? -8 : 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <span className={`emp-rating-badge ${r.type}`}>
                        {r.type === 'award' ? '+' : '−'}{r.points}
                      </span>
                      <div className="emp-rating-details">
                        <span className="emp-rating-criteria">{r.criteria || (isRTL ? 'تقييم عام' : 'General')}</span>
                        {r.notes && <span className="emp-rating-notes">{r.notes}</span>}
                      </div>
                      <div className="emp-rating-meta">
                        <span>{r.ratingDate}</span>
                        <span className="emp-rating-by">{r.ratedBy?.fullName}</span>
                      </div>
                    </motion.div>
                  ))}
                  {ratings.ratings.length === 0 && <p className="emp-empty">{isRTL ? '— لا توجد تقييمات —' : '— No ratings yet —'}</p>}
                </div>
              </motion.div>

              {myEvaluations && myEvaluations.evaluations.length > 0 && (
                <motion.div className="emp-section-card" variants={itemVariants}>
                  <h3>{isRTL ? '◐ التقييم الوظيفي' : '◐ Performance Evaluations'}</h3>
                  {myEvaluations.summary && (
                    <div className="emp-points-summary" style={{ marginBottom: 16 }}>
                      <div className="emp-points-card net">
                        <CountUp className="emp-points-value" value={myEvaluations.summary.avgScore} suffix="%" />
                        <span className="emp-points-label">{isRTL ? 'متوسط الأداء' : 'Avg Score'}</span>
                      </div>
                      <div className="emp-points-card awards">
                        <CountUp className="emp-points-value" value={myEvaluations.summary.avgScore} />
                        <span className="emp-points-label">/100</span>
                      </div>
                      {myEvaluations.summary.totalBonus > 0 && (
                        <div className="emp-points-card">
                          <CountUp className="emp-points-value" value={myEvaluations.summary.totalBonus} prefix="+" />
                          <span className="emp-points-label">{isRTL ? 'نقاط إضافية' : 'Bonus'}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {myEvaluations.evaluations.map((ev, evi) => (
                    <motion.div
                      key={ev.evaluationId}
                      className="emp-eval-item"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: evi * 0.05 }}
                    >
                      <div className="emp-eval-item-head">
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                          <span className="emp-eval-score">
                            {ev.totalScore.toFixed(1)}<span className="emp-eval-score-max">/100</span>
                          </span>
                          <span className="emp-eval-percent">{ev.totalScore.toFixed(0)}%</span>
                          {ev.bonusPoints > 0 && (
                            <span className="emp-eval-bonus">+{ev.bonusPoints} {isRTL ? 'إضافي' : 'bonus'}</span>
                          )}
                        </div>
                        {ev.period && <span className="emp-eval-period">{ev.period}</span>}
                      </div>
                      <div className="emp-eval-meta">
                        {ev.evaluationDate} · {isRTL ? 'بواسطة' : 'BY'}: {ev.evaluator?.fullName}
                        {ev.notes && <span> · {ev.notes}</span>}
                      </div>
                      <div className="emp-eval-cats">
                        {EVALUATION_CATEGORIES.map(cat => {
                          const catWeighted = cat.criteria.reduce((s, cr) => {
                            const raw = Math.min(parseFloat(ev.scores?.[`${cat.key}_${cr.key}`]) || 0, 50);
                            return s + (raw / 50) * cr.weight;
                          }, 0);
                          const catMaxWeight = cat.criteria.reduce((s, cr) => s + cr.weight, 0);
                          const isPass = catWeighted >= catMaxWeight * 0.8;
                          return (
                            <div key={cat.key} className="emp-eval-cat">
                              <span className="emp-eval-cat-name">{isRTL ? cat.nameAr : cat.nameEn}</span>
                              <span className={`emp-eval-cat-val ${isPass ? 'pass' : ''}`}>
                                {catWeighted.toFixed(1)}/{catMaxWeight}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════ WORKSHOPS */}
          {activeTab === 'workshops' && (
            <motion.div
              key="workshops"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -12 }}
              className="emp-workshops-tab"
            >
              <motion.div variants={itemVariants}>
                <div className="emp-headline">
                  <span className="emp-headline-tag">[05] {isRTL ? 'الورش' : 'Workshops'}</span>
                  <h2 className="emp-headline-title">{isRTL ? 'الورش التدريبية' : 'Training Workshops'}</h2>
                  <span className="emp-headline-rest" />
                </div>
                <div className="emp-filter-tabs" style={{ marginBottom: 16 }}>
                  {[
                    { key: 'active', label: isRTL ? 'النشطة' : 'Active', color: '#22d3ee', count: myWorkshops.filter(w => w.status !== 'completed' && w.status !== 'cancelled').length },
                    { key: 'completed', label: isRTL ? 'المكتملة' : 'Completed', color: '#4ade80', count: myWorkshops.filter(w => w.status === 'completed').length },
                    { key: 'all', label: isRTL ? 'الكل' : 'All', color: '#94a3b8', count: myWorkshops.length },
                  ].map(f => (
                    <button
                      key={f.key}
                      className={`emp-filter-tab ${(workshopViewFilter || 'active') === f.key ? 'active' : ''}`}
                      onClick={() => setWorkshopViewFilter(f.key)}
                    >
                      <span className="emp-filter-dot" style={{ background: f.color, color: f.color }} />
                      {f.label}
                      <span className="emp-filter-count">{f.count}</span>
                    </button>
                  ))}
                </div>
              </motion.div>

              {(() => {
                const filtered = (workshopViewFilter || 'active') === 'all'
                  ? myWorkshops
                  : (workshopViewFilter || 'active') === 'completed'
                    ? myWorkshops.filter(w => w.status === 'completed')
                    : myWorkshops.filter(w => w.status !== 'completed' && w.status !== 'cancelled');
                return filtered.length === 0 ? (
                  <motion.div variants={itemVariants} className="emp-empty-state">
                    <p>{isRTL ? '— لا توجد ورش —' : '— No workshops —'}</p>
                  </motion.div>
                ) : filtered.map((workshop, wi) => (
                  <motion.div
                    key={workshop.workshopId}
                    className="emp-section-card"
                    variants={itemVariants}
                    style={{ marginBottom: 20 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <h3 style={{ margin: '0 0 6px', border: 'none', paddingBottom: 0, fontSize: '1.15rem' }}>{workshop.title}</h3>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#5b6577', letterSpacing: 0.5 }}>
                          {workshop.startDate}{workshop.endDate ? ` → ${workshop.endDate}` : ''}
                          {workshop.totalHours ? ` · ${workshop.totalHours}h` : ''}
                        </div>
                      </div>
                      <span className={`emp-status-badge ${workshop.status === 'upcoming' ? 'in_progress' : workshop.status === 'in_progress' ? 'pending' : 'completed'}`}>
                        {workshop.status === 'upcoming' ? (isRTL ? 'قادمة' : 'Upcoming')
                          : workshop.status === 'in_progress' ? (isRTL ? 'جارية' : 'In Progress')
                          : (isRTL ? 'مكتملة' : 'Completed')}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: 12, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      ▸ {isRTL ? 'الطلاب المسجلون' : 'Enrolled Students'}: <span style={{ color: '#EE2329' }}>{workshop.students?.length || 0}</span>
                    </div>

                    {(() => {
                      // Compute the workshop day range once (used by both
                      // Roll Call and Matrix modes)
                      const workshopDays = [];
                      if (workshop.startDate) {
                        const start = new Date(workshop.startDate);
                        const end = workshop.endDate ? new Date(workshop.endDate) : new Date(workshop.startDate);
                        const cursor = new Date(start);
                        while (cursor <= end) {
                          workshopDays.push(cursor.toISOString().split('T')[0]);
                          cursor.setDate(cursor.getDate() + 1);
                        }
                      }
                      const todayInRange = workshopDays.includes(_todayISO);
                      const mode = attMode[workshop.workshopId] || 'rollcall';
                      const searchQ = (attSearch[workshop.workshopId] || '').trim().toLowerCase();
                      const students = (workshop.students || []).filter(s => {
                        if (!searchQ) return true;
                        return `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase().includes(searchQ)
                          || (s.phone || '').includes(searchQ)
                          || (s.nationalId || '').includes(searchQ);
                      });
                      const presentToday = students.filter(s =>
                        Array.isArray(s.attendanceDates) && s.attendanceDates.includes(_todayISO)
                      ).length;
                      const pctToday = students.length > 0 ? (presentToday / students.length) * 100 : 0;

                      if ((workshop.students || []).length === 0) {
                        return <p className="emp-empty" style={{ padding: 16 }}>{isRTL ? '— لا يوجد طلاب —' : '— No students —'}</p>;
                      }

                      return (
                        <>
                          {/* ── Mode header ── */}
                          {workshopDays.length > 0 && (
                            <div className="emp-att-header">
                              <span className={`emp-att-date ${todayInRange ? '' : 'out-of-range'}`}>
                                {todayInRange
                                  ? (isRTL ? `اليوم · ${_todayISO}` : `TODAY · ${_todayISO}`)
                                  : (isRTL ? 'خارج فترة الورشة' : 'OUT OF WORKSHOP RANGE')}
                              </span>
                              {todayInRange && mode === 'rollcall' && (
                                <>
                                  <span className="emp-att-count">
                                    <span className="n">{presentToday}</span>
                                    <span className="slash">/</span>
                                    <span className="total">{students.length}</span>
                                  </span>
                                  <div className="emp-att-progress">
                                    <div className="emp-att-progress-fill" style={{ width: `${pctToday}%` }} />
                                  </div>
                                  <div className="emp-att-bulk">
                                    <button className="mark-all" onClick={() => bulkToggleToday(workshop, true)}>
                                      ✓ {isRTL ? 'الكل حاضر' : 'Mark All'}
                                    </button>
                                    <button className="clear-all" onClick={() => bulkToggleToday(workshop, false)}>
                                      × {isRTL ? 'مسح' : 'Clear'}
                                    </button>
                                  </div>
                                </>
                              )}
                              {students.length > 4 && (
                                <input
                                  type="text"
                                  className="emp-att-search"
                                  placeholder={isRTL ? 'بحث بالاسم أو الهوية...' : 'Search name or ID...'}
                                  value={attSearch[workshop.workshopId] || ''}
                                  onChange={e => setAttSearch(prev => ({ ...prev, [workshop.workshopId]: e.target.value }))}
                                />
                              )}
                              <div className="emp-att-mode-toggle">
                                <button
                                  className={mode === 'rollcall' ? 'active' : ''}
                                  onClick={() => setAttMode(prev => ({ ...prev, [workshop.workshopId]: 'rollcall' }))}
                                >
                                  {isRTL ? 'اليوم' : 'Today'}
                                </button>
                                <button
                                  className={mode === 'matrix' ? 'active' : ''}
                                  onClick={() => setAttMode(prev => ({ ...prev, [workshop.workshopId]: 'matrix' }))}
                                >
                                  {isRTL ? 'المصفوفة' : 'Matrix'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ── ROLL CALL mode: big toggle per student for TODAY ── */}
                          {mode === 'rollcall' && (
                            <div className="emp-att-rollcall">
                              {students.length === 0 ? (
                                <div className="emp-att-empty">{isRTL ? '— لا نتائج —' : '— No matches —'}</div>
                              ) : students.map((s, si) => {
                                const attendedDates = Array.isArray(s.attendanceDates) ? s.attendanceDates : [];
                                const isPresent = todayInRange && attendedDates.includes(_todayISO);
                                const busyKey = `${s.studentId}:${_todayISO}`;
                                const isBusy = attBusy.has(busyKey);
                                return (
                                  <motion.div
                                    key={s.studentId}
                                    className={`emp-att-row ${isPresent ? 'present' : ''}`}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(si * 0.015, 0.2) }}
                                    layout
                                  >
                                    <div className="emp-att-row-info">
                                      <span className="emp-att-row-name">{s.firstName} {s.lastName}</span>
                                      <span className="emp-att-row-meta">
                                        <span className="ratio">{attendedDates.length}/{workshopDays.length}</span>
                                        <span>·</span>
                                        <span className="stars">
                                          {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                              key={star}
                                              className={`star ${star <= (s.performanceRating || 0) ? 'filled' : ''}`}
                                              onClick={async () => {
                                                try {
                                                  await employeeApi.patch(`/workshops/employee/students/${s.studentId}/rate`, { performanceRating: star });
                                                  fetchMyWorkshops();
                                                } catch (err) { toast.error(isRTL ? 'خطأ' : 'Error'); }
                                              }}
                                            >★</button>
                                          ))}
                                        </span>
                                        <span>·</span>
                                        <span>{s.paymentStatus === 'verified' ? (isRTL ? '💰 مدفوع' : '💰 Paid')
                                          : s.paymentStatus === 'rejected' ? (isRTL ? '⚠ مرفوض' : '⚠ Rejected')
                                          : (isRTL ? '⏳ قيد المراجعة' : '⏳ Pending')}</span>
                                      </span>
                                    </div>
                                    {todayInRange ? (
                                      <button
                                        className={`emp-att-toggle ${isPresent ? 'present' : ''} ${isBusy ? 'busy' : ''}`}
                                        onClick={() => !isBusy && toggleAttendance(workshop.workshopId, s.studentId, _todayISO, !isPresent)}
                                        disabled={isBusy}
                                      >
                                        <span className="icon">{isPresent ? '✓' : '○'}</span>
                                        {isPresent
                                          ? (isRTL ? 'حاضر' : 'PRESENT')
                                          : (isRTL ? 'تعليم حاضر' : 'MARK PRESENT')}
                                      </button>
                                    ) : (
                                      <span className="emp-status-badge cancelled">
                                        {isRTL ? 'غير متاح اليوم' : 'N/A today'}
                                      </span>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}

                          {/* ── MATRIX mode: student × day grid ── */}
                          {mode === 'matrix' && (
                            <div className="emp-att-matrix-wrap">
                              <table className="emp-att-matrix">
                                <thead>
                                  <tr>
                                    <th>{isRTL ? 'الطالب' : 'Student'}</th>
                                    {workshopDays.map((day, i) => {
                                      const d = new Date(day);
                                      const isToday = day === _todayISO;
                                      return (
                                        <th key={day} className={isToday ? 'today' : ''} title={day}>
                                          <span className="day-num">D{i + 1}</span>
                                          <span className="day">{d.getDate()}/{d.getMonth() + 1}</span>
                                        </th>
                                      );
                                    })}
                                    <th>{isRTL ? 'المجموع' : 'Total'}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {students.length === 0 ? (
                                    <tr>
                                      <td colSpan={workshopDays.length + 2} className="emp-att-empty">
                                        {isRTL ? '— لا نتائج —' : '— No matches —'}
                                      </td>
                                    </tr>
                                  ) : students.map(s => {
                                    const attendedDates = Array.isArray(s.attendanceDates) ? s.attendanceDates : [];
                                    return (
                                      <tr key={s.studentId}>
                                        <td>
                                          <div className="student-name">{s.firstName} {s.lastName}</div>
                                          <div className={`student-ratio ${attendedDates.length === workshopDays.length ? 'full' : ''}`}>
                                            {attendedDates.length}/{workshopDays.length} {isRTL ? 'يوم' : 'days'}
                                          </div>
                                        </td>
                                        {workshopDays.map(day => {
                                          const isPresent = attendedDates.includes(day);
                                          const isToday = day === _todayISO;
                                          const busyKey = `${s.studentId}:${day}`;
                                          const isBusy = attBusy.has(busyKey);
                                          return (
                                            <td
                                              key={day}
                                              className={`emp-att-cell ${isPresent ? 'present' : ''} ${isToday ? 'today' : ''}`}
                                              onClick={() => !isBusy && toggleAttendance(workshop.workshopId, s.studentId, day, !isPresent)}
                                              style={{ cursor: isBusy ? 'wait' : 'pointer', opacity: isBusy ? 0.5 : 1 }}
                                              title={`${day} — ${isPresent ? (isRTL ? 'حاضر' : 'present') : (isRTL ? 'غائب' : 'absent')}`}
                                            >
                                              {isPresent ? '✓' : ''}
                                            </td>
                                          );
                                        })}
                                        <td style={{ color: 'var(--signal-cyan)', fontWeight: 800 }}>
                                          {attendedDates.length}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                {students.length > 0 && (
                                  <tfoot>
                                    <tr>
                                      <td>{isRTL ? 'الإجمالي' : 'Column Total'}</td>
                                      {workshopDays.map(day => {
                                        const total = students.filter(s =>
                                          Array.isArray(s.attendanceDates) && s.attendanceDates.includes(day)
                                        ).length;
                                        return (
                                          <td key={day} className={day === _todayISO ? 'today' : ''}>
                                            {total}
                                          </td>
                                        );
                                      })}
                                      <td>·</td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </motion.div>
                ));
              })()}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════ YEAR CALENDAR (read-only) */}
          {activeTab === 'year-calendar' && (
            <motion.div
              key="year-calendar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              style={{ padding: '4px 2px' }}
            >
              <YearCalendar apiClient={employeeApi} readOnly />
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════ PROFILE */}
          {activeTab === 'profile' && profile && (
            <motion.div
              key="profile"
              className="emp-profile-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            >
              <div className="emp-profile-card">
                <div className="emp-profile-avatar">
                  {employeeData?.name?.charAt(0)?.toUpperCase()}
                </div>
                <h2>{profile.employee.name}</h2>
                <span className="emp-profile-section" style={{ backgroundColor: SECTION_COLORS[profile.employee.section] || '#666' }}>
                  {sectionLabels[profile.employee.section] || profile.employee.section}
                </span>

                <div className="emp-profile-details">
                  <div className="emp-profile-row">
                    <span className="emp-profile-label">{isRTL ? 'البريد الإلكتروني' : 'Email'}</span>
                    <span className="emp-profile-value">{profile.employee.email}</span>
                  </div>
                  <div className="emp-profile-row">
                    <span className="emp-profile-label">{isRTL ? 'القسم' : 'Section'}</span>
                    <span className="emp-profile-value">{sectionLabels[profile.employee.section] || profile.employee.section}</span>
                  </div>
                  <div className="emp-profile-row">
                    <span className="emp-profile-label">{isRTL ? 'تاريخ الانضمام' : 'Joined'}</span>
                    <span className="emp-profile-value">{profile.employee.createdAt ? format(parseISO(profile.employee.createdAt), 'dd/MM/yyyy') : '-'}</span>
                  </div>
                  <div className="emp-profile-row">
                    <span className="emp-profile-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</span>
                    <CountUp className="emp-profile-value emp-highlight" value={profile.netPoints} />
                  </div>
                  <div className="emp-profile-row">
                    <span className="emp-profile-label">{isRTL ? 'إجمالي المهام' : 'Total Tasks'}</span>
                    <CountUp className="emp-profile-value" value={profile.taskStats.total} />
                  </div>
                </div>

                <button className="emp-change-password-btn" onClick={() => setShowPasswordModal(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateTaskModal && (
          <motion.div className="emp-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowCreateTaskModal(false)}>
            <motion.div
              className="emp-modal"
              style={{ maxWidth: 520 }}
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>▸ {isRTL ? 'إنشاء مهمة جديدة' : 'Create New Task'}</h3>
              <form onSubmit={handleCreateTask}>
                <div className="emp-form-group">
                  <label>{isRTL ? 'عنوان المهمة' : 'Task Title'} *</label>
                  <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
                </div>
                <div className="emp-form-group">
                  <label>{isRTL ? 'الوصف' : 'Description'}</label>
                  <textarea style={{ minHeight: 70, resize: 'vertical' }}
                    value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="emp-form-group">
                    <label>{isRTL ? 'تاريخ البداية' : 'Start Date'} *</label>
                    <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} required />
                  </div>
                  <div className="emp-form-group">
                    <label>{isRTL ? 'تاريخ الانتهاء' : 'End Date'}</label>
                    <input type="date" value={taskForm.dueDateEnd} onChange={(e) => setTaskForm({ ...taskForm, dueDateEnd: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="emp-form-group">
                    <label>{isRTL ? 'الوقت' : 'Time'}</label>
                    <input type="time" value={taskForm.dueTime} onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })} />
                  </div>
                  <div className="emp-form-group">
                    <label>{isRTL ? 'الأولوية' : 'Priority'}</label>
                    <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                      <option value="low">{isRTL ? 'منخفضة' : 'Low'}</option>
                      <option value="medium">{isRTL ? 'متوسطة' : 'Medium'}</option>
                      <option value="high">{isRTL ? 'عالية' : 'High'}</option>
                    </select>
                  </div>
                </div>
                <div className="emp-form-group">
                  <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                  <input type="text" value={taskForm.notes} onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })} />
                </div>
                <div className="emp-modal-actions">
                  <button type="button" className="emp-btn-cancel" onClick={() => setShowCreateTaskModal(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                  <button type="submit" className="emp-btn-primary" disabled={taskFormLoading}>
                    {taskFormLoading ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء المهمة' : 'Create Task')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div className="emp-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { if (!employeeData?.mustChangePassword) setShowPasswordModal(false); }}>
            <motion.div
              className="emp-modal"
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>▸ {employeeData?.mustChangePassword ? (isRTL ? 'يجب تغيير كلمة المرور' : 'Password Change Required') : (isRTL ? 'تغيير كلمة المرور' : 'Change Password')}</h3>
              {employeeData?.mustChangePassword && (
                <p className="emp-modal-note">{isRTL ? '⚠ هذا هو تسجيل دخولك الأول. يرجى تعيين كلمة مرور جديدة.' : '⚠ First login detected. Please set a new password.'}</p>
              )}
              <form onSubmit={handleChangePassword}>
                {!employeeData?.mustChangePassword && (
                  <div className="emp-form-group">
                    <label>{isRTL ? 'كلمة المرور الحالية' : 'Current Password'}</label>
                    <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
                  </div>
                )}
                <div className="emp-form-group">
                  <label>{isRTL ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                  <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required minLength={6} />
                </div>
                <div className="emp-form-group">
                  <label>{isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                  <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required minLength={6} />
                </div>
                <div className="emp-modal-actions">
                  {!employeeData?.mustChangePassword && (
                    <button type="button" className="emp-btn-cancel" onClick={() => setShowPasswordModal(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                  )}
                  <button type="submit" className="emp-btn-primary" disabled={passwordLoading}>
                    {passwordLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeDashboard;
