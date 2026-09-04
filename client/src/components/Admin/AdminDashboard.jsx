import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import api from '../../config/api';
import { openWhatsApp, getApprovalMessage, getRejectionMessage } from '../../utils/whatsappHelper';
import './Admin.css';
import '../Manager/Manager.css';
import QRScanner from '../QRScanner/QRScanner';
import VolunteerManagement from '../Volunteer/VolunteerManagement';
import WorkerManagement from '../Worker/WorkerManagement';
import SummerFablab from '../Summer/SummerFablab';
import Mawhba from '../Mawhba/Mawhba';
import ContractsManagement from '../Contracts/ContractsManagement';
import FablabStaffManagement from '../FablabStaff/FablabStaffManagement';
import OvertimeManagement from '../Overtime/OvertimeManagement';
import TrainerAssistantManagement from '../TrainerAssistant/TrainerAssistantManagement';
import CustomersManagement from '../Customers/CustomersManagement';
import QuickMessages from './QuickMessages';
import UnifiedAttendancePage from '../shared/UnifiedAttendancePage';
import FablabVisitsTab from './FablabVisitsTab';
import FablabVisitOverrideCodeCard from './FablabVisitOverrideCodeCard';
import YearCalendar from '../YearCalendar/YearCalendar';
import StoreTab from './StoreTab';
import Print3DTab from './Print3DTab';
import InstitutionSupportTab from './InstitutionSupportTab';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

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

const EMPLOYEE_COLORS = [
  '#e02529', '#2563eb', '#16a34a', '#9333ea', '#ea580c',
  '#0891b2', '#c026d3', '#ca8a04', '#0d9488', '#be123c',
  '#4f46e5', '#15803d', '#a21caf', '#0369a1', '#b45309',
  '#7c3aed', '#dc2626', '#059669', '#6d28d9', '#d97706',
];

const getEmployeeColor = (employees, employeeId) => {
  const idx = employees.findIndex(e => e.employeeId === employeeId);
  return EMPLOYEE_COLORS[idx >= 0 ? idx % EMPLOYEE_COLORS.length : 0];
};

const PRIORITY_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444'
};

const PREDEFINED_REJECTION_REASONS = [
  { en: 'Incomplete application information', ar: 'معلومات الطلب غير مكتملة' },
  { en: 'Selected time slot is no longer available', ar: 'الموعد المحدد لم يعد متاحاً' },
  { en: 'Does not meet eligibility requirements', ar: 'لا يستوفي متطلبات الأهلية' },
  { en: 'Duplicate registration', ar: 'تسجيل مكرر' },
  { en: 'Service requested is currently unavailable', ar: 'الخدمة المطلوبة غير متاحة حالياً' },
  { en: 'Section is at full capacity', ar: 'القسم مكتمل العدد' },
  { en: 'Appointment date conflicts with maintenance schedule', ar: 'تاريخ الموعد يتعارض مع جدول الصيانة' },
  { en: 'Required documents not provided', ar: 'لم يتم تقديم المستندات المطلوبة' }
];

// Helper function to format time as AM/PM
const formatTimeAMPM = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Valid tabs for URL persistence
  const validTabs = ['dashboard', 'registrations', 'users', 'employees', 'schedule', 'analytics', 'borrowing', 'education', 'workshops', 'workspaces', 'volunteers', 'workers', 'fablab-staff', 'summer', 'mawhba', 'overtime', 'trainer-assistants', 'contracts', 'customers', 'fablab-visits', 'store', 'print3d', 'institution-support', 'year-calendar', 'attendance-station', 'quick-messages', 'settings'];

  // Get initial tab from URL, localStorage, or default to 'dashboard'
  const getInitialTab = () => {
    const tabFromUrl = searchParams.get('tab');
    if (validTabs.includes(tabFromUrl)) return tabFromUrl;
    const savedTab = localStorage.getItem('adminActiveTab');
    if (validTabs.includes(savedTab)) return savedTab;
    return 'dashboard';
  };

  const [adminData, setAdminData] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  // Per-admin sidebar visibility. Stored in localStorage so each admin
  // gets their own view without any server-side plumbing. The Settings
  // tab is deliberately not hideable — otherwise a hidden Settings tab
  // becomes unreachable.
  const [hiddenTabs, setHiddenTabs] = useState(() => {
    try {
      const raw = localStorage.getItem('adminHiddenTabs');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(id => id !== 'settings') : [];
    } catch { return []; }
  });
  const toggleTabVisibility = (id) => {
    if (id === 'settings') return;
    setHiddenTabs(prev => {
      const next = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
      try { localStorage.setItem('adminHiddenTabs', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Start with sidebar closed on mobile
    if (typeof window !== 'undefined') {
      return window.innerWidth > 768;
    }
    return true;
  });
  const [stats, setStats] = useState({
    totalRegistrations: 0,
    pendingRegistrations: 0,
    approvedRegistrations: 0,
    rejectedRegistrations: 0,
    totalUsers: 0,
    todayRegistrations: 0
  });
  const [registrations, setRegistrations] = useState([]);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    section: '',
    applicationType: '',
    sex: '',
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 0,
    limit: 50
  });
  const [userPagination, setUserPagination] = useState({
    page: 1,
    total: 0,
    pages: 0,
    limit: 50
  });
  const [userSearch, setUserSearch] = useState('');
  const [analyticsDateRange, setAnalyticsDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userRegistrations, setUserRegistrations] = useState([]);
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', sections: [] });
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userEditForm, setUserEditForm] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month');
  const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all' or employee section
  const [theme, setTheme] = useState(() => localStorage.getItem('adminTheme') || 'dark');

  // Working hours settings
  const [workingHours, setWorkingHours] = useState({ startTime: '11:00', endTime: '19:00', workingDays: [0, 1, 2, 3, 4] });
  const [savingWorkingHours, setSavingWorkingHours] = useState(false);

  // Working hours overrides
  const [overrides, setOverrides] = useState([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ labelEn: '', labelAr: '', startDate: '', endDate: '', startTime: '09:00', endTime: '15:00', workingDays: [0, 1, 2, 3, 4] });
  const [savingOverride, setSavingOverride] = useState(false);

  // Registration pause
  const [registrationPaused, setRegistrationPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [savingPause, setSavingPause] = useState(false);

  // Store closure (temporary)
  const [storeClosed, setStoreClosed] = useState(false);
  const [storeCloseReason, setStoreCloseReason] = useState('');
  const [savingStoreClose, setSavingStoreClose] = useState(false);

  // 3D printing closure (temporary, with optional date window)
  const [p3dStatus, setP3dStatus] = useState({
    disabled: false, from: '', to: '', reason: '', effectiveClosed: false
  });
  const [p3dForm, setP3dForm] = useState({ from: '', to: '', reason: '' });
  const [savingP3d, setSavingP3d] = useState(false);

  // Registration closures (date-range, all sections)
  const [closures, setClosures] = useState([]);
  const [closureForm, setClosureForm] = useState({ startDate: '', endDate: '', reasonEn: '', reasonAr: '' });
  const [savingClosure, setSavingClosure] = useState(false);

  // Borrowing states
  const [borrowings, setBorrowings] = useState([]);
  const [borrowingFilters, setBorrowingFilters] = useState({ status: '', section: '', search: '' });
  const [loadingBorrowings, setLoadingBorrowings] = useState(false);
  const [selectedBorrowing, setSelectedBorrowing] = useState(null);
  const [borrowingPagination, setBorrowingPagination] = useState({ page: 1, total: 0, pages: 0, limit: 50 });
  const [showBorrowingModal, setShowBorrowingModal] = useState(false);
  const [borrowingModalAction, setBorrowingModalAction] = useState('');
  const [borrowingAdminNotes, setBorrowingAdminNotes] = useState('');
  const [returnPhotoData, setReturnPhotoData] = useState('');

  // Education states
  const [educations, setEducations] = useState([]);
  const [educationFilters, setEducationFilters] = useState({ status: '', section: '', search: '' });
  const [loadingEducations, setLoadingEducations] = useState(false);
  const [selectedEducation, setSelectedEducation] = useState(null);
  const [educationPagination, setEducationPagination] = useState({ page: 1, total: 0, pages: 0, limit: 50 });
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [educationModalAction, setEducationModalAction] = useState('');
  const [educationAdminNotes, setEducationAdminNotes] = useState('');
  const [educationRatings, setEducationRatings] = useState([]);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingForm, setRatingForm] = useState({ ratingDate: new Date().toISOString().split('T')[0], cleanlinessScore: 5, damageLevel: 'none', damageDescription: '', roomPhoto: '', comments: '' });
  const [showEducationEmailModal, setShowEducationEmailModal] = useState(false);
  const [educationEmailForm, setEducationEmailForm] = useState({ subject: '', message: '' });
  const [educationStudents, setEducationStudents] = useState([]);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({ fullName: '', nationalId: '', phoneNumber: '', email: '', schoolName: '', educationLevel: '', parentPhoneNumber: '', personalPhoto: '' });
  const [sendingEducationEmail, setSendingEducationEmail] = useState(false);
  const [showAttendanceSheet, setShowAttendanceSheet] = useState(false);
  const [attendanceSheetData, setAttendanceSheetData] = useState(null);
  const [loadingAttendanceSheet, setLoadingAttendanceSheet] = useState(false);

  // Workshop states
  const [workshopsList, setWorkshopsList] = useState([]);
  // Attendance editor modal for workshop students. `target` holds
  // { student, workshop } so the modal knows which student to edit and
  // which workshop's day range to render.
  const [attendanceEditTarget, setAttendanceEditTarget] = useState(null);
  const [attendanceEditSaving, setAttendanceEditSaving] = useState(false);
  const [showWorkshopModal, setShowWorkshopModal] = useState(false);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [workshopForm, setWorkshopForm] = useState({
    title: '', description: '', presenter: '', assignedEmployeeId: '',
    startDate: '', endDate: '', startTime: '', endTime: '',
    totalHours: '', content: '', objectives: '', photo: '',
    maxParticipants: '', price: '', notes: '', color: '#1a56db', minAge: '', maxAge: '',
    isPublic: true
  });
  const [workshopLoading, setWorkshopLoading] = useState(false);
  const [viewingWorkshopStudents, setViewingWorkshopStudents] = useState(() => {
    try { const saved = sessionStorage.getItem('viewingWorkshopId'); return saved ? { workshopId: saved, _loading: true } : null; } catch { return null; }
  });
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentForm, setEditStudentForm] = useState({});
  // Multi-select of workshop student IDs for bulk attendance-ID print.
  // Cleared whenever the admin backs out of a workshop's student list.
  const [selectedWorkshopStudentIds, setSelectedWorkshopStudentIds] = useState(() => new Set());
  // Attendance kiosk (universal) — opened from its own admin tab.
  const [attendanceKioskOpen, setAttendanceKioskOpen] = useState(false);
  const emptyWorkshopStudentForm = { firstName: '', lastName: '', phone: '', email: '', nationalId: '', gender: '', age: '', city: '', invoiceNumber: '', notes: '' };
  const [showWorkshopAddStudent, setShowWorkshopAddStudent] = useState(false);
  const [workshopAddStudentForm, setWorkshopAddStudentForm] = useState(emptyWorkshopStudentForm);
  const [addingWorkshopStudent, setAddingWorkshopStudent] = useState(false);
  useEffect(() => {
    if (viewingWorkshopStudents?.workshopId) sessionStorage.setItem('viewingWorkshopId', viewingWorkshopStudents.workshopId);
    else sessionStorage.removeItem('viewingWorkshopId');
  }, [viewingWorkshopStudents]);

  const [workshopFilter, setWorkshopFilter] = useState('active');
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Workspace states
  const WORKSPACE_PASSWORD = 'nouf123';
  const [workspaceAuthenticated, setWorkspaceAuthenticated] = useState(false);
  const [showWorkspacePasswordModal, setShowWorkspacePasswordModal] = useState(false);
  const [workspacePasswordInput, setWorkspacePasswordInput] = useState('');
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceStats, setWorkspaceStats] = useState({ totalWorkspaces: 0, activeWorkspaces: 0, completedWorkspaces: 0, todayWorkspaces: 0 });
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showWorkspaceRatingModal, setShowWorkspaceRatingModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState({ tableNumber: '', projectName: '', numberOfUsers: 1, personName: '', personPhone: '', personEmail: '', startDate: '', startTime: '', endDate: '', endTime: '', photoBefore: '', notes: '' });
  const [workspaceRatingForm, setWorkspaceRatingForm] = useState({ type: 'award', points: 1, criteria: '', notes: '', ratingDate: new Date().toISOString().split('T')[0], photoAfter: '' });

  const workspaceCriteriaOptions = [
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

  // Status modal states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalAction, setStatusModalAction] = useState(''); // 'approve' or 'reject'
  const [statusModalRegistration, setStatusModalRegistration] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState(''); // Optional reason for status change
  const [sendMessageInEmail, setSendMessageInEmail] = useState(false);
  const [isStatusChange, setIsStatusChange] = useState(false); // True when changing from approved/rejected

  // Bulk selection states
  const [selectedRegistrations, setSelectedRegistrations] = useState(new Set());
  const [selectedUsers, setSelectedUsers] = useState(new Set());

  // Email modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Selected calendar day for showing appointment details
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);

  // Section Availability states
  const [sectionAvailability, setSectionAvailability] = useState([]);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionForm, setSectionForm] = useState({
    section: '',
    startDate: '',
    endDate: '',
    reasonEn: '',
    reasonAr: ''
  });

  // Employee Task Form states (for schedule tab)
  const [employeeTaskForm, setEmployeeTaskForm] = useState({
    employeeId: '',
    title: '',
    description: '',
    dueDate: '',
    dueDateEnd: '',
    dueTime: '',
    dueTimeEnd: '',
    priority: 'medium',
    blocksCalendar: true,
    isMultipleDays: false
  });
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

  // Sync URL with active tab and save to localStorage
  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('adminActiveTab', activeTab);

    const currentTab = searchParams.get('tab');
    if (activeTab !== currentTab) {
      if (activeTab === 'dashboard') {
        // Remove tab param for dashboard (default)
        searchParams.delete('tab');
      } else {
        searchParams.set('tab', activeTab);
      }
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const newTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'dashboard';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const admin = localStorage.getItem('adminData');

    if (!token || !admin) {
      navigate('/admin/login');
      return;
    }

    setAdminData(JSON.parse(admin));
    fetchAnalytics();
    fetchRegistrations();
    fetchWorkingHours();
    fetchOverrides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/admin/analytics');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchEnhancedAnalytics = async () => {
    try {
      let url = `/admin/analytics/enhanced?period=${analyticsPeriod}`;
      if (analyticsDateRange.startDate) {
        url += `&startDate=${analyticsDateRange.startDate}`;
      }
      if (analyticsDateRange.endDate) {
        url += `&endDate=${analyticsDateRange.endDate}`;
      }
      const response = await api.get(url);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error fetching enhanced analytics:', error);
    }
  };

  const fetchWorkingHours = async () => {
    try {
      const response = await api.get('/settings/working-hours');
      setWorkingHours(response.data);
    } catch (error) {
      console.error('Error fetching working hours:', error);
    }
  };

  const handleUpdateWorkingHours = async () => {
    setSavingWorkingHours(true);
    try {
      await api.put('/settings/working-hours', workingHours);
      toast.success(isRTL ? 'تم تحديث ساعات العمل بنجاح' : 'Working hours updated successfully');
    } catch (error) {
      console.error('Error updating working hours:', error);
      toast.error(isRTL ? 'خطأ في تحديث ساعات العمل' : 'Error updating working hours');
    } finally {
      setSavingWorkingHours(false);
    }
  };

  const fetchOverrides = async () => {
    setLoadingOverrides(true);
    try {
      const response = await api.get('/settings/working-hours-overrides');
      setOverrides(response.data);
    } catch (error) {
      console.error('Error fetching overrides:', error);
    } finally {
      setLoadingOverrides(false);
    }
  };

  const handleCreateOverride = async () => {
    setSavingOverride(true);
    try {
      await api.post('/settings/working-hours-overrides', overrideForm);
      toast.success(isRTL ? 'تم إنشاء فترة التجاوز بنجاح' : 'Override created successfully');
      setShowOverrideForm(false);
      setOverrideForm({ labelEn: '', labelAr: '', startDate: '', endDate: '', startTime: '09:00', endTime: '15:00', workingDays: [0, 1, 2, 3, 4] });
      fetchOverrides();
    } catch (error) {
      console.error('Error creating override:', error);
      const msg = error.response?.data?.message || (isRTL ? 'خطأ في إنشاء فترة التجاوز' : 'Error creating override');
      toast.error(msg);
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteOverride = async (id) => {
    try {
      await api.delete(`/settings/working-hours-overrides/${id}`);
      toast.success(isRTL ? 'تم حذف فترة التجاوز' : 'Override deleted');
      fetchOverrides();
    } catch (error) {
      console.error('Error deleting override:', error);
      toast.error(isRTL ? 'خطأ في حذف فترة التجاوز' : 'Error deleting override');
    }
  };

  const fetchRegistrations = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', page);
      params.append('limit', pagination.limit);
      const response = await api.get(`/admin/registrations?${params.toString()}`);
      setRegistrations(response.data.registrations || []);
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          page: response.data.pagination.page,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error) {
      console.error('Error fetching registrations:', error);
      toast.error(isRTL ? 'خطأ في تحميل التسجيلات' : 'Error loading registrations');
    } finally {
      setLoading(false);
    }
  }, [filters, isRTL, pagination.limit]);

  // Reset page when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [filters]);

  // Auto-search registrations with debounce when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'registrations') {
        fetchRegistrations(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [filters, activeTab, fetchRegistrations]);

  // Auto-search users with debounce when userSearch changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'users') {
        fetchUsers(1);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearch, activeTab]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      fetchRegistrations(newPage);
    }
  };

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', userPagination.limit);
      if (userSearch) params.append('search', userSearch);
      const response = await api.get(`/admin/users?${params.toString()}`);
      setUsers(response.data.users || []);
      if (response.data.pagination) {
        setUserPagination(prev => ({
          ...prev,
          page: response.data.pagination.page,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages
        }));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPageChange = (newPage) => {
    if (newPage >= 1 && newPage <= userPagination.pages) {
      fetchUsers(newPage);
    }
  };

  const handleUserSearch = () => {
    setUserPagination(prev => ({ ...prev, page: 1 }));
    fetchUsers(1);
  };

  const fetchUserWithRegistrations = async (userId) => {
    try {
      const encodedId = encodeURIComponent(userId);
      const response = await api.get(`/admin/users/${encodedId}/registrations`);
      setSelectedUser(response.data.user);
      setUserRegistrations(response.data.registrations || []);
      setUserEditForm(response.data.user);
      setIsEditingUser(false);
      setShowUserModal(true);
    } catch (error) {
      console.error('Error fetching user registrations:', error);
      toast.error(isRTL ? 'خطأ في تحميل بيانات المستخدم' : 'Error loading user data');
    }
  };

  const handleUpdateUser = async () => {
    try {
      const encodedId = encodeURIComponent(selectedUser.userId);
      await api.put(`/admin/users/${encodedId}`, userEditForm);
      toast.success(isRTL ? 'تم تحديث بيانات المستخدم بنجاح' : 'User updated successfully');
      setSelectedUser({ ...selectedUser, ...userEditForm });
      setIsEditingUser(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      const data = error.response?.data;
      const reason = isRTL
        ? (data?.messageAr || data?.message)
        : data?.message;
      toast.error(reason || (isRTL ? 'خطأ في تحديث بيانات المستخدم' : 'Error updating user'));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا المستخدم وجميع تسجيلاته؟' : 'Are you sure you want to delete this user and all their registrations?')) {
      return;
    }
    try {
      const encodedId = encodeURIComponent(userId);
      await api.delete(`/admin/users/${encodedId}`);
      toast.success(isRTL ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(isRTL ? 'خطأ في حذف المستخدم' : 'Error deleting user');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/admin/employees');
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchSchedule = async () => {
    try {
      const response = await api.get('/admin/schedule?includeTasks=true');
      setSchedule(response.data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
  };

  // Registration pause functions
  const fetchRegistrationStatus = async () => {
    try {
      const response = await api.get('/settings/registration-status');
      setRegistrationPaused(response.data.disabled || false);
      setPauseReason(response.data.reason || '');
    } catch (error) {
      console.error('Error fetching registration status:', error);
    }
  };

  const handleToggleRegistration = async () => {
    setSavingPause(true);
    try {
      const newDisabled = !registrationPaused;
      await api.put('/settings/registration-status', {
        disabled: newDisabled,
        reason: newDisabled ? pauseReason : ''
      });
      setRegistrationPaused(newDisabled);
      if (!newDisabled) setPauseReason('');
      toast.success(isRTL
        ? (newDisabled ? 'تم إيقاف التسجيل مؤقتاً' : 'تم تفعيل التسجيل')
        : (newDisabled ? 'Registration paused' : 'Registration enabled'));
    } catch (error) {
      console.error('Error updating registration status:', error);
      toast.error(isRTL ? 'خطأ في تحديث حالة التسجيل' : 'Error updating registration status');
    } finally {
      setSavingPause(false);
    }
  };

  // Store closure (temporary)
  const fetchStoreStatus = async () => {
    try {
      const response = await api.get('/settings/store-status');
      setStoreClosed(!!response.data.disabled);
      setStoreCloseReason(response.data.reason || '');
    } catch (error) {
      console.error('Error fetching store status:', error);
    }
  };

  const handleToggleStore = async () => {
    setSavingStoreClose(true);
    try {
      const newDisabled = !storeClosed;
      await api.put('/settings/store-status', {
        disabled: newDisabled,
        reason: newDisabled ? storeCloseReason : ''
      });
      setStoreClosed(newDisabled);
      if (!newDisabled) setStoreCloseReason('');
      toast.success(isRTL
        ? (newDisabled ? 'تم إغلاق المتجر مؤقتاً' : 'تم فتح المتجر')
        : (newDisabled ? 'Store closed' : 'Store open'));
    } catch (error) {
      console.error('Error updating store status:', error);
      toast.error(isRTL ? 'خطأ في تحديث حالة المتجر' : 'Error updating store status');
    } finally {
      setSavingStoreClose(false);
    }
  };

  // 3D printing closure — mirrors store but adds an optional date
  // window so admin can schedule a maintenance period in advance.
  const fetchPrint3dStatus = async () => {
    try {
      const res = await api.get('/settings/print3d-status');
      setP3dStatus(res.data);
      // Prefill the form with the current schedule so admin can edit
      // it without re-typing.
      setP3dForm({
        from: res.data.from || '',
        to:   res.data.to   || '',
        reason: res.data.reason || ''
      });
    } catch (err) {
      console.error('Error fetching print3d status:', err);
    }
  };

  const handleTogglePrint3d = async () => {
    setSavingP3d(true);
    try {
      const newDisabled = !p3dStatus.disabled;
      const payload = newDisabled
        ? { disabled: true, from: p3dForm.from || '', to: p3dForm.to || '', reason: p3dForm.reason || '' }
        : { disabled: false };
      const res = await api.put('/settings/print3d-status', payload);
      setP3dStatus(res.data);
      if (!newDisabled) setP3dForm({ from: '', to: '', reason: '' });
      toast.success(isRTL
        ? (newDisabled ? 'تم إغلاق خدمة الطباعة 3D' : 'تم فتح خدمة الطباعة 3D')
        : (newDisabled ? '3D printing closed' : '3D printing open'));
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'خطأ في تحديث حالة الخدمة' : 'Error updating status'));
    } finally {
      setSavingP3d(false);
    }
  };

  const fetchClosures = async () => {
    try {
      const res = await api.get('/closures/all');
      setClosures(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching closures:', err);
    }
  };

  const handleCreateClosure = async () => {
    const { startDate, endDate, reasonEn } = closureForm;
    if (!startDate || !endDate || !reasonEn.trim()) {
      toast.error(isRTL ? 'يرجى تعبئة التاريخ والسبب' : 'Please fill dates and reason');
      return;
    }
    if (startDate > endDate) {
      toast.error(isRTL ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date');
      return;
    }
    setSavingClosure(true);
    try {
      await api.post('/closures', closureForm);
      setClosureForm({ startDate: '', endDate: '', reasonEn: '', reasonAr: '' });
      await fetchClosures();
      toast.success(isRTL ? 'تم إضافة فترة الإغلاق' : 'Closure added');
    } catch (err) {
      console.error('Error creating closure:', err);
      toast.error(isRTL ? 'خطأ في إضافة فترة الإغلاق' : 'Error adding closure');
    } finally {
      setSavingClosure(false);
    }
  };

  const handleDeleteClosure = async (id) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف فترة الإغلاق؟' : 'Delete this closure?')) return;
    try {
      await api.delete(`/closures/${id}`);
      await fetchClosures();
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      console.error('Error deleting closure:', err);
      toast.error(isRTL ? 'خطأ في الحذف' : 'Error deleting');
    }
  };

  // Section Availability functions
  const fetchSectionAvailability = async () => {
    try {
      const response = await api.get('/sections/availability');
      setSectionAvailability(response.data || []);
    } catch (error) {
      console.error('Error fetching section availability:', error);
    }
  };

  const handleDeactivateSection = async () => {
    try {
      if (!sectionForm.section || !sectionForm.startDate || !sectionForm.endDate || !sectionForm.reasonEn) {
        toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
        return;
      }

      await api.post('/sections/availability', sectionForm);
      toast.success(isRTL ? 'تم تعطيل القسم بنجاح' : 'Section deactivated successfully');
      setShowSectionModal(false);
      setSectionForm({ section: '', startDate: '', endDate: '', reasonEn: '', reasonAr: '' });
      fetchSectionAvailability();
    } catch (error) {
      console.error('Error deactivating section:', error);
      toast.error(error.response?.data?.message || (isRTL ? 'خطأ في تعطيل القسم' : 'Error deactivating section'));
    }
  };

  const handleReactivateSection = async (availabilityId) => {
    if (!window.confirm(isRTL ? 'هل تريد إعادة تفعيل هذا القسم؟' : 'Do you want to reactivate this section?')) return;

    try {
      await api.patch(`/sections/availability/${availabilityId}/reactivate`);
      toast.success(isRTL ? 'تم إعادة تفعيل القسم بنجاح' : 'Section reactivated successfully');
      fetchSectionAvailability();
    } catch (error) {
      console.error('Error reactivating section:', error);
      toast.error(isRTL ? 'خطأ في إعادة تفعيل القسم' : 'Error reactivating section');
    }
  };

  const openDeactivateModal = (sectionName) => {
    setSectionForm({
      section: sectionName,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      reasonEn: '',
      reasonAr: ''
    });
    setShowSectionModal(true);
  };

  const getSectionStatus = (sectionName) => {
    const section = sectionAvailability.find(s => s.section === sectionName);
    if (!section) {
      return { section: sectionName, isAvailable: true, deactivationPeriods: [] };
    }
    // Check if there are any deactivation periods (current or future)
    const hasDeactivations = section.deactivationPeriods && section.deactivationPeriods.length > 0;
    // Sort deactivation periods by start date
    const sortedPeriods = hasDeactivations
      ? [...section.deactivationPeriods].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      : [];
    return {
      ...section,
      hasDeactivations,
      deactivationPeriods: sortedPeriods,
      periodCount: sortedPeriods.length
    };
  };

  useEffect(() => {
    if (activeTab === 'registrations') {
      fetchRegistrations();
    } else if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'analytics') {
      fetchEnhancedAnalytics();
    } else if (activeTab === 'schedule') {
      fetchSchedule();
      fetchEmployees();
    } else if (activeTab === 'settings') {
      fetchSectionAvailability();
      fetchRegistrationStatus();
      fetchStoreStatus();
      fetchPrint3dStatus();
      fetchClosures();
    } else if (activeTab === 'borrowing') {
      fetchBorrowings();
    } else if (activeTab === 'education') {
      fetchEducations();
    } else if (activeTab === 'workspaces' && workspaceAuthenticated) {
      fetchWorkspaces();
      fetchWorkspaceStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fetchRegistrations, analyticsPeriod, analyticsDateRange.startDate, analyticsDateRange.endDate, workspaceAuthenticated]);

  // Workshop functions
  const fetchWorkshops = useCallback(async () => {
    try {
      const response = await api.get('/workshops');
      setWorkshopsList(response.data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'workshops') {
      fetchWorkshops();
      fetchEmployees();
      // Restore viewing workshop if saved
      const savedId = sessionStorage.getItem('viewingWorkshopId');
      if (savedId) {
        api.get(`/workshops/${savedId}`).then(res => setViewingWorkshopStudents(res.data)).catch(() => { sessionStorage.removeItem('viewingWorkshopId'); setViewingWorkshopStudents(null); });
      }
    }
  }, [activeTab, fetchWorkshops]);

  const handleCreateWorkshop = async () => {
    if (!workshopForm.title || !workshopForm.startDate) {
      toast.error(isRTL ? 'العنوان والتاريخ مطلوبان' : 'Title and date are required');
      return;
    }
    setWorkshopLoading(true);
    try {
      if (selectedWorkshop) {
        await api.put(`/workshops/${selectedWorkshop.workshopId}`, workshopForm);
        toast.success(isRTL ? 'تم تحديث الورشة' : 'Workshop updated');
      } else {
        await api.post('/workshops', workshopForm);
        toast.success(isRTL ? 'تم إنشاء الورشة' : 'Workshop created');
      }
      setShowWorkshopModal(false);
      setSelectedWorkshop(null);
      setWorkshopForm({ title: '', description: '', presenter: '', assignedEmployeeId: '', startDate: '', endDate: '', startTime: '', endTime: '', totalHours: '', content: '', objectives: '', photo: '', maxParticipants: '', price: '', notes: '' });
      fetchWorkshops();
    } catch (error) {
      toast.error(isRTL ? 'خطأ' : 'Error');
    } finally {
      setWorkshopLoading(false);
    }
  };

  const handleDeleteWorkshop = async (id) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد؟' : 'Are you sure?')) return;
    try {
      await api.delete(`/workshops/${id}`);
      toast.success(isRTL ? 'تم حذف الورشة' : 'Workshop deleted');
      fetchWorkshops();
      if (viewingWorkshopStudents?.workshopId === id) setViewingWorkshopStudents(null);
    } catch (error) {
      toast.error(isRTL ? 'خطأ' : 'Error');
    }
  };

  // Print student ID card
  // Print student ID card - matches volunteer/workspace ID card style
  const handlePrintStudentIDCard = (student, workshop) => {
    const printWindow = window.open('', '_blank');
    const na = isRTL ? 'غير محدد' : 'N/A';
    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || na;
    const studentCode = 'WS-' + (student.studentId?.substring(0, 8).toUpperCase() || Date.now());

    const idCardContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'بطاقة متدرب' : 'Student ID Card'}</title>
        <style>
          @page { size: 53.98mm 100mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f0f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
          .id-card-wrapper { display: flex; flex-direction: column; align-items: center; }
          .card-holder-area { width: 53.98mm; height: 15mm; background: #f8f9fa; border: 2px dashed #ccc; border-bottom: none; border-radius: 10px 10px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; }
          .punch-hole { width: 8mm; height: 8mm; border: 2px dashed #999; border-radius: 50%; background: white; }
          .cut-line-text { font-size: 7px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
          .id-card { width: 53.98mm; height: 85.6mm; background: linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%); border-radius: 0 0 10px 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); position: relative; display: flex; flex-direction: column; }
          .card-header { background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%); padding: 10px 8px; text-align: center; }
          .card-title { color: white; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
          .card-subtitle { color: rgba(255,255,255,0.85); font-size: 8px; margin-top: 2px; }
          .card-body { flex: 1; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
          .user-photo { width: 70px; height: 85px; background: linear-gradient(135deg, #bae6fd, #7dd3fc); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #0369a1; font-size: 32px; font-weight: bold; border: 3px solid #0ea5e9; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15); overflow: hidden; }
          .user-photo .initials { font-size: 32px; font-weight: bold; color: #0369a1; }
          .user-name { font-size: 13px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.2; }
          .user-type-badge { display: inline-block; background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white; font-size: 9px; padding: 3px 12px; border-radius: 12px; font-weight: 600; }
          .workshop-badge { display: inline-block; background: linear-gradient(135deg, #38bdf8, #0ea5e9); color: white; font-size: 8px; padding: 2px 10px; border-radius: 10px; font-weight: 600; margin-top: 2px; text-align: center; line-height: 1.2; max-width: 95%; }
          .info-section { width: 100%; display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
          .info-row { display: flex; justify-content: space-between; font-size: 9px; padding: 3px 0; border-bottom: 1px dotted #ddd; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 600; color: #555; }
          .info-value { color: #1a1a2e; font-weight: 500; text-align: ${isRTL ? 'left' : 'right'}; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .card-footer { background: #ffffff; padding: 8px 6px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; border-top: 1px solid #e0e0e0; }
          .card-footer .logo { height: 24px; width: auto; flex-shrink: 0; }
          .card-footer .logo-left { order: 1; }
          .card-footer .logo-right { order: 3; }
          .member-id-section { display: flex; flex-direction: column; align-items: center; gap: 1px; order: 2; flex: 1; text-align: center; }
          .member-id-label { font-size: 6px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .member-id-value { font-size: 10px; font-weight: 700; color: #0ea5e9; font-family: 'Consolas', 'Courier New', monospace; }
          .decorative-stripe { position: absolute; top: 40%; ${isRTL ? 'right' : 'left'}: 0; width: 3px; height: 25%; background: linear-gradient(to bottom, transparent, #0ea5e9, transparent); }
          @media print { body { background: none; padding: 0; min-height: auto; } .id-card-wrapper { box-shadow: none; margin: 0; } .card-holder-area { border: 2px dashed #ccc; border-bottom: none; } .punch-hole { border: 2px dashed #999; } }
        </style>
      </head>
      <body>
        <div class="id-card-wrapper">
          <div class="card-holder-area">
            <div class="punch-hole"></div>
            <span class="cut-line-text">${isRTL ? '✂ خط القطع' : '✂ CUT LINE'}</span>
          </div>
          <div class="id-card">
            <div class="card-header">
              <div class="card-title">${isRTL ? 'بطاقة متدرب فاب لاب الأحساء' : 'FABLAB Al-Ahsa Student Card'}</div>
              <div class="card-subtitle">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</div>
            </div>
            <div class="card-body">
              <div class="user-photo">
                <span class="initials">${studentName.charAt(0).toUpperCase()}</span>
              </div>
              <div class="user-name">${studentName}</div>
              <div class="user-type-badge">${isRTL ? 'متدرب ورشة' : 'Workshop Student'}</div>
              <div class="workshop-badge">${workshop.title || ''}</div>

              <div class="info-section">
                ${student.phone ? `<div class="info-row">
                  <span class="info-label">${isRTL ? 'الهاتف' : 'Phone'}</span>
                  <span class="info-value" dir="ltr">${student.phone}</span>
                </div>` : ''}
                ${student.email ? `<div class="info-row">
                  <span class="info-label">${isRTL ? 'البريد' : 'Email'}</span>
                  <span class="info-value">${student.email}</span>
                </div>` : ''}
                ${workshop.startDate ? `<div class="info-row">
                  <span class="info-label">${isRTL ? 'من' : 'From'}</span>
                  <span class="info-value">${workshop.startDate}</span>
                </div>` : ''}
                ${workshop.endDate ? `<div class="info-row">
                  <span class="info-label">${isRTL ? 'إلى' : 'To'}</span>
                  <span class="info-value">${workshop.endDate}</span>
                </div>` : ''}
                ${workshop.totalHours ? `<div class="info-row">
                  <span class="info-label">${isRTL ? 'المدة' : 'Hours'}</span>
                  <span class="info-value">${workshop.totalHours} ${isRTL ? 'ساعة' : 'hrs'}</span>
                </div>` : ''}
              </div>
            </div>
            <div class="decorative-stripe"></div>
            <div class="card-footer">
              <img src="/found.png" alt="Foundation" class="logo logo-left">
              <div class="member-id-section">
                <div class="member-id-label">${isRTL ? 'رقم البطاقة' : 'Card ID'}</div>
                <div class="member-id-value">${studentCode}</div>
              </div>
              <img src="/fablab.png" alt="FABLAB" class="logo logo-right">
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(idCardContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  // Alias for JSX compatibility
  const handlePrintStudentID = (student, workshop) => handlePrintStudentIDCard(student, workshop);

  // Print workshop certificate - matches volunteer certificate theme
  const handlePrintWorkshopCertificate = (student, workshop) => {
    // Check attendance
    const wDays = (() => { if (!workshop.startDate) return 1; const s = new Date(workshop.startDate); const e = workshop.endDate ? new Date(workshop.endDate) : s; return Math.max(1, Math.ceil((e-s)/(1000*60*60*24))+1); })();
    const aDays = Array.isArray(student.attendanceDates) ? student.attendanceDates.length : 0;
    const reqDays = Math.ceil(wDays / 2);
    if (aDays < reqDays) {
      toast.error(isRTL ? `يجب على الطالب حضور ${reqDays} يوم على الأقل من أصل ${wDays} يوم. الحضور الحالي: ${aDays} يوم` : `Must attend ${reqDays} of ${wDays} days. Attended: ${aDays}`);
      return;
    }
    const printWindow = window.open('', '_blank');
    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    const certId = 'WS-' + (student.studentId?.substring(0, 8).toUpperCase() || Date.now());
    const attendedDays = Array.isArray(student.attendanceDates) ? student.attendanceDates.length : 0;
    const startDateF = workshop.startDate ? workshop.startDate.split('-').reverse().join('/') : '';

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>شهادة ورشة تدريبية - ${studentName}</title>
        <style>
          @page { size: A4 landscape; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 297mm; height: 210mm; overflow: hidden; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); display: flex; align-items: center; justify-content: center; padding: 10mm; }
          .certificate { width: 277mm; height: 190mm; background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%); border-radius: 16px; position: relative; overflow: hidden; box-shadow: 0 30px 60px rgba(0,0,0,0.3); }
          .certificate::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border: 6px solid transparent; border-image: linear-gradient(135deg, #e02529, #ff6b6b, #feca57, #48dbfb, #e02529) 1; border-radius: 16px; pointer-events: none; }
          .decor-circle { position: absolute; border-radius: 50%; opacity: 0.1; }
          .decor-circle.c1 { width: 200px; height: 200px; background: linear-gradient(135deg, #e02529, #ff6b6b); top: -50px; right: -50px; }
          .decor-circle.c2 { width: 150px; height: 150px; background: linear-gradient(135deg, #667eea, #764ba2); bottom: -30px; left: -30px; }
          .decor-circle.c3 { width: 100px; height: 100px; background: linear-gradient(135deg, #feca57, #ff9f43); top: 50%; left: 20px; transform: translateY(-50%); }
          .decor-circle.c4 { width: 80px; height: 80px; background: linear-gradient(135deg, #48dbfb, #0abde3); bottom: 60px; right: 40px; }
          .certificate-inner { padding: 20mm 25mm; height: 100%; display: flex; flex-direction: column; position: relative; z-index: 1; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12mm; }
          .logo-container { display: flex; align-items: center; gap: 15px; }
          .logo { height: 85px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15)); }
          .header-center { text-align: center; flex: 1; padding: 0 20px; }
          .org-name { font-size: 11px; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px; }
          .cert-title { font-size: 44px; font-weight: 800; background: linear-gradient(135deg, #e02529, #ff6b6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px; }
          .cert-subtitle { font-size: 16px; color: #475569; font-weight: 500; letter-spacing: 3px; }
          .divider { height: 4px; background: linear-gradient(90deg, #e02529, #ff6b6b, #feca57, #48dbfb, #667eea, #764ba2); border-radius: 2px; margin-bottom: 10mm; }
          .main-content { text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; }
          .presents-text { font-size: 14px; color: #64748b; margin-bottom: 8px; }
          .volunteer-name { font-size: 42px; font-weight: 700; color: #1e293b; margin-bottom: 8px; position: relative; display: inline-block; }
          .volunteer-name::after { content: ''; position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 80%; height: 4px; background: linear-gradient(90deg, #e02529, #ff6b6b, #feca57); border-radius: 2px; }
          .appreciation-text { font-size: 15px; line-height: 1.8; color: #475569; max-width: 600px; margin: 15px auto; }
          .highlight { color: #e02529; font-weight: 700; font-size: 17px; }
          .stats-container { display: flex; justify-content: center; gap: 30px; margin: 12px 0; }
          .stat-card { background: linear-gradient(135deg, #e02529, #ff6b6b); color: white; padding: 12px 30px; border-radius: 12px; text-align: center; box-shadow: 0 8px 20px rgba(224, 37, 41, 0.3); min-width: 140px; }
          .stat-card.alt { background: linear-gradient(135deg, #667eea, #764ba2); box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3); }
          .stat-card.gold { background: linear-gradient(135deg, #f59e0b, #fbbf24); box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3); }
          .stat-value { font-size: 22px; font-weight: 700; }
          .stat-label { font-size: 10px; opacity: 0.9; margin-top: 2px; }
          .thank-you { font-size: 13px; color: #64748b; margin-top: 10px; font-style: italic; }
          .hadith { color: #e02529; font-weight: 600; }
          .footer-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 10mm; }
          .cert-info { text-align: left; }
          .cert-id { font-family: 'Courier New', monospace; font-size: 10px; color: #94a3b8; background: linear-gradient(135deg, #f1f5f9, #e2e8f0); padding: 6px 14px; border-radius: 20px; display: inline-block; }
          .cert-date { font-size: 10px; color: #94a3b8; margin-top: 5px; }
          .org-footer { text-align: center; flex: 1; }
          .org-footer-text { font-size: 10px; color: #94a3b8; }
          .ribbon { position: absolute; top: 25px; left: -35px; width: 150px; height: 30px; background: linear-gradient(135deg, #e02529, #c41e24); transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: 600; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
          @media print {
            html, body { width: 297mm; height: 210mm; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            body { padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%) !important; }
            .certificate { box-shadow: none; margin: auto; }
            .cert-title { -webkit-text-fill-color: #e02529; color: #e02529; }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="decor-circle c1"></div>
          <div class="decor-circle c2"></div>
          <div class="decor-circle c3"></div>
          <div class="decor-circle c4"></div>
          <div class="ribbon">متدرب متميز</div>
          <div class="certificate-inner">
            <div class="header">
              <div class="logo-container">
                <img src="/found.png" alt="Foundation" class="logo" />
              </div>
              <div class="header-center">
                <div class="org-name">مؤسسة عبدالمنعم الراشد الإنسانية</div>
                <div class="cert-title">شهادة إتمام ورشة</div>
                <div class="cert-subtitle">WORKSHOP CERTIFICATE</div>
              </div>
              <div class="logo-container">
                <img src="/fablab.png" alt="FABLAB" class="logo" />
              </div>
            </div>
            <div class="divider"></div>
            <div class="main-content">
              <div class="presents-text">تشهد إدارة فاب لاب الأحساء بأن</div>
              <div class="volunteer-name">${studentName}</div>
              <div class="appreciation-text">
                قد أتم بنجاح الورشة التدريبية
                <span class="highlight">"${workshop.title || ''}"</span>
                ${workshop.presenter ? `<br/>التي قدمها <strong>${workshop.presenter}</strong>` : ''}
                <br/>
                ${workshop.objectives ? workshop.objectives : 'واكتسب المعارف والمهارات المطلوبة، ونثمّن التزامه وحضوره المتميز'}
              </div>
              <div class="stats-container">
                ${workshop.totalHours ? `<div class="stat-card"><div class="stat-value">${workshop.totalHours}</div><div class="stat-label">ساعة تدريبية</div></div>` : ''}
                ${attendedDays > 0 ? `<div class="stat-card alt"><div class="stat-value">${attendedDays}</div><div class="stat-label">يوم حضور</div></div>` : ''}
                ${startDateF ? `<div class="stat-card gold"><div class="stat-value">${startDateF}</div><div class="stat-label">تاريخ البداية</div></div>` : ''}
              </div>
              <div class="thank-you">
                <span class="hadith">"ومن سلك طريقاً يلتمس فيه علماً سهّل الله له به طريقاً إلى الجنة"</span>
                <br/>
                شكراً لحضورك وتفاعلك في هذه الورشة التدريبية
              </div>
            </div>
            <div class="footer-section">
              <div class="cert-info">
                <div class="cert-id">${certId}</div>
                <div class="cert-date">${new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' })}</div>
              </div>
              <div class="org-footer">
                <div class="org-footer-text">
                  فاب لاب الأحساء - مختبر التصنيع الرقمي
                  <br/>
                  FABLAB Al-Ahsa - Digital Fabrication Laboratory
                </div>
              </div>
              <div style="width: 140px;"></div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
  };

  const handleVerifyPayment = async (studentId, status) => {
    try {
      await api.patch(`/workshops/students/${studentId}/verify`, { paymentStatus: status });
      toast.success(isRTL ? 'تم التحديث' : 'Updated');
      if (viewingWorkshopStudents) {
        const res = await api.get(`/workshops/${viewingWorkshopStudents.workshopId}`);
        setViewingWorkshopStudents(res.data);
      }
    } catch (error) {
      toast.error(isRTL ? 'خطأ' : 'Error');
    }
  };

  const openWorkshopEditModal = (workshop) => {
    setSelectedWorkshop(workshop);
    setWorkshopForm({
      title: workshop.title || '', description: workshop.description || '',
      presenter: workshop.presenter || '', assignedEmployeeId: workshop.assignedEmployeeId || '',
      startDate: workshop.startDate || '', endDate: workshop.endDate || '',
      startTime: workshop.startTime || '', endTime: workshop.endTime || '',
      totalHours: workshop.totalHours || '', content: workshop.content || '',
      objectives: workshop.objectives || '', photo: workshop.photo || '',
      maxParticipants: workshop.maxParticipants || '', price: workshop.price || '',
      notes: workshop.notes || '', color: workshop.color || '#1a56db', minAge: workshop.minAge || '', maxAge: workshop.maxAge || '',
      isPublic: workshop.isPublic !== false
    });
    setShowWorkshopModal(true);
  };

  // Attendance editor helpers ─────────────────────────────────────
  // Enumerate every day between workshop.startDate and workshop.endDate
  // inclusive, as YYYY-MM-DD strings. Used to render one row per day
  // in the attendance edit modal.
  const workshopDaysList = (workshop) => {
    if (!workshop?.startDate) return [];
    const days = [];
    const start = new Date(workshop.startDate);
    const end = workshop.endDate ? new Date(workshop.endDate) : start;
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  };

  const openAttendanceEditor = (student, workshop) => {
    setAttendanceEditTarget({ student, workshop });
  };

  const toggleAttendanceDate = async (date) => {
    if (!attendanceEditTarget) return;
    const student = attendanceEditTarget.student;
    const workshop = attendanceEditTarget.workshop;
    const currentlyPresent = Array.isArray(student.attendanceDates)
      && student.attendanceDates.includes(date);
    const nextPresent = !currentlyPresent;

    // Optimistic UI update in the modal itself
    const nextDates = nextPresent
      ? [...(student.attendanceDates || []), date]
      : (student.attendanceDates || []).filter(d => d !== date);
    setAttendanceEditTarget({
      ...attendanceEditTarget,
      student: { ...student, attendanceDates: nextDates, attended: nextDates.length > 0 }
    });

    setAttendanceEditSaving(true);
    try {
      await api.patch(`/workshops/students/${student.studentId}/attendance`, {
        date, present: nextPresent
      });
      // Refresh the surrounding workshop list so the badge / count in
      // the row behind the modal stays in sync.
      try {
        const res = await api.get(`/workshops/${workshop.workshopId}`);
        setViewingWorkshopStudents(res.data);
        const updated = res.data.students?.find(s => s.studentId === student.studentId);
        if (updated) setAttendanceEditTarget(prev => prev ? { ...prev, student: updated } : prev);
      } catch { /* ignore refresh error, modal state already updated */ }
    } catch (err) {
      console.error('Attendance toggle failed:', err);
      toast.error(isRTL ? 'تعذر تحديث الحضور' : 'Failed to update attendance');
      // Revert
      setAttendanceEditTarget({
        ...attendanceEditTarget,
        student
      });
    } finally {
      setAttendanceEditSaving(false);
    }
  };

  const toggleAllAttendance = async (present) => {
    if (!attendanceEditTarget) return;
    const workshop = attendanceEditTarget.workshop;
    const days = workshopDaysList(workshop);
    if (days.length === 0) return;
    setAttendanceEditSaving(true);
    try {
      // Fire the toggles sequentially so we don't race on the same row
      for (const d of days) {
        await api.patch(`/workshops/students/${attendanceEditTarget.student.studentId}/attendance`, {
          date: d, present
        });
      }
      // Refresh the whole workshop after the batch
      const res = await api.get(`/workshops/${workshop.workshopId}`);
      setViewingWorkshopStudents(res.data);
      const updated = res.data.students?.find(s => s.studentId === attendanceEditTarget.student.studentId);
      if (updated) setAttendanceEditTarget(prev => prev ? { ...prev, student: updated } : prev);
      toast.success(present
        ? (isRTL ? 'تم تعليم كل الأيام كحاضر' : 'All days marked present')
        : (isRTL ? 'تم مسح كل أيام الحضور' : 'All attendance cleared'));
    } catch (err) {
      console.error('Bulk attendance toggle failed:', err);
      toast.error(isRTL ? 'خطأ في التحديث الجماعي' : 'Bulk update failed');
    } finally {
      setAttendanceEditSaving(false);
    }
  };

  // Workshop email functions
  const [showWorkshopEmailModal, setShowWorkshopEmailModal] = useState(false);
  const [workshopEmailTarget, setWorkshopEmailTarget] = useState(null); // null=all, {studentId, email}=one
  const [workshopEmailForm, setWorkshopEmailForm] = useState({ subject: '', message: '' });
  // Invoice print modal (discount + approver)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceTarget, setInvoiceTarget] = useState(null); // { studentId, firstName, price }
  const [invoiceForm, setInvoiceForm] = useState({ discount: '', discountType: 'amount', approver: '', customApprover: '' });

  const handleSendWorkshopEmail = async () => {
    if (!workshopEmailForm.subject || !workshopEmailForm.message) {
      toast.error(isRTL ? 'الموضوع والرسالة مطلوبان' : 'Subject and message required');
      return;
    }
    try {
      if (workshopEmailTarget) {
        await api.post(`/workshops/students/${workshopEmailTarget.studentId}/email`, workshopEmailForm);
        toast.success(isRTL ? 'تم إرسال البريد' : 'Email sent');
      } else {
        const res = await api.post(`/workshops/${viewingWorkshopStudents.workshopId}/email-all`, workshopEmailForm);
        toast.success(isRTL ? `تم الإرسال إلى ${res.data.count} طالب` : `Sent to ${res.data.count} students`);
      }
      setShowWorkshopEmailModal(false);
      setWorkshopEmailForm({ subject: '', message: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || (isRTL ? 'خطأ' : 'Error'));
    }
  };

  const handleGenerateInvoice = async () => {
    if (!invoiceTarget) return;
    const rawDiscount = String(invoiceForm.discount || '').trim();
    const discount = rawDiscount === '' ? 0 : (parseFloat(rawDiscount) || 0);
    const discountType = invoiceForm.discountType === 'percent' ? 'percent' : 'amount';
    let approver = '';
    if (discount > 0) {
      approver = invoiceForm.approver === '__custom__'
        ? (invoiceForm.customApprover || '').trim()
        : (invoiceForm.approver || '').trim();
      if (!approver) {
        toast.error(isRTL ? 'يرجى اختيار أو إدخال اسم من اعتمد الخصم' : 'Please select or enter who approved the discount');
        return;
      }
    }
    try {
      const res = await api.get(`/workshops/students/${invoiceTarget.studentId}/invoice-pdf`, {
        params: { discount, discountType, approver },
        responseType: 'blob'
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      link.download = `invoice_${invoiceTarget.firstName || 'student'}_${Date.now()}.pdf`;
      link.click();
      toast.success(isRTL ? 'تم تحميل الفاتورة' : 'Invoice downloaded');
      setShowInvoiceModal(false);
      setInvoiceTarget(null);
    } catch (e2) {
      let msg = isRTL ? 'خطأ في إنشاء الفاتورة' : 'Error generating invoice';
      if (e2.response?.data instanceof Blob) {
        try { const j = JSON.parse(await e2.response.data.text()); msg = (isRTL ? j.messageAr : j.message) || msg; } catch {}
      }
      toast.error(msg);
    }
  };

  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    try {
      await api.put(`/workshops/students/${editingStudent.studentId}`, editStudentForm);
      toast.success(isRTL ? 'تم تحديث بيانات الطالب' : 'Student updated');
      setEditingStudent(null);
      // Refresh the student list
      const res = await api.get(`/workshops/${viewingWorkshopStudents.workshopId}`);
      setViewingWorkshopStudents(res.data);
    } catch(e) { toast.error(isRTL ? 'خطأ' : 'Error'); }
  };

  const handleAdminAddWorkshopStudent = async () => {
    if (!viewingWorkshopStudents?.workshopId) return;
    if (!workshopAddStudentForm.firstName.trim() || !workshopAddStudentForm.phone.trim()) {
      toast.error(isRTL ? 'الاسم الأول ورقم الهاتف مطلوبان' : 'First name and phone are required');
      return;
    }
    setAddingWorkshopStudent(true);
    try {
      await api.post(`/workshops/${viewingWorkshopStudents.workshopId}/students`, workshopAddStudentForm);
      toast.success(isRTL ? 'تم إضافة الطالب' : 'Student added');
      setShowWorkshopAddStudent(false);
      setWorkshopAddStudentForm(emptyWorkshopStudentForm);
      const res = await api.get(`/workshops/${viewingWorkshopStudents.workshopId}`);
      setViewingWorkshopStudents(res.data);
    } catch (e) {
      const data = e.response?.data;
      toast.error((isRTL ? data?.messageAr : data?.message) || (isRTL ? 'خطأ' : 'Error'));
    } finally {
      setAddingWorkshopStudent(false);
    }
  };

  // Build one workshop attendance-ID card HTML matching the volunteer
  // card layout. Colored by the workshop's own color. Used by both
  // the single-print and 4-per-A4 bulk-print flows.
  const buildWorkshopAttendanceCard = (student, workshop) => {
    const color = workshop?.color || '#1a56db';
    const name = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
    const initial = (name.charAt(0) || 'S').toUpperCase();
    // Encode just the studentId UUID. Cheap USB HID scanners can
    // mangle JSON payloads (curly braces / quotes / colons drop on
    // non-English keyboard layouts). UUIDs use only [0-9a-f-] which
    // survive every keyboard mapping. The server's scan endpoint
    // still accepts old JSON-encoded cards via its JSON branch.
    const qrPayload = student.studentId || '';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
    return `<div class="id-card" style="
      background: linear-gradient(180deg, #ffffff 0%, ${color}10 100%);
    ">
      <div class="card-header" style="background: linear-gradient(135deg, ${color} 0%, ${color} 100%);">
        <div class="card-title">${isRTL ? 'بطاقة حضور فاب لاب الأحساء' : 'FABLAB Al-Ahsa Attendance Card'}</div>
        <div class="card-subtitle">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</div>
      </div>
      <div class="card-body">
        <div class="user-photo" style="background: linear-gradient(135deg, ${color}22, ${color}11); border: 0.6mm solid ${color};">
          <span class="initials" style="color: ${color};">${initial}</span>
        </div>
        <div class="user-name">${name}</div>
        <div class="user-type-badge" style="background: linear-gradient(135deg, ${color}, ${color});">${workshop?.title || (isRTL ? 'ورشة تدريبية' : 'Workshop')}</div>
        <div class="info-section">
          ${student.nationalId ? `<div class="info-row"><span class="info-label">${isRTL ? 'رقم الهوية' : 'National ID'}</span><span class="info-value" dir="ltr">${student.nationalId}</span></div>` : ''}
          ${student.phone ? `<div class="info-row"><span class="info-label">${isRTL ? 'الهاتف' : 'Phone'}</span><span class="info-value" dir="ltr">${student.phone}</span></div>` : ''}
        </div>
        <div class="card-qr"><img src="${qrUrl}" alt="QR" style="box-shadow: 0 0 0 0.3mm ${color} inset;" /></div>
      </div>
      <div class="decorative-stripe" style="background: linear-gradient(to bottom, transparent, ${color}, transparent);"></div>
      <div class="card-footer">
        <img src="/found.png" alt="Foundation" class="logo">
        <span class="qr-label" style="color: ${color};">${isRTL ? 'رمز الحضور' : 'Attendance QR'}</span>
        <img src="/fablab.png" alt="FABLAB" class="logo">
      </div>
    </div>`;
  };

  // Static styles shared by every workshop-attendance-ID print window.
  // Card-specific color tint values are inlined in the card HTML.
  const workshopAttendanceCardStyles = (accentColor) => `
    @page { size: A4 portrait; margin: 10mm 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f1f5f9; }
    body { padding: 6mm 0; }
    .print-note {
      font-size: 12px; color: #475569; background: white;
      border: 1px dashed #cbd5e1; border-radius: 8px;
      padding: 8px 14px; margin: 0 auto 8mm; text-align: center; max-width: 120mm;
    }
    .page {
      display: grid;
      grid-template-columns: 72mm 72mm;
      grid-auto-rows: 102mm;
      column-gap: 6mm; row-gap: 6mm;
      justify-content: center; align-content: start;
      width: 100%;
    }
    .page + .page { page-break-before: always; }
    .id-card {
      width: 72mm; height: 102mm;
      border: 0.45mm dashed #475569;
      overflow: hidden; position: relative;
      display: flex; flex-direction: column;
      color: #1a1a2e; box-sizing: border-box;
    }
    .card-header { padding: 2.5mm 3.5mm; text-align: center; }
    .card-title { color: white; font-size: 9pt; font-weight: 700; line-height: 1.15; }
    .card-subtitle { color: rgba(255,255,255,0.88); font-size: 6.5pt; margin-top: 0.6mm; }
    .card-body {
      flex: 1; padding: 2.5mm 3mm 0;
      display: flex; flex-direction: column; align-items: center; gap: 1.4mm;
    }
    .user-photo {
      width: 22mm; height: 26mm;
      border-radius: 2mm; display: flex; align-items: center; justify-content: center;
      font-weight: bold;
      overflow: hidden; flex-shrink: 0;
    }
    .user-photo .initials { font-size: 18pt; font-weight: bold; }
    .user-name {
      font-size: 10.5pt; font-weight: 800; color: #1a1a2e;
      text-align: center; line-height: 1.15; max-height: 10mm; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .user-type-badge {
      display: inline-block;
      color: white; font-size: 7.5pt; padding: 0.6mm 3.5mm;
      border-radius: 999px; font-weight: 700;
      max-width: 60mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .info-section { width: 100%; display: flex; flex-direction: column; gap: 0.6mm; margin-top: 1mm; }
    .info-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 7.2pt; padding: 0.6mm 0; border-bottom: 0.2mm dotted #d4d4d8;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: 700; color: #555; }
    .info-value {
      color: #1a1a2e; font-weight: 600; text-align: ${isRTL ? 'left' : 'right'};
      max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .card-qr { display: flex; align-items: center; justify-content: center; margin-top: 1mm; }
    .card-qr img {
      width: 26mm; height: 26mm; background: white; padding: 0.8mm; border-radius: 1mm;
    }
    .card-footer {
      background: #ffffff; padding: 1mm 2mm;
      display: flex; align-items: center; justify-content: space-between;
      gap: 1mm;
      border-top: 0.3mm solid #e0e0e0;
      /* footer stays glued to the card bottom edge inside the border */
      overflow: hidden;
    }
    .card-footer .logo {
      max-height: 6mm;
      max-width: 22mm;
      width: auto; height: auto;
      object-fit: contain;
      flex-shrink: 0;
    }
    .card-footer .qr-label {
      font-size: 5.5pt; font-weight: 700;
      white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
      min-width: 0; flex: 0 1 auto;
    }
    .decorative-stripe {
      position: absolute; top: 40%; ${isRTL ? 'right' : 'left'}: 0;
      width: 1mm; height: 25%;
    }
    .print-btn {
      position: fixed; bottom: 20px; ${isRTL ? 'left' : 'right'}: 20px;
      padding: 12px 28px; background: ${accentColor}; color: #fff; border: none;
      border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer;
      box-shadow: 0 4px 14px ${accentColor}55;
    }
    @media print {
      html, body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding: 0; }
      .print-note, .print-btn { display: none; }
      .id-card { box-shadow: none; break-inside: avoid; }
    }
  `;

  // Chunk an array of card-HTMLs into 4-per-A4 pages
  const chunkWorkshopCards = (cards, per = 4) => {
    const pages = [];
    for (let i = 0; i < cards.length; i += per) pages.push(cards.slice(i, i + per));
    return pages;
  };

  const openWorkshopCardsPrintWindow = (cardsHtml, accentColor) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return toast.error(isRTL ? 'فشل فتح نافذة الطباعة' : 'Popup blocked');
    printWindow.document.write(`<!DOCTYPE html><html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
<head><meta charset="UTF-8"><title>${isRTL ? 'بطاقات حضور طلاب' : 'Workshop Student Attendance IDs'}</title>
<style>${workshopAttendanceCardStyles(accentColor)}</style>
</head>
<body>
  <div class="print-note">
    ${isRTL ? 'حجم البطاقة 72×102 ملم — اقطع حسب الخط المتقطع' : 'Card size 72×102 mm — cut along the dashed line'}
  </div>
  ${cardsHtml}
  <button class="print-btn" onclick="window.print()">${isRTL ? 'طباعة' : 'Print'}</button>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  // Print a single student — still hits the server so the payment-
  // verified + today's attendance side-effects fire.
  const handlePrintAttendanceId = async (studentId) => {
    try {
      const res = await api.get(`/workshops/students/${studentId}/attendance-id`);
      const student = res.data.student || {};
      const workshop = res.data.workshop || {};
      const cardHtml = `<div class="page">${buildWorkshopAttendanceCard(student, workshop)}</div>`;
      openWorkshopCardsPrintWindow(cardHtml, workshop.color || '#1a56db');
    } catch (error) {
      toast.error(isRTL ? 'خطأ' : 'Error');
    }
  };

  // Bulk-print every selected student in the current workshop, 4 per
  // A4. Uses the client-side student data (no per-student side-effect
  // hit — bulk printing shouldn't mass-mark everyone as attended).
  const handlePrintSelectedWorkshopIds = () => {
    if (!viewingWorkshopStudents) return;
    const workshop = viewingWorkshopStudents;
    const chosen = (workshop.students || []).filter(s => selectedWorkshopStudentIds.has(s.studentId));
    if (chosen.length === 0) {
      return toast.error(isRTL ? 'لم يتم اختيار أي طالب' : 'No students selected');
    }
    const cards = chosen.map(s => buildWorkshopAttendanceCard(s, workshop));
    const pages = chunkWorkshopCards(cards, 4)
      .map(page => `<div class="page">${page.join('')}</div>`)
      .join('');
    openWorkshopCardsPrintWindow(pages, workshop.color || '#1a56db');
  };

  const toggleWorkshopStudentSelect = (studentId) => {
    setSelectedWorkshopStudentIds(prev => {
      const n = new Set(prev);
      if (n.has(studentId)) n.delete(studentId); else n.add(studentId);
      return n;
    });
  };
  const toggleAllWorkshopStudentSelect = () => {
    if (!viewingWorkshopStudents) return;
    const all = (viewingWorkshopStudents.students || []).map(s => s.studentId);
    setSelectedWorkshopStudentIds(prev => {
      const allSelected = all.length > 0 && all.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(all);
    });
  };
  const clearWorkshopStudentSelect = () => setSelectedWorkshopStudentIds(new Set());

  // Workspace functions
  const fetchWorkspaces = async () => {
    try {
      const response = await api.get('/workspaces');
      setWorkspaces(response.data || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  };

  const fetchWorkspaceStats = async () => {
    try {
      const response = await api.get('/workspaces/statistics');
      setWorkspaceStats(response.data);
    } catch (error) {
      console.error('Error fetching workspace stats:', error);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!workspaceForm.tableNumber || !workspaceForm.personName || !workspaceForm.startDate || !workspaceForm.endDate) {
      toast.error(isRTL ? 'رقم الطاولة والاسم والفترة مطلوبة' : 'Table number, name, and period are required');
      return;
    }
    const activeWorkspaces = workspaces.filter(w => w.status === 'active').length;
    if (activeWorkspaces >= 8) {
      toast.error(isRTL ? 'تم الوصول للحد الأقصى من مساحات العمل (8)' : 'Maximum number of workspaces reached (8)');
      return;
    }
    setWorkspaceLoading(true);
    try {
      await api.post('/workspaces', workspaceForm);
      toast.success(isRTL ? 'تم إضافة مساحة العمل بنجاح' : 'Workspace added successfully');
      fetchWorkspaces();
      fetchWorkspaceStats();
      setShowWorkspaceModal(false);
      setWorkspaceForm({ tableNumber: '', projectName: '', numberOfUsers: 1, personName: '', personPhone: '', personEmail: '', startDate: '', startTime: '', endDate: '', endTime: '', photoBefore: '', notes: '' });
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
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف مساحة العمل هذه؟' : 'Are you sure you want to delete this workspace?')) return;
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
        tableNumber: workspace.tableNumber || '', projectName: workspace.projectName || '', numberOfUsers: workspace.numberOfUsers || 1,
        personName: workspace.personName || '', personPhone: workspace.personPhone || '', personEmail: workspace.personEmail || '',
        startDate: workspace.startDate || '', startTime: workspace.startTime || '',
        endDate: workspace.endDate || '', endTime: workspace.endTime || '',
        photoBefore: workspace.photoBefore || '', notes: workspace.notes || ''
      });
    } else {
      setSelectedWorkspace(null);
      setWorkspaceForm({ tableNumber: '', projectName: '', numberOfUsers: 1, personName: '', personPhone: '', personEmail: '', startDate: '', startTime: '', endDate: '', endTime: '', photoBefore: '', notes: '' });
    }
    setShowWorkspaceModal(true);
  };

  const handleAddWorkspaceRating = async () => {
    const criteria = workspaceRatingForm.criteria === 'other' ? workspaceRatingForm.customCriteria : workspaceRatingForm.criteria;
    if (!selectedWorkspace || !criteria || !workspaceRatingForm.points) {
      toast.error(isRTL ? 'المعيار والنقاط مطلوبة' : 'Criteria and points are required');
      return;
    }
    setWorkspaceLoading(true);
    try {
      const ratingData = { ...workspaceRatingForm, criteria };
      delete ratingData.customCriteria;
      delete ratingData.photoAfter;
      await api.post(`/workspaces/${selectedWorkspace.workspaceId}/ratings`, ratingData);
      if (workspaceRatingForm.photoAfter) {
        await api.put(`/workspaces/${selectedWorkspace.workspaceId}`, { photoAfter: workspaceRatingForm.photoAfter });
      }
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      fetchWorkspaces();
      setShowWorkspaceRatingModal(false);
      setWorkspaceRatingForm({ type: 'award', points: 1, criteria: '', notes: '', ratingDate: new Date().toISOString().split('T')[0], photoAfter: '' });
    } catch (error) {
      toast.error(isRTL ? 'خطأ في إضافة التقييم' : 'Error adding rating');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const openWorkspaceRatingModal = (workspace) => {
    setSelectedWorkspace(workspace);
    setWorkspaceRatingForm({ type: 'award', points: 1, criteria: '', notes: '', ratingDate: new Date().toISOString().split('T')[0], photoAfter: '' });
    setShowWorkspaceRatingModal(true);
  };

  const handleWorkspaceTabClick = () => {
    if (workspaceAuthenticated) {
      setActiveTab('workspaces');
    } else {
      setShowWorkspacePasswordModal(true);
    }
  };

  const handleWorkspacePasswordSubmit = () => {
    if (workspacePasswordInput === WORKSPACE_PASSWORD) {
      setWorkspaceAuthenticated(true);
      setShowWorkspacePasswordModal(false);
      setWorkspacePasswordInput('');
      setActiveTab('workspaces');
      toast.success(isRTL ? 'تم الدخول بنجاح' : 'Access granted');
    } else {
      toast.error(isRTL ? 'كلمة المرور غير صحيحة' : 'Incorrect password');
      setWorkspacePasswordInput('');
    }
  };

  const handlePrintWorkspaceIDCard = (workspace) => {
    const printWindow = window.open('', '_blank');
    const na = isRTL ? 'غير محدد' : 'N/A';
    const startFormatted = workspace.startDate ? format(parseISO(workspace.startDate), 'MMM d, yyyy', { locale: isRTL ? ar : enUS }) : na;
    const endFormatted = workspace.endDate ? format(parseISO(workspace.endDate), 'MMM d, yyyy', { locale: isRTL ? ar : enUS }) : na;

    const idCardContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'بطاقة مساحة عمل' : 'Workspace ID Card'}</title>
        <style>
          @page { size: 53.98mm 100mm; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f0f0; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
          .id-card-wrapper { display: flex; flex-direction: column; align-items: center; }
          .card-holder-area { width: 53.98mm; height: 15mm; background: #f8f9fa; border: 2px dashed #ccc; border-bottom: none; border-radius: 10px 10px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; }
          .punch-hole { width: 8mm; height: 8mm; border: 2px dashed #999; border-radius: 50%; background: white; }
          .cut-line-text { font-size: 7px; color: #999; text-transform: uppercase; letter-spacing: 1px; }
          .id-card { width: 53.98mm; height: 85.6mm; background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%); border-radius: 0 0 10px 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); position: relative; display: flex; flex-direction: column; }
          .card-header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 10px 8px; text-align: center; }
          .card-title { color: white; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
          .card-subtitle { color: rgba(255,255,255,0.85); font-size: 8px; margin-top: 2px; }
          .card-body { flex: 1; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
          .user-photo { width: 70px; height: 85px; background: linear-gradient(135deg, #bfdbfe, #93c5fd); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #1d4ed8; font-size: 32px; font-weight: bold; border: 3px solid #3b82f6; box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15); overflow: hidden; }
          .user-photo img { width: 100%; height: 100%; object-fit: cover; }
          .user-photo .initials { font-size: 32px; font-weight: bold; color: #1d4ed8; }
          .user-name { font-size: 13px; font-weight: 700; color: #1a1a2e; text-align: center; line-height: 1.2; }
          .user-type-badge { display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; font-size: 9px; padding: 3px 12px; border-radius: 12px; font-weight: 600; }
          .table-badge { display: inline-block; background: linear-gradient(135deg, #60a5fa, #3b82f6); color: white; font-size: 9px; padding: 2px 10px; border-radius: 10px; font-weight: 600; margin-top: 2px; }
          .info-section { width: 100%; display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
          .info-row { display: flex; justify-content: space-between; font-size: 9px; padding: 3px 0; border-bottom: 1px dotted #ddd; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 600; color: #555; }
          .info-value { color: #1a1a2e; font-weight: 500; text-align: ${isRTL ? 'left' : 'right'}; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .card-footer { background: #ffffff; padding: 8px 6px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; border-top: 1px solid #e0e0e0; }
          .card-footer .logo { height: 24px; width: auto; flex-shrink: 0; }
          .card-footer .logo-left { order: 1; }
          .card-footer .logo-right { order: 3; }
          .member-id-section { display: flex; flex-direction: column; align-items: center; gap: 1px; order: 2; flex: 1; text-align: center; }
          .member-id-label { font-size: 6px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .member-id-value { font-size: 11px; font-weight: 700; color: #3b82f6; font-family: 'Consolas', 'Courier New', monospace; }
          .decorative-stripe { position: absolute; top: 40%; ${isRTL ? 'right' : 'left'}: 0; width: 3px; height: 25%; background: linear-gradient(to bottom, transparent, #3b82f6, transparent); }
          @media print { body { background: none; padding: 0; min-height: auto; } .id-card-wrapper { box-shadow: none; margin: 0; } .card-holder-area { border: 2px dashed #ccc; border-bottom: none; } .punch-hole { border: 2px dashed #999; } }
        </style>
      </head>
      <body>
        <div class="id-card-wrapper">
          <div class="card-holder-area">
            <div class="punch-hole"></div>
            <span class="cut-line-text">${isRTL ? '✂ خط القطع' : '✂ CUT LINE'}</span>
          </div>
          <div class="id-card">
            <div class="card-header">
              <div class="card-title">${isRTL ? 'بطاقة مساحة عمل فاب لاب الأحساء' : 'FABLAB Al-Ahsa Workspace Card'}</div>
              <div class="card-subtitle">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</div>
            </div>
            <div class="card-body">
              <div class="user-photo">
                ${workspace.photoBefore
                  ? `<img src="${workspace.photoBefore}" alt="${workspace.personName}" />`
                  : `<span class="initials">${workspace.personName.charAt(0).toUpperCase()}</span>`
                }
              </div>
              <div class="user-name">${workspace.personName}</div>
              <div class="user-type-badge">${isRTL ? 'مساحة عمل' : 'Workspace'}</div>
              <div class="table-badge">${isRTL ? 'طاولة' : 'Table'} ${workspace.tableNumber}</div>

              <div class="info-section">
                ${workspace.personPhone ? `<div class="info-row">
                  <span class="info-label">${isRTL ? 'الهاتف' : 'Phone'}</span>
                  <span class="info-value" dir="ltr">${workspace.personPhone}</span>
                </div>` : ''}
                ${workspace.personEmail ? `<div class="info-row">
                  <span class="info-label">${isRTL ? 'البريد' : 'Email'}</span>
                  <span class="info-value">${workspace.personEmail}</span>
                </div>` : ''}
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'من' : 'From'}</span>
                  <span class="info-value">${startFormatted}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'إلى' : 'To'}</span>
                  <span class="info-value">${endFormatted}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'عدد المستخدمين' : 'Users'}</span>
                  <span class="info-value">${workspace.numberOfUsers}</span>
                </div>
              </div>
            </div>
            <div class="decorative-stripe"></div>
            <div class="card-footer">
              <img src="/found.png" alt="Foundation" class="logo logo-left">
              <img src="/fablab.png" alt="FABLAB" class="logo logo-right">
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(idCardContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  const handlePrintWorkspaceBanner = (workspace) => {
    const printWindow = window.open('', '_blank');
    const na = isRTL ? 'غير محدد' : 'N/A';
    const startDateF = workspace.startDate ? format(parseISO(workspace.startDate), 'dd/MM/yyyy', { locale: isRTL ? ar : enUS }) : na;
    const endDateF = workspace.endDate ? format(parseISO(workspace.endDate), 'dd/MM/yyyy', { locale: isRTL ? ar : enUS }) : na;
    const startTimeF = workspace.startTime ? formatTimeAMPM(workspace.startTime) : '';
    const endTimeF = workspace.endTime ? formatTimeAMPM(workspace.endTime) : '';

    const bannerContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'لافتة مساحة العمل' : 'Workspace Banner'}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
          @page { size: A4; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'DM Sans', 'IBM Plex Sans Arabic', 'Segoe UI', sans-serif;
            background: #e8edf2;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
          }
          .banner-wrapper {
            width: 210mm;
            height: 297mm;
            background: #ffffff;
            position: relative;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          }
          .banner-top {
            height: 70mm;
            background: linear-gradient(135deg, #1a56db 0%, #1e40af 40%, #3b82f6 100%);
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: visible;
          }
          .banner-top::before {
            content: '';
            position: absolute;
            inset: 0;
            background: url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          }
          .banner-logo-left {
            position: absolute;
            top: 12px;
            left: 16px;
            z-index: 1;
          }
          .banner-logo-right {
            position: absolute;
            top: 12px;
            right: 16px;
            z-index: 1;
          }
          .banner-logo-left img,
          .banner-logo-right img {
            height: 100px;
            filter: brightness(0) invert(1);
          }
          .banner-org-name {
            color: white;
            font-size: 14px;
            font-weight: 400;
            letter-spacing: 1px;
            opacity: 0.85;
            position: relative;
            z-index: 1;
            margin-bottom: 6px;
            margin-top: 20px;
          }
          .banner-title {
            color: white;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
            position: relative;
            z-index: 1;
          }
          .table-hero {
            position: relative;
            z-index: 2;
            margin-top: 8mm;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .table-number-circle {
            width: 52mm;
            height: 52mm;
            border-radius: 50%;
            background: linear-gradient(145deg, #1a56db, #2563eb);
            box-shadow: 0 8px 32px rgba(26,86,219,0.35), 0 0 0 6px white, 0 0 0 8px rgba(26,86,219,0.15);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
          }
          .table-label {
            font-size: 13px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.8;
          }
          .table-value {
            font-size: 64px;
            font-weight: 800;
            line-height: 1;
            margin-top: 2px;
          }
          .project-section {
            text-align: center;
            margin-top: 8mm;
            padding: 0 20mm;
          }
          .project-label {
            font-size: 11px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 600;
            margin-bottom: 4px;
          }
          .project-name {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            line-height: 1.3;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5mm;
            padding: 10mm 15mm 0;
          }
          .info-card {
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px 16px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }
          .info-card.full-width {
            grid-column: 1 / -1;
          }
          .info-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: linear-gradient(135deg, #dbeafe, #bfdbfe);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: #1a56db;
          }
          .info-details {
            flex: 1;
            min-width: 0;
          }
          .info-card-label {
            font-size: 10px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
            margin-bottom: 3px;
          }
          .info-card-value {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            word-break: break-word;
          }
          .duration-section {
            margin: 8mm 15mm 0;
            background: linear-gradient(135deg, #eff6ff, #dbeafe);
            border: 1.5px solid #bfdbfe;
            border-radius: 14px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
          }
          .duration-block {
            text-align: center;
            flex: 1;
          }
          .duration-label {
            font-size: 10px;
            color: #3b82f6;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .duration-date {
            font-size: 17px;
            font-weight: 700;
            color: #1e40af;
          }
          .duration-time {
            font-size: 13px;
            color: #3b82f6;
            font-weight: 500;
            margin-top: 2px;
          }
          .duration-arrow {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            flex-shrink: 0;
          }
          .duration-arrow svg {
            color: #3b82f6;
            ${isRTL ? 'transform: scaleX(-1);' : ''}
          }
          .rules-section {
            margin: 6mm 15mm 0;
            padding: 0;
          }
          .rules-title {
            font-size: 13px;
            font-weight: 700;
            color: #1e40af;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 5mm;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .rules-title::before,
          .rules-title::after {
            content: '';
            flex: 1;
            height: 1.5px;
            background: linear-gradient(to right, transparent, #bfdbfe, transparent);
          }
          .rules-list {
            list-style: none;
            padding: 0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3mm 5mm;
          }
          .rule-item {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            font-size: 10.5px;
            color: #374151;
            line-height: 1.4;
          }
          .rule-number {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, #dbeafe, #bfdbfe);
            color: #1a56db;
            font-size: 9px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-top: 1px;
          }
          .banner-footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 14mm;
            background: linear-gradient(135deg, #1a56db 0%, #1e40af 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .footer-dot {
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: rgba(255,255,255,0.4);
          }
          .footer-text {
            color: rgba(255,255,255,0.75);
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 1px;
          }
          .side-stripe {
            position: absolute;
            top: 70mm;
            width: 4px;
            height: calc(100% - 70mm - 18mm);
            z-index: 1;
          }
          .side-stripe.left { left: 6mm; }
          .side-stripe.right { right: 6mm; }
          .side-stripe::before {
            content: '';
            position: absolute;
            top: 10%;
            width: 100%;
            height: 80%;
            background: linear-gradient(to bottom, transparent, #3b82f6 30%, #3b82f6 70%, transparent);
            border-radius: 2px;
            opacity: 0.12;
          }
          .print-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: linear-gradient(135deg, #1a56db, #1e40af);
            color: white;
            border: none;
            padding: 14px 32px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(26,86,219,0.35);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 999;
            font-family: 'DM Sans', 'IBM Plex Sans Arabic', sans-serif;
          }
          .print-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(26,86,219,0.45); }
          @media print {
            body { background: none; padding: 0; min-height: auto; }
            .banner-wrapper { box-shadow: none; margin: 0; }
            .print-btn { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="banner-wrapper">
          <div class="banner-top">
            <div class="banner-logo-left">
              <img src="/fablab.png" alt="FABLAB" />
            </div>
            <div class="banner-logo-right">
              <img src="/found.png" alt="Foundation" />
            </div>
            <div class="banner-org-name">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Humanitarian Foundation'}</div>
            <div class="banner-title">${isRTL ? 'فاب لاب الأحساء' : 'FABLAB AL-AHSA'}</div>
          </div>
          <div class="side-stripe left"></div>
          <div class="side-stripe right"></div>
          <div class="table-hero">
            <div class="table-number-circle">
              <span class="table-label">${isRTL ? 'طاولة' : 'TABLE'}</span>
              <span class="table-value">${workspace.tableNumber}</span>
            </div>
          </div>
          ${workspace.projectName ? `
          <div class="project-section">
            <div class="project-label">${isRTL ? 'المشروع' : 'PROJECT'}</div>
            <div class="project-name">${workspace.projectName}</div>
          </div>
          ` : ''}
          <div class="info-grid">
            <div class="info-card">
              <div class="info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div class="info-details">
                <div class="info-card-label">${isRTL ? 'المسؤول / قائد المجموعة' : 'GROUP LEADER'}</div>
                <div class="info-card-value">${workspace.personName}</div>
              </div>
            </div>
            <div class="info-card">
              <div class="info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div class="info-details">
                <div class="info-card-label">${isRTL ? 'عدد الأفراد' : 'NUMBER OF PEOPLE'}</div>
                <div class="info-card-value">${workspace.numberOfUsers} ${isRTL ? 'شخص' : 'Person(s)'}</div>
              </div>
            </div>
            ${workspace.personPhone ? `
            <div class="info-card">
              <div class="info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <div class="info-details">
                <div class="info-card-label">${isRTL ? 'رقم الهاتف' : 'PHONE NUMBER'}</div>
                <div class="info-card-value" dir="ltr">${workspace.personPhone}</div>
              </div>
            </div>
            ` : ''}
            ${workspace.personEmail ? `
            <div class="info-card">
              <div class="info-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div class="info-details">
                <div class="info-card-label">${isRTL ? 'البريد الإلكتروني' : 'EMAIL'}</div>
                <div class="info-card-value">${workspace.personEmail}</div>
              </div>
            </div>
            ` : ''}
          </div>
          <div class="duration-section">
            <div class="duration-block">
              <div class="duration-label">${isRTL ? 'من' : 'FROM'}</div>
              <div class="duration-date">${startDateF}</div>
              <div class="duration-time">${startTimeF}</div>
            </div>
            <div class="duration-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div class="duration-block">
              <div class="duration-label">${isRTL ? 'إلى' : 'TO'}</div>
              <div class="duration-date">${endDateF}</div>
              <div class="duration-time">${endTimeF}</div>
            </div>
          </div>
          <div class="rules-section">
            <div class="rules-title">
              ${isRTL ? 'شروط وأحكام استخدام مساحة العمل' : 'Workspace Terms & Conditions'}
            </div>
            <ul class="rules-list">
              <li class="rule-item">
                <span class="rule-number">1</span>
                <span>${isRTL ? 'يجب الحفاظ على نظافة وترتيب مساحة العمل في جميع الأوقات' : 'Keep the workspace clean and organized at all times'}</span>
              </li>
              <li class="rule-item">
                <span class="rule-number">2</span>
                <span>${isRTL ? 'يجب وضع كيس بلاستيكي على الطاولة قبل البدء بالعمل' : 'Place a plastic cover on the table before starting work'}</span>
              </li>
              <li class="rule-item">
                <span class="rule-number">3</span>
                <span>${isRTL ? 'يمنع إتلاف أو إلحاق الضرر بالأدوات والمعدات' : 'Do not damage or misuse tools and equipment'}</span>
              </li>
              <li class="rule-item">
                <span class="rule-number">4</span>
                <span>${isRTL ? 'يجب إعادة جميع الأدوات إلى أماكنها بعد الاستخدام وعدم فقدانها' : 'Return all tools to their places after use — do not lose them'}</span>
              </li>
              <li class="rule-item">
                <span class="rule-number">5</span>
                <span>${isRTL ? 'الالتزام بالفترة الزمنية المحددة للحجز فقط' : 'You may only use the workspace during your reserved period'}</span>
              </li>
              <li class="rule-item">
                <span class="rule-number">6</span>
                <span>${isRTL ? 'في حال الحاجة لوقت إضافي، يجب عمل حجز جديد' : 'If you need more time, you must make a new reservation'}</span>
              </li>
              <li class="rule-item">
                <span class="rule-number">7</span>
                <span>${isRTL ? 'يجب ارتداء معدات السلامة عند استخدام الآلات' : 'Wear safety gear when operating machinery'}</span>
              </li>
              <li class="rule-item">
                <span class="rule-number">8</span>
                <span>${isRTL ? 'يمنع إدخال الطعام والمشروبات إلى منطقة العمل' : 'No food or drinks allowed in the work area'}</span>
              </li>
            </ul>
          </div>
          <div class="banner-footer">
            <div class="footer-dot"></div>
            <span class="footer-text">${isRTL ? 'فاب لاب الأحساء — نصنع المستقبل' : 'FABLAB Al-Ahsa — We Build The Future'}</span>
            <div class="footer-dot"></div>
          </div>
        </div>
        <button class="print-btn" onclick="window.print()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          ${isRTL ? 'طباعة اللافتة' : 'Print Banner'}
        </button>
      </body>
      </html>
    `;

    printWindow.document.write(bannerContent);
    printWindow.document.close();
    printWindow.focus();
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    toast.success(isRTL ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully');
    navigate('/admin/login');
  };

  // Borrowing functions
  const fetchBorrowings = async (page = 1) => {
    setLoadingBorrowings(true);
    try {
      const params = new URLSearchParams();
      Object.entries(borrowingFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', page);
      params.append('limit', borrowingPagination.limit);
      const response = await api.get(`/borrowing?${params.toString()}`);
      setBorrowings(response.data.borrowings || []);
      if (response.data.pagination) {
        setBorrowingPagination(prev => ({ ...prev, ...response.data.pagination }));
      }
    } catch (error) {
      console.error('Error fetching borrowings:', error);
    } finally {
      setLoadingBorrowings(false);
    }
  };

  const handleApproveBorrowing = async (borrowingId) => {
    try {
      await api.put(`/borrowing/${encodeURIComponent(borrowingId)}/status`, { status: 'approved', adminNotes: borrowingAdminNotes });
      toast.success(isRTL ? 'تمت الموافقة على طلب الاستعارة' : 'Borrowing request approved');
      setShowBorrowingModal(false);
      setBorrowingAdminNotes('');
      fetchBorrowings();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في الموافقة' : 'Error approving');
    }
  };

  const handleRejectBorrowing = async (borrowingId) => {
    try {
      await api.put(`/borrowing/${encodeURIComponent(borrowingId)}/status`, { status: 'rejected', adminNotes: borrowingAdminNotes });
      toast.success(isRTL ? 'تم رفض طلب الاستعارة' : 'Borrowing request rejected');
      setShowBorrowingModal(false);
      setBorrowingAdminNotes('');
      fetchBorrowings();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في الرفض' : 'Error rejecting');
    }
  };

  const handleMarkReturned = async (borrowingId) => {
    try {
      await api.put(`/borrowing/${encodeURIComponent(borrowingId)}/return`, { componentPhotoAfter: returnPhotoData, adminNotes: borrowingAdminNotes });
      toast.success(isRTL ? 'تم تسجيل الإرجاع بنجاح' : 'Return recorded successfully');
      setShowBorrowingModal(false);
      setBorrowingAdminNotes('');
      setReturnPhotoData('');
      fetchBorrowings();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في تسجيل الإرجاع' : 'Error recording return');
    }
  };

  const handleReturnPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setReturnPhotoData(event.target.result);
    reader.readAsDataURL(file);
  };

  const handlePrintBorrowingDocument = (borrowing) => {
    const printWindow = window.open('', '_blank');
    const userName = borrowing.user?.firstName && borrowing.user?.lastName
      ? `${borrowing.user.firstName} ${borrowing.user.lastName}`
      : borrowing.user?.name || 'N/A';
    const sectionLabel = sectionLabels[borrowing.section] || borrowing.section;
    const formatDatePrint = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    const termsContent = [
      { en: 'The borrower is fully responsible for the borrowed items and must return them in the same condition.', ar: 'يتحمل المستعير المسؤولية الكاملة عن العناصر المستعارة ويجب إعادتها بنفس الحالة.' },
      { en: 'Items must be returned by the specified return date.', ar: 'يجب إعادة العناصر في تاريخ الإرجاع المحدد.' },
      { en: 'Maximum borrowing period is 30 days. For longer periods, a new request must be submitted.', ar: 'الحد الأقصى لفترة الاستعارة 30 يومًا. للفترات الأطول، يجب تقديم طلب جديد.' },
      { en: 'Late returns will result in warning emails. After 3 warnings, FABLAB will contact the borrower directly.', ar: 'سيؤدي التأخير في الإرجاع إلى رسائل تحذيرية. بعد 3 تحذيرات، سيتواصل فاب لاب مع المستعير مباشرة.' },
      { en: 'Any damage or loss of borrowed items must be reported immediately.', ar: 'يجب الإبلاغ فورًا عن أي ضرر أو فقدان للعناصر المستعارة.' },
      { en: 'The borrower is liable for repair or replacement costs of damaged/lost items.', ar: 'يتحمل المستعير تكاليف إصلاح أو استبدال العناصر التالفة أو المفقودة.' },
      { en: 'Borrowed items may not be transferred to third parties.', ar: 'لا يجوز نقل العناصر المستعارة إلى أطراف ثالثة.' },
      { en: 'FABLAB reserves the right to request early return of items if needed.', ar: 'يحتفظ فاب لاب بالحق في طلب الإرجاع المبكر للعناصر عند الحاجة.' },
      { en: 'Repeated late returns may result in suspension of borrowing privileges.', ar: 'قد يؤدي التأخير المتكرر في الإرجاع إلى تعليق صلاحيات الاستعارة.' },
      { en: 'By signing, the borrower acknowledges and agrees to all terms above.', ar: 'بالتوقيع، يقر المستعير ويوافق على جميع الشروط المذكورة أعلاه.' }
    ];

    const borrowDays = borrowing.borrowDate && borrowing.expectedReturnDate
      ? Math.ceil((new Date(borrowing.expectedReturnDate) - new Date(borrowing.borrowDate)) / (1000 * 60 * 60 * 24))
      : 'N/A';

    const statusLabelsMap = {
      pending: { ar: 'قيد المراجعة', en: 'Pending' },
      approved: { ar: 'مقبول', en: 'Approved' },
      borrowed: { ar: 'مستعار', en: 'Borrowed' },
      returned: { ar: 'تم الإرجاع', en: 'Returned' },
      overdue: { ar: 'متأخر', en: 'Overdue' },
      rejected: { ar: 'مرفوض', en: 'Rejected' }
    };
    const statusDisplay = statusLabelsMap[borrowing.status] || { ar: borrowing.status, en: borrowing.status };

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>Borrowing Agreement - ${borrowing.borrowingId}</title>
        <style>
          @page { size: A4; margin: 15mm 12mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; font-size: 12px; line-height: 1.6; color: #333; }
          .page { width: 100%; min-height: 267mm; padding: 0 5px; position: relative; }
          .page-break { page-break-before: always; }
          .header { background: linear-gradient(135deg, #1a56db, #2563eb); color: white; padding: 20px 25px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .header-center { text-align: center; flex: 1; }
          .header-center h1 { font-size: 22px; margin: 0; font-weight: 800; }
          .header-center h2 { font-size: 14px; font-weight: 600; opacity: 0.9; margin: 6px 0 0 0; }
          .header img { width: 65px; height: 65px; object-fit: contain; }
          .id-bar { display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 13px; }
          .id-bar span { background: #eff6ff; padding: 8px 16px; border-radius: 8px; color: #1e40af; font-weight: 700; border: 1px solid #bfdbfe; }
          .section-title { background: #1e40af; color: white; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 700; margin: 18px 0 12px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
          .info-item { display: flex; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
          .info-item .label { color: #64748b; font-weight: 600; font-size: 12px; }
          .info-item .value { color: #1e293b; font-weight: 600; font-size: 13px; }
          .info-block { padding: 12px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 10px; }
          .info-block .label { color: #64748b; font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px; }
          .info-block .value { color: #1e293b; font-weight: 500; font-size: 13px; line-height: 1.7; }
          .photo-section { text-align: center; margin: 15px 0; }
          .photo-section img { max-width: 320px; max-height: 220px; border-radius: 10px; border: 3px solid #e2e8f0; }
          .period-summary { display: flex; justify-content: center; gap: 30px; margin: 15px 0; padding: 15px; background: #eff6ff; border-radius: 10px; border: 1px solid #bfdbfe; }
          .period-item { text-align: center; }
          .period-item .period-label { font-size: 11px; color: #64748b; font-weight: 600; }
          .period-item .period-value { font-size: 16px; color: #1e40af; font-weight: 700; margin-top: 4px; }
          .terms-list { margin: 12px 0; }
          .term-item { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
          .term-num { background: #1e40af; color: white; border-radius: 50%; min-width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; margin-top: 2px; }
          .term-text { font-size: 12px; line-height: 1.6; }
          .term-text .ar { color: #333; font-weight: 500; }
          .term-text .en { color: #64748b; font-size: 11px; margin-top: 2px; }
          .acknowledgment { background: #eff6ff; border: 2px solid #1e40af; border-radius: 10px; padding: 18px; margin: 20px 0; text-align: center; }
          .acknowledgment p { font-size: 13px; color: #1e40af; font-weight: 600; line-height: 1.8; }
          .signatures { display: flex; justify-content: space-around; margin-top: 30px; padding-top: 20px; }
          .sig-block { text-align: center; width: 42%; }
          .sig-line { border-bottom: 2px solid #333; margin: 40px 0 8px 0; }
          .sig-label { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 5px; }
          .sig-typed { font-style: italic; font-family: 'Brush Script MT', cursive, serif; font-size: 20px; color: #1e40af; margin-top: 8px; }
          .sig-name { font-size: 11px; color: #666; margin-top: 4px; }
          .sig-date { font-size: 10px; color: #999; margin-top: 2px; }
          .footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 2px solid #e2e8f0; color: #94a3b8; font-size: 10px; }
          .footer p { margin: 2px 0; }
          .stamp-area { display: flex; justify-content: center; margin: 15px 0; }
          .stamp-box { width: 120px; height: 120px; border: 2px dashed #cbd5e1; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; font-weight: 600; }
          @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { min-height: auto; } }
        </style>
      </head>
      <body>
        <!-- PAGE 1: Borrowing Details -->
        <div class="page">
          <div class="header">
            <img src="/logo.png" alt="FABLAB" />
            <div class="header-center">
              <h1>فاب لاب الأحساء | FABLAB Al-Ahsa</h1>
              <h2>اتفاقية استعارة مكونات | Component Borrowing Agreement</h2>
            </div>
            <img src="/found.png" alt="Foundation" />
          </div>

          <div class="id-bar">
            <span>رقم الاستعارة | Borrowing ID: ${borrowing.borrowingId}</span>
            <span>الحالة | Status: ${statusDisplay.ar} | ${statusDisplay.en}</span>
            <span>التاريخ | Date: ${formatDatePrint(borrowing.createdAt)}</span>
          </div>

          <div class="section-title">المعلومات الشخصية | Personal Information</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">الاسم الكامل | Full Name</span><span class="value">${userName}</span></div>
            <div class="info-item"><span class="label">رقم الهوية | National ID</span><span class="value">${borrowing.user?.nationalId || 'N/A'}</span></div>
            <div class="info-item"><span class="label">رقم الهاتف | Phone</span><span class="value">${borrowing.user?.phoneNumber || 'N/A'}</span></div>
            <div class="info-item"><span class="label">البريد الإلكتروني | Email</span><span class="value">${borrowing.user?.email || 'N/A'}</span></div>
            <div class="info-item"><span class="label">الجنسية | Nationality</span><span class="value">${borrowing.user?.nationality || 'N/A'}</span></div>
            <div class="info-item"><span class="label">الجنس | Gender</span><span class="value">${borrowing.user?.sex || 'N/A'}</span></div>
          </div>

          <div class="section-title">تفاصيل الاستعارة | Borrowing Details</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">القسم | Section</span><span class="value">${sectionLabel}</span></div>
            <div class="info-item"><span class="label">مدة الاستعارة | Duration</span><span class="value">${borrowDays} يوم | ${borrowDays} days</span></div>
            <div class="info-item"><span class="label">تاريخ الاستعارة | Borrow Date</span><span class="value">${formatDatePrint(borrowing.borrowDate)}</span></div>
            <div class="info-item"><span class="label">تاريخ الإرجاع المتوقع | Expected Return</span><span class="value">${formatDatePrint(borrowing.expectedReturnDate)}</span></div>
          </div>

          <div class="info-block">
            <span class="label">الغرض من الاستعارة | Purpose of Borrowing:</span>
            <span class="value">${borrowing.purpose}</span>
          </div>
          <div class="info-block">
            <span class="label">وصف المكونات المستعارة | Description of Borrowed Components:</span>
            <span class="value">${borrowing.componentDescription}</span>
          </div>

          ${borrowing.componentPhotoBefore ? `
            <div class="section-title">صورة المكونات عند الاستلام | Component Photo at Checkout</div>
            <div class="photo-section">
              <img src="${borrowing.componentPhotoBefore}" alt="Components" />
            </div>
          ` : ''}

          <div class="period-summary">
            <div class="period-item">
              <div class="period-label">تاريخ الاستعارة | Borrow Date</div>
              <div class="period-value">${formatDatePrint(borrowing.borrowDate)}</div>
            </div>
            <div class="period-item">
              <div class="period-label">مدة الاستعارة | Duration</div>
              <div class="period-value">${borrowDays} يوم | days</div>
            </div>
            <div class="period-item">
              <div class="period-label">تاريخ الإرجاع | Return Date</div>
              <div class="period-value">${formatDatePrint(borrowing.expectedReturnDate)}</div>
            </div>
          </div>

          <div class="footer">
            <p>فاب لاب الأحساء - مؤسسة الأحساء | FABLAB Al-Ahsa - Al-Ahsa Foundation</p>
            <p>صفحة 1 من 2 | Page 1 of 2</p>
          </div>
        </div>

        <!-- PAGE 2: Terms, Conditions & Signatures -->
        <div class="page page-break">
          <div class="header">
            <img src="/logo.png" alt="FABLAB" />
            <div class="header-center">
              <h1>فاب لاب الأحساء | FABLAB Al-Ahsa</h1>
              <h2>الشروط والأحكام | Terms & Conditions</h2>
            </div>
            <img src="/found.png" alt="Foundation" />
          </div>

          <div class="id-bar">
            <span>رقم الاستعارة | Borrowing ID: ${borrowing.borrowingId}</span>
            <span>المستعير | Borrower: ${userName}</span>
          </div>

          <div class="section-title">الشروط والأحكام | Terms & Conditions</div>
          <div class="terms-list">
            ${termsContent.map((t, i) => `
              <div class="term-item">
                <span class="term-num">${i + 1}</span>
                <div class="term-text">
                  <div class="ar">${t.ar}</div>
                  <div class="en">${t.en}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="acknowledgment">
            <p>أقر أنا الموقع أدناه بأنني قد قرأت وفهمت جميع الشروط والأحكام المذكورة أعلاه وأوافق على الالتزام بها</p>
            <p>I, the undersigned, acknowledge that I have read, understood, and agree to comply with all the above terms and conditions.</p>
          </div>

          <div class="signatures">
            <div class="sig-block">
              <div class="sig-label">توقيع المستعير | Borrower Signature</div>
              <div class="sig-typed">${borrowing.signature || ''}</div>
              <div class="sig-line"></div>
              <div class="sig-name">${userName}</div>
              <div class="sig-date">${formatDatePrint(borrowing.createdAt)}</div>
            </div>
            <div class="sig-block">
              <div class="sig-label">توقيع موظف فاب لاب | FABLAB Employee</div>
              <div class="sig-line"></div>
              <div class="sig-name">____________________</div>
              <div class="sig-date">${formatDatePrint(new Date())}</div>
            </div>
          </div>

          <div class="stamp-area">
            <div class="stamp-box">ختم فاب لاب<br/>FABLAB Stamp</div>
          </div>

          <div class="footer" style="margin-top: 40px;">
            <p>هذه الوثيقة صادرة من نظام فاب لاب الأحساء لإدارة الاستعارات</p>
            <p>This document is issued by the FABLAB Al-Ahsa Borrowing Management System</p>
            <p style="margin-top: 6px;">فاب لاب الأحساء - مؤسسة الأحساء | FABLAB Al-Ahsa - Al-Ahsa Foundation</p>
            <p>صفحة 2 من 2 | Page 2 of 2</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  // Open status modal for approval/rejection
  const handleOpenStatusModal = (registration, action) => {
    setStatusModalRegistration(registration);
    setStatusModalAction(action);
    setStatusMessage('');
    setRejectionReason('');
    setStatusChangeReason('');
    setSendMessageInEmail(false);
    // Track if this is a status change (not initial decision)
    setIsStatusChange(registration.status === 'approved' || registration.status === 'rejected');
    setShowStatusModal(true);
  };

  // Submit status change with message
  const handleStatusSubmit = async () => {
    if (!statusModalRegistration) return;

    // Validate rejection reason for rejections
    if (statusModalAction === 'reject' && !rejectionReason.trim()) {
      toast.error(isRTL ? 'يرجى إدخال سبب الرفض' : 'Please enter rejection reason');
      return;
    }

    try {
      const encodedId = encodeURIComponent(statusModalRegistration.registrationId);
      await api.patch(`/admin/registrations/${encodedId}/status`, {
        status: statusModalAction === 'approve' ? 'approved' : 'rejected',
        rejectionReason: statusModalAction === 'reject' ? rejectionReason : null,
        adminMessage: statusMessage || null,
        sendMessageInEmail: sendMessageInEmail,
        statusChangeReason: isStatusChange ? (statusChangeReason || null) : null,
        isStatusChange: isStatusChange,
        previousStatus: isStatusChange ? statusModalRegistration.status : null
      });

      // Different success messages for status changes vs initial decisions
      if (isStatusChange) {
        toast.success(isRTL
          ? (statusModalAction === 'approve' ? 'تم تغيير الحالة إلى مقبول' : 'تم تغيير الحالة إلى مرفوض')
          : (statusModalAction === 'approve' ? 'Status changed to approved' : 'Status changed to rejected')
        );
      } else {
        toast.success(isRTL
          ? (statusModalAction === 'approve' ? 'تم قبول الطلب بنجاح' : 'تم رفض الطلب بنجاح')
          : (statusModalAction === 'approve' ? 'Registration approved successfully' : 'Registration rejected successfully')
        );
      }

      fetchRegistrations();
      fetchAnalytics();
      setShowStatusModal(false);
      setShowModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  // Legacy function for direct status change (kept for compatibility)
  const handleStatusChange = async (registrationId, newStatus) => {
    const registration = registrations.find(r => r.registrationId === registrationId) || selectedRegistration;
    handleOpenStatusModal(registration, newStatus === 'approved' ? 'approve' : 'reject');
  };

  // Bulk selection functions
  const handleToggleSelection = (registrationId) => {
    setSelectedRegistrations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(registrationId)) {
        newSet.delete(registrationId);
      } else {
        newSet.add(registrationId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allIds = registrations.map(r => r.registrationId);
    setSelectedRegistrations(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedRegistrations(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedRegistrations.size === 0) {
      toast.warning(isRTL ? 'يرجى اختيار تسجيلات للحذف' : 'Please select registrations to delete');
      return;
    }

    const confirmed = window.confirm(
      isRTL
        ? `هل أنت متأكد من حذف ${selectedRegistrations.size} تسجيل؟`
        : `Are you sure you want to delete ${selectedRegistrations.size} registration(s)?`
    );

    if (!confirmed) return;

    try {
      await api.post('/admin/registrations/bulk-delete', {
        ids: Array.from(selectedRegistrations)
      });

      toast.success(
        isRTL
          ? `تم حذف ${selectedRegistrations.size} تسجيل بنجاح`
          : `${selectedRegistrations.size} registration(s) deleted successfully`
      );

      setSelectedRegistrations(new Set());
      fetchRegistrations();
      fetchAnalytics();
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error(isRTL ? 'خطأ في حذف التسجيلات' : 'Error deleting registrations');
    }
  };

  const handleBulkExport = async () => {
    if (selectedRegistrations.size === 0) {
      toast.warning(isRTL ? 'يرجى اختيار تسجيلات للتصدير' : 'Please select registrations to export');
      return;
    }

    try {
      const response = await api.post('/admin/registrations/export-selected', {
        ids: Array.from(selectedRegistrations)
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `selected_registrations_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(isRTL ? 'تم تصدير التسجيلات المحددة' : 'Selected registrations exported');
    } catch (error) {
      console.error('Error exporting selected:', error);
      toast.error(isRTL ? 'خطأ في تصدير التسجيلات' : 'Error exporting registrations');
    }
  };

  // User selection functions
  const handleSelectAllUsers = () => {
    const newSelected = new Set(selectedUsers);
    users.forEach(u => newSelected.add(u.userId));
    setSelectedUsers(newSelected);
  };

  const handleDeselectAllUsers = () => {
    const newSelected = new Set(selectedUsers);
    users.forEach(u => newSelected.delete(u.userId));
    setSelectedUsers(newSelected);
  };

  const handleDeselectAllUsersGlobal = () => {
    setSelectedUsers(new Set());
  };

  const handleSelectAllUsersAllPages = async () => {
    try {
      const params = new URLSearchParams();
      params.append('page', 1);
      params.append('limit', userPagination.total || 10000);
      if (userSearch) params.append('search', userSearch);
      const response = await api.get(`/admin/users?${params.toString()}`);
      const allUsers = response.data.users || [];
      const allIds = new Set(allUsers.map(u => u.userId));
      setSelectedUsers(allIds);
      toast.success(isRTL
        ? `تم تحديد ${allIds.size} مستخدم`
        : `Selected all ${allIds.size} users`);
    } catch (error) {
      console.error('Error selecting all users:', error);
      toast.error(isRTL ? 'خطأ في تحديد جميع المستخدمين' : 'Error selecting all users');
    }
  };

  const handleToggleUser = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleExportSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.warning(isRTL ? 'يرجى اختيار مستخدمين للتصدير' : 'Please select users to export');
      return;
    }

    try {
      const response = await api.post('/admin/users/export-selected', {
        ids: Array.from(selectedUsers)
      }, { responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `selected_users_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(isRTL ? 'تم تصدير المستخدمين المحددين' : 'Selected users exported');
    } catch (error) {
      console.error('Error exporting selected users:', error);
      toast.error(isRTL ? 'خطأ في تصدير المستخدمين' : 'Error exporting users');
    }
  };

  const handleSendEmailToUsers = async () => {
    if (selectedUsers.size === 0) {
      toast.warning(isRTL ? 'يرجى اختيار مستخدمين' : 'Please select users');
      return;
    }
    if (!emailSubject.trim()) {
      toast.error(isRTL ? 'يرجى إدخال عنوان الرسالة' : 'Please enter a subject');
      return;
    }
    if (!emailMessage.trim()) {
      toast.error(isRTL ? 'يرجى إدخال نص الرسالة' : 'Please enter a message');
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await api.post('/admin/users/send-email', {
        userIds: Array.from(selectedUsers),
        subject: emailSubject,
        message: emailMessage
      });

      const { successCount, failCount } = response.data;
      if (failCount === 0) {
        toast.success(isRTL
          ? `تم إرسال البريد بنجاح إلى ${successCount} مستخدم`
          : `Email sent successfully to ${successCount} user(s)`);
      } else {
        toast.warning(isRTL
          ? `تم الإرسال: ${successCount} نجاح، ${failCount} فشل`
          : `Sent: ${successCount} successful, ${failCount} failed`);
      }

      setShowEmailModal(false);
      setEmailSubject('');
      setEmailMessage('');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(isRTL ? 'خطأ في إرسال البريد الإلكتروني' : 'Error sending email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrintRegistration = (registration) => {
    const printWindow = window.open('', '_blank');
    const userName = registration.user?.firstName && registration.user?.lastName
      ? `${registration.user.firstName} ${registration.user.lastName}`
      : registration.user?.name || (isRTL ? 'غير متوفر' : 'N/A');

    // Get duration
    const getDuration = () => {
      if (registration.appointmentDuration) {
        return `${registration.appointmentDuration} ${isRTL ? 'دقيقة' : 'minutes'}`;
      }
      if (registration.visitEndTime && registration.visitStartTime) {
        return `${formatTimeAMPM(registration.visitStartTime)} - ${formatTimeAMPM(registration.visitEndTime)}`;
      }
      if (registration.endTime && registration.startTime) {
        return `${formatTimeAMPM(registration.startTime)} - ${formatTimeAMPM(registration.endTime)}`;
      }
      return isRTL ? 'غير متوفر' : 'N/A';
    };

    // Translate services for print
    const getTranslatedServices = () => {
      if (!registration.requiredServices || !Array.isArray(registration.requiredServices)) {
        return isRTL ? 'غير متوفر' : 'N/A';
      }
      const printServiceLabels = {
        'In-person consultation': isRTL ? 'استشارة حضورية' : 'In-person Consultation',
        'Online consultation': isRTL ? 'استشارة عن بعد' : 'Online Consultation',
        'Machine/Device reservation': isRTL ? 'حجز جهاز / آلة' : 'Machine/Device Reservation',
        'Personal workspace': isRTL ? 'مساحة عمل شخصية' : 'Personal Workspace',
        'Support in project implementation': isRTL ? 'دعم في تنفيذ المشروع' : 'Project Implementation Support',
        'Volunteering': isRTL ? 'تطوع' : 'Volunteering',
        'Other': isRTL ? 'أخرى' : 'Other'
      };
      return registration.requiredServices.map(s => printServiceLabels[s] || s).join('، ');
    };

    // Translate status
    const getStatusLabel = () => {
      const labels = {
        pending: isRTL ? 'قيد المراجعة' : 'Pending',
        approved: isRTL ? 'مقبول' : 'Approved',
        rejected: isRTL ? 'مرفوض' : 'Rejected'
      };
      return labels[registration.status] || registration.status;
    };

    // Translate section
    const getSectionLabel = () => {
      const labels = {
        'Electronics and Programming': isRTL ? 'الإلكترونيات والبرمجة' : 'Electronics & Programming',
        'CNC Laser': isRTL ? 'الليزر CNC' : 'CNC Laser',
        'CNC Wood': isRTL ? 'الخشب CNC' : 'CNC Wood',
        'CNC Metal': isRTL ? 'المعادن CNC' : 'CNC Metal',
        '3D': isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing',
        'Robotic and AI': isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI',
        "Kid's Club": isRTL ? 'نادي الأطفال' : "Kid's Club",
        'Vinyl Cutting': isRTL ? 'قطع الفينيل' : 'Vinyl Cutting',
        'UV Printing and Sticker Making': isRTL ? 'طباعة UV والملصقات' : 'UV Printing & Stickers'
      };
      return labels[registration.fablabSection] || registration.fablabSection || (isRTL ? 'غير متوفر' : 'N/A');
    };

    // Translate application type
    const getAppTypeLabel = () => {
      const labels = {
        'Beneficiary': isRTL ? 'مستفيد' : 'Beneficiary',
        'Visitor': isRTL ? 'زائر' : 'Visitor',
        'Volunteer': isRTL ? 'متطوع' : 'Volunteer',
        'Talented': isRTL ? 'موهوب' : 'Talented',
        'Entity': isRTL ? 'جهة' : 'Entity',
        'FABLAB Visit': isRTL ? 'زيارة فاب لاب' : 'FABLAB Visit'
      };
      return labels[registration.user?.applicationType] || registration.user?.applicationType || (isRTL ? 'غير متوفر' : 'N/A');
    };

    const na = isRTL ? 'غير متوفر' : 'N/A';

    const printContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <title>${isRTL ? 'نموذج التسجيل' : 'Registration Form'} - ${registration.registrationId}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            padding: 15px;
            background: #fff;
            font-size: 11px;
            line-height: 1.4;
            color: #333;
          }

          /* Top IDs Bar */
          .ids-bar {
            display: flex;
            justify-content: space-between;
            background: linear-gradient(135deg, #e02529, #c41e24);
            color: white;
            padding: 8px 15px;
            border-radius: 6px;
            margin-bottom: 12px;
            font-weight: 600;
            font-size: 12px;
          }
          .ids-bar span { display: flex; align-items: center; gap: 5px; }

          /* Header with Logos */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 12px;
            border-bottom: 2px solid #e02529;
            margin-bottom: 15px;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .logo-container img {
            height: 55px;
            width: auto;
            object-fit: contain;
          }
          .header-center {
            text-align: center;
            flex: 1;
          }
          .header-title {
            font-size: 16px;
            font-weight: 700;
            color: #e02529;
            margin-bottom: 3px;
          }
          .header-subtitle {
            font-size: 11px;
            color: #666;
          }

          /* Form Title */
          .form-title {
            text-align: center;
            font-size: 14px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 12px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 6px;
            border-${isRTL ? 'right' : 'left'}: 4px solid #e02529;
          }

          /* Sections */
          .section {
            margin-bottom: 12px;
            background: #fafafa;
            border-radius: 6px;
            padding: 10px;
            border: 1px solid #eee;
          }
          .section-title {
            font-size: 11px;
            font-weight: 700;
            color: #e02529;
            margin-bottom: 8px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e02529;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          /* Field Grid */
          .field-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
          .field-grid-2 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
          .field {
            background: white;
            padding: 6px 8px;
            border-radius: 4px;
            border: 1px solid #e5e5e5;
          }
          .field-label {
            font-size: 9px;
            color: #888;
            margin-bottom: 2px;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          .field-value {
            font-size: 11px;
            color: #333;
            font-weight: 500;
          }
          .field-full { grid-column: span 3; }
          .field-full-2 { grid-column: span 2; }

          /* Status Badge */
          .status {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
          }
          .status.pending { background: #fff3cd; color: #856404; }
          .status.approved { background: #d4edda; color: #155724; }
          .status.rejected { background: #f8d7da; color: #721c24; }

          /* Signature Section */
          .signature-section {
            margin-top: 15px;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px dashed #ccc;
          }
          .signature-title {
            font-size: 11px;
            font-weight: 700;
            color: #333;
            margin-bottom: 10px;
            text-align: center;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .signature-box {
            text-align: center;
          }
          .signature-label {
            font-size: 10px;
            color: #666;
            margin-bottom: 25px;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 30px;
            padding-top: 5px;
            font-size: 9px;
            color: #888;
          }

          /* Footer */
          .footer {
            margin-top: 12px;
            text-align: center;
            font-size: 9px;
            color: #888;
            padding-top: 8px;
            border-top: 1px solid #eee;
          }

          @media print {
            body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <!-- Top IDs Bar -->
        <div class="ids-bar">
          <span>${isRTL ? 'رقم المستخدم:' : 'User ID:'} ${registration.userId}</span>
          <span>${isRTL ? 'رقم التسجيل:' : 'Reg ID:'} ${registration.registrationId}</span>
        </div>

        <!-- Header with Logos -->
        <div class="header">
          <div class="logo-container">
            <img src="/found.png" alt="Abdulmonem Alrashed Foundation" />
          </div>
          <div class="header-center">
            <div class="header-title">${isRTL ? 'فاب لاب الأحساء' : 'FABLAB Al-Ahsa'}</div>
            <div class="header-subtitle">${isRTL ? 'مختبر التصنيع الرقمي' : 'Digital Fabrication Laboratory'}</div>
          </div>
          <div class="logo-container">
            <img src="/fablab.png" alt="FABLAB" />
          </div>
        </div>

        <!-- Form Title -->
        <div class="form-title">${isRTL ? 'نموذج تسجيل موعد' : 'Appointment Registration Form'}</div>

        <!-- Registration Info Section -->
        <div class="section">
          <div class="section-title">${isRTL ? 'معلومات التسجيل' : 'Registration Information'}</div>
          <div class="field-grid">
            <div class="field">
              <div class="field-label">${isRTL ? 'تاريخ التقديم' : 'Submission Date'}</div>
              <div class="field-value">${formatDate(registration.createdAt)}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'القسم' : 'Section'}</div>
              <div class="field-value">${getSectionLabel()}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'الحالة' : 'Status'}</div>
              <div class="field-value"><span class="status ${registration.status}">${getStatusLabel()}</span></div>
            </div>
          </div>
        </div>

        <!-- Applicant Info Section -->
        <div class="section">
          <div class="section-title">${isRTL ? 'معلومات المتقدم' : 'Applicant Information'}</div>
          <div class="field-grid">
            <div class="field">
              <div class="field-label">${isRTL ? 'الاسم الكامل' : 'Full Name'}</div>
              <div class="field-value">${userName}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'نوع المتقدم' : 'Applicant Type'}</div>
              <div class="field-value">${getAppTypeLabel()}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'الجهة التابع لها' : 'Organization'}</div>
              <div class="field-value">${registration.user?.currentJob || na}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'رقم الهاتف' : 'Phone'}</div>
              <div class="field-value">${registration.user?.phoneNumber || na}</div>
            </div>
            <div class="field field-full-2">
              <div class="field-label">${isRTL ? 'البريد الإلكتروني' : 'Email'}</div>
              <div class="field-value">${registration.user?.email || na}</div>
            </div>
          </div>
        </div>

        <!-- Appointment Details Section -->
        <div class="section">
          <div class="section-title">${isRTL ? 'تفاصيل الموعد' : 'Appointment Details'}</div>
          <div class="field-grid">
            <div class="field">
              <div class="field-label">${isRTL ? 'التاريخ' : 'Date'}</div>
              <div class="field-value">${formatDate(registration.appointmentDate || registration.visitDate || registration.startDate)}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'الوقت' : 'Time'}</div>
              <div class="field-value">${formatTimeAMPM(registration.appointmentTime || registration.visitStartTime || registration.startTime) || na}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'المدة' : 'Duration'}</div>
              <div class="field-value">${getDuration()}</div>
            </div>
            <div class="field field-full">
              <div class="field-label">${isRTL ? 'الخدمات المطلوبة' : 'Required Services'}</div>
              <div class="field-value">${getTranslatedServices()}</div>
            </div>
          </div>
        </div>

        ${registration.user?.applicationType === 'Volunteer' && (registration.volunteerSection || registration.volunteerSkills) ? `
        <!-- Volunteer Information Section -->
        <div class="section">
          <div class="section-title">${isRTL ? 'معلومات التطوع' : 'Volunteer Information'}</div>
          <div class="field-grid">
            <div class="field">
              <div class="field-label">${isRTL ? 'مجال التطوع' : 'Volunteer Section'}</div>
              <div class="field-value">${registration.volunteerSection || na}</div>
            </div>
            <div class="field field-full-2">
              <div class="field-label">${isRTL ? 'المهارات والخبرات' : 'Skills & Experience'}</div>
              <div class="field-value">${registration.volunteerSkills || na}</div>
            </div>
          </div>
        </div>
        ` : ''}

        ${registration.serviceDetails ? `
        <!-- Additional Details Section -->
        <div class="section">
          <div class="section-title">${isRTL ? 'تفاصيل إضافية' : 'Additional Details'}</div>
          <div class="field-grid">
            <div class="field field-full">
              <div class="field-value">${registration.serviceDetails}</div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Signature Section -->
        <div class="signature-section">
          <div class="signature-title">${isRTL ? 'التوقيع والتأكيد' : 'Signature & Confirmation'}</div>
          <div class="signature-grid">
            <div class="signature-box">
              <div class="signature-label">${isRTL ? 'توقيع المتقدم' : 'Applicant Signature'}</div>
              <div class="signature-line">${isRTL ? 'التوقيع' : 'Signature'}</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">${isRTL ? 'توقيع المسؤول' : 'Staff Signature'}</div>
              <div class="signature-line">${isRTL ? 'التوقيع' : 'Signature'}</div>
            </div>
          </div>
          <div style="text-align: center; margin-top: 12px; font-size: 10px; color: #666;">
            ${isRTL ? 'التاريخ:' : 'Date:'} ____________________
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية - فاب لاب الأحساء' : 'Abdulmonem Alrashed Humanitarian Foundation - FABLAB Al-Ahsa'}</p>
          <p>${isRTL ? 'تم الطباعة في' : 'Printed on'}: ${new Date().toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { calendar: 'gregory' })}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Print User ID Card function
  const handlePrintUserIDCard = (user) => {
    const printWindow = window.open('', '_blank');

    const userName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.name || (isRTL ? 'غير متوفر' : 'N/A');

    // Get application type label
    const getAppTypeLabel = () => {
      const labels = {
        'Beneficiary': isRTL ? 'مستفيد' : 'Beneficiary',
        'Visitor': isRTL ? 'زائر' : 'Visitor',
        'Volunteer': isRTL ? 'متطوع' : 'Volunteer',
        'Talented': isRTL ? 'موهوب' : 'Talented',
        'Entity': isRTL ? 'جهة' : 'Entity',
        'FABLAB Visit': isRTL ? 'زيارة فاب لاب' : 'FABLAB Visit'
      };
      return labels[user.applicationType] || user.applicationType || (isRTL ? 'غير متوفر' : 'N/A');
    };

    const na = isRTL ? 'غير محدد' : 'N/A';

    const idCardContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'بطاقة تعريف المستخدم' : 'User ID Card'}</title>
        <style>
          @page { size: A4 portrait; margin: 14mm 12mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f1f5f9; }
          body { padding: 24mm 0; display: flex; justify-content: center; }
          .print-note { font-size: 12px; color: #475569; background: white; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 8px 14px; margin-bottom: 8mm; text-align: center; max-width: 80mm; }
          .id-card-wrapper { display: flex; flex-direction: column; align-items: center; }

          .id-card {
            width: 72mm;
            height: 102mm;
            background: linear-gradient(180deg, #ffffff 0%, #fef2f2 100%);
            border: 0.45mm dashed #475569;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            color: #0f172a;
            box-sizing: border-box;
          }
          .card-header {
            background: linear-gradient(135deg, #e02529 0%, #c41e24 100%);
            padding: 3mm 3.5mm;
            text-align: center;
          }
          .card-title { color: white; font-size: 10pt; font-weight: 700; letter-spacing: 0.4px; line-height: 1.15; }
          .card-subtitle { color: rgba(255,255,255,0.88); font-size: 7pt; margin-top: 1mm; }
          .card-body {
            flex: 1;
            padding: 3.5mm 4mm 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2mm;
          }
          .user-photo {
            width: 24mm;
            height: 29mm;
            background: linear-gradient(135deg, #fecaca, #fca5a5);
            border-radius: 2mm;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e02529;
            font-weight: bold;
            border: 0.8mm solid #e02529;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
            overflow: hidden;
            flex-shrink: 0;
          }
          .user-photo img { width: 100%; height: 100%; object-fit: cover; }
          .user-photo .initials { font-size: 22pt; font-weight: bold; color: #e02529; }
          .user-name {
            font-size: 12pt;
            font-weight: 800;
            color: #1a1a2e;
            text-align: center;
            line-height: 1.2;
            max-height: 11mm;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .user-type-badge {
            display: inline-block;
            background: linear-gradient(135deg, #e02529, #c41e24);
            color: white;
            font-size: 8pt;
            padding: 0.8mm 4mm;
            border-radius: 999px;
            font-weight: 700;
          }
          .info-section { width: 100%; display: flex; flex-direction: column; gap: 1mm; margin-top: 1.5mm; }
          .info-row { display: flex; justify-content: space-between; font-size: 8pt; padding: 1mm 0; border-bottom: 0.2mm dotted #ddd; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 700; color: #555; }
          .info-value { color: #1a1a2e; font-weight: 600; text-align: ${isRTL ? 'left' : 'right'}; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .card-footer {
            background: #ffffff;
            padding: 2mm 3mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-top: 0.3mm solid #e0e0e0;
            gap: 1.5mm;
          }
          .card-footer .logo { height: 8mm; width: auto; flex-shrink: 0; }
          .card-footer .logo-left { order: 1; }
          .card-footer .logo-right { order: 3; }
          .member-id-section { display: flex; flex-direction: column; align-items: center; order: 2; flex: 1; text-align: center; gap: 0.3mm; }
          .member-id-label { font-size: 5.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .member-id-value { font-size: 8.5pt; font-weight: 700; color: #e02529; font-family: 'Consolas', 'Courier New', monospace; }
          .decorative-stripe { position: absolute; top: 40%; ${isRTL ? 'right' : 'left'}: 0; width: 1mm; height: 25%; background: linear-gradient(to bottom, transparent, #e02529, transparent); }
          @media print {
            html, body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { padding: 0; }
            .print-note { display: none; }
            .id-card { box-shadow: none; break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="id-card-wrapper">
          <div class="print-note">${isRTL ? 'حجم البطاقة 72×102 ملم — اقطع حسب الخط المتقطع' : 'Card size 72×102 mm — cut along the dashed line'}</div>
          <div class="id-card">
            <div class="card-header">
              <div class="card-title">${isRTL ? 'بطاقة مستفيد فاب لاب الأحساء' : 'FABLAB Al-Ahsa Beneficiary Card'}</div>
              <div class="card-subtitle">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</div>
            </div>
            <div class="card-body">
              <div class="user-photo">
                ${user.profilePicture
                  ? `<img src="${user.profilePicture}" alt="${userName}" />`
                  : `<span class="initials">${userName.charAt(0).toUpperCase()}</span>`
                }
              </div>
              <div class="user-name">${userName}</div>
              <div class="user-type-badge">${getAppTypeLabel()}</div>

              <div class="info-section">
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'رقم الهوية' : 'National ID'}</span>
                  <span class="info-value">${user.nationalId || na}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'الهاتف' : 'Phone'}</span>
                  <span class="info-value">${user.phoneNumber || na}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'الجنسية' : 'Nationality'}</span>
                  <span class="info-value">${user.nationality || na}</span>
                </div>
              </div>
            </div>
            <div class="decorative-stripe"></div>
            <div class="card-footer">
              <img src="/found.png" alt="Foundation" class="logo logo-left">
              <div class="member-id-section">
                <span class="member-id-label">${isRTL ? 'رقم العضوية' : 'Member ID'}</span>
                <span class="member-id-value">${user.uniqueId || user.userId || 'N/A'}</span>
              </div>
              <img src="/fablab.png" alt="FABLAB" class="logo logo-right">
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(idCardContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Print Terms and Conditions Document
  const handlePrintTermsDocument = (user) => {
    const printWindow = window.open('', '_blank');

    const userName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.name || (isRTL ? 'غير متوفر' : 'N/A');

    const today = new Date().toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      calendar: 'gregory'
    });

    const termsArabic = [
      'تعبئة الأستمارة الخاصة بالاستفادة من خدمات فاب لاب الأحساء.',
      'وضع شعار فاب لاب الأحساء من ضمن الشعارات الخاصة بالمشروع المنتج سواء بالعروض أو المطبوعات.',
      'الإشارة إلى الدور المقدم من فاب لاب الأحساء ومساهمته في إنتاج المشروع في التصاريح الإعلامية أو المشاركات المحلية أو العالمية.',
      'تقديم الشكر لفاب لاب الأحساء على مواقع التواصل الاجتماعي على الخدمات المقدمة.',
      'السماح للفريق الإعلامي بفاب لاب الأحساء بتصوير العمل وإخراجه ونشره على حسابات التواصل الاجتماعي الخاص بالفاب لاب أو مؤسسة عبد المنعم الراشد الإنسانية.',
      'الموافقة على الاحتفاظ بنسخة أخرى للمشروع في فاب لاب الأحساء مع ذكر الحقوق عليها.',
      'التقيد بالأنظمة والضوابط المحددة في فاب لاب الأحساء.',
      'التقيد بالأوقات المحجوزة وعدم تعديلها إلا بموافقة إدارة فاب لاب الأحساء.'
    ];

    const termsEnglish = [
      'Complete the application form for utilizing FABLAB Al-Ahsa services.',
      'Include FABLAB Al-Ahsa logo among the project logos in presentations or printed materials.',
      'Acknowledge the role and contribution of FABLAB Al-Ahsa in project production in media statements or local/international participations.',
      'Thank FABLAB Al-Ahsa on social media platforms for the services provided.',
      'Allow the FABLAB Al-Ahsa media team to photograph, produce, and publish the work on social media accounts of FABLAB or Abdulmonem Al-Rashed Foundation.',
      'Agree to keep another copy of the project at FABLAB Al-Ahsa with rights attribution.',
      'Comply with the rules and regulations specified by FABLAB Al-Ahsa.',
      'Adhere to reserved times and not modify them without approval from FABLAB Al-Ahsa management.'
    ];

    const terms = isRTL ? termsArabic : termsEnglish;

    const termsDocContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'وثيقة الاستفادة من خدمات فاب لاب الأحساء' : 'FABLAB Al-Ahsa Service Utilization Agreement'}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm 12mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            background: white;
            color: #1a1a2e;
            line-height: 1.4;
            padding: 0;
            font-size: 13px;
          }
          .document {
            max-width: 100%;
            margin: 0 auto;
            background: white;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 10px;
            border-bottom: 3px solid #e02529;
            margin-bottom: 14px;
          }
          .header .logo {
            height: 50px;
            width: auto;
          }
          .header-center {
            text-align: center;
            flex: 1;
            padding: 0 15px;
          }
          .document-title {
            font-size: 18px;
            font-weight: 700;
            color: #e02529;
            margin-bottom: 2px;
          }
          .document-subtitle {
            font-size: 12px;
            color: #666;
          }
          .user-info-section {
            background: #f8f9fa;
            padding: 10px 14px;
            border-radius: 6px;
            margin-bottom: 14px;
            border-${isRTL ? 'right' : 'left'}: 4px solid #e02529;
          }
          .user-info-title {
            font-size: 13px;
            font-weight: 600;
            color: #e02529;
            margin-bottom: 8px;
          }
          .user-info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px 20px;
          }
          .user-info-item {
            display: flex;
            gap: 8px;
            font-size: 12px;
          }
          .user-info-label {
            font-weight: 600;
            color: #555;
          }
          .user-info-value {
            color: #333;
          }
          .terms-section {
            margin-bottom: 0;
          }
          .terms-title {
            font-size: 14px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 2px solid #e9ecef;
          }
          .terms-intro {
            font-size: 12px;
            color: #444;
            margin-bottom: 10px;
            line-height: 1.5;
          }
          .terms-list {
            list-style: none;
            counter-reset: terms-counter;
            display: grid;
            gap: 6px;
          }
          .terms-list li {
            counter-increment: terms-counter;
            padding: 8px 10px;
            background: #fafafa;
            border-radius: 5px;
            border-${isRTL ? 'right' : 'left'}: 4px solid #e02529;
            font-size: 12px;
            line-height: 1.4;
            position: relative;
            padding-${isRTL ? 'right' : 'left'}: 32px;
          }
          .terms-list li::before {
            content: counter(terms-counter);
            position: absolute;
            ${isRTL ? 'right' : 'left'}: 6px;
            top: 50%;
            transform: translateY(-50%);
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #e02529, #c41e24);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
          }
          .page-break {
            page-break-before: always;
          }
          .page2-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            border-bottom: 2px solid #e02529;
            margin-bottom: 16px;
          }
          .page2-header .logo {
            height: 35px;
            width: auto;
            opacity: 0.8;
          }
          .page2-header-title {
            font-size: 14px;
            font-weight: 600;
            color: #e02529;
          }
          .agreement-section {
            background: #fff8f8;
            border: 2px solid #e02529;
            border-radius: 6px;
            padding: 14px 16px;
            margin-bottom: 16px;
          }
          .agreement-text {
            font-size: 13px;
            color: #333;
            line-height: 1.5;
            margin-bottom: 10px;
          }
          .checkbox-line {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            font-weight: 600;
            color: #1a1a2e;
          }
          .checkbox-box {
            width: 18px;
            height: 18px;
            border: 2px solid #e02529;
            border-radius: 3px;
            display: inline-block;
            flex-shrink: 0;
          }
          .service-type-section {
            margin-bottom: 20px;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            background: #fafafa;
          }
          .service-type-title {
            font-size: 13px;
            font-weight: 700;
            color: #e02529;
            margin-bottom: 10px;
            display: block;
          }
          .service-type-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 24px;
          }
          .service-type-option {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #333;
          }
          .service-type-checkbox {
            width: 16px;
            height: 16px;
            border: 2px solid #e02529;
            border-radius: 3px;
            flex-shrink: 0;
          }
          .signature-section {
            padding-top: 16px;
            border-top: 2px dashed #ddd;
          }
          .signature-date {
            text-align: center;
            margin-bottom: 16px;
            font-size: 13px;
            font-weight: 600;
            color: #333;
            background: #f8f9fa;
            padding: 8px 14px;
            border-radius: 6px;
            display: inline-block;
            width: 100%;
            box-sizing: border-box;
          }
          .signatures-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
          }
          .signature-box {
            text-align: center;
            padding: 16px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            background: #fafafa;
          }
          .signature-role {
            font-size: 12px;
            font-weight: 700;
            color: #e02529;
            margin-bottom: 4px;
            display: block;
          }
          .signature-name-value {
            font-size: 13px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 30px;
            display: block;
            min-height: 16px;
          }
          .signature-line {
            border-bottom: 2px solid #333;
            margin-bottom: 4px;
          }
          .signature-field-name {
            font-size: 11px;
            font-weight: 600;
            color: #555;
          }
          .footer {
            margin-top: 20px;
            padding-top: 12px;
            border-top: 2px solid #e9ecef;
            text-align: center;
            color: #888;
            font-size: 11px;
          }
          .footer-logos {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-bottom: 6px;
          }
          .footer-logos img {
            height: 30px;
            width: auto;
            opacity: 0.8;
          }
          @media print {
            body {
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .document {
              max-width: none;
            }
            .page-break {
              page-break-before: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <!-- PAGE 1: Header, User Info, Terms -->
          <div class="header">
            <img src="/fablab.png" alt="FABLAB" class="logo">
            <div class="header-center">
              <div class="document-title">
                ${isRTL ? 'وثيقة الاستفادة من خدمات فاب لاب الأحساء' : 'FABLAB Al-Ahsa Service Utilization Agreement'}
              </div>
              <div class="document-subtitle">
                ${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}
              </div>
            </div>
            <img src="/found.png" alt="Foundation" class="logo">
          </div>

          <div class="user-info-section">
            <div class="user-info-title">${isRTL ? 'بيانات المستفيد' : 'Beneficiary Information'}</div>
            <div class="user-info-grid">
              <div class="user-info-item">
                <span class="user-info-label">${isRTL ? 'الاسم:' : 'Name:'}</span>
                <span class="user-info-value">${userName}</span>
              </div>
              <div class="user-info-item">
                <span class="user-info-label">${isRTL ? 'رقم العضوية:' : 'Member ID:'}</span>
                <span class="user-info-value">${user.uniqueId || user.userId || 'N/A'}</span>
              </div>
              <div class="user-info-item">
                <span class="user-info-label">${isRTL ? 'رقم الهوية:' : 'National ID:'}</span>
                <span class="user-info-value">${user.nationalId || (isRTL ? 'غير محدد' : 'N/A')}</span>
              </div>
              <div class="user-info-item">
                <span class="user-info-label">${isRTL ? 'الهاتف:' : 'Phone:'}</span>
                <span class="user-info-value">${user.phoneNumber || (isRTL ? 'غير محدد' : 'N/A')}</span>
              </div>
            </div>
          </div>

          <div class="terms-section">
            <div class="terms-title">${isRTL ? 'الشروط والأحكام' : 'Terms and Conditions'}</div>
            <div class="terms-intro">
              ${isRTL
                ? 'أتعهد أنا الموقع أدناه بالالتزام بجميع الشروط والأحكام التالية للاستفادة من خدمات فاب لاب الأحساء:'
                : 'I, the undersigned, hereby agree to comply with all the following terms and conditions for utilizing FABLAB Al-Ahsa services:'
              }
            </div>
            <ol class="terms-list">
              ${terms.map(term => `<li>${term}</li>`).join('')}
            </ol>
          </div>

          <!-- PAGE 2: Agreement, Service Type, Signatures -->
          <div class="page-break"></div>

          <div class="page2-header">
            <img src="/fablab.png" alt="FABLAB" class="logo">
            <span class="page2-header-title">${isRTL ? 'وثيقة الاستفادة من خدمات فاب لاب الأحساء - تابع' : 'FABLAB Service Agreement - Continued'}</span>
            <img src="/found.png" alt="Foundation" class="logo">
          </div>

          <div class="agreement-section">
            <div class="agreement-text">
              ${isRTL
                ? 'أقر أنا الموقع أدناه بأنني قد قرأت وفهمت جميع الشروط والأحكام المذكورة أعلاه، وأوافق على الالتزام بها كاملة.'
                : 'I, the undersigned, hereby declare that I have read and understood all the terms and conditions mentioned above, and I agree to comply with them in full.'
              }
            </div>
            <div class="checkbox-line">
              <span class="checkbox-box"></span>
              <span>${isRTL ? 'أوافق على جميع الشروط والأحكام' : 'I agree to all terms and conditions'}</span>
            </div>
          </div>

          <div class="service-type-section">
            <span class="service-type-title">${isRTL ? 'نوع الخدمة:' : 'Service Type:'}</span>
            <div class="service-type-grid">
              <div class="service-type-option" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                <span class="service-type-checkbox"></span>
                ${isRTL ? 'من الشركاء الرسميين' : 'From Official Partners'}
              </div>
              <div class="service-type-option" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                <span class="service-type-checkbox"></span>
                ${isRTL ? 'خدمة مجانية' : 'Free Service'}
              </div>
              <div class="service-type-option" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                <span class="service-type-checkbox"></span>
                ${isRTL ? 'تعويض مالي جزئي' : 'Partial Financial Compensation'}
              </div>
              <div class="service-type-option" style="direction: ${isRTL ? 'rtl' : 'ltr'};">
                <span class="service-type-checkbox"></span>
                ${isRTL ? 'تعويض مالي كامل' : 'Full Financial Compensation'}
              </div>
            </div>
          </div>

          <div class="signature-section">
            <div class="signature-date">
              ${isRTL ? 'التاريخ:' : 'Date:'} ${today}
            </div>
            <div class="signatures-grid">
              <!-- Beneficiary Signature -->
              <div class="signature-box">
                <span class="signature-role">${isRTL ? 'المستفيد' : 'Beneficiary'}</span>
                <span class="signature-name-value">${userName}</span>
                <div class="signature-line"></div>
                <span class="signature-field-name">${isRTL ? 'الاسم والتوقيع' : 'Name & Signature'}</span>
              </div>
              <!-- Manager Signature -->
              <div class="signature-box">
                <span class="signature-role">${isRTL ? 'المسؤول التنفيذي للفاب لاب' : 'FABLAB Executive Manager'}</span>
                <span class="signature-name-value">أ. زكي اللويم</span>
                <div class="signature-line"></div>
                <span class="signature-field-name">${isRTL ? 'الاسم والتوقيع' : 'Name & Signature'}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="footer-logos">
              <img src="/fablab.png" alt="FABLAB">
              <img src="/found.png" alt="Foundation">
            </div>
            <p><strong>FABLAB</strong> ${isRTL ? 'الأحساء' : 'Al-Ahsa'} | ${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(termsDocContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/admin/export/csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `registrations_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(isRTL ? 'تم تصدير البيانات بنجاح' : 'Data exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error(isRTL ? 'خطأ في تصدير البيانات' : 'Error exporting data');
    }
  };

  const handleCreateEmployee = async () => {
    try {
      await api.post('/admin/employees', employeeForm);
      toast.success(isRTL ? 'تم إضافة الموظف بنجاح' : 'Employee added successfully');
      setShowEmployeeModal(false);
      setEmployeeForm({ name: '', email: '', sections: [] });
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.message || (isRTL ? 'خطأ في إضافة الموظف' : 'Error adding employee'));
    }
  };

  const handleUpdateEmployee = async () => {
    try {
      await api.put(`/admin/employees/${selectedEmployee.employeeId}`, employeeForm);
      toast.success(isRTL ? 'تم تحديث الموظف بنجاح' : 'Employee updated successfully');
      setShowEmployeeModal(false);
      setSelectedEmployee(null);
      setEmployeeForm({ name: '', email: '', sections: [] });
      fetchEmployees();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في تحديث الموظف' : 'Error updating employee');
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

  // Handle employee task creation from schedule tab
  const handleCreateEmployeeTask = async (e) => {
    e.preventDefault();

    if (!employeeTaskForm.employeeId || !employeeTaskForm.title || !employeeTaskForm.dueDate) {
      toast.error(isRTL ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    // Validate end date for multiple days
    if (employeeTaskForm.isMultipleDays && !employeeTaskForm.dueDateEnd) {
      toast.error(isRTL ? 'يرجى تحديد تاريخ النهاية' : 'Please specify end date');
      return;
    }

    // Validate time range if blocking calendar
    if (employeeTaskForm.blocksCalendar && (!employeeTaskForm.dueTime || !employeeTaskForm.dueTimeEnd)) {
      toast.error(isRTL ? 'يرجى تحديد وقت البداية والنهاية لحجز الموعد' : 'Please specify start and end time to block calendar');
      return;
    }

    setIsSubmittingTask(true);
    try {
      const selectedEmployee = employees.find(e => e.employeeId === employeeTaskForm.employeeId);

      // Generate array of dates if multiple days selected
      const dates = [];
      if (employeeTaskForm.isMultipleDays && employeeTaskForm.dueDateEnd) {
        const startDate = new Date(employeeTaskForm.dueDate);
        const endDate = new Date(employeeTaskForm.dueDateEnd);

        // Validate date range
        if (endDate < startDate) {
          toast.error(isRTL ? 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date');
          setIsSubmittingTask(false);
          return;
        }

        // Generate all dates in range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          dates.push(currentDate.toISOString().split('T')[0]);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        dates.push(employeeTaskForm.dueDate);
      }

      // Create task for each date
      const taskPromises = dates.map(date =>
        api.post('/tasks', {
          title: employeeTaskForm.title,
          description: employeeTaskForm.description,
          employeeId: employeeTaskForm.employeeId,
          dueDate: date,
          dueTime: employeeTaskForm.dueTime || null,
          dueTimeEnd: employeeTaskForm.dueTimeEnd || null,
          priority: employeeTaskForm.priority,
          blocksCalendar: employeeTaskForm.blocksCalendar,
          section: selectedEmployee?.section || ''
        })
      );

      await Promise.all(taskPromises);

      const successMsg = dates.length > 1
        ? (isRTL ? `تم إضافة ${dates.length} مهام بنجاح` : `${dates.length} tasks added successfully`)
        : (isRTL ? 'تم إضافة المهمة بنجاح' : 'Task added successfully');
      toast.success(successMsg);

      // Reset form
      setEmployeeTaskForm({
        employeeId: '',
        title: '',
        description: '',
        dueDate: '',
        dueDateEnd: '',
        dueTime: '',
        dueTimeEnd: '',
        priority: 'medium',
        blocksCalendar: true,
        isMultipleDays: false
      });

      // Refresh schedule
      fetchSchedule();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(isRTL ? 'خطأ في إضافة المهمة' : 'Error adding task');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Handle task status update
  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      toast.success(isRTL ? 'تم تحديث حالة المهمة' : 'Task status updated');
      fetchSchedule();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error(isRTL ? 'خطأ في تحديث حالة المهمة' : 'Error updating task status');
    }
  };

  // Education functions
  const fetchEducations = async (page = 1) => {
    setLoadingEducations(true);
    try {
      const params = new URLSearchParams();
      Object.entries(educationFilters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('page', page);
      params.append('limit', educationPagination.limit);
      const response = await api.get(`/education?${params.toString()}`);
      setEducations(response.data.educations || []);
      if (response.data.pagination) {
        setEducationPagination(prev => ({ ...prev, ...response.data.pagination }));
      }
    } catch (error) {
      console.error('Error fetching educations:', error);
    } finally {
      setLoadingEducations(false);
    }
  };

  const fetchEducationDetail = async (id) => {
    try {
      const response = await api.get(`/education/${encodeURIComponent(id)}`);
      setSelectedEducation(response.data);
      setEducationRatings(response.data.ratings || []);
      fetchEducationStudents(id);
    } catch (error) {
      console.error('Error fetching education detail:', error);
    }
  };

  const fetchEducationStudents = async (educationId) => {
    try {
      const response = await api.get(`/education/${encodeURIComponent(educationId)}/students`);
      setEducationStudents(response.data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      setEducationStudents([]);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedEducation) return;
    const required = ['fullName', 'nationalId', 'phoneNumber', 'schoolName', 'educationLevel', 'parentPhoneNumber', 'personalPhoto'];
    for (const field of required) {
      if (!newStudentForm[field]) {
        toast.error(isRTL ? 'جميع الحقول مطلوبة' : 'All fields are required');
        return;
      }
    }
    try {
      await api.post(`/education/${encodeURIComponent(selectedEducation.educationId)}/students/add`, newStudentForm);
      toast.success(isRTL ? 'تم إضافة الطالب بنجاح' : 'Student added successfully');
      setShowAddStudentModal(false);
      setNewStudentForm({ fullName: '', nationalId: '', phoneNumber: '', email: '', schoolName: '', educationLevel: '', parentPhoneNumber: '', personalPhoto: '' });
      fetchEducationStudents(selectedEducation.educationId);
    } catch (error) {
      toast.error(isRTL ? 'خطأ في إضافة الطالب' : 'Error adding student');
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من إزالة هذا الطالب؟' : 'Are you sure you want to remove this student?')) return;
    try {
      await api.delete(`/education/students/${encodeURIComponent(studentId)}`);
      toast.success(isRTL ? 'تم إزالة الطالب' : 'Student removed');
      fetchEducationStudents(selectedEducation.educationId);
    } catch (error) {
      toast.error(isRTL ? 'خطأ في إزالة الطالب' : 'Error removing student');
    }
  };

  const handleStudentPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(isRTL ? 'الحجم الأقصى 5MB' : 'Max 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (event) => setNewStudentForm(prev => ({ ...prev, personalPhoto: event.target.result }));
    reader.readAsDataURL(file);
  };

  const handlePrintStudentProfile = (student, education) => {
    const printWindow = window.open('', '_blank');
    const teacherName = education.user?.firstName && education.user?.lastName ? `${education.user.firstName} ${education.user.lastName}` : education.user?.name || 'N/A';
    const sectionName = education.section || 'N/A';
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>Student Profile - ${student.fullName}</title><style>
      @page { size: A4; margin: 15mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; }
      body { padding: 20px; direction: rtl; }
      .logo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
      .logo-header img { width: 70px; height: 70px; object-fit: contain; }
      .logo-header .title-center { text-align: center; flex: 1; }
      .logo-header .title-center h2 { font-size: 20px; color: #5b21b6; margin-bottom: 2px; }
      .logo-header .title-center p { font-size: 12px; color: #64748b; }
      .header-bar { background: linear-gradient(135deg, #5b21b6, #6d28d9, #7c3aed); color: white; padding: 18px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
      .header-bar h1 { font-size: 22px; margin-bottom: 4px; }
      .header-bar p { opacity: 0.85; font-size: 13px; }
      .photo-section { text-align: center; margin-bottom: 24px; }
      .photo-section img { width: 150px; height: 150px; border-radius: 50%; object-fit: cover; border: 4px solid #6d28d9; box-shadow: 0 4px 15px rgba(109,40,217,0.2); }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
      .info-item { background: #f5f3ff; padding: 14px; border-radius: 10px; border-right: 4px solid #6d28d9; }
      .info-item label { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
      .info-item span { font-size: 15px; font-weight: 700; color: #1e293b; }
      .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 2px solid #ede9fe; color: #64748b; font-size: 11px; }
      @media print { body { padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } }
    </style></head><body>
      <div class="logo-header">
        <img src="/fablab.png" alt="FABLAB" />
        <div class="title-center"><h2>فاب لاب الأحساء</h2><p>FABLAB Al-Ahsa - Education System</p></div>
        <img src="/found.png" alt="Foundation" />
      </div>
      <div class="header-bar"><h1>بطاقة تعريف الطالب</h1><p>Student Profile Card</p></div>
      <div class="photo-section"><img src="${student.personalPhoto}" alt="Photo" /></div>
      <div class="info-grid">
        <div class="info-item"><label>الاسم الكامل</label><span>${student.fullName}</span></div>
        <div class="info-item"><label>رقم الهوية</label><span>${student.nationalId}</span></div>
        <div class="info-item"><label>رقم الهاتف</label><span>${student.phoneNumber}</span></div>
        <div class="info-item"><label>رقم ولي الأمر</label><span>${student.parentPhoneNumber}</span></div>
        <div class="info-item"><label>اسم المدرسة</label><span>${student.schoolName}</span></div>
        <div class="info-item"><label>المرحلة التعليمية</label><span>${student.educationLevel}</span></div>
        <div class="info-item"><label>القسم</label><span>${sectionName}</span></div>
        <div class="info-item"><label>رقم التعليم</label><span>${education.educationId}</span></div>
        <div class="info-item"><label>المعلم</label><span>${teacherName}</span></div>
        <div class="info-item"><label>الفترة</label><span>${education.periodStartTime || ''} - ${education.periodEndTime || ''}</span></div>
      </div>
      <div class="footer"><p>FABLAB Al-Ahsa - فاب لاب الأحساء</p></div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handlePrintStudentIdCard = (student, education) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>ID Card - ${student.fullName}</title><style>
      @page { size: 54mm 85mm; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; }
      body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
      .card { width: 54mm; height: 85mm; background: linear-gradient(170deg, #f8f6ff 0%, #ffffff 40%, #f3f0ff 100%); overflow: hidden; display: flex; flex-direction: column; position: relative; border: 1.5px solid #e9e2ff; }
      .card::before { content: ''; position: absolute; top: 0; right: 0; width: 40px; height: 40px; background: radial-gradient(circle at top right, rgba(109,40,217,0.06) 0%, transparent 70%); }
      .card::after { content: ''; position: absolute; bottom: 20px; left: 0; width: 30px; height: 30px; background: radial-gradient(circle at bottom left, rgba(124,58,237,0.05) 0%, transparent 70%); }
      .card-header { background: linear-gradient(135deg, #5b21b6, #6d28d9, #7c3aed); color: white; padding: 6px 6px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
      .card-header img { width: 26px; height: 26px; object-fit: contain; }
      .card-header .header-center { text-align: center; flex: 1; }
      .card-header .header-center .title { font-size: 8px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
      .card-header .header-center .subtitle { font-size: 5.5px; opacity: 0.85; margin-top: 1px; letter-spacing: 0.5px; }
      .photo-area { flex-shrink: 0; display: flex; justify-content: center; padding: 8px 0 4px 0; position: relative; }
      .photo-ring { width: 82px; height: 82px; border-radius: 50%; background: linear-gradient(135deg, #6d28d9, #8b5cf6, #6d28d9); padding: 2.5px; }
      .photo-ring img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid white; }
      .name-bar { text-align: center; padding: 4px 6px 2px; flex-shrink: 0; }
      .name-bar h2 { font-size: 11px; font-weight: 800; color: #1e1b4b; letter-spacing: 0.3px; margin-bottom: 1px; }
      .name-bar .role { font-size: 6px; text-transform: uppercase; letter-spacing: 1.5px; color: #6d28d9; font-weight: 700; }
      .info-widgets { flex: 1; display: flex; flex-direction: column; gap: 3px; padding: 4px 5px 3px; position: relative; z-index: 1; }
      .widget { display: flex; align-items: center; gap: 5px; background: white; border: 1px solid #ede9fe; border-radius: 6px; padding: 3.5px 6px; }
      .widget-icon { width: 16px; height: 16px; border-radius: 4px; background: linear-gradient(135deg, #ede9fe, #ddd6fe); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .widget-icon svg { width: 9px; height: 9px; }
      .widget-content { flex: 1; min-width: 0; }
      .widget-label { font-size: 5.5px; color: #8b5cf6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
      .widget-value { font-size: 8px; font-weight: 700; color: #1e1b4b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .card-footer { background: linear-gradient(135deg, #5b21b6, #6d28d9); color: white; padding: 4px; text-align: center; font-size: 6px; font-weight: 600; flex-shrink: 0; letter-spacing: 1px; text-transform: uppercase; display: flex; align-items: center; justify-content: center; gap: 6px; }
      .footer-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.5); }
      @media print { body { min-height: auto; background: white; } .card { border-color: #ddd6fe; } -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    </style></head><body>
      <div class="card">
        <div class="card-header">
          <img src="/fablab.png" alt="FABLAB" />
          <div class="header-center">
            <div class="title">FABLAB Al-Ahsa</div>
            <div class="subtitle">فاب لاب الأحساء</div>
          </div>
          <img src="/found.png" alt="Foundation" />
        </div>
        <div class="photo-area">
          <div class="photo-ring"><img src="${student.personalPhoto}" alt="Photo" /></div>
        </div>
        <div class="name-bar">
          <h2>${student.fullName}</h2>
          <div class="role">Student / طالب</div>
        </div>
        <div class="info-widgets">
          <div class="widget">
            <div class="widget-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#6d28d9" stroke-width="2.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6"/></svg></div>
            <div class="widget-content"><div class="widget-label">الهوية / ID</div><div class="widget-value">${student.nationalId}</div></div>
          </div>
          <div class="widget">
            <div class="widget-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#6d28d9" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>
            <div class="widget-content"><div class="widget-label">المدرسة / School</div><div class="widget-value">${student.schoolName}</div></div>
          </div>
          <div class="widget">
            <div class="widget-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#6d28d9" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91"/></svg></div>
            <div class="widget-content"><div class="widget-label">ولي الأمر / Parent</div><div class="widget-value">${student.parentPhoneNumber}</div></div>
          </div>
        </div>
        <div class="card-footer">
          <span class="footer-dot"></span>
          Student ID Card
          <span class="footer-dot"></span>
          بطاقة هوية الطالب
          <span class="footer-dot"></span>
        </div>
      </div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handlePrintAllStudentsList = (students, education) => {
    const printWindow = window.open('', '_blank');
    const teacherName = education.user?.firstName && education.user?.lastName ? `${education.user.firstName} ${education.user.lastName}` : education.user?.name || 'N/A';
    const rows = students.map((s, i) => `<tr><td>${i + 1}</td><td><img src="${s.personalPhoto}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;" /></td><td>${s.fullName}</td><td>${s.nationalId}</td><td>${s.schoolName}</td><td>${s.educationLevel}</td><td>${s.phoneNumber}</td><td>${s.parentPhoneNumber}</td></tr>`).join('');
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>Students List</title><style>
      @page { size: A4 landscape; margin: 10mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; }
      body { padding: 20px; direction: rtl; }
      .header { background: linear-gradient(135deg, #5b21b6, #6d28d9); color: white; padding: 16px 24px; border-radius: 10px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
      .header h2 { font-size: 18px; }
      .header .info { font-size: 12px; opacity: 0.85; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #6d28d9; color: white; padding: 8px 10px; text-align: right; font-weight: 600; }
      td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
      tr:nth-child(even) { background: #f8fafc; }
      @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>
      <div class="header">
        <div><h2>قائمة الطلاب</h2><div class="info">${teacherName} | ${education.section} | ${education.educationId}</div></div>
        <div style="text-align:left"><div class="info">العدد: ${students.length}</div></div>
      </div>
      <table><thead><tr><th>#</th><th>الصورة</th><th>الاسم</th><th>الهوية</th><th>المدرسة</th><th>المرحلة</th><th>الهاتف</th><th>ولي الأمر</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleEducationStatusUpdate = async (educationId, status) => {
    try {
      await api.put(`/education/${encodeURIComponent(educationId)}/status`, { status, adminNotes: educationAdminNotes });
      toast.success(isRTL ? `تم ${status === 'approved' ? 'قبول' : status === 'rejected' ? 'رفض' : 'تحديث'} الطلب` : `Education ${status} successfully`);
      setShowEducationModal(false);
      setEducationAdminNotes('');
      fetchEducations();
      if (selectedEducation) fetchEducationDetail(educationId);
    } catch (error) {
      toast.error(isRTL ? 'حدث خطأ' : 'Error updating status');
    }
  };

  // Permanently delete an education registration (and its students,
  // attendance, and ratings). Uses window.confirm because the
  // education tab has no confirm-modal wired up.
  const handleDeleteEducation = async (educationId) => {
    if (!window.confirm(isRTL
      ? 'سيتم حذف هذا التسجيل نهائياً مع جميع الطلاب والحضور والتقييمات. متابعة؟'
      : 'This will permanently delete the registration along with all students, attendance, and ratings. Continue?')) return;
    try {
      await api.delete(`/education/${encodeURIComponent(educationId)}`);
      toast.success(isRTL ? 'تم حذف التسجيل' : 'Registration deleted');
      // If we were viewing details for the deleted item, drop back to list.
      if (selectedEducation && selectedEducation.educationId === educationId) {
        setSelectedEducation(null);
      }
      fetchEducations();
    } catch (error) {
      toast.error(isRTL ? 'خطأ في حذف التسجيل' : 'Error deleting registration');
    }
  };

  const handleAddEducationRating = async () => {
    if (!selectedEducation) return;
    try {
      await api.post(`/education/${encodeURIComponent(selectedEducation.educationId)}/ratings`, ratingForm);
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      setShowRatingModal(false);
      setRatingForm({ ratingDate: new Date().toISOString().split('T')[0], cleanlinessScore: 5, damageLevel: 'none', damageDescription: '', roomPhoto: '', comments: '' });
      fetchEducationDetail(selectedEducation.educationId);
    } catch (error) {
      const msg = error.response?.data?.message || 'Error adding rating';
      const msgAr = error.response?.data?.messageAr || msg;
      toast.error(isRTL ? msgAr : msg);
    }
  };

  const handleDeleteEducationRating = async (educationId, ratingId) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من حذف هذا التقييم؟' : 'Are you sure you want to delete this rating?')) return;
    try {
      await api.delete(`/education/${encodeURIComponent(educationId)}/ratings/${encodeURIComponent(ratingId)}`);
      toast.success(isRTL ? 'تم حذف التقييم' : 'Rating deleted');
      fetchEducationDetail(educationId);
    } catch (error) {
      toast.error(isRTL ? 'خطأ في حذف التقييم' : 'Error deleting rating');
    }
  };

  const handleRatingPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setRatingForm(prev => ({ ...prev, roomPhoto: event.target.result }));
    reader.readAsDataURL(file);
  };

  const handlePrintEducationDocument = (education) => {
    const printWindow = window.open('', '_blank');
    const userName = education.user?.firstName && education.user?.lastName
      ? `${education.user.firstName} ${education.user.lastName}`
      : education.user?.name || 'N/A';
    const formatDatePrint = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    const sectionLabelsEdu = {
      'Electronics and Programming': 'الإلكترونيات والبرمجة',
      'CNC Laser': 'القطع بالليزر',
      'CNC Wood': 'القطع الخشبي',
      'CNC Metal': 'قطع المعادن',
      '3D': 'الطباعة ثلاثية الأبعاد',
      'Robotic and AI': 'الروبوتات والذكاء الاصطناعي',
      "Kid's Club": 'نادي الأطفال',
      'Vinyl Cutting': 'قص الفينيل',
      'UV Printing and Sticker Making': 'طباعة UV والملصقات',
      'Other': 'أخرى'
    };
    const sectionLabel = sectionLabelsEdu[education.section] || education.section;

    const termsContent = [
      { en: 'Teacher is responsible for keeping the room clean during and after each session.', ar: 'المعلم مسؤول عن نظافة القاعة أثناء وبعد كل جلسة تعليمية.' },
      { en: 'All devices and equipment must remain in their designated places after use.', ar: 'جميع الأجهزة والمعدات يجب أن تبقى في أماكنها المحددة بعد الاستخدام.' },
      { en: 'Materials and tools must be used carefully per FABLAB guidelines.', ar: 'يجب استخدام المواد والأدوات بعناية وفقاً لإرشادات فاب لاب.' },
      { en: 'Teacher is responsible for any damage or loss caused by students.', ar: 'المعلم مسؤول عن أي تلف أو فقدان يتسبب به الطلاب.' },
      { en: 'The area must be fully organized before leaving and parts must remain in their places.', ar: 'يجب ترتيب المنطقة بالكامل قبل المغادرة والمحافظة على أماكن القطع.' },
      { en: 'FABLAB will notify the responsible person in case of non-compliance and take official action if the issue recurs.', ar: 'سيقوم الفاب لاب بتنبيه المسؤول في حال عدم الالتزام وأخذ إجراء رسمي في حال تكرار المشكلة.' },
      { en: 'Daily room ratings will be conducted; low ratings will be flagged periodically.', ar: 'سيتم إجراء تقييمات يومية لحالة القاعة، والتقييمات المنخفضة سيتم التنبيه عليها بشكل دوري.' },
      { en: 'By signing below, the teacher acknowledges and agrees to all terms above.', ar: 'بالتوقيع أدناه، يقر المعلم بأنه قد قرأ وفهم جميع الشروط أعلاه ويوافق عليها.' }
    ];

    const statusLabelsMap = {
      pending: { ar: 'قيد الانتظار', en: 'Pending' },
      approved: { ar: 'مقبول', en: 'Approved' },
      active: { ar: 'نشط', en: 'Active' },
      completed: { ar: 'مكتمل', en: 'Completed' },
      rejected: { ar: 'مرفوض', en: 'Rejected' }
    };
    const statusDisplay = statusLabelsMap[education.status] || { ar: education.status, en: education.status };

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>Education Agreement - ${education.educationId}</title>
        <style>
          @page { size: A4; margin: 15mm 12mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #fff; font-size: 12px; line-height: 1.6; color: #333; }
          .page { width: 100%; min-height: 267mm; padding: 0 5px; position: relative; }
          .page-break { page-break-before: always; }
          .header { background: linear-gradient(135deg, #5b21b6, #6d28d9); color: white; padding: 20px 25px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .header-center { text-align: center; flex: 1; }
          .header-center h1 { font-size: 22px; margin: 0; font-weight: 800; }
          .header-center h2 { font-size: 14px; font-weight: 600; opacity: 0.9; margin: 6px 0 0 0; }
          .header img { width: 65px; height: 65px; object-fit: contain; }
          .id-bar { display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 13px; }
          .id-bar span { background: #f5f3ff; padding: 8px 16px; border-radius: 8px; color: #5b21b6; font-weight: 700; border: 1px solid #ddd6fe; }
          .section-title { background: #5b21b6; color: white; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 700; margin: 18px 0 12px 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; }
          .info-item { display: flex; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
          .info-item .label { color: #64748b; font-weight: 600; font-size: 12px; }
          .info-item .value { color: #1e293b; font-weight: 600; font-size: 13px; }
          .photo-section { text-align: center; margin: 15px 0; }
          .photo-section img { max-width: 320px; max-height: 220px; border-radius: 10px; border: 3px solid #e2e8f0; }
          .period-summary { display: flex; justify-content: center; gap: 30px; margin: 15px 0; padding: 15px; background: #f5f3ff; border-radius: 10px; border: 1px solid #ddd6fe; }
          .period-item { text-align: center; }
          .period-item .period-label { font-size: 11px; color: #64748b; font-weight: 600; }
          .period-item .period-value { font-size: 16px; color: #5b21b6; font-weight: 700; margin-top: 4px; }
          .terms-list { margin: 12px 0; }
          .term-item { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
          .term-num { background: #5b21b6; color: white; border-radius: 50%; min-width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; margin-top: 2px; }
          .term-text { font-size: 12px; line-height: 1.6; }
          .term-text .ar { color: #333; font-weight: 500; }
          .term-text .en { color: #64748b; font-size: 11px; margin-top: 2px; }
          .acknowledgment { background: #f5f3ff; border: 2px solid #5b21b6; border-radius: 10px; padding: 18px; margin: 20px 0; text-align: center; }
          .acknowledgment p { font-size: 13px; color: #5b21b6; font-weight: 600; line-height: 1.8; }
          .signatures { display: flex; justify-content: space-around; margin-top: 30px; padding-top: 20px; }
          .sig-block { text-align: center; width: 42%; }
          .sig-line { border-bottom: 2px solid #333; margin: 40px 0 8px 0; }
          .sig-label { font-size: 13px; font-weight: 700; color: #333; margin-bottom: 5px; }
          .sig-typed { font-style: italic; font-family: 'Brush Script MT', cursive, serif; font-size: 20px; color: #5b21b6; margin-top: 8px; }
          .sig-name { font-size: 11px; color: #666; margin-top: 4px; }
          .sig-date { font-size: 10px; color: #999; margin-top: 2px; }
          .footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 2px solid #e2e8f0; color: #94a3b8; font-size: 10px; }
          .footer p { margin: 2px 0; }
          .stamp-area { display: flex; justify-content: center; margin: 15px 0; }
          .stamp-box { width: 120px; height: 120px; border: 2px dashed #cbd5e1; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; font-weight: 600; }
          @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { min-height: auto; } }
        </style>
      </head>
      <body>
        <!-- PAGE 1: Education Details -->
        <div class="page">
          <div class="header">
            <img src="/logo.png" alt="FABLAB" />
            <div class="header-center">
              <h1>فاب لاب الأحساء | FABLAB Al-Ahsa</h1>
              <h2>اتفاقية التعليم | Education Agreement</h2>
            </div>
            <img src="/found.png" alt="Foundation" />
          </div>

          <div class="id-bar">
            <span>رقم الطلب | Education ID: ${education.educationId}</span>
            <span>الحالة | Status: ${statusDisplay.ar} | ${statusDisplay.en}</span>
            <span>التاريخ | Date: ${formatDatePrint(education.createdAt)}</span>
          </div>

          <div class="section-title">معلومات المعلم | Teacher Information</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">الاسم الكامل | Full Name</span><span class="value">${userName}</span></div>
            <div class="info-item"><span class="label">رقم الهوية | National ID</span><span class="value">${education.user?.nationalId || 'N/A'}</span></div>
            <div class="info-item"><span class="label">رقم الهاتف | Phone</span><span class="value">${education.user?.phoneNumber || 'N/A'}</span></div>
            <div class="info-item"><span class="label">البريد الإلكتروني | Email</span><span class="value">${education.user?.email || 'N/A'}</span></div>
            <div class="info-item"><span class="label">الجنسية | Nationality</span><span class="value">${education.user?.nationality || 'N/A'}</span></div>
            <div class="info-item"><span class="label">الجنس | Gender</span><span class="value">${education.user?.sex || 'N/A'}</span></div>
          </div>

          <div class="section-title">تفاصيل التعليم | Education Details</div>
          <div class="info-grid">
            <div class="info-item"><span class="label">القسم | Section</span><span class="value">${sectionLabel}${education.otherSectionDescription ? ' - ' + education.otherSectionDescription : ''}</span></div>
            <div class="info-item"><span class="label">عدد الطلاب | Students</span><span class="value">${education.numberOfStudents}</span></div>
            <div class="info-item"><span class="label">تاريخ البدء | Start Date</span><span class="value">${formatDatePrint(education.periodStartDate)}</span></div>
            <div class="info-item"><span class="label">تاريخ الانتهاء | End Date</span><span class="value">${formatDatePrint(education.periodEndDate)}</span></div>
            <div class="info-item"><span class="label">وقت البدء | Start Time</span><span class="value">${education.periodStartTime}</span></div>
            <div class="info-item"><span class="label">وقت الانتهاء | End Time</span><span class="value">${education.periodEndTime}</span></div>
          </div>

          ${education.roomPhotoBefore ? `
            <div class="section-title">صورة القاعة (قبل) | Room Photo (Before)</div>
            <div class="photo-section">
              <img src="${education.roomPhotoBefore}" alt="Room" />
            </div>
          ` : ''}

          <div class="period-summary">
            <div class="period-item">
              <div class="period-label">تاريخ البدء | Start Date</div>
              <div class="period-value">${formatDatePrint(education.periodStartDate)}</div>
            </div>
            <div class="period-item">
              <div class="period-label">عدد الطلاب | Students</div>
              <div class="period-value">${education.numberOfStudents}</div>
            </div>
            <div class="period-item">
              <div class="period-label">تاريخ الانتهاء | End Date</div>
              <div class="period-value">${formatDatePrint(education.periodEndDate)}</div>
            </div>
          </div>

          <div class="footer">
            <p>فاب لاب الأحساء - مؤسسة الأحساء | FABLAB Al-Ahsa - Al-Ahsa Foundation</p>
            <p>صفحة 1 من 2 | Page 1 of 2</p>
          </div>
        </div>

        <!-- PAGE 2: Terms, Conditions & Signatures -->
        <div class="page page-break">
          <div class="header">
            <img src="/logo.png" alt="FABLAB" />
            <div class="header-center">
              <h1>فاب لاب الأحساء | FABLAB Al-Ahsa</h1>
              <h2>الشروط والأحكام | Terms & Conditions</h2>
            </div>
            <img src="/found.png" alt="Foundation" />
          </div>

          <div class="id-bar">
            <span>رقم الطلب | Education ID: ${education.educationId}</span>
            <span>المعلم | Teacher: ${userName}</span>
          </div>

          <div class="section-title">الشروط والأحكام | Terms & Conditions</div>
          <div class="terms-list">
            ${termsContent.map((t, i) => `
              <div class="term-item">
                <span class="term-num">${i + 1}</span>
                <div class="term-text">
                  <div class="ar">${t.ar}</div>
                  <div class="en">${t.en}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="acknowledgment">
            <p>أقر أنا الموقع أدناه بأنني قد قرأت وفهمت جميع الشروط والأحكام المذكورة أعلاه وأوافق على الالتزام بها</p>
            <p>I, the undersigned, acknowledge that I have read, understood, and agree to comply with all the above terms and conditions.</p>
          </div>

          <div class="signatures">
            <div class="sig-block">
              <div class="sig-label">توقيع المعلم | Teacher Signature</div>
              <div class="sig-typed">${education.signature || ''}</div>
              <div class="sig-line"></div>
              <div class="sig-name">${userName}</div>
              <div class="sig-date">${formatDatePrint(education.createdAt)}</div>
            </div>
            <div class="sig-block">
              <div class="sig-label">توقيع المدير | Manager Signature</div>
              <div class="sig-typed">أ. زكي اللويم</div>
              <div class="sig-line"></div>
              <div class="sig-name">أ. زكي اللويم</div>
              <div class="sig-date">${formatDatePrint(new Date())}</div>
            </div>
          </div>

          <div class="stamp-area">
            <div class="stamp-box">ختم فاب لاب<br/>FABLAB Stamp</div>
          </div>

          <div class="footer" style="margin-top: 40px;">
            <p>هذه الوثيقة صادرة من نظام فاب لاب الأحساء لإدارة التعليم</p>
            <p>This document is issued by the FABLAB Al-Ahsa Education Management System</p>
            <p style="margin-top: 6px;">فاب لاب الأحساء - مؤسسة الأحساء | FABLAB Al-Ahsa - Al-Ahsa Foundation</p>
            <p>صفحة 2 من 2 | Page 2 of 2</p>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const handleSendEducationEmail = async () => {
    if (!educationEmailForm.message.trim()) {
      toast.error(isRTL ? 'الرجاء إدخال الرسالة' : 'Please enter a message');
      return;
    }
    setSendingEducationEmail(true);
    try {
      await api.post(`/education/${encodeURIComponent(selectedEducation.educationId)}/send-email`, {
        subject: educationEmailForm.subject,
        message: educationEmailForm.message
      });
      toast.success(isRTL ? 'تم إرسال البريد الإلكتروني بنجاح' : 'Email sent successfully');
      setShowEducationEmailModal(false);
      setEducationEmailForm({ subject: '', message: '' });
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(isRTL ? 'خطأ في إرسال البريد الإلكتروني' : 'Error sending email');
    } finally {
      setSendingEducationEmail(false);
    }
  };

  const fetchAttendanceSheet = async (educationId) => {
    setLoadingAttendanceSheet(true);
    try {
      const response = await api.get(`/education/${encodeURIComponent(educationId)}/attendance-sheet`);
      setAttendanceSheetData(response.data);
      setShowAttendanceSheet(true);
    } catch (error) {
      console.error('Error fetching attendance sheet:', error);
      toast.error(isRTL ? 'خطأ في تحميل سجل الحضور' : 'Error loading attendance sheet');
    } finally {
      setLoadingAttendanceSheet(false);
    }
  };

  const getEducationStatusColor = (status) => {
    const colors = { pending: '#f59e0b', approved: '#22c55e', active: '#3b82f6', completed: '#6d28d9', rejected: '#ef4444' };
    return colors[status] || '#94a3b8';
  };

  const getEducationStatusLabel = (status) => {
    const labels = {
      pending: isRTL ? 'قيد الانتظار' : 'Pending',
      approved: isRTL ? 'مقبول' : 'Approved',
      active: isRTL ? 'نشط' : 'Active',
      completed: isRTL ? 'مكتمل' : 'Completed',
      rejected: isRTL ? 'مرفوض' : 'Rejected'
    };
    return labels[status] || status;
  };

  const getDamageLevelColor = (level) => {
    const colors = { none: '#22c55e', minor: '#f59e0b', moderate: '#f97316', severe: '#ef4444' };
    return colors[level] || '#94a3b8';
  };

  const getDamageLevelLabel = (level) => {
    const labels = {
      none: isRTL ? 'بدون' : 'None',
      minor: isRTL ? 'طفيف' : 'Minor',
      moderate: isRTL ? 'متوسط' : 'Moderate',
      severe: isRTL ? 'شديد' : 'Severe'
    };
    return labels[level] || level;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Force Gregorian calendar so mobile Safari doesn't render Hijri
    // for the ar-SA locale.
    return new Date(dateString).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      calendar: 'gregory'
    });
  };

  const menuItems = [
    { id: 'dashboard', icon: 'dashboard', labelEn: 'Dashboard', labelAr: 'لوحة التحكم' },
    { id: 'registrations', icon: 'registrations', labelEn: 'Registrations', labelAr: 'التسجيلات' },
    { id: 'users', icon: 'users', labelEn: 'Users', labelAr: 'المستخدمين' },
    { id: 'analytics', icon: 'analytics', labelEn: 'Analytics', labelAr: 'التحليلات' },
    { id: 'schedule', icon: 'schedule', labelEn: 'Schedule', labelAr: 'الجدول' },
    { id: 'borrowing', icon: 'borrowing', labelEn: 'Borrowing', labelAr: 'الاستعارة' },
    { id: 'education', icon: 'education', labelEn: 'Education', labelAr: 'التعليم' },
    { id: 'workshops', icon: 'workshops', labelEn: 'Workshops', labelAr: 'الورش التدريبية' },
    { id: 'workspaces', icon: 'workspaces', labelEn: 'Workspaces', labelAr: 'مساحات العمل' },
    { id: 'volunteers', icon: 'volunteers', labelEn: 'Volunteers', labelAr: 'المتطوعين' },
    { id: 'workers', icon: 'workers', labelEn: 'Workers', labelAr: 'العمال' },
    { id: 'fablab-staff', icon: 'fablab-staff', labelEn: 'FabLab Staff', labelAr: 'موظفو فاب لاب' },
    { id: 'overtime', icon: 'overtime', labelEn: 'Overtime', labelAr: 'الساعات الإضافية' },
    { id: 'trainer-assistants', icon: 'trainer-assistants', labelEn: 'Assistant Trainers', labelAr: 'مدرب معاون' },
    { id: 'summer', icon: 'summer', labelEn: 'Summer FabLab', labelAr: 'صيف فاب لاب' },
    { id: 'mawhba', icon: 'mawhba', labelEn: 'Mawhba', labelAr: 'موهبة' },
    { id: 'contracts', icon: 'contracts', labelEn: 'Contracts', labelAr: 'العقود' },
    { id: 'customers', icon: 'customers', labelEn: 'Customers', labelAr: 'العملاء' },
    { id: 'fablab-visits', icon: 'fablab-visits', labelEn: 'FabLab Visits', labelAr: 'زيارات فاب لاب' },
    { id: 'store', icon: 'store', labelEn: 'Store', labelAr: 'المتجر' },
    { id: 'print3d', icon: 'print3d', labelEn: '3D Printing', labelAr: 'الطباعة ثلاثية الأبعاد' },
    { id: 'institution-support', icon: 'institution-support', labelEn: 'Institution Support', labelAr: 'دعم مؤسسة' },
    { id: 'year-calendar', icon: 'year-calendar', labelEn: 'Year Calendar', labelAr: 'التقويم السنوي' },
    { id: 'attendance-station', icon: 'attendance-station', labelEn: 'Attendance Station', labelAr: 'محطة الحضور' },
    { id: 'quick-messages', icon: 'quick-messages', labelEn: 'Quick Messages', labelAr: 'رسائل جاهزة' },
    { id: 'settings', icon: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات' }
  ];

  const getIcon = (iconName) => {
    const icons = {
      dashboard: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
      registrations: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
      users: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      analytics: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
      schedule: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      borrowing: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
      education: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
      workshops: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
      workspaces: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
      volunteers: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      workers: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20a8 8 0 0 1 16 0"/><circle cx="10" cy="8" r="4"/><path d="M16 17l2 3 4-7"/></svg>,
      'fablab-staff': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      overtime: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
      'trainer-assistants': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
      summer: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
      mawhba: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z"/></svg>,
      customers: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
      contracts: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
      'quick-messages': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
      'fablab-visits': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
      'year-calendar': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><rect x="7" y="13" width="3" height="3"/><rect x="14" y="13" width="3" height="3"/></svg>,
      'store': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
      'print3d': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
      'institution-support': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><rect x="9" y="12" width="6" height="9"/><path d="M9 9h6"/></svg>,
      'attendance-station': <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
      settings: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    };
    return icons[iconName] || null;
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  const getEventsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return schedule.filter(event => {
      if (!event.date) return false;
      const startStr = String(event.date).substring(0, 10);
      const endStr = (event.dueDateEnd || event.date) ? String(event.dueDateEnd || event.date).substring(0, 10) : startStr;
      const isOnDay = dayStr >= startStr && dayStr <= endStr;
      if (!isOnDay) return false;
      if (scheduleFilter !== 'all') {
        return event.section === scheduleFilter;
      }
      return true;
    });
  };

  // Get filtered schedule for upcoming appointments (today and future only)
  const getFilteredSchedule = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter to only include today and future appointments
    const upcomingSchedule = schedule.filter(event => {
      const eventDate = new Date(event.date || event.appointmentDate || event.visitDate || event.startDate || event.dueDate);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    });

    // Sort by date (earliest first)
    upcomingSchedule.sort((a, b) => {
      const dateA = new Date(a.date || a.appointmentDate || a.visitDate || a.startDate || a.dueDate);
      const dateB = new Date(b.date || b.appointmentDate || b.visitDate || b.startDate || b.dueDate);
      return dateA - dateB;
    });

    if (scheduleFilter === 'all') return upcomingSchedule;
    return upcomingSchedule.filter(event => event.section === scheduleFilter);
  };

  const sectionLabels = {
    'Electronics and Programming': isRTL ? 'الإلكترونيات والبرمجة' : 'Electronics & Programming',
    'CNC Laser': isRTL ? 'الليزر CNC' : 'CNC Laser',
    'CNC Wood': isRTL ? 'الخشب CNC' : 'CNC Wood',
    'CNC Metal': isRTL ? 'المعادن CNC' : 'CNC Metal',
    '3D': isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing',
    'Robotic and AI': isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI',
    "Kid's Club": isRTL ? 'نادي الأطفال' : "Kid's Club",
    'Vinyl Cutting': isRTL ? 'قطع الفينيل' : 'Vinyl Cutting',
    'UV Printing and Sticker Making': isRTL ? 'طباعة UV والملصقات' : 'UV Printing & Stickers'
  };

  const statusLabels = {
    pending: isRTL ? 'قيد المراجعة' : 'Pending',
    approved: isRTL ? 'مقبول' : 'Approved',
    rejected: isRTL ? 'مرفوض' : 'Rejected'
  };

  const applicationTypeLabels = {
    'Beneficiary': isRTL ? 'مستفيد' : 'Beneficiary',
    'Visitor': isRTL ? 'زائر' : 'Visitor',
    'Volunteer': isRTL ? 'متطوع' : 'Volunteer',
    'Talented': isRTL ? 'موهوب' : 'Talented',
    'Entity': isRTL ? 'جهة' : 'Entity',
    'FABLAB Visit': isRTL ? 'زيارة فاب لاب' : 'FABLAB Visit'
  };

  const serviceLabels = {
    // Main required services from registration form
    'In-person consultation': isRTL ? 'استشارة حضورية' : 'In-person Consultation',
    'Online consultation': isRTL ? 'استشارة عن بعد' : 'Online Consultation',
    'Machine/Device reservation': isRTL ? 'حجز جهاز / آلة' : 'Machine/Device Reservation',
    'Personal workspace': isRTL ? 'مساحة عمل شخصية' : 'Personal Workspace',
    'Support in project implementation': isRTL ? 'دعم في تنفيذ المشروع' : 'Project Implementation Support',
    'FABLAB Visit': isRTL ? 'زيارة فاب لاب' : 'FABLAB Visit',
    'Volunteering': isRTL ? 'تطوع' : 'Volunteering',
    'Other': isRTL ? 'أخرى' : 'Other',
    // Additional services
    'PCB Design': isRTL ? 'تصميم الدوائر المطبوعة' : 'PCB Design',
    'PCB Fabrication': isRTL ? 'تصنيع الدوائر المطبوعة' : 'PCB Fabrication',
    'Arduino Programming': isRTL ? 'برمجة الأردوينو' : 'Arduino Programming',
    'Raspberry Pi': isRTL ? 'راسبيري باي' : 'Raspberry Pi',
    'IoT Projects': isRTL ? 'مشاريع إنترنت الأشياء' : 'IoT Projects',
    'Laser Cutting': isRTL ? 'القطع بالليزر' : 'Laser Cutting',
    'Laser Engraving': isRTL ? 'النقش بالليزر' : 'Laser Engraving',
    'Wood Cutting': isRTL ? 'قطع الخشب' : 'Wood Cutting',
    'Wood Carving': isRTL ? 'نحت الخشب' : 'Wood Carving',
    'CNC Milling': isRTL ? 'التفريز CNC' : 'CNC Milling',
    '3D Printing': isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing',
    '3D Modeling': isRTL ? 'النمذجة ثلاثية الأبعاد' : '3D Modeling',
    '3D Scanning': isRTL ? 'المسح ثلاثي الأبعاد' : '3D Scanning',
    'Robot Design': isRTL ? 'تصميم الروبوت' : 'Robot Design',
    'Robot Programming': isRTL ? 'برمجة الروبوت' : 'Robot Programming',
    'AI Projects': isRTL ? 'مشاريع الذكاء الاصطناعي' : 'AI Projects',
    'Machine Learning': isRTL ? 'تعلم الآلة' : 'Machine Learning',
    'Vinyl Cutting': isRTL ? 'قطع الفينيل' : 'Vinyl Cutting',
    'Sticker Making': isRTL ? 'صناعة الملصقات' : 'Sticker Making',
    'Heat Transfer': isRTL ? 'النقل الحراري' : 'Heat Transfer',
    'Kids Workshop': isRTL ? 'ورشة الأطفال' : 'Kids Workshop',
    'Educational Activities': isRTL ? 'الأنشطة التعليمية' : 'Educational Activities',
    'STEM Activities': isRTL ? 'أنشطة STEM' : 'STEM Activities',
    'Consultation': isRTL ? 'استشارة' : 'Consultation',
    'Training': isRTL ? 'تدريب' : 'Training',
    'Project Development': isRTL ? 'تطوير المشاريع' : 'Project Development',
    'Prototyping': isRTL ? 'النماذج الأولية' : 'Prototyping'
  };

  // Helper function to translate services array
  const translateServices = (services) => {
    if (!services || !Array.isArray(services)) return 'N/A';
    return services.map(service => serviceLabels[service] || service).join(', ');
  };

  // Helper function to get sex label
  const getSexLabel = (sex) => {
    if (!sex) return 'N/A';
    const normalizedSex = sex.toLowerCase();
    if (normalizedSex === 'male') return isRTL ? 'ذكر' : 'Male';
    if (normalizedSex === 'female') return isRTL ? 'أنثى' : 'Female';
    return sex;
  };

  if (!adminData) {
    return null;
  }

  return (
    <div className="admin-layout" dir={isRTL ? 'rtl' : 'ltr'}>
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
          {sidebarOpen && <span className="sidebar-title">FABLAB</span>}
        </div>

        <nav className="sidebar-nav">
          {menuItems.filter(item => !hiddenTabs.includes(item.id)).map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                if (item.id === 'workspaces') {
                  handleWorkspaceTabClick();
                } else {
                  setActiveTab(item.id);
                }
                // Close sidebar on mobile when nav item is clicked
                if (window.innerWidth <= 768) {
                  setSidebarOpen(false);
                }
              }}
            >
              {getIcon(item.icon)}
              {sidebarOpen && <span>{isRTL ? item.labelAr : item.labelEn}</span>}
            </button>
          ))}

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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <h1 className="page-title">
              {menuItems.find(item => item.id === activeTab)?.[isRTL ? 'labelAr' : 'labelEn']}
            </h1>
          </div>

          <div className="header-right">
            <div className="admin-profile">
              <div className="admin-avatar">
                {adminData.fullName?.charAt(0) || 'A'}
              </div>
              <div className="admin-info">
                <span className="admin-name">{adminData.fullName}</span>
                <span className="admin-role">{isRTL ? 'مدير النظام' : 'Administrator'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="admin-content">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}

                className="dashboard-content"
              >
                {/* Stats Cards */}
                <div className="stats-grid">
                  <div className="stat-card primary">
                    <div className="stat-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                    </div>
                    <div className="stat-content">
                      <span className="stat-value">{stats.totalRegistrations}</span>
                      <span className="stat-label">{isRTL ? 'إجمالي التسجيلات' : 'Total Registrations'}</span>
                    </div>
                  </div>

                  <div className="stat-card warning">
                    <div className="stat-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div className="stat-content">
                      <span className="stat-value">{stats.pendingRegistrations}</span>
                      <span className="stat-label">{isRTL ? 'قيد المراجعة' : 'Pending'}</span>
                    </div>
                  </div>

                  <div className="stat-card success">
                    <div className="stat-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                    </div>
                    <div className="stat-content">
                      <span className="stat-value">{stats.approvedRegistrations}</span>
                      <span className="stat-label">{isRTL ? 'مقبول' : 'Approved'}</span>
                    </div>
                  </div>

                  <div className="stat-card danger">
                    <div className="stat-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    </div>
                    <div className="stat-content">
                      <span className="stat-value">{stats.rejectedRegistrations}</span>
                      <span className="stat-label">{isRTL ? 'مرفوض' : 'Rejected'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="dashboard-section">
                  <h2 className="section-title">{isRTL ? 'إجراءات سريعة' : 'Quick Actions'}</h2>
                  <div className="actions-grid">
                    <button className="action-card" onClick={() => setActiveTab('registrations')}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span>{isRTL ? 'عرض التسجيلات' : 'View Registrations'}</span>
                    </button>

                    <button className="action-card" onClick={handleExportCSV}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
                    </button>

                    <button className="action-card" onClick={() => setActiveTab('users')}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      <span>{isRTL ? 'إدارة المستخدمين' : 'Manage Users'}</span>
                    </button>

                    <button className="action-card" onClick={() => setActiveTab('analytics')}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10"/>
                        <line x1="12" y1="20" x2="12" y2="4"/>
                        <line x1="6" y1="20" x2="6" y2="14"/>
                      </svg>
                      <span>{isRTL ? 'عرض التحليلات' : 'View Analytics'}</span>
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="dashboard-section">
                  <h2 className="section-title">{isRTL ? 'النشاط الأخير' : 'Recent Activity'}</h2>
                  <div className="recent-registrations">
                    {registrations.slice(0, 5).map((reg, index) => (
                      <div key={reg.registrationId || index} className="recent-item">
                        <div className="recent-avatar">
                          {reg.user?.firstName?.charAt(0) || reg.user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="recent-info">
                          <span className="recent-name">
                            {reg.user?.firstName && reg.user?.lastName
                              ? `${reg.user.firstName} ${reg.user.lastName}`
                              : reg.user?.name || 'Unknown'}
                          </span>
                          <span className="recent-type">{applicationTypeLabels[reg.user?.applicationType] || reg.user?.applicationType}</span>
                        </div>
                        <div className="recent-meta">
                          <span className={`status-badge ${reg.status}`}>{statusLabels[reg.status]}</span>
                          <span className="recent-date">{formatDate(reg.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                    {registrations.length === 0 && (
                      <p className="empty-message">{isRTL ? 'لا توجد تسجيلات حتى الآن' : 'No registrations yet'}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Registrations Tab */}
            {activeTab === 'registrations' && (
              <motion.div
                key="registrations"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}

                className="registrations-content"
              >
                {/* Filters */}
                <div className="filters-bar">
                  <div className="search-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      placeholder={isRTL ? 'بحث...' : 'Search...'}
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                  </div>

                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="filter-select"
                  >
                    <option value="">{isRTL ? 'كل الحالات' : 'All Status'}</option>
                    <option value="pending">{isRTL ? 'قيد المراجعة' : 'Pending'}</option>
                    <option value="approved">{isRTL ? 'مقبول' : 'Approved'}</option>
                    <option value="rejected">{isRTL ? 'مرفوض' : 'Rejected'}</option>
                  </select>

                  <select
                    value={filters.applicationType}
                    onChange={(e) => setFilters({ ...filters, applicationType: e.target.value })}
                    className="filter-select"
                  >
                    <option value="">{isRTL ? 'كل الأنواع' : 'All Types'}</option>
                    <option value="Beneficiary">{isRTL ? 'مستفيد' : 'Beneficiary'}</option>
                    <option value="Visitor">{isRTL ? 'زائر' : 'Visitor'}</option>
                    <option value="Volunteer">{isRTL ? 'متطوع' : 'Volunteer'}</option>
                    <option value="Talented">{isRTL ? 'موهوب' : 'Talented'}</option>
                    <option value="Entity">{isRTL ? 'جهة' : 'Entity'}</option>
                    <option value="FABLAB Visit">{isRTL ? 'زيارة فاب لاب' : 'FABLAB Visit'}</option>
                  </select>

                  <select
                    value={filters.section}
                    onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                    className="filter-select"
                  >
                    <option value="">{isRTL ? 'كل الأقسام' : 'All Sections'}</option>
                    <option value="Electronics and Programming">{isRTL ? 'الإلكترونيات والبرمجة' : 'Electronics & Programming'}</option>
                    <option value="CNC Laser">{isRTL ? 'الليزر CNC' : 'CNC Laser'}</option>
                    <option value="CNC Wood">{isRTL ? 'الخشب CNC' : 'CNC Wood'}</option>
                    <option value="CNC Metal">{isRTL ? 'المعادن CNC' : 'CNC Metal'}</option>
                    <option value="3D">{isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing'}</option>
                    <option value="Robotic and AI">{isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI'}</option>
                    <option value="Kid's Club">{isRTL ? 'نادي الأطفال' : "Kid's Club"}</option>
                    <option value="Vinyl Cutting">{isRTL ? 'قطع الفينيل' : 'Vinyl Cutting'}</option>
                    <option value="UV Printing and Sticker Making">{isRTL ? 'طباعة UV والملصقات' : 'UV Printing & Stickers'}</option>
                  </select>

                  <select
                    value={filters.sex}
                    onChange={(e) => setFilters({ ...filters, sex: e.target.value })}
                    className="filter-select"
                  >
                    <option value="">{isRTL ? 'كل الجنس' : 'All Genders'}</option>
                    <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                    <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
                  </select>

                  <div className="date-range-filter">
                    <div className="date-input-group">
                      <label>{isRTL ? 'من:' : 'From:'}</label>
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        className="date-input"
                      />
                    </div>
                    <div className="date-input-group">
                      <label>{isRTL ? 'إلى:' : 'To:'}</label>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        className="date-input"
                      />
                    </div>
                    {(filters.dateFrom || filters.dateTo) && (
                      <button
                        className="clear-dates-btn"
                        onClick={() => setFilters({ ...filters, dateFrom: '', dateTo: '' })}
                        title={isRTL ? 'مسح التواريخ' : 'Clear dates'}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <button className="filter-btn" onClick={() => fetchRegistrations(1)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                    {isRTL ? 'تحديث' : 'Refresh'}
                  </button>

                  <button className="export-btn" onClick={handleExportCSV}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {isRTL ? 'تصدير' : 'Export'}
                  </button>
                </div>

                {/* Registrations Table */}
                <div className="table-container">
                  {loading ? (
                    <div className="loading-container">
                      <div className="loading-spinner large" />
                      <p>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
                    </div>
                  ) : registrations.length === 0 ? (
                    <div className="empty-state">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <p>{isRTL ? 'لا توجد تسجيلات' : 'No registrations found'}</p>
                    </div>
                  ) : (
                    <>
                      {/* Bulk Actions Bar */}
                      {selectedRegistrations.size > 0 && (
                        <div className="bulk-actions-bar">
                          <span className="bulk-count">
                            {isRTL
                              ? `${selectedRegistrations.size} تسجيل محدد`
                              : `${selectedRegistrations.size} selected`}
                          </span>
                          <div className="bulk-buttons">
                            <button className="bulk-btn export" onClick={handleBulkExport}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                              </svg>
                              {isRTL ? 'تصدير CSV' : 'Export CSV'}
                            </button>
                            <button className="bulk-btn delete" onClick={handleBulkDelete}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                              {isRTL ? 'حذف المحدد' : 'Delete Selected'}
                            </button>
                            <button className="bulk-btn deselect" onClick={handleDeselectAll}>
                              {isRTL ? 'إلغاء التحديد' : 'Deselect All'}
                            </button>
                          </div>
                        </div>
                      )}
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="checkbox-col">
                              <input
                                type="checkbox"
                                checked={selectedRegistrations.size === registrations.length && registrations.length > 0}
                                onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                                title={isRTL ? 'تحديد الكل' : 'Select All'}
                              />
                            </th>
                            <th>{isRTL ? 'رقم التسجيل' : 'Reg. ID'}</th>
                            <th>{isRTL ? 'الاسم' : 'Name'}</th>
                            <th>{isRTL ? 'النوع' : 'Type'}</th>
                            <th>{isRTL ? 'القسم' : 'Section'}</th>
                            <th>{isRTL ? 'الموعد' : 'Date'}</th>
                            <th>{isRTL ? 'الحالة' : 'Status'}</th>
                            <th>{isRTL ? 'الإجراءات' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrations.map((reg) => (
                            <tr key={reg.registrationId} className={selectedRegistrations.has(reg.registrationId) ? 'selected' : ''}>
                              <td className="checkbox-col">
                                <input
                                  type="checkbox"
                                  checked={selectedRegistrations.has(reg.registrationId)}
                                  onChange={() => handleToggleSelection(reg.registrationId)}
                                />
                              </td>
                              <td><span className="reg-id">{reg.registrationId}</span></td>
                              <td>
                                <span
                                  className="user-link"
                                  onClick={() => fetchUserWithRegistrations(reg.userId)}
                                >
                                  {reg.user?.firstName && reg.user?.lastName
                                    ? `${reg.user.firstName} ${reg.user.lastName}`
                                    : reg.user?.name || 'N/A'}
                                </span>
                              </td>
                              <td>{applicationTypeLabels[reg.user?.applicationType] || reg.user?.applicationType}</td>
                              <td>{sectionLabels[reg.fablabSection] || reg.fablabSection}</td>
                              <td>{formatDate(reg.appointmentDate || reg.visitDate || reg.startDate)}</td>
                              <td>
                                <span className={`status-badge ${reg.status}`}>
                                  {statusLabels[reg.status]}
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons">
                                  <button
                                    className="action-btn view"
                                    onClick={() => { setSelectedRegistration(reg); setShowModal(true); }}
                                    title={isRTL ? 'عرض' : 'View'}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                      <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                  </button>
                                  <button
                                    className="action-btn print"
                                    onClick={() => handlePrintRegistration(reg)}
                                    title={isRTL ? 'طباعة' : 'Print'}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="6 9 6 2 18 2 18 9"/>
                                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                      <rect x="6" y="14" width="12" height="8"/>
                                    </svg>
                                  </button>
                                  {reg.user?.phoneNumber && (
                                    <button
                                      className="action-btn whatsapp"
                                      onClick={() => {
                                        const userName = reg.user?.firstName && reg.user?.lastName
                                          ? `${reg.user.firstName} ${reg.user.lastName}`
                                          : reg.user?.name || '';
                                        const userId = reg.user?.uniqueId || reg.userId;
                                        const appointmentDate = formatDate(reg.appointmentDate || reg.visitDate);
                                        const appointmentTime = formatTimeAMPM(reg.appointmentTime || reg.visitStartTime);
                                        let message;
                                        if (reg.status === 'approved') {
                                          message = getApprovalMessage(
                                            userName, reg.registrationId, userId, appointmentDate, appointmentTime,
                                            reg.fablabSection, reg.user?.applicationType, reg.requiredServices, null, isRTL
                                          );
                                        } else if (reg.status === 'rejected') {
                                          message = getRejectionMessage(
                                            userName, reg.registrationId, userId, reg.user?.applicationType,
                                            reg.requiredServices, reg.rejectionReason, null, isRTL
                                          );
                                        } else {
                                          message = isRTL
                                            ? `السلام عليكم ${userName}،\n\nنود التواصل معك بخصوص تسجيلك في فاب لاب الأحساء.\n\nرقم التسجيل: ${reg.registrationId}\nرقم المستفيد: ${userId || 'غير متوفر'}\nالقسم: ${reg.fablabSection}\nالتاريخ: ${appointmentDate}\nالوقت: ${appointmentTime || 'غير محدد'}\n\nمع تحيات،\nفاب لاب الأحساء`
                                            : `Hello ${userName},\n\nWe would like to contact you regarding your registration at FABLAB Al-Ahsa.\n\nRegistration ID: ${reg.registrationId}\nUser ID: ${userId || 'N/A'}\nSection: ${reg.fablabSection}\nDate: ${appointmentDate}\nTime: ${appointmentTime || 'N/A'}\n\nBest regards,\nFABLAB Al-Ahsa`;
                                        }
                                        openWhatsApp(reg.user.phoneNumber, message);
                                      }}
                                      title={isRTL ? 'واتساب' : 'WhatsApp'}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                      </svg>
                                    </button>
                                  )}
                                  {/* Show approve button for pending or rejected */}
                                  {(reg.status === 'pending' || reg.status === 'rejected') && (
                                    <button
                                      className="action-btn approve"
                                      onClick={() => handleOpenStatusModal(reg, 'approve')}
                                      title={reg.status === 'rejected'
                                        ? (isRTL ? 'تغيير إلى مقبول' : 'Change to Approved')
                                        : (isRTL ? 'قبول' : 'Approve')
                                      }
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    </button>
                                  )}
                                  {/* Show reject button for pending or approved */}
                                  {(reg.status === 'pending' || reg.status === 'approved') && (
                                    <button
                                      className="action-btn reject"
                                      onClick={() => handleOpenStatusModal(reg, 'reject')}
                                      title={reg.status === 'approved'
                                        ? (isRTL ? 'تغيير إلى مرفوض' : 'Change to Rejected')
                                        : (isRTL ? 'رفض' : 'Reject')
                                      }
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="pagination-container">
                      <div className="pagination-info">
                        {isRTL
                          ? `عرض ${((pagination.page - 1) * pagination.limit) + 1} - ${Math.min(pagination.page * pagination.limit, pagination.total)} من ${pagination.total} تسجيل`
                          : `Showing ${((pagination.page - 1) * pagination.limit) + 1} - ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} registrations`
                        }
                      </div>
                      <div className="pagination-controls">
                        <button
                          className="pagination-btn"
                          onClick={() => handlePageChange(1)}
                          disabled={pagination.page === 1}
                          title={isRTL ? 'الصفحة الأولى' : 'First page'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="11 17 6 12 11 7"/>
                            <polyline points="18 17 13 12 18 7"/>
                          </svg>
                        </button>
                        <button
                          className="pagination-btn"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page === 1}
                          title={isRTL ? 'السابق' : 'Previous'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6"/>
                          </svg>
                        </button>
                        <span className="pagination-pages">
                          {isRTL
                            ? `صفحة ${pagination.page} من ${pagination.pages}`
                            : `Page ${pagination.page} of ${pagination.pages}`
                          }
                        </span>
                        <button
                          className="pagination-btn"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page === pagination.pages}
                          title={isRTL ? 'التالي' : 'Next'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                        <button
                          className="pagination-btn"
                          onClick={() => handlePageChange(pagination.pages)}
                          disabled={pagination.page === pagination.pages}
                          title={isRTL ? 'الصفحة الأخيرة' : 'Last page'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="13 17 18 12 13 7"/>
                            <polyline points="6 17 11 12 6 7"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}

                className="users-content"
              >
                <div className="filters-bar">
                  <div className="search-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleUserSearch()}
                      placeholder={isRTL ? 'بحث بالاسم أو البريد أو الهاتف...' : 'Search by name, email, or phone...'}
                    />
                  </div>
                  <button className="filter-btn" onClick={handleUserSearch}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    {isRTL ? 'بحث' : 'Search'}
                  </button>
                  <button className="filter-btn" onClick={() => { setUserSearch(''); fetchUsers(1); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                    {isRTL ? 'تحديث' : 'Refresh'}
                  </button>
                </div>

                <div className="table-container">
                  {/* Selection Info Bar */}
                  {selectedUsers.size > 0 && (
                    <div className="selection-bar">
                      <span>
                        {isRTL
                          ? `${selectedUsers.size} مستخدم محدد`
                          : `${selectedUsers.size} selected`}
                        {userPagination.total > userPagination.limit && selectedUsers.size < userPagination.total && (
                          <button
                            onClick={handleSelectAllUsersAllPages}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#3b82f6',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontSize: '13px',
                              marginInlineStart: '8px',
                              padding: 0
                            }}
                          >
                            {isRTL
                              ? `تحديد الكل (${userPagination.total})`
                              : `Select all ${userPagination.total} users`}
                          </button>
                        )}
                      </span>
                      <div className="selection-actions">
                        <button className="export-btn" onClick={handleExportSelectedUsers}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          {isRTL ? 'تصدير المحدد' : 'Export Selected'}
                        </button>
                        <button
                          className="export-btn"
                          onClick={() => setShowEmailModal(true)}
                          style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          {isRTL ? 'إرسال بريد' : 'Send Email'}
                        </button>
                        <button className="deselect-btn" onClick={handleDeselectAllUsersGlobal}>
                          {isRTL ? 'إلغاء التحديد' : 'Deselect All'}
                        </button>
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <div className="loading-container">
                      <div className="loading-spinner large" />
                      <p>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="empty-state">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                      </svg>
                      <p>{isRTL ? 'لا يوجد مستخدمين' : 'No users found'}</p>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="checkbox-cell">
                            <input
                              type="checkbox"
                              checked={users.length > 0 && users.every(u => selectedUsers.has(u.userId))}
                              onChange={(e) => e.target.checked ? handleSelectAllUsers() : handleDeselectAllUsers()}
                              title={isRTL ? 'تحديد الكل في هذه الصفحة' : 'Select All on This Page'}
                            />
                          </th>
                          <th>{isRTL ? 'رقم المستخدم' : 'User ID'}</th>
                          <th>{isRTL ? 'الاسم' : 'Name'}</th>
                          <th>{isRTL ? 'البريد الإلكتروني' : 'Email'}</th>
                          <th>{isRTL ? 'الهاتف' : 'Phone'}</th>
                          <th>{isRTL ? 'النوع' : 'Type'}</th>
                          <th>{isRTL ? 'تاريخ التسجيل' : 'Registered'}</th>
                          <th>{isRTL ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.userId} className={selectedUsers.has(user.userId) ? 'selected' : ''}>
                            <td className="checkbox-cell">
                              <input
                                type="checkbox"
                                checked={selectedUsers.has(user.userId)}
                                onChange={() => handleToggleUser(user.userId)}
                              />
                            </td>
                            <td><span className="reg-id">{user.userId}</span></td>
                            <td>
                              <span
                                className="user-link"
                                onClick={() => fetchUserWithRegistrations(user.userId)}
                              >
                                {user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.name || 'N/A'}
                              </span>
                            </td>
                            <td>{user.email}</td>
                            <td>{user.phoneNumber}</td>
                            <td>{applicationTypeLabels[user.applicationType] || user.applicationType}</td>
                            <td>{formatDate(user.createdAt)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  className="action-btn view"
                                  onClick={() => fetchUserWithRegistrations(user.userId)}
                                  title={isRTL ? 'عرض التسجيلات' : 'View Registrations'}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                  </svg>
                                </button>
                                <button
                                  className="action-btn"
                                  onClick={() => handlePrintUserIDCard(user)}
                                  title={isRTL ? 'طباعة البطاقة' : 'Print ID Card'}
                                  style={{ background: 'linear-gradient(135deg, #e02529, #c41e24)' }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                                    <line x1="8" y1="21" x2="16" y2="21"/>
                                    <line x1="12" y1="17" x2="12" y2="21"/>
                                  </svg>
                                </button>
                                <button
                                  className="action-btn"
                                  onClick={() => handlePrintTermsDocument(user)}
                                  title={isRTL ? 'وثيقة الاستفادة' : 'Terms Document'}
                                  style={{ background: 'linear-gradient(135deg, #1a1a2e, #2d2d44)' }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                  </svg>
                                </button>
                                <button
                                  className="action-btn delete"
                                  onClick={() => handleDeleteUser(user.userId)}
                                  title={isRTL ? 'حذف المستخدم' : 'Delete User'}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {/* Users Pagination */}
                  {userPagination.pages > 1 && (
                    <div className="pagination-container">
                      <div className="pagination-info">
                        {isRTL
                          ? `عرض ${((userPagination.page - 1) * userPagination.limit) + 1} - ${Math.min(userPagination.page * userPagination.limit, userPagination.total)} من ${userPagination.total} مستخدم`
                          : `Showing ${((userPagination.page - 1) * userPagination.limit) + 1} - ${Math.min(userPagination.page * userPagination.limit, userPagination.total)} of ${userPagination.total} users`
                        }
                      </div>
                      <div className="pagination-controls">
                        <button
                          className="pagination-btn"
                          onClick={() => handleUserPageChange(1)}
                          disabled={userPagination.page === 1}
                          title={isRTL ? 'الصفحة الأولى' : 'First page'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="11 17 6 12 11 7"/>
                            <polyline points="18 17 13 12 18 7"/>
                          </svg>
                        </button>
                        <button
                          className="pagination-btn"
                          onClick={() => handleUserPageChange(userPagination.page - 1)}
                          disabled={userPagination.page === 1}
                          title={isRTL ? 'السابق' : 'Previous'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6"/>
                          </svg>
                        </button>
                        <span className="pagination-pages">
                          {isRTL
                            ? `صفحة ${userPagination.page} من ${userPagination.pages}`
                            : `Page ${userPagination.page} of ${userPagination.pages}`
                          }
                        </span>
                        <button
                          className="pagination-btn"
                          onClick={() => handleUserPageChange(userPagination.page + 1)}
                          disabled={userPagination.page === userPagination.pages}
                          title={isRTL ? 'التالي' : 'Next'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                        <button
                          className="pagination-btn"
                          onClick={() => handleUserPageChange(userPagination.pages)}
                          disabled={userPagination.page === userPagination.pages}
                          title={isRTL ? 'الصفحة الأخيرة' : 'Last page'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="13 17 18 12 13 7"/>
                            <polyline points="6 17 11 12 6 7"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}

                className="analytics-content opsv2"
              >
                <motion.div
                  className="op-command"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div>
                    <span className="op-kicker">{isRTL ? 'مركز التحليلات · OPS' : 'ANALYTICS · TERMINAL'}</span>
                    <h2 className="op-title">{isRTL ? 'التحليلات والإحصائيات' : 'Analytics & Insights'}</h2>
                  </div>
                  <div className="op-metrics">
                    {analyticsData && (
                      <>
                        <motion.div className="op-metric red"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 22 }}>
                          <span className="val">{analyticsData?.totalRegistrations ?? stats.totalRegistrations ?? 0}</span>
                          <span className="lbl">{isRTL ? 'التسجيلات' : 'Registrations'}</span>
                        </motion.div>
                        <motion.div className="op-metric mint"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.18, type: 'spring', stiffness: 300, damping: 22 }}>
                          <span className="val">{analyticsData?.approvedCount ?? stats.approvedRegistrations ?? 0}</span>
                          <span className="lbl">{isRTL ? 'موافق' : 'Approved'}</span>
                        </motion.div>
                        <motion.div className="op-metric amber"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.24, type: 'spring', stiffness: 300, damping: 22 }}>
                          <span className="val">{analyticsData?.pendingCount ?? stats.pendingRegistrations ?? 0}</span>
                          <span className="lbl">{isRTL ? 'قيد المراجعة' : 'Pending'}</span>
                        </motion.div>
                        <motion.div className="op-metric cyan"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.30, type: 'spring', stiffness: 300, damping: 22 }}>
                          <span className="val">{analyticsData?.totalUsers ?? stats.totalUsers ?? 0}</span>
                          <span className="lbl">{isRTL ? 'المستخدمون' : 'Users'}</span>
                        </motion.div>
                      </>
                    )}
                  </div>
                </motion.div>
                <div className="analytics-header">
                  <div className="date-range-selector">
                    <div className="date-input-group">
                      <label>{isRTL ? 'من' : 'From'}</label>
                      <input
                        type="date"
                        value={analyticsDateRange.startDate}
                        onChange={(e) => setAnalyticsDateRange({ ...analyticsDateRange, startDate: e.target.value })}
                        className="date-input"
                      />
                    </div>
                    <div className="date-input-group">
                      <label>{isRTL ? 'إلى' : 'To'}</label>
                      <input
                        type="date"
                        value={analyticsDateRange.endDate}
                        onChange={(e) => setAnalyticsDateRange({ ...analyticsDateRange, endDate: e.target.value })}
                        className="date-input"
                      />
                    </div>
                    <button
                      className="filter-btn"
                      onClick={fetchEnhancedAnalytics}
                    >
                      {isRTL ? 'تطبيق' : 'Apply'}
                    </button>
                    <button
                      className="filter-btn"
                      onClick={() => {
                        setAnalyticsDateRange({ startDate: '', endDate: '' });
                        setTimeout(fetchEnhancedAnalytics, 100);
                      }}
                    >
                      {isRTL ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                  <div className="period-selector">
                    <button
                      className={`period-btn ${analyticsPeriod === 'week' ? 'active' : ''}`}
                      onClick={() => setAnalyticsPeriod('week')}
                    >
                      {isRTL ? 'أسبوع' : 'Week'}
                    </button>
                    <button
                      className={`period-btn ${analyticsPeriod === 'month' ? 'active' : ''}`}
                      onClick={() => setAnalyticsPeriod('month')}
                    >
                      {isRTL ? 'شهر' : 'Month'}
                    </button>
                    <button
                      className={`period-btn ${analyticsPeriod === 'year' ? 'active' : ''}`}
                      onClick={() => setAnalyticsPeriod('year')}
                    >
                      {isRTL ? 'سنة' : 'Year'}
                    </button>
                  </div>
                </div>

                {analyticsData ? (
                  <>
                    <div className="stats-grid">
                      <div className="stat-card primary">
                        <div className="stat-content">
                          <span className="stat-value">{analyticsData.summary?.totalRegistrations || 0}</span>
                          <span className="stat-label">{isRTL ? 'إجمالي التسجيلات' : 'Total Registrations'}</span>
                        </div>
                      </div>
                      <div className="stat-card info">
                        <div className="stat-content">
                          <span className="stat-value">{analyticsData.summary?.totalUsers || 0}</span>
                          <span className="stat-label">{isRTL ? 'إجمالي المستخدمين' : 'Total Users'}</span>
                        </div>
                      </div>
                      <div className="stat-card success">
                        <div className="stat-content">
                          <span className="stat-value">{analyticsData.summary?.todayRegistrations || 0}</span>
                          <span className="stat-label">{isRTL ? 'تسجيلات اليوم' : "Today's Registrations"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="charts-grid">
                      <div className="chart-card full-width">
                        <h3>{isRTL ? 'التسجيلات عبر الزمن' : 'Registrations Over Time'}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={analyticsData.timeSeriesData || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              tickFormatter={(value) => {
                                try {
                                  return format(parseISO(value), 'MM/dd');
                                } catch {
                                  return value;
                                }
                              }}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="count"
                              stroke="#6366f1"
                              fill="url(#colorGradient)"
                              name={isRTL ? 'التسجيلات' : 'Registrations'}
                            />
                            <defs>
                              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="chart-card">
                        <h3>{isRTL ? 'حسب القسم' : 'By Section'}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={analyticsData.bySection || []}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="count"
                              nameKey="fablabSection"
                              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            >
                              {(analyticsData.bySection || []).map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={SECTION_COLORS[entry.fablabSection] || COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend
                              formatter={(value, entry) => sectionLabels[entry.payload.fablabSection] || entry.payload.fablabSection}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="chart-card">
                        <h3>{isRTL ? 'حسب الحالة' : 'By Status'}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analyticsData.byStatus || []} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <YAxis
                              dataKey="status"
                              type="category"
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              tickFormatter={(value) => statusLabels[value] || value}
                            />
                            <Tooltip />
                            <Bar dataKey="count" name={isRTL ? 'العدد' : 'Count'}>
                              {(analyticsData.byStatus || []).map((entry, index) => {
                                const colors = { pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444' };
                                return <Cell key={`cell-${index}`} fill={colors[entry.status] || COLORS[index]} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="loading-container">
                    <div className="loading-spinner large" />
                    <p>{isRTL ? 'جاري تحميل التحليلات...' : 'Loading analytics...'}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (() => {
              // ── Metric helpers ──
              const _todayD = new Date();
              const _todayCount = getEventsForDay(_todayD).length;
              const _weekEnd = new Date(_todayD.getTime() + 7 * 24 * 60 * 60 * 1000);
              const _weekCount = getFilteredSchedule().filter(e => {
                const d = new Date(e.date || e.appointmentDate || e.visitDate || e.startDate || e.dueDate);
                return d >= _todayD && d <= _weekEnd;
              }).length;
              const _upcomingCount = getFilteredSchedule().length;
              const _activeEmp = scheduleFilter !== 'all' && scheduleFilter !== ''
                ? employees.find(e => (Array.isArray(e.sections) ? e.sections : [e.section]).includes(scheduleFilter))
                : null;
              return (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="schedule-content schedule-v2"
              >
                {/* ═══════════════════════════════════ COMMAND BAR ═══════════════════════════════════ */}
                <motion.div
                  className="sv2-command"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="sv2-command-left">
                    <div className="sv2-command-title">
                      <span className="sv2-command-kicker">
                        {isRTL ? 'مركز التحكم · الجدول' : 'MISSION CONTROL · SCHEDULE'}
                      </span>
                      <h2>{isRTL ? 'إدارة المواعيد والمهام' : 'Appointments & Task Operations'}</h2>
                    </div>
                    <AnimatePresence mode="wait">
                      {(scheduleFilter && scheduleFilter !== 'all') ? (
                        <motion.div
                          key={`filter-${scheduleFilter}`}
                          className="sv2-filter-chip"
                          style={{
                            color: SECTION_COLORS[scheduleFilter] || 'var(--sv2-red)',
                            borderColor: (SECTION_COLORS[scheduleFilter] || '#EE2329') + '80',
                            background: (SECTION_COLORS[scheduleFilter] || '#EE2329') + '15'
                          }}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                        >
                          <span className="sv2-filter-chip-dot" />
                          <span>{sectionLabels[scheduleFilter] || scheduleFilter}</span>
                          {_activeEmp && (
                            <span className="sv2-filter-chip-name">· {_activeEmp.name}</span>
                          )}
                          <button
                            className="sv2-filter-chip-close"
                            onClick={() => setScheduleFilter('all')}
                            title={isRTL ? 'مسح الفلتر' : 'Clear filter'}
                          >×</button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="filter-all"
                          className="sv2-filter-chip all"
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                        >
                          <span className="sv2-filter-chip-dot" style={{ background: 'currentColor', color: '#94a3b8' }} />
                          <span>{isRTL ? 'كل الأقسام' : 'All Sections'}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="sv2-metrics">
                    <motion.div className="sv2-metric today"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 22 }}>
                      <span className="sv2-metric-value">{_todayCount}</span>
                      <span className="sv2-metric-label">{isRTL ? 'اليوم' : 'Today'}</span>
                    </motion.div>
                    <motion.div className="sv2-metric week"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18, type: 'spring', stiffness: 300, damping: 22 }}>
                      <span className="sv2-metric-value">{_weekCount}</span>
                      <span className="sv2-metric-label">{isRTL ? '7 أيام' : '7 Days'}</span>
                    </motion.div>
                    <motion.div className="sv2-metric upcoming"
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.24, type: 'spring', stiffness: 300, damping: 22 }}>
                      <span className="sv2-metric-value">{_upcomingCount}</span>
                      <span className="sv2-metric-label">{isRTL ? 'قادم' : 'Upcoming'}</span>
                    </motion.div>
                  </div>
                </motion.div>

                {/* ═══════════════════════════════════ MAIN GRID ═══════════════════════════════════ */}
                <div className="sv2-grid">
                  {/* ─────────── LEFT: Calendar Panel ─────────── */}
                  <motion.div
                    className="sv2-panel"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="sv2-panel-head">
                      <div className="sv2-panel-title">
                        <span className="sv2-panel-tag">[01]</span>
                        <h3>{isRTL ? 'التقويم' : 'Calendar Grid'}</h3>
                      </div>
                      <div className="sv2-cal-nav">
                        <button
                          className="sv2-cal-btn"
                          onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                          title={isRTL ? 'الشهر السابق' : 'Previous month'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15 18 9 12 15 6"/>
                          </svg>
                        </button>
                        <span className="sv2-cal-today">
                          {format(selectedDate, 'MMMM yyyy', { locale: isRTL ? ar : enUS })}
                        </span>
                        <button
                          className="sv2-cal-btn"
                          onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                          title={isRTL ? 'الشهر التالي' : 'Next month'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </button>
                        <button
                          className="sv2-cal-btn"
                          onClick={() => setSelectedDate(new Date())}
                          title={isRTL ? 'اليوم' : 'Today'}
                          style={{ marginInlineStart: 4 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="sv2-panel-body">
                      <div className="sv2-cal-weekdays">
                        {(isRTL
                          ? ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
                          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                        ).map(day => (
                          <div key={day} className="sv2-cal-weekday">{day}</div>
                        ))}
                      </div>
                      <motion.div
                        className="sv2-cal-grid"
                        key={format(selectedDate, 'yyyy-MM')}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ staggerChildren: 0.006 }}
                      >
                        {Array.from({ length: startOfMonth(selectedDate).getDay() }).map((_, i) => (
                          <div key={`empty-${i}`} className="sv2-cal-day empty" />
                        ))}
                        {getDaysInMonth(selectedDate).map((day) => {
                          const events = getEventsForDay(day);
                          const isTodayDay = isSameDay(day, new Date());
                          const isSelected = selectedCalendarDay && isSameDay(day, selectedCalendarDay);
                          const eventDots = events.slice(0, 3);
                          const extra = events.length - eventDots.length;
                          return (
                            <motion.div
                              key={day.toISOString()}
                              className={`sv2-cal-day ${isTodayDay ? 'today' : ''} ${events.length > 0 ? 'has-events' : ''} ${isSelected ? 'selected' : ''}`}
                              onClick={() => events.length > 0 && setSelectedCalendarDay(day)}
                              style={{ cursor: events.length > 0 ? 'pointer' : 'default' }}
                              whileHover={events.length > 0 ? { scale: 1.04 } : {}}
                              whileTap={events.length > 0 ? { scale: 0.96 } : {}}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25 }}
                            >
                              <span className="sv2-cal-day-num">{format(day, 'd')}</span>
                              {events.length > 0 && (
                                <div className="sv2-cal-day-dots">
                                  {eventDots.map((ev, i) => (
                                    <span
                                      key={i}
                                      className="sv2-cal-day-dot"
                                      style={{ background: SECTION_COLORS[ev.section] || '#EE2329' }}
                                    />
                                  ))}
                                  {extra > 0 && <span className="sv2-cal-day-dot more">+{extra}</span>}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* ─────────── RIGHT: Operations Stack ─────────── */}
                  <div className="sv2-right">
                    {/* ─── Roster Panel ─── */}
                    <motion.div
                      className="sv2-panel"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.18, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="sv2-panel-head">
                        <div className="sv2-panel-title">
                          <span className="sv2-panel-tag">[02]</span>
                          <h3>{isRTL ? 'الموظفون' : 'Roster'}</h3>
                        </div>
                        <button
                          className="sv2-cal-btn"
                          onClick={() => {
                            setSelectedEmployee(null);
                            setEmployeeForm({ name: '', email: '', sections: [] });
                            setShowEmployeeModal(true);
                          }}
                          title={isRTL ? 'إضافة موظف' : 'Add employee'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </button>
                      </div>
                      <div className="sv2-panel-body">
                        <div className="sv2-roster-strip">
                          <button
                            className={`sv2-roster-btn-all ${scheduleFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setScheduleFilter('all')}
                            title={isRTL ? 'كل المواعيد' : 'All schedules'}
                          >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/>
                              <line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            <span className="sv2-roster-name" style={{ marginTop: 2 }}>
                              {isRTL ? 'الكل' : 'All'}
                            </span>
                          </button>

                          {employees.length === 0 ? (
                            <div className="sv2-roster-empty">
                              {isRTL ? '— لا يوجد موظفون —' : '— No employees yet —'}
                            </div>
                          ) : employees.map((emp) => {
                            const empSections = (Array.isArray(emp.sections) && emp.sections.length)
                              ? emp.sections
                              : (emp.section ? [emp.section] : []);
                            const isActiveForFilter = empSections.includes(scheduleFilter);
                            return (
                              <motion.div
                                key={emp.employeeId}
                                className={`sv2-roster-emp ${isActiveForFilter ? 'active' : ''}`}
                                whileHover={{ y: -2 }}
                              >
                                <div className="sv2-roster-emp-actions">
                                  <button
                                    className="sv2-roster-emp-btn edit"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEmployee(emp);
                                      setEmployeeForm({
                                        name: emp.name,
                                        email: emp.email,
                                        sections: (Array.isArray(emp.sections) && emp.sections.length)
                                          ? emp.sections
                                          : (emp.section ? [emp.section] : [])
                                      });
                                      setShowEmployeeModal(true);
                                    }}
                                    title={isRTL ? 'تعديل' : 'Edit'}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                  <button
                                    className="sv2-roster-emp-btn del"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEmployee(emp.employeeId);
                                    }}
                                    title={isRTL ? 'حذف' : 'Delete'}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6"/>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                  </button>
                                </div>
                                <div className="sv2-roster-avatar" style={{ backgroundColor: getEmployeeColor(employees, emp.employeeId) }}>
                                  {emp.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <span className="sv2-roster-name">{emp.name}</span>
                                <div className="sv2-roster-secs">
                                  {empSections.map(sec => {
                                    const color = SECTION_COLORS[sec] || '#64748b';
                                    const isFilterSection = scheduleFilter === sec;
                                    return (
                                      <button
                                        key={sec}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setScheduleFilter(isFilterSection ? '' : sec);
                                        }}
                                        className="sv2-roster-sec-chip"
                                        style={{
                                          background: isFilterSection ? color : `${color}20`,
                                          color: isFilterSection ? '#fff' : color,
                                          borderColor: isFilterSection ? color : 'transparent',
                                          boxShadow: isFilterSection ? `0 2px 4px ${color}55` : 'none'
                                        }}
                                        title={isRTL
                                          ? `عرض جدول ${emp.name} في ${sectionLabels[sec] || sec}`
                                          : `Show ${emp.name}'s schedule for ${sectionLabels[sec] || sec}`}
                                      >
                                        {sectionLabels[sec] || sec}
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>

                    {/* ─── Task Injector Panel ─── */}
                    <motion.div
                      className="sv2-panel"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.24, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="sv2-panel-head">
                        <div className="sv2-panel-title">
                          <span className="sv2-panel-tag">[03]</span>
                          <h3>{isRTL ? 'إضافة مهمة' : 'Task Injector'}</h3>
                        </div>
                      </div>
                      <div className="sv2-panel-body">
                      <form onSubmit={handleCreateEmployeeTask} className="employee-task-form sv2-task-form">
                        <div className="form-group">
                          <label>{isRTL ? 'الموظف' : 'Employee'} *</label>
                          <select
                            value={employeeTaskForm.employeeId}
                            onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, employeeId: e.target.value })}
                            required
                          >
                            <option value="">{isRTL ? 'اختر الموظف' : 'Select Employee'}</option>
                            {employees.map((emp) => {
                              const empSecs = (Array.isArray(emp.sections) && emp.sections.length)
                                ? emp.sections
                                : (emp.section ? [emp.section] : []);
                              const secLabel = empSecs.map(s => sectionLabels[s] || s).join(' · ');
                              return (
                                <option key={emp.employeeId} value={emp.employeeId}>
                                  {emp.name} - {secLabel}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="form-group">
                          <label>{isRTL ? 'عنوان المهمة' : 'Task Title'} *</label>
                          <input
                            type="text"
                            value={employeeTaskForm.title}
                            onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, title: e.target.value })}
                            placeholder={isRTL ? 'أدخل عنوان المهمة' : 'Enter task title'}
                            required
                          />
                        </div>

                        <div className="form-group checkbox-group">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={employeeTaskForm.isMultipleDays}
                              onChange={(e) => setEmployeeTaskForm({
                                ...employeeTaskForm,
                                isMultipleDays: e.target.checked,
                                dueDateEnd: e.target.checked ? employeeTaskForm.dueDateEnd : ''
                              })}
                            />
                            <span>{isRTL ? 'أيام متعددة' : 'Multiple Days'}</span>
                          </label>
                        </div>

                        {employeeTaskForm.isMultipleDays ? (
                          <div className="form-row">
                            <div className="form-group">
                              <label>{isRTL ? 'من تاريخ' : 'From Date'} *</label>
                              <input
                                type="date"
                                value={employeeTaskForm.dueDate}
                                onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, dueDate: e.target.value })}
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>{isRTL ? 'إلى تاريخ' : 'To Date'} *</label>
                              <input
                                type="date"
                                value={employeeTaskForm.dueDateEnd}
                                onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, dueDateEnd: e.target.value })}
                                min={employeeTaskForm.dueDate}
                                required
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="form-group">
                            <label>{isRTL ? 'التاريخ' : 'Date'} *</label>
                            <input
                              type="date"
                              value={employeeTaskForm.dueDate}
                              onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, dueDate: e.target.value })}
                              required
                            />
                          </div>
                        )}

                        <div className="form-group">
                          <button
                            type="button"
                            className={`all-day-btn sv2-all-day-btn ${employeeTaskForm.dueTime === '11:00' && employeeTaskForm.dueTimeEnd === '20:00' ? 'active' : ''}`}
                            onClick={() => setEmployeeTaskForm({
                              ...employeeTaskForm,
                              dueTime: '11:00',
                              dueTimeEnd: '20:00'
                            })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            {isRTL ? 'طوال اليوم (11 ص - 8 م)' : 'All Day (11 AM - 8 PM)'}
                          </button>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>{isRTL ? 'وقت البداية' : 'Start Time'}</label>
                            <input
                              type="time"
                              value={employeeTaskForm.dueTime}
                              onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, dueTime: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>{isRTL ? 'وقت النهاية' : 'End Time'}</label>
                            <input
                              type="time"
                              value={employeeTaskForm.dueTimeEnd}
                              onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, dueTimeEnd: e.target.value })}
                              min={employeeTaskForm.dueTime}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>{isRTL ? 'الأولوية' : 'Priority'}</label>
                          <select
                            value={employeeTaskForm.priority}
                            onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, priority: e.target.value })}
                          >
                            <option value="low">{isRTL ? 'منخفضة' : 'Low'}</option>
                            <option value="medium">{isRTL ? 'متوسطة' : 'Medium'}</option>
                            <option value="high">{isRTL ? 'عالية' : 'High'}</option>
                          </select>
                        </div>

                        <div className="form-group checkbox-group">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={employeeTaskForm.blocksCalendar}
                              onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, blocksCalendar: e.target.checked })}
                            />
                            <span>{isRTL ? 'يحجز الموعد (يمنع العملاء من الحجز)' : 'Blocks Calendar (prevents customer bookings)'}</span>
                          </label>
                        </div>

                        {employeeTaskForm.blocksCalendar && (!employeeTaskForm.dueTime || !employeeTaskForm.dueTimeEnd) && (
                          <p className="warning-hint sv2-warn-hint">
                            {isRTL ? 'يجب تحديد وقت البداية والنهاية لحجز الموعد' : 'Start and end time required to block calendar'}
                          </p>
                        )}

                        <button
                          type="submit"
                          className="submit-task-btn sv2-submit-btn"
                          disabled={isSubmittingTask}
                        >
                          {isSubmittingTask
                            ? (isRTL ? 'جاري الإضافة...' : 'Adding...')
                            : (isRTL ? '▸ إضافة المهمة' : '▸ Deploy Task')}
                        </button>
                      </form>
                      </div>
                    </motion.div>

                    {/* ─── Selected Day Panel ─── */}
                    <AnimatePresence>
                      {selectedCalendarDay && (
                        <motion.div
                          key="sv2-selday"
                          className="sv2-panel"
                          initial={{ opacity: 0, y: -6, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: 'auto' }}
                          exit={{ opacity: 0, y: -6, height: 0 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                        >
                          <div className="sv2-selday-head">
                            <div className="sv2-selday-title">
                              <span className="kicker">{isRTL ? 'اليوم المحدد' : 'Selected Day'}</span>
                              <h3>
                                {format(selectedCalendarDay, isRTL ? 'dd MMMM yyyy' : 'MMM dd, yyyy', { locale: isRTL ? ar : enUS })}
                              </h3>
                            </div>
                            <button
                              className="sv2-selday-close"
                              onClick={() => setSelectedCalendarDay(null)}
                              title={isRTL ? 'إغلاق' : 'Close'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                          <div className="sv2-panel-body">
                            <div className="sv2-feed-list">
                              {getEventsForDay(selectedCalendarDay).length === 0 ? (
                                <div className="sv2-empty">
                                  {isRTL ? '— لا توجد أحداث لهذا اليوم —' : '— No events for this day —'}
                                </div>
                              ) : getEventsForDay(selectedCalendarDay).map((apt, i) => {
                                const accentColor = apt.type === 'task'
                                  ? (apt.employeeId ? getEmployeeColor(employees, apt.employeeId) : PRIORITY_COLORS[apt.priority] || '#f59e0b')
                                  : SECTION_COLORS[apt.section] || '#EE2329';
                                return (
                                  <motion.div
                                    key={apt.id}
                                    className="sv2-feed-item detailed"
                                    initial={{ opacity: 0, x: isRTL ? -10 : 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                  >
                                    <div className="sv2-feed-accent" style={{ background: accentColor }} />
                                    <div className="sv2-feed-body">
                                      <div className="sv2-feed-head">
                                        <span className="sv2-feed-title">
                                          {apt.type === 'task' && (
                                            <span className={`sv2-feed-tasktag ${apt.priority || 'medium'}`}>
                                              {isRTL ? 'مهمة' : 'TASK'}
                                            </span>
                                          )}
                                          {apt.title}
                                        </span>
                                        <span className="sv2-feed-time">
                                          {formatTimeAMPM(apt.startTime)}{apt.endTime && ` — ${formatTimeAMPM(apt.endTime)}`}
                                          {apt.duration && ` (${apt.duration}${isRTL ? 'د' : 'm'})`}
                                        </span>
                                      </div>
                                      <div className="sv2-feed-meta">
                                        {apt.section && (
                                          <span className="sv2-chip" style={{ background: SECTION_COLORS[apt.section] || '#6366f1' }}>
                                            {sectionLabels[apt.section] || apt.section}
                                          </span>
                                        )}
                                        {apt.type === 'task' && apt.assignee && (
                                          <span className="sv2-feed-detail-row">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                              <circle cx="12" cy="7" r="4"/>
                                            </svg>
                                            {apt.assignee}
                                          </span>
                                        )}
                                        {apt.phone && (
                                          <span className="sv2-feed-detail-row" dir="ltr">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                            </svg>
                                            {apt.phone}
                                          </span>
                                        )}
                                        {apt.type === 'task' && (
                                          <select
                                            className="sv2-status-select"
                                            value={apt.status || 'pending'}
                                            onChange={(e) => handleUpdateTaskStatus(apt.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              background: apt.status === 'completed' ? 'rgba(34, 197, 94, 0.15)' :
                                                         apt.status === 'in_progress' ? 'rgba(59, 130, 246, 0.15)' :
                                                         apt.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' :
                                                         'rgba(107, 114, 128, 0.15)',
                                              color: apt.status === 'completed' ? '#16a34a' :
                                                     apt.status === 'in_progress' ? '#2563eb' :
                                                     apt.status === 'pending' ? '#d97706' : '#6b7280'
                                            }}
                                          >
                                            <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                                            <option value="in_progress">{isRTL ? 'قيد التنفيذ' : 'In Progress'}</option>
                                            <option value="completed">{isRTL ? 'مكتمل' : 'Completed'}</option>
                                            <option value="cancelled">{isRTL ? 'ملغى' : 'Cancelled'}</option>
                                          </select>
                                        )}
                                      </div>
                                      {apt.type === 'task' && apt.description && (
                                        <div className="sv2-feed-detail-row">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="17" y1="10" x2="3" y2="10"/>
                                            <line x1="21" y1="6" x2="3" y2="6"/>
                                            <line x1="21" y1="14" x2="3" y2="14"/>
                                            <line x1="17" y1="18" x2="3" y2="18"/>
                                          </svg>
                                          <span>{apt.description}</span>
                                        </div>
                                      )}
                                      {apt.services && apt.services.length > 0 && (
                                        <div className="sv2-feed-detail-row">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                                          </svg>
                                          <span>{translateServices(apt.services)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ─── Intel Feed (Upcoming Appointments) ─── */}
                    <motion.div
                      className="sv2-panel"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="sv2-panel-head">
                        <div className="sv2-panel-title">
                          <span className="sv2-panel-tag">[04]</span>
                          <h3>
                            {scheduleFilter === 'all'
                              ? (isRTL ? 'المواعيد القادمة' : 'Intel Feed')
                              : (isRTL ? 'المواعيد المفلترة' : 'Filtered Feed')}
                          </h3>
                        </div>
                        <span className="sv2-panel-tag" style={{ color: 'var(--text-secondary)' }}>
                          {getFilteredSchedule().length} {isRTL ? 'سجل' : 'ITEMS'}
                        </span>
                      </div>
                      <div className="sv2-panel-body">
                        <div className="sv2-feed-list">
                          <AnimatePresence mode="popLayout">
                            {getFilteredSchedule().length === 0 ? (
                              <motion.div
                                key="empty"
                                className="sv2-empty"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              >
                                {isRTL ? '— لا توجد مواعيد —' : '— No upcoming appointments —'}
                              </motion.div>
                            ) : getFilteredSchedule().slice(0, 8).map((apt, i) => (
                              <motion.div
                                key={apt.id}
                                layout
                                initial={{ opacity: 0, x: isRTL ? -8 : 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8, transition: { duration: 0.15 } }}
                                transition={{ delay: i * 0.03, type: 'spring', stiffness: 280, damping: 24 }}
                                className="sv2-feed-item"
                              >
                                <div className="sv2-feed-accent" style={{ background: SECTION_COLORS[apt.section] || '#EE2329' }} />
                                <div className="sv2-feed-body">
                                  <div className="sv2-feed-head">
                                    <span className="sv2-feed-title">{apt.title}</span>
                                    {apt.startTime && (
                                      <span className="sv2-feed-time">◷ {formatTimeAMPM(apt.startTime)}</span>
                                    )}
                                  </div>
                                  <div className="sv2-feed-meta">
                                    {apt.date && (
                                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                                        {formatDate(apt.date)}
                                      </span>
                                    )}
                                    {apt.section && (
                                      <span className="sv2-chip" style={{ background: SECTION_COLORS[apt.section] || '#6366f1' }}>
                                        {sectionLabels[apt.section] || apt.section}
                                      </span>
                                    )}
                                    {apt.services && apt.services.length > 0 && (
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                        {translateServices(apt.services.slice(0, 2))}
                                        {apt.services.length > 2 && ` +${apt.services.length - 2}`}
                                      </span>
                                    )}
                                    {apt.phone && (
                                      <span className="sv2-feed-detail-row" dir="ltr" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                        </svg>
                                        {apt.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
              );
            })()}

            {/* Borrowing Tab */}
            {activeTab === 'borrowing' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="content-header">
                  <h2>{isRTL ? 'إدارة الاستعارات' : 'Borrowing Management'}</h2>
                </div>

                {/* Borrowing Filters */}
                <div className="filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <select
                    className="filter-select"
                    value={borrowingFilters.status}
                    onChange={(e) => { setBorrowingFilters({ ...borrowingFilters, status: e.target.value }); }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                  >
                    <option value="">{isRTL ? 'جميع الحالات' : 'All Statuses'}</option>
                    <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                    <option value="approved">{isRTL ? 'مقبول' : 'Approved'}</option>
                    <option value="borrowed">{isRTL ? 'مُستعار' : 'Borrowed'}</option>
                    <option value="returned">{isRTL ? 'مُرجع' : 'Returned'}</option>
                    <option value="overdue">{isRTL ? 'متأخر' : 'Overdue'}</option>
                    <option value="rejected">{isRTL ? 'مرفوض' : 'Rejected'}</option>
                  </select>
                  <select
                    className="filter-select"
                    value={borrowingFilters.section}
                    onChange={(e) => { setBorrowingFilters({ ...borrowingFilters, section: e.target.value }); }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                  >
                    <option value="">{isRTL ? 'جميع الأقسام' : 'All Sections'}</option>
                    {Object.entries(sectionLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder={isRTL ? 'بحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                    value={borrowingFilters.search}
                    onChange={(e) => { setBorrowingFilters({ ...borrowingFilters, search: e.target.value }); }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', flex: 1, minWidth: '200px' }}
                  />
                  <button
                    className="btn-action"
                    onClick={() => fetchBorrowings()}
                    style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                  >
                    {isRTL ? 'بحث' : 'Search'}
                  </button>
                </div>

                {/* Borrowing List */}
                {loadingBorrowings ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                  </div>
                ) : selectedBorrowing ? (
                  /* Borrowing Detail View */
                  <div className="detail-view">
                    <button
                      onClick={() => setSelectedBorrowing(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: '600', marginBottom: '16px', fontSize: '14px' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
                        <path d="m15 18-6-6 6-6"/>
                      </svg>
                      {isRTL ? 'العودة للقائمة' : 'Back to List'}
                    </button>

                    <div className="card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{selectedBorrowing.borrowingId}</h3>
                          <span style={{
                            display: 'inline-block', marginTop: '6px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                            background: selectedBorrowing.status === 'pending' ? '#fef3c7' : selectedBorrowing.status === 'approved' ? '#d1fae5' : selectedBorrowing.status === 'returned' ? '#dbeafe' : selectedBorrowing.status === 'overdue' ? '#fee2e2' : selectedBorrowing.status === 'rejected' ? '#fee2e2' : '#e0e7ff',
                            color: selectedBorrowing.status === 'pending' ? '#92400e' : selectedBorrowing.status === 'approved' ? '#065f46' : selectedBorrowing.status === 'returned' ? '#1e40af' : selectedBorrowing.status === 'overdue' ? '#991b1b' : selectedBorrowing.status === 'rejected' ? '#991b1b' : '#3730a3'
                          }}>
                            {selectedBorrowing.status === 'pending' ? (isRTL ? 'قيد الانتظار' : 'Pending') :
                             selectedBorrowing.status === 'approved' ? (isRTL ? 'مقبول' : 'Approved') :
                             selectedBorrowing.status === 'borrowed' ? (isRTL ? 'مُستعار' : 'Borrowed') :
                             selectedBorrowing.status === 'returned' ? (isRTL ? 'مُرجع' : 'Returned') :
                             selectedBorrowing.status === 'overdue' ? (isRTL ? 'متأخر' : 'Overdue') :
                             selectedBorrowing.status === 'rejected' ? (isRTL ? 'مرفوض' : 'Rejected') : selectedBorrowing.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => handlePrintBorrowingDocument(selectedBorrowing)} style={{ padding: '8px 14px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            {isRTL ? 'طباعة' : 'Print'}
                          </button>
                          {selectedBorrowing.status === 'pending' && (
                            <>
                              <button onClick={() => { setBorrowingModalAction('approve'); setShowBorrowingModal(true); }} style={{ padding: '8px 14px', borderRadius: '8px', background: '#22c55e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                                {isRTL ? 'موافقة' : 'Approve'}
                              </button>
                              <button onClick={() => { setBorrowingModalAction('reject'); setShowBorrowingModal(true); }} style={{ padding: '8px 14px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                                {isRTL ? 'رفض' : 'Reject'}
                              </button>
                            </>
                          )}
                          {['approved', 'borrowed', 'overdue'].includes(selectedBorrowing.status) && (
                            <button onClick={() => { setBorrowingModalAction('return'); setShowBorrowingModal(true); }} style={{ padding: '8px 14px', borderRadius: '8px', background: '#8b5cf6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                              {isRTL ? 'تسجيل إرجاع' : 'Mark Returned'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* User Info */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>{isRTL ? 'الاسم' : 'Name'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedBorrowing.user?.firstName} {selectedBorrowing.user?.lastName}</div>
                        </div>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>{isRTL ? 'الهاتف' : 'Phone'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedBorrowing.user?.phoneNumber || 'N/A'}</div>
                        </div>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>{isRTL ? 'البريد' : 'Email'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedBorrowing.user?.email || 'N/A'}</div>
                        </div>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>{isRTL ? 'رقم الهوية' : 'National ID'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedBorrowing.user?.nationalId || 'N/A'}</div>
                        </div>
                      </div>

                      {/* Borrowing Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: '12px', color: '#1e40af' }}>{isRTL ? 'القسم' : 'Section'}</div>
                          <div style={{ fontWeight: '600', color: '#1e3a8a' }}>{sectionLabels[selectedBorrowing.section] || selectedBorrowing.section}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: '12px', color: '#1e40af' }}>{isRTL ? 'تاريخ الاستعارة' : 'Borrow Date'}</div>
                          <div style={{ fontWeight: '600', color: '#1e3a8a' }}>{selectedBorrowing.borrowDate}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                          <div style={{ fontSize: '12px', color: '#1e40af' }}>{isRTL ? 'تاريخ الإرجاع المتوقع' : 'Expected Return'}</div>
                          <div style={{ fontWeight: '600', color: '#1e3a8a' }}>{selectedBorrowing.expectedReturnDate}</div>
                        </div>
                        {selectedBorrowing.actualReturnDate && (
                          <div style={{ padding: '12px', background: '#d1fae5', borderRadius: '8px', border: '1px solid #6ee7b7' }}>
                            <div style={{ fontSize: '12px', color: '#065f46' }}>{isRTL ? 'تاريخ الإرجاع الفعلي' : 'Actual Return'}</div>
                            <div style={{ fontWeight: '600', color: '#064e3b' }}>{selectedBorrowing.actualReturnDate}</div>
                          </div>
                        )}
                      </div>

                      {/* Purpose & Description */}
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', marginBottom: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', marginBottom: '4px' }}>{isRTL ? 'الغرض' : 'Purpose'}</div>
                          <div style={{ color: 'var(--text-primary)' }}>{selectedBorrowing.purpose}</div>
                        </div>
                        <div style={{ padding: '12px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', marginBottom: '4px' }}>{isRTL ? 'وصف المكونات' : 'Component Description'}</div>
                          <div style={{ color: 'var(--text-primary)' }}>{selectedBorrowing.componentDescription}</div>
                        </div>
                      </div>

                      {/* Photos */}
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {selectedBorrowing.componentPhotoBefore && (
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', marginBottom: '6px' }}>{isRTL ? 'صورة قبل الاستعارة' : 'Before Photo'}</div>
                            <img src={selectedBorrowing.componentPhotoBefore} alt="Before" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', border: '2px solid #e2e8f0', objectFit: 'cover' }} />
                          </div>
                        )}
                        {selectedBorrowing.componentPhotoAfter && (
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', marginBottom: '6px' }}>{isRTL ? 'صورة بعد الإرجاع' : 'After Photo'}</div>
                            <img src={selectedBorrowing.componentPhotoAfter} alt="After" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', border: '2px solid #e2e8f0', objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>

                      {/* Admin Notes */}
                      {selectedBorrowing.adminNotes && (
                        <div style={{ marginTop: '16px', padding: '12px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                          <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>{isRTL ? 'ملاحظات الإدارة' : 'Admin Notes'}</div>
                          <div style={{ color: '#78350f' }}>{selectedBorrowing.adminNotes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Borrowing Table */
                  <div className="data-table-container" style={{ overflowX: 'auto' }}>
                    {borrowings.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary, #64748b)' }}>
                        {isRTL ? 'لا توجد طلبات استعارة' : 'No borrowing requests found'}
                      </div>
                    ) : (
                      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '12px', textAlign: isRTL ? 'right' : 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary, #64748b)', fontSize: '12px', fontWeight: '600' }}>{isRTL ? 'الرقم' : 'ID'}</th>
                            <th style={{ padding: '12px', textAlign: isRTL ? 'right' : 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary, #64748b)', fontSize: '12px', fontWeight: '600' }}>{isRTL ? 'المستعير' : 'Borrower'}</th>
                            <th style={{ padding: '12px', textAlign: isRTL ? 'right' : 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary, #64748b)', fontSize: '12px', fontWeight: '600' }}>{isRTL ? 'القسم' : 'Section'}</th>
                            <th style={{ padding: '12px', textAlign: isRTL ? 'right' : 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary, #64748b)', fontSize: '12px', fontWeight: '600' }}>{isRTL ? 'تاريخ الإرجاع' : 'Return Date'}</th>
                            <th style={{ padding: '12px', textAlign: isRTL ? 'right' : 'left', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary, #64748b)', fontSize: '12px', fontWeight: '600' }}>{isRTL ? 'الحالة' : 'Status'}</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary, #64748b)', fontSize: '12px', fontWeight: '600' }}>{isRTL ? 'إجراءات' : 'Actions'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {borrowings.map((b) => (
                            <tr key={b.borrowingId} style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => setSelectedBorrowing(b)}>
                              <td style={{ padding: '12px', fontWeight: '600', color: '#2563eb' }}>{b.borrowingId}</td>
                              <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{b.user?.firstName} {b.user?.lastName}</td>
                              <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{sectionLabels[b.section] || b.section}</td>
                              <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{b.expectedReturnDate}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{
                                  padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                                  background: b.status === 'pending' ? '#fef3c7' : b.status === 'approved' ? '#d1fae5' : b.status === 'returned' ? '#dbeafe' : b.status === 'overdue' ? '#fee2e2' : b.status === 'rejected' ? '#fee2e2' : '#e0e7ff',
                                  color: b.status === 'pending' ? '#92400e' : b.status === 'approved' ? '#065f46' : b.status === 'returned' ? '#1e40af' : b.status === 'overdue' ? '#991b1b' : b.status === 'rejected' ? '#991b1b' : '#3730a3'
                                }}>
                                  {b.status === 'pending' ? (isRTL ? 'قيد الانتظار' : 'Pending') :
                                   b.status === 'approved' ? (isRTL ? 'مقبول' : 'Approved') :
                                   b.status === 'borrowed' ? (isRTL ? 'مُستعار' : 'Borrowed') :
                                   b.status === 'returned' ? (isRTL ? 'مُرجع' : 'Returned') :
                                   b.status === 'overdue' ? (isRTL ? 'متأخر' : 'Overdue') :
                                   b.status === 'rejected' ? (isRTL ? 'مرفوض' : 'Rejected') : b.status}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button onClick={() => setSelectedBorrowing(b)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                    {isRTL ? 'عرض' : 'View'}
                                  </button>
                                  <button onClick={() => handlePrintBorrowingDocument(b)} style={{ padding: '6px 10px', borderRadius: '6px', background: '#f0fdf4', color: '#16a34a', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                    {isRTL ? 'طباعة' : 'Print'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Pagination */}
                    {borrowingPagination.pages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                        {Array.from({ length: borrowingPagination.pages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            onClick={() => fetchBorrowings(pageNum)}
                            style={{
                              padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer',
                              background: pageNum === borrowingPagination.page ? '#2563eb' : 'var(--card-bg)',
                              color: pageNum === borrowingPagination.page ? 'white' : 'var(--text-primary)',
                              fontWeight: '600', fontSize: '13px'
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Borrowing Action Modal */}
            {showBorrowingModal && selectedBorrowing && (
              <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowBorrowingModal(false)}>
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{ background: 'var(--card-bg, white)', borderRadius: '16px', padding: '28px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                    {borrowingModalAction === 'approve' ? (isRTL ? 'الموافقة على الاستعارة' : 'Approve Borrowing') :
                     borrowingModalAction === 'reject' ? (isRTL ? 'رفض الاستعارة' : 'Reject Borrowing') :
                     (isRTL ? 'تسجيل الإرجاع' : 'Record Return')}
                  </h3>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px', color: 'var(--text-secondary, #64748b)' }}>
                      {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                    </label>
                    <textarea
                      value={borrowingAdminNotes}
                      onChange={(e) => setBorrowingAdminNotes(e.target.value)}
                      rows="3"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary, #f8fafc)', color: 'var(--text-primary)', resize: 'vertical', fontSize: '14px' }}
                      placeholder={isRTL ? 'أضف ملاحظات...' : 'Add notes...'}
                    />
                  </div>

                  {borrowingModalAction === 'return' && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px', color: 'var(--text-secondary, #64748b)' }}>
                        {isRTL ? 'صورة الإرجاع (اختياري)' : 'Return Photo (optional)'}
                      </label>
                      <input type="file" accept="image/*" onChange={handleReturnPhotoUpload} style={{ fontSize: '14px' }} />
                      {returnPhotoData && (
                        <img src={returnPhotoData} alt="Return" style={{ marginTop: '8px', maxWidth: '150px', maxHeight: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setShowBorrowingModal(false); setBorrowingAdminNotes(''); setReturnPhotoData(''); }}
                      style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '600' }}
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => {
                        if (borrowingModalAction === 'approve') handleApproveBorrowing(selectedBorrowing.borrowingId);
                        else if (borrowingModalAction === 'reject') handleRejectBorrowing(selectedBorrowing.borrowingId);
                        else if (borrowingModalAction === 'return') handleMarkReturned(selectedBorrowing.borrowingId);
                      }}
                      style={{
                        padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', color: 'white',
                        background: borrowingModalAction === 'approve' ? '#22c55e' : borrowingModalAction === 'reject' ? '#ef4444' : '#8b5cf6'
                      }}
                    >
                      {borrowingModalAction === 'approve' ? (isRTL ? 'موافقة' : 'Approve') :
                       borrowingModalAction === 'reject' ? (isRTL ? 'رفض' : 'Reject') :
                       (isRTL ? 'تسجيل الإرجاع' : 'Record Return')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Education Tab */}
            {activeTab === 'education' && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="content-header">
                  <h2>{isRTL ? 'إدارة التعليم' : 'Education Management'}</h2>
                </div>

                {/* Status summary strip — quick glance at pipeline health.
                    Counts are derived from the currently-loaded page of
                    educations (the same set the table below is showing). */}
                {!selectedEducation && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { key: 'all',       labelAr: 'الكل',        labelEn: 'All',       count: educations.length, color: '#6d28d9' },
                      { key: 'pending',   labelAr: 'قيد الانتظار', labelEn: 'Pending',   count: educations.filter(e => e.status === 'pending').length,   color: '#f59e0b' },
                      { key: 'approved',  labelAr: 'مقبول',        labelEn: 'Approved',  count: educations.filter(e => e.status === 'approved').length,  color: '#22c55e' },
                      { key: 'active',    labelAr: 'نشط',          labelEn: 'Active',    count: educations.filter(e => e.status === 'active').length,    color: '#3b82f6' },
                      { key: 'completed', labelAr: 'مكتمل',        labelEn: 'Completed', count: educations.filter(e => e.status === 'completed').length, color: '#8b5cf6' },
                      { key: 'rejected',  labelAr: 'مرفوض',        labelEn: 'Rejected',  count: educations.filter(e => e.status === 'rejected').length,  color: '#ef4444' },
                    ].map(card => (
                      <button
                        key={card.key}
                        onClick={() => setEducationFilters({ ...educationFilters, status: card.key === 'all' ? '' : card.key })}
                        style={{
                          background: `linear-gradient(135deg, ${card.color}12 0%, ${card.color}05 100%)`,
                          border: `1px solid ${card.color}33`,
                          borderRadius: '12px',
                          padding: '14px 16px',
                          cursor: 'pointer',
                          textAlign: isRTL ? 'right' : 'left',
                          fontFamily: 'inherit',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 18px ${card.color}22`; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '6px' }}>
                          {isRTL ? card.labelAr : card.labelEn}
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.count}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Education Filters */}
                <div className="filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                  <select className="filter-select" value={educationFilters.status} onChange={(e) => setEducationFilters({ ...educationFilters, status: e.target.value })}>
                    <option value="">{isRTL ? 'كل الحالات' : 'All Status'}</option>
                    <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                    <option value="approved">{isRTL ? 'مقبول' : 'Approved'}</option>
                    <option value="active">{isRTL ? 'نشط' : 'Active'}</option>
                    <option value="completed">{isRTL ? 'مكتمل' : 'Completed'}</option>
                    <option value="rejected">{isRTL ? 'مرفوض' : 'Rejected'}</option>
                  </select>
                  <select className="filter-select" value={educationFilters.section} onChange={(e) => setEducationFilters({ ...educationFilters, section: e.target.value })}>
                    <option value="">{isRTL ? 'كل الأقسام' : 'All Sections'}</option>
                    {['Electronics and Programming', 'CNC Laser', 'CNC Wood', 'CNC Metal', '3D', 'Robotic and AI', "Kid's Club", 'Vinyl Cutting', 'UV Printing and Sticker Making', 'Other'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input className="filter-input" placeholder={isRTL ? 'بحث...' : 'Search...'} value={educationFilters.search} onChange={(e) => setEducationFilters({ ...educationFilters, search: e.target.value })} style={{ flex: 1, minWidth: '150px' }} />
                  <button className="btn btn-primary" onClick={() => fetchEducations()} style={{ background: 'linear-gradient(135deg, #6d28d9, #7c3aed)' }}>
                    {isRTL ? 'بحث' : 'Search'}
                  </button>
                </div>

                {loadingEducations ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                  </div>
                ) : selectedEducation ? (
                  /* Education Detail View */
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <button onClick={() => { setSelectedEducation(null); setEducationRatings([]); }} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                      {isRTL ? 'العودة للقائمة' : 'Back to list'}
                    </button>

                    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{selectedEducation.educationId}</h3>
                          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: `${getEducationStatusColor(selectedEducation.status)}22`, color: getEducationStatusColor(selectedEducation.status) }}>
                            {getEducationStatusLabel(selectedEducation.status)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {selectedEducation.status === 'pending' && (
                            <>
                              <button onClick={() => { setEducationModalAction('approve'); setShowEducationModal(true); }} style={{ padding: '8px 16px', borderRadius: '8px', background: '#22c55e', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{isRTL ? 'قبول' : 'Approve'}</button>
                              <button onClick={() => { setEducationModalAction('reject'); setShowEducationModal(true); }} style={{ padding: '8px 16px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{isRTL ? 'رفض' : 'Reject'}</button>
                            </>
                          )}
                          {selectedEducation.status === 'approved' && (
                            <button onClick={() => handleEducationStatusUpdate(selectedEducation.educationId, 'active')} style={{ padding: '8px 16px', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{isRTL ? 'تنشيط' : 'Activate'}</button>
                          )}
                          {['approved', 'active'].includes(selectedEducation.status) && (
                            <>
                              <button onClick={() => handleEducationStatusUpdate(selectedEducation.educationId, 'completed')} style={{ padding: '8px 16px', borderRadius: '8px', background: '#6d28d9', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{isRTL ? 'إكمال' : 'Complete'}</button>
                              <button onClick={() => setShowRatingModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{isRTL ? 'إضافة تقييم' : 'Add Rating'}</button>
                            </>
                          )}
                          <button onClick={() => handleDeleteEducation(selectedEducation.educationId)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                            {isRTL ? 'حذف' : 'Delete'}
                          </button>
                          <button onClick={() => handlePrintEducationDocument(selectedEducation)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#5b21b6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            {isRTL ? 'طباعة' : 'Print'}
                          </button>
                          {selectedEducation.user?.email && (
                            <button onClick={() => setShowEducationEmailModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#0ea5e9', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                              {isRTL ? 'إرسال بريد' : 'Send Email'}
                            </button>
                          )}
                          <button onClick={() => fetchAttendanceSheet(selectedEducation.educationId)} disabled={loadingAttendanceSheet} style={{ padding: '8px 16px', borderRadius: '8px', background: '#059669', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            {loadingAttendanceSheet ? '...' : (isRTL ? 'سجل الحضور' : 'Attendance')}
                          </button>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{isRTL ? 'المعلم' : 'Teacher'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedEducation.user?.firstName} {selectedEducation.user?.lastName}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{isRTL ? 'الهاتف' : 'Phone'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedEducation.user?.phoneNumber || 'N/A'}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{isRTL ? 'البريد' : 'Email'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedEducation.user?.email || 'N/A'}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#f5f3ff', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{isRTL ? 'القسم' : 'Section'}</div>
                          <div style={{ fontWeight: '600', color: '#6d28d9' }}>{selectedEducation.section}{selectedEducation.otherSectionDescription ? ` - ${selectedEducation.otherSectionDescription}` : ''}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#f5f3ff', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{isRTL ? 'عدد الطلاب' : 'Students'}</div>
                          <div style={{ fontWeight: '600', color: '#6d28d9' }}>{selectedEducation.numberOfStudents}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{isRTL ? 'فترة التعليم' : 'Period'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{selectedEducation.periodStartDate} → {selectedEducation.periodEndDate}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{isRTL ? 'الوقت اليومي' : 'Daily Time'}</div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatTimeAMPM(selectedEducation.periodStartTime)} - {formatTimeAMPM(selectedEducation.periodEndTime)}</div>
                        </div>
                      </div>

                      {/* Room Photos */}
                      {(selectedEducation.roomPhotosBefore?.length > 0 || selectedEducation.roomPhotoBefore) && (
                        <div style={{ marginBottom: '20px' }}>
                          <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{isRTL ? 'صور القاعة (قبل)' : 'Room Photos (Before)'}</h4>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(selectedEducation.roomPhotosBefore?.length > 0 ? selectedEducation.roomPhotosBefore : [selectedEducation.roomPhotoBefore]).map((photo, idx) => (
                              <img key={idx} src={photo} alt={`Room ${idx + 1}`} style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', border: '2px solid #e2e8f0', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(photo, '_blank')} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Admin Notes */}
                      {selectedEducation.adminNotes && (
                        <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fde68a' }}>
                          <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>{isRTL ? 'ملاحظات الإدارة' : 'Admin Notes'}</div>
                          <div style={{ color: '#78350f' }}>{selectedEducation.adminNotes}</div>
                        </div>
                      )}

                      {/* Students Section */}
                      <div style={{ marginTop: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                          <h4 style={{ color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isRTL ? 'الطلاب' : 'Students'}
                            <span style={{ background: '#6d28d9', color: 'white', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>{educationStudents.length}</span>
                          </h4>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {educationStudents.length > 0 && (
                              <button onClick={() => handlePrintAllStudentsList(educationStudents, selectedEducation)} style={{ padding: '6px 14px', borderRadius: '8px', background: '#5b21b6', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                {isRTL ? 'طباعة الكل' : 'Print All'}
                              </button>
                            )}
                            <button onClick={() => setShowAddStudentModal(true)} style={{ padding: '6px 14px', borderRadius: '8px', background: '#6d28d9', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              {isRTL ? 'إضافة طالب' : 'Add Student'}
                            </button>
                          </div>
                        </div>
                        {educationStudents.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', background: '#f8fafc', borderRadius: '10px' }}>{isRTL ? 'لا يوجد طلاب مسجلين' : 'No students registered'}</div>
                        ) : (
                          <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                  <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: '600', color: '#475569' }}>{isRTL ? 'الصورة' : 'Photo'}</th>
                                  <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: '600', color: '#475569' }}>{isRTL ? 'الاسم' : 'Name'}</th>
                                  <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: '600', color: '#475569' }}>{isRTL ? 'الهوية' : 'National ID'}</th>
                                  <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: '600', color: '#475569' }}>{isRTL ? 'المدرسة' : 'School'}</th>
                                  <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: '600', color: '#475569' }}>{isRTL ? 'المرحلة' : 'Level'}</th>
                                  <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: '600', color: '#475569' }}>{isRTL ? 'الهاتف' : 'Phone'}</th>
                                  <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', fontWeight: '600', color: '#475569' }}>{isRTL ? 'ولي الأمر' : 'Parent'}</th>
                                  <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>{isRTL ? 'إجراءات' : 'Actions'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {educationStudents.map((student, idx) => (
                                  <tr key={student.studentId} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                                    <td style={{ padding: '6px 10px' }}><img src={student.personalPhoto} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /></td>
                                    <td style={{ padding: '6px 10px', fontWeight: '600' }}>{student.fullName}</td>
                                    <td style={{ padding: '6px 10px' }}>{student.nationalId}</td>
                                    <td style={{ padding: '6px 10px' }}>{student.schoolName}</td>
                                    <td style={{ padding: '6px 10px' }}>{student.educationLevel}</td>
                                    <td style={{ padding: '6px 10px' }}>{student.phoneNumber}</td>
                                    <td style={{ padding: '6px 10px' }}>{student.parentPhoneNumber}</td>
                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <button onClick={() => handlePrintStudentProfile(student, selectedEducation)} title={isRTL ? 'طباعة ملف' : 'Print Profile'} style={{ padding: '4px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        </button>
                                        <button onClick={() => handlePrintStudentIdCard(student, selectedEducation)} title={isRTL ? 'طباعة بطاقة' : 'Print ID Card'} style={{ padding: '4px 6px', borderRadius: '4px', background: '#d1fae5', color: '#047857', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                                        </button>
                                        <button onClick={() => handleRemoveStudent(student.studentId)} title={isRTL ? 'إزالة' : 'Remove'} style={{ padding: '4px 6px', borderRadius: '4px', background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: '11px' }}>
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Add Student Modal */}
                      {showAddStudentModal && (
                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAddStudentModal(false)}>
                          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>{isRTL ? 'إضافة طالب جديد' : 'Add New Student'}</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div><label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>{isRTL ? 'الاسم الكامل' : 'Full Name'} *</label><input type="text" value={newStudentForm.fullName} onChange={e => setNewStudentForm(p => ({...p, fullName: e.target.value}))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }} /></div>
                              <div><label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>{isRTL ? 'رقم الهوية' : 'National ID'} *</label><input type="text" value={newStudentForm.nationalId} onChange={e => setNewStudentForm(p => ({...p, nationalId: e.target.value}))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }} /></div>
                              <div><label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>{isRTL ? 'رقم الهاتف' : 'Phone'} *</label><input type="text" value={newStudentForm.phoneNumber} onChange={e => setNewStudentForm(p => ({...p, phoneNumber: e.target.value}))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }} /></div>
                              <div><label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label><input type="email" value={newStudentForm.email} onChange={e => setNewStudentForm(p => ({...p, email: e.target.value}))} placeholder="student@example.com" style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }} /></div>
                              <div><label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>{isRTL ? 'اسم المدرسة' : 'School Name'} *</label><input type="text" value={newStudentForm.schoolName} onChange={e => setNewStudentForm(p => ({...p, schoolName: e.target.value}))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }} /></div>
                              <div><label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>{isRTL ? 'المرحلة التعليمية' : 'Education Level'} *</label><select value={newStudentForm.educationLevel} onChange={e => setNewStudentForm(p => ({...p, educationLevel: e.target.value}))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }}><option value="">--</option><option value="ابتدائي">ابتدائي</option><option value="متوسط">متوسط</option><option value="ثانوي">ثانوي</option><option value="جامعي">جامعي</option><option value="أخرى">أخرى</option></select></div>
                              <div><label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>{isRTL ? 'رقم ولي الأمر' : 'Parent Phone'} *</label><input type="text" value={newStudentForm.parentPhoneNumber} onChange={e => setNewStudentForm(p => ({...p, parentPhoneNumber: e.target.value}))} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', boxSizing: 'border-box' }} /></div>
                            </div>
                            <div style={{ marginTop: '12px' }}>
                              <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' }}>{isRTL ? 'الصورة الشخصية' : 'Personal Photo'} *</label>
                              <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '16px', textAlign: 'center', position: 'relative', cursor: 'pointer' }}>
                                {newStudentForm.personalPhoto ? <img src={newStudentForm.personalPhoto} alt="Preview" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ color: '#94a3b8', fontSize: '13px' }}>{isRTL ? 'اضغط لرفع الصورة' : 'Click to upload'}</span>}
                                <input type="file" accept="image/*" onChange={handleStudentPhotoUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                              <button onClick={() => setShowAddStudentModal(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                              <button onClick={handleAddStudent} style={{ padding: '8px 20px', borderRadius: '8px', background: '#6d28d9', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>{isRTL ? 'إضافة' : 'Add'}</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Ratings Timeline */}
                      <div style={{ marginTop: '24px' }}>
                        <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isRTL ? 'التقييمات اليومية' : 'Daily Ratings'}
                          {educationRatings.length > 0 && (
                            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '400' }}>
                              ({isRTL ? 'المتوسط' : 'Average'}: {(educationRatings.reduce((sum, r) => sum + r.cleanlinessScore, 0) / educationRatings.length).toFixed(1)}/5)
                            </span>
                          )}
                        </h4>
                        {educationRatings.length === 0 ? (
                          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>{isRTL ? 'لا توجد تقييمات بعد' : 'No ratings yet'}</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {educationRatings.map((rating) => (
                              <div key={rating.ratingId} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontWeight: '700', color: '#334155' }}>{rating.ratingDate}</span>
                                    <span style={{ color: '#f59e0b' }}>{'★'.repeat(rating.cleanlinessScore)}{'☆'.repeat(5 - rating.cleanlinessScore)}</span>
                                    <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: `${getDamageLevelColor(rating.damageLevel)}22`, color: getDamageLevelColor(rating.damageLevel) }}>
                                      {getDamageLevelLabel(rating.damageLevel)}
                                    </span>
                                  </div>
                                  <button onClick={() => handleDeleteEducationRating(selectedEducation.educationId, rating.ratingId)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                  </button>
                                </div>
                                {rating.damageDescription && <p style={{ margin: '4px 0', color: '#64748b', fontSize: '13px' }}>{rating.damageDescription}</p>}
                                {rating.comments && <p style={{ margin: '4px 0', color: '#475569', fontSize: '13px' }}>{rating.comments}</p>}
                                {rating.roomPhoto && <img src={rating.roomPhoto} alt="Rating" style={{ maxWidth: '150px', maxHeight: '100px', borderRadius: '6px', marginTop: '8px', objectFit: 'cover' }} />}
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{isRTL ? 'بواسطة' : 'By'}: {rating.ratedBy?.fullName || 'N/A'}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* Education List */
                  <div>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{isRTL ? 'الرقم' : 'ID'}</th>
                            <th>{isRTL ? 'المعلم' : 'Teacher'}</th>
                            <th>{isRTL ? 'القسم' : 'Section'}</th>
                            <th>{isRTL ? 'الطلاب' : 'Students'}</th>
                            <th>{isRTL ? 'الفترة' : 'Period'}</th>
                            <th>{isRTL ? 'الحالة' : 'Status'}</th>
                            <th>{isRTL ? 'الإجراء' : 'Action'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {educations.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>{isRTL ? 'لا توجد طلبات تعليم' : 'No education requests'}</td></tr>
                          ) : educations.map((edu) => (
                            <tr key={edu.educationId}>
                              <td style={{ fontWeight: '600' }}>{edu.educationId}</td>
                              <td>{edu.user?.firstName} {edu.user?.lastName}</td>
                              <td>{edu.section}</td>
                              <td style={{ textAlign: 'center' }}>{edu.numberOfStudents}</td>
                              <td style={{ fontSize: '12px' }}>{edu.periodStartDate}<br/>{edu.periodEndDate}</td>
                              <td>
                                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: `${getEducationStatusColor(edu.status)}22`, color: getEducationStatusColor(edu.status) }}>
                                  {getEducationStatusLabel(edu.status)}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  <button onClick={() => fetchEducationDetail(edu.educationId)} style={{ padding: '6px 12px', borderRadius: '6px', background: '#6d28d9', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                    {isRTL ? 'عرض' : 'View'}
                                  </button>
                                  <button onClick={() => handleDeleteEducation(edu.educationId)} title={isRTL ? 'حذف' : 'Delete'} style={{ padding: '6px 10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', cursor: 'pointer', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                                    {isRTL ? 'حذف' : 'Delete'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {educationPagination.pages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '16px' }}>
                        {Array.from({ length: educationPagination.pages }, (_, i) => i + 1).map(pageNum => (
                          <button key={pageNum} onClick={() => fetchEducations(pageNum)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: pageNum === educationPagination.page ? '#6d28d9' : 'var(--card-bg)', color: pageNum === educationPagination.page ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}>{pageNum}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Education Status Modal */}
                {showEducationModal && selectedEducation && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '90%' }}>
                      <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>
                        {educationModalAction === 'approve' ? (isRTL ? 'قبول الطلب' : 'Approve Request') : (isRTL ? 'رفض الطلب' : 'Reject Request')}
                      </h3>
                      <textarea
                        placeholder={isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                        value={educationAdminNotes}
                        onChange={(e) => setEducationAdminNotes(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '80px', resize: 'vertical', marginBottom: '16px', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowEducationModal(false); setEducationAdminNotes(''); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'var(--card-bg)', cursor: 'pointer', color: 'var(--text-primary)' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                        <button onClick={() => handleEducationStatusUpdate(selectedEducation.educationId, educationModalAction === 'approve' ? 'approved' : 'rejected')} style={{ padding: '8px 16px', borderRadius: '8px', background: educationModalAction === 'approve' ? '#22c55e' : '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                          {educationModalAction === 'approve' ? (isRTL ? 'قبول' : 'Approve') : (isRTL ? 'رفض' : 'Reject')}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* Rating Modal */}
                {showRatingModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
                      <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>{isRTL ? 'إضافة تقييم يومي' : 'Add Daily Rating'}</h3>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{isRTL ? 'التاريخ' : 'Date'}</label>
                        <input type="date" value={ratingForm.ratingDate} onChange={(e) => setRatingForm({ ...ratingForm, ratingDate: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{isRTL ? 'النظافة' : 'Cleanliness'} ({ratingForm.cleanlinessScore}/5)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[1, 2, 3, 4, 5].map(score => (
                            <button key={score} onClick={() => setRatingForm({ ...ratingForm, cleanlinessScore: score })} style={{ fontSize: '28px', background: 'none', border: 'none', cursor: 'pointer', color: score <= ratingForm.cleanlinessScore ? '#f59e0b' : '#e2e8f0' }}>★</button>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{isRTL ? 'مستوى الضرر' : 'Damage Level'}</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {['none', 'minor', 'moderate', 'severe'].map(level => (
                            <button key={level} onClick={() => setRatingForm({ ...ratingForm, damageLevel: level })} style={{ padding: '8px 16px', borderRadius: '8px', border: `2px solid ${ratingForm.damageLevel === level ? getDamageLevelColor(level) : '#e2e8f0'}`, background: ratingForm.damageLevel === level ? `${getDamageLevelColor(level)}22` : 'white', color: getDamageLevelColor(level), cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                              {getDamageLevelLabel(level)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {ratingForm.damageLevel !== 'none' && (
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{isRTL ? 'وصف الضرر *' : 'Damage Description *'}</label>
                          <textarea value={ratingForm.damageDescription} onChange={(e) => setRatingForm({ ...ratingForm, damageDescription: e.target.value })} placeholder={isRTL ? 'صف الضرر' : 'Describe the damage'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }} />
                        </div>
                      )}

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{isRTL ? 'صورة (اختياري)' : 'Photo (optional)'}</label>
                        <input type="file" accept="image/*" onChange={handleRatingPhotoUpload} style={{ fontSize: '13px' }} />
                        {ratingForm.roomPhoto && <img src={ratingForm.roomPhoto} alt="Rating" style={{ maxWidth: '150px', maxHeight: '100px', borderRadius: '6px', marginTop: '8px', objectFit: 'cover' }} />}
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{isRTL ? 'تعليقات (اختياري)' : 'Comments (optional)'}</label>
                        <textarea value={ratingForm.comments} onChange={(e) => setRatingForm({ ...ratingForm, comments: e.target.value })} placeholder={isRTL ? 'تعليقات إضافية' : 'Additional comments'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }} />
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setShowRatingModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'var(--card-bg)', cursor: 'pointer', color: 'var(--text-primary)' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                        <button onClick={handleAddEducationRating} style={{ padding: '8px 16px', borderRadius: '8px', background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600' }}>{isRTL ? 'إضافة التقييم' : 'Add Rating'}</button>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* Custom Email Modal */}
                {showEducationEmailModal && selectedEducation && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '90%' }}>
                      <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        {isRTL ? 'إرسال بريد إلكتروني للمعلم' : 'Send Email to Teacher'}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                        {isRTL ? `إلى: ${selectedEducation.user?.email}` : `To: ${selectedEducation.user?.email}`}
                      </p>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{isRTL ? 'الموضوع (اختياري)' : 'Subject (optional)'}</label>
                        <input type="text" value={educationEmailForm.subject} onChange={(e) => setEducationEmailForm({ ...educationEmailForm, subject: e.target.value })} placeholder={isRTL ? 'موضوع البريد' : 'Email subject'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit' }} />
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{isRTL ? 'الرسالة *' : 'Message *'}</label>
                        <textarea value={educationEmailForm.message} onChange={(e) => setEducationEmailForm({ ...educationEmailForm, message: e.target.value })} placeholder={isRTL ? 'اكتب رسالتك هنا...' : 'Write your message here...'} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '120px', resize: 'vertical', fontFamily: 'inherit' }} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowEducationEmailModal(false); setEducationEmailForm({ subject: '', message: '' }); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'var(--card-bg)', cursor: 'pointer', color: 'var(--text-primary)' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                        <button onClick={handleSendEducationEmail} disabled={sendingEducationEmail} style={{ padding: '8px 16px', borderRadius: '8px', background: '#6d28d9', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', opacity: sendingEducationEmail ? 0.7 : 1 }}>
                          {sendingEducationEmail ? (isRTL ? 'جاري الإرسال...' : 'Sending...') : (isRTL ? 'إرسال' : 'Send')}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              {/* Attendance Sheet Modal */}
              {showAttendanceSheet && attendanceSheetData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '95%', maxWidth: '1200px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                        {isRTL ? 'سجل الحضور' : 'Attendance Sheet'} - {attendanceSheetData.educationId}
                      </h3>
                      <button onClick={() => { setShowAttendanceSheet(false); setAttendanceSheetData(null); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--text-primary)', padding: '4px 8px' }}>x</button>
                    </div>
                    <div style={{ padding: '20px 24px', overflow: 'auto', flex: 1 }}>
                      {attendanceSheetData.dates.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                          {isRTL ? 'لا توجد بيانات حضور بعد' : 'No attendance data yet'}
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: `${300 + attendanceSheetData.dates.length * 80}px` }}>
                            <thead>
                              <tr style={{ background: 'linear-gradient(135deg, #5b21b6, #6d28d9)', color: 'white' }}>
                                <th style={{ padding: '10px 12px', textAlign: isRTL ? 'right' : 'left', position: 'sticky', left: 0, background: '#5b21b6', zIndex: 1 }}>{isRTL ? 'الطالب' : 'Student'}</th>
                                {attendanceSheetData.dates.map(date => (
                                  <th key={date} style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '11px' }}>
                                    {new Date(date).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { month: 'short', day: 'numeric', calendar: 'gregory' })}
                                  </th>
                                ))}
                                <th style={{ padding: '10px 12px', textAlign: 'center', background: '#4c1d95' }}>{isRTL ? 'المجموع' : 'Total'}</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', background: '#4c1d95' }}>%</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendanceSheetData.sheet.map((student, idx) => (
                                <tr key={student.studentId} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'var(--card-bg)' : '#f8fafc' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: '600', position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--card-bg)' : '#f8fafc', zIndex: 1 }}>
                                    <div>{student.fullName}</div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{student.studentId}</div>
                                  </td>
                                  {attendanceSheetData.dates.map(date => {
                                    const cell = student.attendance[date] || {};
                                    const st = typeof cell === 'string' ? cell : cell.status;
                                    return (
                                    <td key={date} style={{ padding: '6px', textAlign: 'center' }}>
                                      {st === 'present' ? (
                                        <div>
                                          <span style={{ display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', background: '#d1fae5', color: '#059669', lineHeight: '24px', fontWeight: '700', fontSize: '14px' }}>P</span>
                                          {cell.checkIn && <div style={{ fontSize: '9px', color: '#64748b', marginTop: 2 }}>{cell.checkIn}{cell.checkOut ? ` → ${cell.checkOut}` : ''}</div>}
                                        </div>
                                      ) : (
                                        <span style={{ display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', lineHeight: '24px', fontWeight: '700', fontSize: '14px' }}>A</span>
                                      )}
                                    </td>
                                    );
                                  })}
                                  <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '700', color: '#059669' }}>{student.totalPresent}/{student.totalDays}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '700', color: student.totalDays > 0 && (student.totalPresent / student.totalDays) >= 0.75 ? '#059669' : '#dc2626' }}>
                                    {student.totalDays > 0 ? Math.round((student.totalPresent / student.totalDays) * 100) : 0}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}

              </motion.div>
            )}

            {/* Workspaces Tab */}
            {activeTab === 'workspaces' && workspaceAuthenticated && (
            <div data-page="manager">
              <motion.div key="workspaces" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="workspaces-content">
                {/* Stats Cards */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{workspaceStats.totalWorkspaces}</span>
                      <span className="stat-label">{isRTL ? 'إجمالي المساحات' : 'Total Workspaces'}</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon active">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{workspaceStats.activeWorkspaces}</span>
                      <span className="stat-label">{isRTL ? 'نشطة' : 'Active'}</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon completed">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{workspaceStats.completedWorkspaces}</span>
                      <span className="stat-label">{isRTL ? 'مكتملة' : 'Completed'}</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon today">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
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
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
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
                          {workspace.projectName && (
                            <div className="workspace-project-name">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                              </svg>
                              <span>{workspace.projectName}</span>
                            </div>
                          )}
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
                              <span className="period-value">{workspace.startDate && format(parseISO(workspace.startDate), 'MMM d', { locale: isRTL ? ar : enUS })} {formatTimeAMPM(workspace.startTime)}</span>
                            </div>
                            <div className="period-item">
                              <span className="period-label">{isRTL ? 'إلى' : 'To'}</span>
                              <span className="period-value">{workspace.endDate && format(parseISO(workspace.endDate), 'MMM d', { locale: isRTL ? ar : enUS })} {formatTimeAMPM(workspace.endTime)}</span>
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
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                              <button className="action-btn rate" onClick={() => openWorkspaceRatingModal(workspace)} title={isRTL ? 'تقييم' : 'Rate'}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              </button>
                            </>
                          )}
                          <button className="action-btn edit" onClick={() => openWorkspaceModal(workspace)} title={isRTL ? 'تعديل' : 'Edit'}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="action-btn delete" onClick={() => handleDeleteWorkspace(workspace.workspaceId)} title={isRTL ? 'حذف' : 'Delete'}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                          <button className="action-btn complete" onClick={() => handlePrintWorkspaceIDCard(workspace)} title={isRTL ? 'طباعة البطاقة' : 'Print Card'} style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          </button>
                          <button className="action-btn complete" onClick={() => handlePrintWorkspaceBanner(workspace)} title={isRTL ? 'طباعة اللافتة' : 'Print Banner'} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
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
              </motion.div>
            </div>
            )}

            {/* Workspace Modal */}
            {showWorkspaceModal && (
              <div className="modal-overlay" data-page="manager" onClick={() => setShowWorkspaceModal(false)}>
                <motion.div
                  className="modal-content modern-modal workspace-modal"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modern-modal-header workspace-header-gradient">
                    <div className="modal-header-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div className="modal-header-text">
                      <h2>{selectedWorkspace ? (isRTL ? 'تعديل مساحة العمل' : 'Edit Workspace') : (isRTL ? 'مساحة عمل جديدة' : 'New Workspace')}</h2>
                      <p>{isRTL ? 'سجل بيانات مساحة العمل للعملاء' : 'Record workspace details for customers'}</p>
                    </div>
                    <button className="modal-close-modern" onClick={() => setShowWorkspaceModal(false)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="modern-modal-body workspace-form">
                    <div className="form-section">
                      <div className="section-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                        <span>{isRTL ? 'تفاصيل مساحة العمل' : 'Workspace Details'}</span>
                      </div>
                      <div className="form-row">
                        <div className="form-group modern-input">
                          <label>{isRTL ? 'رقم الطاولة' : 'Table Number'} <span className="required">*</span></label>
                          <input type="text" value={workspaceForm.tableNumber} onChange={(e) => setWorkspaceForm({ ...workspaceForm, tableNumber: e.target.value })} placeholder={isRTL ? 'مثال: A1, B2' : 'e.g., A1, B2'} className="modern-input-field" />
                        </div>
                        <div className="form-group modern-input">
                          <label>{isRTL ? 'عدد المستخدمين' : 'Number of Users'}</label>
                          <input type="number" min="1" value={workspaceForm.numberOfUsers} onChange={(e) => setWorkspaceForm({ ...workspaceForm, numberOfUsers: parseInt(e.target.value) || 1 })} className="modern-input-field" />
                        </div>
                      </div>
                      <div className="form-group modern-input">
                        <label>{isRTL ? 'اسم المشروع' : 'Project Name'}</label>
                        <input type="text" value={workspaceForm.projectName} onChange={(e) => setWorkspaceForm({ ...workspaceForm, projectName: e.target.value })} placeholder={isRTL ? 'اسم المشروع أو الغرض' : 'Project name or purpose'} className="modern-input-field" />
                      </div>
                    </div>
                    <div className="form-section">
                      <div className="section-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>{isRTL ? 'معلومات المسؤول' : 'Person in Charge'}</span>
                      </div>
                      <div className="form-group modern-input">
                        <label>{isRTL ? 'الاسم' : 'Name'} <span className="required">*</span></label>
                        <input type="text" value={workspaceForm.personName} onChange={(e) => setWorkspaceForm({ ...workspaceForm, personName: e.target.value })} placeholder={isRTL ? 'اسم الشخص المسؤول' : 'Full name'} className="modern-input-field" />
                      </div>
                      <div className="form-row">
                        <div className="form-group modern-input">
                          <label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</label>
                          <input type="tel" value={workspaceForm.personPhone} onChange={(e) => setWorkspaceForm({ ...workspaceForm, personPhone: e.target.value })} placeholder={isRTL ? 'رقم الهاتف' : 'Phone number'} dir="ltr" className="modern-input-field" />
                        </div>
                        <div className="form-group modern-input">
                          <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                          <input type="email" value={workspaceForm.personEmail} onChange={(e) => setWorkspaceForm({ ...workspaceForm, personEmail: e.target.value })} placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'} dir="ltr" className="modern-input-field" />
                        </div>
                      </div>
                    </div>
                    <div className="form-section">
                      <div className="section-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>{isRTL ? 'فترة الاستخدام' : 'Usage Period'}</span>
                      </div>
                      <div className="period-grid">
                        <div className="period-box start">
                          <span className="period-label">{isRTL ? 'البداية' : 'Start'}</span>
                          <div className="period-inputs">
                            <input type="date" value={workspaceForm.startDate} onChange={(e) => setWorkspaceForm({ ...workspaceForm, startDate: e.target.value })} className="modern-input-field" />
                            <input type="time" value={workspaceForm.startTime} onChange={(e) => setWorkspaceForm({ ...workspaceForm, startTime: e.target.value })} className="modern-input-field" />
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
                            <input type="date" value={workspaceForm.endDate} onChange={(e) => setWorkspaceForm({ ...workspaceForm, endDate: e.target.value })} className="modern-input-field" />
                            <input type="time" value={workspaceForm.endTime} onChange={(e) => setWorkspaceForm({ ...workspaceForm, endTime: e.target.value })} className="modern-input-field" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="form-section">
                      <div className="section-header">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        <span>{isRTL ? 'ملاحظات' : 'Notes'}</span>
                      </div>
                      <textarea value={workspaceForm.notes} onChange={(e) => setWorkspaceForm({ ...workspaceForm, notes: e.target.value })} placeholder={isRTL ? 'أضف أي ملاحظات إضافية...' : 'Add any additional notes...'} rows={3} className="modern-textarea" />
                    </div>
                  </div>
                  <div className="modern-modal-footer">
                    <button className="btn-cancel" onClick={() => setShowWorkspaceModal(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                    <button className="btn-submit workspace-submit" onClick={selectedWorkspace ? handleUpdateWorkspace : handleCreateWorkspace} disabled={workspaceLoading || !workspaceForm.tableNumber.trim() || !workspaceForm.personName.trim()}>
                      {workspaceLoading ? <><span className="spinner"></span>{isRTL ? 'جاري الحفظ...' : 'Saving...'}</> : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>{selectedWorkspace ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إضافة مساحة العمل' : 'Add Workspace')}</>}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Workspace Rating Modal */}
            {showWorkspaceRatingModal && selectedWorkspace && (
              <div className="modal-overlay" data-page="manager" onClick={() => setShowWorkspaceRatingModal(false)}>
                <motion.div
                  className="modal-content modern-modal rating-modal"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modern-modal-header rating-header-gradient">
                    <div className="modal-header-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </div>
                    <div className="modal-header-text">
                      <h2>{isRTL ? 'تقييم مساحة العمل' : 'Rate Workspace'}</h2>
                      <p>{isRTL ? 'طاولة' : 'Table'} {selectedWorkspace.tableNumber} - {selectedWorkspace.personName}</p>
                    </div>
                    <button className="modal-close-modern" onClick={() => setShowWorkspaceRatingModal(false)}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="modern-modal-body">
                    <div className="workspace-info-card">
                      <div className="info-card-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        <span>{isRTL ? 'طاولة' : 'Table'}</span>
                        <strong>{selectedWorkspace.tableNumber}</strong>
                      </div>
                      <div className="info-card-item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span>{isRTL ? 'المسؤول' : 'Person'}</span>
                        <strong>{selectedWorkspace.personName}</strong>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>{isRTL ? 'نوع التقييم' : 'Rating Type'}</label>
                      <div className="rating-type-toggle">
                        <button type="button" className={`rating-type-btn award ${workspaceRatingForm.type === 'award' ? 'active' : ''}`} onClick={() => setWorkspaceRatingForm({ ...workspaceRatingForm, type: 'award' })}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/></svg>
                          <span>{isRTL ? 'منح نقاط' : 'Award'}</span>
                        </button>
                        <button type="button" className={`rating-type-btn deduction ${workspaceRatingForm.type === 'deduct' ? 'active' : ''}`} onClick={() => setWorkspaceRatingForm({ ...workspaceRatingForm, type: 'deduct' })}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                          <span>{isRTL ? 'خصم نقاط' : 'Deduct'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>{isRTL ? 'عدد النقاط' : 'Points'}</label>
                      <div className="points-selector">
                        {[1, 2, 3, 4, 5].map(num => (
                          <button key={num} type="button" className={`point-btn ${workspaceRatingForm.points === num ? 'active' : ''} ${workspaceRatingForm.type === 'deduct' ? 'deduction' : 'award'}`} onClick={() => setWorkspaceRatingForm({ ...workspaceRatingForm, points: num })}>
                            {workspaceRatingForm.type === 'deduct' ? `-${num}` : `+${num}`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'المعيار' : 'Criteria'} <span className="required">*</span></label>
                      <select value={workspaceRatingForm.criteria} onChange={(e) => setWorkspaceRatingForm({ ...workspaceRatingForm, criteria: e.target.value })} className="modern-input-field">
                        <option value="">{isRTL ? 'اختر المعيار' : 'Select criteria'}</option>
                        {workspaceCriteriaOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                      </select>
                    </div>
                    {workspaceRatingForm.criteria === 'other' && (
                      <div className="form-group modern-input">
                        <label>{isRTL ? 'معيار مخصص' : 'Custom Criteria'}</label>
                        <input type="text" value={workspaceRatingForm.customCriteria || ''} onChange={(e) => setWorkspaceRatingForm({ ...workspaceRatingForm, customCriteria: e.target.value })} placeholder={isRTL ? 'أدخل المعيار' : 'Enter criteria'} className="modern-input-field" />
                      </div>
                    )}
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'تاريخ التقييم' : 'Rating Date'}</label>
                      <input type="date" value={workspaceRatingForm.ratingDate} onChange={(e) => setWorkspaceRatingForm({ ...workspaceRatingForm, ratingDate: e.target.value })} className="modern-input-field" />
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                      <textarea value={workspaceRatingForm.notes} onChange={(e) => setWorkspaceRatingForm({ ...workspaceRatingForm, notes: e.target.value })} placeholder={isRTL ? 'ملاحظات إضافية (اختياري)' : 'Additional notes (optional)'} rows={3} className="modern-textarea" />
                    </div>
                  </div>
                  <div className="modern-modal-footer">
                    <button className="btn-cancel" onClick={() => setShowWorkspaceRatingModal(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                    <button className={`btn-submit ${workspaceRatingForm.type === 'deduct' ? 'deduct-submit' : 'award-submit'}`} onClick={handleAddWorkspaceRating} disabled={workspaceLoading || !workspaceRatingForm.criteria}>
                      {workspaceLoading ? <><span className="spinner"></span>{isRTL ? 'جاري الحفظ...' : 'Saving...'}</> : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>{isRTL ? 'إضافة التقييم' : 'Add Rating'}</>}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Workspace Password Modal */}
            <AnimatePresence>
              {showWorkspacePasswordModal && (
                <div className="modal-overlay" onClick={() => setShowWorkspacePasswordModal(false)}>
                  <motion.div
                    className="modal-content modern-modal"
                    initial={{ opacity: 0, scale: 0.8, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 30 }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ maxWidth: '420px', width: '90%', margin: 'auto', overflow: 'hidden' }}
                  >
                    <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)', padding: '40px 30px 30px', textAlign: 'center', position: 'relative' }}>
                      <button className="modal-close-modern" onClick={() => setShowWorkspacePasswordModal(false)} style={{ position: 'absolute', top: '12px', right: '12px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', backdropFilter: 'blur(10px)' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      </div>
                      <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: '0 0 6px' }}>{isRTL ? 'مساحات العمل' : 'Workspaces'}</h2>
                      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: 0 }}>{isRTL ? 'أدخل كلمة المرور للوصول إلى هذا القسم' : 'Enter password to access this section'}</p>
                    </div>
                    <div style={{ padding: '30px' }}>
                      <div className="form-group modern-input" style={{ marginBottom: '20px' }}>
                        <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--text-primary)' }}>{isRTL ? 'كلمة المرور' : 'Password'}</label>
                        <input
                          type="password"
                          value={workspacePasswordInput}
                          onChange={(e) => setWorkspacePasswordInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleWorkspacePasswordSubmit()}
                          placeholder={isRTL ? 'أدخل كلمة المرور' : 'Enter password'}
                          className="modern-input-field"
                          autoFocus
                          style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '10px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setShowWorkspacePasswordModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                          {isRTL ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button onClick={handleWorkspacePasswordSubmit} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          {isRTL ? 'دخول' : 'Access'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Workshops Tab */}
            {activeTab === 'workshops' && (() => {
              const _activeCount = workshopsList.filter(w => w.isActive && w.status !== 'cancelled' && w.status !== 'completed').length;
              const _completedCount = workshopsList.filter(w => w.status === 'completed').length;
              const _totalStudents = workshopsList.reduce((sum, w) => sum + (w.studentCount || 0), 0);
              const _wsStatusLabels = {
                upcoming: isRTL ? 'قادمة' : 'Upcoming',
                in_progress: isRTL ? 'جارية' : 'In Progress',
                completed: isRTL ? 'مكتملة' : 'Completed',
                cancelled: isRTL ? 'ملغاة' : 'Cancelled'
              };
              return (
              <motion.div
                key="workshops"
                className="volunteers-section wsv2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {!viewingWorkshopStudents ? (
                  <>
                    {/* ═══ COMMAND BAR ═══ */}
                    <motion.div
                      className="wsv2-command"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="wsv2-command-left">
                        <div className="wsv2-command-title">
                          <span className="wsv2-kicker">{isRTL ? 'وحدة الورش · OPS' : 'WORKSHOP OPS · TERMINAL'}</span>
                          <h2>{isRTL ? 'إدارة الورش التدريبية' : 'Training Workshop Operations'}</h2>
                        </div>
                      </div>
                      <div className="wsv2-metrics">
                        <motion.div className="wsv2-metric active"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 22 }}>
                          <span className="wsv2-metric-value">{_activeCount}</span>
                          <span className="wsv2-metric-label">{isRTL ? 'نشطة' : 'Active'}</span>
                        </motion.div>
                        <motion.div className="wsv2-metric completed"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.18, type: 'spring', stiffness: 300, damping: 22 }}>
                          <span className="wsv2-metric-value">{_completedCount}</span>
                          <span className="wsv2-metric-label">{isRTL ? 'مكتملة' : 'Completed'}</span>
                        </motion.div>
                        <motion.div className="wsv2-metric students"
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.24, type: 'spring', stiffness: 300, damping: 22 }}>
                          <span className="wsv2-metric-value">{_totalStudents}</span>
                          <span className="wsv2-metric-label">{isRTL ? 'طالب' : 'Students'}</span>
                        </motion.div>
                      </div>
                    </motion.div>

                    {/* ═══ TOOLBAR ═══ */}
                    <motion.div
                      className="wsv2-toolbar"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                    >
                      <div className="wsv2-filters">
                        {[
                          { key: 'active',    label: isRTL ? 'النشطة' : 'Active',    count: _activeCount,          color: '#22d3ee' },
                          { key: 'completed', label: isRTL ? 'المكتملة' : 'Completed', count: _completedCount,       color: '#4ade80' },
                          { key: 'all',       label: isRTL ? 'الكل' : 'All',         count: workshopsList.length,  color: '#94a3b8' }
                        ].map(f => (
                          <button
                            key={f.key}
                            className={`wsv2-filter-btn ${workshopFilter === f.key ? 'active' : ''}`}
                            onClick={() => setWorkshopFilter(f.key)}
                          >
                            <span className="wsv2-filter-dot" style={{ background: f.color, color: f.color }} />
                            {f.label}
                            <span className="count">{f.count}</span>
                          </button>
                        ))}
                      </div>
                      <div className="wsv2-actions">
                        <button className="wsv2-action-btn scan" onClick={() => setShowQRScanner(true)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                          </svg>
                          {isRTL ? 'مسح QR' : 'Scan QR'}
                        </button>
                        <button
                          className="wsv2-action-btn primary"
                          onClick={() => {
                            setSelectedWorkshop(null);
                            setWorkshopForm({ title: '', description: '', presenter: '', assignedEmployeeId: '', startDate: '', endDate: '', startTime: '', endTime: '', totalHours: '', content: '', objectives: '', photo: '', maxParticipants: '', price: '', notes: '', color: '#1a56db', minAge: '', maxAge: '', isPublic: true });
                            setShowWorkshopModal(true);
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                          {isRTL ? 'ورشة جديدة' : 'New Workshop'}
                        </button>
                      </div>
                    </motion.div>

                    <motion.div
                      className="wsv2-grid"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.2 } }
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        {workshopsList.filter(w => workshopFilter === 'all' ? true : workshopFilter === 'active' ? (w.isActive && w.status !== 'cancelled' && w.status !== 'completed') : w.status === 'completed').length === 0 ? (
                          <motion.div key="wsempty" className="wsv2-empty"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {isRTL ? '— لا توجد ورش —' : '— No workshops in this queue —'}
                          </motion.div>
                        ) : workshopsList.filter(w => workshopFilter === 'all' ? true : workshopFilter === 'active' ? (w.isActive && w.status !== 'cancelled' && w.status !== 'completed') : w.status === 'completed').map(w => {
                          const wsColor = /^#[0-9a-fA-F]{6}$/.test(w.color || '') ? w.color : '#EE2329';
                          let days = 1;
                          if (w.startDate && w.endDate && w.endDate !== w.startDate) {
                            days = Math.max(1, Math.ceil((new Date(w.endDate) - new Date(w.startDate)) / (1000 * 60 * 60 * 24)) + 1);
                          }
                          const perDay = (w.totalHours && days > 1) ? (w.totalHours / days).toFixed(1) : null;
                          const progressPct = w.maxParticipants ? Math.min(100, ((w.studentCount || 0) / w.maxParticipants) * 100) : 0;
                          return (
                          <motion.div
                            key={w.workshopId}
                            layout
                            className="wsv2-card"
                            style={{ '--wsc': wsColor }}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                            whileHover={{ y: -3 }}
                          >
                            <div className="wsv2-card-accent" />
                            {w.photo && <div className="wsv2-card-photo" style={{ backgroundImage: `url(${w.photo})` }} />}
                            <div className="wsv2-card-body">
                              <div className="wsv2-card-head">
                                <h4 className="wsv2-card-title">
                                  <span className="wsv2-card-title-dot" />
                                  {w.title}
                                </h4>
                                <div className="wsv2-badges">
                                  <span className={`wsv2-status ${w.status}`}>{_wsStatusLabels[w.status] || w.status}</span>
                                  {w.isPublic === false && (
                                    <span className="wsv2-visibility" title={isRTL ? 'مخفية عن الجمهور' : 'Hidden from public'}>
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                                      </svg>
                                      {isRTL ? 'خاصة' : 'Admin only'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {w.presenter && (
                                <div className="wsv2-presenter" style={{ color: wsColor }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                  </svg>
                                  {w.presenter}
                                </div>
                              )}
                              {w.assignedEmployee && (
                                <div className="wsv2-assigned">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                                  </svg>
                                  <span>{isRTL ? 'المسؤول:' : 'Assigned:'} <strong>{w.assignedEmployee.name}</strong></span>
                                </div>
                              )}
                              <div className="wsv2-meta">
                                {w.startDate && (
                                  <span className="wsv2-meta-item">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                                      <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                    {w.startDate}{w.endDate && w.endDate !== w.startDate ? ` → ${w.endDate}` : ''}
                                  </span>
                                )}
                                {w.totalHours && (
                                  <span className="wsv2-meta-item">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10"/>
                                      <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    {w.totalHours}h{perDay ? ` (${perDay}h × ${days}d)` : ''}
                                  </span>
                                )}
                                <span className={`wsv2-price ${w.price ? '' : 'free'}`}>
                                  {w.price ? `${w.price} SAR` : (isRTL ? 'مجاني' : 'Free')}
                                </span>
                              </div>
                              <div className="wsv2-students-bar">
                                <span className="wsv2-students-label">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                  </svg>
                                  {isRTL ? 'الطلاب' : 'Enrolled'}
                                </span>
                                <span className="wsv2-students-count">
                                  {w.studentCount || 0}
                                  {w.maxParticipants ? <span className="max">/{w.maxParticipants}</span> : null}
                                </span>
                                {w.maxParticipants && (
                                  <div className="wsv2-students-progress">
                                    <motion.div
                                      className="wsv2-students-progress-fill"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${progressPct}%` }}
                                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="wsv2-card-actions">
                                <button
                                  className="wsv2-view-btn"
                                  onClick={async () => {
                                    try {
                                      const res = await api.get(`/workshops/${w.workshopId}`);
                                      setViewingWorkshopStudents(res.data);
                                    } catch (e) { toast.error(isRTL ? 'خطأ' : 'Error'); }
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                  </svg>
                                  {isRTL ? 'عرض الطلاب' : 'View Students'}
                                </button>
                                <button
                                  className="wsv2-icon-btn"
                                  onClick={() => openWorkshopEditModal(w)}
                                  title={isRTL ? 'تعديل' : 'Edit'}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button
                                  className="wsv2-icon-btn del"
                                  onClick={() => handleDeleteWorkshop(w.workshopId)}
                                  title={isRTL ? 'حذف' : 'Delete'}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="wsv2-student-header"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                    >
                      <button
                        className="wsv2-back-btn"
                        onClick={() => { setViewingWorkshopStudents(null); clearWorkshopStudentSelect(); }}
                        title={isRTL ? 'رجوع' : 'Back'}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m15 18-6-6 6-6"/>
                        </svg>
                      </button>
                      <div className="wsv2-student-header-info">
                        <h3>{viewingWorkshopStudents.title}</h3>
                        <div className="wsv2-student-header-meta">
                          <span className="wsv2-student-count-pill">
                            {viewingWorkshopStudents.students?.length || 0}
                            <small>{isRTL ? 'طالب' : 'students'}</small>
                          </span>
                          {viewingWorkshopStudents.startDate && (
                            <span> · {viewingWorkshopStudents.startDate}{viewingWorkshopStudents.endDate && viewingWorkshopStudents.endDate !== viewingWorkshopStudents.startDate ? ` → ${viewingWorkshopStudents.endDate}` : ''}</span>
                          )}
                        </div>
                      </div>
                      <div className="wsv2-actions" style={{ marginInlineStart: 'auto' }}>
                        <button
                          className="wsv2-action-btn success"
                          onClick={async () => {
                            try {
                              const res = await api.get(`/workshops/${viewingWorkshopStudents.workshopId}/export-csv`, { responseType: 'blob' });
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
                              link.download = `workshop_students.csv`;
                              link.click();
                            } catch (e) { toast.error('Error'); }
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          CSV
                        </button>
                        <button
                          className="wsv2-action-btn scan"
                          onClick={() => { setWorkshopAddStudentForm(emptyWorkshopStudentForm); setShowWorkshopAddStudent(true); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                          {isRTL ? 'إضافة طالب' : 'Add Student'}
                        </button>
                        <button
                          className="wsv2-action-btn info"
                          onClick={() => { setWorkshopEmailTarget(null); setShowWorkshopEmailModal(true); }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          {isRTL ? 'بريد للجميع' : 'Email All'}
                        </button>
                        {/* Bulk print controls — visible only when the workshop has at least one student */}
                        {(viewingWorkshopStudents.students || []).length > 0 && (
                          <>
                            <button
                              className="wsv2-action-btn"
                              onClick={toggleAllWorkshopStudentSelect}
                              style={{ background: '#7c3aed', color: '#fff', border: 'none' }}
                              title={isRTL ? 'تحديد الكل / إلغاء' : 'Select all / clear'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              {(viewingWorkshopStudents.students || []).every(s => selectedWorkshopStudentIds.has(s.studentId))
                                ? (isRTL ? 'إلغاء التحديد' : 'Clear all')
                                : (isRTL ? 'تحديد الكل' : 'Select all')}
                            </button>
                            <button
                              className="wsv2-action-btn"
                              onClick={handlePrintSelectedWorkshopIds}
                              disabled={selectedWorkshopStudentIds.size === 0}
                              style={{
                                background: selectedWorkshopStudentIds.size === 0 ? '#e2e8f0' : '#059669',
                                color: selectedWorkshopStudentIds.size === 0 ? '#94a3b8' : '#fff',
                                border: 'none',
                                cursor: selectedWorkshopStudentIds.size === 0 ? 'not-allowed' : 'pointer'
                              }}
                              title={isRTL
                                ? 'طباعة بطاقات الحضور المحددة (٤ في كل A4)'
                                : 'Print selected attendance IDs (4 per A4)'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 6 2 18 2 18 9"/>
                                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                <rect x="6" y="14" width="12" height="8"/>
                              </svg>
                              {isRTL
                                ? `طباعة البطاقات (${selectedWorkshopStudentIds.size})`
                                : `Print IDs (${selectedWorkshopStudentIds.size})`}
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                    <div className="wsv2-student-list">
                      <AnimatePresence mode="popLayout">
                        {(viewingWorkshopStudents.students || []).length === 0 ? (
                          <motion.div key="stempty" className="wsv2-empty"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {isRTL ? '— لا يوجد طلاب مسجلين —' : '— No students registered —'}
                          </motion.div>
                        ) : (viewingWorkshopStudents.students || []).map((s, si) => {
                          const picked = selectedWorkshopStudentIds.has(s.studentId);
                          return (
                          <motion.div
                            key={s.studentId}
                            layout
                            className="wsv2-student-row"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                            transition={{ delay: si * 0.02, type: 'spring', stiffness: 300, damping: 22 }}
                            style={picked ? { outline: '2px solid #7c3aed', outlineOffset: -1 } : undefined}
                          >
                            {/* Print-select checkbox — absolutely positioned so it doesn't
                                break the row's fixed 3-column grid. */}
                            <label
                              onClick={(e) => e.stopPropagation()}
                              title={isRTL ? 'تحديد للطباعة' : 'Select for print'}
                              style={{
                                position: 'absolute', top: 6,
                                insetInlineStart: 6,
                                display: 'inline-flex', alignItems: 'center',
                                width: 18, height: 18, borderRadius: 4,
                                background: picked ? '#7c3aed' : '#fff',
                                border: `1.5px solid ${picked ? '#7c3aed' : '#cbd5e1'}`,
                                cursor: 'pointer',
                                zIndex: 2
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={picked}
                                onChange={() => toggleWorkshopStudentSelect(s.studentId)}
                                style={{ width: 14, height: 14, cursor: 'pointer', margin: 0, opacity: 0, position: 'absolute', inset: 0 }}
                              />
                              {picked && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 'auto' }}>
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                            </label>
                            <div className="wsv2-student-row-avatar">
                              {(s.firstName || '').charAt(0).toUpperCase()}
                            </div>
                            <div className="wsv2-student-row-info">
                              <span className="wsv2-student-row-name">{s.firstName} {s.lastName}</span>
                              <span className="wsv2-student-row-contact">
                                {s.phone}{s.email && ` · ${s.email}`}
                              </span>
                            </div>
                            <div className="wsv2-student-row-right">
                              <span className="wsv2-invoice-chip">
                                {isRTL ? 'فاتورة' : 'INV'} <strong>{s.invoiceNumber}</strong>
                              </span>
                              <span className={`wsv2-pay-status ${s.paymentStatus === 'verified' ? 'paid' : s.paymentStatus === 'rejected' ? 'rejected' : 'pending'}`}>
                                {s.paymentStatus === 'verified' ? (isRTL ? 'مدفوع' : 'Paid')
                                  : s.paymentStatus === 'rejected' ? (isRTL ? 'مرفوض' : 'Rejected')
                                  : (isRTL ? 'قيد المراجعة' : 'Pending')}
                              </span>
                              <select
                                className="wsv2-pay-select"
                                value={s.paymentStatus}
                                onChange={e => handleVerifyPayment(s.studentId, e.target.value)}
                                title={isRTL ? 'تغيير الحالة' : 'Change status'}
                              >
                                <option value="pending">{isRTL ? 'قيد المراجعة' : 'Pending'}</option>
                                <option value="verified">{isRTL ? 'تم التحقق' : 'Verified'}</option>
                                <option value="rejected">{isRTL ? 'مرفوض' : 'Rejected'}</option>
                              </select>
                              <span className={`wsv2-attend-pill ${s.attended ? 'present' : 'absent'}`}>
                                {s.attended
                                  ? `✓ ${Array.isArray(s.attendanceDates) ? s.attendanceDates.length : 0}${isRTL ? 'ي' : 'd'}`
                                  : (isRTL ? 'لم يحضر' : 'Absent')}
                              </span>
                              <select
                                className="wsv2-actions-select"
                                onChange={async (e) => {
                                  const action = e.target.value;
                                  e.target.value = '';
                                  if (action === 'edit') { setEditingStudent(s); setEditStudentForm({ firstName: s.firstName || '', lastName: s.lastName || '', phone: s.phone || '', email: s.email || '', nationalId: s.nationalId || '', gender: s.gender || '', age: s.age || '', city: s.city || '', invoiceNumber: s.invoiceNumber || '' }); }
                                  else if (action === 'printId') handlePrintStudentID(s, viewingWorkshopStudents);
                                  else if (action === 'attendance') openAttendanceEditor(s, viewingWorkshopStudents);
                                  else if (action === 'printCert') handlePrintWorkshopCertificate(s, viewingWorkshopStudents);
                                  else if (action === 'downloadPdf') {
                                    try { const res = await api.get(`/workshops/students/${s.studentId}/certificate-pdf`, { responseType: 'blob' }); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })); link.download = `certificate_${s.firstName}.pdf`; link.click(); } catch(e2) { let msg = isRTL ? 'خطأ' : 'Error'; if (e2.response?.data instanceof Blob) { try { const j = JSON.parse(await e2.response.data.text()); msg = (isRTL ? j.messageAr : j.message) || msg; } catch {} } toast.error(msg); }
                                  }
                                  else if (action === 'downloadPdfPlain') {
                                    try { const res = await api.get(`/workshops/students/${s.studentId}/certificate-pdf?plain=1`, { responseType: 'blob' }); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })); link.download = `certificate_plain_${s.firstName}.pdf`; link.click(); } catch(e2) { let msg = isRTL ? 'خطأ' : 'Error'; if (e2.response?.data instanceof Blob) { try { const j = JSON.parse(await e2.response.data.text()); msg = (isRTL ? j.messageAr : j.message) || msg; } catch {} } toast.error(msg); }
                                  }
                                  else if (action === 'emailCert') { try { await api.post(`/workshops/students/${s.studentId}/send-certificate`); toast.success(isRTL ? 'تم إرسال الشهادة' : 'Certificate emailed'); } catch(e2) { toast.error(e2.response?.data?.messageAr || 'Error'); } }
                                  else if (action === 'invoice') {
                                    setInvoiceTarget({ studentId: s.studentId, firstName: s.firstName || '', lastName: s.lastName || '', price: Number(viewingWorkshopStudents?.price || 0) });
                                    setInvoiceForm({ discount: '', discountType: 'amount', approver: '', customApprover: '' });
                                    setShowInvoiceModal(true);
                                  }
                                  else if (action === 'printAttId') handlePrintAttendanceId(s.studentId);
                                  else if (action === 'setCheckout') {
                                    const now = new Date();
                                    const hh = String(now.getHours()).padStart(2, '0');
                                    const mm = String(now.getMinutes()).padStart(2, '0');
                                    const promptMsg = isRTL
                                      ? `تسجيل وقت الخروج للطالب "${s.firstName} ${s.lastName || ''}" (بصيغة HH:MM):\nاتركه فارغاً لحذف تسجيل الخروج.`
                                      : `Enter check-out time for "${s.firstName} ${s.lastName || ''}" (HH:MM):\nLeave blank to clear check-out.`;
                                    const input = window.prompt(promptMsg, `${hh}:${mm}`);
                                    if (input === null) return; // cancelled
                                    const cleaned = input.trim();
                                    if (cleaned && !/^\d{2}:\d{2}(:\d{2})?$/.test(cleaned)) {
                                      toast.error(isRTL ? 'صيغة الوقت غير صحيحة (HH:MM)' : 'Invalid time format (HH:MM)');
                                      return;
                                    }
                                    try {
                                      await api.patch(`/workshops/students/${s.studentId}/attendance-checkout`, {
                                        checkOutAt: cleaned || null
                                      });
                                      toast.success(cleaned
                                        ? (isRTL ? 'تم تسجيل وقت الخروج' : 'Check-out saved')
                                        : (isRTL ? 'تم حذف وقت الخروج' : 'Check-out cleared'));
                                      // Refresh the workshop's students list so any UI that reads attendance updates
                                      try {
                                        const res = await api.get(`/workshops/${viewingWorkshopStudents.workshopId}`);
                                        setViewingWorkshopStudents(res.data);
                                      } catch {}
                                    } catch (e2) {
                                      const msg = e2?.response?.data?.messageAr || e2?.response?.data?.message;
                                      toast.error(msg || (isRTL ? 'فشل الحفظ' : 'Save failed'));
                                    }
                                  }
                                  else if (action === 'emailAttId') { try { await api.post(`/workshops/students/${s.studentId}/send-attendance-id`); toast.success(isRTL ? 'تم إرسال بطاقة الحضور' : 'Attendance ID sent'); } catch(e2) { toast.error('Error'); } }
                                  else if (action === 'emailCustom') { setWorkshopEmailTarget({ studentId: s.studentId, email: s.email }); setShowWorkshopEmailModal(true); }
                                  else if (action === 'whatsapp') { window.open(`https://wa.me/${(s.phone||'').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً ${s.firstName}،\n\nهذه رسالة من فاب لاب الأحساء بخصوص الورشة: ${viewingWorkshopStudents.title}`)}`, '_blank'); }
                                  else if (action === 'delete') { if (!window.confirm(isRTL ? 'حذف هذا الطالب؟' : 'Delete?')) return; try { await api.delete(`/workshops/students/${s.studentId}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); const res = await api.get(`/workshops/${viewingWorkshopStudents.workshopId}`); setViewingWorkshopStudents(res.data); fetchWorkshops(); } catch(e2) { toast.error('Error'); } }
                                }}
                                value=""
                              >
                                <option value="" disabled>{isRTL ? '⚙ إجراءات' : '⚙ Actions'}</option>
                                <option value="edit">{isRTL ? '✏ تعديل البيانات' : '✏ Edit Info'}</option>
                                <option value="attendance">{isRTL ? '✅ تعديل الحضور' : '✅ Edit Attendance'}</option>
                                <option value="setCheckout">{isRTL ? '🕐 تسجيل وقت الخروج' : '🕐 Set Check-out Time'}</option>
                                <option value="printAttId">{isRTL ? '🎟 طباعة بطاقة الحضور' : '🎟 Print Attendance ID'}</option>
                                <option value="printCert">{isRTL ? '🎓 طباعة الشهادة' : '🎓 Print Cert'}</option>
                                <option value="downloadPdf">{isRTL ? '📄 تحميل PDF' : '📄 Download PDF'}</option>
                                <option value="downloadPdfPlain">{isRTL ? '🖨 طباعة على قالب A4' : '🖨 Print on template'}</option>
                                <option value="invoice">{isRTL ? '🧾 طباعة الفاتورة' : '🧾 Print Invoice'}</option>
                                {s.email && <option value="emailCert">{isRTL ? '📧 إرسال الشهادة' : '📧 Email Cert'}</option>}
                                {s.email && <option value="emailAttId">{isRTL ? '📨 إرسال بطاقة الحضور' : '📨 Send Att. ID'}</option>}
                                {s.email && <option value="emailCustom">{isRTL ? '✉ بريد مخصص' : '✉ Custom Email'}</option>}
                                {s.phone && <option value="whatsapp">{isRTL ? '💬 واتساب' : '💬 WhatsApp'}</option>}
                                <option value="delete" style={{ color: '#dc2626' }}>{isRTL ? '🗑 حذف' : '🗑 Delete'}</option>
                              </select>
                            </div>
                          </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </motion.div>
              );
            })()}

            {/* Workshop Create/Edit Modal */}
            {showWorkshopModal && (
              <div className="modal-overlay" onClick={() => setShowWorkshopModal(false)}>
                <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ maxWidth: 650, maxHeight: '90vh', overflow: 'auto', padding: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>{selectedWorkshop ? (isRTL ? 'تعديل الورشة' : 'Edit Workshop') : (isRTL ? 'ورشة جديدة' : 'New Workshop')}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'عنوان الورشة' : 'Workshop Title'} *</label><input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.title} onChange={e => setWorkshopForm({...workshopForm, title: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'المقدم / المهندس' : 'Presenter'} *</label><input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.presenter} onChange={e => setWorkshopForm({...workshopForm, presenter: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الموظف المسؤول' : 'Assigned Employee'}</label><select style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.assignedEmployeeId} onChange={e => setWorkshopForm({...workshopForm, assignedEmployeeId: e.target.value})}><option value="">{isRTL ? 'اختر' : 'Select'}</option>{(employees || []).map(emp => <option key={emp.employeeId} value={emp.employeeId}>{emp.name}</option>)}</select></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'من تاريخ' : 'Start Date'} *</label><input type="date" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.startDate} onChange={e => setWorkshopForm({...workshopForm, startDate: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'إلى تاريخ' : 'End Date'}</label><input type="date" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.endDate} onChange={e => setWorkshopForm({...workshopForm, endDate: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'وقت البداية' : 'Start Time'}</label><input type="time" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.startTime} onChange={e => setWorkshopForm({...workshopForm, startTime: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'وقت النهاية' : 'End Time'}</label><input type="time" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.endTime} onChange={e => setWorkshopForm({...workshopForm, endTime: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'إجمالي الساعات' : 'Total Hours'}</label><input type="number" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.totalHours} onChange={e => setWorkshopForm({...workshopForm, totalHours: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الحد الأقصى للمشاركين' : 'Max Participants'}</label><input type="number" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.maxParticipants} onChange={e => setWorkshopForm({...workshopForm, maxParticipants: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'السعر' : 'Price (SAR)'}</label><input type="number" step="0.01" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.price} onChange={e => setWorkshopForm({...workshopForm, price: e.target.value})} /></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'المحتوى' : 'Content'}</label><textarea style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit', minHeight: 60 }} value={workshopForm.content} onChange={e => setWorkshopForm({...workshopForm, content: e.target.value})} /></div>
                    <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الأهداف / المخرجات' : 'Objectives / Outcomes'}</label><textarea style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit', minHeight: 60 }} value={workshopForm.objectives} onChange={e => setWorkshopForm({...workshopForm, objectives: e.target.value})} /></div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'صورة الورشة' : 'Workshop Photo'}</label>
                      <input type="file" accept="image/*" onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) { toast.error(isRTL ? 'الحد الأقصى 5 ميجابايت' : 'Max 5MB'); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => setWorkshopForm({...workshopForm, photo: ev.target.result});
                        reader.readAsDataURL(file);
                      }} style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} />
                      {workshopForm.photo && <img src={workshopForm.photo} alt="preview" style={{ marginTop: 8, maxHeight: 120, borderRadius: 8, objectFit: 'cover' }} />}
                    </div>
                    <div style={{ gridColumn: '1/-1' }}><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'ملاحظات' : 'Notes'}</label><input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.notes} onChange={e => setWorkshopForm({...workshopForm, notes: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الحد الأدنى للعمر' : 'Min Age'}</label><input type="number" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.minAge || ''} onChange={e => setWorkshopForm({...workshopForm, minAge: e.target.value})} placeholder={isRTL ? 'مثال: 12' : 'e.g. 12'} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الحد الأقصى للعمر' : 'Max Age'}</label><input type="number" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopForm.maxAge || ''} onChange={e => setWorkshopForm({...workshopForm, maxAge: e.target.value})} placeholder={isRTL ? 'مثال: 18' : 'e.g. 18'} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'لون الورشة' : 'Workshop Color'}</label><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><input type="color" value={workshopForm.color || '#1a56db'} onChange={e => setWorkshopForm({...workshopForm, color: e.target.value})} style={{ width: 40, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }} /><span style={{ fontSize: '0.78rem', color: '#64748b' }}>{workshopForm.color || '#1a56db'}</span></div></div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
                        {isRTL ? 'ظهور الورشة' : 'Workshop Visibility'}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setWorkshopForm({ ...workshopForm, isPublic: true })}
                          style={{
                            padding: '0.75rem', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                            border: workshopForm.isPublic ? '2px solid #22c55e' : '1.5px solid #e2e8f0',
                            background: workshopForm.isPublic ? 'rgba(34,197,94,0.08)' : 'white',
                            textAlign: 'start', display: 'flex', gap: '0.6rem', alignItems: 'flex-start'
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={workshopForm.isPublic ? '#16a34a' : '#94a3b8'} strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: workshopForm.isPublic ? '#166534' : '#334155' }}>
                              {isRTL ? 'ظاهرة للجمهور' : 'Public'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                              {isRTL ? 'يمكن للزوار التسجيل عبر الموقع' : 'Visitors can register via the site'}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkshopForm({ ...workshopForm, isPublic: false })}
                          style={{
                            padding: '0.75rem', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                            border: !workshopForm.isPublic ? '2px solid #f59e0b' : '1.5px solid #e2e8f0',
                            background: !workshopForm.isPublic ? 'rgba(245,158,11,0.08)' : 'white',
                            textAlign: 'start', display: 'flex', gap: '0.6rem', alignItems: 'flex-start'
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={!workshopForm.isPublic ? '#d97706' : '#94a3b8'} strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: !workshopForm.isPublic ? '#92400e' : '#334155' }}>
                              {isRTL ? 'خاصة بالإدارة' : 'Admin only'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                              {isRTL ? 'مخفية عن الزوار — الإدارة تضيف الطلاب و رموز QR' : 'Hidden from visitors — admin adds students & QR codes'}
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button onClick={() => setShowWorkshopModal(false)} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                    <button onClick={handleCreateWorkshop} disabled={workshopLoading} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', opacity: workshopLoading ? 0.7 : 1 }}>
                      {workshopLoading ? '...' : selectedWorkshop ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إنشاء' : 'Create')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* QR Scanner */}
            {showQRScanner && (
              <QRScanner
                onClose={() => setShowQRScanner(false)}
                onResult={(data) => {
                  toast.success(
                    <div dir={isRTL ? 'rtl' : 'ltr'}>
                      {data.name && <div><strong>{data.name}</strong></div>}
                      {data.workshop && <div>{isRTL ? 'الورشة:' : 'Workshop:'} {data.workshop}</div>}
                      {data.phone && <div dir="ltr">{data.phone}</div>}
                    </div>,
                    { autoClose: 10000 }
                  );
                }}
              />
            )}

            {/* Admin Add Student Modal (workshop) */}
            {showWorkshopAddStudent && viewingWorkshopStudents && (
              <div className="modal-overlay" onClick={() => !addingWorkshopStudent && setShowWorkshopAddStudent(false)}>
                <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ maxWidth: 540, padding: '2rem' }}>
                  <h3 style={{ marginBottom: '0.25rem' }}>{isRTL ? 'إضافة طالب يدوياً' : 'Add Student Manually'}</h3>
                  <p style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
                    {isRTL ? `إلى: ${viewingWorkshopStudents.title}` : `To: ${viewingWorkshopStudents.title}`}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الاسم الأول' : 'First Name'} *</label><input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.firstName} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, firstName: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الاسم الأخير' : 'Last Name'}</label><input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.lastName} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, lastName: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الهاتف' : 'Phone'} *</label><input dir="ltr" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.phone} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, phone: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'البريد' : 'Email'}</label><input type="email" dir="ltr" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.email} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, email: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'رقم هوية الطالب' : "Student's National ID"}</label><input dir="ltr" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.nationalId} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, nationalId: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الجنس' : 'Gender'}</label>
                      <select style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.gender} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, gender: e.target.value})}>
                        <option value="">—</option>
                        <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                        <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
                      </select>
                    </div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'العمر' : 'Age'}</label><input type="number" min="0" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.age} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, age: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'المدينة' : 'City'}</label><input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.city} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, city: e.target.value})} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'رقم الفاتورة' : 'Invoice Number'}</label><input dir="ltr" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={workshopAddStudentForm.invoiceNumber} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, invoiceNumber: e.target.value})} /></div>
                    <div style={{ gridColumn: '1 / -1' }}><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'ملاحظات' : 'Notes'}</label><textarea rows={2} style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit', resize: 'vertical' }} value={workshopAddStudentForm.notes} onChange={e => setWorkshopAddStudentForm({...workshopAddStudentForm, notes: e.target.value})} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button onClick={() => setShowWorkshopAddStudent(false)} disabled={addingWorkshopStudent} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                    <button onClick={handleAdminAddWorkshopStudent} disabled={addingWorkshopStudent} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#a78bfa', color: 'white', cursor: addingWorkshopStudent ? 'not-allowed' : 'pointer', fontWeight: 600, fontFamily: 'inherit', opacity: addingWorkshopStudent ? 0.7 : 1 }}>
                      {addingWorkshopStudent ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'إضافة' : 'Add')}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Edit Student Modal */}
            {editingStudent && (
              <div className="modal-overlay" onClick={() => setEditingStudent(null)}>
                <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ maxWidth: 500, padding: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>{isRTL ? 'تعديل بيانات الطالب' : 'Edit Student Info'}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الاسم الأول' : 'First Name'}</label><input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={editStudentForm.firstName} onChange={e => setEditStudentForm({...editStudentForm, firstName: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الاسم الأخير' : 'Last Name'}</label><input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={editStudentForm.lastName} onChange={e => setEditStudentForm({...editStudentForm, lastName: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الهاتف' : 'Phone'}</label><input dir="ltr" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={editStudentForm.phone} onChange={e => setEditStudentForm({...editStudentForm, phone: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'البريد' : 'Email'}</label><input type="email" dir="ltr" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={editStudentForm.email} onChange={e => setEditStudentForm({...editStudentForm, email: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الهوية' : 'National ID'}</label><input dir="ltr" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={editStudentForm.nationalId} onChange={e => setEditStudentForm({...editStudentForm, nationalId: e.target.value})} /></div>
                    <div><label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الفاتورة' : 'Invoice'}</label><input dir="ltr" style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }} value={editStudentForm.invoiceNumber} onChange={e => setEditStudentForm({...editStudentForm, invoiceNumber: e.target.value})} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button onClick={() => setEditingStudent(null)} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                    <button onClick={handleUpdateStudent} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>{isRTL ? 'حفظ' : 'Save'}</button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Workshop Student Attendance Editor Modal */}
            {attendanceEditTarget && (() => {
              const student = attendanceEditTarget.student;
              const workshop = attendanceEditTarget.workshop;
              const days = workshopDaysList(workshop);
              const attended = Array.isArray(student.attendanceDates) ? student.attendanceDates : [];
              const attendedCount = attended.length;
              const totalDays = Math.max(1, days.length);
              const requiredForCert = Math.ceil(totalDays / 2);
              const meetsCertReq = attendedCount >= requiredForCert;
              const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
              return (
                <div
                  className="modal-overlay"
                  onClick={() => !attendanceEditSaving && setAttendanceEditTarget(null)}
                  style={{ zIndex: 1200 }}
                >
                  <motion.div
                    className="modal-content"
                    onClick={(e) => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ maxWidth: 620, padding: '1.75rem', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                          ✅ {isRTL ? 'تعديل الحضور' : 'Edit Attendance'}
                        </h3>
                        <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 4 }}>
                          <strong>{fullName}</strong>
                          <span style={{ color: '#94a3b8', margin: '0 6px' }}>·</span>
                          <span>{workshop.title}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => !attendanceEditSaving && setAttendanceEditTarget(null)}
                        style={{ background: 'none', border: 'none', fontSize: 24, color: '#94a3b8', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                      >×</button>
                    </div>

                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12
                    }}>
                      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700, letterSpacing: 0.5 }}>{isRTL ? 'أيام الورشة' : 'Workshop days'}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1e3a8a', marginTop: 2 }}>{totalDays}</div>
                      </div>
                      <div style={{ padding: '10px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, letterSpacing: 0.5 }}>{isRTL ? 'حضر' : 'Attended'}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#14532d', marginTop: 2 }}>{attendedCount}</div>
                      </div>
                      <div style={{
                        padding: '10px 12px', borderRadius: 8,
                        background: meetsCertReq ? '#f0fdf4' : '#fef3c7',
                        border: meetsCertReq ? '1px solid #bbf7d0' : '1px solid #fde68a',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 10, color: meetsCertReq ? '#166534' : '#92400e', fontWeight: 700, letterSpacing: 0.5 }}>
                          {isRTL ? 'مؤهل للشهادة' : 'Cert eligible'}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: meetsCertReq ? '#14532d' : '#78350f', marginTop: 2 }}>
                          {meetsCertReq
                            ? (isRTL ? '✓ نعم' : '✓ Yes')
                            : (isRTL ? `يحتاج ${requiredForCert}` : `Needs ${requiredForCert}`)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <button
                        onClick={() => toggleAllAttendance(true)}
                        disabled={attendanceEditSaving || days.length === 0}
                        style={{
                          flex: 1, padding: '6px 12px', borderRadius: 6,
                          border: '1px solid #22c55e', background: '#dcfce7', color: '#166534',
                          fontWeight: 700, fontSize: 12, cursor: attendanceEditSaving ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        ✓ {isRTL ? 'تعليم الكل حاضر' : 'Mark all present'}
                      </button>
                      <button
                        onClick={() => toggleAllAttendance(false)}
                        disabled={attendanceEditSaving || days.length === 0}
                        style={{
                          flex: 1, padding: '6px 12px', borderRadius: 6,
                          border: '1px solid #ef4444', background: '#fee2e2', color: '#991b1b',
                          fontWeight: 700, fontSize: 12, cursor: attendanceEditSaving ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit'
                        }}
                      >
                        ✗ {isRTL ? 'مسح الكل' : 'Clear all'}
                      </button>
                    </div>

                    <div style={{
                      overflowY: 'auto', flex: 1,
                      border: '1px solid #e2e8f0', borderRadius: 8, padding: 6, background: '#f8fafc'
                    }}>
                      {days.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                          {isRTL ? 'لم يتم تحديد تواريخ للورشة.' : 'Workshop has no date range set.'}
                        </div>
                      ) : (
                        days.map(date => {
                          const present = attended.includes(date);
                          return (
                            <label
                              key={date}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', borderRadius: 6,
                                background: present ? '#dcfce7' : '#fff',
                                border: '1px solid ' + (present ? '#86efac' : '#e2e8f0'),
                                marginBottom: 4, cursor: 'pointer',
                                transition: 'background 0.1s'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={present}
                                onChange={() => toggleAttendanceDate(date)}
                                disabled={attendanceEditSaving}
                                style={{ width: 18, height: 18, cursor: attendanceEditSaving ? 'not-allowed' : 'pointer' }}
                              />
                              <div style={{ flex: 1, fontFamily: 'Consolas, monospace', fontSize: 13, color: '#0f172a' }}>
                                {date}
                              </div>
                              <span style={{
                                padding: '2px 10px', borderRadius: 999,
                                fontSize: 11, fontWeight: 700,
                                background: present ? '#166534' : '#e2e8f0',
                                color: present ? '#fff' : '#64748b'
                              }}>
                                {present ? (isRTL ? '✓ حاضر' : '✓ Present') : (isRTL ? 'غائب' : 'Absent')}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 10 }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {isRTL
                          ? 'التغييرات تُحفظ تلقائياً بمجرد التحديد.'
                          : 'Changes save automatically on toggle.'}
                        {attendanceEditSaving && <span style={{ marginInlineStart: 8, color: '#0ea5e9', fontWeight: 700 }}>{isRTL ? '· جارٍ الحفظ...' : '· saving…'}</span>}
                      </div>
                      <button
                        onClick={() => setAttendanceEditTarget(null)}
                        disabled={attendanceEditSaving}
                        style={{
                          padding: '8px 18px', borderRadius: 6,
                          border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                          color: '#fff', fontWeight: 700, fontSize: 13,
                          cursor: attendanceEditSaving ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', opacity: attendanceEditSaving ? 0.6 : 1
                        }}
                      >
                        {isRTL ? 'تم' : 'Done'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              );
            })()}

            {/* Workshop Email Modal */}
            {showWorkshopEmailModal && (
              <div className="modal-overlay" onClick={() => setShowWorkshopEmailModal(false)}>
                <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ maxWidth: 500, padding: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>
                    {workshopEmailTarget
                      ? (isRTL ? `إرسال بريد إلى: ${workshopEmailTarget.email}` : `Email to: ${workshopEmailTarget.email}`)
                      : (isRTL ? 'إرسال بريد لجميع الطلاب' : 'Email All Students')
                    }
                  </h3>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الموضوع' : 'Subject'}</label>
                    <input style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
                      value={workshopEmailForm.subject} onChange={e => setWorkshopEmailForm({...workshopEmailForm, subject: e.target.value})} />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الرسالة' : 'Message'}</label>
                    <textarea style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit', minHeight: 120, resize: 'vertical' }}
                      value={workshopEmailForm.message} onChange={e => setWorkshopEmailForm({...workshopEmailForm, message: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowWorkshopEmailModal(false)} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                    <button onClick={handleSendWorkshopEmail} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                      {isRTL ? '📧 إرسال' : '📧 Send'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {showInvoiceModal && invoiceTarget && (
              <div className="modal-overlay" onClick={() => { setShowInvoiceModal(false); setInvoiceTarget(null); }}>
                <motion.div className="modal-content" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  style={{ maxWidth: 520, padding: '2rem' }}>
                  <h3 style={{ marginBottom: '0.4rem' }}>
                    {isRTL ? '🧾 طباعة الفاتورة' : '🧾 Print Invoice'}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                    {isRTL
                      ? `الطالب: ${invoiceTarget.firstName} ${invoiceTarget.lastName} • سعر الورشة: ${invoiceTarget.price} ر.س`
                      : `Student: ${invoiceTarget.firstName} ${invoiceTarget.lastName} • Price: ${invoiceTarget.price} SAR`}
                  </div>

                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>
                      {isRTL ? 'قيمة الخصم (اختياري)' : 'Discount (optional)'}
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={isRTL ? 'مثال: 50' : 'e.g. 50'}
                        style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
                        value={invoiceForm.discount}
                        onChange={e => setInvoiceForm({ ...invoiceForm, discount: e.target.value })}
                      />
                      <select
                        style={{ padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit', minWidth: 120 }}
                        value={invoiceForm.discountType}
                        onChange={e => setInvoiceForm({ ...invoiceForm, discountType: e.target.value })}
                      >
                        <option value="amount">{isRTL ? 'ر.س (مبلغ)' : 'SAR (amount)'}</option>
                        <option value="percent">{isRTL ? '% (نسبة)' : '% (percent)'}</option>
                      </select>
                    </div>
                  </div>

                  {Number(invoiceForm.discount) > 0 && (
                    <div style={{ marginBottom: '0.85rem', padding: '0.75rem', background: '#fffbeb', border: '1.5px solid #fbbf24', borderRadius: 8 }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: 6, color: '#92400e' }}>
                        {isRTL ? '👤 من اعتمد الخصم؟' : '👤 Who approved this discount?'}
                      </label>
                      <select
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit', background: '#fff' }}
                        value={invoiceForm.approver}
                        onChange={e => setInvoiceForm({ ...invoiceForm, approver: e.target.value, customApprover: e.target.value === '__custom__' ? invoiceForm.customApprover : '' })}
                      >
                        <option value="">{isRTL ? '— اختر الاسم —' : '— Select name —'}</option>
                        <option value="أ. عبدالمحسن السلطان">أ. عبدالمحسن السلطان</option>
                        <option value="أ. زكي اللويم">أ. زكي اللويم</option>
                        <option value="عبدالله الصفي">عبدالله الصفي</option>
                        <option value="__custom__">{isRTL ? '✏️ اسم آخر (إدخال يدوي)' : '✏️ Other (custom name)'}</option>
                      </select>
                      {invoiceForm.approver === '__custom__' && (
                        <input
                          type="text"
                          placeholder={isRTL ? 'أدخل الاسم الكامل' : 'Enter full name'}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit', marginTop: 8 }}
                          value={invoiceForm.customApprover}
                          onChange={e => setInvoiceForm({ ...invoiceForm, customApprover: e.target.value })}
                        />
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      onClick={() => { setShowInvoiceModal(false); setInvoiceTarget(null); }}
                      style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleGenerateInvoice}
                      style={{ padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none', background: '#1a56db', color: 'white', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                    >
                      {isRTL ? '🧾 توليد الفاتورة' : '🧾 Generate Invoice'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Volunteers Tab — wrapped with data-page="manager" because the
                volunteer/opportunity modal CSS (.modern-modal, .volunteer-modal,
                .opportunity-modal, etc. in Manager.css) is scoped under that
                attribute. Without the wrapper, none of those rules apply and
                the modals render unstyled. Same reason for the Workers tab. */}
            {activeTab === 'volunteers' && (
              <motion.div
                data-page="manager"
                className="opsv2"
                key="volunteers-ops"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <VolunteerManagement />
              </motion.div>
            )}

            {/* Workers Tab */}
            {activeTab === 'workers' && (
              <motion.div
                data-page="manager"
                className="opsv2"
                key="workers-ops"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <WorkerManagement />
              </motion.div>
            )}

            {/* Summer FabLab Tab */}
            {activeTab === 'summer' && <SummerFablab />}

            {/* Mawhba Tab */}
            {activeTab === 'mawhba' && <Mawhba />}

            {/* FabLab Visits Tab */}
            {activeTab === 'fablab-visits' && <FablabVisitsTab />}

            {/* Year Calendar Tab */}
            {activeTab === 'year-calendar' && <YearCalendar />}

            {/* Store Tab */}
            {activeTab === 'store' && <StoreTab />}
            {activeTab === 'print3d' && <Print3DTab />}
            {activeTab === 'institution-support' && <InstitutionSupportTab />}

            {/* FabLab Staff Tab — wrapped with data-page="manager" so the
                shared Manager.css classes (.volunteers-content, .volunteer-card,
                .modern-modal, etc.) apply, keeping it visually consistent
                with the Volunteers and Workers tabs. */}
            {activeTab === 'fablab-staff' && (
              <div data-page="manager">
                <FablabStaffManagement />
              </div>
            )}

            {activeTab === 'overtime' && (
              <motion.div
                data-page="manager"
                className="opsv2 opsv2-overtime"
                key="overtime-ops"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <OvertimeManagement />
              </motion.div>
            )}

            {activeTab === 'trainer-assistants' && (
              <div data-page="manager">
                <TrainerAssistantManagement />
              </div>
            )}

            {/* Customers Tab — mailing list + bulk email composer. */}
            {activeTab === 'contracts' && (
              <div data-page="manager">
                <ContractsManagement />
              </div>
            )}

            {activeTab === 'customers' && (
              <div data-page="manager">
                <CustomersManagement />
              </div>
            )}

            {activeTab === 'attendance-station' && (
              <motion.div
                key="attendance-station"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{ padding: '20px 4px' }}
              >
                <div style={{
                  background: 'linear-gradient(135deg, rgba(74,222,128,0.10), rgba(37,99,235,0.08))',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 16,
                  padding: '40px 32px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 56, marginBottom: 12 }}>📡</div>
                  <h2 style={{
                    margin: '0 0 8px',
                    fontSize: 28, fontWeight: 800,
                    color: 'var(--text-primary, #0f172a)'
                  }}>
                    {isRTL ? 'محطة الحضور الموحّدة' : 'Unified Attendance Station'}
                  </h2>
                  <p style={{
                    margin: '0 auto 24px', maxWidth: 560,
                    color: 'var(--text-secondary, #64748b)',
                    fontSize: 14, lineHeight: 1.7
                  }}>
                    {isRTL
                      ? 'محطة موحدة لتسجيل حضور وخروج جميع الفئات (متطوعون، موظفون، مدربون، طلاب ورش، صيف، موهبة، تدريب جامعي). يقبل الماسح أي بطاقة QR ويصنّفها تلقائياً.'
                      : 'One kiosk for check-in / check-out across all groups (volunteers, staff, trainers, workshop students, summer, mawhba, university interns). The scanner accepts any QR and categorizes it automatically.'}
                  </p>
                  <button
                    onClick={() => setAttendanceKioskOpen(true)}
                    style={{
                      padding: '14px 32px', borderRadius: 12,
                      background: 'linear-gradient(135deg, #16a34a, #059669)',
                      color: '#fff', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
                      boxShadow: '0 8px 24px rgba(22,163,74,0.35)',
                      display: 'inline-flex', alignItems: 'center', gap: 10
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    {isRTL ? 'فتح محطة الحضور' : 'Open Attendance Station'}
                  </button>
                  <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-secondary, #94a3b8)' }}>
                    💡 {isRTL
                      ? 'المحطة تعمل بوضع ملء الشاشة — يمكن إغلاقها بزر × في الأعلى.'
                      : 'The kiosk runs full-screen — close it with the × button in the top corner.'}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'quick-messages' && (
              <motion.div
                key="quick-messages"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <QuickMessages />
              </motion.div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}

                className="settings-content"
              >
                <div className="settings-grid">
                  <div className="settings-card" style={{ gridColumn: '1 / -1', border: registrationPaused ? '2px solid #ef4444' : '2px solid #22c55e', background: registrationPaused ? 'rgba(239,68,68,0.03)' : 'rgba(34,197,94,0.03)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={registrationPaused ? '#ef4444' : '#22c55e'} strokeWidth="2">
                        {registrationPaused ? (
                          <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>
                        ) : (
                          <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                        )}
                      </svg>
                      {isRTL ? 'حالة التسجيل' : 'Registration Status'}
                    </h3>
                    <div className="settings-form">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: registrationPaused ? '#fef2f2' : '#f0fdf4', borderRadius: '10px', marginBottom: '12px' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: registrationPaused ? '#dc2626' : '#16a34a' }}>
                            {registrationPaused
                              ? (isRTL ? 'التسجيل متوقف مؤقتاً' : 'Registration is PAUSED')
                              : (isRTL ? 'التسجيل مفعّل' : 'Registration is ACTIVE')}
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
                            {isRTL ? 'تبديل هذا الخيار سيمنع المستخدمين من التسجيل' : 'Toggling this will prevent users from registering'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (registrationPaused) {
                              handleToggleRegistration();
                            } else if (!pauseReason.trim()) {
                              toast.error(isRTL ? 'يرجى إدخال سبب إيقاف التسجيل أولاً' : 'Please enter a reason for pausing first');
                            } else {
                              handleToggleRegistration();
                            }
                          }}
                          disabled={savingPause}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: '700',
                            fontSize: '14px',
                            cursor: savingPause ? 'not-allowed' : 'pointer',
                            background: registrationPaused ? '#22c55e' : '#ef4444',
                            color: 'white',
                            transition: 'all 0.2s',
                            opacity: savingPause ? 0.7 : 1
                          }}
                        >
                          {savingPause
                            ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                            : registrationPaused
                              ? (isRTL ? 'تفعيل التسجيل' : 'Enable Registration')
                              : (isRTL ? 'إيقاف التسجيل' : 'Pause Registration')}
                        </button>
                      </div>
                      <div className="form-group">
                        <label style={{ fontWeight: '600' }}>
                          {isRTL ? 'سبب الإيقاف (سيظهر للمستخدمين)' : 'Pause Reason (shown to users)'}
                        </label>
                        <textarea
                          value={pauseReason}
                          onChange={(e) => setPauseReason(e.target.value)}
                          placeholder={isRTL ? 'مثال: التسجيل متوقف مؤقتاً بسبب أعمال الصيانة...' : 'e.g., Registration is paused for maintenance...'}
                          rows={3}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', resize: 'vertical', fontSize: '14px', fontFamily: 'inherit' }}
                          disabled={registrationPaused}
                        />
                        {registrationPaused && pauseReason && (
                          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#dc2626' }}>
                            {isRTL ? 'لتعديل السبب، قم بتفعيل التسجيل أولاً ثم أعد إيقافه بسبب جديد' : 'To change the reason, enable registration first then pause again with a new reason'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Store closure toggle — mirrors registration pause but for the store */}
                  <div className="settings-card" style={{ gridColumn: '1 / -1', border: storeClosed ? '2px solid #f59e0b' : '2px solid #22c55e', background: storeClosed ? 'rgba(245,158,11,0.03)' : 'rgba(34,197,94,0.03)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={storeClosed ? '#f59e0b' : '#22c55e'} strokeWidth="2">
                        <path d="M3 9h18l-1.5 11.5a2 2 0 0 1-2 1.5h-11a2 2 0 0 1-2-1.5L3 9z"/>
                        <path d="M8 9V6a4 4 0 0 1 8 0v3"/>
                      </svg>
                      {isRTL ? 'حالة المتجر' : 'Store Status'}
                    </h3>
                    <div className="settings-form">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: storeClosed ? '#fffbeb' : '#f0fdf4', borderRadius: '10px', marginBottom: '12px' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: storeClosed ? '#b45309' : '#16a34a' }}>
                            {storeClosed
                              ? (isRTL ? 'المتجر مغلق مؤقتاً' : 'Store is CLOSED')
                              : (isRTL ? 'المتجر مفتوح' : 'Store is OPEN')}
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
                            {isRTL ? 'استخدم هذا الخيار لإيقاف الطلبات مؤقتاً أثناء إضافة أو تحديث المنتجات' : 'Use this to temporarily block new orders while you add or update products'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (storeClosed) {
                              handleToggleStore();
                            } else if (!storeCloseReason.trim()) {
                              toast.error(isRTL ? 'يرجى إدخال سبب الإغلاق أولاً' : 'Please enter a reason first');
                            } else {
                              handleToggleStore();
                            }
                          }}
                          disabled={savingStoreClose}
                          style={{
                            padding: '10px 24px',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: '700',
                            fontSize: '14px',
                            cursor: savingStoreClose ? 'not-allowed' : 'pointer',
                            background: storeClosed ? '#22c55e' : '#f59e0b',
                            color: 'white',
                            transition: 'all 0.2s',
                            opacity: savingStoreClose ? 0.7 : 1
                          }}
                        >
                          {savingStoreClose
                            ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                            : storeClosed
                              ? (isRTL ? 'فتح المتجر' : 'Open Store')
                              : (isRTL ? 'إغلاق مؤقت' : 'Close Store')}
                        </button>
                      </div>
                      <div className="form-group">
                        <label style={{ fontWeight: '600' }}>
                          {isRTL ? 'سبب الإغلاق (سيظهر للعملاء)' : 'Closure Reason (shown to customers)'}
                        </label>
                        <textarea
                          value={storeCloseReason}
                          onChange={(e) => setStoreCloseReason(e.target.value)}
                          placeholder={isRTL ? 'مثال: نقوم بتحديث المنتجات — سنعود قريباً' : 'e.g., We are updating products — back soon'}
                          rows={3}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', resize: 'vertical', fontSize: '14px', fontFamily: 'inherit' }}
                          disabled={storeClosed}
                        />
                        {storeClosed && storeCloseReason && (
                          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#b45309' }}>
                            {isRTL ? 'لتعديل السبب، افتح المتجر أولاً ثم أغلقه بسبب جديد' : 'To change the reason, open the store first then close again with a new reason'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3D printing closure — mirrors the store card but with
                      an optional date window (from/to) so admin can schedule
                      a maintenance period in advance instead of remembering
                      to reopen it manually. Effective-closed = disabled AND
                      today is inside [from,to] (empty bounds = open-ended). */}
                  <div className="settings-card" style={{ gridColumn: '1 / -1', border: p3dStatus.effectiveClosed ? '2px solid #f59e0b' : '2px solid #22c55e', background: p3dStatus.effectiveClosed ? 'rgba(245,158,11,0.03)' : 'rgba(34,197,94,0.03)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={p3dStatus.effectiveClosed ? '#f59e0b' : '#22c55e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      {isRTL ? 'حالة خدمة الطباعة ثلاثية الأبعاد' : '3D Printing Service Status'}
                    </h3>
                    <div className="settings-form">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: p3dStatus.effectiveClosed ? '#fffbeb' : '#f0fdf4', borderRadius: '10px', marginBottom: '12px', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: p3dStatus.effectiveClosed ? '#b45309' : '#16a34a' }}>
                            {p3dStatus.effectiveClosed
                              ? (isRTL ? '🔒 الخدمة مغلقة حالياً' : '🔒 Service is CLOSED now')
                              : p3dStatus.disabled
                                ? (isRTL ? '⏳ الإغلاق مُجدوَل (خارج فترته حالياً)' : '⏳ Closure scheduled (outside its window)')
                                : (isRTL ? '✓ الخدمة مفتوحة' : '✓ Service is OPEN')}
                          </p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
                            {p3dStatus.disabled && (p3dStatus.from || p3dStatus.to)
                              ? (isRTL
                                  ? `فترة الإغلاق: ${p3dStatus.from || 'من الآن'} → ${p3dStatus.to || 'مفتوح'}`
                                  : `Closure window: ${p3dStatus.from || 'now'} → ${p3dStatus.to || 'open-ended'}`)
                              : (isRTL
                                  ? 'أوقف استلام طلبات الطباعة ثلاثية الأبعاد مؤقتاً — يمكنك تحديد فترة زمنية.'
                                  : 'Temporarily stop 3D printing submissions — optional date window.')}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (p3dStatus.disabled) {
                              handleTogglePrint3d();
                            } else if (!p3dForm.reason.trim()) {
                              toast.error(isRTL ? 'يرجى إدخال سبب الإغلاق أولاً' : 'Please enter a reason first');
                            } else {
                              handleTogglePrint3d();
                            }
                          }}
                          disabled={savingP3d}
                          style={{
                            padding: '10px 24px', borderRadius: '10px', border: 'none',
                            fontWeight: '700', fontSize: '14px',
                            cursor: savingP3d ? 'not-allowed' : 'pointer',
                            background: p3dStatus.disabled ? '#22c55e' : '#f59e0b',
                            color: 'white', opacity: savingP3d ? 0.7 : 1
                          }}
                        >
                          {savingP3d
                            ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                            : p3dStatus.disabled
                              ? (isRTL ? 'فتح الخدمة' : 'Open service')
                              : (isRTL ? 'إغلاق الخدمة' : 'Close service')}
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>
                            {isRTL ? 'من تاريخ (اختياري)' : 'From date (optional)'}
                          </label>
                          <input
                            type="date"
                            value={p3dForm.from}
                            onChange={(e) => setP3dForm(f => ({ ...f, from: e.target.value }))}
                            disabled={p3dStatus.disabled}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', fontSize: '14px', fontFamily: 'inherit' }}
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontWeight: '600' }}>
                            {isRTL ? 'إلى تاريخ (اختياري)' : 'To date (optional)'}
                          </label>
                          <input
                            type="date"
                            value={p3dForm.to}
                            onChange={(e) => setP3dForm(f => ({ ...f, to: e.target.value }))}
                            disabled={p3dStatus.disabled}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', fontSize: '14px', fontFamily: 'inherit' }}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label style={{ fontWeight: '600' }}>
                          {isRTL ? 'سبب الإغلاق (سيظهر للعملاء)' : 'Closure reason (shown to customers)'}
                        </label>
                        <textarea
                          value={p3dForm.reason}
                          onChange={(e) => setP3dForm(f => ({ ...f, reason: e.target.value }))}
                          placeholder={isRTL ? 'مثال: صيانة دورية للطابعات — نعود في 2026-09-10' : 'e.g., Scheduled printer maintenance — back on 2026-09-10'}
                          rows={2}
                          disabled={p3dStatus.disabled}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', resize: 'vertical', fontSize: '14px', fontFamily: 'inherit' }}
                        />
                        {p3dStatus.disabled && (
                          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#b45309' }}>
                            {isRTL ? 'لتعديل الفترة أو السبب، افتح الخدمة أولاً ثم أغلقها بإعدادات جديدة.' : 'To change the window or reason, reopen the service first then close again with new settings.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <FablabVisitOverrideCodeCard isRTL={isRTL} />

                  <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {isRTL ? 'فترات إغلاق التسجيل' : 'Registration Closures'}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', marginBottom: '14px' }}>
                      {isRTL
                        ? 'حدد فترة لإغلاق التسجيل في جميع أقسام فاب لاب. الأيام في التقويم ستكون غير متاحة وسيظهر السبب للمستخدمين.'
                        : 'Set a date range to close registration across ALL FabLab sections. Days will be unavailable on the calendar and the reason will be shown to users.'}
                    </p>

                    <div className="settings-form" style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                          <label>{isRTL ? 'تاريخ البداية' : 'Start Date'}</label>
                          <input
                            type="date"
                            value={closureForm.startDate}
                            onChange={(e) => setClosureForm(p => ({ ...p, startDate: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label>{isRTL ? 'تاريخ النهاية' : 'End Date'}</label>
                          <input
                            type="date"
                            value={closureForm.endDate}
                            onChange={(e) => setClosureForm(p => ({ ...p, endDate: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>{isRTL ? 'السبب (إنجليزي)' : 'Reason (English)'} <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                          type="text"
                          value={closureForm.reasonEn}
                          onChange={(e) => setClosureForm(p => ({ ...p, reasonEn: e.target.value }))}
                          placeholder="e.g., FabLab closed for maintenance"
                        />
                      </div>
                      <div className="form-group">
                        <label>{isRTL ? 'السبب (عربي)' : 'Reason (Arabic)'}</label>
                        <input
                          type="text"
                          value={closureForm.reasonAr}
                          onChange={(e) => setClosureForm(p => ({ ...p, reasonAr: e.target.value }))}
                          placeholder="مثال: فاب لاب مغلق للصيانة"
                          dir="rtl"
                        />
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={handleCreateClosure}
                        disabled={savingClosure}
                        style={{ marginTop: '4px' }}
                      >
                        {savingClosure
                          ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                          : (isRTL ? '+ إضافة فترة إغلاق' : '+ Add Closure')}
                      </button>
                    </div>

                    {closures.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '13px' }}>
                        {isRTL ? 'لا توجد فترات إغلاق' : 'No closures configured'}
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {closures.map(c => {
                          const today = new Date().toISOString().slice(0, 10);
                          const startStr = String(c.startDate).slice(0, 10);
                          const endStr = String(c.endDate).slice(0, 10);
                          const isActiveNow = c.isActive && startStr <= today && endStr >= today;
                          const isExpired = endStr < today;
                          const isUpcoming = c.isActive && startStr > today;
                          return (
                            <div key={c.closureId} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '10px 14px', borderRadius: '8px',
                              background: 'var(--bg-secondary, #f8fafc)',
                              border: isActiveNow ? '2px solid #ef4444' : '1px solid var(--border-color, #e2e8f0)',
                              opacity: c.isActive ? 1 : 0.5
                            }}>
                              <div>
                                <strong style={{ fontSize: '14px', color: 'var(--text-primary, #0f172a)' }}>
                                  {isRTL ? (c.reasonAr || c.reasonEn) : c.reasonEn}
                                </strong>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>
                                  {startStr} → {endStr}
                                </div>
                                <span style={{
                                  display: 'inline-block', marginTop: '4px', padding: '2px 8px',
                                  borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                                  background: isActiveNow ? '#fee2e2' : isExpired ? '#e5e7eb' : isUpcoming ? '#fef9c3' : '#e5e7eb',
                                  color: isActiveNow ? '#991b1b' : isExpired ? '#374151' : isUpcoming ? '#854d0e' : '#374151'
                                }}>
                                  {!c.isActive
                                    ? (isRTL ? 'محذوف' : 'Deleted')
                                    : isActiveNow
                                      ? (isRTL ? 'نشط الآن' : 'Active Now')
                                      : isExpired
                                        ? (isRTL ? 'منتهي' : 'Expired')
                                        : (isRTL ? 'قادم' : 'Upcoming')}
                                </span>
                              </div>
                              {c.isActive && (
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '4px 12px', fontSize: '12px' }}
                                  onClick={() => handleDeleteClosure(c.closureId)}
                                >
                                  {isRTL ? 'حذف' : 'Delete'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="settings-card">
                    <h3>{isRTL ? 'معلومات الحساب' : 'Account Information'}</h3>
                    <div className="settings-form">
                      <div className="form-group">
                        <label>{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
                        <input type="text" value={adminData.fullName} disabled />
                      </div>
                      <div className="form-group">
                        <label>{isRTL ? 'اسم المستخدم' : 'Username'}</label>
                        <input type="text" value={adminData.username} disabled />
                      </div>
                      <div className="form-group">
                        <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                        <input type="email" value={adminData.email} disabled />
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <h3>{isRTL ? 'تفضيلات اللغة' : 'Language Preferences'}</h3>
                    <div className="settings-form">
                      <div className="language-options">
                        <button
                          className={`lang-option ${i18n.language === 'en' ? 'active' : ''}`}
                          onClick={() => i18n.changeLanguage('en')}
                        >
                          <span className="lang-flag">EN</span>
                          <span>English</span>
                        </button>
                        <button
                          className={`lang-option ${i18n.language === 'ar' ? 'active' : ''}`}
                          onClick={() => i18n.changeLanguage('ar')}
                        >
                          <span className="lang-flag">ع</span>
                          <span>العربية</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <h3>{isRTL ? 'المظهر' : 'Appearance'}</h3>
                    <div className="settings-form">
                      <div className="theme-options">
                        <button
                          className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                          onClick={() => setTheme('light')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                          <span>{isRTL ? 'فاتح' : 'Light'}</span>
                        </button>
                        <button
                          className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                          onClick={() => setTheme('dark')}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                          </svg>
                          <span>{isRTL ? 'داكن' : 'Dark'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <h3>{isRTL ? 'ساعات العمل' : 'Working Hours'}</h3>
                    <div className="settings-form">
                      <div className="form-group">
                        <label>{isRTL ? 'وقت البداية' : 'Start Time'}</label>
                        <input
                          type="time"
                          value={workingHours.startTime}
                          onChange={(e) => setWorkingHours(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>{isRTL ? 'وقت النهاية' : 'End Time'}</label>
                        <input
                          type="time"
                          value={workingHours.endTime}
                          onChange={(e) => setWorkingHours(prev => ({ ...prev, endTime: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>{isRTL ? 'أيام العمل' : 'Working Days'}</label>
                        <div className="working-days-checkboxes" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                          {[
                            { value: 0, en: 'Sun', ar: 'أحد' },
                            { value: 1, en: 'Mon', ar: 'إثن' },
                            { value: 2, en: 'Tue', ar: 'ثلا' },
                            { value: 3, en: 'Wed', ar: 'أرب' },
                            { value: 4, en: 'Thu', ar: 'خمي' },
                            { value: 5, en: 'Fri', ar: 'جمع' },
                            { value: 6, en: 'Sat', ar: 'سبت' }
                          ].map(day => (
                            <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: workingHours.workingDays.includes(day.value) ? 'var(--primary-color, #6366f1)' : 'var(--bg-secondary, #f1f5f9)', color: workingHours.workingDays.includes(day.value) ? '#fff' : 'inherit', transition: 'all 0.2s' }}>
                              <input
                                type="checkbox"
                                checked={workingHours.workingDays.includes(day.value)}
                                onChange={(e) => {
                                  setWorkingHours(prev => ({
                                    ...prev,
                                    workingDays: e.target.checked
                                      ? [...prev.workingDays, day.value].sort()
                                      : prev.workingDays.filter(d => d !== day.value)
                                  }));
                                }}
                                style={{ display: 'none' }}
                              />
                              {isRTL ? day.ar : day.en}
                            </label>
                          ))}
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={handleUpdateWorkingHours}
                        disabled={savingWorkingHours}
                        style={{ marginTop: '12px' }}
                      >
                        {savingWorkingHours
                          ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                          : (isRTL ? 'حفظ ساعات العمل' : 'Save Working Hours')}
                      </button>
                    </div>
                  </div>

                  <div className="settings-card">
                    <h3>{isRTL ? 'فترات تجاوز ساعات العمل' : 'Working Hours Overrides'}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary, #64748b)', marginBottom: '12px' }}>
                      {isRTL ? 'إضافة فترات مؤقتة بساعات عمل مختلفة (مثل رمضان أو العطلات)' : 'Add temporary periods with different working hours (e.g., Ramadan, holidays)'}
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowOverrideForm(!showOverrideForm)}
                      style={{ marginBottom: '12px' }}
                    >
                      {showOverrideForm ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? '+ إضافة فترة تجاوز' : '+ Add Override')}
                    </button>

                    {showOverrideForm && (
                      <div className="settings-form" style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                        <div className="form-group">
                          <label>{isRTL ? 'الاسم (إنجليزي)' : 'Label (English)'}</label>
                          <input
                            type="text"
                            value={overrideForm.labelEn}
                            onChange={(e) => setOverrideForm(prev => ({ ...prev, labelEn: e.target.value }))}
                            placeholder={isRTL ? 'مثال: ساعات رمضان' : 'e.g., Ramadan Hours'}
                          />
                        </div>
                        <div className="form-group">
                          <label>{isRTL ? 'الاسم (عربي)' : 'Label (Arabic)'}</label>
                          <input
                            type="text"
                            value={overrideForm.labelAr}
                            onChange={(e) => setOverrideForm(prev => ({ ...prev, labelAr: e.target.value }))}
                            placeholder={isRTL ? 'ساعات رمضان' : 'e.g., ساعات رمضان'}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label>{isRTL ? 'تاريخ البداية' : 'Start Date'}</label>
                            <input
                              type="date"
                              value={overrideForm.startDate}
                              onChange={(e) => setOverrideForm(prev => ({ ...prev, startDate: e.target.value }))}
                            />
                          </div>
                          <div className="form-group">
                            <label>{isRTL ? 'تاريخ النهاية' : 'End Date'}</label>
                            <input
                              type="date"
                              value={overrideForm.endDate}
                              onChange={(e) => setOverrideForm(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                          </div>
                          <div className="form-group">
                            <label>{isRTL ? 'وقت البداية' : 'Start Time'}</label>
                            <input
                              type="time"
                              value={overrideForm.startTime}
                              onChange={(e) => setOverrideForm(prev => ({ ...prev, startTime: e.target.value }))}
                            />
                          </div>
                          <div className="form-group">
                            <label>{isRTL ? 'وقت النهاية' : 'End Time'}</label>
                            <input
                              type="time"
                              value={overrideForm.endTime}
                              onChange={(e) => setOverrideForm(prev => ({ ...prev, endTime: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>{isRTL ? 'أيام العمل' : 'Working Days'}</label>
                          <div className="working-days-checkboxes" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                            {[
                              { value: 0, en: 'Sun', ar: 'أحد' },
                              { value: 1, en: 'Mon', ar: 'إثن' },
                              { value: 2, en: 'Tue', ar: 'ثلا' },
                              { value: 3, en: 'Wed', ar: 'أرب' },
                              { value: 4, en: 'Thu', ar: 'خمي' },
                              { value: 5, en: 'Fri', ar: 'جمع' },
                              { value: 6, en: 'Sat', ar: 'سبت' }
                            ].map(day => (
                              <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: overrideForm.workingDays.includes(day.value) ? 'var(--primary-color, #6366f1)' : 'var(--bg-secondary, #f1f5f9)', color: overrideForm.workingDays.includes(day.value) ? '#fff' : 'inherit', transition: 'all 0.2s' }}>
                                <input
                                  type="checkbox"
                                  checked={overrideForm.workingDays.includes(day.value)}
                                  onChange={(e) => {
                                    setOverrideForm(prev => ({
                                      ...prev,
                                      workingDays: e.target.checked
                                        ? [...prev.workingDays, day.value].sort()
                                        : prev.workingDays.filter(d => d !== day.value)
                                    }));
                                  }}
                                  style={{ display: 'none' }}
                                />
                                {isRTL ? day.ar : day.en}
                              </label>
                            ))}
                          </div>
                        </div>
                        <button
                          className="btn btn-primary"
                          onClick={handleCreateOverride}
                          disabled={savingOverride || !overrideForm.labelEn || !overrideForm.startDate || !overrideForm.endDate}
                          style={{ marginTop: '12px' }}
                        >
                          {savingOverride ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ فترة التجاوز' : 'Save Override')}
                        </button>
                      </div>
                    )}

                    {loadingOverrides ? (
                      <p style={{ color: 'var(--text-secondary)' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
                    ) : overrides.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{isRTL ? 'لا توجد فترات تجاوز' : 'No overrides configured'}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {overrides.map(ov => {
                          const today = new Date().toISOString().split('T')[0];
                          const isActiveNow = ov.isActive && ov.startDate <= today && ov.endDate >= today;
                          const isExpired = ov.endDate < today;
                          return (
                            <div key={ov.overrideId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-secondary, #f8fafc)', border: isActiveNow ? '2px solid var(--primary-color, #6366f1)' : '1px solid var(--border-color, #e2e8f0)' }}>
                              <div>
                                <strong style={{ fontSize: '14px' }}>{isRTL ? (ov.labelAr || ov.labelEn) : ov.labelEn}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>
                                  {ov.startDate} → {ov.endDate} | {ov.startTime} - {ov.endTime}
                                </div>
                                <span style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', background: isActiveNow ? '#dcfce7' : isExpired ? '#fee2e2' : '#fef9c3', color: isActiveNow ? '#166534' : isExpired ? '#991b1b' : '#854d0e' }}>
                                  {isActiveNow ? (isRTL ? 'نشط الآن' : 'Active Now') : isExpired ? (isRTL ? 'منتهي' : 'Expired') : !ov.isActive ? (isRTL ? 'محذوف' : 'Deleted') : (isRTL ? 'قادم' : 'Upcoming')}
                                </span>
                              </div>
                              {ov.isActive && (
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '4px 12px', fontSize: '12px' }}
                                  onClick={() => handleDeleteOverride(ov.overrideId)}
                                >
                                  {isRTL ? 'حذف' : 'Delete'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="settings-card">
                    <h3>{isRTL ? 'معلومات النظام' : 'System Information'}</h3>
                    <div className="system-info">
                      <div className="info-row">
                        <span>{isRTL ? 'الإصدار' : 'Version'}</span>
                        <span>1.0.0</span>
                      </div>
                      <div className="info-row">
                        <span>{isRTL ? 'آخر تحديث' : 'Last Update'}</span>
                        <span>{formatDate(new Date())}</span>
                      </div>
                      <div className="info-row">
                        <span>{isRTL ? 'الدعم الفني' : 'Support'}</span>
                        <span>support@fablabsahsa.com</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Availability Management */}
                <div className="settings-card full-width section-availability-card">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                    {isRTL ? 'إدارة توفر الأقسام' : 'Section Availability Management'}
                  </h3>
                  <p className="section-availability-desc">
                    {isRTL
                      ? 'يمكنك تعطيل الأقسام مؤقتاً (مثل للصيانة). المستخدمون يمكنهم اختيار القسم، لكن التواريخ المعطلة ستكون محظورة في التقويم.'
                      : 'You can temporarily deactivate sections (e.g., for maintenance). Users can still select the section, but the deactivated dates will be blocked on the calendar.'}
                  </p>

                  <div className="sections-availability-grid">
                    {[
                      { value: 'Electronics and Programming', labelEn: 'Electronics & Programming', labelAr: 'الإلكترونيات والبرمجة' },
                      { value: 'CNC Laser', labelEn: 'CNC Laser', labelAr: 'الليزر CNC' },
                      { value: 'CNC Wood', labelEn: 'CNC Wood', labelAr: 'الخشب CNC' },
                      { value: 'CNC Metal', labelEn: 'CNC Metal', labelAr: 'المعادن CNC' },
                      { value: '3D', labelEn: '3D Printing', labelAr: 'الطباعة ثلاثية الأبعاد' },
                      { value: 'Robotic and AI', labelEn: 'Robotics & AI', labelAr: 'الروبوتات والذكاء الاصطناعي' },
                      { value: "Kid's Club", labelEn: "Kid's Club", labelAr: 'نادي الأطفال' },
                      { value: 'Vinyl Cutting', labelEn: 'Vinyl Cutting', labelAr: 'قص الفينيل' },
                      { value: 'UV Printing and Sticker Making', labelEn: 'UV Printing & Stickers', labelAr: 'طباعة UV والملصقات' }
                    ].map(section => {
                      const status = getSectionStatus(section.value);
                      const hasDeactivations = status.hasDeactivations;
                      const deactivationPeriods = status.deactivationPeriods || [];

                      return (
                        <div
                          key={section.value}
                          className={`section-status-card ${hasDeactivations ? 'has-periods' : 'available'}`}
                        >
                          <div className="section-status-header">
                            <div className="section-info">
                              <div
                                className="section-color-dot"
                                style={{ backgroundColor: SECTION_COLORS[section.value] }}
                              />
                              <span className="section-name">
                                {isRTL ? section.labelAr : section.labelEn}
                              </span>
                            </div>
                            <span className={`status-indicator ${hasDeactivations ? 'inactive' : 'active'}`}>
                              {hasDeactivations
                                ? `${deactivationPeriods.length} ${isRTL ? 'فترات معطلة' : 'period(s)'}`
                                : (isRTL ? 'متاح' : 'Available')}
                            </span>
                          </div>

                          {/* Show all deactivation periods */}
                          {hasDeactivations && (
                            <div className="section-deactivation-periods">
                              {deactivationPeriods.map((period, index) => (
                                <div key={period.availabilityId} className="deactivation-period-item">
                                  <div className="period-header">
                                    <span className="period-number">#{index + 1}</span>
                                    <span className="period-dates">
                                      {new Date(period.startDate).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { calendar: 'gregory' })} - {new Date(period.endDate).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { calendar: 'gregory' })}
                                    </span>
                                  </div>
                                  <p className="period-reason">
                                    {isRTL ? period.reasonAr || period.reasonEn : period.reasonEn}
                                  </p>
                                  <button
                                    className="btn-reactivate-small"
                                    onClick={() => handleReactivateSection(period.availabilityId)}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="23 4 23 10 17 10"/>
                                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                    </svg>
                                    {isRTL ? 'إلغاء' : 'Remove'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Always show add deactivation button */}
                          <button
                            className="btn-add-deactivation"
                            onClick={() => openDeactivateModal(section.value)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="16"/>
                              <line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                            {isRTL ? 'إضافة فترة تعطيل' : 'Add Deactivation Period'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sidebar tab visibility — per-admin, localStorage-backed */}
                  <div className="settings-card" style={{ gridColumn: '1 / -1', border: '2px solid #6366f1', background: 'rgba(99,102,241,0.03)' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7"/>
                        <rect x="14" y="3" width="7" height="7"/>
                        <rect x="14" y="14" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                      </svg>
                      {isRTL ? 'إظهار / إخفاء التبويبات' : 'Tab Visibility'}
                    </h3>
                    <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
                      {isRTL
                        ? 'أخفِ التبويبات التي لا تحتاجها الآن دون حذف أي بيانات. يمكنك إعادتها في أي وقت. الإعدادات تبقى ظاهرة دائماً.'
                        : 'Hide tabs you don\'t need right now without deleting any data. You can bring them back any time. Settings always stays visible.'}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                      {menuItems.map(item => {
                        const isHidden = hiddenTabs.includes(item.id);
                        const isLocked = item.id === 'settings';
                        return (
                          <label
                            key={item.id}
                            title={isLocked ? (isRTL ? 'لا يمكن إخفاء الإعدادات' : 'Settings cannot be hidden') : ''}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 12px', borderRadius: 8,
                              border: `1.5px solid ${isHidden ? '#e2e8f0' : '#6366f1'}`,
                              background: isHidden ? '#f8fafc' : 'rgba(99,102,241,0.06)',
                              cursor: isLocked ? 'not-allowed' : 'pointer',
                              opacity: isLocked ? 0.55 : 1,
                              transition: 'all 0.15s'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              disabled={isLocked}
                              onChange={() => toggleTabVisibility(item.id)}
                              style={{ accentColor: '#6366f1', width: 18, height: 18, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                            />
                            <span style={{ fontWeight: 700, color: isHidden ? '#94a3b8' : '#1e293b', fontSize: 14 }}>
                              {isRTL ? item.labelAr : item.labelEn}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {hiddenTabs.length > 0 && (
                      <button
                        onClick={() => { setHiddenTabs([]); try { localStorage.removeItem('adminHiddenTabs'); } catch {} }}
                        style={{
                          marginTop: 14, padding: '9px 18px', borderRadius: 8,
                          border: '1.5px solid #6366f1', background: '#fff',
                          color: '#6366f1', fontWeight: 700, cursor: 'pointer', fontSize: 13
                        }}
                      >
                        {isRTL ? `إظهار الكل (${hiddenTabs.length} مخفية)` : `Show all (${hiddenTabs.length} hidden)`}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
        </div>
      </main>

      {/* Registration Detail Modal */}
      {showModal && selectedRegistration && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{isRTL ? 'تفاصيل التسجيل' : 'Registration Details'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>{isRTL ? 'رقم التسجيل' : 'Registration ID'}</label>
                  <span>{selectedRegistration.registrationId}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'رقم المستخدم' : 'User ID'}</label>
                  <span>{selectedRegistration.userId}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'الاسم' : 'Name'}</label>
                  <span>
                    {selectedRegistration.user?.firstName && selectedRegistration.user?.lastName
                      ? `${selectedRegistration.user.firstName} ${selectedRegistration.user.lastName}`
                      : selectedRegistration.user?.name || 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'نوع الطلب' : 'Application Type'}</label>
                  <span>{applicationTypeLabels[selectedRegistration.user?.applicationType] || selectedRegistration.user?.applicationType}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                  <span>{selectedRegistration.user?.email || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'رقم الهاتف' : 'Phone'}</label>
                  <span dir="ltr">{selectedRegistration.user?.phoneNumber || 'N/A'}</span>
                </div>
                {selectedRegistration.user?.nationalId && (
                  <div className="detail-item">
                    <label>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                    <span dir="ltr">{selectedRegistration.user.nationalId}</span>
                  </div>
                )}
                {selectedRegistration.user?.sex && (
                  <div className="detail-item">
                    <label>{isRTL ? 'الجنس' : 'Sex'}</label>
                    <span>{selectedRegistration.user.sex === 'Male' ? (isRTL ? 'ذكر' : 'Male') : (isRTL ? 'أنثى' : 'Female')}</span>
                  </div>
                )}
                {selectedRegistration.user?.nationality && (
                  <div className="detail-item">
                    <label>{isRTL ? 'الجنسية' : 'Nationality'}</label>
                    <span>{selectedRegistration.user.nationality}</span>
                  </div>
                )}
                {selectedRegistration.user?.currentJob && (
                  <div className="detail-item">
                    <label>{isRTL ? 'الوظيفة الحالية' : 'Current Job'}</label>
                    <span>{selectedRegistration.user.currentJob}</span>
                  </div>
                )}
                {selectedRegistration.user?.nationalAddress && (
                  <div className="detail-item full-width">
                    <label>{isRTL ? 'العنوان الوطني' : 'National Address'}</label>
                    <span>{selectedRegistration.user.nationalAddress}</span>
                  </div>
                )}
                {/* Entity specific fields */}
                {selectedRegistration.user?.applicationType === 'Entity' && selectedRegistration.user?.entityName && (
                  <div className="detail-item">
                    <label>{isRTL ? 'اسم الجهة' : 'Entity Name'}</label>
                    <span>{selectedRegistration.user.entityName}</span>
                  </div>
                )}
                {/* FABLAB Visit specific fields */}
                {selectedRegistration.user?.applicationType === 'FABLAB Visit' && (
                  <>
                    {selectedRegistration.user?.visitingEntity && (
                      <div className="detail-item">
                        <label>{isRTL ? 'الجهة الزائرة' : 'Visiting Entity'}</label>
                        <span>{selectedRegistration.user.visitingEntity}</span>
                      </div>
                    )}
                    {selectedRegistration.user?.personInCharge && (
                      <div className="detail-item">
                        <label>{isRTL ? 'المسؤول' : 'Person In Charge'}</label>
                        <span>{selectedRegistration.user.personInCharge}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="detail-item">
                  <label>{isRTL ? 'القسم' : 'Section'}</label>
                  <span>{sectionLabels[selectedRegistration.fablabSection] || selectedRegistration.fablabSection}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'الحالة' : 'Status'}</label>
                  <span className={`status-badge ${selectedRegistration.status}`}>
                    {statusLabels[selectedRegistration.status]}
                  </span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'التاريخ' : 'Date'}</label>
                  <span>{formatDate(selectedRegistration.appointmentDate || selectedRegistration.visitDate || selectedRegistration.startDate)}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'الوقت' : 'Time'}</label>
                  <span>{formatTimeAMPM(selectedRegistration.appointmentTime || selectedRegistration.visitStartTime || selectedRegistration.startTime) || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'المدة' : 'Duration'}</label>
                  <span>
                    {selectedRegistration.appointmentDuration
                      ? `${selectedRegistration.appointmentDuration} ${isRTL ? 'دقيقة' : 'minutes'}`
                      : (selectedRegistration.visitEndTime && selectedRegistration.visitStartTime)
                        ? `${formatTimeAMPM(selectedRegistration.visitStartTime)} - ${formatTimeAMPM(selectedRegistration.visitEndTime)}`
                        : (selectedRegistration.endTime && selectedRegistration.startTime)
                          ? `${formatTimeAMPM(selectedRegistration.startTime)} - ${formatTimeAMPM(selectedRegistration.endTime)}`
                          : 'N/A'
                    }
                  </span>
                </div>
                <div className="detail-item full-width">
                  <label>{isRTL ? 'الخدمات المطلوبة' : 'Required Services'}</label>
                  <span>{translateServices(selectedRegistration.requiredServices)}</span>
                </div>
                {/* Volunteer specific fields */}
                {selectedRegistration.user?.applicationType === 'Volunteer' && (
                  <>
                    {selectedRegistration.volunteerSection && (
                      <div className="detail-item">
                        <label>{isRTL ? 'مجال التطوع' : 'Volunteer Section'}</label>
                        <span>{selectedRegistration.volunteerSection}</span>
                      </div>
                    )}
                    {selectedRegistration.volunteerSkills && (
                      <div className="detail-item full-width">
                        <label>{isRTL ? 'المهارات والخبرات' : 'Skills & Experience'}</label>
                        <span>{selectedRegistration.volunteerSkills}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="detail-item full-width">
                  <label>{isRTL ? 'تفاصيل الخدمة' : 'Service Details'}</label>
                  <span>{selectedRegistration.serviceDetails || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-btn print-btn"
                onClick={() => handlePrintRegistration(selectedRegistration)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                {isRTL ? 'طباعة' : 'Print'}
              </button>
              {/* Show approve button if status is pending or rejected */}
              {(selectedRegistration.status === 'pending' || selectedRegistration.status === 'rejected') && (
                <button
                  className="modal-btn approve"
                  onClick={() => handleStatusChange(selectedRegistration.registrationId, 'approved')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {selectedRegistration.status === 'rejected'
                    ? (isRTL ? 'تغيير إلى مقبول' : 'Change to Approved')
                    : (isRTL ? 'قبول' : 'Approve')
                  }
                </button>
              )}
              {/* Show reject button if status is pending or approved */}
              {(selectedRegistration.status === 'pending' || selectedRegistration.status === 'approved') && (
                <button
                  className="modal-btn reject"
                  onClick={() => handleStatusChange(selectedRegistration.registrationId, 'rejected')}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  {selectedRegistration.status === 'approved'
                    ? (isRTL ? 'تغيير إلى مرفوض' : 'Change to Rejected')
                    : (isRTL ? 'رفض' : 'Reject')
                  }
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* User Profile Modal */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <motion.div
            className="modal-content user-profile-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{isRTL ? 'ملف المستخدم' : 'User Profile'}</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className={`filter-btn ${isEditingUser ? 'active' : ''}`}
                  onClick={() => {
                    if (isEditingUser) {
                      setUserEditForm(selectedUser);
                    }
                    setIsEditingUser(!isEditingUser);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {isEditingUser ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'تعديل' : 'Edit')}
                </button>
                <button
                  className="filter-btn"
                  onClick={() => handlePrintUserIDCard(selectedUser)}
                  title={isRTL ? 'طباعة البطاقة' : 'Print ID Card'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  {isRTL ? 'البطاقة' : 'ID Card'}
                </button>
                <button
                  className="filter-btn"
                  onClick={() => handlePrintTermsDocument(selectedUser)}
                  title={isRTL ? 'وثيقة الاستفادة' : 'Terms Document'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  {isRTL ? 'الوثيقة' : 'Terms'}
                </button>
                <button className="modal-close" onClick={() => setShowUserModal(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="modal-body">
              <div className="user-profile-header">
                <div className="user-profile-avatar">
                  {selectedUser.firstName?.charAt(0) || selectedUser.name?.charAt(0) || 'U'}
                </div>
                <div className="user-profile-info">
                  <h3>
                    {selectedUser.firstName && selectedUser.lastName
                      ? `${selectedUser.firstName} ${selectedUser.lastName}`
                      : selectedUser.name || 'N/A'}
                  </h3>
                  <p>{selectedUser.email}</p>
                  <span className="user-type-badge">{applicationTypeLabels[selectedUser.applicationType] || selectedUser.applicationType}</span>
                </div>
              </div>

              {isEditingUser ? (
                <div className="user-edit-form">
                  {/* Profile Picture Upload */}
                  <div className="form-group full-width profile-picture-upload">
                    <label>{isRTL ? 'الصورة الشخصية' : 'Profile Picture'}</label>
                    <div className="profile-upload-container">
                      <div className="profile-preview">
                        {userEditForm.profilePicture ? (
                          <img src={userEditForm.profilePicture} alt="Profile" />
                        ) : (
                          <div className="no-profile-pic">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="8" r="4"/>
                              <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="upload-actions">
                        <input
                          type="file"
                          id="user-profile-upload"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be less than 5MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setUserEditForm({ ...userEditForm, profilePicture: reader.result });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="upload-btn"
                          onClick={() => document.getElementById('user-profile-upload').click()}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          {isRTL ? 'رفع صورة' : 'Upload Photo'}
                        </button>
                        {userEditForm.profilePicture && (
                          <button
                            type="button"
                            className="remove-btn"
                            onClick={() => setUserEditForm({ ...userEditForm, profilePicture: '' })}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                            {isRTL ? 'إزالة' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{isRTL ? 'الاسم الأول' : 'First Name'}</label>
                    <input
                      type="text"
                      value={userEditForm.firstName || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, firstName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'اسم العائلة' : 'Last Name'}</label>
                    <input
                      type="text"
                      value={userEditForm.lastName || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, lastName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                    <input
                      type="email"
                      value={userEditForm.email || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'رقم الهاتف' : 'Phone Number'}</label>
                    <input
                      type="text"
                      value={userEditForm.phoneNumber || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, phoneNumber: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'الجنس' : 'Sex'}</label>
                    <select
                      value={userEditForm.sex || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, sex: e.target.value })}
                    >
                      <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                      <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                      <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'الجنسية' : 'Nationality'}</label>
                    <input
                      type="text"
                      value={userEditForm.nationality || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, nationality: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                    <input
                      type="text"
                      value={userEditForm.nationalId || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, nationalId: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>{isRTL ? 'الجهة التابع لها' : 'Organization'}</label>
                    <input
                      type="text"
                      value={userEditForm.currentJob || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, currentJob: e.target.value })}
                      placeholder={isRTL ? 'مدرسة/جامعة/شركة/إلخ' : 'School/University/Company/etc.'}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>{isRTL ? 'العنوان الوطني' : 'National Address'}</label>
                    <input
                      type="text"
                      value={userEditForm.nationalAddress || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, nationalAddress: e.target.value })}
                    />
                  </div>
                  <div className="user-edit-actions">
                    <button
                      className="modal-btn cancel"
                      onClick={() => {
                        setUserEditForm(selectedUser);
                        setIsEditingUser(false);
                      }}
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      className="modal-btn approve"
                      onClick={handleUpdateUser}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="user-details-grid">
                    <div className="detail-item">
                      <label>{isRTL ? 'رقم المستخدم' : 'User ID'}</label>
                      <span>{selectedUser.userId}</span>
                    </div>
                    <div className="detail-item">
                      <label>{isRTL ? 'رقم الهاتف' : 'Phone'}</label>
                      <span>{selectedUser.phoneNumber || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <label>{isRTL ? 'الجنس' : 'Sex'}</label>
                      <span>{getSexLabel(selectedUser.sex)}</span>
                    </div>
                    <div className="detail-item">
                      <label>{isRTL ? 'الجنسية' : 'Nationality'}</label>
                      <span>{selectedUser.nationality || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <label>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                      <span>{selectedUser.nationalId || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <label>{isRTL ? 'تاريخ التسجيل' : 'Registered'}</label>
                      <span>{formatDate(selectedUser.createdAt)}</span>
                    </div>
                  </div>

                  <div className="user-registrations-section">
                    <h4>{isRTL ? 'سجل التسجيلات' : 'Registration History'} ({userRegistrations.length})</h4>
                    <div className="user-registrations-list">
                      {userRegistrations.length > 0 ? (
                        userRegistrations.map((reg) => (
                          <div key={reg.registrationId} className="user-registration-item">
                            <div className="reg-item-header">
                              <span className="reg-item-id">{reg.registrationId}</span>
                              <span className={`status-badge ${reg.status}`}>{statusLabels[reg.status]}</span>
                            </div>
                            <div className="reg-item-details">
                              <span>{sectionLabels[reg.fablabSection] || reg.fablabSection}</span>
                              <span>{formatDate(reg.appointmentDate || reg.visitDate || reg.startDate)}</span>
                            </div>
                            <div className="reg-item-actions">
                              <button
                                className="action-btn view"
                                onClick={() => {
                                  // Include user data with registration for proper display
                                  setSelectedRegistration({ ...reg, user: selectedUser });
                                  setShowUserModal(false);
                                  setShowModal(true);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                              </button>
                              <button
                                className="action-btn print"
                                onClick={() => handlePrintRegistration({ ...reg, user: selectedUser })}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="6 9 6 2 18 2 18 9"/>
                                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                                  <rect x="6" y="14" width="12" height="8"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="empty-message">{isRTL ? 'لا توجد تسجيلات' : 'No registrations found'}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="modal-overlay" onClick={() => setShowEmployeeModal(false)}>
          <motion.div
            className="modal-content employee-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{selectedEmployee ? (isRTL ? 'تعديل موظف' : 'Edit Employee') : (isRTL ? 'إضافة موظف' : 'Add Employee')}</h2>
              <button className="modal-close" onClick={() => setShowEmployeeModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>{isRTL ? 'الاسم' : 'Name'}</label>
                <input
                  type="text"
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                  placeholder={isRTL ? 'أدخل اسم الموظف' : 'Enter employee name'}
                />
              </div>
              <div className="form-group">
                <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                  placeholder={isRTL ? 'أدخل البريد الإلكتروني' : 'Enter email'}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>{isRTL ? 'الأقسام التي يعمل بها' : 'Assigned Sections'}</span>
                  {(employeeForm.sections || []).length > 0 && (
                    <span style={{
                      padding: '2px 10px', borderRadius: 999,
                      fontSize: '0.72rem', fontWeight: 800,
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#fff', letterSpacing: 0.5
                    }}>
                      {(employeeForm.sections || []).length} {isRTL ? 'محدد' : 'selected'}
                    </span>
                  )}
                </label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 8,
                  padding: '10px',
                  background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 12
                }}>
                  {[
                    { value: 'Electronics and Programming', ar: 'الإلكترونيات والبرمجة', en: 'Electronics & Programming' },
                    { value: 'CNC Laser',                   ar: 'الليزر CNC',            en: 'CNC Laser' },
                    { value: 'CNC Wood',                    ar: 'الخشب CNC',             en: 'CNC Wood' },
                    { value: 'CNC Metal',                   ar: 'المعادن CNC',           en: 'CNC Metal' },
                    { value: '3D',                          ar: 'الطباعة ثلاثية الأبعاد', en: '3D Printing' },
                    { value: 'Robotic and AI',              ar: 'الروبوتات والذكاء الاصطناعي', en: 'Robotics & AI' },
                    { value: "Kid's Club",                  ar: 'نادي الأطفال',          en: "Kid's Club" },
                    { value: 'Vinyl Cutting',               ar: 'قطع الفينيل',            en: 'Vinyl Cutting' },
                    { value: 'UV Printing and Sticker Making', ar: 'طباعة UV والملصقات', en: 'UV Printing & Stickers' }
                  ].map(sec => {
                    const checked = (employeeForm.sections || []).includes(sec.value);
                    const color = SECTION_COLORS[sec.value] || '#64748b';
                    return (
                      <button
                        key={sec.value}
                        type="button"
                        onClick={() => {
                          const current = employeeForm.sections || [];
                          setEmployeeForm({
                            ...employeeForm,
                            sections: checked
                              ? current.filter(s => s !== sec.value)
                              : [...current, sec.value]
                          });
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px',
                          borderRadius: 999,
                          border: checked ? `2px solid ${color}` : '2px solid #e2e8f0',
                          background: checked ? color : '#fff',
                          color: checked ? '#fff' : '#334155',
                          fontFamily: 'inherit',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: checked ? `0 2px 6px ${color}55` : '0 1px 2px rgba(0,0,0,0.04)',
                          transform: checked ? 'translateY(-1px)' : 'none'
                        }}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: checked ? '#fff' : color,
                          boxShadow: checked ? 'none' : `0 0 0 2px ${color}22`
                        }} />
                        {isRTL ? sec.ar : sec.en}
                        {checked && <span style={{ fontSize: '0.9rem', marginInlineStart: 2 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#0ea5e9' }}>💡</span>
                  {isRTL
                    ? 'اضغط على القسم لإضافته أو إزالته. إذا كان البريد موجوداً مسبقاً، ستُضاف الأقسام الجديدة لسجل الموظف.'
                    : 'Tap a section to add/remove. If the email exists, new sections are merged into the existing employee.'}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowEmployeeModal(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="modal-btn approve"
                onClick={selectedEmployee ? handleUpdateEmployee : handleCreateEmployee}
                disabled={!employeeForm.name || !employeeForm.email || (employeeForm.sections || []).length === 0}
              >
                {selectedEmployee ? (isRTL ? 'تحديث' : 'Update') : (isRTL ? 'إضافة' : 'Add')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Status Change Modal (Approve/Reject with message) */}
      {showStatusModal && statusModalRegistration && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <motion.div
            className="modal-content status-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {isStatusChange
                  ? (statusModalAction === 'approve'
                      ? (isRTL ? 'تغيير الحالة إلى مقبول' : 'Change Status to Approved')
                      : (isRTL ? 'تغيير الحالة إلى مرفوض' : 'Change Status to Rejected'))
                  : (statusModalAction === 'approve'
                      ? (isRTL ? 'قبول الطلب' : 'Approve Registration')
                      : (isRTL ? 'رفض الطلب' : 'Reject Registration'))
                }
              </h2>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {/* Status Change Notice */}
              {isStatusChange && (
                <div className="status-change-notice" style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span style={{ color: '#92400e', fontSize: '14px' }}>
                    {isRTL
                      ? `الحالة الحالية: ${statusModalRegistration.status === 'approved' ? 'مقبول' : 'مرفوض'}`
                      : `Current status: ${statusModalRegistration.status}`
                    }
                  </span>
                </div>
              )}

              {/* Registration Info Summary */}
              <div className="status-modal-info">
                <div className="info-item">
                  <span className="info-label">{isRTL ? 'رقم التسجيل:' : 'Registration ID:'}</span>
                  <span className="info-value">{statusModalRegistration.registrationId}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">{isRTL ? 'الاسم:' : 'Name:'}</span>
                  <span className="info-value">
                    {statusModalRegistration.user?.firstName && statusModalRegistration.user?.lastName
                      ? `${statusModalRegistration.user.firstName} ${statusModalRegistration.user.lastName}`
                      : statusModalRegistration.user?.name || 'N/A'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">{isRTL ? 'الموعد:' : 'Appointment:'}</span>
                  <span className="info-value">
                    {formatDate(statusModalRegistration.appointmentDate || statusModalRegistration.visitDate)} - {formatTimeAMPM(statusModalRegistration.appointmentTime || statusModalRegistration.visitStartTime) || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Reason for Status Change (Optional, shown only for status changes) */}
              {isStatusChange && (
                <div className="form-group">
                  <label>{isRTL ? 'سبب تغيير الحالة (اختياري)' : 'Reason for Status Change (Optional)'}</label>
                  <textarea
                    value={statusChangeReason}
                    onChange={(e) => setStatusChangeReason(e.target.value)}
                    placeholder={isRTL ? 'أدخل سبب تغيير حالة الطلب...' : 'Enter the reason for changing the status...'}
                    rows={2}
                    className="form-textarea"
                  />
                  <small className="form-hint">
                    {isRTL ? 'سيتم إرسال هذا السبب للمستخدم في البريد الإلكتروني' : 'This will be sent to the user in the email notification'}
                  </small>
                </div>
              )}

              {/* Rejection Reason (Required for rejection) */}
              {statusModalAction === 'reject' && (
                <div className="form-group">
                  <label>
                    {isRTL ? 'سبب الرفض' : 'Rejection Reason'} <span className="required">*</span>
                  </label>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '10px'
                  }}>
                    {PREDEFINED_REJECTION_REASONS.map((reason, index) => {
                      const reasonText = isRTL ? reason.ar : reason.en;
                      const isActive = rejectionReason === reasonText;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setRejectionReason(reasonText)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: isActive ? '2px solid #EE2329' : '1px solid #d1d5db',
                            background: isActive ? '#fef2f2' : '#f9fafb',
                            color: isActive ? '#EE2329' : '#4b5563',
                            fontSize: '13px',
                            cursor: 'pointer',
                            fontWeight: isActive ? '600' : '400',
                            transition: 'all 0.2s ease',
                            direction: isRTL ? 'rtl' : 'ltr'
                          }}
                        >
                          {reasonText}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={isRTL ? 'أدخل سبب رفض الطلب...' : 'Enter the reason for rejection...'}
                    rows={3}
                    className="form-textarea"
                  />
                  <small className="form-hint">
                    {isRTL ? 'سيتم إرسال هذا السبب للمستخدم في رسالة الرفض' : 'This will be sent to the user in the rejection email'}
                  </small>
                </div>
              )}

              {/* Admin Message (Optional) */}
              <div className="form-group">
                <label>{isRTL ? 'رسالة إضافية (اختياري)' : 'Additional Message (Optional)'}</label>
                <textarea
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  placeholder={isRTL ? 'أدخل رسالة للمستخدم...' : 'Enter a message for the user...'}
                  rows={3}
                  className="form-textarea"
                />
              </div>

              {/* Send Message in Email Checkbox */}
              {statusMessage && (
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={sendMessageInEmail}
                      onChange={(e) => setSendMessageInEmail(e.target.checked)}
                    />
                    <span className="checkbox-text">
                      {isRTL ? 'إرسال هذه الرسالة في البريد الإلكتروني' : 'Include this message in the email'}
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowStatusModal(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              {/* WhatsApp Button */}
              <button
                className="modal-btn whatsapp"
                onClick={() => {
                  const userName = statusModalRegistration.user?.firstName && statusModalRegistration.user?.lastName
                    ? `${statusModalRegistration.user.firstName} ${statusModalRegistration.user.lastName}`
                    : statusModalRegistration.user?.name || 'User';
                  const phone = statusModalRegistration.user?.phoneNumber;
                  const userId = statusModalRegistration.user?.uniqueId || statusModalRegistration.userId;
                  const appointmentDate = formatDate(statusModalRegistration.appointmentDate || statusModalRegistration.visitDate);
                  const appointmentTime = formatTimeAMPM(statusModalRegistration.appointmentTime || statusModalRegistration.visitStartTime);
                  const applicationType = statusModalRegistration.user?.applicationType;
                  const services = statusModalRegistration.requiredServices;

                  if (!phone) {
                    toast.error(isRTL ? 'رقم الهاتف غير متوفر' : 'Phone number not available');
                    return;
                  }

                  let message;
                  if (statusModalAction === 'approve') {
                    message = getApprovalMessage(
                      userName,
                      statusModalRegistration.registrationId,
                      userId,
                      appointmentDate,
                      appointmentTime,
                      statusModalRegistration.fablabSection,
                      applicationType,
                      services,
                      sendMessageInEmail ? statusMessage : null,
                      isRTL
                    );
                  } else {
                    message = getRejectionMessage(
                      userName,
                      statusModalRegistration.registrationId,
                      userId,
                      applicationType,
                      services,
                      rejectionReason,
                      sendMessageInEmail ? statusMessage : null,
                      isRTL
                    );
                  }

                  openWhatsApp(phone, message);
                }}
                title={isRTL ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {isRTL ? 'واتساب' : 'WhatsApp'}
              </button>
              <button
                className={`modal-btn ${statusModalAction === 'approve' ? 'approve' : 'reject'}`}
                onClick={handleStatusSubmit}
                disabled={statusModalAction === 'reject' && !rejectionReason.trim()}
              >
                {statusModalAction === 'approve'
                  ? (isRTL ? 'قبول الطلب' : 'Approve')
                  : (isRTL ? 'رفض الطلب' : 'Reject')
                }
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '550px' }}
          >
            <div className="modal-header">
              <h2>{isRTL ? 'إرسال بريد إلكتروني' : 'Send Email'}</h2>
              <button className="modal-close" onClick={() => setShowEmailModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span style={{ color: '#1e40af', fontSize: '14px' }}>
                  {isRTL
                    ? `سيتم الإرسال إلى ${selectedUsers.size} مستخدم`
                    : `Will be sent to ${selectedUsers.size} user(s)`}
                </span>
              </div>

              <div className="form-group">
                <label>{isRTL ? 'العنوان' : 'Subject'} <span className="required">*</span></label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={isRTL ? 'عنوان الرسالة...' : 'Email subject...'}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                />
              </div>

              <div className="form-group">
                <label>{isRTL ? 'الرسالة' : 'Message'} <span className="required">*</span></label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  placeholder={isRTL ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                  rows={6}
                  className="form-textarea"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowEmailModal(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="modal-btn approve"
                onClick={handleSendEmailToUsers}
                disabled={isSendingEmail || !emailSubject.trim() || !emailMessage.trim()}
                style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
              >
                {isSendingEmail ? (
                  <>
                    <div className="loading-spinner" style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                    {isRTL ? 'جاري الإرسال...' : 'Sending...'}
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    {isRTL ? 'إرسال' : 'Send'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Section Deactivation Modal */}
      {showSectionModal && (
        <div className="modal-overlay" onClick={() => setShowSectionModal(false)}>
          <motion.div
            className="modal-content section-modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header section-deactivate-header">
              <div className="modal-header-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <div className="modal-header-text">
                <h2>{isRTL ? 'تعطيل القسم' : 'Deactivate Section'}</h2>
                <p>{isRTL ? 'تحديد فترة التعطيل والسبب' : 'Set deactivation period and reason'}</p>
              </div>
              <button className="modal-close" onClick={() => setShowSectionModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  {isRTL ? 'القسم' : 'Section'}
                </label>
                <input
                  type="text"
                  value={sectionForm.section}
                  disabled
                  className="disabled-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {isRTL ? 'تاريخ البدء' : 'Start Date'} <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    value={sectionForm.startDate}
                    onChange={(e) => setSectionForm({ ...sectionForm, startDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {isRTL ? 'تاريخ الانتهاء' : 'End Date'} <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    value={sectionForm.endDate}
                    onChange={(e) => setSectionForm({ ...sectionForm, endDate: e.target.value })}
                    min={sectionForm.startDate || new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {isRTL ? 'السبب (بالإنجليزية)' : 'Reason (English)'} <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={sectionForm.reasonEn}
                  onChange={(e) => setSectionForm({ ...sectionForm, reasonEn: e.target.value })}
                  placeholder={isRTL ? 'مثال: Under maintenance' : 'e.g., Under maintenance'}
                />
              </div>

              <div className="form-group">
                <label>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {isRTL ? 'السبب (بالعربية)' : 'Reason (Arabic)'}
                </label>
                <input
                  type="text"
                  value={sectionForm.reasonAr}
                  onChange={(e) => setSectionForm({ ...sectionForm, reasonAr: e.target.value })}
                  placeholder={isRTL ? 'مثال: تحت الصيانة' : 'e.g., تحت الصيانة'}
                  dir="rtl"
                />
              </div>

              <div className="info-note">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>
                  {isRTL
                    ? 'سيتم إعادة تفعيل القسم تلقائياً بعد انتهاء فترة التعطيل، أو يمكنك إعادة تفعيله يدوياً في أي وقت.'
                    : 'The section will be automatically reactivated after the deactivation period ends, or you can manually reactivate it at any time.'}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowSectionModal(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="modal-btn deactivate"
                onClick={handleDeactivateSection}
                disabled={!sectionForm.startDate || !sectionForm.endDate || !sectionForm.reasonEn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
                {isRTL ? 'تعطيل القسم' : 'Deactivate Section'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Universal attendance kiosk — opened from the Attendance
          Station tab. Stays mounted so URL-hash persistence keeps
          working across refreshes even if the tab is changed. */}
      <UnifiedAttendancePage
        open={attendanceKioskOpen}
        onClose={() => setAttendanceKioskOpen(false)}
        isRTL={isRTL}
      />
    </div>
  );
};

export default AdminDashboard;
