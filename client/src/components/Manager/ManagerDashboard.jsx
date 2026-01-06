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
  const validTabs = ['schedule', 'tasks', 'ratings', 'volunteers', 'interns', 'settings'];

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
  const [employeeNetPoints, setEmployeeNetPoints] = useState({});
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    employeeId: '',
    type: 'award',
    points: 1,
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
  const [showVolunteerDetailModal, setShowVolunteerDetailModal] = useState(false);
  const [showVolunteerRatingModal, setShowVolunteerRatingModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [volunteerLoading, setVolunteerLoading] = useState(false);
  const [volunteerRatingForm, setVolunteerRatingForm] = useState({
    volunteerId: '',
    opportunityId: '',
    type: 'award',
    points: 1,
    criteria: '',
    notes: '',
    ratingDate: new Date().toISOString().split('T')[0]
  });
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

  // Intern state (University Training)
  const [interns, setInterns] = useState([]);
  const [showInternModal, setShowInternModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showInternDetailModal, setShowInternDetailModal] = useState(false);
  const [showInternRatingModal, setShowInternRatingModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [internLoading, setInternLoading] = useState(false);
  const [internRatingForm, setInternRatingForm] = useState({
    internId: '',
    trainingId: '',
    type: 'award',
    points: 1,
    criteria: '',
    notes: '',
    ratingDate: new Date().toISOString().split('T')[0]
  });
  const [internForm, setInternForm] = useState({
    name: '',
    nationalId: '',
    phone: '',
    email: '',
    university: '',
    major: '',
    nationalIdPhoto: ''
  });
  const [trainingForm, setTrainingForm] = useState({
    internId: '',
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
        const isOnDay = isSameDay(eventDate, day);

        // Apply employee filter if not 'all'
        if (scheduleFilter !== 'all' && isOnDay) {
          const selectedEmployee = employees.find(e => e.employeeId === scheduleFilter);
          if (!selectedEmployee) return isOnDay;

          // For tasks, filter by employeeId
          if (event.type === 'task') {
            return event.employeeId === scheduleFilter || event.assigneeId === scheduleFilter;
          }
          // For appointments, filter by section
          return event.section === selectedEmployee.section;
        }

        return isOnDay;
      } catch {
        return false;
      }
    });
  };

  // Navigate months
  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));

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

      // Create ONE task per employee (with date range if multi-day)
      const promises = [];
      for (const employeeId of employeeIds) {
        const employee = employees.find(e => e.employeeId === employeeId);
        promises.push(api.post('/tasks', {
          title: taskForm.title,
          description: taskForm.description,
          employeeId,
          dueDate: taskForm.dueDate,
          dueDateEnd: taskForm.dueDateEnd || null,
          dueTime: taskForm.dueTime,
          priority: taskForm.priority,
          section: employee?.section || taskForm.section,
          notes: taskForm.notes
        }));
      }

      await Promise.all(promises);
      toast.success(isRTL
        ? `تم إنشاء ${employeeIds.length} مهمة بنجاح`
        : `${employeeIds.length} task(s) created successfully`);
      setShowTaskModal(false);
      resetTaskForm();
      fetchSchedule();
      fetchGroupedTasks();
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
      setRatings(response.data?.ratings || []);
      setEmployeeNetPoints(response.data?.employeeNetPoints || {});
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
      type: 'award',
      points: 1,
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

  // Intern CRUD operations
  const fetchInterns = useCallback(async () => {
    try {
      const response = await api.get('/interns');
      setInterns(response.data || []);
    } catch (error) {
      console.error('Error fetching interns:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'volunteers' && managerData) {
      fetchVolunteers();
    }
    if (activeTab === 'tasks' && managerData) {
      fetchGroupedTasks();
    }
    if (activeTab === 'interns' && managerData) {
      fetchInterns();
    }
  }, [activeTab, managerData, fetchVolunteers, fetchGroupedTasks, fetchInterns]);

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

  const handleOpenVolunteerRating = (volunteer, opportunity = null) => {
    setSelectedVolunteer(volunteer);
    setSelectedOpportunity(opportunity);
    setVolunteerRatingForm({
      volunteerId: volunteer.volunteerId,
      opportunityId: opportunity?.opportunityId || '',
      type: 'award',
      points: 1,
      criteria: '',
      notes: '',
      ratingDate: new Date().toISOString().split('T')[0]
    });
    setShowVolunteerRatingModal(true);
  };

  const handleCreateVolunteerRating = async () => {
    if (!volunteerRatingForm.volunteerId) return;

    setVolunteerLoading(true);
    try {
      await api.post('/volunteers/ratings', volunteerRatingForm);
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      setShowVolunteerRatingModal(false);
      setSelectedVolunteer(null);
      setSelectedOpportunity(null);
      fetchVolunteers();
    } catch (error) {
      console.error('Error creating volunteer rating:', error);
      toast.error(isRTL ? 'خطأ في إضافة التقييم' : 'Error adding rating');
    } finally {
      setVolunteerLoading(false);
    }
  };

  const handleDeleteVolunteerRating = async (ratingId) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذا التقييم؟' : 'Delete this rating?')) return;

    try {
      await api.delete(`/volunteers/ratings/${ratingId}`);
      toast.success(isRTL ? 'تم حذف التقييم' : 'Rating deleted');
      fetchVolunteers();
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error(isRTL ? 'خطأ في حذف التقييم' : 'Error deleting rating');
    }
  };

  const handleDeleteVolunteer = async (volunteerId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا المتطوع؟ سيتم حذف جميع سجلاته.' : 'Are you sure you want to delete this volunteer? All their records will be deleted.')) return;

    try {
      await api.delete(`/volunteers/${volunteerId}`);
      toast.success(isRTL ? 'تم حذف المتطوع بنجاح' : 'Volunteer deleted successfully');
      setShowVolunteerDetailModal(false);
      setSelectedVolunteer(null);
      fetchVolunteers();
    } catch (error) {
      console.error('Error deleting volunteer:', error);
      toast.error(isRTL ? 'خطأ في حذف المتطوع' : 'Error deleting volunteer');
    }
  };

  // ============== INTERN (University Training) CRUD ==============

  const handleCreateIntern = async () => {
    if (!internForm.name || !internForm.nationalId || !internForm.phone) {
      toast.error(isRTL ? 'الاسم ورقم الهوية والجوال مطلوبة' : 'Name, national ID, and phone are required');
      return;
    }

    setInternLoading(true);
    try {
      await api.post('/interns', internForm);
      toast.success(isRTL ? 'تم إضافة المتدرب بنجاح' : 'Intern added successfully');
      setShowInternModal(false);
      resetInternForm();
      fetchInterns();
    } catch (error) {
      console.error('Error creating intern:', error);
      if (error.response?.status === 409) {
        toast.error(isRTL ? 'يوجد متدرب بنفس رقم الهوية' : 'Intern with this national ID already exists');
      } else {
        toast.error(isRTL ? 'خطأ في إضافة المتدرب' : 'Error adding intern');
      }
    } finally {
      setInternLoading(false);
    }
  };

  const handleCreateTraining = async () => {
    if (!trainingForm.internId || !trainingForm.title || !trainingForm.startDate || !trainingForm.endDate) {
      toast.error(isRTL ? 'المتدرب والعنوان والتاريخ مطلوبة' : 'Intern, title, and dates are required');
      return;
    }

    setInternLoading(true);
    try {
      await api.post('/interns/trainings', trainingForm);
      toast.success(isRTL ? 'تم إضافة فترة التدريب بنجاح' : 'Training added successfully');
      setShowTrainingModal(false);
      resetTrainingForm();
      fetchInterns();
    } catch (error) {
      console.error('Error creating training:', error);
      toast.error(isRTL ? 'خطأ في إضافة فترة التدريب' : 'Error adding training');
    } finally {
      setInternLoading(false);
    }
  };

  const resetInternForm = () => {
    setInternForm({
      name: '',
      nationalId: '',
      phone: '',
      email: '',
      university: '',
      major: '',
      nationalIdPhoto: ''
    });
  };

  const resetTrainingForm = () => {
    setTrainingForm({
      internId: '',
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

  const handleOpenInternRating = (intern, training = null) => {
    setSelectedIntern(intern);
    setSelectedTraining(training);
    setInternRatingForm({
      internId: intern.internId,
      trainingId: training?.trainingId || '',
      type: 'award',
      points: 1,
      criteria: '',
      notes: '',
      ratingDate: new Date().toISOString().split('T')[0]
    });
    setShowInternRatingModal(true);
  };

  const handleCreateInternRating = async () => {
    if (!internRatingForm.internId || !internRatingForm.criteria) {
      toast.error(isRTL ? 'المتدرب والمعيار مطلوبان' : 'Intern and criteria are required');
      return;
    }

    setInternLoading(true);
    try {
      await api.post('/interns/ratings', internRatingForm);
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      setShowInternRatingModal(false);
      setSelectedIntern(null);
      setSelectedTraining(null);
      fetchInterns();
    } catch (error) {
      console.error('Error creating intern rating:', error);
      toast.error(isRTL ? 'خطأ في إضافة التقييم' : 'Error adding rating');
    } finally {
      setInternLoading(false);
    }
  };

  const handleDeleteInternRating = async (ratingId) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذا التقييم؟' : 'Delete this rating?')) return;

    try {
      await api.delete(`/interns/ratings/${ratingId}`);
      toast.success(isRTL ? 'تم حذف التقييم' : 'Rating deleted');
      fetchInterns();
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error(isRTL ? 'خطأ في حذف التقييم' : 'Error deleting rating');
    }
  };

  const handleDeleteIntern = async (internId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا المتدرب؟ سيتم حذف جميع سجلاته.' : 'Are you sure you want to delete this intern? All their records will be deleted.')) return;

    try {
      await api.delete(`/interns/${internId}`);
      toast.success(isRTL ? 'تم حذف المتدرب بنجاح' : 'Intern deleted successfully');
      setShowInternDetailModal(false);
      setSelectedIntern(null);
      fetchInterns();
    } catch (error) {
      console.error('Error deleting intern:', error);
      toast.error(isRTL ? 'خطأ في حذف المتدرب' : 'Error deleting intern');
    }
  };

  const handleExportInternHistory = (intern) => {
    // Create CSV content for single intern
    const bom = '\uFEFF';
    let csv = bom;

    // Intern info
    csv += `${isRTL ? 'معلومات المتدرب' : 'Intern Information'}\n`;
    csv += `${isRTL ? 'الاسم' : 'Name'},${intern.name}\n`;
    csv += `${isRTL ? 'رقم الهوية' : 'National ID'},${intern.nationalId}\n`;
    csv += `${isRTL ? 'الجوال' : 'Phone'},${intern.phone}\n`;
    csv += `${isRTL ? 'البريد' : 'Email'},${intern.email || 'N/A'}\n`;
    csv += `${isRTL ? 'الجامعة' : 'University'},${intern.university || 'N/A'}\n`;
    csv += `${isRTL ? 'التخصص' : 'Major'},${intern.major || 'N/A'}\n\n`;

    // Trainings
    csv += `${isRTL ? 'فترات التدريب' : 'Trainings'}\n`;
    csv += `${isRTL ? 'العنوان' : 'Title'},${isRTL ? 'من' : 'From'},${isRTL ? 'إلى' : 'To'},${isRTL ? 'الساعات' : 'Hours'},${isRTL ? 'الحالة' : 'Status'}\n`;
    (intern.trainings || []).forEach(t => {
      csv += `"${t.title}",${t.startDate},${t.endDate},${t.totalHours || 0},${t.status}\n`;
    });
    csv += '\n';

    // Ratings history
    csv += `${isRTL ? 'سجل التقييمات' : 'Ratings History'}\n`;
    csv += `${isRTL ? 'التاريخ' : 'Date'},${isRTL ? 'النوع' : 'Type'},${isRTL ? 'النقاط' : 'Points'},${isRTL ? 'المعيار' : 'Criteria'},${isRTL ? 'ملاحظات' : 'Notes'}\n`;
    (intern.ratings || []).forEach(r => {
      const typeLabel = r.type === 'award' ? (isRTL ? 'منح' : 'Award') : (isRTL ? 'خصم' : 'Deduction');
      const pointsDisplay = r.type === 'award' ? `+${r.points}` : `-${r.points}`;
      csv += `${r.ratingDate},"${typeLabel}",${pointsDisplay},"${r.criteria || ''}","${r.notes || ''}"\n`;
    });
    csv += '\n';

    // Summary
    csv += `${isRTL ? 'ملخص' : 'Summary'}\n`;
    csv += `${isRTL ? 'إجمالي فترات التدريب' : 'Total Trainings'},${intern.totalTrainings || 0}\n`;
    csv += `${isRTL ? 'إجمالي الساعات' : 'Total Hours'},${intern.totalHours || 0}\n`;
    csv += `${isRTL ? 'نقاط المنح' : 'Awards'},+${intern.totalAwards || 0}\n`;
    csv += `${isRTL ? 'نقاط الخصم' : 'Deductions'},-${intern.totalDeductions || 0}\n`;
    csv += `${isRTL ? 'صافي النقاط' : 'Net Points'},${intern.totalPoints || 0}\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `intern_${intern.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAllInterns = () => {
    if (interns.length === 0) {
      toast.error(isRTL ? 'لا يوجد متدربين للتصدير' : 'No interns to export');
      return;
    }

    const bom = '\uFEFF';
    const headers = [
      isRTL ? 'الاسم' : 'Name',
      isRTL ? 'رقم الهوية' : 'National ID',
      isRTL ? 'الجوال' : 'Phone',
      isRTL ? 'البريد' : 'Email',
      isRTL ? 'الجامعة' : 'University',
      isRTL ? 'التخصص' : 'Major',
      isRTL ? 'فترات التدريب' : 'Trainings',
      isRTL ? 'الساعات' : 'Hours',
      isRTL ? 'نقاط المنح' : 'Awards',
      isRTL ? 'نقاط الخصم' : 'Deductions',
      isRTL ? 'صافي النقاط' : 'Net Points'
    ];

    let csv = bom + headers.join(',') + '\n';

    let totalTrainings = 0;
    let totalHours = 0;
    let totalAwards = 0;
    let totalDeductions = 0;

    interns.forEach(intern => {
      csv += `"${intern.name}","${intern.nationalId}","${intern.phone}","${intern.email || ''}","${intern.university || ''}","${intern.major || ''}",${intern.totalTrainings || 0},${intern.totalHours || 0},+${intern.totalAwards || 0},-${intern.totalDeductions || 0},${intern.totalPoints || 0}\n`;
      totalTrainings += intern.totalTrainings || 0;
      totalHours += intern.totalHours || 0;
      totalAwards += intern.totalAwards || 0;
      totalDeductions += intern.totalDeductions || 0;
    });

    // Summary row
    csv += `\n"${isRTL ? 'الإجمالي' : 'TOTAL'}","","","","","",${totalTrainings},${totalHours},+${totalAwards},-${totalDeductions},${totalAwards - totalDeductions}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_interns_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success(isRTL ? 'تم تحديث حالة المهمة' : 'Task status updated');
      fetchGroupedTasks();
      fetchSchedule();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const handleDeleteTaskAssignment = async (taskId) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذه المهمة؟' : 'Delete this assignment?')) return;

    try {
      await api.delete(`/tasks/${taskId}`);
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

  // View volunteer details
  const handleViewVolunteer = (volunteer) => {
    setSelectedVolunteer(volunteer);
    setShowVolunteerDetailModal(true);
  };

  // Export single volunteer history as CSV
  const handleExportVolunteerHistory = (volunteer) => {
    // Opportunities section
    const oppHeaders = [
      'Volunteer Name', 'National ID', 'Phone', 'Email',
      'Opportunity Title', 'Description', 'Start Date', 'End Date',
      'Daily Hours', 'Total Hours', 'Status'
    ];

    const oppRows = (volunteer.opportunities || []).map(opp => [
      volunteer.name,
      volunteer.nationalId,
      volunteer.phone,
      volunteer.email || 'N/A',
      opp.title,
      opp.description || '',
      opp.startDate,
      opp.endDate,
      opp.dailyHours || 8,
      opp.totalHours || 0,
      opp.status || 'active'
    ]);

    // Calculate totals
    const totalHours = (volunteer.opportunities || []).reduce((sum, o) => sum + (o.totalHours || 0), 0);
    const awards = (volunteer.ratings || []).filter(r => r.type === 'award').reduce((sum, r) => sum + (r.points || 0), 0);
    const deductions = (volunteer.ratings || []).filter(r => r.type === 'deduction').reduce((sum, r) => sum + (r.points || 0), 0);
    const netPoints = awards - deductions;

    // Ratings section
    const ratingHeaders = ['Date', 'Type', 'Points', 'Criteria', 'Notes'];
    const ratingRows = (volunteer.ratings || []).map(r => [
      r.ratingDate,
      r.type,
      r.type === 'deduction' ? `-${r.points}` : `+${r.points}`,
      r.criteria || '',
      r.notes ? r.notes.replace(/"/g, '""') : ''
    ]);

    // Build CSV content
    const csvLines = [
      '--- VOLUNTEER INFO ---',
      `"Name","${volunteer.name}"`,
      `"National ID","${volunteer.nationalId}"`,
      `"Phone","${volunteer.phone}"`,
      `"Email","${volunteer.email || 'N/A'}"`,
      '',
      '--- OPPORTUNITIES ---',
      oppHeaders.join(','),
      ...oppRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      '--- RATINGS HISTORY ---',
      ratingHeaders.join(','),
      ...ratingRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      '--- SUMMARY ---',
      '"Total Hours","Total Awards","Total Deductions","Net Points"',
      `"${totalHours}","${awards}","${deductions}","${netPoints}"`
    ];

    const csvContent = csvLines.join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `volunteer_${volunteer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(isRTL ? 'تم تصدير السجل بنجاح' : 'History exported successfully');
  };

  // Export all volunteers as CSV
  const handleExportAllVolunteers = () => {
    const headers = [
      'Volunteer Name', 'National ID', 'Phone', 'Email',
      'Total Opportunities', 'Total Hours', 'Awards', 'Deductions', 'Net Points', 'Status'
    ];

    const rows = volunteers.map(v => [
      v.name,
      v.nationalId,
      v.phone,
      v.email || 'N/A',
      v.totalOpportunities || 0,
      v.totalHours || 0,
      v.totalAwards || 0,
      v.totalDeductions || 0,
      v.totalPoints || 0,
      v.isActive ? 'Active' : 'Inactive'
    ]);

    // Add summary row
    const totalOpps = volunteers.reduce((sum, v) => sum + (v.totalOpportunities || 0), 0);
    const totalHours = volunteers.reduce((sum, v) => sum + (v.totalHours || 0), 0);
    const totalAwards = volunteers.reduce((sum, v) => sum + (v.totalAwards || 0), 0);
    const totalDeductions = volunteers.reduce((sum, v) => sum + (v.totalDeductions || 0), 0);
    const totalNetPoints = volunteers.reduce((sum, v) => sum + (v.totalPoints || 0), 0);

    const summaryRows = [
      [],
      ['--- SUMMARY ---'],
      ['Total Volunteers', 'Total Opportunities', 'Total Hours', 'Total Awards', 'Total Deductions', 'Total Net Points'],
      [volunteers.length, totalOpps, totalHours, totalAwards, totalDeductions, totalNetPoints]
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ...summaryRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `all_volunteers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(isRTL ? 'تم تصدير جميع المتطوعين' : 'All volunteers exported');
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

  // Get upcoming tasks (filtered by selected employee)
  const getUpcomingTasks = () => {
    const tasks = schedule.filter(item => item.type === 'task');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks
      .filter(task => {
        const dueDate = parseISO(task.date);
        const isUpcoming = dueDate >= today && task.status !== 'completed' && task.status !== 'cancelled';

        // Apply employee filter if not 'all'
        if (scheduleFilter !== 'all' && isUpcoming) {
          return task.employeeId === scheduleFilter;
        }

        return isUpcoming;
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
            <span>{isRTL ? 'الجدول' : 'Schedule'}</span>
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
            className={`nav-item ${activeTab === 'interns' ? 'active' : ''}`}
            onClick={() => setActiveTab('interns')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
            <span>{isRTL ? 'تدريب جامعي' : 'University Training'}</span>
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
              : activeTab === 'interns'
              ? (isRTL ? 'تدريب جامعي' : 'University Training')
              : (isRTL ? 'الإعدادات' : 'Settings')
            }</h1>
            <p>{activeTab === 'schedule'
              ? (isRTL ? 'عرض جدول المواعيد' : 'View appointments schedule')
              : activeTab === 'tasks'
              ? (isRTL ? 'إدارة وتعيين المهام للموظفين' : 'Manage and assign tasks to employees')
              : activeTab === 'ratings'
              ? (isRTL ? 'إعطاء نقاط للموظفين وتصدير التقارير' : 'Give points to employees and export reports')
              : activeTab === 'volunteers'
              ? (isRTL ? 'إدارة المتطوعين وفرص التطوع' : 'Manage volunteers and opportunities')
              : activeTab === 'interns'
              ? (isRTL ? 'إدارة طلاب التدريب الصيفي الجامعي' : 'Manage university summer training interns')
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
                        {/* Task dots (squares) - colored by section like appointments */}
                        {tasks.slice(0, 2).map((task, i) => (
                          <span
                            key={`task-${i}`}
                            className="task-dot"
                            style={{ backgroundColor: SECTION_COLORS[task.section] || '#6366f1' }}
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

            {/* Net Points Summary */}
            {Object.keys(employeeNetPoints).length > 0 && (
              <div className="net-points-summary">
                <h3 style={{ width: '100%', marginBottom: '12px', fontSize: '16px', color: 'var(--text-primary)' }}>
                  {isRTL ? 'ملخص صافي النقاط' : 'Net Points Summary'}
                </h3>
                {Object.entries(employeeNetPoints).map(([empId, data]) => {
                  const employee = employees.find(e => e.employeeId === empId);
                  return (
                    <div key={empId} className="net-points-card">
                      <div
                        className="net-points-avatar"
                        style={{ backgroundColor: SECTION_COLORS[employee?.section] || '#666' }}
                      >
                        {data.name?.charAt(0) || '?'}
                      </div>
                      <div className="net-points-info">
                        <div className="net-points-name">{data.name || 'Unknown'}</div>
                        <div className="net-points-stats">
                          <span style={{ color: '#22c55e' }}>+{data.awards}</span>
                          <span style={{ color: '#ef4444' }}>-{data.deductions}</span>
                        </div>
                      </div>
                      <div className={`net-points-value ${data.net > 0 ? 'positive' : data.net < 0 ? 'negative' : 'neutral'}`}>
                        {data.net > 0 ? '+' : ''}{data.net}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Ratings Table */}
            <div className="ratings-table-container">
              <table className="ratings-table">
                <thead>
                  <tr>
                    <th>{isRTL ? 'الموظف' : 'Employee'}</th>
                    <th>{isRTL ? 'القسم' : 'Section'}</th>
                    <th>{isRTL ? 'النوع' : 'Type'}</th>
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
                      <td colSpan="8" className="empty-message">
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
                          <span className={`rating-type-badge ${rating.type || 'award'}`}>
                            {rating.type === 'deduction'
                              ? (isRTL ? 'خصم' : 'Deduction')
                              : (isRTL ? 'منحة' : 'Award')}
                          </span>
                        </td>
                        <td>
                          <span className={`points-badge-simple ${rating.type === 'deduction' ? 'negative' : 'positive'}`}>
                            {rating.type === 'deduction' ? '-1' : '+1'}
                          </span>
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

                {/* Rating Type Toggle (Award/Deduction) */}
                <div className="form-group">
                  <label>{isRTL ? 'نوع التقييم' : 'Rating Type'}</label>
                  <div className="rating-type-toggle">
                    <button
                      type="button"
                      className={`rating-type-btn award ${ratingForm.type === 'award' ? 'active' : ''}`}
                      onClick={() => setRatingForm(prev => ({ ...prev, type: 'award' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      <span>{isRTL ? 'منح نقطة' : 'Award'}</span>
                    </button>
                    <button
                      type="button"
                      className={`rating-type-btn deduction ${ratingForm.type === 'deduction' ? 'active' : ''}`}
                      onClick={() => setRatingForm(prev => ({ ...prev, type: 'deduction' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      <span>{isRTL ? 'خصم نقطة' : 'Deduction'}</span>
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
                        onChange={(e) => handleUpdateTaskStatus(task.taskId, e.target.value)}
                      >
                        <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                        <option value="in_progress">{isRTL ? 'قيد التنفيذ' : 'In Progress'}</option>
                        <option value="completed">{isRTL ? 'مكتمل' : 'Completed'}</option>
                        <option value="cancelled">{isRTL ? 'ملغى' : 'Cancelled'}</option>
                      </select>
                      <button
                        className="delete-assignment-btn"
                        onClick={() => handleDeleteTaskAssignment(task.taskId)}
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
                {volunteers.length > 0 && (
                  <button className="export-btn" onClick={handleExportAllVolunteers}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {isRTL ? 'تصدير الكل' : 'Export All'}
                  </button>
                )}
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
                        <div className={`stat-value ${(volunteer.totalPoints || 0) > 0 ? 'positive' : (volunteer.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                          {(volunteer.totalPoints || 0) > 0 ? '+' : ''}{volunteer.totalPoints || 0}
                        </div>
                        <div className="stat-label">{isRTL ? 'نقاط' : 'Net Points'}</div>
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
                    <div className="volunteer-card-actions">
                      <button
                        className="view-volunteer-btn"
                        onClick={() => handleViewVolunteer(volunteer)}
                        title={isRTL ? 'عرض التفاصيل' : 'View Details'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                        {isRTL ? 'عرض' : 'View'}
                      </button>
                      <button
                        className="export-volunteer-btn"
                        onClick={() => handleExportVolunteerHistory(volunteer)}
                        title={isRTL ? 'تصدير السجل' : 'Export History'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        {isRTL ? 'تصدير' : 'Export'}
                      </button>
                      <button
                        className="rate-volunteer-btn"
                        onClick={() => handleOpenVolunteerRating(volunteer)}
                        title={isRTL ? 'تقييم المتطوع' : 'Rate Volunteer'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                        </svg>
                        {isRTL ? 'تقييم' : 'Rate'}
                      </button>
                    </div>
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
                <div className="info-note" style={{ marginTop: '12px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  {isRTL
                    ? 'ملاحظة: يمكنك تقييم المتطوع بعد انتهاء فرصة التطوع'
                    : 'Note: You can rate the volunteer after the opportunity is completed'}
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

        {/* Volunteer Detail Modal */}
        {showVolunteerDetailModal && selectedVolunteer && (
          <div className="modal-overlay" onClick={() => setShowVolunteerDetailModal(false)}>
            <motion.div
              className="modal-content volunteer-detail-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'معلومات المتطوع' : 'Volunteer Details'}</h2>
                <button className="close-btn" onClick={() => setShowVolunteerDetailModal(false)}>×</button>
              </div>
              <div className="modal-body volunteer-detail-body">
                {/* Volunteer Profile Section */}
                <div className="volunteer-detail-profile">
                  <div className="volunteer-detail-avatar">
                    {selectedVolunteer.nationalIdPhoto ? (
                      <img src={selectedVolunteer.nationalIdPhoto} alt="ID" className="volunteer-id-photo" />
                    ) : (
                      <div className="avatar-placeholder">
                        {selectedVolunteer.name?.charAt(0) || 'V'}
                      </div>
                    )}
                  </div>
                  <div className="volunteer-detail-info">
                    <h3>{selectedVolunteer.name}</h3>
                    <div className="info-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="9" cy="10" r="2"/>
                        <path d="M15 8h2"/>
                        <path d="M15 12h2"/>
                        <path d="M7 16h10"/>
                      </svg>
                      <span>{isRTL ? 'رقم الهوية: ' : 'National ID: '}{selectedVolunteer.nationalId}</span>
                    </div>
                    <div className="info-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>
                      </svg>
                      <span>{selectedVolunteer.phone}</span>
                    </div>
                    {selectedVolunteer.email && (
                      <div className="info-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <span>{selectedVolunteer.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Section */}
                <div className="volunteer-detail-stats">
                  <div className="detail-stat">
                    <div className="detail-stat-value">{selectedVolunteer.totalOpportunities || 0}</div>
                    <div className="detail-stat-label">{isRTL ? 'فرص تطوعية' : 'Opportunities'}</div>
                  </div>
                  <div className="detail-stat">
                    <div className="detail-stat-value">{selectedVolunteer.totalHours || 0}</div>
                    <div className="detail-stat-label">{isRTL ? 'ساعة تطوع' : 'Total Hours'}</div>
                  </div>
                  <div className="detail-stat">
                    <div className={`detail-stat-value ${(selectedVolunteer.totalPoints || 0) > 0 ? 'positive' : (selectedVolunteer.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                      {(selectedVolunteer.totalPoints || 0) > 0 ? '+' : ''}{selectedVolunteer.totalPoints || 0}
                    </div>
                    <div className="detail-stat-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</div>
                  </div>
                </div>

                {/* Points Breakdown */}
                {(selectedVolunteer.totalAwards > 0 || selectedVolunteer.totalDeductions > 0) && (
                  <div className="points-breakdown">
                    <span className="awards">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      +{selectedVolunteer.totalAwards || 0} {isRTL ? 'منح' : 'awards'}
                    </span>
                    <span className="deductions">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      -{selectedVolunteer.totalDeductions || 0} {isRTL ? 'خصم' : 'deductions'}
                    </span>
                  </div>
                )}

                {/* Ratings History */}
                {selectedVolunteer.ratings && selectedVolunteer.ratings.length > 0 && (
                  <div className="volunteer-history-section">
                    <h4>{isRTL ? 'سجل التقييمات' : 'Ratings History'}</h4>
                    <div className="ratings-history-list">
                      {selectedVolunteer.ratings.map(rating => (
                        <div key={rating.ratingId} className={`rating-history-item ${rating.type}`}>
                          <div className="rating-history-header">
                            <span className={`rating-points ${rating.type}`}>
                              {rating.type === 'deduction' ? `-${rating.points}` : `+${rating.points}`}
                            </span>
                            <span className="rating-date">{rating.ratingDate}</span>
                            <button
                              className="delete-rating-btn"
                              onClick={() => handleDeleteVolunteerRating(rating.ratingId)}
                              title={isRTL ? 'حذف' : 'Delete'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                              </svg>
                            </button>
                          </div>
                          {rating.criteria && (
                            <div className="rating-criteria">{rating.criteria}</div>
                          )}
                          {rating.notes && (
                            <div className="rating-notes">{rating.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ID Photo Full View */}
                {selectedVolunteer.nationalIdPhoto && (
                  <div className="volunteer-id-section">
                    <h4>{isRTL ? 'صورة الهوية' : 'National ID Photo'}</h4>
                    <img
                      src={selectedVolunteer.nationalIdPhoto}
                      alt="National ID"
                      className="volunteer-id-full"
                      onClick={() => window.open(selectedVolunteer.nationalIdPhoto, '_blank')}
                    />
                  </div>
                )}

                {/* Opportunities History */}
                <div className="volunteer-history-section">
                  <h4>{isRTL ? 'سجل التطوع' : 'Volunteering History'}</h4>
                  {(!selectedVolunteer.opportunities || selectedVolunteer.opportunities.length === 0) ? (
                    <p className="no-history">{isRTL ? 'لا توجد فرص تطوعية مسجلة' : 'No volunteering history'}</p>
                  ) : (
                    <div className="history-list">
                      {selectedVolunteer.opportunities.map(opp => (
                        <div key={opp.opportunityId} className="history-item">
                          <div className="history-item-header">
                            <strong>{opp.title}</strong>
                            <span className={`status-badge ${opp.status || 'active'}`}>
                              {opp.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                               opp.status === 'cancelled' ? (isRTL ? 'ملغى' : 'Cancelled') :
                               (isRTL ? 'نشط' : 'Active')}
                            </span>
                          </div>
                          {opp.description && (
                            <p className="history-description">{opp.description}</p>
                          )}
                          <div className="history-meta">
                            <span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              {opp.startDate} → {opp.endDate}
                            </span>
                            <span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                              {opp.totalHours || 0} {isRTL ? 'ساعة' : 'hours'}
                            </span>
                            <button
                              className="rate-opportunity-btn"
                              onClick={() => handleOpenVolunteerRating(selectedVolunteer, opp)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                              </svg>
                              {isRTL ? 'تقييم' : 'Rate'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="modal-btn delete"
                  onClick={() => handleDeleteVolunteer(selectedVolunteer.volunteerId)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  {isRTL ? 'حذف المتطوع' : 'Delete Volunteer'}
                </button>
                <button
                  className="modal-btn export"
                  onClick={() => handleExportVolunteerHistory(selectedVolunteer)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {isRTL ? 'تصدير السجل' : 'Export History'}
                </button>
                <button className="modal-btn cancel" onClick={() => setShowVolunteerDetailModal(false)}>
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Volunteer Rating Modal */}
        {showVolunteerRatingModal && selectedVolunteer && (
          <div className="modal-overlay" onClick={() => setShowVolunteerRatingModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'تقييم المتطوع' : 'Rate Volunteer'}</h2>
                <button className="close-btn" onClick={() => setShowVolunteerRatingModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="opportunity-info-summary">
                  <h4>{selectedVolunteer.name}</h4>
                  {selectedOpportunity && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {isRTL ? 'فرصة: ' : 'Opportunity: '}{selectedOpportunity.title}
                    </p>
                  )}
                </div>

                {/* Rating Type Toggle (Award/Deduction) */}
                <div className="form-group">
                  <label>{isRTL ? 'نوع التقييم' : 'Rating Type'}</label>
                  <div className="rating-type-toggle">
                    <button
                      type="button"
                      className={`rating-type-btn award ${volunteerRatingForm.type === 'award' ? 'active' : ''}`}
                      onClick={() => setVolunteerRatingForm(prev => ({ ...prev, type: 'award' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      <span>{isRTL ? 'منح نقاط' : 'Award'}</span>
                    </button>
                    <button
                      type="button"
                      className={`rating-type-btn deduction ${volunteerRatingForm.type === 'deduction' ? 'active' : ''}`}
                      onClick={() => setVolunteerRatingForm(prev => ({ ...prev, type: 'deduction' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      <span>{isRTL ? 'خصم نقاط' : 'Deduction'}</span>
                    </button>
                  </div>
                </div>

                {/* Points Selector (1-5) */}
                <div className="form-group">
                  <label>{isRTL ? 'عدد النقاط' : 'Number of Points'}</label>
                  <div className="points-selector">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        className={`point-btn ${volunteerRatingForm.points === num ? 'active' : ''} ${volunteerRatingForm.type}`}
                        onClick={() => setVolunteerRatingForm(prev => ({ ...prev, points: num }))}
                      >
                        {volunteerRatingForm.type === 'deduction' ? `-${num}` : `+${num}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'المعيار' : 'Criteria'}</label>
                  <select
                    value={volunteerRatingForm.criteria}
                    onChange={(e) => setVolunteerRatingForm(prev => ({ ...prev, criteria: e.target.value }))}
                    className="criteria-select"
                  >
                    {criteriaOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'التاريخ' : 'Date'}</label>
                  <input
                    type="date"
                    value={volunteerRatingForm.ratingDate}
                    onChange={(e) => setVolunteerRatingForm(prev => ({ ...prev, ratingDate: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                  <textarea
                    value={volunteerRatingForm.notes}
                    onChange={(e) => setVolunteerRatingForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder={isRTL ? 'ملاحظات حول الأداء...' : 'Performance notes...'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowVolunteerRatingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateVolunteerRating}
                  disabled={volunteerLoading}
                >
                  {volunteerLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التقييم' : 'Save Rating')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Interns (University Training) Content */}
        {activeTab === 'interns' && (
          <div className="volunteers-section">
            <div className="volunteers-header">
              <div className="volunteers-actions">
                <button className="add-volunteer-btn" onClick={() => setShowInternModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  {isRTL ? 'إضافة متدرب' : 'Add Intern'}
                </button>
                <button className="add-volunteer-btn secondary" onClick={() => setShowTrainingModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  {isRTL ? 'إضافة فترة تدريب' : 'Add Training'}
                </button>
                <button className="export-btn" onClick={handleExportAllInterns}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {isRTL ? 'تصدير الكل' : 'Export All'}
                </button>
              </div>
              <div className="volunteers-stats">
                <div className="stat-item">
                  <span className="stat-value">{interns.length}</span>
                  <span className="stat-label">{isRTL ? 'متدرب' : 'Interns'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{interns.reduce((sum, i) => sum + (i.totalTrainings || 0), 0)}</span>
                  <span className="stat-label">{isRTL ? 'فترة تدريب' : 'Trainings'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{interns.reduce((sum, i) => sum + (i.totalHours || 0), 0)}</span>
                  <span className="stat-label">{isRTL ? 'ساعة' : 'Hours'}</span>
                </div>
              </div>
            </div>

            <div className="volunteers-grid">
              {interns.map(intern => (
                <motion.div
                  key={intern.internId}
                  className="volunteer-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    setSelectedIntern(intern);
                    setShowInternDetailModal(true);
                  }}
                >
                  <div className="volunteer-avatar">
                    {intern.nationalIdPhoto ? (
                      <img src={intern.nationalIdPhoto} alt={intern.name} />
                    ) : (
                      <span>{intern.name?.charAt(0) || 'I'}</span>
                    )}
                  </div>
                  <div className="volunteer-info">
                    <h4>{intern.name}</h4>
                    <p className="volunteer-id">{intern.nationalId}</p>
                    {intern.university && (
                      <p className="volunteer-university">{intern.university}</p>
                    )}
                    {intern.major && (
                      <p className="volunteer-major">{intern.major}</p>
                    )}
                  </div>
                  <div className="volunteer-stats">
                    <div className="stat">
                      <span className="stat-value">{intern.totalTrainings || 0}</span>
                      <span className="stat-label">{isRTL ? 'تدريب' : 'Trainings'}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{intern.totalHours || 0}</span>
                      <span className="stat-label">{isRTL ? 'ساعة' : 'Hours'}</span>
                    </div>
                    <div className="stat">
                      <span className={`stat-value ${(intern.totalPoints || 0) > 0 ? 'positive' : (intern.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                        {(intern.totalPoints || 0) > 0 ? '+' : ''}{intern.totalPoints || 0}
                      </span>
                      <span className="stat-label">{isRTL ? 'نقاط' : 'Points'}</span>
                    </div>
                  </div>
                  <button
                    className="rate-volunteer-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenInternRating(intern);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {isRTL ? 'تقييم' : 'Rate'}
                  </button>
                </motion.div>
              ))}
            </div>

            {interns.length === 0 && (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
                <h3>{isRTL ? 'لا يوجد متدربين' : 'No Interns Yet'}</h3>
                <p>{isRTL ? 'ابدأ بإضافة متدربين التدريب الصيفي الجامعي' : 'Start by adding university summer training interns'}</p>
              </div>
            )}
          </div>
        )}

        {/* Add Intern Modal */}
        {showInternModal && (
          <div className="modal-overlay" onClick={() => setShowInternModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'إضافة متدرب جديد' : 'Add New Intern'}</h2>
                <button className="close-btn" onClick={() => setShowInternModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{isRTL ? 'الاسم' : 'Name'} *</label>
                  <input
                    type="text"
                    value={internForm.name}
                    onChange={(e) => setInternForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={isRTL ? 'اسم المتدرب' : 'Intern name'}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{isRTL ? 'رقم الهوية' : 'National ID'} *</label>
                    <input
                      type="text"
                      value={internForm.nationalId}
                      onChange={(e) => setInternForm(prev => ({ ...prev, nationalId: e.target.value }))}
                      placeholder={isRTL ? 'رقم الهوية الوطنية' : 'National ID number'}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'رقم الجوال' : 'Phone'} *</label>
                    <input
                      type="text"
                      value={internForm.phone}
                      onChange={(e) => setInternForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder={isRTL ? 'رقم الجوال' : 'Phone number'}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                  <input
                    type="email"
                    value={internForm.email}
                    onChange={(e) => setInternForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={isRTL ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{isRTL ? 'الجامعة' : 'University'}</label>
                    <input
                      type="text"
                      value={internForm.university}
                      onChange={(e) => setInternForm(prev => ({ ...prev, university: e.target.value }))}
                      placeholder={isRTL ? 'اسم الجامعة' : 'University name'}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'التخصص' : 'Major'}</label>
                    <input
                      type="text"
                      value={internForm.major}
                      onChange={(e) => setInternForm(prev => ({ ...prev, major: e.target.value }))}
                      placeholder={isRTL ? 'التخصص الدراسي' : 'Field of study'}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowInternModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateIntern}
                  disabled={internLoading}
                >
                  {internLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Training Modal */}
        {showTrainingModal && (
          <div className="modal-overlay" onClick={() => setShowTrainingModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'إضافة فترة تدريب' : 'Add Training Period'}</h2>
                <button className="close-btn" onClick={() => setShowTrainingModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{isRTL ? 'المتدرب' : 'Intern'} *</label>
                  <select
                    value={trainingForm.internId}
                    onChange={(e) => setTrainingForm(prev => ({ ...prev, internId: e.target.value }))}
                  >
                    <option value="">{isRTL ? 'اختر المتدرب' : 'Select Intern'}</option>
                    {interns.map(intern => (
                      <option key={intern.internId} value={intern.internId}>
                        {intern.name} - {intern.nationalId}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'عنوان التدريب' : 'Training Title'} *</label>
                  <input
                    type="text"
                    value={trainingForm.title}
                    onChange={(e) => setTrainingForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={isRTL ? 'عنوان فترة التدريب' : 'Training period title'}
                  />
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'الوصف' : 'Description'}</label>
                  <textarea
                    value={trainingForm.description}
                    onChange={(e) => setTrainingForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={isRTL ? 'وصف التدريب (اختياري)' : 'Training description (optional)'}
                    rows="3"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{isRTL ? 'تاريخ البدء' : 'Start Date'} *</label>
                    <input
                      type="date"
                      value={trainingForm.startDate}
                      onChange={(e) => setTrainingForm(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'تاريخ الانتهاء' : 'End Date'} *</label>
                    <input
                      type="date"
                      value={trainingForm.endDate}
                      onChange={(e) => setTrainingForm(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'ساعات العمل اليومية' : 'Daily Hours'}</label>
                  <input
                    type="number"
                    value={trainingForm.dailyHours}
                    onChange={(e) => setTrainingForm(prev => ({ ...prev, dailyHours: parseFloat(e.target.value) || 8 }))}
                    min="1"
                    max="24"
                    step="0.5"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowTrainingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateTraining}
                  disabled={internLoading}
                >
                  {internLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Intern Detail Modal */}
        {showInternDetailModal && selectedIntern && (
          <div className="modal-overlay" onClick={() => setShowInternDetailModal(false)}>
            <motion.div
              className="modal-content volunteer-detail-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'تفاصيل المتدرب' : 'Intern Details'}</h2>
                <button className="close-btn" onClick={() => setShowInternDetailModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="volunteer-detail-header">
                  <div className="volunteer-avatar large">
                    {selectedIntern.nationalIdPhoto ? (
                      <img src={selectedIntern.nationalIdPhoto} alt="ID" className="volunteer-id-photo" />
                    ) : (
                      <span className="avatar-placeholder">
                        {selectedIntern.name?.charAt(0) || 'I'}
                      </span>
                    )}
                  </div>
                  <div className="volunteer-detail-info">
                    <h3>{selectedIntern.name}</h3>
                    <div className="detail-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="16" rx="2"/>
                        <line x1="7" y1="8" x2="17" y2="8"/>
                        <line x1="7" y1="12" x2="13" y2="12"/>
                      </svg>
                      <span>{isRTL ? 'رقم الهوية: ' : 'National ID: '}{selectedIntern.nationalId}</span>
                    </div>
                    <div className="detail-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>
                      </svg>
                      <span>{selectedIntern.phone}</span>
                    </div>
                    {selectedIntern.email && (
                      <div className="detail-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <span>{selectedIntern.email}</span>
                      </div>
                    )}
                    {selectedIntern.university && (
                      <div className="detail-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                        </svg>
                        <span>{selectedIntern.university}</span>
                      </div>
                    )}
                    {selectedIntern.major && (
                      <div className="detail-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                        <span>{selectedIntern.major}</span>
                      </div>
                    )}
                  </div>
                  <div className="volunteer-detail-stats">
                    <div className="detail-stat-item">
                      <div className="detail-stat-value">{selectedIntern.totalTrainings || 0}</div>
                      <div className="detail-stat-label">{isRTL ? 'فترات تدريب' : 'Trainings'}</div>
                    </div>
                    <div className="detail-stat-item">
                      <div className="detail-stat-value">{selectedIntern.totalHours || 0}</div>
                      <div className="detail-stat-label">{isRTL ? 'ساعة' : 'Hours'}</div>
                    </div>
                    <div className="detail-stat-item">
                      <div className={`detail-stat-value ${(selectedIntern.totalPoints || 0) > 0 ? 'positive' : (selectedIntern.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                        {(selectedIntern.totalPoints || 0) > 0 ? '+' : ''}{selectedIntern.totalPoints || 0}
                      </div>
                      <div className="detail-stat-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</div>
                    </div>
                  </div>
                </div>

                {/* Points Breakdown */}
                {(selectedIntern.totalAwards > 0 || selectedIntern.totalDeductions > 0) && (
                  <div className="points-breakdown">
                    <span className="points-award">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      +{selectedIntern.totalAwards || 0} {isRTL ? 'منح' : 'awards'}
                    </span>
                    <span className="points-deduction">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      -{selectedIntern.totalDeductions || 0} {isRTL ? 'خصم' : 'deductions'}
                    </span>
                  </div>
                )}

                {/* Ratings History */}
                {selectedIntern.ratings && selectedIntern.ratings.length > 0 && (
                  <div className="ratings-history-list">
                    <h4>{isRTL ? 'سجل التقييمات' : 'Ratings History'}</h4>
                    {selectedIntern.ratings.map(rating => (
                      <div key={rating.ratingId} className="rating-history-item">
                        <span className={`rating-points ${rating.type}`}>
                          {rating.type === 'award' ? '+' : '-'}{rating.points}
                        </span>
                        <span className="rating-criteria">{rating.criteria}</span>
                        <span className="rating-date">{rating.ratingDate}</span>
                        <button
                          className="delete-rating-btn"
                          onClick={() => handleDeleteInternRating(rating.ratingId)}
                          title={isRTL ? 'حذف' : 'Delete'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trainings list */}
                <div className="opportunities-section">
                  <h4>{isRTL ? 'فترات التدريب' : 'Training Periods'}</h4>
                  {(!selectedIntern.trainings || selectedIntern.trainings.length === 0) ? (
                    <p className="no-opportunities">{isRTL ? 'لا توجد فترات تدريب مسجلة' : 'No trainings recorded'}</p>
                  ) : (
                    <div className="opportunities-list">
                      {selectedIntern.trainings.map(training => (
                        <div key={training.trainingId} className="opportunity-item">
                          <div className="opportunity-info">
                            <h5>{training.title}</h5>
                            <div className="opportunity-dates">
                              <span>{training.startDate}</span>
                              <span>→</span>
                              <span>{training.endDate}</span>
                            </div>
                            <div className="opportunity-meta">
                              <span className="hours">{training.totalHours || 0} {isRTL ? 'ساعة' : 'hours'}</span>
                              <span className={`status ${training.status}`}>{training.status}</span>
                            </div>
                          </div>
                          <div className="opportunity-actions">
                            <button
                              className="rate-opportunity-btn"
                              onClick={() => handleOpenInternRating(selectedIntern, training)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                              </svg>
                              {isRTL ? 'تقييم' : 'Rate'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="modal-btn delete"
                  onClick={() => handleDeleteIntern(selectedIntern.internId)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  {isRTL ? 'حذف المتدرب' : 'Delete Intern'}
                </button>
                <button
                  className="modal-btn export"
                  onClick={() => handleExportInternHistory(selectedIntern)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {isRTL ? 'تصدير السجل' : 'Export History'}
                </button>
                <button className="modal-btn cancel" onClick={() => setShowInternDetailModal(false)}>
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Intern Rating Modal */}
        {showInternRatingModal && selectedIntern && (
          <div className="modal-overlay" onClick={() => setShowInternRatingModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'تقييم المتدرب' : 'Rate Intern'}</h2>
                <button className="close-btn" onClick={() => setShowInternRatingModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="opportunity-info-summary">
                  <h4>{selectedIntern.name}</h4>
                  {selectedTraining && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {isRTL ? 'تدريب: ' : 'Training: '}{selectedTraining.title}
                    </p>
                  )}
                </div>

                {/* Rating Type Toggle (Award/Deduction) */}
                <div className="form-group">
                  <label>{isRTL ? 'نوع التقييم' : 'Rating Type'}</label>
                  <div className="rating-type-toggle">
                    <button
                      type="button"
                      className={`rating-type-btn award ${internRatingForm.type === 'award' ? 'active' : ''}`}
                      onClick={() => setInternRatingForm(prev => ({ ...prev, type: 'award' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      <span>{isRTL ? 'منح نقاط' : 'Award'}</span>
                    </button>
                    <button
                      type="button"
                      className={`rating-type-btn deduction ${internRatingForm.type === 'deduction' ? 'active' : ''}`}
                      onClick={() => setInternRatingForm(prev => ({ ...prev, type: 'deduction' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      <span>{isRTL ? 'خصم نقاط' : 'Deduction'}</span>
                    </button>
                  </div>
                </div>

                {/* Points Selector (1-5) */}
                <div className="form-group">
                  <label>{isRTL ? 'عدد النقاط' : 'Number of Points'}</label>
                  <div className="points-selector">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        className={`point-btn ${internRatingForm.points === num ? 'active' : ''} ${internRatingForm.type}`}
                        onClick={() => setInternRatingForm(prev => ({ ...prev, points: num }))}
                      >
                        {internRatingForm.type === 'deduction' ? `-${num}` : `+${num}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'المعيار' : 'Criteria'}</label>
                  <select
                    value={internRatingForm.criteria}
                    onChange={(e) => setInternRatingForm(prev => ({ ...prev, criteria: e.target.value }))}
                    className="criteria-select"
                  >
                    {criteriaOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'التاريخ' : 'Date'}</label>
                  <input
                    type="date"
                    value={internRatingForm.ratingDate}
                    onChange={(e) => setInternRatingForm(prev => ({ ...prev, ratingDate: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                  <textarea
                    value={internRatingForm.notes}
                    onChange={(e) => setInternRatingForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={isRTL ? 'ملاحظات إضافية (اختياري)' : 'Additional notes (optional)'}
                    rows="3"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowInternRatingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateInternRating}
                  disabled={internLoading}
                >
                  {internLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التقييم' : 'Save Rating')}
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
