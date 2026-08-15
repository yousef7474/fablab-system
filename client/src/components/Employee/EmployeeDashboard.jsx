import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import employeeApi from '../../config/employeeApi';
import { EVALUATION_CATEGORIES } from '../../config/evaluationStructure';
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
      setTasks(response.data || []);
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

      Promise.all([fetchProfile(), fetchTasks(), fetchRatings(), fetchSchedule(), fetchEvaluations(), fetchActivityStats(), fetchMyWorkshops()])
        .finally(() => setLoading(false));

      // Heartbeat every 5 minutes
      const heartbeatInterval = setInterval(() => {
        employeeApi.post('/employee/activity/heartbeat').catch(() => {});
      }, 5 * 60 * 1000);

      return () => clearInterval(heartbeatInterval);
    }
  }, [employeeData, fetchProfile, fetchTasks, fetchRatings, fetchSchedule, fetchEvaluations, fetchActivityStats, fetchMyWorkshops]);

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
    { key: 'overview',  label: isRTL ? 'نظرة عامة' : 'Overview',  icon: '◈' },
    { key: 'tasks',     label: isRTL ? 'المهام' : 'Tasks',        icon: '⬢' },
    { key: 'schedule',  label: isRTL ? 'الجدول' : 'Schedule',     icon: '◱' },
    { key: 'ratings',   label: isRTL ? 'التقييمات' : 'Ratings',   icon: '★' },
    { key: 'workshops', label: isRTL ? 'الورش' : 'Workshops',     icon: '⬡' },
    { key: 'profile',   label: isRTL ? 'الملف الشخصي' : 'Profile', icon: '◉' },
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
                        {task.selfCreated ? (
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
                            {task.status !== 'pending_review' ? (
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
                            )}
                          </div>
                        ) : (
                          <span className={`emp-status-badge ${task.status}`}>{statusLabels[task.status]}</span>
                        )}
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
                          {event.type === 'task' && event.selfCreated ? (
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
                          ) : event.type === 'task' ? (
                            <span className={`emp-status-badge ${event.status}`}>{statusLabels[event.status]}</span>
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
