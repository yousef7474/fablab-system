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

// Helper function to format time as AM/PM
const formatTimeAMPM = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Valid tabs for URL persistence
  const validTabs = ['schedule', 'tasks', 'employees', 'todos', 'workspaces', 'ratings', 'volunteers', 'interns', 'settings'];

  // Get initial tab from URL, localStorage, or default to 'schedule'
  const getInitialTab = () => {
    const tabFromUrl = searchParams.get('tab');
    if (validTabs.includes(tabFromUrl)) return tabFromUrl;
    const savedTab = localStorage.getItem('managerActiveTab');
    if (validTabs.includes(savedTab)) return savedTab;
    return 'schedule';
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
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Start with sidebar open on desktop, closed on mobile
    if (typeof window !== 'undefined') {
      return window.innerWidth > 768;
    }
    return true;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('adminTheme') || 'light');

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
    dueTimeEnd: '', // End time for time blocking
    blocksCalendar: false, // Whether to block customer appointments
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
    volunteerIds: [], // For multi-volunteer selection
    selectAllVolunteers: false,
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    dailyHours: 8,
    rating: 0,
    ratingCriteria: '',
    ratingNotes: ''
  });
  const [showHoursAdjustModal, setShowHoursAdjustModal] = useState(false);
  const [hoursAdjustForm, setHoursAdjustForm] = useState({
    opportunityId: '',
    adjustment: 0,
    reason: ''
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

  // Employee management state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    email: '',
    section: ''
  });

  // Manager Todo state
  const [myTodos, setMyTodos] = useState([]);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [todoLoading, setTodoLoading] = useState(false);
  const [todoForm, setTodoForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'medium'
  });
  // Todo calendar state
  const [todoCalendarDate, setTodoCalendarDate] = useState(new Date());
  const [selectedTodoDay, setSelectedTodoDay] = useState(null);

  // Workspace state
  const [workspaces, setWorkspaces] = useState([]);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showWorkspaceRatingModal, setShowWorkspaceRatingModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState({
    tableNumber: '',
    numberOfUsers: 1,
    personName: '',
    personPhone: '',
    personEmail: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    photoBefore: '',
    notes: ''
  });
  const [workspaceRatingForm, setWorkspaceRatingForm] = useState({
    type: 'award',
    points: 1,
    criteria: '',
    notes: '',
    ratingDate: new Date().toISOString().split('T')[0]
  });
  const [workspaceStats, setWorkspaceStats] = useState({
    totalWorkspaces: 0,
    activeWorkspaces: 0,
    completedWorkspaces: 0,
    todayWorkspaces: 0
  });

  // Workspace rating criteria options
  const workspaceCriteriaOptions = [
    { value: '', label: isRTL ? 'اختر المعيار' : 'Select Criteria' },
    { value: 'cleanliness', label: isRTL ? 'النظافة' : 'Cleanliness' },
    { value: 'equipment_care', label: isRTL ? 'العناية بالمعدات' : 'Equipment Care' },
    { value: 'time_management', label: isRTL ? 'إدارة الوقت' : 'Time Management' },
    { value: 'safety_compliance', label: isRTL ? 'الالتزام بالسلامة' : 'Safety Compliance' },
    { value: 'workspace_organization', label: isRTL ? 'تنظيم مساحة العمل' : 'Workspace Organization' },
    { value: 'resource_usage', label: isRTL ? 'استخدام الموارد' : 'Resource Usage' },
    { value: 'cooperation', label: isRTL ? 'التعاون' : 'Cooperation' },
    { value: 'rule_compliance', label: isRTL ? 'الالتزام بالقواعد' : 'Rule Compliance' },
    { value: 'other', label: isRTL ? 'أخرى' : 'Other' }
  ];

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

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

  // Sync URL with active tab and save to localStorage
  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('managerActiveTab', activeTab);

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

  // Fetch manager's personal todos
  const fetchMyTodos = useCallback(async () => {
    try {
      const response = await api.get('/manager-todos');
      setMyTodos(response.data || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  }, []);

  // Employee CRUD operations
  const handleCreateEmployee = async () => {
    if (!employeeForm.name || !employeeForm.email) {
      toast.error(isRTL ? 'الاسم والبريد الإلكتروني مطلوبان' : 'Name and email are required');
      return;
    }

    setEmployeeLoading(true);
    try {
      await api.post('/admin/employees', employeeForm);
      toast.success(isRTL ? 'تم إضافة الموظف بنجاح' : 'Employee added successfully');
      fetchEmployees();
      setShowEmployeeModal(false);
      setEmployeeForm({ name: '', email: '', section: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || (isRTL ? 'خطأ في إضافة الموظف' : 'Error adding employee'));
    } finally {
      setEmployeeLoading(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return;

    setEmployeeLoading(true);
    try {
      await api.put(`/admin/employees/${selectedEmployee.employeeId}`, employeeForm);
      toast.success(isRTL ? 'تم تحديث الموظف بنجاح' : 'Employee updated successfully');
      fetchEmployees();
      setShowEmployeeModal(false);
      setSelectedEmployee(null);
      setEmployeeForm({ name: '', email: '', section: '' });
    } catch (error) {
      toast.error(isRTL ? 'خطأ في تحديث الموظف' : 'Error updating employee');
    } finally {
      setEmployeeLoading(false);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا الموظف؟' : 'Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      await api.delete(`/admin/employees/${employeeId}`);
      toast.success(isRTL ? 'تم حذف الموظف بنجاح' : 'Employee deleted successfully');
      fetchEmployees();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في حذف الموظف' : 'Error deleting employee');
    }
  };

  const openEmployeeModal = (employee = null) => {
    if (employee) {
      setSelectedEmployee(employee);
      setEmployeeForm({
        name: employee.name || '',
        email: employee.email || '',
        section: employee.section || ''
      });
    } else {
      setSelectedEmployee(null);
      setEmployeeForm({ name: '', email: '', section: '' });
    }
    setShowEmployeeModal(true);
  };

  // Manager Todo CRUD operations
  const handleCreateTodo = async () => {
    if (!todoForm.title) {
      toast.error(isRTL ? 'العنوان مطلوب' : 'Title is required');
      return;
    }

    setTodoLoading(true);
    try {
      await api.post('/manager-todos', todoForm);
      toast.success(isRTL ? 'تم إضافة المهمة بنجاح' : 'Todo added successfully');
      fetchMyTodos();
      setShowTodoModal(false);
      setTodoForm({ title: '', description: '', dueDate: '', priority: 'medium' });
    } catch (error) {
      toast.error(isRTL ? 'خطأ في إضافة المهمة' : 'Error adding todo');
    } finally {
      setTodoLoading(false);
    }
  };

  const handleUpdateTodo = async () => {
    if (!selectedTodo) return;

    setTodoLoading(true);
    try {
      await api.put(`/manager-todos/${selectedTodo.todoId}`, todoForm);
      toast.success(isRTL ? 'تم تحديث المهمة بنجاح' : 'Todo updated successfully');
      fetchMyTodos();
      setShowTodoModal(false);
      setSelectedTodo(null);
      setTodoForm({ title: '', description: '', dueDate: '', priority: 'medium' });
    } catch (error) {
      toast.error(isRTL ? 'خطأ في تحديث المهمة' : 'Error updating todo');
    } finally {
      setTodoLoading(false);
    }
  };

  const handleToggleTodoStatus = async (todoId) => {
    try {
      await api.patch(`/manager-todos/${todoId}/toggle`);
      fetchMyTodos();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في تحديث حالة المهمة' : 'Error updating todo status');
    }
  };

  const handleDeleteTodo = async (todoId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذه المهمة؟' : 'Are you sure you want to delete this todo?')) {
      return;
    }

    try {
      await api.delete(`/manager-todos/${todoId}`);
      toast.success(isRTL ? 'تم حذف المهمة بنجاح' : 'Todo deleted successfully');
      fetchMyTodos();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في حذف المهمة' : 'Error deleting todo');
    }
  };

  const openTodoModal = (todo = null) => {
    if (todo) {
      setSelectedTodo(todo);
      setTodoForm({
        title: todo.title || '',
        description: todo.description || '',
        dueDate: todo.dueDate || '',
        priority: todo.priority || 'medium'
      });
    } else {
      setSelectedTodo(null);
      setTodoForm({ title: '', description: '', dueDate: '', priority: 'medium' });
    }
    setShowTodoModal(true);
  };

  // Workspace CRUD operations
  const fetchWorkspaces = useCallback(async () => {
    try {
      const response = await api.get('/workspaces');
      setWorkspaces(response.data || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  }, []);

  const fetchWorkspaceStats = useCallback(async () => {
    try {
      const response = await api.get('/workspaces/statistics');
      setWorkspaceStats(response.data);
    } catch (error) {
      console.error('Error fetching workspace stats:', error);
    }
  }, []);

  const handleCreateWorkspace = async () => {
    if (!workspaceForm.tableNumber || !workspaceForm.personName || !workspaceForm.startDate || !workspaceForm.endDate) {
      toast.error(isRTL ? 'رقم الطاولة والاسم والفترة مطلوبة' : 'Table number, name, and period are required');
      return;
    }

    setWorkspaceLoading(true);
    try {
      await api.post('/workspaces', workspaceForm);
      toast.success(isRTL ? 'تم إضافة مساحة العمل بنجاح' : 'Workspace added successfully');
      fetchWorkspaces();
      fetchWorkspaceStats();
      setShowWorkspaceModal(false);
      setWorkspaceForm({
        tableNumber: '', numberOfUsers: 1, personName: '', personPhone: '', personEmail: '',
        startDate: '', startTime: '', endDate: '', endTime: '', photoBefore: '', notes: ''
      });
    } catch (error) {
      toast.error(isRTL ? 'خطأ في إضافة مساحة العمل' : 'Error adding workspace');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleUpdateWorkspace = async () => {
    if (!selectedWorkspace) return;

    setWorkspaceLoading(true);
    try {
      await api.put(`/workspaces/${selectedWorkspace.workspaceId}`, workspaceForm);
      toast.success(isRTL ? 'تم تحديث مساحة العمل بنجاح' : 'Workspace updated successfully');
      fetchWorkspaces();
      setShowWorkspaceModal(false);
      setSelectedWorkspace(null);
    } catch (error) {
      toast.error(isRTL ? 'خطأ في تحديث مساحة العمل' : 'Error updating workspace');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleDeleteWorkspace = async (workspaceId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف مساحة العمل هذه؟' : 'Are you sure you want to delete this workspace?')) {
      return;
    }

    try {
      await api.delete(`/workspaces/${workspaceId}`);
      toast.success(isRTL ? 'تم حذف مساحة العمل بنجاح' : 'Workspace deleted successfully');
      fetchWorkspaces();
      fetchWorkspaceStats();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في حذف مساحة العمل' : 'Error deleting workspace');
    }
  };

  const handleCompleteWorkspace = async (workspaceId) => {
    try {
      await api.patch(`/workspaces/${workspaceId}/complete`);
      toast.success(isRTL ? 'تم تحديد مساحة العمل كمكتملة' : 'Workspace marked as completed');
      fetchWorkspaces();
      fetchWorkspaceStats();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في تحديث مساحة العمل' : 'Error updating workspace');
    }
  };

  const openWorkspaceModal = (workspace = null) => {
    if (workspace) {
      setSelectedWorkspace(workspace);
      setWorkspaceForm({
        tableNumber: workspace.tableNumber || '',
        numberOfUsers: workspace.numberOfUsers || 1,
        personName: workspace.personName || '',
        personPhone: workspace.personPhone || '',
        personEmail: workspace.personEmail || '',
        startDate: workspace.startDate || '',
        startTime: workspace.startTime || '',
        endDate: workspace.endDate || '',
        endTime: workspace.endTime || '',
        photoBefore: workspace.photoBefore || '',
        notes: workspace.notes || ''
      });
    } else {
      setSelectedWorkspace(null);
      setWorkspaceForm({
        tableNumber: '', numberOfUsers: 1, personName: '', personPhone: '', personEmail: '',
        startDate: '', startTime: '', endDate: '', endTime: '', photoBefore: '', notes: ''
      });
    }
    setShowWorkspaceModal(true);
  };

  const handleAddWorkspaceRating = async () => {
    const criteria = workspaceRatingForm.criteria === 'other'
      ? workspaceRatingForm.customCriteria
      : workspaceRatingForm.criteria;

    if (!selectedWorkspace || !criteria || !workspaceRatingForm.points) {
      toast.error(isRTL ? 'المعيار والنقاط مطلوبة' : 'Criteria and points are required');
      return;
    }

    setWorkspaceLoading(true);
    try {
      const ratingData = {
        ...workspaceRatingForm,
        criteria: criteria
      };
      delete ratingData.customCriteria;

      await api.post(`/workspaces/${selectedWorkspace.workspaceId}/ratings`, ratingData);
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      fetchWorkspaces();
      setShowWorkspaceRatingModal(false);
      setWorkspaceRatingForm({
        type: 'award', points: 1, criteria: '', notes: '',
        ratingDate: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      toast.error(isRTL ? 'خطأ في إضافة التقييم' : 'Error adding rating');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const openWorkspaceRatingModal = (workspace) => {
    setSelectedWorkspace(workspace);
    setWorkspaceRatingForm({
      type: 'award', points: 1, criteria: '', notes: '',
      ratingDate: new Date().toISOString().split('T')[0]
    });
    setShowWorkspaceRatingModal(true);
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchSchedule(), fetchEmployees(), fetchMyTodos(), fetchWorkspaces(), fetchWorkspaceStats()]);
      setLoading(false);
    };
    if (managerData) {
      loadData();
    }
  }, [managerData, fetchSchedule, fetchEmployees, fetchMyTodos, fetchWorkspaces, fetchWorkspaceStats]);

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

  // Todo calendar helpers
  const getTodoDaysInMonth = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  const getTodosForDay = (day) => {
    return myTodos.filter(todo => {
      if (!todo.dueDate) return false;
      try {
        const todoDate = typeof todo.dueDate === 'string' ? parseISO(todo.dueDate) : todo.dueDate;
        return isSameDay(todoDate, day);
      } catch {
        return false;
      }
    });
  };

  const handleTodoPrevMonth = () => setTodoCalendarDate(subMonths(todoCalendarDate, 1));
  const handleTodoNextMonth = () => setTodoCalendarDate(addMonths(todoCalendarDate, 1));

  // Task CRUD operations
  const handleCreateTask = async () => {
    const hasValidEmployee = taskForm.selectAllEmployees || taskForm.employeeIds.length > 0;
    if (!taskForm.title || !hasValidEmployee || !taskForm.dueDate) {
      toast.error(isRTL ? 'العنوان والموظف والتاريخ مطلوبة' : 'Title, employee, and date are required');
      return;
    }

    setTaskLoading(true);
    try {
      // Get list of employees to assign
      const employeeIds = taskForm.selectAllEmployees
        ? employees.map(emp => emp.employeeId)
        : taskForm.employeeIds;

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
          dueTimeEnd: taskForm.dueTimeEnd || null,
          blocksCalendar: taskForm.blocksCalendar,
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
    const hasValidVolunteer = opportunityForm.selectAllVolunteers || opportunityForm.volunteerIds.length > 0;
    if (!hasValidVolunteer || !opportunityForm.title || !opportunityForm.startDate || !opportunityForm.endDate) {
      toast.error(isRTL ? 'المتطوع والعنوان والتاريخ مطلوبة' : 'Volunteer, title, and dates are required');
      return;
    }

    setVolunteerLoading(true);
    try {
      // Get list of volunteers to assign
      const volunteerIds = opportunityForm.selectAllVolunteers
        ? volunteers.map(v => v.volunteerId)
        : opportunityForm.volunteerIds;

      // Create opportunity for each volunteer
      const promises = volunteerIds.map(volunteerId =>
        api.post('/volunteers/opportunities', {
          ...opportunityForm,
          volunteerId
        })
      );

      await Promise.all(promises);
      toast.success(isRTL
        ? `تم إضافة فرصة التطوع لـ ${volunteerIds.length} متطوع بنجاح`
        : `Opportunity added to ${volunteerIds.length} volunteer(s) successfully`);
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

  const handleOpenHoursAdjust = (opportunity) => {
    setHoursAdjustForm({
      opportunityId: opportunity.opportunityId,
      adjustment: 0,
      reason: ''
    });
    setShowHoursAdjustModal(true);
  };

  const handleAdjustHours = async () => {
    if (hoursAdjustForm.adjustment === 0) {
      toast.error(isRTL ? 'يرجى إدخال قيمة التعديل' : 'Please enter an adjustment value');
      return;
    }
    try {
      await api.patch(`/volunteers/opportunities/${hoursAdjustForm.opportunityId}/hours`, {
        adjustment: hoursAdjustForm.adjustment,
        reason: hoursAdjustForm.reason
      });
      toast.success(isRTL ? 'تم تعديل الساعات بنجاح' : 'Hours adjusted successfully');
      setShowHoursAdjustModal(false);
      fetchVolunteers();
      // Refresh selected volunteer data
      if (selectedVolunteer) {
        const updated = volunteers.find(v => v.volunteerId === selectedVolunteer.volunteerId);
        if (updated) setSelectedVolunteer(updated);
      }
    } catch (error) {
      console.error('Error adjusting hours:', error);
      toast.error(isRTL ? 'خطأ في تعديل الساعات' : 'Error adjusting hours');
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
      volunteerIds: [],
      selectAllVolunteers: false,
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
    <div className="admin-layout" data-page="manager" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Mobile Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="FABLAB" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          </div>
          {sidebarOpen && <span className="sidebar-title">{isRTL ? 'لوحة المدير' : 'Manager'}</span>}
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => { setActiveTab('schedule'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'الجدول' : 'Schedule'}</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => { setActiveTab('tasks'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'المهام' : 'Tasks'}</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => { setActiveTab('employees'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'الموظفين' : 'Employees'}</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'todos' ? 'active' : ''}`}
            onClick={() => { setActiveTab('todos'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/>
              <line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/>
              <line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'مهامي' : 'My Tasks'}</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'workspaces' ? 'active' : ''}`}
            onClick={() => { setActiveTab('workspaces'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'مساحات العمل' : 'Workspaces'}</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'ratings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('ratings'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'تقييم الموظفين' : 'Ratings'}</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'volunteers' ? 'active' : ''}`}
            onClick={() => { setActiveTab('volunteers'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'المتطوعين' : 'Volunteers'}</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'interns' ? 'active' : ''}`}
            onClick={() => { setActiveTab('interns'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'تدريب جامعي' : 'Training'}</span>}
          </button>
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); if (window.innerWidth <= 768) setSidebarOpen(false); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'الإعدادات' : 'Settings'}</span>}
          </button>

          {/* Elite Dashboard Button */}
          <button
            className="nav-item elite-nav-btn"
            onClick={() => navigate('/elite-dashboard')}
            style={{
              background: 'linear-gradient(135deg, #006c35, #00a651)',
              color: 'white',
              marginTop: '8px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'لوحة النخبة' : 'Elite'}</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {sidebarOpen && <span>{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <div className="header-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="header-title">
              <h1>{activeTab === 'schedule'
              ? (isRTL ? 'الجدول' : 'Schedule')
              : activeTab === 'tasks'
              ? (isRTL ? 'المهام' : 'Tasks')
              : activeTab === 'employees'
              ? (isRTL ? 'الموظفين' : 'Employees')
              : activeTab === 'todos'
              ? (isRTL ? 'مهامي' : 'My Tasks')
              : activeTab === 'workspaces'
              ? (isRTL ? 'مساحات العمل' : 'Workspaces')
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
              : activeTab === 'employees'
              ? (isRTL ? 'إدارة الموظفين وبياناتهم' : 'Manage employees and their data')
              : activeTab === 'todos'
              ? (isRTL ? 'قائمة مهامي الشخصية' : 'My personal task list')
              : activeTab === 'workspaces'
              ? (isRTL ? 'إدارة مساحات العمل للعملاء' : 'Manage customer workspaces')
              : activeTab === 'ratings'
              ? (isRTL ? 'إعطاء نقاط للموظفين وتصدير التقارير' : 'Give points to employees and export reports')
              : activeTab === 'volunteers'
              ? (isRTL ? 'إدارة المتطوعين وفرص التطوع' : 'Manage volunteers and opportunities')
              : activeTab === 'interns'
              ? (isRTL ? 'إدارة طلاب التدريب الصيفي الجامعي' : 'Manage university summer training interns')
              : (isRTL ? 'إدارة إعدادات الحساب واللغة' : 'Manage account and language settings')
            }</p>
            </div>
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
              <button className="calendar-nav" onClick={handlePrevMonth}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points={isRTL ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/>
                </svg>
              </button>
              <h3>
                {format(selectedDate, 'MMMM yyyy', { locale: isRTL ? ar : enUS })}
              </h3>
              <button className="calendar-nav" onClick={handleNextMonth}>
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

            {/* Calendar Days */}
            <div className="calendar-days">
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
                      <div className="event-dots">
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
                          {event.startTime && <span>🕐 {formatTimeAMPM(event.startTime)}{event.endTime && ` - ${formatTimeAMPM(event.endTime)}`}{event.duration && ` (${event.duration} ${isRTL ? 'د' : 'min'})`}</span>}
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
                        {task.startTime && ` • ${formatTimeAMPM(task.startTime)}`}
                        {task.duration && ` (${task.duration} ${isRTL ? 'د' : 'min'})`}
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
                      <button
                        className="delete-volunteer-btn"
                        onClick={() => handleDeleteVolunteer(volunteer.volunteerId)}
                        title={isRTL ? 'حذف المتطوع' : 'Delete Volunteer'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        {isRTL ? 'حذف' : 'Delete'}
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
              className="modal-content modern-modal volunteer-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="modern-modal-header volunteer-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'متطوع جديد' : 'New Volunteer'}</h2>
                  <p>{isRTL ? 'تسجيل متطوع جديد في النظام' : 'Register a new volunteer'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowVolunteerModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{isRTL ? 'المعلومات الشخصية' : 'Personal Information'}</span>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'الاسم' : 'Name'} <span className="required">*</span></label>
                    <div className="input-with-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        value={volunteerForm.name}
                        onChange={(e) => setVolunteerForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
                        className="modern-input-field"
                      />
                    </div>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'رقم الهوية' : 'National ID'} <span className="required">*</span></label>
                    <div className="input-with-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="16" rx="2"/>
                        <line x1="7" y1="8" x2="17" y2="8"/>
                        <line x1="7" y1="12" x2="13" y2="12"/>
                      </svg>
                      <input
                        type="text"
                        value={volunteerForm.nationalId}
                        onChange={(e) => setVolunteerForm(prev => ({ ...prev, nationalId: e.target.value }))}
                        placeholder={isRTL ? 'رقم الهوية الوطنية' : 'National ID number'}
                        className="modern-input-field"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'رقم الجوال' : 'Phone'} <span className="required">*</span></label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <input
                          type="tel"
                          value={volunteerForm.phone}
                          onChange={(e) => setVolunteerForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="05xxxxxxxx"
                          className="modern-input-field"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <input
                          type="email"
                          value={volunteerForm.email}
                          onChange={(e) => setVolunteerForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="email@example.com"
                          className="modern-input-field"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>{isRTL ? 'صورة الهوية' : 'ID Photo'}</span>
                  </div>
                  <div className="photo-upload-area modern-upload">
                    {volunteerForm.nationalIdPhoto ? (
                      <div className="photo-preview">
                        <img src={volunteerForm.nationalIdPhoto} alt="ID" />
                        <button
                          className="remove-photo-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVolunteerForm(prev => ({ ...prev, nationalIdPhoto: '' }));
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <label className="photo-upload-label">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleVolunteerPhotoUpload}
                          style={{ display: 'none' }}
                        />
                        <div className="upload-content">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          <span className="upload-text">{isRTL ? 'انقر لرفع صورة الهوية' : 'Click to upload ID photo'}</span>
                          <span className="upload-hint">{isRTL ? 'PNG, JPG حتى 5MB' : 'PNG, JPG up to 5MB'}</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowVolunteerModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit volunteer-submit"
                  onClick={handleCreateVolunteer}
                  disabled={volunteerLoading || !volunteerForm.name || !volunteerForm.nationalId || !volunteerForm.phone}
                >
                  {volunteerLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'إضافة متطوع' : 'Add Volunteer'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Opportunity Modal */}
        {showOpportunityModal && (
          <div className="modal-overlay" onClick={() => setShowOpportunityModal(false)}>
            <motion.div
              className="modal-content modern-modal opportunity-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="modern-modal-header opportunity-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="18"/>
                    <line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'فرصة تطوع جديدة' : 'New Opportunity'}</h2>
                  <p>{isRTL ? 'إنشاء فرصة تطوع للمتطوعين' : 'Create a volunteer opportunity'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowOpportunityModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span>{isRTL ? 'اختيار المتطوعين' : 'Select Volunteers'}</span>
                  </div>
                  <div className="select-all-toggle">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={opportunityForm.selectAllVolunteers}
                        onChange={(e) => {
                          const selectAll = e.target.checked;
                          setOpportunityForm(prev => ({
                            ...prev,
                            selectAllVolunteers: selectAll,
                            volunteerIds: selectAll ? volunteers.map(v => v.volunteerId) : []
                          }));
                        }}
                        className="toggle-checkbox"
                      />
                      <span className="toggle-switch"></span>
                      <span className="toggle-text">{isRTL ? 'تعيين لجميع المتطوعين' : 'Assign to all volunteers'}</span>
                    </label>
                  </div>
                  {!opportunityForm.selectAllVolunteers && (
                    <div className="volunteer-checkbox-list modern-list">
                      {volunteers.map(v => (
                        <label key={v.volunteerId} className={`volunteer-checkbox-item modern ${opportunityForm.volunteerIds.includes(v.volunteerId) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={opportunityForm.volunteerIds.includes(v.volunteerId)}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const newVolunteerIds = isChecked
                                ? [...opportunityForm.volunteerIds, v.volunteerId]
                                : opportunityForm.volunteerIds.filter(id => id !== v.volunteerId);
                              setOpportunityForm(prev => ({
                                ...prev,
                                volunteerIds: newVolunteerIds,
                                volunteerId: newVolunteerIds.length === 1 ? newVolunteerIds[0] : ''
                              }));
                            }}
                          />
                          <div className="volunteer-checkbox-avatar">
                            {v.name?.charAt(0) || 'V'}
                          </div>
                          <div className="volunteer-checkbox-info">
                            <span className="volunteer-checkbox-name">{v.name}</span>
                            <span className="volunteer-checkbox-id">{v.nationalId}</span>
                          </div>
                          <div className="checkbox-indicator">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {!opportunityForm.selectAllVolunteers && opportunityForm.volunteerIds.length > 0 && (
                    <div className="selected-count-badge">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                      </svg>
                      {isRTL
                        ? `تم تحديد ${opportunityForm.volunteerIds.length} متطوع`
                        : `${opportunityForm.volunteerIds.length} volunteer${opportunityForm.volunteerIds.length > 1 ? 's' : ''} selected`}
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span>{isRTL ? 'تفاصيل الفرصة' : 'Opportunity Details'}</span>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'عنوان الفرصة' : 'Opportunity Title'} <span className="required">*</span></label>
                    <input
                      type="text"
                      value={opportunityForm.title}
                      onChange={(e) => setOpportunityForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder={isRTL ? 'عنوان فرصة التطوع' : 'Opportunity title'}
                      className="modern-input-field"
                    />
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'الوصف' : 'Description'}</label>
                    <textarea
                      value={opportunityForm.description}
                      onChange={(e) => setOpportunityForm(prev => ({ ...prev, description: e.target.value }))}
                      rows="3"
                      placeholder={isRTL ? 'وصف فرصة التطوع...' : 'Opportunity description...'}
                      className="modern-textarea"
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{isRTL ? 'فترة التطوع' : 'Volunteer Period'}</span>
                  </div>
                  <div className="period-grid">
                    <div className="period-box start">
                      <span className="period-label">{isRTL ? 'البداية' : 'Start'}</span>
                      <input
                        type="date"
                        value={opportunityForm.startDate}
                        onChange={(e) => setOpportunityForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="modern-input-field"
                      />
                    </div>
                    <div className={`period-arrow ${isRTL ? 'rtl' : ''}`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points={isRTL ? "12 5 5 12 12 19" : "12 5 19 12 12 19"}/>
                      </svg>
                    </div>
                    <div className="period-box end">
                      <span className="period-label">{isRTL ? 'النهاية' : 'End'}</span>
                      <input
                        type="date"
                        value={opportunityForm.endDate}
                        onChange={(e) => setOpportunityForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="modern-input-field"
                      />
                    </div>
                  </div>
                  <div className="form-group modern-input" style={{ marginTop: '1rem' }}>
                    <label>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {isRTL ? 'ساعات العمل اليومية' : 'Daily Hours'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={opportunityForm.dailyHours}
                      onChange={(e) => setOpportunityForm(prev => ({ ...prev, dailyHours: parseInt(e.target.value) || 8 }))}
                      className="modern-input-field"
                    />
                  </div>
                  {opportunityForm.startDate && opportunityForm.endDate && (
                    <div className="total-hours-display">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span>{isRTL ? 'إجمالي الساعات' : 'Total Hours'}</span>
                      <strong>{calculateTotalHours(opportunityForm.startDate, opportunityForm.endDate, opportunityForm.dailyHours)}</strong>
                    </div>
                  )}
                </div>

                <div className="info-note-modern">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <p>
                    {isRTL
                      ? 'ملاحظة: يمكنك تقييم المتطوع بعد انتهاء فرصة التطوع'
                      : 'Note: You can rate the volunteer after the opportunity is completed'}
                  </p>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowOpportunityModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit opportunity-submit"
                  onClick={handleCreateOpportunity}
                  disabled={volunteerLoading || (!opportunityForm.selectAllVolunteers && opportunityForm.volunteerIds.length === 0) || !opportunityForm.title || !opportunityForm.startDate || !opportunityForm.endDate}
                >
                  {volunteerLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'إنشاء فرصة التطوع' : 'Create Opportunity'}
                    </>
                  )}
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
                            <span className="hours-display">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                              </svg>
                              {(opp.totalHours || 0) + (opp.hoursAdjustment || 0)} {isRTL ? 'ساعة' : 'hours'}
                              {opp.hoursAdjustment !== 0 && opp.hoursAdjustment && (
                                <span className={`hours-adjustment ${opp.hoursAdjustment > 0 ? 'positive' : 'negative'}`}>
                                  ({opp.hoursAdjustment > 0 ? '+' : ''}{opp.hoursAdjustment})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="history-actions">
                            <button
                              className="adjust-hours-btn"
                              onClick={() => handleOpenHoursAdjust(opp)}
                              title={isRTL ? 'تعديل الساعات' : 'Adjust Hours'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="8" y1="12" x2="16" y2="12"/>
                              </svg>
                              {isRTL ? 'تعديل الساعات' : 'Adjust Hours'}
                            </button>
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

        {/* Hours Adjustment Modal */}
        {showHoursAdjustModal && (
          <div className="modal-overlay" onClick={() => setShowHoursAdjustModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'تعديل ساعات التطوع' : 'Adjust Volunteering Hours'}</h2>
                <button className="close-btn" onClick={() => setShowHoursAdjustModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{isRTL ? 'قيمة التعديل (ساعات)' : 'Adjustment Value (hours)'}</label>
                  <div className="hours-adjustment-input">
                    <button
                      type="button"
                      className="adjust-btn decrease"
                      onClick={() => setHoursAdjustForm(prev => ({ ...prev, adjustment: prev.adjustment - 1 }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                    <input
                      type="number"
                      value={hoursAdjustForm.adjustment}
                      onChange={(e) => setHoursAdjustForm(prev => ({ ...prev, adjustment: parseFloat(e.target.value) || 0 }))}
                      className="adjustment-value-input"
                    />
                    <button
                      type="button"
                      className="adjust-btn increase"
                      onClick={() => setHoursAdjustForm(prev => ({ ...prev, adjustment: prev.adjustment + 1 }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  </div>
                  <small className="adjustment-hint">
                    {isRTL ? 'أدخل رقم موجب للزيادة أو سالب للنقصان' : 'Enter positive number to add or negative to subtract hours'}
                  </small>
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'سبب التعديل' : 'Reason for Adjustment'}</label>
                  <textarea
                    value={hoursAdjustForm.reason}
                    onChange={(e) => setHoursAdjustForm(prev => ({ ...prev, reason: e.target.value }))}
                    rows="3"
                    placeholder={isRTL ? 'أدخل سبب تعديل الساعات...' : 'Enter reason for hours adjustment...'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowHoursAdjustModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleAdjustHours}
                  disabled={hoursAdjustForm.adjustment === 0}
                >
                  {isRTL ? 'حفظ التعديل' : 'Save Adjustment'}
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
                  <span className="stat-value">{Math.max(0, interns.reduce((sum, i) => sum + (i.totalHours || 0), 0))}</span>
                  <span className="stat-label">{isRTL ? 'ساعة' : 'Hours'}</span>
                </div>
              </div>
            </div>

            <div className="volunteers-grid">
              {interns.map(intern => (
                <div key={intern.internId} className="volunteer-card">
                  <div className="volunteer-header">
                    <div className="volunteer-avatar">
                      {intern.name?.charAt(0) || 'I'}
                    </div>
                    <div className="volunteer-info">
                      <h3>{intern.name}</h3>
                      <p>{intern.phone}</p>
                      {intern.university && (
                        <p className="volunteer-university">{intern.university}</p>
                      )}
                      {intern.major && (
                        <p className="volunteer-major">{intern.major}</p>
                      )}
                    </div>
                  </div>
                  <div className="volunteer-stats">
                    <div className="stat-item">
                      <div className="stat-value">{intern.totalTrainings || 0}</div>
                      <div className="stat-label">{isRTL ? 'تدريب' : 'Trainings'}</div>
                    </div>
                    <div className="stat-item">
                      <div className="stat-value">{Math.max(0, intern.totalHours || 0)}</div>
                      <div className="stat-label">{isRTL ? 'ساعة' : 'Hours'}</div>
                    </div>
                    <div className="stat-item">
                      <div className={`stat-value ${(intern.totalPoints || 0) > 0 ? 'positive' : (intern.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                        {(intern.totalPoints || 0) > 0 ? '+' : ''}{intern.totalPoints || 0}
                      </div>
                      <div className="stat-label">{isRTL ? 'نقاط' : 'Net Points'}</div>
                    </div>
                  </div>
                  <div className="volunteer-card-actions">
                    <button
                      className="view-volunteer-btn"
                      onClick={() => {
                        setSelectedIntern(intern);
                        setShowInternDetailModal(true);
                      }}
                      title={isRTL ? 'عرض التفاصيل' : 'View Details'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      {isRTL ? 'عرض' : 'View'}
                    </button>
                    <button
                      className="rate-volunteer-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenInternRating(intern);
                      }}
                      title={isRTL ? 'تقييم' : 'Rate'}
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
              className="modal-content modern-modal intern-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="modern-modal-header intern-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'متدرب جديد' : 'New Intern'}</h2>
                  <p>{isRTL ? 'تسجيل متدرب جامعي جديد' : 'Register a new university intern'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowInternModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{isRTL ? 'المعلومات الشخصية' : 'Personal Information'}</span>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'الاسم' : 'Name'} <span className="required">*</span></label>
                    <div className="input-with-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        value={internForm.name}
                        onChange={(e) => setInternForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
                        className="modern-input-field"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'رقم الهوية' : 'National ID'} <span className="required">*</span></label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="16" rx="2"/>
                          <line x1="7" y1="8" x2="17" y2="8"/>
                          <line x1="7" y1="12" x2="13" y2="12"/>
                        </svg>
                        <input
                          type="text"
                          value={internForm.nationalId}
                          onChange={(e) => setInternForm(prev => ({ ...prev, nationalId: e.target.value }))}
                          placeholder={isRTL ? 'رقم الهوية' : 'ID number'}
                          className="modern-input-field"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'رقم الجوال' : 'Phone'} <span className="required">*</span></label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <input
                          type="text"
                          value={internForm.phone}
                          onChange={(e) => setInternForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="05xxxxxxxx"
                          className="modern-input-field"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                    <div className="input-with-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      <input
                        type="email"
                        value={internForm.email}
                        onChange={(e) => setInternForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder={isRTL ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}
                        className="modern-input-field"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                    <span>{isRTL ? 'المعلومات الأكاديمية' : 'Academic Information'}</span>
                  </div>
                  <div className="form-row">
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'الجامعة' : 'University'}</label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        <input
                          type="text"
                          value={internForm.university}
                          onChange={(e) => setInternForm(prev => ({ ...prev, university: e.target.value }))}
                          placeholder={isRTL ? 'اسم الجامعة' : 'University name'}
                          className="modern-input-field"
                        />
                      </div>
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'التخصص' : 'Major'}</label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                        <input
                          type="text"
                          value={internForm.major}
                          onChange={(e) => setInternForm(prev => ({ ...prev, major: e.target.value }))}
                          placeholder={isRTL ? 'التخصص الدراسي' : 'Field of study'}
                          className="modern-input-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowInternModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit intern-submit"
                  onClick={handleCreateIntern}
                  disabled={internLoading || !internForm.name.trim() || !internForm.nationalId.trim() || !internForm.phone.trim()}
                >
                  {internLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'إضافة متدرب' : 'Add Intern'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Training Modal */}
        {showTrainingModal && (
          <div className="modal-overlay" onClick={() => setShowTrainingModal(false)}>
            <motion.div
              className="modal-content modern-modal training-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="modern-modal-header training-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'فترة تدريب جديدة' : 'New Training Period'}</h2>
                  <p>{isRTL ? 'إضافة فترة تدريب للمتدرب' : 'Add a training period for an intern'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowTrainingModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {isRTL ? 'المتدرب' : 'Intern'} <span className="required">*</span>
                  </label>
                  <select
                    value={trainingForm.internId}
                    onChange={(e) => setTrainingForm(prev => ({ ...prev, internId: e.target.value }))}
                    className="modern-input-field"
                  >
                    <option value="">{isRTL ? 'اختر المتدرب' : 'Select Intern'}</option>
                    {interns.map(intern => (
                      <option key={intern.internId} value={intern.internId}>
                        {intern.name} - {intern.nationalId}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {isRTL ? 'عنوان التدريب' : 'Training Title'} <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={trainingForm.title}
                    onChange={(e) => setTrainingForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder={isRTL ? 'عنوان فترة التدريب' : 'Training period title'}
                    className="modern-input-field"
                  />
                </div>

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="17" y1="10" x2="3" y2="10"/>
                      <line x1="21" y1="6" x2="3" y2="6"/>
                      <line x1="21" y1="14" x2="3" y2="14"/>
                      <line x1="17" y1="18" x2="3" y2="18"/>
                    </svg>
                    {isRTL ? 'الوصف' : 'Description'}
                  </label>
                  <textarea
                    value={trainingForm.description}
                    onChange={(e) => setTrainingForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={isRTL ? 'وصف التدريب (اختياري)' : 'Training description (optional)'}
                    rows="3"
                    className="modern-textarea"
                  />
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{isRTL ? 'فترة التدريب' : 'Training Period'}</span>
                  </div>
                  <div className="period-grid">
                    <div className="period-box start">
                      <span className="period-label">{isRTL ? 'البداية' : 'Start'}</span>
                      <input
                        type="date"
                        value={trainingForm.startDate}
                        onChange={(e) => setTrainingForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="modern-input-field"
                      />
                    </div>
                    <div className={`period-arrow ${isRTL ? 'rtl' : ''}`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points={isRTL ? "12 5 5 12 12 19" : "12 5 19 12 12 19"}/>
                      </svg>
                    </div>
                    <div className="period-box end">
                      <span className="period-label">{isRTL ? 'النهاية' : 'End'}</span>
                      <input
                        type="date"
                        value={trainingForm.endDate}
                        onChange={(e) => setTrainingForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="modern-input-field"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {isRTL ? 'ساعات العمل اليومية' : 'Daily Hours'}
                  </label>
                  <input
                    type="number"
                    value={trainingForm.dailyHours}
                    onChange={(e) => setTrainingForm(prev => ({ ...prev, dailyHours: parseFloat(e.target.value) || 8 }))}
                    min="1"
                    max="24"
                    step="0.5"
                    className="modern-input-field"
                  />
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowTrainingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit training-submit"
                  onClick={handleCreateTraining}
                  disabled={internLoading || !trainingForm.internId || !trainingForm.title.trim() || !trainingForm.startDate || !trainingForm.endDate}
                >
                  {internLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'إضافة فترة التدريب' : 'Add Training'}
                    </>
                  )}
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
              <div className="modal-body volunteer-detail-body">
                {/* Intern Profile Section */}
                <div className="volunteer-detail-profile">
                  <div className="volunteer-detail-avatar">
                    {selectedIntern.nationalIdPhoto ? (
                      <img src={selectedIntern.nationalIdPhoto} alt="ID" className="volunteer-id-photo" />
                    ) : (
                      <div className="avatar-placeholder">
                        {selectedIntern.name?.charAt(0) || 'I'}
                      </div>
                    )}
                  </div>
                  <div className="volunteer-detail-info">
                    <h3>{selectedIntern.name}</h3>
                    <div className="info-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="9" cy="10" r="2"/>
                        <path d="M15 8h2"/>
                        <path d="M15 12h2"/>
                        <path d="M7 16h10"/>
                      </svg>
                      <span>{isRTL ? 'رقم الهوية: ' : 'National ID: '}{selectedIntern.nationalId}</span>
                    </div>
                    <div className="info-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>
                      </svg>
                      <span>{selectedIntern.phone}</span>
                    </div>
                    {selectedIntern.email && (
                      <div className="info-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <span>{selectedIntern.email}</span>
                      </div>
                    )}
                    {selectedIntern.university && (
                      <div className="info-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                        </svg>
                        <span>{selectedIntern.university}</span>
                      </div>
                    )}
                    {selectedIntern.major && (
                      <div className="info-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                        <span>{selectedIntern.major}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Section */}
                <div className="volunteer-detail-stats">
                  <div className="detail-stat">
                    <div className="detail-stat-value">{selectedIntern.totalTrainings || 0}</div>
                    <div className="detail-stat-label">{isRTL ? 'فترات تدريب' : 'Trainings'}</div>
                  </div>
                  <div className="detail-stat">
                    <div className="detail-stat-value">{Math.max(0, selectedIntern.totalHours || 0)}</div>
                    <div className="detail-stat-label">{isRTL ? 'ساعة تدريب' : 'Total Hours'}</div>
                  </div>
                  <div className="detail-stat">
                    <div className={`detail-stat-value ${(selectedIntern.totalPoints || 0) > 0 ? 'positive' : (selectedIntern.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                      {(selectedIntern.totalPoints || 0) > 0 ? '+' : ''}{selectedIntern.totalPoints || 0}
                    </div>
                    <div className="detail-stat-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</div>
                  </div>
                </div>

                {/* Points Breakdown */}
                {(selectedIntern.totalAwards > 0 || selectedIntern.totalDeductions > 0) && (
                  <div className="points-breakdown">
                    <span className="awards">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      +{selectedIntern.totalAwards || 0} {isRTL ? 'منح' : 'awards'}
                    </span>
                    <span className="deductions">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      -{selectedIntern.totalDeductions || 0} {isRTL ? 'خصم' : 'deductions'}
                    </span>
                  </div>
                )}

                {/* Ratings History */}
                {selectedIntern.ratings && selectedIntern.ratings.length > 0 && (
                  <div className="volunteer-history-section">
                    <h4>{isRTL ? 'سجل التقييمات' : 'Ratings History'}</h4>
                    <div className="ratings-history-list">
                      {selectedIntern.ratings.map(rating => (
                        <div key={rating.ratingId} className={`rating-history-item ${rating.type}`}>
                          <div className="rating-history-header">
                            <span className={`rating-points ${rating.type}`}>
                              {rating.type === 'deduction' ? `-${rating.points}` : `+${rating.points}`}
                            </span>
                            <span className="rating-criteria">{rating.criteria || (isRTL ? 'بدون معيار' : 'No criteria')}</span>
                            <span className="rating-date">{rating.ratingDate}</span>
                          </div>
                          {rating.notes && (
                            <div className="rating-notes">{rating.notes}</div>
                          )}
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
                  </div>
                )}

                {/* Trainings list */}
                <div className="volunteer-history-section">
                  <h4>{isRTL ? 'فترات التدريب' : 'Training Periods'}</h4>
                  {(!selectedIntern.trainings || selectedIntern.trainings.length === 0) ? (
                    <p className="no-data">{isRTL ? 'لا توجد فترات تدريب مسجلة' : 'No trainings recorded'}</p>
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
                              <span className="hours">{Math.max(0, training.totalHours || 0)} {isRTL ? 'ساعة' : 'hours'}</span>
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
              className="modal-content modern-modal rating-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="modern-modal-header rating-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'تقييم المتدرب' : 'Rate Intern'}</h2>
                  <p>{isRTL ? 'منح أو خصم نقاط للمتدرب' : 'Award or deduct points for intern'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowInternRatingModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="workspace-info-card">
                  <div className="info-card-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{isRTL ? 'المتدرب' : 'Intern'}</span>
                    <strong>{selectedIntern.name}</strong>
                  </div>
                  {selectedTraining && (
                    <div className="info-card-item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                      </svg>
                      <span>{isRTL ? 'التدريب' : 'Training'}</span>
                      <strong>{selectedTraining.title}</strong>
                    </div>
                  )}
                </div>

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
                      <span>{isRTL ? 'خصم نقاط' : 'Deduct'}</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'عدد النقاط' : 'Points'}</label>
                  <div className="points-selector">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        className={`point-btn ${internRatingForm.points === num ? 'active' : ''} ${internRatingForm.type === 'deduction' ? 'deduction' : 'award'}`}
                        onClick={() => setInternRatingForm(prev => ({ ...prev, points: num }))}
                      >
                        {internRatingForm.type === 'deduction' ? `-${num}` : `+${num}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    {isRTL ? 'المعيار' : 'Criteria'} <span className="required">*</span>
                  </label>
                  <select
                    value={internRatingForm.criteria}
                    onChange={(e) => setInternRatingForm(prev => ({ ...prev, criteria: e.target.value }))}
                    className="modern-input-field"
                  >
                    {criteriaOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {isRTL ? 'التاريخ' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={internRatingForm.ratingDate}
                    onChange={(e) => setInternRatingForm(prev => ({ ...prev, ratingDate: e.target.value }))}
                    className="modern-input-field"
                  />
                </div>

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    {isRTL ? 'ملاحظات' : 'Notes'}
                  </label>
                  <textarea
                    value={internRatingForm.notes}
                    onChange={(e) => setInternRatingForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={isRTL ? 'ملاحظات إضافية (اختياري)' : 'Additional notes (optional)'}
                    rows="3"
                    className="modern-textarea"
                  />
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowInternRatingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className={`btn-submit ${internRatingForm.type === 'deduction' ? 'deduct-submit' : 'award-submit'}`}
                  onClick={handleCreateInternRating}
                  disabled={internLoading || !internRatingForm.criteria}
                >
                  {internLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'حفظ التقييم' : 'Save Rating'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Employees Content */}
        {activeTab === 'employees' && (
          <div className="volunteers-section">
            <div className="volunteers-header">
              <div className="volunteers-actions">
                <button className="add-volunteer-btn" onClick={() => openEmployeeModal()}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  {isRTL ? 'إضافة موظف' : 'Add Employee'}
                </button>
              </div>
              <div className="volunteers-stats">
                <div className="stat-item">
                  <span className="stat-value">{employees.length}</span>
                  <span className="stat-label">{isRTL ? 'موظف' : 'Employees'}</span>
                </div>
              </div>
            </div>

            <div className="volunteers-grid">
              {employees.length === 0 ? (
                <div className="empty-state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                  </svg>
                  <p>{isRTL ? 'لا يوجد موظفين' : 'No employees found'}</p>
                  <button className="add-first-btn" onClick={() => openEmployeeModal()}>
                    {isRTL ? 'إضافة موظف' : 'Add Employee'}
                  </button>
                </div>
              ) : (
                employees.map((employee) => (
                  <motion.div
                    key={employee.employeeId}
                    className="volunteer-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -4 }}
                  >
                    <div className="volunteer-card-header">
                      <div className="volunteer-avatar">
                        {employee.name?.charAt(0)?.toUpperCase() || 'E'}
                      </div>
                      <div className="volunteer-info">
                        <h3>{employee.name}</h3>
                        <span className="volunteer-id">{employee.email}</span>
                      </div>
                    </div>
                    <div className="volunteer-card-body">
                      <div className="volunteer-detail">
                        <span className="detail-label">{isRTL ? 'القسم' : 'Section'}</span>
                        <span className="detail-value">{sectionLabels[employee.section] || employee.section || '-'}</span>
                      </div>
                      <div className="volunteer-detail">
                        <span className="detail-label">{isRTL ? 'الحالة' : 'Status'}</span>
                        <span className={`status-badge ${employee.isActive !== false ? 'active' : 'inactive'}`}>
                          {employee.isActive !== false ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                        </span>
                      </div>
                    </div>
                    <div className="volunteer-card-footer">
                      <button
                        className="card-action-btn edit"
                        onClick={() => openEmployeeModal(employee)}
                        title={isRTL ? 'تعديل' : 'Edit'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="card-action-btn delete"
                        onClick={() => handleDeleteEmployee(employee.employeeId)}
                        title={isRTL ? 'حذف' : 'Delete'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Employee Modal */}
        {showEmployeeModal && (
          <div className="modal-overlay" onClick={() => setShowEmployeeModal(false)}>
            <motion.div
              className="modal-content modern-modal employee-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modern-modal-header employee-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{selectedEmployee ? (isRTL ? 'تعديل موظف' : 'Edit Employee') : (isRTL ? 'موظف جديد' : 'New Employee')}</h2>
                  <p>{isRTL ? 'إضافة موظف جديد للنظام' : 'Add a new employee to the system'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowEmployeeModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {isRTL ? 'الاسم' : 'Name'} <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                    placeholder={isRTL ? 'اسم الموظف الكامل' : 'Full employee name'}
                    className="modern-input-field"
                  />
                </div>
                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    {isRTL ? 'البريد الإلكتروني' : 'Email'} <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                    placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
                    className="modern-input-field"
                    dir="ltr"
                  />
                </div>
                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    {isRTL ? 'القسم' : 'Section'} <span className="required">*</span>
                  </label>
                  <select
                    value={employeeForm.section}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, section: e.target.value })}
                    className="modern-input-field"
                  >
                    <option value="">{isRTL ? 'اختر القسم' : 'Select Section'}</option>
                    {Object.keys(SECTION_COLORS).map((section) => (
                      <option key={section} value={section}>
                        {sectionLabels[section] || section}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowEmployeeModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit employee-submit"
                  onClick={selectedEmployee ? handleUpdateEmployee : handleCreateEmployee}
                  disabled={employeeLoading || !employeeForm.name.trim() || !employeeForm.email.trim()}
                >
                  {employeeLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {selectedEmployee ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إضافة موظف' : 'Add Employee')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* My Tasks (Todos) Content - Calendar View */}
        {activeTab === 'todos' && (
          <div className="schedule-layout">
            {/* Todo Calendar Section */}
            <div className="calendar-section">
              {/* Calendar Header */}
              <div className="calendar-header">
                <button className="calendar-nav" onClick={handleTodoPrevMonth}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points={isRTL ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/>
                  </svg>
                </button>
                <h3>
                  {format(todoCalendarDate, 'MMMM yyyy', { locale: isRTL ? ar : enUS })}
                </h3>
                <button className="calendar-nav" onClick={handleTodoNextMonth}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points={isRTL ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}/>
                  </svg>
                </button>
              </div>

              {/* Week Days */}
              <div className="calendar-weekdays">
                {(isRTL ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(day => (
                  <div key={day} className="weekday">{day}</div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="calendar-days">
                {/* Empty cells for days before first of month */}
                {Array(getTodoDaysInMonth(todoCalendarDate)[0].getDay()).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} className="calendar-day empty"></div>
                ))}

                {/* Days */}
                {getTodoDaysInMonth(todoCalendarDate).map(day => {
                  const dayTodos = getTodosForDay(day);
                  const hasTodos = dayTodos.length > 0;
                  const pendingCount = dayTodos.filter(t => t.status === 'pending').length;
                  const completedCount = dayTodos.filter(t => t.status === 'completed').length;

                  return (
                    <motion.div
                      key={day.toISOString()}
                      className={`calendar-day ${isToday(day) ? 'today' : ''} ${hasTodos ? 'has-events' : ''} ${selectedTodoDay && isSameDay(day, selectedTodoDay) ? 'selected' : ''}`}
                      onClick={() => setSelectedTodoDay(hasTodos ? day : null)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="day-number">{format(day, 'd')}</span>
                      {hasTodos && (
                        <div className="event-dots">
                          {pendingCount > 0 && (
                            <span className="event-dot" style={{ backgroundColor: '#f59e0b' }} title={`${pendingCount} pending`} />
                          )}
                          {completedCount > 0 && (
                            <span className="event-dot" style={{ backgroundColor: '#22c55e' }} title={`${completedCount} completed`} />
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Selected Day Details */}
              <AnimatePresence>
                {selectedTodoDay && (
                  <motion.div
                    className="selected-day-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="selected-day-header">
                      <h4>
                        {format(selectedTodoDay, 'EEEE, d MMMM', { locale: isRTL ? ar : enUS })}
                      </h4>
                      <button onClick={() => setSelectedTodoDay(null)}>×</button>
                    </div>
                    <div className="selected-day-events">
                      {getTodosForDay(selectedTodoDay).map(todo => (
                        <div
                          key={todo.todoId}
                          className={`event-item todo-event ${todo.status === 'completed' ? 'completed' : ''}`}
                          style={{ borderLeftColor: todo.status === 'completed' ? '#22c55e' : PRIORITY_COLORS[todo.priority] }}
                        >
                          <div className="event-item-header">
                            <div className="todo-checkbox-small" onClick={() => handleToggleTodoStatus(todo.todoId)}>
                              {todo.status === 'completed' ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                                  <path d="M9 11l3 3L22 4"/>
                                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                </svg>
                              )}
                            </div>
                            <span className={`event-title ${todo.status === 'completed' ? 'completed' : ''}`}>{todo.title}</span>
                            <span className={`priority-badge ${todo.priority}`}>
                              {todo.priority === 'high' ? (isRTL ? 'عالي' : 'High') : todo.priority === 'medium' ? (isRTL ? 'متوسط' : 'Med') : (isRTL ? 'منخفض' : 'Low')}
                            </span>
                          </div>
                          {todo.description && <p className="event-description">{todo.description}</p>}
                          <div className="event-actions">
                            <button onClick={() => openTodoModal(todo)} title={isRTL ? 'تعديل' : 'Edit'}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button onClick={() => handleDeleteTodo(todo.todoId)} title={isRTL ? 'حذف' : 'Delete'}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Todo Sidebar - Stats and Add Button */}
            <div className="schedule-sidebar">
              <div className="sidebar-card">
                <div className="sidebar-card-header">
                  <h3>{isRTL ? 'مهامي' : 'My Tasks'}</h3>
                  <button className="add-task-btn" onClick={() => openTodoModal()}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    {isRTL ? 'إضافة' : 'Add'}
                  </button>
                </div>
                <div className="todo-stats-grid">
                  <div className="todo-stat-card pending">
                    <span className="stat-number">{myTodos.filter(t => t.status === 'pending').length}</span>
                    <span className="stat-label">{isRTL ? 'قيد الانتظار' : 'Pending'}</span>
                  </div>
                  <div className="todo-stat-card completed">
                    <span className="stat-number">{myTodos.filter(t => t.status === 'completed').length}</span>
                    <span className="stat-label">{isRTL ? 'مكتمل' : 'Completed'}</span>
                  </div>
                  <div className="todo-stat-card high">
                    <span className="stat-number">{myTodos.filter(t => t.priority === 'high' && t.status === 'pending').length}</span>
                    <span className="stat-label">{isRTL ? 'أولوية عالية' : 'High Priority'}</span>
                  </div>
                  <div className="todo-stat-card total">
                    <span className="stat-number">{myTodos.length}</span>
                    <span className="stat-label">{isRTL ? 'الإجمالي' : 'Total'}</span>
                  </div>
                </div>
              </div>

              {/* Upcoming Tasks List */}
              <div className="sidebar-card">
                <h3>{isRTL ? 'المهام القادمة' : 'Upcoming Tasks'}</h3>
                <div className="upcoming-todos">
                  {myTodos
                    .filter(t => t.status === 'pending' && t.dueDate)
                    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
                    .slice(0, 5)
                    .map(todo => (
                      <div key={todo.todoId} className="upcoming-todo-item" onClick={() => openTodoModal(todo)}>
                        <div className="todo-priority-dot" style={{ backgroundColor: PRIORITY_COLORS[todo.priority] }} />
                        <div className="todo-info">
                          <span className="todo-title">{todo.title}</span>
                          <span className="todo-due">{format(parseISO(todo.dueDate), 'MMM d', { locale: isRTL ? ar : enUS })}</span>
                        </div>
                      </div>
                    ))
                  }
                  {myTodos.filter(t => t.status === 'pending' && t.dueDate).length === 0 && (
                    <p className="no-upcoming">{isRTL ? 'لا توجد مهام قادمة' : 'No upcoming tasks'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Todo Modal */}
        {showTodoModal && (
          <div className="modal-overlay" onClick={() => setShowTodoModal(false)}>
            <motion.div
              className="modal-content modern-modal todo-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modern-modal-header">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{selectedTodo ? (isRTL ? 'تعديل مهمة' : 'Edit Task') : (isRTL ? 'مهمة جديدة' : 'New Task')}</h2>
                  <p>{isRTL ? 'أضف مهمة لقائمة مهامك الشخصية' : 'Add a task to your personal to-do list'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowTodoModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {isRTL ? 'العنوان' : 'Title'}
                  </label>
                  <input
                    type="text"
                    value={todoForm.title}
                    onChange={(e) => setTodoForm({ ...todoForm, title: e.target.value })}
                    placeholder={isRTL ? 'ما المهمة التي تريد إنجازها؟' : 'What do you want to accomplish?'}
                    className="modern-input-field"
                  />
                </div>
                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="17" y1="10" x2="3" y2="10"/>
                      <line x1="21" y1="6" x2="3" y2="6"/>
                      <line x1="21" y1="14" x2="3" y2="14"/>
                      <line x1="17" y1="18" x2="3" y2="18"/>
                    </svg>
                    {isRTL ? 'الوصف' : 'Description'}
                  </label>
                  <textarea
                    value={todoForm.description}
                    onChange={(e) => setTodoForm({ ...todoForm, description: e.target.value })}
                    placeholder={isRTL ? 'أضف تفاصيل إضافية (اختياري)' : 'Add more details (optional)'}
                    rows={3}
                    className="modern-input-field"
                  />
                </div>
                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}
                  </label>
                  <input
                    type="date"
                    value={todoForm.dueDate}
                    onChange={(e) => setTodoForm({ ...todoForm, dueDate: e.target.value })}
                    className="modern-input-field"
                  />
                </div>
                <div className="form-group">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    {isRTL ? 'الأولوية' : 'Priority'}
                  </label>
                  <div className="priority-selector">
                    <button
                      type="button"
                      className={`priority-btn low ${todoForm.priority === 'low' ? 'selected' : ''}`}
                      onClick={() => setTodoForm({ ...todoForm, priority: 'low' })}
                    >
                      <span className="priority-dot"></span>
                      {isRTL ? 'منخفض' : 'Low'}
                    </button>
                    <button
                      type="button"
                      className={`priority-btn medium ${todoForm.priority === 'medium' ? 'selected' : ''}`}
                      onClick={() => setTodoForm({ ...todoForm, priority: 'medium' })}
                    >
                      <span className="priority-dot"></span>
                      {isRTL ? 'متوسط' : 'Medium'}
                    </button>
                    <button
                      type="button"
                      className={`priority-btn high ${todoForm.priority === 'high' ? 'selected' : ''}`}
                      onClick={() => setTodoForm({ ...todoForm, priority: 'high' })}
                    >
                      <span className="priority-dot"></span>
                      {isRTL ? 'عالي' : 'High'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowTodoModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit"
                  onClick={selectedTodo ? handleUpdateTodo : handleCreateTodo}
                  disabled={todoLoading || !todoForm.title.trim()}
                >
                  {todoLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {selectedTodo ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إضافة مهمة' : 'Add Task')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Workspaces Content */}
        {activeTab === 'workspaces' && (
          <div className="workspaces-content">
            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{workspaceStats.totalWorkspaces}</span>
                  <span className="stat-label">{isRTL ? 'إجمالي المساحات' : 'Total Workspaces'}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon active">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{workspaceStats.activeWorkspaces}</span>
                  <span className="stat-label">{isRTL ? 'نشطة' : 'Active'}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon completed">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{workspaceStats.completedWorkspaces}</span>
                  <span className="stat-label">{isRTL ? 'مكتملة' : 'Completed'}</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon today">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{workspaceStats.todayWorkspaces}</span>
                  <span className="stat-label">{isRTL ? 'اليوم' : 'Today'}</span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="workspace-actions-bar">
              <div className="actions-left">
                <h3>{isRTL ? 'قائمة مساحات العمل' : 'Workspace List'}</h3>
                <span className="workspace-count">{workspaces.length} {isRTL ? 'مساحة' : 'total'}</span>
              </div>
              <button className="add-workspace-btn" onClick={() => openWorkspaceModal()}>
                <div className="btn-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
                <span>{isRTL ? 'إضافة مساحة عمل جديدة' : 'Add New Workspace'}</span>
              </button>
            </div>

            {/* Workspaces Grid */}
            <div className="workspaces-grid">
              {workspaces.length === 0 ? (
                <div className="empty-state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                  <h3>{isRTL ? 'لا توجد مساحات عمل' : 'No Workspaces'}</h3>
                  <p>{isRTL ? 'أضف مساحة عمل جديدة للبدء' : 'Add a new workspace to get started'}</p>
                </div>
              ) : (
                workspaces.map(workspace => (
                  <motion.div
                    key={workspace.workspaceId}
                    className={`workspace-card ${workspace.status}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="workspace-header">
                      <div className="workspace-table">
                        <span className="table-label">{isRTL ? 'طاولة' : 'Table'}</span>
                        <span className="table-number">{workspace.tableNumber}</span>
                      </div>
                      <div className={`workspace-status ${workspace.status}`}>
                        {workspace.status === 'active' ? (isRTL ? 'نشط' : 'Active') :
                         workspace.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                         (isRTL ? 'ملغي' : 'Cancelled')}
                      </div>
                    </div>

                    <div className="workspace-body">
                      <div className="workspace-info">
                        <div className="info-row">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          <span>{workspace.personName}</span>
                        </div>
                        {workspace.personPhone && (
                          <div className="info-row">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <span dir="ltr">{workspace.personPhone}</span>
                          </div>
                        )}
                        <div className="info-row">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                          <span>{workspace.numberOfUsers} {isRTL ? 'مستخدم' : 'user(s)'}</span>
                        </div>
                      </div>

                      <div className="workspace-period">
                        <div className="period-item">
                          <span className="period-label">{isRTL ? 'من' : 'From'}</span>
                          <span className="period-value">{format(parseISO(workspace.startDate), 'MMM d', { locale: isRTL ? ar : enUS })} {formatTimeAMPM(workspace.startTime)}</span>
                        </div>
                        <div className="period-item">
                          <span className="period-label">{isRTL ? 'إلى' : 'To'}</span>
                          <span className="period-value">{format(parseISO(workspace.endDate), 'MMM d', { locale: isRTL ? ar : enUS })} {formatTimeAMPM(workspace.endTime)}</span>
                        </div>
                      </div>

                      <div className="workspace-points">
                        <span className={`points-badge ${workspace.totalPoints >= 0 ? 'positive' : 'negative'}`}>
                          {workspace.totalPoints >= 0 ? '+' : ''}{workspace.totalPoints} {isRTL ? 'نقطة' : 'points'}
                        </span>
                      </div>

                      {workspace.notes && (
                        <div className="workspace-notes">
                          <p>{workspace.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="workspace-actions">
                      {workspace.status === 'active' && (
                        <>
                          <button className="action-btn complete" onClick={() => handleCompleteWorkspace(workspace.workspaceId)} title={isRTL ? 'إكمال' : 'Complete'}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </button>
                          <button className="action-btn rate" onClick={() => openWorkspaceRatingModal(workspace)} title={isRTL ? 'تقييم' : 'Rate'}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          </button>
                        </>
                      )}
                      <button className="action-btn edit" onClick={() => openWorkspaceModal(workspace)} title={isRTL ? 'تعديل' : 'Edit'}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="action-btn delete" onClick={() => handleDeleteWorkspace(workspace.workspaceId)} title={isRTL ? 'حذف' : 'Delete'}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>

                    {/* Ratings List */}
                    {workspace.ratings && workspace.ratings.length > 0 && (
                      <div className="workspace-ratings">
                        <h4>{isRTL ? 'التقييمات' : 'Ratings'}</h4>
                        <div className="ratings-list">
                          {workspace.ratings.map(rating => (
                            <div key={rating.ratingId} className={`rating-item ${rating.type}`}>
                              <span className="rating-points">{rating.type === 'deduct' ? '-' : '+'}{rating.points}</span>
                              <span className="rating-criteria">
                                {workspaceCriteriaOptions.find(c => c.value === rating.criteria)?.label || rating.criteria}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Workspace Modal */}
        {showWorkspaceModal && (
          <div className="modal-overlay" onClick={() => setShowWorkspaceModal(false)}>
            <motion.div
              className="modal-content modern-modal workspace-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modern-modal-header workspace-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{selectedWorkspace ? (isRTL ? 'تعديل مساحة العمل' : 'Edit Workspace') : (isRTL ? 'مساحة عمل جديدة' : 'New Workspace')}</h2>
                  <p>{isRTL ? 'سجل بيانات مساحة العمل للعملاء' : 'Record workspace details for customers'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowWorkspaceModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body workspace-form">
                {/* Workspace Details Section */}
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    <span>{isRTL ? 'تفاصيل مساحة العمل' : 'Workspace Details'}</span>
                  </div>
                  <div className="form-row">
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'رقم الطاولة' : 'Table Number'} <span className="required">*</span></label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7"/>
                          <rect x="14" y="3" width="7" height="7"/>
                          <rect x="14" y="14" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/>
                        </svg>
                        <input
                          type="text"
                          value={workspaceForm.tableNumber}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, tableNumber: e.target.value })}
                          placeholder={isRTL ? 'مثال: A1, B2' : 'e.g., A1, B2'}
                          className="modern-input-field"
                        />
                      </div>
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'عدد المستخدمين' : 'Number of Users'}</label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <input
                          type="number"
                          min="1"
                          value={workspaceForm.numberOfUsers}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, numberOfUsers: parseInt(e.target.value) || 1 })}
                          className="modern-input-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Person in Charge Section */}
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{isRTL ? 'معلومات المسؤول' : 'Person in Charge'}</span>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'الاسم' : 'Name'} <span className="required">*</span></label>
                    <div className="input-with-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        value={workspaceForm.personName}
                        onChange={(e) => setWorkspaceForm({ ...workspaceForm, personName: e.target.value })}
                        placeholder={isRTL ? 'اسم الشخص المسؤول' : 'Full name'}
                        className="modern-input-field"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <input
                          type="tel"
                          value={workspaceForm.personPhone}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, personPhone: e.target.value })}
                          placeholder={isRTL ? 'رقم الهاتف' : 'Phone number'}
                          dir="ltr"
                          className="modern-input-field"
                        />
                      </div>
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <input
                          type="email"
                          value={workspaceForm.personEmail}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, personEmail: e.target.value })}
                          placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
                          dir="ltr"
                          className="modern-input-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Usage Period Section */}
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{isRTL ? 'فترة الاستخدام' : 'Usage Period'}</span>
                  </div>
                  <div className="period-grid">
                    <div className="period-box start">
                      <span className="period-label">{isRTL ? 'البداية' : 'Start'}</span>
                      <div className="period-inputs">
                        <input
                          type="date"
                          value={workspaceForm.startDate}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, startDate: e.target.value })}
                          className="modern-input-field"
                        />
                        <input
                          type="time"
                          value={workspaceForm.startTime}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, startTime: e.target.value })}
                          className="modern-input-field"
                        />
                      </div>
                    </div>
                    <div className={`period-arrow ${isRTL ? 'rtl' : ''}`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points={isRTL ? "12 5 5 12 12 19" : "12 5 19 12 12 19"}/>
                      </svg>
                    </div>
                    <div className="period-box end">
                      <span className="period-label">{isRTL ? 'النهاية' : 'End'}</span>
                      <div className="period-inputs">
                        <input
                          type="date"
                          value={workspaceForm.endDate}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, endDate: e.target.value })}
                          className="modern-input-field"
                        />
                        <input
                          type="time"
                          value={workspaceForm.endTime}
                          onChange={(e) => setWorkspaceForm({ ...workspaceForm, endTime: e.target.value })}
                          className="modern-input-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo Upload Section */}
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>{isRTL ? 'صورة مساحة العمل' : 'Workspace Photo'}</span>
                  </div>
                  <div className="photo-upload-area">
                    {workspaceForm.photoBefore ? (
                      <div className="photo-preview">
                        <img src={workspaceForm.photoBefore} alt="Workspace" />
                        <button
                          className="remove-photo-btn"
                          onClick={() => setWorkspaceForm({ ...workspaceForm, photoBefore: '' })}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <label className="photo-upload-label">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setWorkspaceForm({ ...workspaceForm, photoBefore: reader.result });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        <div className="upload-content">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          <span className="upload-text">{isRTL ? 'انقر لرفع صورة' : 'Click to upload photo'}</span>
                          <span className="upload-hint">{isRTL ? 'PNG, JPG حتى 5MB' : 'PNG, JPG up to 5MB'}</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Notes Section */}
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <span>{isRTL ? 'ملاحظات' : 'Notes'}</span>
                  </div>
                  <textarea
                    value={workspaceForm.notes}
                    onChange={(e) => setWorkspaceForm({ ...workspaceForm, notes: e.target.value })}
                    placeholder={isRTL ? 'أضف أي ملاحظات إضافية حول مساحة العمل أو العميل...' : 'Add any additional notes about the workspace or customer...'}
                    rows={3}
                    className="modern-textarea"
                  />
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowWorkspaceModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit workspace-submit"
                  onClick={selectedWorkspace ? handleUpdateWorkspace : handleCreateWorkspace}
                  disabled={workspaceLoading || !workspaceForm.tableNumber.trim() || !workspaceForm.personName.trim()}
                >
                  {workspaceLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {selectedWorkspace ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إضافة مساحة العمل' : 'Add Workspace')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Workspace Rating Modal */}
        {showWorkspaceRatingModal && selectedWorkspace && (
          <div className="modal-overlay" onClick={() => setShowWorkspaceRatingModal(false)}>
            <motion.div
              className="modal-content modern-modal rating-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modern-modal-header rating-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'تقييم مساحة العمل' : 'Rate Workspace'}</h2>
                  <p>{isRTL ? 'منح أو خصم نقاط للعميل' : 'Award or deduct points for the customer'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowWorkspaceRatingModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="workspace-info-card">
                  <div className="info-card-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    <span>{isRTL ? 'طاولة' : 'Table'}</span>
                    <strong>{selectedWorkspace.tableNumber}</strong>
                  </div>
                  <div className="info-card-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{isRTL ? 'المسؤول' : 'Person'}</span>
                    <strong>{selectedWorkspace.personName}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'نوع التقييم' : 'Rating Type'}</label>
                  <div className="rating-type-toggle">
                    <button
                      type="button"
                      className={`rating-type-btn award ${workspaceRatingForm.type === 'award' ? 'active' : ''}`}
                      onClick={() => setWorkspaceRatingForm({ ...workspaceRatingForm, type: 'award' })}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      <span>{isRTL ? 'منح نقاط' : 'Award'}</span>
                    </button>
                    <button
                      type="button"
                      className={`rating-type-btn deduction ${workspaceRatingForm.type === 'deduct' ? 'active' : ''}`}
                      onClick={() => setWorkspaceRatingForm({ ...workspaceRatingForm, type: 'deduct' })}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      <span>{isRTL ? 'خصم نقاط' : 'Deduct'}</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'عدد النقاط' : 'Points'}</label>
                  <div className="points-selector">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        className={`point-btn ${workspaceRatingForm.points === num ? 'active' : ''} ${workspaceRatingForm.type === 'deduct' ? 'deduction' : 'award'}`}
                        onClick={() => setWorkspaceRatingForm({ ...workspaceRatingForm, points: num })}
                      >
                        {workspaceRatingForm.type === 'deduct' ? `-${num}` : `+${num}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    {isRTL ? 'المعيار' : 'Criteria'} <span className="required">*</span>
                  </label>
                  <select
                    value={workspaceRatingForm.criteria}
                    onChange={(e) => setWorkspaceRatingForm({ ...workspaceRatingForm, criteria: e.target.value })}
                    className="modern-input-field"
                  >
                    {workspaceCriteriaOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {workspaceRatingForm.criteria === 'other' && (
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'معيار مخصص' : 'Custom Criteria'}</label>
                    <input
                      type="text"
                      value={workspaceRatingForm.customCriteria || ''}
                      onChange={(e) => setWorkspaceRatingForm({ ...workspaceRatingForm, customCriteria: e.target.value })}
                      placeholder={isRTL ? 'أدخل المعيار' : 'Enter criteria'}
                      className="modern-input-field"
                    />
                  </div>
                )}

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {isRTL ? 'تاريخ التقييم' : 'Rating Date'}
                  </label>
                  <input
                    type="date"
                    value={workspaceRatingForm.ratingDate}
                    onChange={(e) => setWorkspaceRatingForm({ ...workspaceRatingForm, ratingDate: e.target.value })}
                    className="modern-input-field"
                  />
                </div>

                <div className="form-group modern-input">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    {isRTL ? 'ملاحظات' : 'Notes'}
                  </label>
                  <textarea
                    value={workspaceRatingForm.notes}
                    onChange={(e) => setWorkspaceRatingForm({ ...workspaceRatingForm, notes: e.target.value })}
                    placeholder={isRTL ? 'ملاحظات إضافية (اختياري)' : 'Additional notes (optional)'}
                    rows={3}
                    className="modern-textarea"
                  />
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowWorkspaceRatingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className={`btn-submit ${workspaceRatingForm.type === 'deduct' ? 'deduct-submit' : 'award-submit'}`}
                  onClick={handleAddWorkspaceRating}
                  disabled={workspaceLoading || !workspaceRatingForm.criteria}
                >
                  {workspaceLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'إضافة التقييم' : 'Add Rating'}
                    </>
                  )}
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

            {/* Theme Settings */}
            <div className="settings-section">
              <div className="settings-section-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                <h3>{isRTL ? 'المظهر' : 'Appearance'}</h3>
              </div>
              <div className="settings-section-body">
                <div className="setting-item">
                  <div className="setting-info">
                    <span className="setting-label">{isRTL ? 'نمط العرض' : 'Display Mode'}</span>
                    <span className="setting-description">
                      {isRTL ? 'اختر بين الوضع الفاتح أو الداكن' : 'Choose between light or dark mode'}
                    </span>
                  </div>
                  <div className="theme-toggle-group">
                    <button
                      className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                      </svg>
                      {isRTL ? 'فاتح' : 'Light'}
                    </button>
                    <button
                      className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                      {isRTL ? 'داكن' : 'Dark'}
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
                    <div className="employee-checkbox-list">
                      {employees.map(emp => (
                        <label key={emp.employeeId} className="employee-checkbox-item">
                          <input
                            type="checkbox"
                            checked={taskForm.employeeIds.includes(emp.employeeId)}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const newEmployeeIds = isChecked
                                ? [...taskForm.employeeIds, emp.employeeId]
                                : taskForm.employeeIds.filter(id => id !== emp.employeeId);
                              setTaskForm({
                                ...taskForm,
                                employeeIds: newEmployeeIds,
                                employeeId: newEmployeeIds.length === 1 ? newEmployeeIds[0] : ''
                              });
                            }}
                          />
                          <div className="employee-checkbox-avatar" style={{ background: SECTION_COLORS[emp.section] || '#6366f1' }}>
                            {emp.name?.charAt(0) || 'E'}
                          </div>
                          <div className="employee-checkbox-info">
                            <span className="employee-checkbox-name">{emp.name}</span>
                            <span className="employee-checkbox-section">{sectionLabels[emp.section] || emp.section}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {!taskForm.selectAllEmployees && taskForm.employeeIds.length > 0 && (
                    <div className="selected-count">
                      {isRTL
                        ? `تم تحديد ${taskForm.employeeIds.length} موظف`
                        : `${taskForm.employeeIds.length} employee${taskForm.employeeIds.length > 1 ? 's' : ''} selected`}
                    </div>
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
                </div>

                <div className="task-form-row">
                  <div className="task-form-group">
                    <label>{isRTL ? 'من الساعة' : 'Start Time'}</label>
                    <input
                      type="time"
                      value={taskForm.dueTime}
                      onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })}
                    />
                  </div>
                  <div className="task-form-group">
                    <label>{isRTL ? 'إلى الساعة' : 'End Time'}</label>
                    <input
                      type="time"
                      value={taskForm.dueTimeEnd}
                      onChange={(e) => setTaskForm({ ...taskForm, dueTimeEnd: e.target.value })}
                      min={taskForm.dueTime}
                    />
                  </div>
                </div>

                {/* Block Calendar Checkbox */}
                <div className="task-form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={taskForm.blocksCalendar}
                      onChange={(e) => setTaskForm({ ...taskForm, blocksCalendar: e.target.checked })}
                    />
                    <span className="checkbox-text">
                      {isRTL ? 'حجز الموعد (منع العملاء من الحجز في هذا الوقت)' : 'Block time slot (prevents customers from booking)'}
                    </span>
                  </label>
                  {taskForm.blocksCalendar && (!taskForm.dueTime || !taskForm.dueTimeEnd) && (
                    <span className="warning-hint">
                      {isRTL ? 'يرجى تحديد وقت البداية والنهاية لحجز الموعد' : 'Please set start and end time to block the slot'}
                    </span>
                  )}
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
