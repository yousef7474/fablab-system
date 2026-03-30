import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import employeeApi from '../../config/employeeApi';
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
  const [loading, setLoading] = useState(true);
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

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

  useEffect(() => {
    if (employeeData) {
      Promise.all([fetchProfile(), fetchTasks(), fetchRatings(), fetchSchedule()])
        .finally(() => setLoading(false));
    }
  }, [employeeData, fetchProfile, fetchTasks, fetchRatings, fetchSchedule]);

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
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
    return schedule.filter(event => {
      const eventStart = parseISO(event.date);
      const eventEnd = event.endDate ? parseISO(event.endDate) : eventStart;
      return day >= eventStart && day <= eventEnd;
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
                      {task.creator && <span className="emp-assigned-by">{isRTL ? 'بواسطة:' : 'By:'} {task.creator.fullName}</span>}
                    </div>
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
                      {hasEvents && <span className="emp-event-dot" />}
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
                  <p className="emp-empty">{isRTL ? 'لا توجد مهام لهذا اليوم' : 'No tasks for this day'}</p>
                ) : getEventsForDay(selectedDay).map(event => (
                  <div key={event.id} className={`emp-event-card priority-${event.priority}`}>
                    <div className="emp-event-header">
                      <span className="emp-event-title">{event.title}</span>
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
                    </div>
                    <div className="emp-event-meta">
                      {event.startTime && <span>{formatTimeAMPM(event.startTime)}</span>}
                      {event.section && <span className="emp-section-tag" style={{ backgroundColor: SECTION_COLORS[event.section] || '#666' }}>{sectionLabels[event.section] || event.section}</span>}
                      <span className={`emp-status-badge ${event.status}`}>{statusLabels[event.status]}</span>
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
