import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isToday
} from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import api from '../../config/api';
import '../Admin/Admin.css';
import './Manager.css';

// Section colors (matching AdminDashboard)
const SECTION_COLORS = {
  'Electronics and Programming': '#6366f1',
  'CNC Laser': '#22c55e',
  'CNC Wood': '#f59e0b',
  '3D': '#ef4444',
  'Robotic and AI': '#8b5cf6',
  "Kid's Club": '#06b6d4',
  'Vinyl Cutting': '#ec4899'
};

// Priority colors
const PRIORITY_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444'
};

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // State
  const [managerData, setManagerData] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleFilter, setScheduleFilter] = useState('all');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('schedule');

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    employeeId: '',
    dueDate: '',
    dueTime: '',
    priority: 'medium',
    section: '',
    notes: ''
  });

  // Section labels
  const sectionLabels = {
    'Electronics and Programming': isRTL ? 'الإلكترونيات والبرمجة' : 'Electronics & Programming',
    'CNC Laser': isRTL ? 'ليزر CNC' : 'CNC Laser',
    'CNC Wood': isRTL ? 'خشب CNC' : 'CNC Wood',
    '3D': isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing',
    'Robotic and AI': isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI',
    "Kid's Club": isRTL ? 'نادي الأطفال' : "Kid's Club",
    'Vinyl Cutting': isRTL ? 'قص الفينيل' : 'Vinyl Cutting'
  };

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const admin = localStorage.getItem('adminData');

    if (!token || !admin) {
      navigate('/admin/login');
      return;
    }

    try {
      const parsedAdmin = JSON.parse(admin);
      if (parsedAdmin.role !== 'manager' && parsedAdmin.role !== 'admin') {
        toast.error(isRTL ? 'غير مصرح. يتطلب صلاحية مدير.' : 'Access denied. Manager role required.');
        navigate('/admin/login');
        return;
      }
      setManagerData(parsedAdmin);
    } catch (e) {
      navigate('/admin/login');
    }
  }, [navigate, isRTL]);

  // Fetch schedule with tasks
  const fetchSchedule = useCallback(async () => {
    try {
      const response = await api.get('/admin/schedule?includeTasks=true');
      setSchedule(response.data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast.error(isRTL ? 'خطأ في تحميل الجدول' : 'Error loading schedule');
    }
  }, [isRTL]);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    try {
      const response = await api.get('/admin/employees');
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSchedule(), fetchEmployees()]);
      setLoading(false);
    };
    if (managerData) {
      loadData();
    }
  }, [managerData, fetchSchedule, fetchEmployees]);

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  const getEventsForDay = (day) => {
    return schedule.filter(event => {
      if (!event.date) return false;
      try {
        const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
        return isSameDay(eventDate, day);
      } catch {
        return false;
      }
    });
  };

  const getFilteredSchedule = () => {
    if (scheduleFilter === 'all') return schedule;
    const employee = employees.find(e => e.employeeId === scheduleFilter);
    if (!employee) return schedule;
    return schedule.filter(item => item.section === employee.section);
  };

  // Navigate months
  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));

  // Task CRUD operations
  const handleCreateTask = async () => {
    if (!taskForm.title || !taskForm.employeeId || !taskForm.dueDate) {
      toast.error(isRTL ? 'العنوان والموظف والتاريخ مطلوبة' : 'Title, employee, and date are required');
      return;
    }

    setTaskLoading(true);
    try {
      await api.post('/tasks', taskForm);
      toast.success(isRTL ? 'تم إنشاء المهمة بنجاح' : 'Task created successfully');
      setShowTaskModal(false);
      resetTaskForm();
      fetchSchedule();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(isRTL ? 'خطأ في إنشاء المهمة' : 'Error creating task');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!taskForm.title || !taskForm.employeeId || !taskForm.dueDate) {
      toast.error(isRTL ? 'العنوان والموظف والتاريخ مطلوبة' : 'Title, employee, and date are required');
      return;
    }

    setTaskLoading(true);
    try {
      await api.put(`/tasks/${selectedTask.id}`, taskForm);
      toast.success(isRTL ? 'تم تحديث المهمة بنجاح' : 'Task updated successfully');
      setShowTaskModal(false);
      resetTaskForm();
      fetchSchedule();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(isRTL ? 'خطأ في تحديث المهمة' : 'Error updating task');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذه المهمة؟' : 'Delete this task?')) return;

    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success(isRTL ? 'تم حذف المهمة' : 'Task deleted');
      fetchSchedule();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(isRTL ? 'خطأ في حذف المهمة' : 'Error deleting task');
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success(isRTL ? 'تم تحديث الحالة' : 'Status updated');
      fetchSchedule();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const resetTaskForm = () => {
    setTaskForm({
      title: '',
      description: '',
      employeeId: '',
      dueDate: '',
      dueTime: '',
      priority: 'medium',
      section: '',
      notes: ''
    });
    setSelectedTask(null);
  };

  const openCreateTaskModal = (preselectedDate = null) => {
    resetTaskForm();
    if (preselectedDate) {
      setTaskForm(prev => ({
        ...prev,
        dueDate: format(preselectedDate, 'yyyy-MM-dd')
      }));
    }
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task) => {
    setSelectedTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      employeeId: task.employeeId || '',
      dueDate: task.date,
      dueTime: task.startTime || '',
      priority: task.priority || 'medium',
      section: task.section || '',
      notes: task.notes || ''
    });
    setShowTaskModal(true);
  };

  // Handle employee selection for task
  const handleEmployeeSelect = (employeeId) => {
    const employee = employees.find(e => e.employeeId === employeeId);
    setTaskForm(prev => ({
      ...prev,
      employeeId,
      section: employee ? employee.section : prev.section
    }));
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/admin/login');
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = parseISO(dateString);
      return format(date, 'dd MMM', { locale: isRTL ? ar : enUS });
    } catch {
      return dateString;
    }
  };

  // Get upcoming tasks
  const getUpcomingTasks = () => {
    const tasks = schedule.filter(item => item.type === 'task');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks
      .filter(task => {
        const dueDate = parseISO(task.date);
        return dueDate >= today && task.status !== 'completed' && task.status !== 'cancelled';
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 10);
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner large"></div>
        <p>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  const days = getDaysInMonth(selectedDate);
  const weekDays = isRTL
    ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="admin-layout manager-layout" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="FABLAB" className="sidebar-logo" />
          <h2>{isRTL ? 'لوحة المدير' : 'Manager Panel'}</h2>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>{isRTL ? 'الجدول والمهام' : 'Schedule & Tasks'}</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>{isRTL ? 'الإعدادات' : 'Settings'}</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-profile">
            <div className="manager-avatar">
              {managerData?.fullName?.charAt(0) || 'M'}
            </div>
            <div className="admin-info">
              <span className="admin-name">{managerData?.fullName}</span>
              <span className="manager-role">{isRTL ? 'مدير' : 'Manager'}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <div className="header-title">
            <h1>{activeTab === 'schedule'
              ? (isRTL ? 'الجدول والمهام' : 'Schedule & Tasks')
              : (isRTL ? 'الإعدادات' : 'Settings')
            }</h1>
            <p>{activeTab === 'schedule'
              ? (isRTL ? 'إدارة الجدول وتعيين المهام للموظفين' : 'Manage schedule and assign tasks to employees')
              : (isRTL ? 'إدارة إعدادات الحساب واللغة' : 'Manage account and language settings')
            }</p>
          </div>
          {activeTab === 'schedule' && (
            <div className="header-actions">
              <button className="add-task-btn" onClick={() => openCreateTaskModal()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {isRTL ? 'مهمة جديدة' : 'New Task'}
              </button>
            </div>
          )}
        </header>

        {/* Schedule Content */}
        {activeTab === 'schedule' && (
        <div className="schedule-layout">
          {/* Calendar Section */}
          <div className="calendar-section">
            {/* Calendar Header */}
            <div className="calendar-header">
              <button className="calendar-nav-btn" onClick={handlePrevMonth}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points={isRTL ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/>
                </svg>
              </button>
              <h3 className="calendar-title">
                {format(selectedDate, 'MMMM yyyy', { locale: isRTL ? ar : enUS })}
              </h3>
              <button className="calendar-nav-btn" onClick={handleNextMonth}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points={isRTL ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}/>
                </svg>
              </button>
            </div>

            {/* Week Days */}
            <div className="calendar-weekdays">
              {weekDays.map(day => (
                <div key={day} className="weekday">{day}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="calendar-grid">
              {/* Empty cells for days before first of month */}
              {Array(days[0].getDay()).fill(null).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day empty"></div>
              ))}

              {/* Days */}
              {days.map(day => {
                const events = getEventsForDay(day);
                const appointments = events.filter(e => e.type !== 'task');
                const tasks = events.filter(e => e.type === 'task');
                const hasEvents = events.length > 0;

                return (
                  <motion.div
                    key={day.toISOString()}
                    className={`calendar-day ${isToday(day) ? 'today' : ''} ${hasEvents ? 'has-events' : ''} ${selectedCalendarDay && isSameDay(day, selectedCalendarDay) ? 'selected' : ''}`}
                    onClick={() => setSelectedCalendarDay(hasEvents ? day : null)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="day-number">{format(day, 'd')}</span>
                    {hasEvents && (
                      <div className="event-dots-container">
                        {/* Appointment dots (circles) */}
                        {appointments.slice(0, 2).map((event, i) => (
                          <span
                            key={`apt-${i}`}
                            className="event-dot"
                            style={{ backgroundColor: SECTION_COLORS[event.section] || '#6366f1' }}
                          />
                        ))}
                        {/* Task dots (squares) */}
                        {tasks.slice(0, 2).map((task, i) => (
                          <span
                            key={`task-${i}`}
                            className="task-dot"
                            style={{ backgroundColor: PRIORITY_COLORS[task.priority] || '#f59e0b' }}
                          />
                        ))}
                        {events.length > 4 && (
                          <span className="more-events">+{events.length - 4}</span>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Selected Day Details */}
            <AnimatePresence>
              {selectedCalendarDay && (
                <motion.div
                  className="selected-day-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="selected-day-header">
                    <h4>
                      {format(selectedCalendarDay, 'EEEE, d MMMM', { locale: isRTL ? ar : enUS })}
                    </h4>
                    <button onClick={() => setSelectedCalendarDay(null)}>×</button>
                  </div>
                  <div className="selected-day-events">
                    {getEventsForDay(selectedCalendarDay).map(event => (
                      <div
                        key={event.id}
                        className={`event-item ${event.type === 'task' ? `task-event priority-${event.priority}` : ''}`}
                        style={event.type !== 'task' ? { borderLeftColor: SECTION_COLORS[event.section] } : {}}
                      >
                        <div className="event-header">
                          <span className="event-title">{event.title}</span>
                          {event.type === 'task' && (
                            <span className={`task-status ${event.status}`}>
                              {event.status === 'pending' ? (isRTL ? 'قيد الانتظار' : 'Pending') :
                               event.status === 'in_progress' ? (isRTL ? 'قيد التنفيذ' : 'In Progress') :
                               event.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                               (isRTL ? 'ملغى' : 'Cancelled')}
                            </span>
                          )}
                        </div>
                        <div className="event-meta">
                          {event.startTime && <span>🕐 {event.startTime}</span>}
                          <span>📍 {sectionLabels[event.section] || event.section}</span>
                          {event.type === 'task' && event.assignee && (
                            <span>👤 {event.assignee}</span>
                          )}
                        </div>
                        {event.type === 'task' && (
                          <div className="task-actions">
                            <button
                              className="task-action-btn edit"
                              onClick={() => openEditTaskModal(event)}
                            >
                              {isRTL ? 'تعديل' : 'Edit'}
                            </button>
                            <button
                              className="task-action-btn delete"
                              onClick={() => handleDeleteTask(event.id)}
                            >
                              {isRTL ? 'حذف' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    className="add-task-btn"
                    style={{ marginTop: '12px', width: '100%' }}
                    onClick={() => openCreateTaskModal(selectedCalendarDay)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    {isRTL ? 'إضافة مهمة لهذا اليوم' : 'Add task for this day'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Sidebar - Tasks & Employees */}
          <div className="schedule-sidebar">
            {/* Employees Filter */}
            <div className="employees-section">
              <h3>{isRTL ? 'الموظفون' : 'Employees'}</h3>
              <div className="employees-grid">
                <div
                  className={`employee-card ${scheduleFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setScheduleFilter('all')}
                >
                  <div className="employee-avatar" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <span>{isRTL ? 'الكل' : 'All'}</span>
                </div>
                {employees.map(emp => (
                  <div
                    key={emp.employeeId}
                    className={`employee-card ${scheduleFilter === emp.employeeId ? 'active' : ''}`}
                    onClick={() => setScheduleFilter(emp.employeeId)}
                  >
                    <div
                      className="employee-avatar"
                      style={{ background: SECTION_COLORS[emp.section] || '#6366f1' }}
                    >
                      {emp.name.charAt(0)}
                    </div>
                    <span>{emp.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Tasks */}
            <div className="tasks-sidebar">
              <div className="tasks-sidebar-header">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  {isRTL ? 'المهام القادمة' : 'Upcoming Tasks'}
                  <span className="task-count">{getUpcomingTasks().length}</span>
                </h3>
              </div>

              {getUpcomingTasks().length === 0 ? (
                <div className="tasks-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  <p>{isRTL ? 'لا توجد مهام قادمة' : 'No upcoming tasks'}</p>
                </div>
              ) : (
                <div className="task-list">
                  {getUpcomingTasks().map(task => (
                    <div
                      key={task.id}
                      className={`task-item priority-${task.priority}`}
                      onClick={() => openEditTaskModal(task)}
                    >
                      <div className="task-item-header">
                        <span className="task-item-title">{task.title}</span>
                        <span className={`priority-badge ${task.priority}`}>
                          {task.priority === 'high' ? '!' : task.priority === 'medium' ? '•' : '○'}
                        </span>
                      </div>
                      <div className="task-item-due">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                        </svg>
                        {formatDate(task.date)}
                        {task.startTime && ` • ${task.startTime}`}
                      </div>
                      {task.assignee && (
                        <div className="task-item-assignee">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          {task.assignee}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Settings Content */}
        {activeTab === 'settings' && (
          <div className="settings-content">
            {/* Language Settings */}
            <div className="settings-section">
              <div className="settings-section-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <h3>{isRTL ? 'اللغة' : 'Language'}</h3>
              </div>
              <div className="settings-section-body">
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">{isRTL ? 'لغة العرض' : 'Display Language'}</span>
                    <span className="setting-description">
                      {isRTL ? 'اختر لغة واجهة المستخدم' : 'Choose the interface language'}
                    </span>
                  </div>
                  <div className="language-toggle-group">
                    <button
                      className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
                      onClick={() => i18n.changeLanguage('en')}
                    >
                      English
                    </button>
                    <button
                      className={`lang-btn ${i18n.language === 'ar' ? 'active' : ''}`}
                      onClick={() => i18n.changeLanguage('ar')}
                    >
                      العربية
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Settings */}
            <div className="settings-section">
              <div className="settings-section-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <h3>{isRTL ? 'الحساب' : 'Account'}</h3>
              </div>
              <div className="settings-section-body">
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">{isRTL ? 'اسم المستخدم' : 'Username'}</span>
                    <span className="setting-value">{managerData?.username}</span>
                  </div>
                </div>
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">{isRTL ? 'الاسم الكامل' : 'Full Name'}</span>
                    <span className="setting-value">{managerData?.fullName}</span>
                  </div>
                </div>
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">{isRTL ? 'البريد الإلكتروني' : 'Email'}</span>
                    <span className="setting-value">{managerData?.email}</span>
                  </div>
                </div>
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">{isRTL ? 'الدور' : 'Role'}</span>
                    <span className="setting-value role-badge">
                      {managerData?.role === 'manager' ? (isRTL ? 'مدير' : 'Manager') : (isRTL ? 'مشرف' : 'Admin')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Session */}
            <div className="settings-section">
              <div className="settings-section-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <h3>{isRTL ? 'الجلسة' : 'Session'}</h3>
              </div>
              <div className="settings-section-body">
                <button className="logout-setting-btn" onClick={handleLogout}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <motion.div
            className="task-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTaskModal(false)}
          >
            <motion.div
              className="task-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="task-modal-header">
                <h2>{selectedTask ? (isRTL ? 'تعديل المهمة' : 'Edit Task') : (isRTL ? 'مهمة جديدة' : 'New Task')}</h2>
                <button className="task-modal-close" onClick={() => setShowTaskModal(false)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="task-modal-body">
                <div className="task-form-group">
                  <label>{isRTL ? 'العنوان' : 'Title'} <span className="required">*</span></label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder={isRTL ? 'عنوان المهمة' : 'Task title'}
                  />
                </div>

                <div className="task-form-group">
                  <label>{isRTL ? 'الوصف' : 'Description'}</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder={isRTL ? 'وصف المهمة (اختياري)' : 'Task description (optional)'}
                  />
                </div>

                <div className="task-form-group">
                  <label>{isRTL ? 'تعيين إلى' : 'Assign to'} <span className="required">*</span></label>
                  <select
                    value={taskForm.employeeId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                  >
                    <option value="">{isRTL ? 'اختر موظف' : 'Select employee'}</option>
                    {employees.map(emp => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.name} - {sectionLabels[emp.section] || emp.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="task-form-row">
                  <div className="task-form-group">
                    <label>{isRTL ? 'تاريخ الاستحقاق' : 'Due Date'} <span className="required">*</span></label>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="task-form-group">
                    <label>{isRTL ? 'الوقت' : 'Time'}</label>
                    <input
                      type="time"
                      value={taskForm.dueTime}
                      onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="task-form-group">
                  <label>{isRTL ? 'الأولوية' : 'Priority'}</label>
                  <div className="priority-selector">
                    <button
                      type="button"
                      className={`priority-btn low ${taskForm.priority === 'low' ? 'active' : ''}`}
                      onClick={() => setTaskForm({ ...taskForm, priority: 'low' })}
                    >
                      {isRTL ? 'منخفضة' : 'Low'}
                    </button>
                    <button
                      type="button"
                      className={`priority-btn medium ${taskForm.priority === 'medium' ? 'active' : ''}`}
                      onClick={() => setTaskForm({ ...taskForm, priority: 'medium' })}
                    >
                      {isRTL ? 'متوسطة' : 'Medium'}
                    </button>
                    <button
                      type="button"
                      className={`priority-btn high ${taskForm.priority === 'high' ? 'active' : ''}`}
                      onClick={() => setTaskForm({ ...taskForm, priority: 'high' })}
                    >
                      {isRTL ? 'عالية' : 'High'}
                    </button>
                  </div>
                </div>

                {selectedTask && (
                  <div className="task-form-group">
                    <label>{isRTL ? 'الحالة' : 'Status'}</label>
                    <select
                      value={taskForm.status || selectedTask.status}
                      onChange={(e) => handleUpdateTaskStatus(selectedTask.id, e.target.value)}
                    >
                      <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                      <option value="in_progress">{isRTL ? 'قيد التنفيذ' : 'In Progress'}</option>
                      <option value="completed">{isRTL ? 'مكتمل' : 'Completed'}</option>
                      <option value="cancelled">{isRTL ? 'ملغى' : 'Cancelled'}</option>
                    </select>
                  </div>
                )}

                <div className="task-form-group">
                  <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                  <textarea
                    value={taskForm.notes}
                    onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                    placeholder={isRTL ? 'ملاحظات إضافية' : 'Additional notes'}
                  />
                </div>
              </div>

              <div className="task-modal-actions">
                <button className="btn-cancel" onClick={() => setShowTaskModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit"
                  onClick={selectedTask ? handleUpdateTask : handleCreateTask}
                  disabled={taskLoading || !taskForm.title || !taskForm.employeeId || !taskForm.dueDate}
                >
                  {taskLoading ? (
                    <span className="loading-spinner"></span>
                  ) : selectedTask ? (
                    isRTL ? 'تحديث' : 'Update'
                  ) : (
                    isRTL ? 'إنشاء' : 'Create'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManagerDashboard;
