import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
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
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({ name: '', email: '', section: '' });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month');

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
      const response = await api.get(`/admin/analytics/enhanced?period=${analyticsPeriod}`);
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
      await api.patch(`/admin/registrations/${registrationId}/status`, { status: newStatus });
      toast.success(isRTL ? 'تم تحديث الحالة بنجاح' : 'Status updated successfully');
      fetchRegistrations();
      fetchAnalytics();
      setShowModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
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

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
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
      return isSameDay(parseISO(event.date), day);
    });
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
            <button className="header-btn" onClick={toggleLanguage}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>{i18n.language === 'ar' ? 'EN' : 'ع'}</span>
            </button>

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
                          <span className="recent-type">{reg.user?.applicationType}</span>
                        </div>
                        <div className="recent-meta">
                          <span className={`status-badge ${reg.status}`}>{reg.status}</span>
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
                              {reg.user?.firstName && reg.user?.lastName
                                ? `${reg.user.firstName} ${reg.user.lastName}`
                                : reg.user?.name || 'N/A'}
                            </td>
                            <td>{reg.user?.applicationType}</td>
                            <td>{reg.fablabSection}</td>
                            <td>{formatDate(reg.appointmentDate || reg.visitDate || reg.startDate)}</td>
                            <td>
                              <span className={`status-badge ${reg.status}`}>
                                {reg.status === 'pending' && (isRTL ? 'قيد المراجعة' : 'Pending')}
                                {reg.status === 'approved' && (isRTL ? 'مقبول' : 'Approved')}
                                {reg.status === 'rejected' && (isRTL ? 'مرفوض' : 'Rejected')}
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
                      onChange={(e) => {
                        // Simple client-side filter for now
                      }}
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
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.userId}>
                            <td><span className="reg-id">{user.userId}</span></td>
                            <td>
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.name || 'N/A'}
                            </td>
                            <td>{user.email}</td>
                            <td>{user.phoneNumber}</td>
                            <td>{user.applicationType}</td>
                            <td>{formatDate(user.createdAt)}</td>
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
                    {/* Summary Cards */}
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

                    {/* Charts Grid */}
                    <div className="charts-grid">
                      {/* Registrations Over Time */}
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
                              labelFormatter={(value) => {
                                try {
                                  return format(parseISO(value), 'MMM dd, yyyy');
                                } catch {
                                  return value;
                                }
                              }}
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

                      {/* By Section */}
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
                              label={({ fablabSection, percent }) => `${(percent * 100).toFixed(0)}%`}
                            >
                              {(analyticsData.bySection || []).map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={SECTION_COLORS[entry.fablabSection] || COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value, name, props) => [value, sectionLabels[props.payload.fablabSection] || props.payload.fablabSection]}
                            />
                            <Legend
                              formatter={(value, entry) => sectionLabels[entry.payload.fablabSection] || entry.payload.fablabSection}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* By Status */}
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
                              tickFormatter={(value) => {
                                const labels = {
                                  pending: isRTL ? 'قيد المراجعة' : 'Pending',
                                  approved: isRTL ? 'مقبول' : 'Approved',
                                  rejected: isRTL ? 'مرفوض' : 'Rejected'
                                };
                                return labels[value] || value;
                              }}
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

                      {/* By Application Type */}
                      <div className="chart-card">
                        <h3>{isRTL ? 'حسب نوع الطلب' : 'By Application Type'}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analyticsData.byApplicationType || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="applicationType"
                              tick={{ fill: '#6b7280', fontSize: 11 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#6366f1" name={isRTL ? 'العدد' : 'Count'} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* By Service Type */}
                      <div className="chart-card">
                        <h3>{isRTL ? 'حسب نوع الخدمة' : 'By Service Type'}</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={analyticsData.byServiceType || []}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              fill="#8884d8"
                              paddingAngle={5}
                              dataKey="count"
                              nameKey="serviceType"
                              label
                            >
                              {(analyticsData.byServiceType || []).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
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
                  {/* Calendar */}
                  <div className="calendar-section">
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
                        {/* Empty cells for days before month starts */}
                        {Array.from({ length: startOfMonth(selectedDate).getDay() }).map((_, i) => (
                          <div key={`empty-${i}`} className="calendar-day empty" />
                        ))}
                        {/* Days of the month */}
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

                  {/* Employees & Appointments */}
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
                      <div className="employees-list">
                        {employees.map((emp) => (
                          <div key={emp.employeeId} className="employee-item">
                            <div className="employee-avatar" style={{ backgroundColor: SECTION_COLORS[emp.section] || '#6366f1' }}>
                              {emp.name?.charAt(0)}
                            </div>
                            <div className="employee-info">
                              <span className="employee-name">{emp.name}</span>
                              <span className="employee-section">{sectionLabels[emp.section] || emp.section}</span>
                            </div>
                            <div className="employee-actions">
                              <button
                                className="edit-btn"
                                onClick={() => {
                                  setSelectedEmployee(emp);
                                  setEmployeeForm({ name: emp.name, email: emp.email, section: emp.section });
                                  setShowEmployeeModal(true);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button
                                className="delete-btn"
                                onClick={() => handleDeleteEmployee(emp.employeeId)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

                    {/* Today's Appointments */}
                    <div className="appointments-section">
                      <h3>{isRTL ? 'المواعيد القادمة' : 'Upcoming Appointments'}</h3>
                      <div className="appointments-list">
                        {schedule.slice(0, 5).map((apt) => (
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
                        {schedule.length === 0 && (
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
                          <span className="lang-flag">🇬🇧</span>
                          <span>English</span>
                        </button>
                        <button
                          className={`lang-option ${i18n.language === 'ar' ? 'active' : ''}`}
                          onClick={() => i18n.changeLanguage('ar')}
                        >
                          <span className="lang-flag">🇸🇦</span>
                          <span>العربية</span>
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
                  <span>{selectedRegistration.user?.applicationType}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'القسم' : 'Section'}</label>
                  <span>{selectedRegistration.fablabSection}</span>
                </div>
                <div className="detail-item">
                  <label>{isRTL ? 'الحالة' : 'Status'}</label>
                  <span className={`status-badge ${selectedRegistration.status}`}>
                    {selectedRegistration.status}
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

            {selectedRegistration.status === 'pending' && (
              <div className="modal-footer">
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
              </div>
            )}
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
