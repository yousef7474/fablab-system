import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import employeeApi from '../../config/employeeApi';
import { EVALUATION_CATEGORIES } from '../../config/evaluationStructure';
import './Employee.css';

const SECTION_COLORS = {
  'Electronics and Programming': '#6366f1',
  'CNC Laser': '#22c55e',
  'CNC Wood': '#f59e0b',
  '3D': '#ef4444',
  'Robotic and AI': '#8b5cf6',
  "Kid's Club": '#06b6d4',
  'Vinyl Cutting': '#ec4899'
};

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [employeeData, setEmployeeData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [ratings, setRatings] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [myEvaluations, setMyEvaluations] = useState(null);
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
    '3D': isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing',
    'Robotic and AI': isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI',
    "Kid's Club": isRTL ? 'نادي الأطفال' : "Kid's Club",
    'Vinyl Cutting': isRTL ? 'قص الفينيل' : 'Vinyl Cutting'
  };

  const statusLabels = {
    pending: isRTL ? 'قيد الانتظار' : 'Pending',
    in_progress: isRTL ? 'قيد التنفيذ' : 'In Progress',
    completed: isRTL ? 'مكتمل' : 'Completed',
    cancelled: isRTL ? 'ملغى' : 'Cancelled',
    uncompleted: isRTL ? 'غير مكتمل' : 'Uncompleted'
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

      Promise.all([fetchProfile(), fetchTasks(), fetchRatings(), fetchSchedule(), fetchEvaluations(), fetchActivityStats()])
        .finally(() => setLoading(false));

      // Heartbeat every 5 minutes
      const heartbeatInterval = setInterval(() => {
        employeeApi.post('/employee/activity/heartbeat').catch(() => {});
      }, 5 * 60 * 1000);

      return () => clearInterval(heartbeatInterval);
    }
  }, [employeeData, fetchProfile, fetchTasks, fetchRatings, fetchSchedule, fetchEvaluations, fetchActivityStats]);

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
      // Update local data
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
        <p>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  const filteredTasks = taskStatusFilter === 'all' ? tasks : tasks.filter(t => t.status === taskStatusFilter);

  const tabs = [
    { key: 'overview', label: isRTL ? 'نظرة عامة' : 'Overview', icon: '📊' },
    { key: 'tasks', label: isRTL ? 'المهام' : 'Tasks', icon: '📋' },
    { key: 'schedule', label: isRTL ? 'الجدول' : 'Schedule', icon: '📅' },
    { key: 'ratings', label: isRTL ? 'التقييمات' : 'Ratings', icon: '⭐' },
    { key: 'profile', label: isRTL ? 'الملف الشخصي' : 'Profile', icon: '👤' },
  ];

  return (
    <div className="employee-dashboard" dir={isRTL ? 'rtl' : 'ltr'} data-page="employee">
      {/* Top Bar */}
      <div className="emp-topbar">
        <div className="emp-topbar-left">
          <h2 className="emp-logo">FABLAB</h2>
          <span className="emp-badge">{isRTL ? 'بوابة الموظفين' : 'Employee Portal'}</span>
        </div>
        <div className="emp-topbar-right">
          <button className="emp-lang-btn" onClick={toggleLanguage}>
            {i18n.language === 'ar' ? 'EN' : 'ع'}
          </button>
          <div className="emp-user-info">
            <span className="emp-user-name">{employeeData?.name}</span>
            <span className="emp-user-section">{sectionLabels[employeeData?.section] || employeeData?.section}</span>
          </div>
          <button className="emp-logout-btn" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="emp-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`emp-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className="emp-tab-icon">{tab.icon}</span>
            <span className="emp-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="emp-content">

        {/* Overview Tab */}
        {activeTab === 'overview' && profile && (
          <div className="emp-overview">
            {/* Stats Cards */}
            <div className="emp-stats-grid">
              <div className="emp-stat-card points">
                <div className="emp-stat-icon">⭐</div>
                <div className="emp-stat-info">
                  <span className="emp-stat-value">{profile.netPoints}</span>
                  <span className="emp-stat-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</span>
                </div>
              </div>
              <div className="emp-stat-card tasks-total">
                <div className="emp-stat-icon">📋</div>
                <div className="emp-stat-info">
                  <span className="emp-stat-value">{profile.taskStats.total}</span>
                  <span className="emp-stat-label">{isRTL ? 'إجمالي المهام' : 'Total Tasks'}</span>
                </div>
              </div>
              <div className="emp-stat-card completed">
                <div className="emp-stat-icon">✅</div>
                <div className="emp-stat-info">
                  <span className="emp-stat-value">{profile.taskStats.completed}</span>
                  <span className="emp-stat-label">{isRTL ? 'مكتملة' : 'Completed'}</span>
                </div>
              </div>
              <div className="emp-stat-card in-progress">
                <div className="emp-stat-icon">🔄</div>
                <div className="emp-stat-info">
                  <span className="emp-stat-value">{profile.taskStats.in_progress}</span>
                  <span className="emp-stat-label">{isRTL ? 'قيد التنفيذ' : 'In Progress'}</span>
                </div>
              </div>
            </div>

            {/* Weekly Activity */}
            {activityStats && (
              <div className="emp-section-card">
                <h3>{isRTL ? 'نشاط الأسبوع' : 'Weekly Activity'}</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '0.5rem', background: activityStats.passed ? '#dcfce7' : '#fef3c7', borderRadius: 8 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: activityStats.passed ? '#166534' : '#92400e' }}>{activityStats.totalHours}h</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{isRTL ? `من ${activityStats.targetHours}h` : `of ${activityStats.targetHours}h`}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '0.5rem', background: '#eff6ff', borderRadius: 8 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1d4ed8' }}>{activityStats.percentage}%</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{isRTL ? 'النسبة' : 'Progress'}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '0.5rem', background: '#f8fafc', borderRadius: 8 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#334155' }}>{activityStats.daysActive}/7</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{isRTL ? 'أيام نشطة' : 'Active Days'}</div>
                  </div>
                </div>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(activityStats.percentage, 100)}%`, background: activityStats.passed ? '#22c55e' : '#f59e0b', borderRadius: 3 }} />
                </div>
                {activityStats.passed && <div style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600, marginTop: 6 }}>{isRTL ? '✓ تم تحقيق الهدف الأسبوعي - نقطة واحدة مكتسبة' : '✓ Weekly target reached - 1 credit point earned'}</div>}
              </div>
            )}

            {/* Recent Tasks */}
            <div className="emp-section-card">
              <h3>{isRTL ? 'المهام الأخيرة' : 'Recent Tasks'}</h3>
              <div className="emp-task-list">
                {tasks.slice(0, 5).map(task => (
                  <div key={task.taskId} className={`emp-task-item priority-${task.priority}`}>
                    <div className="emp-task-header">
                      <span className="emp-task-title">{task.title}</span>
                      <span className={`emp-status-badge ${task.status}`}>{statusLabels[task.status]}</span>
                    </div>
                    <div className="emp-task-meta">
                      {task.section && <span className="emp-section-tag" style={{ backgroundColor: SECTION_COLORS[task.section] || '#666' }}>{sectionLabels[task.section] || task.section}</span>}
                      <span className="emp-task-date">{task.startDate}</span>
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && <p className="emp-empty">{isRTL ? 'لا توجد مهام' : 'No tasks'}</p>}
              </div>
            </div>

            {/* Recent Ratings */}
            <div className="emp-section-card">
              <h3>{isRTL ? 'آخر التقييمات' : 'Recent Ratings'}</h3>
              <div className="emp-ratings-list">
                {profile.recentRatings.map(r => (
                  <div key={r.ratingId} className={`emp-rating-item ${r.type}`}>
                    <span className={`emp-rating-badge ${r.type}`}>
                      {r.type === 'award' ? '+' : '-'}{r.points}
                    </span>
                    <div className="emp-rating-info">
                      <span className="emp-rating-criteria">{r.criteria || (isRTL ? 'تقييم عام' : 'General rating')}</span>
                      <span className="emp-rating-date">{r.ratingDate}</span>
                    </div>
                    <span className="emp-rating-by">{r.ratedBy?.fullName}</span>
                  </div>
                ))}
                {profile.recentRatings.length === 0 && <p className="emp-empty">{isRTL ? 'لا توجد تقييمات' : 'No ratings yet'}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="emp-tasks-tab">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{isRTL ? 'المهام' : 'Tasks'}</h3>
              <button className="emp-btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }} onClick={() => setShowCreateTaskModal(true)}>
                + {isRTL ? 'إضافة مهمة' : 'Add Task'}
              </button>
            </div>
            {/* Filter Tabs */}
            <div className="emp-filter-tabs">
              {[
                { key: 'all', label: isRTL ? 'الكل' : 'All', count: tasks.length, color: '#6b7280' },
                { key: 'in_progress', label: isRTL ? 'قيد التنفيذ' : 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
                { key: 'pending', label: isRTL ? 'قيد الانتظار' : 'Pending', count: tasks.filter(t => t.status === 'pending').length, color: '#f59e0b' },
                { key: 'completed', label: isRTL ? 'مكتمل' : 'Completed', count: tasks.filter(t => t.status === 'completed').length, color: '#22c55e' },
                { key: 'uncompleted', label: isRTL ? 'غير مكتمل' : 'Uncompleted', count: tasks.filter(t => t.status === 'uncompleted').length, color: '#dc2626' },
                { key: 'cancelled', label: isRTL ? 'ملغى' : 'Cancelled', count: tasks.filter(t => t.status === 'cancelled').length, color: '#9ca3af' },
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`emp-filter-tab ${taskStatusFilter === tab.key ? 'active' : ''}`}
                  onClick={() => setTaskStatusFilter(tab.key)}
                >
                  <span className="emp-filter-dot" style={{ background: tab.color }}></span>
                  {tab.label}
                  <span className="emp-filter-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Task Cards */}
            <div className="emp-task-cards">
              {filteredTasks.length === 0 ? (
                <div className="emp-empty-state">
                  <p>{isRTL ? 'لا توجد مهام' : 'No tasks found'}</p>
                </div>
              ) : filteredTasks.map(task => (
                <div key={task.taskId} className={`emp-task-card priority-${task.priority} status-${task.status}`}>
                  <div className="emp-task-card-header">
                    <div>
                      <h4>{task.title}</h4>
                      {task.selfCreated
                        ? <span className="emp-assigned-by" style={{ color: '#3b82f6' }}>{isRTL ? 'مهمة ذاتية' : 'Self-created'}</span>
                        : task.creator && <span className="emp-assigned-by">{isRTL ? 'من المدير:' : 'Assigned by:'} {task.creator.fullName}</span>
                      }
                    </div>
                    {task.selfCreated ? (
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
                    ) : (
                      <span className={`emp-status-badge ${task.status}`}>{statusLabels[task.status]}</span>
                    )}
                  </div>
                  {task.description && <p className="emp-task-desc">{task.description}</p>}
                  <div className="emp-task-card-footer">
                    {task.section && <span className="emp-section-tag" style={{ backgroundColor: SECTION_COLORS[task.section] || '#666' }}>{sectionLabels[task.section] || task.section}</span>}
                    <span className={`emp-priority-tag ${task.priority}`}>{task.priority}</span>
                    <span className="emp-task-date">{task.startDate}{task.startDate !== task.endDate ? ` → ${task.endDate}` : ''}</span>
                    {task.dueTime && <span className="emp-task-time">{formatTimeAMPM(task.dueTime)}</span>}
                  </div>
                  {task.notes && <div className="emp-task-notes"><strong>{isRTL ? 'ملاحظات:' : 'Notes:'}</strong> {task.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="emp-schedule-tab">
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
                    <div
                      key={day.toISOString()}
                      className={`emp-calendar-day ${isToday(day) ? 'today' : ''} ${hasEvents ? 'has-events' : ''} ${selectedDay && isSameDay(day, selectedDay) ? 'selected' : ''}`}
                      onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                    >
                      <span className="emp-day-number">{format(day, 'd')}</span>
                      {hasEvents && <span className="emp-event-count">{events.length}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Day Events */}
            {selectedDay && (
              <motion.div className="emp-day-events" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h4>{format(selectedDay, 'EEEE, d MMMM', { locale: isRTL ? ar : enUS })}</h4>
                {getEventsForDay(selectedDay).length === 0 ? (
                  <p className="emp-empty">{isRTL ? 'لا توجد أحداث لهذا اليوم' : 'No events for this day'}</p>
                ) : getEventsForDay(selectedDay).map(event => (
                  <div key={event.id} className={`emp-event-card ${event.type === 'task' ? `priority-${event.priority}` : 'appointment'}`}>
                    <div className="emp-event-header">
                      <span className="emp-event-title">
                        {event.type === 'appointment' && <span style={{ color: '#22c55e', marginRight: 6, marginLeft: 6 }}>●</span>}
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
                        <span className="emp-status-badge" style={{ background: '#dcfce7', color: '#166534' }}>{isRTL ? 'موعد' : 'Appointment'}</span>
                      )}
                    </div>
                    <div className="emp-event-meta">
                      {event.startTime && <span>{formatTimeAMPM(event.startTime)}{event.endTime ? ` - ${formatTimeAMPM(event.endTime)}` : ''}</span>}
                      {event.duration && <span>({event.duration} {isRTL ? 'د' : 'min'})</span>}
                      {event.section && <span className="emp-section-tag" style={{ backgroundColor: SECTION_COLORS[event.section] || '#666' }}>{sectionLabels[event.section] || event.section}</span>}
                      {event.type === 'appointment' && event.phone && <span>📞 {event.phone}</span>}
                    </div>
                    {event.description && <p className="emp-event-desc">{event.description}</p>}
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Ratings Tab */}
        {activeTab === 'ratings' && ratings && (
          <div className="emp-ratings-tab">
            {/* Points Summary */}
            <div className="emp-points-summary">
              <div className="emp-points-card net">
                <span className="emp-points-value">{ratings.netPoints}</span>
                <span className="emp-points-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</span>
              </div>
              <div className="emp-points-card awards">
                <span className="emp-points-value">+{ratings.totalAwards}</span>
                <span className="emp-points-label">{isRTL ? 'نقاط مكتسبة' : 'Awards'}</span>
              </div>
              <div className="emp-points-card deductions">
                <span className="emp-points-value">-{ratings.totalDeductions}</span>
                <span className="emp-points-label">{isRTL ? 'نقاط مخصومة' : 'Deductions'}</span>
              </div>
            </div>

            {/* Ratings History */}
            <div className="emp-section-card">
              <h3>{isRTL ? 'سجل التقييمات' : 'Rating History'}</h3>
              <div className="emp-ratings-history">
                {ratings.ratings.map(r => (
                  <div key={r.ratingId} className={`emp-rating-row ${r.type}`}>
                    <span className={`emp-rating-badge ${r.type}`}>
                      {r.type === 'award' ? '+' : '-'}{r.points}
                    </span>
                    <div className="emp-rating-details">
                      <span className="emp-rating-criteria">{r.criteria || (isRTL ? 'تقييم عام' : 'General')}</span>
                      {r.notes && <span className="emp-rating-notes">{r.notes}</span>}
                    </div>
                    <div className="emp-rating-meta">
                      <span>{r.ratingDate}</span>
                      <span className="emp-rating-by">{r.ratedBy?.fullName}</span>
                    </div>
                  </div>
                ))}
                {ratings.ratings.length === 0 && <p className="emp-empty">{isRTL ? 'لا توجد تقييمات' : 'No ratings yet'}</p>}
              </div>
            </div>

            {/* Performance Evaluations */}
            {myEvaluations && myEvaluations.evaluations.length > 0 && (
              <div className="emp-section-card">
                <h3>{isRTL ? 'التقييم الوظيفي' : 'Performance Evaluations'}</h3>
                {myEvaluations.summary && (
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ background: '#eff6ff', padding: '0.75rem 1.25rem', borderRadius: 10, textAlign: 'center', flex: 1, minWidth: 100 }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#3b82f6' }}>{myEvaluations.summary.avgScore}%</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{isRTL ? 'متوسط النسبة' : 'Avg Score'}</div>
                    </div>
                    <div style={{ background: '#fefce8', padding: '0.75rem 1.25rem', borderRadius: 10, textAlign: 'center', flex: 1, minWidth: 100 }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>{myEvaluations.summary.avgScore}<span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>/100</span></div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{isRTL ? 'متوسط الدرجة' : 'Avg Score'}</div>
                    </div>
                    {myEvaluations.summary.totalBonus > 0 && (
                      <div style={{ background: '#f5f3ff', padding: '0.75rem 1.25rem', borderRadius: 10, textAlign: 'center', flex: 1, minWidth: 100 }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#8b5cf6' }}>+{myEvaluations.summary.totalBonus}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{isRTL ? 'نقاط إضافية' : 'Bonus'}</div>
                      </div>
                    )}
                  </div>
                )}
                {myEvaluations.evaluations.map(ev => (
                  <div key={ev.evaluationId} style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 10, marginBottom: '0.5rem', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6' }}>{ev.totalScore.toFixed(1)}<span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>/100</span></span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#22c55e' }}>{ev.totalScore.toFixed(0)}%</span>
                        {ev.bonusPoints > 0 && <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8b5cf6' }}>+{ev.bonusPoints} {isRTL ? 'إضافي' : 'bonus'}</span>}
                      </div>
                      {ev.period && <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>{ev.period}</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {ev.evaluationDate} • {isRTL ? 'بواسطة:' : 'By:'} {ev.evaluator?.fullName}
                      {ev.notes && <span> • {ev.notes}</span>}
                    </div>
                    {/* Category breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {EVALUATION_CATEGORIES.map(cat => {
                        const catWeighted = cat.criteria.reduce((s, cr) => {
                          const raw = Math.min(parseFloat(ev.scores?.[`${cat.key}_${cr.key}`]) || 0, 50);
                          return s + (raw / 50) * cr.weight;
                        }, 0);
                        const catMaxWeight = cat.criteria.reduce((s, cr) => s + cr.weight, 0);
                        return (
                          <div key={cat.key} style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0.4rem', background: 'white', borderRadius: 6 }}>
                            <span style={{ color: '#475569' }}>{isRTL ? cat.nameAr : cat.nameEn}</span>
                            <span style={{ fontWeight: 700, color: catWeighted >= catMaxWeight * 0.8 ? '#22c55e' : '#334155' }}>{catWeighted.toFixed(1)}/{catMaxWeight}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && profile && (
          <div className="emp-profile-tab">
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
                  <span className="emp-profile-value emp-highlight">{profile.netPoints}</span>
                </div>
                <div className="emp-profile-row">
                  <span className="emp-profile-label">{isRTL ? 'إجمالي المهام' : 'Total Tasks'}</span>
                  <span className="emp-profile-value">{profile.taskStats.total}</span>
                </div>
              </div>

              <button className="emp-change-password-btn" onClick={() => setShowPasswordModal(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateTaskModal && (
          <motion.div className="emp-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowCreateTaskModal(false)}>
            <motion.div className="emp-modal" style={{ maxWidth: 500 }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <h3>{isRTL ? 'إنشاء مهمة جديدة' : 'Create New Task'}</h3>
              <form onSubmit={handleCreateTask}>
                <div className="emp-form-group">
                  <label>{isRTL ? 'عنوان المهمة' : 'Task Title'} *</label>
                  <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
                </div>
                <div className="emp-form-group">
                  <label>{isRTL ? 'الوصف' : 'Description'}</label>
                  <textarea style={{ width: '100%', padding: '0.65rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.9rem', minHeight: 70, resize: 'vertical' }}
                    value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="emp-form-group">
                    <label>{isRTL ? 'تاريخ البداية' : 'Start Date'} *</label>
                    <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} required />
                  </div>
                  <div className="emp-form-group">
                    <label>{isRTL ? 'تاريخ الانتهاء' : 'End Date'}</label>
                    <input type="date" value={taskForm.dueDateEnd} onChange={(e) => setTaskForm({ ...taskForm, dueDateEnd: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="emp-form-group">
                    <label>{isRTL ? 'الوقت' : 'Time'}</label>
                    <input type="time" value={taskForm.dueTime} onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })} />
                  </div>
                  <div className="emp-form-group">
                    <label>{isRTL ? 'الأولوية' : 'Priority'}</label>
                    <select style={{ width: '100%', padding: '0.65rem 0.75rem', border: '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: 'inherit' }}
                      value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
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
            <motion.div className="emp-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}>
              <h3>{employeeData?.mustChangePassword ? (isRTL ? 'يجب تغيير كلمة المرور' : 'Password Change Required') : (isRTL ? 'تغيير كلمة المرور' : 'Change Password')}</h3>
              {employeeData?.mustChangePassword && (
                <p className="emp-modal-note">{isRTL ? 'هذا هو تسجيل دخولك الأول. يرجى تعيين كلمة مرور جديدة.' : 'This is your first login. Please set a new password.'}</p>
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
