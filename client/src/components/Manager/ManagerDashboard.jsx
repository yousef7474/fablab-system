import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Valid tabs for URL persistence
  const validTabs = ['schedule', 'tasks', 'ratings', 'volunteers', 'settings'];

  // Get initial tab from URL or default to 'schedule'
  const getInitialTab = () => {
    const tabFromUrl = searchParams.get('tab');
    return validTabs.includes(tabFromUrl) ? tabFromUrl : 'schedule';
  };

  // State
  const [managerData, setManagerData] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleFilter, setScheduleFilter] = useState('all');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    employeeId: '',
    employeeIds: [], // For multi-employee selection
    selectAllEmployees: false,
    dueDate: '',
    dueDateEnd: '', // For date range
    dueTime: '',
    priority: 'medium',
    section: '',
    notes: ''
  });

  // Rating state
  const [ratings, setRatings] = useState([]);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    employeeId: '',
    points: 0,
    criteria: '',
    notes: '',
    ratingDate: new Date().toISOString().split('T')[0]
  });
  const [ratingFilters, setRatingFilters] = useState({
    employeeId: 'all',
    startDate: '',
    endDate: ''
  });
  const [customCriteria, setCustomCriteria] = useState('');

  // Volunteer state
  const [volunteers, setVolunteers] = useState([]);
  const [groupedTasks, setGroupedTasks] = useState([]);
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [volunteerLoading, setVolunteerLoading] = useState(false);
  const [volunteerForm, setVolunteerForm] = useState({
    name: '',
    nationalId: '',
    phone: '',
    email: '',
    nationalIdPhoto: ''
  });
  const [opportunityForm, setOpportunityForm] = useState({
    volunteerId: '',
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    dailyHours: 8,
    rating: 0,
    ratingCriteria: '',
    ratingNotes: ''
  });

  // Predefined criteria options
  const criteriaOptions = [
    { value: '', label: isRTL ? 'اختر المعيار' : 'Select Criteria' },
    { value: 'attendance', label: isRTL ? 'الحضور والانضباط' : 'Attendance & Punctuality' },
    { value: 'performance', label: isRTL ? 'جودة الأداء' : 'Work Performance' },
    { value: 'teamwork', label: isRTL ? 'العمل الجماعي' : 'Teamwork' },
    { value: 'initiative', label: isRTL ? 'المبادرة والإبداع' : 'Initiative & Creativity' },
    { value: 'communication', label: isRTL ? 'التواصل' : 'Communication' },
    { value: 'customer_service', label: isRTL ? 'خدمة العملاء' : 'Customer Service' },
    { value: 'technical_skills', label: isRTL ? 'المهارات التقنية' : 'Technical Skills' },
    { value: 'safety', label: isRTL ? 'الالتزام بالسلامة' : 'Safety Compliance' },
    { value: 'other', label: isRTL ? 'أخرى' : 'Other' }
  ];

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

  // Sync URL with active tab
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (activeTab !== currentTab) {
      if (activeTab === 'schedule') {
        // Remove tab param for schedule (default)
        searchParams.delete('tab');
      } else {
        searchParams.set('tab', activeTab);
      }
      setSearchParams(searchParams, { replace: true });
    }
  }, [activeTab]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const newTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'schedule';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchParams]);

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

  // Generate dates between start and end
  const getDatesBetween = (startDate, endDate) => {
    const dates = [];
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(new Date(date).toISOString().split('T')[0]);
    }
    return dates;
  };

  // Task CRUD operations
  const handleCreateTask = async () => {
    const hasValidEmployee = taskForm.selectAllEmployees || taskForm.employeeId;
    if (!taskForm.title || !hasValidEmployee || !taskForm.dueDate) {
      toast.error(isRTL ? 'العنوان والموظف والتاريخ مطلوبة' : 'Title, employee, and date are required');
      return;
    }

    setTaskLoading(true);
    try {
      // Get list of employees to assign
      const employeeIds = taskForm.selectAllEmployees
        ? employees.map(emp => emp.employeeId)
        : [taskForm.employeeId];

      // Get list of dates (range if end date is provided)
      const dates = getDatesBetween(taskForm.dueDate, taskForm.dueDateEnd);

      // Create tasks for all combinations
      const promises = [];
      for (const employeeId of employeeIds) {
        const employee = employees.find(e => e.employeeId === employeeId);
        for (const date of dates) {
          promises.push(api.post('/tasks', {
            title: taskForm.title,
            description: taskForm.description,
            employeeId,
            dueDate: date,
            dueTime: taskForm.dueTime,
            priority: taskForm.priority,
            section: employee?.section || taskForm.section,
            notes: taskForm.notes
          }));
        }
      }

      await Promise.all(promises);
      const totalTasks = employeeIds.length * dates.length;
      toast.success(isRTL
        ? `تم إنشاء ${totalTasks} مهمة بنجاح`
        : `${totalTasks} task(s) created successfully`);
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
      employeeIds: [],
      selectAllEmployees: false,
      dueDate: '',
      dueDateEnd: '',
      dueTime: '',
      priority: 'medium',
      section: '',
      notes: ''
    });
    setSelectedTask(null);
  };

  // Rating CRUD operations
  const fetchRatings = useCallback(async () => {
    try {
      let url = '/ratings';
      const params = new URLSearchParams();
      if (ratingFilters.employeeId && ratingFilters.employeeId !== 'all') {
        params.append('employeeId', ratingFilters.employeeId);
      }
      if (ratingFilters.startDate) {
        params.append('startDate', ratingFilters.startDate);
      }
      if (ratingFilters.endDate) {
        params.append('endDate', ratingFilters.endDate);
      }
      if (params.toString()) {
        url += '?' + params.toString();
      }
      const response = await api.get(url);
      setRatings(response.data || []);
    } catch (error) {
      console.error('Error fetching ratings:', error);
      toast.error(isRTL ? 'خطأ في تحميل التقييمات' : 'Error loading ratings');
    }
  }, [ratingFilters, isRTL]);

  useEffect(() => {
    if (activeTab === 'ratings' && managerData) {
      fetchRatings();
    }
  }, [activeTab, managerData, fetchRatings]);

  const handleCreateRating = async () => {
    if (!ratingForm.employeeId || ratingForm.points === undefined) {
      toast.error(isRTL ? 'الموظف والنقاط مطلوبة' : 'Employee and points are required');
      return;
    }

    // Determine the actual criteria value
    const actualCriteria = ratingForm.criteria === 'other'
      ? customCriteria
      : criteriaOptions.find(c => c.value === ratingForm.criteria)?.label || ratingForm.criteria;

    setRatingLoading(true);
    try {
      await api.post('/ratings', {
        ...ratingForm,
        criteria: actualCriteria
      });
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      setShowRatingModal(false);
      resetRatingForm();
      fetchRatings();
    } catch (error) {
      console.error('Error creating rating:', error);
      toast.error(isRTL ? 'خطأ في إضافة التقييم' : 'Error adding rating');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleDeleteRating = async (ratingId) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذا التقييم؟' : 'Delete this rating?')) return;

    try {
      await api.delete(`/ratings/${ratingId}`);
      toast.success(isRTL ? 'تم حذف التقييم' : 'Rating deleted');
      fetchRatings();
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error(isRTL ? 'خطأ في حذف التقييم' : 'Error deleting rating');
    }
  };

  const resetRatingForm = () => {
    setRatingForm({
      employeeId: '',
      points: 0,
      criteria: '',
      notes: '',
      ratingDate: new Date().toISOString().split('T')[0]
    });
    setCustomCriteria('');
  };

  const handleExportRatings = async () => {
    try {
      const params = new URLSearchParams();
      params.append('employeeId', ratingFilters.employeeId || 'all');
      if (ratingFilters.startDate) {
        params.append('startDate', ratingFilters.startDate);
      }
      if (ratingFilters.endDate) {
        params.append('endDate', ratingFilters.endDate);
      }

      const response = await api.get(`/ratings/export?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `employee_ratings_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(isRTL ? 'تم تصدير التقييمات' : 'Ratings exported successfully');
    } catch (error) {
      console.error('Error exporting ratings:', error);
      toast.error(isRTL ? 'خطأ في تصدير التقييمات' : 'Error exporting ratings');
    }
  };

  // Volunteer CRUD operations
  const fetchVolunteers = useCallback(async () => {
    try {
      const response = await api.get('/volunteers');
      setVolunteers(response.data || []);
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    }
  }, []);

  const fetchGroupedTasks = useCallback(async () => {
    try {
      const response = await api.get('/tasks/grouped');
      setGroupedTasks(response.data || []);
    } catch (error) {
      console.error('Error fetching grouped tasks:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'volunteers' && managerData) {
      fetchVolunteers();
    }
    if (activeTab === 'tasks' && managerData) {
      fetchGroupedTasks();
    }
  }, [activeTab, managerData, fetchVolunteers, fetchGroupedTasks]);

  const handleCreateVolunteer = async () => {
    if (!volunteerForm.name || !volunteerForm.nationalId || !volunteerForm.phone) {
      toast.error(isRTL ? 'الاسم ورقم الهوية والجوال مطلوبة' : 'Name, national ID, and phone are required');
      return;
    }

    setVolunteerLoading(true);
    try {
      await api.post('/volunteers', volunteerForm);
      toast.success(isRTL ? 'تم إضافة المتطوع بنجاح' : 'Volunteer added successfully');
      setShowVolunteerModal(false);
      resetVolunteerForm();
      fetchVolunteers();
    } catch (error) {
      console.error('Error creating volunteer:', error);
      if (error.response?.status === 409) {
        toast.error(isRTL ? 'يوجد متطوع بنفس رقم الهوية' : 'Volunteer with this national ID already exists');
      } else {
        toast.error(isRTL ? 'خطأ في إضافة المتطوع' : 'Error adding volunteer');
      }
    } finally {
      setVolunteerLoading(false);
    }
  };

  const handleCreateOpportunity = async () => {
    if (!opportunityForm.volunteerId || !opportunityForm.title || !opportunityForm.startDate || !opportunityForm.endDate) {
      toast.error(isRTL ? 'المتطوع والعنوان والتاريخ مطلوبة' : 'Volunteer, title, and dates are required');
      return;
    }

    setVolunteerLoading(true);
    try {
      await api.post('/volunteers/opportunities', opportunityForm);
      toast.success(isRTL ? 'تم إضافة فرصة التطوع بنجاح' : 'Opportunity added successfully');
      setShowOpportunityModal(false);
      resetOpportunityForm();
      fetchVolunteers();
    } catch (error) {
      console.error('Error creating opportunity:', error);
      toast.error(isRTL ? 'خطأ في إضافة فرصة التطوع' : 'Error adding opportunity');
    } finally {
      setVolunteerLoading(false);
    }
  };

  const handleUpdateGroupStatus = async (groupId, taskId, newStatus) => {
    try {
      if (groupId) {
        await api.patch(`/tasks/group/${groupId}/status`, { status: newStatus });
      } else {
        await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      }
      toast.success(isRTL ? 'تم تحديث حالة المهمة' : 'Task status updated');
      fetchGroupedTasks();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const handleDeleteGroup = async (groupId, taskId) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذه المهمة؟' : 'Delete this assignment?')) return;

    try {
      if (groupId) {
        await api.delete(`/tasks/group/${groupId}`);
      } else {
        await api.delete(`/tasks/${taskId}`);
      }
      toast.success(isRTL ? 'تم حذف المهمة' : 'Assignment deleted');
      fetchGroupedTasks();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(isRTL ? 'خطأ في الحذف' : 'Error deleting');
    }
  };

  const resetVolunteerForm = () => {
    setVolunteerForm({
      name: '',
      nationalId: '',
      phone: '',
      email: '',
      nationalIdPhoto: ''
    });
  };

  const resetOpportunityForm = () => {
    setOpportunityForm({
      volunteerId: '',
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      dailyHours: 8,
      rating: 0,
      ratingCriteria: '',
      ratingNotes: ''
    });
  };

  const handleVolunteerPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(isRTL ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجا)' : 'File too large (max 5MB)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setVolunteerForm(prev => ({ ...prev, nationalIdPhoto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateTotalHours = (startDate, endDate, dailyHours = 8) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return days * dailyHours;
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
            className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <span>{isRTL ? 'المهام' : 'Tasks'}</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'ratings' ? 'active' : ''}`}
            onClick={() => setActiveTab('ratings')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span>{isRTL ? 'تقييم الموظفين' : 'Employee Ratings'}</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'volunteers' ? 'active' : ''}`}
            onClick={() => setActiveTab('volunteers')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>{isRTL ? 'المتطوعين' : 'Volunteers'}</span>
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
              ? (isRTL ? 'الجدول' : 'Schedule')
              : activeTab === 'tasks'
              ? (isRTL ? 'المهام' : 'Tasks')
              : activeTab === 'ratings'
              ? (isRTL ? 'تقييم الموظفين' : 'Employee Ratings')
              : activeTab === 'volunteers'
              ? (isRTL ? 'المتطوعين' : 'Volunteers')
              : (isRTL ? 'الإعدادات' : 'Settings')
            }</h1>
            <p>{activeTab === 'schedule'
              ? (isRTL ? 'عرض جدول المواعيد والمهام' : 'View appointments and tasks schedule')
              : activeTab === 'tasks'
              ? (isRTL ? 'إدارة وتعيين المهام للموظفين' : 'Manage and assign tasks to employees')
              : activeTab === 'ratings'
              ? (isRTL ? 'إعطاء نقاط للموظفين وتصدير التقارير' : 'Give points to employees and export reports')
              : activeTab === 'volunteers'
              ? (isRTL ? 'إدارة المتطوعين وفرص التطوع' : 'Manage volunteers and opportunities')
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
          {activeTab === 'ratings' && (
            <div className="header-actions">
              <button className="add-task-btn" onClick={() => setShowRatingModal(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {isRTL ? 'إضافة تقييم' : 'Add Rating'}
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

        {/* Ratings Content */}
        {activeTab === 'ratings' && (
          <div className="ratings-content">
            {/* Filters Section */}
            <div className="ratings-filters">
              <div className="filter-group">
                <label>{isRTL ? 'الموظف' : 'Employee'}</label>
                <select
                  value={ratingFilters.employeeId}
                  onChange={(e) => setRatingFilters(prev => ({ ...prev, employeeId: e.target.value }))}
                >
                  <option value="all">{isRTL ? 'جميع الموظفين' : 'All Employees'}</option>
                  {employees.map(emp => (
                    <option key={emp.employeeId} value={emp.employeeId}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label>{isRTL ? 'من تاريخ' : 'From Date'}</label>
                <input
                  type="date"
                  value={ratingFilters.startDate}
                  onChange={(e) => setRatingFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="filter-group">
                <label>{isRTL ? 'إلى تاريخ' : 'To Date'}</label>
                <input
                  type="date"
                  value={ratingFilters.endDate}
                  onChange={(e) => setRatingFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <button className="export-btn" onClick={handleExportRatings}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {isRTL ? 'تصدير CSV' : 'Export CSV'}
              </button>
            </div>

            {/* Ratings Table */}
            <div className="ratings-table-container">
              <table className="ratings-table">
                <thead>
                  <tr>
                    <th>{isRTL ? 'الموظف' : 'Employee'}</th>
                    <th>{isRTL ? 'القسم' : 'Section'}</th>
                    <th>{isRTL ? 'النقاط' : 'Points'}</th>
                    <th>{isRTL ? 'المعيار' : 'Criteria'}</th>
                    <th>{isRTL ? 'التاريخ' : 'Date'}</th>
                    <th>{isRTL ? 'ملاحظات' : 'Notes'}</th>
                    <th>{isRTL ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-message">
                        {isRTL ? 'لا توجد تقييمات' : 'No ratings found'}
                      </td>
                    </tr>
                  ) : (
                    ratings.map(rating => (
                      <tr key={rating.ratingId}>
                        <td>{rating.employee?.name || 'N/A'}</td>
                        <td>
                          <span className="section-badge" style={{ backgroundColor: SECTION_COLORS[rating.employee?.section] || '#666' }}>
                            {sectionLabels[rating.employee?.section] || rating.employee?.section || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <div className="points-display">
                            <div className="mini-stars">
                              {[1, 2, 3, 4, 5].map(star => (
                                <svg key={star} width="14" height="14" viewBox="0 0 24 24" fill={rating.points >= star * 20 ? '#fbbf24' : '#e5e7eb'} stroke="none">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              ))}
                            </div>
                            <span className={`points-badge ${rating.points >= 80 ? 'high' : rating.points >= 50 ? 'medium' : 'low'}`}>
                              {rating.points}
                            </span>
                          </div>
                        </td>
                        <td>{rating.criteria || '-'}</td>
                        <td>{rating.ratingDate}</td>
                        <td className="notes-cell">{rating.notes || '-'}</td>
                        <td>
                          <button
                            className="delete-btn-small"
                            onClick={() => handleDeleteRating(rating.ratingId)}
                            title={isRTL ? 'حذف' : 'Delete'}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rating Modal */}
        {showRatingModal && (
          <div className="modal-overlay" onClick={() => setShowRatingModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'إضافة تقييم' : 'Add Rating'}</h2>
                <button className="close-btn" onClick={() => setShowRatingModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{isRTL ? 'الموظف' : 'Employee'} *</label>
                  <select
                    value={ratingForm.employeeId}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, employeeId: e.target.value }))}
                    required
                  >
                    <option value="">{isRTL ? 'اختر موظف' : 'Select Employee'}</option>
                    {employees.map(emp => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.name} - {sectionLabels[emp.section] || emp.section}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Simple 1 Point Rating */}
                <div className="form-group">
                  <label>{isRTL ? 'منح نقطة' : 'Award Point'}</label>
                  <div className="point-toggle-container">
                    <button
                      type="button"
                      className={`point-toggle-btn ${ratingForm.points === 1 ? 'active' : ''}`}
                      onClick={() => setRatingForm(prev => ({ ...prev, points: prev.points === 1 ? 0 : 1 }))}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill={ratingForm.points === 1 ? '#22c55e' : 'none'} stroke={ratingForm.points === 1 ? '#22c55e' : '#9ca3af'} strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      <span>{ratingForm.points === 1
                        ? (isRTL ? 'تم منح نقطة' : 'Point Awarded')
                        : (isRTL ? 'انقر لمنح نقطة' : 'Click to Award Point')
                      }</span>
                    </button>
                  </div>
                </div>

                {/* Legacy Star Rating - Hidden, kept for compatibility */}
                <div style={{ display: 'none' }}>
                  <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`star-btn ${ratingForm.points >= star * 20 ? 'active' : ''}`}
                          onClick={() => setRatingForm(prev => ({ ...prev, points: star * 20 }))}
                        >
                          <svg width="32" height="32" viewBox="0 0 24 24" fill={ratingForm.points >= star * 20 ? '#fbbf24' : 'none'} stroke={ratingForm.points >= star * 20 ? '#fbbf24' : '#d1d5db'} strokeWidth="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </button>
                      ))}
                    <div className="rating-bar-container">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={ratingForm.points}
                        onChange={(e) => setRatingForm(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                        className="rating-slider"
                      />
                      <div className="rating-bar-fill" style={{ width: `${ratingForm.points}%` }} />
                    </div>
                    <div className="rating-value">
                      <span className={`rating-number ${ratingForm.points >= 80 ? 'excellent' : ratingForm.points >= 60 ? 'good' : ratingForm.points >= 40 ? 'average' : 'poor'}`}>
                        {ratingForm.points}
                      </span>
                      <span className="rating-label">
                        {ratingForm.points >= 80 ? (isRTL ? 'ممتاز' : 'Excellent') :
                         ratingForm.points >= 60 ? (isRTL ? 'جيد' : 'Good') :
                         ratingForm.points >= 40 ? (isRTL ? 'متوسط' : 'Average') :
                         (isRTL ? 'ضعيف' : 'Poor')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Criteria Dropdown */}
                <div className="form-group">
                  <label>{isRTL ? 'المعيار' : 'Criteria'}</label>
                  <select
                    value={ratingForm.criteria}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, criteria: e.target.value }))}
                    className="criteria-select"
                  >
                    {criteriaOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {ratingForm.criteria === 'other' && (
                    <input
                      type="text"
                      value={customCriteria}
                      onChange={(e) => setCustomCriteria(e.target.value)}
                      placeholder={isRTL ? 'أدخل المعيار المخصص...' : 'Enter custom criteria...'}
                      className="custom-criteria-input"
                      style={{ marginTop: '8px' }}
                    />
                  )}
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'التاريخ' : 'Date'}</label>
                  <input
                    type="date"
                    value={ratingForm.ratingDate}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, ratingDate: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                  <textarea
                    value={ratingForm.notes}
                    onChange={(e) => setRatingForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder={isRTL ? 'ملاحظات إضافية...' : 'Additional notes...'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowRatingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateRating}
                  disabled={ratingLoading || !ratingForm.employeeId}
                >
                  {ratingLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Tasks Content (Grouped Assignments) */}
        {activeTab === 'tasks' && (
          <div className="tasks-content">
            <div className="volunteers-header">
              <h2>{isRTL ? 'المهام المجموعة' : 'Grouped Assignments'}</h2>
              <button className="add-task-btn" onClick={() => openCreateTaskModal()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {isRTL ? 'إضافة مهمة' : 'Add Task'}
              </button>
            </div>

            <div className="assignments-list">
              {groupedTasks.length === 0 ? (
                <div className="empty-state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  <p>{isRTL ? 'لا توجد مهام' : 'No tasks found'}</p>
                </div>
              ) : (
                groupedTasks.map(task => (
                  <div key={task.groupId || task.taskId} className={`assignment-card priority-${task.priority}`}>
                    <div className="assignment-header">
                      <h3 className="assignment-title">{task.title}</h3>
                      <span className={`task-status ${task.status}`}>
                        {task.status === 'pending' ? (isRTL ? 'قيد الانتظار' : 'Pending') :
                         task.status === 'in_progress' ? (isRTL ? 'قيد التنفيذ' : 'In Progress') :
                         task.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                         (isRTL ? 'ملغى' : 'Cancelled')}
                      </span>
                    </div>
                    <div className="assignment-meta">
                      <div className="assignment-meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span>{task.assignee?.name || 'N/A'}</span>
                      </div>
                      {task.section && (
                        <div className="assignment-meta-item">
                          <span className="section-badge" style={{ backgroundColor: SECTION_COLORS[task.section] || '#666', padding: '2px 8px', borderRadius: '10px', color: 'white', fontSize: '12px' }}>
                            {sectionLabels[task.section] || task.section}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="assignment-dates">
                      <span>{task.startDate}</span>
                      {task.startDate !== task.endDate && (
                        <>
                          <span className="date-range-arrow">→</span>
                          <span>{task.endDate}</span>
                          <span className="days-count">{task.dayCount} {isRTL ? 'أيام' : 'days'}</span>
                        </>
                      )}
                    </div>
                    {task.description && (
                      <p style={{ margin: '12px 0 0', fontSize: '14px', color: 'var(--text-secondary)' }}>{task.description}</p>
                    )}
                    <div className="assignment-actions">
                      <select
                        className="status-select"
                        value={task.status}
                        onChange={(e) => handleUpdateGroupStatus(task.groupId, task.taskId || task.taskIds?.[0], e.target.value)}
                      >
                        <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                        <option value="in_progress">{isRTL ? 'قيد التنفيذ' : 'In Progress'}</option>
                        <option value="completed">{isRTL ? 'مكتمل' : 'Completed'}</option>
                        <option value="cancelled">{isRTL ? 'ملغى' : 'Cancelled'}</option>
                      </select>
                      <button
                        className="delete-assignment-btn"
                        onClick={() => handleDeleteGroup(task.groupId, task.taskId || task.taskIds?.[0])}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Volunteers Content */}
        {activeTab === 'volunteers' && (
          <div className="volunteers-content">
            <div className="volunteers-header">
              <h2>{isRTL ? 'إدارة المتطوعين' : 'Volunteer Management'}</h2>
              <div className="volunteers-actions">
                <button className="add-volunteer-btn" onClick={() => setShowVolunteerModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  {isRTL ? 'إضافة متطوع' : 'Add Volunteer'}
                </button>
                <button className="add-opportunity-btn" onClick={() => setShowOpportunityModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="18"/>
                    <line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                  {isRTL ? 'إضافة فرصة تطوع' : 'Add Opportunity'}
                </button>
              </div>
            </div>

            <div className="volunteers-grid">
              {volunteers.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <p>{isRTL ? 'لا يوجد متطوعين' : 'No volunteers found'}</p>
                </div>
              ) : (
                volunteers.map(volunteer => (
                  <div key={volunteer.volunteerId} className="volunteer-card">
                    <div className="volunteer-header">
                      <div className="volunteer-avatar">
                        {volunteer.name?.charAt(0) || 'V'}
                      </div>
                      <div className="volunteer-info">
                        <h3>{volunteer.name}</h3>
                        <p>{volunteer.phone}</p>
                      </div>
                    </div>
                    <div className="volunteer-stats">
                      <div className="stat-item">
                        <div className="stat-value">{volunteer.totalOpportunities || 0}</div>
                        <div className="stat-label">{isRTL ? 'فرص' : 'Opportunities'}</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{volunteer.totalHours || 0}</div>
                        <div className="stat-label">{isRTL ? 'ساعة' : 'Hours'}</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{volunteer.totalPoints || 0}</div>
                        <div className="stat-label">{isRTL ? 'نقاط' : 'Points'}</div>
                      </div>
                    </div>
                    {volunteer.opportunities && volunteer.opportunities.length > 0 && (
                      <div className="volunteer-opportunities">
                        <strong style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {isRTL ? 'آخر الفرص:' : 'Recent:'}
                        </strong>
                        {volunteer.opportunities.slice(0, 2).map(opp => (
                          <div key={opp.opportunityId} className="opportunity-item">
                            <span className="opportunity-title">{opp.title}</span>
                            <span className="opportunity-hours">{opp.totalHours}h</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Volunteer Modal */}
        {showVolunteerModal && (
          <div className="modal-overlay" onClick={() => setShowVolunteerModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'إضافة متطوع جديد' : 'Add New Volunteer'}</h2>
                <button className="close-btn" onClick={() => setShowVolunteerModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{isRTL ? 'الاسم' : 'Name'} *</label>
                  <input
                    type="text"
                    value={volunteerForm.name}
                    onChange={(e) => setVolunteerForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'رقم الهوية' : 'National ID'} *</label>
                  <input
                    type="text"
                    value={volunteerForm.nationalId}
                    onChange={(e) => setVolunteerForm(prev => ({ ...prev, nationalId: e.target.value }))}
                    placeholder={isRTL ? 'رقم الهوية الوطنية' : 'National ID number'}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'رقم الجوال' : 'Phone'} *</label>
                  <input
                    type="tel"
                    value={volunteerForm.phone}
                    onChange={(e) => setVolunteerForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="05xxxxxxxx"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                  <input
                    type="email"
                    value={volunteerForm.email}
                    onChange={(e) => setVolunteerForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'صورة الهوية' : 'ID Photo'}</label>
                  <div
                    className={`photo-upload-area ${volunteerForm.nationalIdPhoto ? 'has-photo' : ''}`}
                    onClick={() => document.getElementById('id-photo-input').click()}
                  >
                    {volunteerForm.nationalIdPhoto ? (
                      <>
                        <img src={volunteerForm.nationalIdPhoto} alt="ID" className="photo-preview" />
                        <p>{isRTL ? 'انقر لتغيير الصورة' : 'Click to change photo'}</p>
                      </>
                    ) : (
                      <>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <p>{isRTL ? 'انقر لرفع صورة الهوية' : 'Click to upload ID photo'}</p>
                      </>
                    )}
                  </div>
                  <input
                    id="id-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleVolunteerPhotoUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowVolunteerModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateVolunteer}
                  disabled={volunteerLoading || !volunteerForm.name || !volunteerForm.nationalId || !volunteerForm.phone}
                >
                  {volunteerLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Opportunity Modal */}
        {showOpportunityModal && (
          <div className="modal-overlay" onClick={() => setShowOpportunityModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'إضافة فرصة تطوع' : 'Add Volunteer Opportunity'}</h2>
                <button className="close-btn" onClick={() => setShowOpportunityModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{isRTL ? 'المتطوع' : 'Volunteer'} *</label>
                  <select
                    value={opportunityForm.volunteerId}
                    onChange={(e) => setOpportunityForm(prev => ({ ...prev, volunteerId: e.target.value }))}
                    required
                  >
                    <option value="">{isRTL ? 'اختر متطوع' : 'Select Volunteer'}</option>
                    {volunteers.map(v => (
                      <option key={v.volunteerId} value={v.volunteerId}>{v.name} - {v.nationalId}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'عنوان الفرصة' : 'Opportunity Title'} *</label>
                  <input
                    type="text"
                    value={opportunityForm.title}
                    onChange={(e) => setOpportunityForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={isRTL ? 'عنوان فرصة التطوع' : 'Opportunity title'}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'الوصف' : 'Description'}</label>
                  <textarea
                    value={opportunityForm.description}
                    onChange={(e) => setOpportunityForm(prev => ({ ...prev, description: e.target.value }))}
                    rows="3"
                    placeholder={isRTL ? 'وصف فرصة التطوع...' : 'Opportunity description...'}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>{isRTL ? 'تاريخ البداية' : 'Start Date'} *</label>
                    <input
                      type="date"
                      value={opportunityForm.startDate}
                      onChange={(e) => setOpportunityForm(prev => ({ ...prev, startDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'تاريخ النهاية' : 'End Date'} *</label>
                    <input
                      type="date"
                      value={opportunityForm.endDate}
                      onChange={(e) => setOpportunityForm(prev => ({ ...prev, endDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'ساعات العمل اليومية' : 'Daily Hours'}</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={opportunityForm.dailyHours}
                    onChange={(e) => setOpportunityForm(prev => ({ ...prev, dailyHours: parseInt(e.target.value) || 8 }))}
                  />
                </div>
                {opportunityForm.startDate && opportunityForm.endDate && (
                  <div className="hours-display">
                    {isRTL ? 'إجمالي الساعات: ' : 'Total Hours: '}
                    {calculateTotalHours(opportunityForm.startDate, opportunityForm.endDate, opportunityForm.dailyHours)}
                  </div>
                )}
                <div className="form-group">
                  <label>{isRTL ? 'منح نقطة' : 'Award Point'}</label>
                  <div className="point-toggle-container">
                    <button
                      type="button"
                      className={`point-toggle-btn ${opportunityForm.rating === 1 ? 'active' : ''}`}
                      onClick={() => setOpportunityForm(prev => ({ ...prev, rating: prev.rating === 1 ? 0 : 1 }))}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill={opportunityForm.rating === 1 ? '#22c55e' : 'none'} stroke={opportunityForm.rating === 1 ? '#22c55e' : '#9ca3af'} strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      <span>{opportunityForm.rating === 1
                        ? (isRTL ? 'تم منح نقطة' : 'Point Awarded')
                        : (isRTL ? 'انقر لمنح نقطة' : 'Click to Award Point')
                      }</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowOpportunityModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateOpportunity}
                  disabled={volunteerLoading || !opportunityForm.volunteerId || !opportunityForm.title || !opportunityForm.startDate || !opportunityForm.endDate}
                >
                  {volunteerLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                </button>
              </div>
            </motion.div>
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
                  <div className="select-all-checkbox">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={taskForm.selectAllEmployees}
                        onChange={(e) => {
                          const selectAll = e.target.checked;
                          setTaskForm({
                            ...taskForm,
                            selectAllEmployees: selectAll,
                            employeeId: selectAll ? 'all' : '',
                            employeeIds: selectAll ? employees.map(emp => emp.employeeId) : []
                          });
                        }}
                      />
                      <span>{isRTL ? 'تعيين لجميع الموظفين' : 'Assign to all employees'}</span>
                    </label>
                  </div>
                  {!taskForm.selectAllEmployees && (
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
                  )}
                </div>

                <div className="task-form-row">
                  <div className="task-form-group">
                    <label>{isRTL ? 'من تاريخ' : 'From Date'} <span className="required">*</span></label>
                    <input
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="task-form-group">
                    <label>{isRTL ? 'إلى تاريخ' : 'To Date'} <span className="optional">({isRTL ? 'اختياري' : 'optional'})</span></label>
                    <input
                      type="date"
                      value={taskForm.dueDateEnd}
                      onChange={(e) => setTaskForm({ ...taskForm, dueDateEnd: e.target.value })}
                      min={taskForm.dueDate}
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
