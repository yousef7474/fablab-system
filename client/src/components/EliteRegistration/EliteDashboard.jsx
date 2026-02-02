import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import api from '../../config/api';
import './EliteDashboard.css';

const EliteDashboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('ar');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showIdCard, setShowIdCard] = useState(null);

  // Rating and Credit states
  const [showRatingModal, setShowRatingModal] = useState(null);
  const [showCreditModal, setShowCreditModal] = useState(null);
  const [userPerformance, setUserPerformance] = useState(null);
  const [userRatings, setUserRatings] = useState([]);
  const [userCredits, setUserCredits] = useState([]);
  const [performanceTab, setPerformanceTab] = useState('overview'); // overview, admin-ratings, engineer-ratings, credits
  const [ratingForm, setRatingForm] = useState({
    raterType: 'admin',
    period: '',
    attendanceScore: 0,
    projectQualityScore: 0,
    developmentScore: 0,
    participationScore: 0,
    teamworkScore: 0,
    behaviorScore: 0,
    notes: ''
  });
  const [creditForm, setCreditForm] = useState({
    type: 'award',
    source: 'admin',
    points: 1,
    reason: ''
  });

  const isRTL = language === 'ar';

  // Translations
  const t = {
    ar: {
      title: 'لوحة إدارة النخبة',
      subtitle: 'إدارة ومتابعة أعضاء النخبة',
      totalMembers: 'إجمالي الأعضاء',
      activeMembers: 'الأعضاء النشطين',
      newThisMonth: 'جديد هذا الشهر',
      search: 'بحث بالاسم أو البريد أو رقم الهوية...',
      all: 'الكل',
      active: 'نشط',
      inactive: 'غير نشط',
      suspended: 'موقوف',
      memberId: 'رقم العضوية',
      name: 'الاسم',
      email: 'البريد الإلكتروني',
      phone: 'الهاتف',
      city: 'المدينة',
      status: 'الحالة',
      joinDate: 'تاريخ الانضمام',
      actions: 'الإجراءات',
      view: 'عرض',
      activate: 'تفعيل',
      deactivate: 'إيقاف',
      suspend: 'تعليق',
      delete: 'حذف',
      noUsers: 'لا يوجد أعضاء',
      memberDetails: 'تفاصيل العضو',
      nationalId: 'رقم الهوية',
      nationality: 'الجنسية',
      gender: 'الجنس',
      male: 'ذكر',
      female: 'أنثى',
      dateOfBirth: 'تاريخ الميلاد',
      organization: 'جهة العمل',
      specialization: 'التخصص',
      bio: 'نبذة تعريفية',
      lastLogin: 'آخر دخول',
      createdAt: 'تاريخ الإنشاء',
      close: 'إغلاق',
      confirmDelete: 'تأكيد الحذف',
      deleteWarning: 'هل أنت متأكد من حذف هذا العضو؟ هذا الإجراء لا يمكن التراجع عنه.',
      cancel: 'إلغاء',
      backHome: 'العودة للرئيسية',
      refresh: 'تحديث',
      printId: 'طباعة البطاقة',
      membershipCard: 'بطاقة العضوية',
      eliteMember: 'عضو النخبة',
      print: 'طباعة',
      performance: 'الأداء والتقييم',
      category: 'الفئة',
      percentage: 'النسبة',
      adminRating: 'تقييم الإدارة',
      engineerRating: 'تقييم المهندس',
      credits: 'النقاط',
      addRating: 'إضافة تقييم',
      addCredit: 'إضافة/خصم نقاط',
      raterType: 'نوع التقييم',
      period: 'الفترة',
      attendance: 'الحضور والالتزام',
      projectQuality: 'جودة المشاريع',
      development: 'التطور والتعلم',
      participation: 'المشاركة الفعالة',
      teamwork: 'العمل الجماعي',
      behavior: 'السلوك والأخلاق',
      notes: 'ملاحظات',
      totalScore: 'المجموع',
      award: 'منحة',
      deduction: 'خصم',
      source: 'المصدر',
      points: 'النقاط',
      reason: 'السبب',
      submit: 'إرسال',
      overview: 'نظرة عامة',
      adminRatings: 'تقييمات الإدارة',
      engineerRatings: 'تقييمات المهندسين',
      netCredits: 'صافي النقاط',
      noRatings: 'لا توجد تقييمات',
      noCredits: 'لا توجد نقاط',
      categoryA: 'الفئة A - دعم كامل',
      categoryB: 'الفئة B - دعم عالي',
      categoryC: 'الفئة C - دعم متوسط',
      categoryD: 'الفئة D - دعم أساسي',
      belowD: 'أقل من D - يحتاج تحسين'
    },
    en: {
      title: 'Elite Management Dashboard',
      subtitle: 'Manage and monitor Elite members',
      totalMembers: 'Total Members',
      activeMembers: 'Active Members',
      newThisMonth: 'New This Month',
      search: 'Search by name, email, or ID...',
      all: 'All',
      active: 'Active',
      inactive: 'Inactive',
      suspended: 'Suspended',
      memberId: 'Member ID',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      city: 'City',
      status: 'Status',
      joinDate: 'Join Date',
      actions: 'Actions',
      view: 'View',
      activate: 'Activate',
      deactivate: 'Deactivate',
      suspend: 'Suspend',
      delete: 'Delete',
      noUsers: 'No members found',
      memberDetails: 'Member Details',
      nationalId: 'National ID',
      nationality: 'Nationality',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      dateOfBirth: 'Date of Birth',
      organization: 'Organization',
      specialization: 'Specialization',
      bio: 'Bio',
      lastLogin: 'Last Login',
      createdAt: 'Created At',
      close: 'Close',
      confirmDelete: 'Confirm Delete',
      deleteWarning: 'Are you sure you want to delete this member? This action cannot be undone.',
      cancel: 'Cancel',
      backHome: 'Back to Home',
      refresh: 'Refresh',
      printId: 'Print ID',
      membershipCard: 'Membership Card',
      eliteMember: 'Elite Member',
      print: 'Print',
      performance: 'Performance & Rating',
      category: 'Category',
      percentage: 'Percentage',
      adminRating: 'Admin Rating',
      engineerRating: 'Engineer Rating',
      credits: 'Credits',
      addRating: 'Add Rating',
      addCredit: 'Add/Deduct Credits',
      raterType: 'Rating Type',
      period: 'Period',
      attendance: 'Attendance & Commitment',
      projectQuality: 'Project Quality',
      development: 'Development & Learning',
      participation: 'Active Participation',
      teamwork: 'Teamwork',
      behavior: 'Behavior & Ethics',
      notes: 'Notes',
      totalScore: 'Total Score',
      award: 'Award',
      deduction: 'Deduction',
      source: 'Source',
      points: 'Points',
      reason: 'Reason',
      submit: 'Submit',
      overview: 'Overview',
      adminRatings: 'Admin Ratings',
      engineerRatings: 'Engineer Ratings',
      netCredits: 'Net Credits',
      noRatings: 'No ratings yet',
      noCredits: 'No credits yet',
      categoryA: 'Category A - Full Support',
      categoryB: 'Category B - High Support',
      categoryC: 'Category C - Medium Support',
      categoryD: 'Category D - Basic Support',
      belowD: 'Below D - Needs Improvement'
    }
  };

  const text = t[language];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/elite/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching elite users:', error);
      toast.error(isRTL ? 'خطأ في تحميل البيانات' : 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await api.patch(`/elite/users/${userId}/status`, { status: newStatus });
      toast.success(isRTL ? 'تم تحديث الحالة' : 'Status updated');
      fetchUsers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(isRTL ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const handleDelete = async (userId) => {
    try {
      await api.delete(`/elite/users/${userId}`);
      toast.success(isRTL ? 'تم حذف العضو' : 'Member deleted');
      setShowDeleteConfirm(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(isRTL ? 'خطأ في حذف العضو' : 'Error deleting member');
    }
  };

  // Fetch performance data for a user
  const fetchUserPerformance = async (eliteId) => {
    try {
      const [perfResponse, ratingsResponse, creditsResponse] = await Promise.all([
        api.get(`/elite/performance/${eliteId}`),
        api.get(`/elite/ratings/${eliteId}`),
        api.get(`/elite/credits/${eliteId}`)
      ]);
      setUserPerformance(perfResponse.data);
      setUserRatings(ratingsResponse.data.ratings || []);
      setUserCredits(creditsResponse.data.credits || []);
    } catch (error) {
      console.error('Error fetching performance:', error);
      toast.error(isRTL ? 'خطأ في تحميل بيانات الأداء' : 'Error loading performance data');
    }
  };

  // Open rating modal for user
  const openRatingModal = (user) => {
    const now = new Date();
    const periodOptions = [
      `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
      `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`
    ];
    setRatingForm({
      raterType: 'admin',
      period: periodOptions[0],
      attendanceScore: 50,
      projectQualityScore: 50,
      developmentScore: 50,
      participationScore: 50,
      teamworkScore: 50,
      behaviorScore: 50,
      notes: ''
    });
    setShowRatingModal(user);
  };

  // Submit rating
  const handleSubmitRating = async () => {
    try {
      if (!ratingForm.period) {
        toast.error(isRTL ? 'الفترة مطلوبة' : 'Period is required');
        return;
      }
      await api.post('/elite/ratings', {
        eliteId: showRatingModal.eliteId,
        ...ratingForm
      });
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      setShowRatingModal(null);
      if (selectedUser) {
        fetchUserPerformance(selectedUser.eliteId);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      const errMsg = error.response?.data?.messageAr || error.response?.data?.message || 'Error';
      toast.error(isRTL ? errMsg : (error.response?.data?.message || 'Error submitting rating'));
    }
  };

  // Open credit modal for user
  const openCreditModal = (user) => {
    setCreditForm({
      type: 'award',
      source: 'admin',
      points: 1,
      reason: ''
    });
    setShowCreditModal(user);
  };

  // Submit credit
  const handleSubmitCredit = async () => {
    try {
      if (!creditForm.reason) {
        toast.error(isRTL ? 'السبب مطلوب' : 'Reason is required');
        return;
      }
      await api.post('/elite/credits', {
        eliteId: showCreditModal.eliteId,
        ...creditForm
      });
      toast.success(
        creditForm.type === 'award'
          ? (isRTL ? 'تم منح النقاط بنجاح' : 'Credits awarded successfully')
          : (isRTL ? 'تم خصم النقاط بنجاح' : 'Credits deducted successfully')
      );
      setShowCreditModal(null);
      if (selectedUser) {
        fetchUserPerformance(selectedUser.eliteId);
      }
    } catch (error) {
      console.error('Error submitting credit:', error);
      toast.error(isRTL ? 'خطأ في إضافة النقاط' : 'Error adding credits');
    }
  };

  // Delete a rating
  const handleDeleteRating = async (ratingId) => {
    try {
      await api.delete(`/elite/ratings/${ratingId}`);
      toast.success(isRTL ? 'تم حذف التقييم' : 'Rating deleted');
      if (selectedUser) {
        fetchUserPerformance(selectedUser.eliteId);
      }
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error(isRTL ? 'خطأ في حذف التقييم' : 'Error deleting rating');
    }
  };

  // Delete a credit
  const handleDeleteCredit = async (creditId) => {
    try {
      await api.delete(`/elite/credits/${creditId}`);
      toast.success(isRTL ? 'تم حذف النقاط' : 'Credit deleted');
      if (selectedUser) {
        fetchUserPerformance(selectedUser.eliteId);
      }
    } catch (error) {
      console.error('Error deleting credit:', error);
      toast.error(isRTL ? 'خطأ في حذف النقاط' : 'Error deleting credit');
    }
  };

  // Get category color
  const getCategoryColor = (category) => {
    switch(category) {
      case 'A': return '#22c55e';
      case 'B': return '#3b82f6';
      case 'C': return '#f59e0b';
      case 'D': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Get category badge text
  const getCategoryBadge = (category) => {
    const badges = {
      'A': { ar: 'الفئة A', en: 'Category A' },
      'B': { ar: 'الفئة B', en: 'Category B' },
      'C': { ar: 'الفئة C', en: 'Category C' },
      'D': { ar: 'الفئة D', en: 'Category D' },
      'Below D': { ar: 'أقل من D', en: 'Below D' }
    };
    return badges[category]?.[isRTL ? 'ar' : 'en'] || category;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.uniqueId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.nationalId?.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    newThisMonth: users.filter(u => {
      const created = new Date(u.createdAt);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return format(new Date(date), 'dd/MM/yyyy');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: text.active, class: 'active' },
      inactive: { label: text.inactive, class: 'inactive' },
      suspended: { label: text.suspended, class: 'suspended' }
    };
    return statusConfig[status] || statusConfig.inactive;
  };

  return (
    <div className="elite-dashboard" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background */}
      <div className="elite-dashboard-bg"></div>

      {/* Language Switch */}
      <div className="elite-dashboard-language">
        <button
          className={`lang-btn ${language === 'ar' ? 'active' : ''}`}
          onClick={() => setLanguage('ar')}
        >
          عربي
        </button>
        <button
          className={`lang-btn ${language === 'en' ? 'active' : ''}`}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
      </div>

      <div className="elite-dashboard-container">
        {/* Header */}
        <motion.div
          className="elite-dashboard-header"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="header-content">
            <div className="header-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div>
              <h1>{text.title}</h1>
              <p>{text.subtitle}</p>
            </div>
          </div>
          <div className="header-actions">
            <button className="refresh-btn" onClick={fetchUsers}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6"/>
                <path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {text.refresh}
            </button>
            <button className="back-btn" onClick={() => {
              // Check if user came from admin or manager dashboard
              const adminData = localStorage.getItem('adminData');
              if (adminData) {
                const parsed = JSON.parse(adminData);
                if (parsed.role === 'manager') {
                  navigate('/manager/dashboard');
                } else {
                  navigate('/admin/dashboard');
                }
              } else {
                navigate('/');
              }
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              {text.backHome}
            </button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="stats-grid"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="stat-card total">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">{text.totalMembers}</span>
            </div>
          </div>
          <div className="stat-card active">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.active}</span>
              <span className="stat-label">{text.activeMembers}</span>
            </div>
          </div>
          <div className="stat-card new">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.newThisMonth}</span>
              <span className="stat-label">{text.newThisMonth}</span>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          className="filters-section"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="search-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder={text.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="status-filters">
            {['all', 'active', 'inactive', 'suspended'].map(status => (
              <button
                key={status}
                className={`filter-btn ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {text[status]}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Users Table */}
        <motion.div
          className="users-table-container"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              <p>{text.noUsers}</p>
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>{text.memberId}</th>
                  <th>{text.name}</th>
                  <th>{text.email}</th>
                  <th>{text.phone}</th>
                  <th>{text.city}</th>
                  <th>{text.status}</th>
                  <th>{text.joinDate}</th>
                  <th>{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const statusBadge = getStatusBadge(user.status);
                  return (
                    <tr key={user.eliteId}>
                      <td className="member-id">{user.uniqueId}</td>
                      <td className="member-name">
                        <div className="name-cell">
                          {user.profilePicture ? (
                            <img src={user.profilePicture} alt="" className="avatar" />
                          ) : (
                            <div className="avatar-placeholder">
                              {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                            </div>
                          )}
                          <span>{user.firstName} {user.lastName}</span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td dir="ltr">{user.phoneNumber}</td>
                      <td>{user.city || '-'}</td>
                      <td>
                        <span className={`status-badge ${statusBadge.class}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="action-btn view"
                            onClick={() => {
                              setSelectedUser(user);
                              setPerformanceTab('overview');
                              fetchUserPerformance(user.eliteId);
                            }}
                            title={text.view}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                          <button
                            className="action-btn print-id"
                            onClick={() => setShowIdCard(user)}
                            title={text.printId}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="4" width="20" height="16" rx="2"/>
                              <circle cx="8" cy="10" r="2"/>
                              <path d="M22 12h-4"/>
                              <path d="M22 8h-4"/>
                              <path d="M22 16h-4"/>
                              <path d="M6 16h4"/>
                            </svg>
                          </button>
                          <button
                            className="action-btn rating"
                            onClick={() => openRatingModal(user)}
                            title={text.addRating}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          </button>
                          <button
                            className="action-btn credit"
                            onClick={() => openCreditModal(user)}
                            title={text.addCredit}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="12" y1="8" x2="12" y2="16"/>
                              <line x1="8" y1="12" x2="16" y2="12"/>
                            </svg>
                          </button>
                          {user.status !== 'active' && (
                            <button
                              className="action-btn activate"
                              onClick={() => handleStatusChange(user.eliteId, 'active')}
                              title={text.activate}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </button>
                          )}
                          {user.status === 'active' && (
                            <button
                              className="action-btn deactivate"
                              onClick={() => handleStatusChange(user.eliteId, 'inactive')}
                              title={text.deactivate}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                              </svg>
                            </button>
                          )}
                          <button
                            className="action-btn delete"
                            onClick={() => setShowDeleteConfirm(user.eliteId)}
                            title={text.delete}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </motion.div>
      </div>

      {/* User Details Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              className="modal-content user-details-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>{text.memberDetails}</h2>
                <button className="close-btn" onClick={() => setSelectedUser(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Performance Tabs */}
              <div className="performance-tabs">
                <button
                  className={`perf-tab ${performanceTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setPerformanceTab('overview')}
                >
                  {text.overview}
                </button>
                <button
                  className={`perf-tab ${performanceTab === 'admin-ratings' ? 'active' : ''}`}
                  onClick={() => setPerformanceTab('admin-ratings')}
                >
                  {text.adminRatings}
                </button>
                <button
                  className={`perf-tab ${performanceTab === 'engineer-ratings' ? 'active' : ''}`}
                  onClick={() => setPerformanceTab('engineer-ratings')}
                >
                  {text.engineerRatings}
                </button>
                <button
                  className={`perf-tab ${performanceTab === 'credits' ? 'active' : ''}`}
                  onClick={() => setPerformanceTab('credits')}
                >
                  {text.credits}
                </button>
              </div>

              <div className="modal-body">
                {/* Performance Overview */}
                {performanceTab === 'overview' && userPerformance && (
                  <div className="performance-overview">
                    <div className="category-badge-large" style={{ backgroundColor: getCategoryColor(userPerformance.category) }}>
                      <span className="category-letter">{userPerformance.category}</span>
                      <span className="category-percentage">{userPerformance.finalPercentage}%</span>
                    </div>
                    <div className="performance-breakdown">
                      <div className="perf-item">
                        <span className="perf-label">{text.adminRating}</span>
                        <div className="perf-bar">
                          <div className="perf-fill admin" style={{ width: `${userPerformance.adminRatingAvg}%` }}></div>
                        </div>
                        <span className="perf-value">{userPerformance.adminRatingAvg}%</span>
                      </div>
                      <div className="perf-item">
                        <span className="perf-label">{text.engineerRating}</span>
                        <div className="perf-bar">
                          <div className="perf-fill engineer" style={{ width: `${userPerformance.engineerRatingAvg}%` }}></div>
                        </div>
                        <span className="perf-value">{userPerformance.engineerRatingAvg}%</span>
                      </div>
                      <div className="perf-item">
                        <span className="perf-label">{text.netCredits}</span>
                        <div className="credits-display">
                          <span className="credit-awards">+{userPerformance.totalAwards}</span>
                          <span className="credit-deductions">-{userPerformance.totalDeductions}</span>
                          <span className="credit-net">= {userPerformance.netCredits}</span>
                        </div>
                      </div>
                    </div>
                    <div className="category-description">
                      <p>{userPerformance.categoryInfo?.support}</p>
                    </div>
                  </div>
                )}

                {/* Admin Ratings Tab */}
                {performanceTab === 'admin-ratings' && (
                  <div className="ratings-list">
                    {userRatings.filter(r => r.raterType === 'admin').length === 0 ? (
                      <div className="empty-ratings">{text.noRatings}</div>
                    ) : (
                      userRatings.filter(r => r.raterType === 'admin').map(rating => (
                        <div key={rating.ratingId} className="rating-card">
                          <div className="rating-header">
                            <span className="rating-period">{rating.period}</span>
                            <span className="rating-total">{rating.totalScore}%</span>
                            <button className="delete-rating-btn" onClick={() => handleDeleteRating(rating.ratingId)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                          <div className="rating-scores">
                            <div className="score-item"><span>{text.attendance}</span><span>{rating.attendanceScore}%</span></div>
                            <div className="score-item"><span>{text.projectQuality}</span><span>{rating.projectQualityScore}%</span></div>
                            <div className="score-item"><span>{text.development}</span><span>{rating.developmentScore}%</span></div>
                            <div className="score-item"><span>{text.participation}</span><span>{rating.participationScore}%</span></div>
                            <div className="score-item"><span>{text.teamwork}</span><span>{rating.teamworkScore}%</span></div>
                            <div className="score-item"><span>{text.behavior}</span><span>{rating.behaviorScore}%</span></div>
                          </div>
                          {rating.notes && <div className="rating-notes">{rating.notes}</div>}
                          <div className="rating-footer">
                            <span>{rating.ratedBy?.fullName}</span>
                            <span>{formatDate(rating.ratingDate)}</span>
                          </div>
                        </div>
                      ))
                    )}
                    <button className="add-rating-btn" onClick={() => openRatingModal({ ...selectedUser, presetType: 'admin' })}>
                      + {text.addRating} ({text.adminRating})
                    </button>
                  </div>
                )}

                {/* Engineer Ratings Tab */}
                {performanceTab === 'engineer-ratings' && (
                  <div className="ratings-list">
                    {userRatings.filter(r => r.raterType === 'engineer').length === 0 ? (
                      <div className="empty-ratings">{text.noRatings}</div>
                    ) : (
                      userRatings.filter(r => r.raterType === 'engineer').map(rating => (
                        <div key={rating.ratingId} className="rating-card">
                          <div className="rating-header">
                            <span className="rating-period">{rating.period}</span>
                            <span className="rating-total">{rating.totalScore}%</span>
                            <button className="delete-rating-btn" onClick={() => handleDeleteRating(rating.ratingId)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                          <div className="rating-scores">
                            <div className="score-item"><span>{text.attendance}</span><span>{rating.attendanceScore}%</span></div>
                            <div className="score-item"><span>{text.projectQuality}</span><span>{rating.projectQualityScore}%</span></div>
                            <div className="score-item"><span>{text.development}</span><span>{rating.developmentScore}%</span></div>
                            <div className="score-item"><span>{text.participation}</span><span>{rating.participationScore}%</span></div>
                            <div className="score-item"><span>{text.teamwork}</span><span>{rating.teamworkScore}%</span></div>
                            <div className="score-item"><span>{text.behavior}</span><span>{rating.behaviorScore}%</span></div>
                          </div>
                          {rating.notes && <div className="rating-notes">{rating.notes}</div>}
                          <div className="rating-footer">
                            <span>{rating.ratedBy?.fullName}</span>
                            <span>{formatDate(rating.ratingDate)}</span>
                          </div>
                        </div>
                      ))
                    )}
                    <button className="add-rating-btn" onClick={() => openRatingModal({ ...selectedUser, presetType: 'engineer' })}>
                      + {text.addRating} ({text.engineerRating})
                    </button>
                  </div>
                )}

                {/* Credits Tab */}
                {performanceTab === 'credits' && (
                  <div className="credits-list">
                    {userCredits.length === 0 ? (
                      <div className="empty-credits">{text.noCredits}</div>
                    ) : (
                      userCredits.map(credit => (
                        <div key={credit.creditId} className={`credit-card ${credit.type}`}>
                          <div className="credit-header">
                            <span className={`credit-type ${credit.type}`}>
                              {credit.type === 'award' ? '+' : '-'}{credit.points}
                            </span>
                            <span className="credit-source">{credit.source}</span>
                            <button className="delete-credit-btn" onClick={() => handleDeleteCredit(credit.creditId)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                            </button>
                          </div>
                          <div className="credit-reason">{credit.reason}</div>
                          <div className="credit-footer">
                            <span>{credit.createdBy?.fullName || 'System'}</span>
                            <span>{formatDate(credit.creditDate)}</span>
                          </div>
                        </div>
                      ))
                    )}
                    <button className="add-credit-btn" onClick={() => openCreditModal(selectedUser)}>
                      + {text.addCredit}
                    </button>
                  </div>
                )}

                {/* Personal Info (only shown in overview) */}
                {performanceTab === 'overview' && (
                  <>
                <div className="user-profile-header">
                  {selectedUser.profilePicture ? (
                    <img src={selectedUser.profilePicture} alt="" className="profile-image" />
                  ) : (
                    <div className="profile-placeholder">
                      {selectedUser.firstName?.charAt(0)}{selectedUser.lastName?.charAt(0)}
                    </div>
                  )}
                  <div className="profile-info">
                    <h3>{selectedUser.firstName} {selectedUser.lastName}</h3>
                    <span className="member-id-badge">{selectedUser.uniqueId}</span>
                    <span className={`status-badge ${getStatusBadge(selectedUser.status).class}`}>
                      {getStatusBadge(selectedUser.status).label}
                    </span>
                  </div>
                </div>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">{text.email}</span>
                    <span className="detail-value">{selectedUser.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.phone}</span>
                    <span className="detail-value" dir="ltr">{selectedUser.phoneNumber}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.nationalId}</span>
                    <span className="detail-value" dir="ltr">{selectedUser.nationalId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.nationality}</span>
                    <span className="detail-value">{selectedUser.nationality}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.gender}</span>
                    <span className="detail-value">
                      {selectedUser.sex === 'male' ? text.male : text.female}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.dateOfBirth}</span>
                    <span className="detail-value">{formatDate(selectedUser.dateOfBirth)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.city}</span>
                    <span className="detail-value">{selectedUser.city || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.organization}</span>
                    <span className="detail-value">{selectedUser.organization || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.specialization}</span>
                    <span className="detail-value">{selectedUser.specialization || '-'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.createdAt}</span>
                    <span className="detail-value">{formatDate(selectedUser.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{text.lastLogin}</span>
                    <span className="detail-value">{formatDate(selectedUser.lastLogin)}</span>
                  </div>
                </div>
                {selectedUser.bio && (
                  <div className="bio-section">
                    <span className="detail-label">{text.bio}</span>
                    <p className="bio-text">{selectedUser.bio}</p>
                  </div>
                )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-close" onClick={() => setSelectedUser(null)}>
                  {text.close}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              className="modal-content delete-confirm-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="delete-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <h3>{text.confirmDelete}</h3>
              <p>{text.deleteWarning}</p>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setShowDeleteConfirm(null)}>
                  {text.cancel}
                </button>
                <button className="btn-delete" onClick={() => handleDelete(showDeleteConfirm)}>
                  {text.delete}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ID Card Modal */}
      <AnimatePresence>
        {showIdCard && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowIdCard(null)}
          >
            <motion.div
              className="modal-content id-card-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>{text.membershipCard}</h2>
                <button className="close-btn" onClick={() => setShowIdCard(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Printable ID Card */}
              <div className="id-card-wrapper">
                <div className="elite-id-card" id="elite-id-card">
                  {/* Card Front */}
                  <div className="id-card-front">
                    {/* Green Header with Logos */}
                    <div className="id-card-header">
                      <img src="/fablab.png" alt="FABLAB" className="id-logo fablab-logo" />
                      <div className="id-header-text">
                        <span className="id-header-title">FABLAB Al-Ahsa</span>
                        <span className="id-header-subtitle">{text.eliteMember}</span>
                      </div>
                      <img src="/found.png" alt="Foundation" className="id-logo found-logo" />
                    </div>

                    {/* Card Body - RTL Layout */}
                    <div className="id-card-body" dir="rtl">
                      {/* Profile Photo - Right Side */}
                      <div className="id-photo-section">
                        {showIdCard.profilePicture ? (
                          <img src={showIdCard.profilePicture} alt="" className="id-photo" />
                        ) : (
                          <div className="id-photo-placeholder">
                            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Member Info - Left Side, Right Aligned */}
                      <div className="id-info-section">
                        <div className="id-name">{showIdCard.firstName} {showIdCard.lastName}</div>
                        <div className="id-member-number">{showIdCard.uniqueId}</div>
                        <div className="id-details">
                          <div className="id-detail-row">
                            <span className="id-label">الهوية:</span>
                            <span className="id-value">{showIdCard.nationalId}</span>
                          </div>
                          <div className="id-detail-row">
                            <span className="id-label">الهاتف:</span>
                            <span className="id-value">{showIdCard.phoneNumber}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer - RTL */}
                    <div className="id-card-footer" dir="rtl">
                      <div className="id-valid-date">
                        <span>:تاريخ الانضمام</span>
                        <span>{formatDate(showIdCard.createdAt)}</span>
                      </div>
                      <div className="id-star-badge">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn-print" onClick={() => {
                  const printContent = document.getElementById('elite-id-card');
                  const printWindow = window.open('', '', 'width=600,height=400');
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Elite Member ID Card</title>
                        <style>
                          @page { size: 85.6mm 53.98mm; margin: 0; }
                          * { margin: 0; padding: 0; box-sizing: border-box; }
                          body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            background: #f0f0f0;
                          }
                          .elite-id-card {
                            width: 85.6mm;
                            height: 53.98mm;
                            background: white;
                            border-radius: 10px;
                            overflow: hidden;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                          }
                          .id-card-front {
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                          }
                          .id-card-header {
                            background: linear-gradient(135deg, #006c35 0%, #00a651 100%);
                            padding: 8px 12px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 8px;
                          }
                          .id-logo {
                            width: 35px;
                            height: 35px;
                            object-fit: contain;
                            background: white;
                            border-radius: 6px;
                            padding: 3px;
                          }
                          .id-header-text {
                            flex: 1;
                            text-align: center;
                            color: white;
                          }
                          .id-header-title {
                            display: block;
                            font-size: 12px;
                            font-weight: 700;
                            letter-spacing: 0.5px;
                          }
                          .id-header-subtitle {
                            display: block;
                            font-size: 9px;
                            opacity: 0.9;
                            margin-top: 2px;
                          }
                          .id-card-body {
                            flex: 1;
                            display: flex;
                            padding: 10px 12px;
                            gap: 12px;
                            background: linear-gradient(180deg, #f8fdf9 0%, #ffffff 100%);
                            direction: rtl;
                          }
                          .id-photo-section {
                            flex-shrink: 0;
                          }
                          .id-photo {
                            width: 80px;
                            height: 95px;
                            object-fit: cover;
                            border-radius: 6px;
                            border: 2px solid #006c35;
                          }
                          .id-photo-placeholder {
                            width: 80px;
                            height: 95px;
                            background: #e8f5e9;
                            border: 2px solid #006c35;
                            border-radius: 6px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #006c35;
                          }
                          .id-info-section {
                            flex: 1;
                            display: flex;
                            flex-direction: column;
                            min-width: 0;
                            text-align: right;
                            direction: rtl;
                          }
                          .id-name {
                            font-size: 13px;
                            font-weight: 700;
                            color: #1a1a1a;
                            margin-bottom: 2px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                          }
                          .id-member-number {
                            font-size: 11px;
                            font-weight: 600;
                            color: #006c35;
                            margin-bottom: 6px;
                            letter-spacing: 1px;
                          }
                          .id-details {
                            font-size: 8px;
                            color: #444;
                          }
                          .id-detail-row {
                            display: flex;
                            gap: 4px;
                            margin-bottom: 2px;
                            justify-content: flex-start;
                            direction: rtl;
                          }
                          .id-label {
                            color: #666;
                            font-weight: 500;
                          }
                          .id-value {
                            color: #1a1a1a;
                            font-weight: 600;
                          }
                          .id-card-footer {
                            background: linear-gradient(135deg, #006c35 0%, #00a651 100%);
                            padding: 5px 12px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            direction: rtl;
                          }
                          .id-valid-date {
                            color: white;
                            font-size: 7px;
                            display: flex;
                            flex-direction: column;
                            text-align: right;
                          }
                          .id-star-badge {
                            color: #ffd700;
                          }
                          @media print {
                            body { background: white; }
                            .elite-id-card { box-shadow: none; }
                          }
                        </style>
                      </head>
                      <body>
                        ${printContent.outerHTML}
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                  }, 250);
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  {text.print}
                </button>
                <button className="btn-close" onClick={() => setShowIdCard(null)}>
                  {text.close}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRatingModal(null)}
          >
            <motion.div
              className="modal-content rating-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>{text.addRating} - {showRatingModal.firstName} {showRatingModal.lastName}</h2>
                <button className="close-btn" onClick={() => setShowRatingModal(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{text.raterType}</label>
                  <select
                    value={ratingForm.raterType}
                    onChange={e => setRatingForm({...ratingForm, raterType: e.target.value})}
                  >
                    <option value="admin">{text.adminRating}</option>
                    <option value="engineer">{text.engineerRating}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{text.period}</label>
                  <input
                    type="text"
                    value={ratingForm.period}
                    onChange={e => setRatingForm({...ratingForm, period: e.target.value})}
                    placeholder={isRTL ? 'مثال: يناير 2026' : 'e.g., January 2026'}
                  />
                </div>
                <div className="rating-sliders">
                  <div className="slider-group">
                    <label>{text.attendance} (20%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={ratingForm.attendanceScore}
                      onChange={e => setRatingForm({...ratingForm, attendanceScore: parseInt(e.target.value)})}
                    />
                    <span className="slider-value">{ratingForm.attendanceScore}%</span>
                  </div>
                  <div className="slider-group">
                    <label>{text.projectQuality} (25%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={ratingForm.projectQualityScore}
                      onChange={e => setRatingForm({...ratingForm, projectQualityScore: parseInt(e.target.value)})}
                    />
                    <span className="slider-value">{ratingForm.projectQualityScore}%</span>
                  </div>
                  <div className="slider-group">
                    <label>{text.development} (20%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={ratingForm.developmentScore}
                      onChange={e => setRatingForm({...ratingForm, developmentScore: parseInt(e.target.value)})}
                    />
                    <span className="slider-value">{ratingForm.developmentScore}%</span>
                  </div>
                  <div className="slider-group">
                    <label>{text.participation} (15%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={ratingForm.participationScore}
                      onChange={e => setRatingForm({...ratingForm, participationScore: parseInt(e.target.value)})}
                    />
                    <span className="slider-value">{ratingForm.participationScore}%</span>
                  </div>
                  <div className="slider-group">
                    <label>{text.teamwork} (10%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={ratingForm.teamworkScore}
                      onChange={e => setRatingForm({...ratingForm, teamworkScore: parseInt(e.target.value)})}
                    />
                    <span className="slider-value">{ratingForm.teamworkScore}%</span>
                  </div>
                  <div className="slider-group">
                    <label>{text.behavior} (10%)</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={ratingForm.behaviorScore}
                      onChange={e => setRatingForm({...ratingForm, behaviorScore: parseInt(e.target.value)})}
                    />
                    <span className="slider-value">{ratingForm.behaviorScore}%</span>
                  </div>
                </div>
                <div className="calculated-total">
                  <span>{text.totalScore}:</span>
                  <span className="total-value">
                    {(
                      (ratingForm.attendanceScore * 0.20) +
                      (ratingForm.projectQualityScore * 0.25) +
                      (ratingForm.developmentScore * 0.20) +
                      (ratingForm.participationScore * 0.15) +
                      (ratingForm.teamworkScore * 0.10) +
                      (ratingForm.behaviorScore * 0.10)
                    ).toFixed(2)}%
                  </span>
                </div>
                <div className="form-group">
                  <label>{text.notes}</label>
                  <textarea
                    value={ratingForm.notes}
                    onChange={e => setRatingForm({...ratingForm, notes: e.target.value})}
                    rows="3"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-submit" onClick={handleSubmitRating}>
                  {text.submit}
                </button>
                <button className="btn-close" onClick={() => setShowRatingModal(null)}>
                  {text.cancel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credit Modal */}
      <AnimatePresence>
        {showCreditModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreditModal(null)}
          >
            <motion.div
              className="modal-content credit-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>{text.addCredit} - {showCreditModal.firstName} {showCreditModal.lastName}</h2>
                <button className="close-btn" onClick={() => setShowCreditModal(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{text.raterType}</label>
                  <div className="credit-type-toggle">
                    <button
                      className={`type-btn award ${creditForm.type === 'award' ? 'active' : ''}`}
                      onClick={() => setCreditForm({...creditForm, type: 'award'})}
                    >
                      + {text.award}
                    </button>
                    <button
                      className={`type-btn deduction ${creditForm.type === 'deduction' ? 'active' : ''}`}
                      onClick={() => setCreditForm({...creditForm, type: 'deduction'})}
                    >
                      - {text.deduction}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>{text.source}</label>
                  <select
                    value={creditForm.source}
                    onChange={e => setCreditForm({...creditForm, source: e.target.value})}
                  >
                    <option value="admin">{isRTL ? 'إداري' : 'Admin'}</option>
                    <option value="engineer">{isRTL ? 'مهندس' : 'Engineer'}</option>
                    <option value="system">{isRTL ? 'النظام' : 'System'}</option>
                    <option value="task">{isRTL ? 'مهمة' : 'Task'}</option>
                    <option value="course">{isRTL ? 'دورة' : 'Course'}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{text.points}</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={creditForm.points}
                    onChange={e => setCreditForm({...creditForm, points: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div className="form-group">
                  <label>{text.reason}</label>
                  <textarea
                    value={creditForm.reason}
                    onChange={e => setCreditForm({...creditForm, reason: e.target.value})}
                    rows="3"
                    placeholder={isRTL ? 'سبب المنحة أو الخصم...' : 'Reason for award or deduction...'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-submit" onClick={handleSubmitCredit}>
                  {text.submit}
                </button>
                <button className="btn-close" onClick={() => setShowCreditModal(null)}>
                  {text.cancel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EliteDashboard;
