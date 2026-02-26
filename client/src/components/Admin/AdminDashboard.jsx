import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const SECTION_COLORS = {
  'Electronics and Programming': '#6366f1',
  'CNC Laser': '#22c55e',
  'CNC Wood': '#f59e0b',
  '3D': '#ef4444',
  'Robotic and AI': '#8b5cf6',
  "Kid's Club": '#06b6d4',
  'Vinyl Cutting': '#ec4899'
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const printRef = useRef();

  // Valid tabs for URL persistence
  const validTabs = ['dashboard', 'registrations', 'users', 'employees', 'schedule', 'analytics', 'borrowing', 'education', 'settings'];

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
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', section: '' });
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userEditForm, setUserEditForm] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month');
  const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all' or employee section
  const [theme, setTheme] = useState(() => localStorage.getItem('adminTheme') || 'light');

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
  }, [activeTab]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const newTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'dashboard';
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
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
      toast.error(isRTL ? 'خطأ في تحديث بيانات المستخدم' : 'Error updating user');
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
    } else if (activeTab === 'borrowing') {
      fetchBorrowings();
    } else if (activeTab === 'education') {
      fetchEducations();
    }
  }, [activeTab, fetchRegistrations, analyticsPeriod, analyticsDateRange.startDate, analyticsDateRange.endDate]);

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
          @media print { body { padding: 0; } .page { min-height: auto; } }
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
        '3D': isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing',
        'Robotic and AI': isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI',
        "Kid's Club": isRTL ? 'نادي الأطفال' : "Kid's Club",
        'Vinyl Cutting': isRTL ? 'قطع الفينيل' : 'Vinyl Cutting'
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
          <p>${isRTL ? 'تم الطباعة في' : 'Printed on'}: ${new Date().toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</p>
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

    // Get sex label
    const getSexLabelForCard = () => {
      const sex = (user.sex || '').toLowerCase();
      if (sex === 'male') return isRTL ? 'ذكر' : 'Male';
      if (sex === 'female') return isRTL ? 'أنثى' : 'Female';
      return isRTL ? 'غير محدد' : 'N/A';
    };

    const na = isRTL ? 'غير محدد' : 'N/A';

    const idCardContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'بطاقة تعريف المستخدم' : 'User ID Card'}</title>
        <style>
          @page {
            size: 53.98mm 100mm;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            background: #f0f0f0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
          }
          .id-card-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .card-holder-area {
            width: 53.98mm;
            height: 15mm;
            background: #f8f9fa;
            border: 2px dashed #ccc;
            border-bottom: none;
            border-radius: 10px 10px 0 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2mm;
          }
          .punch-hole {
            width: 8mm;
            height: 8mm;
            border: 2px dashed #999;
            border-radius: 50%;
            background: white;
          }
          .cut-line-text {
            font-size: 7px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .id-card {
            width: 53.98mm;
            height: 85.6mm;
            background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 0 0 10px 10px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            position: relative;
            display: flex;
            flex-direction: column;
          }
          .card-header {
            background: linear-gradient(135deg, #e02529 0%, #c41e24 100%);
            padding: 10px 8px;
            text-align: center;
          }
          .card-title {
            color: white;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .card-subtitle {
            color: rgba(255,255,255,0.85);
            font-size: 8px;
            margin-top: 2px;
          }
          .card-body {
            flex: 1;
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .user-photo {
            width: 70px;
            height: 85px;
            background: linear-gradient(135deg, #e8e8e8, #d0d0d0);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e02529;
            font-size: 32px;
            font-weight: bold;
            border: 3px solid #e02529;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
            overflow: hidden;
          }
          .user-photo img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .user-photo .initials {
            font-size: 32px;
            font-weight: bold;
            color: #e02529;
          }
          .user-name {
            font-size: 13px;
            font-weight: 700;
            color: #1a1a2e;
            text-align: center;
            line-height: 1.2;
          }
          .user-type-badge {
            display: inline-block;
            background: linear-gradient(135deg, #e02529, #c41e24);
            color: white;
            font-size: 9px;
            padding: 3px 12px;
            border-radius: 12px;
            font-weight: 600;
          }
          .info-section {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 6px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            padding: 3px 0;
            border-bottom: 1px dotted #ddd;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #555;
          }
          .info-value {
            color: #1a1a2e;
            font-weight: 500;
            text-align: ${isRTL ? 'left' : 'right'};
            max-width: 55%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .card-footer {
            background: #ffffff;
            padding: 8px 6px;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            border-top: 1px solid #e0e0e0;
          }
          .card-footer .logo {
            height: 24px;
            width: auto;
            flex-shrink: 0;
          }
          .card-footer .logo-left {
            order: 1;
          }
          .card-footer .logo-right {
            order: 3;
          }
          .member-id-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1px;
            order: 2;
            flex: 1;
            text-align: center;
          }
          .member-id-label {
            font-size: 6px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .member-id-value {
            font-size: 11px;
            font-weight: 700;
            color: #e02529;
            font-family: 'Consolas', 'Courier New', monospace;
          }
          .decorative-stripe {
            position: absolute;
            top: 40%;
            ${isRTL ? 'right' : 'left'}: 0;
            width: 3px;
            height: 25%;
            background: linear-gradient(to bottom, transparent, #e02529, transparent);
          }
          @media print {
            body {
              background: none;
              padding: 0;
              min-height: auto;
            }
            .id-card-wrapper {
              box-shadow: none;
              margin: 0;
            }
            .card-holder-area {
              border: 2px dashed #ccc;
              border-bottom: none;
            }
            .punch-hole {
              border: 2px dashed #999;
            }
          }
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
              <div class="card-title">${isRTL ? 'بطاقة عضوية فاب لاب الأحساء' : 'FABLAB Al-Ahsa Member Card'}</div>
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

    const today = new Date().toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
            margin: 12mm;
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
            line-height: 1.5;
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
            padding-bottom: 12px;
            border-bottom: 3px solid #e02529;
            margin-bottom: 16px;
          }
          .header .logo {
            height: 55px;
            width: auto;
          }
          .header-center {
            text-align: center;
            flex: 1;
            padding: 0 15px;
          }
          .document-title {
            font-size: 20px;
            font-weight: 700;
            color: #e02529;
            margin-bottom: 4px;
          }
          .document-subtitle {
            font-size: 13px;
            color: #666;
          }
          .user-info-section {
            background: #f8f9fa;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 16px;
            border-${isRTL ? 'right' : 'left'}: 4px solid #e02529;
          }
          .user-info-title {
            font-size: 14px;
            font-weight: 600;
            color: #e02529;
            margin-bottom: 10px;
          }
          .user-info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px 20px;
          }
          .user-info-item {
            display: flex;
            gap: 8px;
            font-size: 13px;
          }
          .user-info-label {
            font-weight: 600;
            color: #555;
          }
          .user-info-value {
            color: #333;
          }
          .terms-section {
            margin-bottom: 14px;
          }
          .terms-title {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a2e;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid #e9ecef;
          }
          .terms-intro {
            font-size: 13px;
            color: #444;
            margin-bottom: 12px;
            line-height: 1.6;
          }
          .terms-list {
            list-style: none;
            counter-reset: terms-counter;
            display: grid;
            gap: 8px;
          }
          .terms-list li {
            counter-increment: terms-counter;
            padding: 10px 12px;
            background: #fafafa;
            border-radius: 5px;
            border-${isRTL ? 'right' : 'left'}: 4px solid #e02529;
            font-size: 13px;
            line-height: 1.5;
            position: relative;
            padding-${isRTL ? 'right' : 'left'}: 36px;
          }
          .terms-list li::before {
            content: counter(terms-counter);
            position: absolute;
            ${isRTL ? 'right' : 'left'}: 8px;
            top: 50%;
            transform: translateY(-50%);
            width: 22px;
            height: 22px;
            background: linear-gradient(135deg, #e02529, #c41e24);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
          }
          .agreement-section {
            background: #fff8f8;
            border: 2px solid #e02529;
            border-radius: 6px;
            padding: 14px 16px;
            margin-bottom: 14px;
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
          .signature-section {
            padding-top: 14px;
            border-top: 2px dashed #ddd;
          }
          .signature-date {
            text-align: center;
            margin-bottom: 14px;
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
            padding: 14px;
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
            margin-bottom: 25px;
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
            margin-top: 14px;
            padding-top: 10px;
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
          }
        </style>
      </head>
      <body>
        <div class="document">
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
      setEmployeeForm({ name: '', email: '', section: '' });
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
      setEmployeeForm({ name: '', email: '', section: '' });
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
    } catch (error) {
      console.error('Error fetching education detail:', error);
    }
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

  const getEducationStatusColor = (status) => {
    const colors = { pending: '#f59e0b', approved: '#22c55e', active: '#3b82f6', completed: '#6366f1', rejected: '#ef4444' };
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
    return new Date(dateString).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
    return schedule.filter(event => {
      if (!event.date) return false;
      const sameDay = isSameDay(parseISO(event.date), day);
      if (!sameDay) return false;
      // Filter by section if a specific employee is selected
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
    '3D': isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing',
    'Robotic and AI': isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI',
    "Kid's Club": isRTL ? 'نادي الأطفال' : "Kid's Club",
    'Vinyl Cutting': isRTL ? 'قطع الفينيل' : 'Vinyl Cutting'
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

  const sexLabels = {
    'male': isRTL ? 'ذكر' : 'Male',
    'female': isRTL ? 'أنثى' : 'Female',
    'Male': isRTL ? 'ذكر' : 'Male',
    'Female': isRTL ? 'أنثى' : 'Female'
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
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
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
          <AnimatePresence mode="wait">
            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
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
                exit={{ opacity: 0, y: -20 }}
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
                    <option value="3D">{isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing'}</option>
                    <option value="Robotic and AI">{isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI'}</option>
                    <option value="Kid's Club">{isRTL ? 'نادي الأطفال' : "Kid's Club"}</option>
                    <option value="Vinyl Cutting">{isRTL ? 'قطع الفينيل' : 'Vinyl Cutting'}</option>
                  </select>

                  <select
                    value={filters.sex}
                    onChange={(e) => setFilters({ ...filters, sex: e.target.value })}
                    className="filter-select"
                  >
                    <option value="">{isRTL ? 'كل الجنس' : 'All Genders'}</option>
                    <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                    <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
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
                exit={{ opacity: 0, y: -20 }}
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
                exit={{ opacity: 0, y: -20 }}
                className="analytics-content"
              >
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
            {activeTab === 'schedule' && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="schedule-content"
              >
                <div className="schedule-layout-new">
                  {/* Calendar Section */}
                  <div className="calendar-section">
                    {scheduleFilter !== 'all' && (
                      <div className="current-schedule-header">
                        <h2>
                          {employees.find(e => e.section === scheduleFilter)?.name || scheduleFilter}
                          <span className="section-badge" style={{ backgroundColor: SECTION_COLORS[scheduleFilter] }}>
                            {sectionLabels[scheduleFilter] || scheduleFilter}
                          </span>
                        </h2>
                        <p className="schedule-email">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          {employees.find(e => e.section === scheduleFilter)?.email || 'No email'}
                        </p>
                      </div>
                    )}
                    <div className="calendar-header">
                      <button
                        className="calendar-nav"
                        onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                      </button>
                      <h3>
                        {format(selectedDate, 'MMMM yyyy', { locale: isRTL ? ar : enUS })}
                      </h3>
                      <button
                        className="calendar-nav"
                        onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    </div>

                    <div className="calendar-grid">
                      <div className="calendar-weekdays">
                        {(isRTL
                          ? ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت']
                          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                        ).map(day => (
                          <div key={day} className="weekday">{day}</div>
                        ))}
                      </div>
                      <div className="calendar-days">
                        {Array.from({ length: startOfMonth(selectedDate).getDay() }).map((_, i) => (
                          <div key={`empty-${i}`} className="calendar-day empty" />
                        ))}
                        {getDaysInMonth(selectedDate).map((day) => {
                          const events = getEventsForDay(day);
                          const isToday = isSameDay(day, new Date());
                          const isSelected = selectedCalendarDay && isSameDay(day, selectedCalendarDay);
                          return (
                            <div
                              key={day.toISOString()}
                              className={`calendar-day ${isToday ? 'today' : ''} ${events.length > 0 ? 'has-events' : ''} ${isSelected ? 'selected' : ''}`}
                              onClick={() => events.length > 0 && setSelectedCalendarDay(day)}
                              style={{ cursor: events.length > 0 ? 'pointer' : 'default' }}
                            >
                              <span className="day-number">{format(day, 'd')}</span>
                              {events.length > 0 && (
                                <div className="event-dots">
                                  {events.slice(0, 3).map((event, i) => (
                                    <span
                                      key={i}
                                      className={event.type === 'task' ? 'task-dot' : 'event-dot'}
                                      style={{
                                        backgroundColor: event.type === 'task'
                                          ? PRIORITY_COLORS[event.priority] || '#f59e0b'
                                          : SECTION_COLORS[event.section] || '#6366f1',
                                        borderRadius: event.type === 'task' ? '2px' : '50%'
                                      }}
                                    />
                                  ))}
                                  {events.length > 3 && <span className="more-events">+{events.length - 3}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right Sidebar */}
                  <div className="schedule-sidebar">
                    {/* Employees Section */}
                    <div className="employees-section">
                      <div className="section-header">
                        <h3>{isRTL ? 'الموظفين' : 'Employees'}</h3>
                        <button
                          className="add-btn"
                          onClick={() => {
                            setSelectedEmployee(null);
                            setEmployeeForm({ name: '', email: '', section: '' });
                            setShowEmployeeModal(true);
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </button>
                      </div>

                      {/* All Schedules Button */}
                      <button
                        className={`all-schedules-btn ${scheduleFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setScheduleFilter('all')}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        {isRTL ? 'جميع المواعيد' : 'All Schedules'}
                      </button>

                      <div className="employees-grid">
                        {employees.map((emp) => (
                          <div
                            key={emp.employeeId}
                            className={`employee-card ${scheduleFilter === emp.section ? 'active' : ''}`}
                            onClick={() => setScheduleFilter(emp.section)}
                          >
                            <div className="employee-card-avatar" style={{ backgroundColor: SECTION_COLORS[emp.section] || '#6366f1' }}>
                              {emp.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="employee-card-name">{emp.name}</span>
                            <div className="employee-card-actions">
                              <button
                                className="edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEmployee(emp);
                                  setEmployeeForm({ name: emp.name, email: emp.email, section: emp.section });
                                  setShowEmployeeModal(true);
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button
                                className="delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEmployee(emp.employeeId);
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        {employees.length === 0 && (
                          <p className="empty-message">{isRTL ? 'لا يوجد موظفين' : 'No employees yet'}</p>
                        )}
                      </div>
                    </div>

                    {/* Add Task Section */}
                    <div className="add-task-section">
                      <div className="section-header">
                        <h3>{isRTL ? 'إضافة مهمة' : 'Add Task'}</h3>
                      </div>
                      <form onSubmit={handleCreateEmployeeTask} className="employee-task-form">
                        <div className="form-group">
                          <label>{isRTL ? 'الموظف' : 'Employee'} *</label>
                          <select
                            value={employeeTaskForm.employeeId}
                            onChange={(e) => setEmployeeTaskForm({ ...employeeTaskForm, employeeId: e.target.value })}
                            required
                          >
                            <option value="">{isRTL ? 'اختر الموظف' : 'Select Employee'}</option>
                            {employees.map((emp) => (
                              <option key={emp.employeeId} value={emp.employeeId}>
                                {emp.name} - {sectionLabels[emp.section] || emp.section}
                              </option>
                            ))}
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
                            className={`all-day-btn ${employeeTaskForm.dueTime === '11:00' && employeeTaskForm.dueTimeEnd === '20:00' ? 'active' : ''}`}
                            onClick={() => setEmployeeTaskForm({
                              ...employeeTaskForm,
                              dueTime: '11:00',
                              dueTimeEnd: '20:00'
                            })}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                          <p className="warning-hint">
                            {isRTL ? 'يجب تحديد وقت البداية والنهاية لحجز الموعد' : 'Start and end time required to block calendar'}
                          </p>
                        )}

                        <button
                          type="submit"
                          className="submit-task-btn"
                          disabled={isSubmittingTask}
                        >
                          {isSubmittingTask
                            ? (isRTL ? 'جاري الإضافة...' : 'Adding...')
                            : (isRTL ? 'إضافة المهمة' : 'Add Task')}
                        </button>
                      </form>
                    </div>

                    {/* Selected Day Appointments Section */}
                    {selectedCalendarDay && (
                      <div className="selected-day-section">
                        <div className="selected-day-header">
                          <h3>
                            {format(selectedCalendarDay, isRTL ? 'dd MMMM yyyy' : 'MMMM dd, yyyy', { locale: isRTL ? ar : enUS })}
                          </h3>
                          <button
                            className="close-selected-day"
                            onClick={() => setSelectedCalendarDay(null)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"/>
                              <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                        <div className="selected-day-appointments">
                          {getEventsForDay(selectedCalendarDay).map((apt) => (
                            <div key={apt.id} className={`detailed-appointment-item ${apt.type === 'task' ? 'task-item' : ''}`}>
                              <div
                                className="detailed-appointment-header"
                                style={{
                                  borderLeftColor: apt.type === 'task'
                                    ? PRIORITY_COLORS[apt.priority] || '#f59e0b'
                                    : SECTION_COLORS[apt.section] || '#6366f1'
                                }}
                              >
                                <span className="detailed-appointment-name">
                                  {apt.type === 'task' && (
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: '600',
                                      marginRight: '6px',
                                      background: apt.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' :
                                                 apt.priority === 'medium' ? 'rgba(245, 158, 11, 0.15)' :
                                                 'rgba(34, 197, 94, 0.15)',
                                      color: PRIORITY_COLORS[apt.priority]
                                    }}>
                                      {isRTL ? 'مهمة' : 'TASK'}
                                    </span>
                                  )}
                                  {apt.title}
                                </span>
                                <span className="detailed-appointment-time">
                                  {formatTimeAMPM(apt.startTime)}{apt.endTime && ` - ${formatTimeAMPM(apt.endTime)}`}
                                  {apt.duration && ` (${apt.duration} ${isRTL ? 'دقيقة' : 'min'})`}
                                </span>
                              </div>
                              <div className="detailed-appointment-body">
                                <div className="apt-detail-row">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="3" y1="10" x2="21" y2="10"/>
                                  </svg>
                                  <span>{sectionLabels[apt.section] || apt.section}</span>
                                </div>
                                {apt.type === 'task' && apt.assignee && (
                                  <div className="apt-detail-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                      <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                    <span>{isRTL ? 'مسند إلى: ' : 'Assigned to: '}{apt.assignee}</span>
                                  </div>
                                )}
                                {apt.type === 'task' && (
                                  <div className="apt-detail-row task-status-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M9 11l3 3L22 4"/>
                                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                                    </svg>
                                    <select
                                      className="task-status-select"
                                      value={apt.status || 'pending'}
                                      onChange={(e) => handleUpdateTaskStatus(apt.id, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: '500',
                                        border: 'none',
                                        cursor: 'pointer',
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
                                  </div>
                                )}
                                {apt.type === 'task' && apt.description && (
                                  <div className="apt-detail-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="17" y1="10" x2="3" y2="10"/>
                                      <line x1="21" y1="6" x2="3" y2="6"/>
                                      <line x1="21" y1="14" x2="3" y2="14"/>
                                      <line x1="17" y1="18" x2="3" y2="18"/>
                                    </svg>
                                    <span>{apt.description}</span>
                                  </div>
                                )}
                                {apt.phone && (
                                  <div className="apt-detail-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                    </svg>
                                    <span dir="ltr">{apt.phone}</span>
                                  </div>
                                )}
                                {apt.email && (
                                  <div className="apt-detail-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                      <polyline points="22,6 12,13 2,6"/>
                                    </svg>
                                    <span>{apt.email}</span>
                                  </div>
                                )}
                                {apt.services && apt.services.length > 0 && (
                                  <div className="apt-detail-row services-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                                    </svg>
                                    <span>{translateServices(apt.services)}</span>
                                  </div>
                                )}
                                {apt.applicationType && (
                                  <div className="apt-detail-row">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                      <circle cx="12" cy="7" r="4"/>
                                    </svg>
                                    <span>{applicationTypeLabels[apt.applicationType] || apt.applicationType}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Appointments Section */}
                    <div className="appointments-section">
                      <h3>
                        {scheduleFilter === 'all'
                          ? (isRTL ? 'المواعيد القادمة' : 'Upcoming Appointments')
                          : (isRTL ? `مواعيد ${employees.find(e => e.section === scheduleFilter)?.name || ''}` : `${employees.find(e => e.section === scheduleFilter)?.name || ''}'s Appointments`)
                        }
                      </h3>
                      <div className="appointments-list">
                        {getFilteredSchedule().slice(0, 8).map((apt) => (
                          <div key={apt.id} className="appointment-item-detailed">
                            <div
                              className="appointment-color"
                              style={{ backgroundColor: SECTION_COLORS[apt.section] || '#6366f1' }}
                            />
                            <div className="appointment-info">
                              <span className="appointment-title">{apt.title}</span>
                              <span className="appointment-datetime">
                                {apt.date && formatDate(apt.date)} {apt.startTime && `• ${formatTimeAMPM(apt.startTime)}`}
                                {apt.endTime && ` - ${formatTimeAMPM(apt.endTime)}`}
                                {apt.duration && ` (${apt.duration} ${isRTL ? 'دقيقة' : 'min'})`}
                              </span>
                              <span className="appointment-section">{sectionLabels[apt.section] || apt.section}</span>
                              {apt.services && apt.services.length > 0 && (
                                <span className="appointment-services">
                                  {translateServices(apt.services.slice(0, 2))}
                                  {apt.services.length > 2 && ` +${apt.services.length - 2}`}
                                </span>
                              )}
                              {apt.phone && (
                                <span className="appointment-phone" dir="ltr">{apt.phone}</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {getFilteredSchedule().length === 0 && (
                          <p className="empty-message">{isRTL ? 'لا توجد مواعيد' : 'No appointments'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

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
                    {['Electronics and Programming', 'CNC Laser', 'CNC Wood', '3D', 'Robotic and AI', "Kid's Club", 'Vinyl Cutting', 'Other'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input className="filter-input" placeholder={isRTL ? 'بحث...' : 'Search...'} value={educationFilters.search} onChange={(e) => setEducationFilters({ ...educationFilters, search: e.target.value })} style={{ flex: 1, minWidth: '150px' }} />
                  <button className="btn btn-primary" onClick={() => fetchEducations()} style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }}>
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
                              <button onClick={() => handleEducationStatusUpdate(selectedEducation.educationId, 'completed')} style={{ padding: '8px 16px', borderRadius: '8px', background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{isRTL ? 'إكمال' : 'Complete'}</button>
                              <button onClick={() => setShowRatingModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>{isRTL ? 'إضافة تقييم' : 'Add Rating'}</button>
                            </>
                          )}
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
                          <div style={{ fontWeight: '600', color: '#4f46e5' }}>{selectedEducation.section}{selectedEducation.otherSectionDescription ? ` - ${selectedEducation.otherSectionDescription}` : ''}</div>
                        </div>
                        <div style={{ padding: '12px', background: '#f5f3ff', borderRadius: '8px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{isRTL ? 'عدد الطلاب' : 'Students'}</div>
                          <div style={{ fontWeight: '600', color: '#4f46e5' }}>{selectedEducation.numberOfStudents}</div>
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

                      {/* Room Photo */}
                      {selectedEducation.roomPhotoBefore && (
                        <div style={{ marginBottom: '20px' }}>
                          <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>{isRTL ? 'صورة القاعة (قبل)' : 'Room Photo (Before)'}</h4>
                          <img src={selectedEducation.roomPhotoBefore} alt="Room Before" style={{ maxWidth: '300px', maxHeight: '200px', borderRadius: '8px', border: '2px solid #e2e8f0', objectFit: 'cover' }} />
                        </div>
                      )}

                      {/* Admin Notes */}
                      {selectedEducation.adminNotes && (
                        <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', marginBottom: '20px', border: '1px solid #fde68a' }}>
                          <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>{isRTL ? 'ملاحظات الإدارة' : 'Admin Notes'}</div>
                          <div style={{ color: '#78350f' }}>{selectedEducation.adminNotes}</div>
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
                                <button onClick={() => fetchEducationDetail(edu.educationId)} style={{ padding: '6px 12px', borderRadius: '6px', background: '#4f46e5', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                                  {isRTL ? 'عرض' : 'View'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {educationPagination.pages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '16px' }}>
                        {Array.from({ length: educationPagination.pages }, (_, i) => i + 1).map(pageNum => (
                          <button key={pageNum} onClick={() => fetchEducations(pageNum)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: pageNum === educationPagination.page ? '#4f46e5' : 'var(--card-bg)', color: pageNum === educationPagination.page ? 'white' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}>{pageNum}</button>
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
              </motion.div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
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
                      { value: '3D', labelEn: '3D Printing', labelAr: 'الطباعة ثلاثية الأبعاد' },
                      { value: 'Robotic and AI', labelEn: 'Robotics & AI', labelAr: 'الروبوتات والذكاء الاصطناعي' },
                      { value: "Kid's Club", labelEn: "Kid's Club", labelAr: 'نادي الأطفال' },
                      { value: 'Vinyl Cutting', labelEn: 'Vinyl Cutting', labelAr: 'قص الفينيل' }
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
                                      {new Date(period.startDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')} - {new Date(period.endDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
                      <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                      <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
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
                <label>{isRTL ? 'القسم' : 'Section'}</label>
                <select
                  value={employeeForm.section}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, section: e.target.value })}
                >
                  <option value="">{isRTL ? 'اختر القسم' : 'Select Section'}</option>
                  <option value="Electronics and Programming">{isRTL ? 'الإلكترونيات والبرمجة' : 'Electronics & Programming'}</option>
                  <option value="CNC Laser">{isRTL ? 'الليزر CNC' : 'CNC Laser'}</option>
                  <option value="CNC Wood">{isRTL ? 'الخشب CNC' : 'CNC Wood'}</option>
                  <option value="3D">{isRTL ? 'الطباعة ثلاثية الأبعاد' : '3D Printing'}</option>
                  <option value="Robotic and AI">{isRTL ? 'الروبوتات والذكاء الاصطناعي' : 'Robotics & AI'}</option>
                  <option value="Kid's Club">{isRTL ? 'نادي الأطفال' : "Kid's Club"}</option>
                  <option value="Vinyl Cutting">{isRTL ? 'قطع الفينيل' : 'Vinyl Cutting'}</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowEmployeeModal(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="modal-btn approve"
                onClick={selectedEmployee ? handleUpdateEmployee : handleCreateEmployee}
                disabled={!employeeForm.name || !employeeForm.email || !employeeForm.section}
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

    </div>
  );
};

export default AdminDashboard;
