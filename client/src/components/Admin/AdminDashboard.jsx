import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const printRef = useRef();

  const [adminData, setAdminData] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('adminTheme', theme);
  }, [theme]);

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

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await api.get(`/admin/registrations?${params.toString()}`);
      setRegistrations(response.data.registrations || []);
    } catch (error) {
      console.error('Error fetching registrations:', error);
      toast.error(isRTL ? 'خطأ في تحميل التسجيلات' : 'Error loading registrations');
    } finally {
      setLoading(false);
    }
  }, [filters, isRTL]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
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
      const response = await api.get('/admin/schedule');
      setSchedule(response.data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    }
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
    }
  }, [activeTab, fetchRegistrations, analyticsPeriod]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    toast.success(isRTL ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully');
    navigate('/admin/login');
  };

  const handleStatusChange = async (registrationId, newStatus) => {
    try {
      const encodedId = encodeURIComponent(registrationId);
      await api.patch(`/admin/registrations/${encodedId}/status`, { status: newStatus });
      toast.success(isRTL ? 'تم تحديث الحالة بنجاح' : 'Status updated successfully');
      fetchRegistrations();
      fetchAnalytics();
      setShowModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const handlePrintRegistration = (registration) => {
    const printWindow = window.open('', '_blank');
    const userName = registration.user?.firstName && registration.user?.lastName
      ? `${registration.user.firstName} ${registration.user.lastName}`
      : registration.user?.name || 'N/A';

    const printContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <title>Registration Form - ${registration.registrationId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #fff; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #e02529; padding-bottom: 20px; }
          .logo { font-size: 28px; font-weight: bold; color: #e02529; margin-bottom: 5px; }
          .subtitle { color: #666; font-size: 14px; }
          .form-title { font-size: 20px; font-weight: 600; margin: 20px 0; color: #333; text-align: center; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 16px; font-weight: 600; color: #e02529; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
          .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .field { margin-bottom: 12px; }
          .field-label { font-size: 12px; color: #888; margin-bottom: 4px; text-transform: uppercase; }
          .field-value { font-size: 14px; color: #333; font-weight: 500; padding: 8px; background: #f8f9fa; border-radius: 4px; }
          .status { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
          .status.pending { background: #fff3cd; color: #856404; }
          .status.approved { background: #d4edda; color: #155724; }
          .status.rejected { background: #f8d7da; color: #721c24; }
          .footer { margin-top: 40px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
          .qr-section { text-align: center; margin: 30px 0; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">FABLAB Al-Ahsa</div>
          <div class="subtitle">${isRTL ? 'نموذج التسجيل' : 'Registration Form'}</div>
        </div>

        <div class="form-title">${isRTL ? 'تفاصيل التسجيل' : 'Registration Details'}</div>

        <div class="section">
          <div class="section-title">${isRTL ? 'معلومات التسجيل' : 'Registration Information'}</div>
          <div class="field-grid">
            <div class="field">
              <div class="field-label">${isRTL ? 'رقم التسجيل' : 'Registration ID'}</div>
              <div class="field-value">${registration.registrationId}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'الحالة' : 'Status'}</div>
              <div class="field-value"><span class="status ${registration.status}">${registration.status}</span></div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'تاريخ التقديم' : 'Submission Date'}</div>
              <div class="field-value">${formatDate(registration.createdAt)}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'القسم' : 'Section'}</div>
              <div class="field-value">${registration.fablabSection || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${isRTL ? 'معلومات المتقدم' : 'Applicant Information'}</div>
          <div class="field-grid">
            <div class="field">
              <div class="field-label">${isRTL ? 'الاسم' : 'Name'}</div>
              <div class="field-value">${userName}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'رقم المستخدم' : 'User ID'}</div>
              <div class="field-value">${registration.userId}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'نوع الطلب' : 'Application Type'}</div>
              <div class="field-value">${registration.user?.applicationType || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'البريد الإلكتروني' : 'Email'}</div>
              <div class="field-value">${registration.user?.email || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'رقم الهاتف' : 'Phone'}</div>
              <div class="field-value">${registration.user?.phoneNumber || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${isRTL ? 'تفاصيل الموعد' : 'Appointment Details'}</div>
          <div class="field-grid">
            <div class="field">
              <div class="field-label">${isRTL ? 'التاريخ' : 'Date'}</div>
              <div class="field-value">${formatDate(registration.appointmentDate || registration.visitDate || registration.startDate)}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'الوقت' : 'Time'}</div>
              <div class="field-value">${registration.appointmentTime || registration.visitStartTime || registration.startTime || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'نوع الخدمة' : 'Service Type'}</div>
              <div class="field-value">${registration.serviceType || 'N/A'}</div>
            </div>
            <div class="field">
              <div class="field-label">${isRTL ? 'الخدمات المطلوبة' : 'Required Services'}</div>
              <div class="field-value">${registration.requiredServices?.join(', ') || 'N/A'}</div>
            </div>
          </div>
        </div>

        ${registration.serviceDetails ? `
        <div class="section">
          <div class="section-title">${isRTL ? 'تفاصيل إضافية' : 'Additional Details'}</div>
          <div class="field">
            <div class="field-value">${registration.serviceDetails}</div>
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p>FABLAB Al-Ahsa - ${isRTL ? 'مختبر التصنيع الرقمي' : 'Digital Fabrication Laboratory'}</p>
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
    { id: 'settings', icon: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات' }
  ];

  const getIcon = (iconName) => {
    const icons = {
      dashboard: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
      registrations: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
      users: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      analytics: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
      schedule: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
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

  // Get filtered schedule for upcoming appointments
  const getFilteredSchedule = () => {
    if (scheduleFilter === 'all') return schedule;
    return schedule.filter(event => event.section === scheduleFilter);
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

  if (!adminData) {
    return null;
  }

  return (
    <div className="admin-layout" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          {sidebarOpen && <span className="sidebar-title">FABLAB</span>}
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {getIcon(item.icon)}
              {sidebarOpen && <span>{isRTL ? item.labelAr : item.labelEn}</span>}
            </button>
          ))}
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

                  <button className="filter-btn" onClick={fetchRegistrations}>
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
                    <table className="data-table">
                      <thead>
                        <tr>
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
                          <tr key={reg.registrationId}>
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
                                {reg.status === 'pending' && (
                                  <>
                                    <button
                                      className="action-btn approve"
                                      onClick={() => handleStatusChange(reg.registrationId, 'approved')}
                                      title={isRTL ? 'قبول' : 'Approve'}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12"/>
                                      </svg>
                                    </button>
                                    <button
                                      className="action-btn reject"
                                      onClick={() => handleStatusChange(reg.registrationId, 'rejected')}
                                      title={isRTL ? 'رفض' : 'Reject'}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                      </svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                      placeholder={isRTL ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                    />
                  </div>
                  <button className="filter-btn" onClick={fetchUsers}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                    {isRTL ? 'تحديث' : 'Refresh'}
                  </button>
                </div>

                <div className="table-container">
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
                          <tr key={user.userId}>
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                <div className="schedule-layout">
                  {/* Schedule Filter Tabs */}
                  <div className="schedule-filter-tabs">
                    <button
                      className={`schedule-filter-tab ${scheduleFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setScheduleFilter('all')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {isRTL ? 'كل المواعيد' : 'All Schedules'}
                    </button>
                    {employees.map(emp => (
                      <button
                        key={emp.employeeId}
                        className={`schedule-filter-tab ${scheduleFilter === emp.section ? 'active' : ''}`}
                        onClick={() => setScheduleFilter(emp.section)}
                        style={{
                          '--tab-color': SECTION_COLORS[emp.section] || '#6366f1'
                        }}
                      >
                        <span className="tab-avatar" style={{ backgroundColor: SECTION_COLORS[emp.section] || '#6366f1' }}>
                          {emp.name?.charAt(0)}
                        </span>
                        {emp.name}
                      </button>
                    ))}
                  </div>

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
                          return (
                            <div
                              key={day.toISOString()}
                              className={`calendar-day ${isToday ? 'today' : ''} ${events.length > 0 ? 'has-events' : ''}`}
                            >
                              <span className="day-number">{format(day, 'd')}</span>
                              {events.length > 0 && (
                                <div className="event-dots">
                                  {events.slice(0, 3).map((event, i) => (
                                    <span
                                      key={i}
                                      className="event-dot"
                                      style={{ backgroundColor: SECTION_COLORS[event.section] || '#6366f1' }}
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

                  <div className="schedule-sidebar">
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

                    <div className="appointments-section">
                      <h3>
                        {scheduleFilter === 'all'
                          ? (isRTL ? 'المواعيد القادمة' : 'Upcoming Appointments')
                          : (isRTL ? `مواعيد ${employees.find(e => e.section === scheduleFilter)?.name || ''}` : `${employees.find(e => e.section === scheduleFilter)?.name || ''}'s Appointments`)
                        }
                      </h3>
                      <div className="appointments-list">
                        {getFilteredSchedule().slice(0, 5).map((apt) => (
                          <div key={apt.id} className="appointment-item">
                            <div
                              className="appointment-color"
                              style={{ backgroundColor: SECTION_COLORS[apt.section] || '#6366f1' }}
                            />
                            <div className="appointment-info">
                              <span className="appointment-title">{apt.title}</span>
                              <span className="appointment-details">
                                {apt.date && formatDate(apt.date)} {apt.startTime && `• ${apt.startTime}`}
                              </span>
                              <span className="appointment-section">{sectionLabels[apt.section] || apt.section}</span>
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
                  <span>{selectedRegistration.appointmentTime || selectedRegistration.visitStartTime || selectedRegistration.startTime || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'المدة' : 'Duration'}</label>
                  <span>
                    {selectedRegistration.appointmentDuration
                      ? `${selectedRegistration.appointmentDuration} ${isRTL ? 'دقيقة' : 'minutes'}`
                      : (selectedRegistration.visitEndTime && selectedRegistration.visitStartTime)
                        ? `${selectedRegistration.visitStartTime} - ${selectedRegistration.visitEndTime}`
                        : (selectedRegistration.endTime && selectedRegistration.startTime)
                          ? `${selectedRegistration.startTime} - ${selectedRegistration.endTime}`
                          : 'N/A'
                    }
                  </span>
                </div>
                <div className="detail-item full-width">
                  <label>{isRTL ? 'الخدمات المطلوبة' : 'Required Services'}</label>
                  <span>{selectedRegistration.requiredServices?.join(', ') || 'N/A'}</span>
                </div>
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
              {selectedRegistration.status === 'pending' && (
                <>
                  <button
                    className="modal-btn approve"
                    onClick={() => handleStatusChange(selectedRegistration.registrationId, 'approved')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {isRTL ? 'قبول' : 'Approve'}
                  </button>
                  <button
                    className="modal-btn reject"
                    onClick={() => handleStatusChange(selectedRegistration.registrationId, 'rejected')}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    {isRTL ? 'رفض' : 'Reject'}
                  </button>
                </>
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
                    <label>{isRTL ? 'العمل الحالي' : 'Current Job'}</label>
                    <input
                      type="text"
                      value={userEditForm.currentJob || ''}
                      onChange={(e) => setUserEditForm({ ...userEditForm, currentJob: e.target.value })}
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
                      <span>{selectedUser.sex === 'male' ? (isRTL ? 'ذكر' : 'Male') : selectedUser.sex === 'female' ? (isRTL ? 'أنثى' : 'Female') : 'N/A'}</span>
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
                                  setSelectedRegistration(reg);
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

    </div>
  );
};

export default AdminDashboard;
