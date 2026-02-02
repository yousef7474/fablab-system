import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './EliteRegistration.css';

const EliteUserAccount = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('ar');
  const [activeTab, setActiveTab] = useState('performance');
  const [performance, setPerformance] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [credits, setCredits] = useState([]);

  // New states for tasks, works, schedules
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [works, setWorks] = useState([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [showWorkModal, setShowWorkModal] = useState(null); // 'create' or work object for edit
  const [workForm, setWorkForm] = useState({
    title: '',
    description: '',
    category: '',
    documentation: '',
    files: [],
    thumbnail: ''
  });

  const isRTL = language === 'ar';

  // Translations
  const t = {
    ar: {
      elite: 'النخبة',
      myAccount: 'حسابي',
      welcome: 'مرحباً',
      profile: 'الملف الشخصي',
      sessions: 'الجلسات',
      courses: 'الدورات',
      logout: 'تسجيل الخروج',
      memberId: 'رقم العضوية',
      name: 'الاسم',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      nationalId: 'رقم الهوية',
      nationality: 'الجنسية',
      gender: 'الجنس',
      male: 'ذكر',
      female: 'أنثى',
      dateOfBirth: 'تاريخ الميلاد',
      city: 'المدينة',
      organization: 'جهة العمل',
      specialization: 'التخصص',
      bio: 'نبذة تعريفية',
      status: 'الحالة',
      active: 'نشط',
      inactive: 'غير نشط',
      suspended: 'موقوف',
      lastLogin: 'آخر دخول',
      memberSince: 'عضو منذ',
      editProfile: 'تعديل الملف الشخصي',
      comingSoon: 'قريباً',
      sessionsInfo: 'سيتم إضافة الجلسات قريباً',
      coursesInfo: 'سيتم إضافة الدورات قريباً',
      logoutConfirm: 'هل أنت متأكد من تسجيل الخروج؟',
      logoutSuccess: 'تم تسجيل الخروج بنجاح',
      personalInfo: 'المعلومات الشخصية',
      contactInfo: 'معلومات التواصل',
      professionalInfo: 'المعلومات المهنية',
      notProvided: 'غير محدد',
      performance: 'الأداء',
      category: 'الفئة',
      percentage: 'النسبة',
      adminRating: 'تقييم الإدارة',
      engineerRating: 'تقييم المهندس',
      systemCredits: 'النقاط',
      netCredits: 'صافي النقاط',
      categoryA: 'الفئة A - دعم كامل في جميع المجالات',
      categoryB: 'الفئة B - دعم عالي مع بعض القيود',
      categoryC: 'الفئة C - دعم متوسط',
      categoryD: 'الفئة D - دعم أساسي',
      belowD: 'أقل من D - يحتاج إلى تحسين',
      noRatings: 'لا توجد تقييمات بعد',
      noCredits: 'لا توجد نقاط بعد',
      recentRatings: 'التقييمات الأخيرة',
      recentCredits: 'النقاط الأخيرة',
      award: 'منحة',
      deduction: 'خصم',
      attendance: 'الحضور والالتزام',
      projectQuality: 'جودة المشاريع',
      development: 'التطور والتعلم',
      participation: 'المشاركة الفعالة',
      teamwork: 'العمل الجماعي',
      behavior: 'السلوك والأخلاق',
      // New tabs
      myTasks: 'مهامي',
      myWork: 'أعمالي',
      mySchedule: 'جدولي',
      noTasks: 'لا توجد مهام حالياً',
      noWorks: 'لا توجد أعمال حالياً',
      noSchedules: 'لا توجد جداول حالياً',
      pending: 'قيد الانتظار',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتمل',
      cancelled: 'ملغي',
      task: 'مهمة',
      course: 'دورة',
      project: 'مشروع',
      assignment: 'واجب',
      startDate: 'تاريخ البدء',
      endDate: 'تاريخ الانتهاء',
      progress: 'التقدم',
      updateProgress: 'تحديث التقدم',
      addWork: 'إضافة عمل',
      workTitle: 'عنوان العمل',
      description: 'الوصف',
      documentation: 'التوثيق',
      submit: 'إرسال',
      cancel: 'إلغاء',
      draft: 'مسودة',
      submitted: 'مقدم',
      approved: 'معتمد',
      rejected: 'مرفوض',
      session: 'جلسة',
      deadline: 'موعد نهائي',
      meeting: 'اجتماع',
      workshop: 'ورشة عمل',
      other: 'أخرى',
      allDay: 'طوال اليوم',
      online: 'عبر الإنترنت',
      location: 'الموقع',
      scheduled: 'مجدول',
      today: 'اليوم',
      upcoming: 'القادمة',
      creditsEarned: 'النقاط المكتسبة',
      viewDetails: 'عرض التفاصيل',
      files: 'الملفات',
      submitWork: 'تقديم العمل',
      saveAsDraft: 'حفظ كمسودة'
    },
    en: {
      elite: 'Elite',
      myAccount: 'My Account',
      welcome: 'Welcome',
      profile: 'Profile',
      sessions: 'Sessions',
      courses: 'Courses',
      logout: 'Logout',
      memberId: 'Member ID',
      name: 'Name',
      email: 'Email',
      phone: 'Phone Number',
      nationalId: 'National ID',
      nationality: 'Nationality',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      dateOfBirth: 'Date of Birth',
      city: 'City',
      organization: 'Organization',
      specialization: 'Specialization',
      bio: 'Bio',
      status: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      suspended: 'Suspended',
      lastLogin: 'Last Login',
      memberSince: 'Member Since',
      editProfile: 'Edit Profile',
      comingSoon: 'Coming Soon',
      sessionsInfo: 'Sessions will be available soon',
      coursesInfo: 'Courses will be available soon',
      logoutConfirm: 'Are you sure you want to logout?',
      logoutSuccess: 'Logged out successfully',
      personalInfo: 'Personal Information',
      contactInfo: 'Contact Information',
      professionalInfo: 'Professional Information',
      notProvided: 'Not provided',
      performance: 'Performance',
      category: 'Category',
      percentage: 'Percentage',
      adminRating: 'Admin Rating',
      engineerRating: 'Engineer Rating',
      systemCredits: 'Credits',
      netCredits: 'Net Credits',
      categoryA: 'Category A - Full support in all areas',
      categoryB: 'Category B - High support with some limitations',
      categoryC: 'Category C - Medium support',
      categoryD: 'Category D - Basic support',
      belowD: 'Below D - Needs improvement',
      noRatings: 'No ratings yet',
      noCredits: 'No credits yet',
      recentRatings: 'Recent Ratings',
      recentCredits: 'Recent Credits',
      award: 'Award',
      deduction: 'Deduction',
      attendance: 'Attendance & Commitment',
      projectQuality: 'Project Quality',
      development: 'Development & Learning',
      participation: 'Active Participation',
      teamwork: 'Teamwork',
      behavior: 'Behavior & Ethics',
      // New tabs
      myTasks: 'My Tasks',
      myWork: 'My Work',
      mySchedule: 'My Schedule',
      noTasks: 'No tasks yet',
      noWorks: 'No works yet',
      noSchedules: 'No schedules yet',
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      task: 'Task',
      course: 'Course',
      project: 'Project',
      assignment: 'Assignment',
      startDate: 'Start Date',
      endDate: 'End Date',
      progress: 'Progress',
      updateProgress: 'Update Progress',
      addWork: 'Add Work',
      workTitle: 'Work Title',
      description: 'Description',
      documentation: 'Documentation',
      submit: 'Submit',
      cancel: 'Cancel',
      draft: 'Draft',
      submitted: 'Submitted',
      approved: 'Approved',
      rejected: 'Rejected',
      session: 'Session',
      deadline: 'Deadline',
      meeting: 'Meeting',
      workshop: 'Workshop',
      other: 'Other',
      allDay: 'All Day',
      online: 'Online',
      location: 'Location',
      scheduled: 'Scheduled',
      today: 'Today',
      upcoming: 'Upcoming',
      creditsEarned: 'Credits Earned',
      viewDetails: 'View Details',
      files: 'Files',
      submitWork: 'Submit Work',
      saveAsDraft: 'Save as Draft'
    }
  };

  const text = t[language];

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('eliteUser');
    if (!storedUser) {
      navigate('/elite/login');
      return;
    }

    const userData = JSON.parse(storedUser);
    setUser(userData);

    // Fetch fresh user data from server
    const fetchUserData = async () => {
      try {
        const response = await api.get(`/elite/users/${userData.eliteId}`);
        setUser(response.data);
        localStorage.setItem('eliteUser', JSON.stringify(response.data));

        // Fetch performance data
        await fetchPerformanceData(userData.eliteId);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const fetchPerformanceData = async (eliteId) => {
    try {
      const [perfResponse, ratingsResponse, creditsResponse] = await Promise.all([
        api.get(`/elite/performance/${eliteId}`),
        api.get(`/elite/ratings/${eliteId}`),
        api.get(`/elite/credits/${eliteId}`)
      ]);
      setPerformance(perfResponse.data);
      setRatings(ratingsResponse.data.ratings || []);
      setCredits(creditsResponse.data.credits || []);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    }
  };

  // Fetch tasks for user
  const fetchTasks = async (eliteId) => {
    setTasksLoading(true);
    try {
      const response = await api.get(`/elite/tasks/user/${eliteId}`);
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setTasksLoading(false);
    }
  };

  // Fetch works for user
  const fetchWorks = async (eliteId) => {
    setWorksLoading(true);
    try {
      const response = await api.get(`/elite/works/user/${eliteId}`);
      setWorks(response.data.works || []);
    } catch (error) {
      console.error('Error fetching works:', error);
    } finally {
      setWorksLoading(false);
    }
  };

  // Fetch schedules for user
  const fetchSchedules = async (eliteId) => {
    setSchedulesLoading(true);
    try {
      const response = await api.get(`/elite/schedules/user/${eliteId}`);
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setSchedulesLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (user) {
      if (tab === 'tasks' && tasks.length === 0) fetchTasks(user.eliteId);
      if (tab === 'works' && works.length === 0) fetchWorks(user.eliteId);
      if (tab === 'schedules' && schedules.length === 0) fetchSchedules(user.eliteId);
    }
  };

  // Update task progress
  const handleUpdateProgress = async (taskId, progress) => {
    try {
      await api.patch(`/elite/tasks/${taskId}/progress`, { progress });
      toast.success(isRTL ? 'تم تحديث التقدم' : 'Progress updated');
      fetchTasks(user.eliteId);
    } catch (error) {
      console.error('Error updating progress:', error);
      toast.error(isRTL ? 'خطأ في تحديث التقدم' : 'Error updating progress');
    }
  };

  // Create/Update work
  const handleSaveWork = async (status = 'draft') => {
    try {
      if (!workForm.title) {
        toast.error(isRTL ? 'العنوان مطلوب' : 'Title is required');
        return;
      }

      const workData = {
        ...workForm,
        eliteId: user.eliteId,
        status
      };

      if (showWorkModal === 'create') {
        await api.post('/elite/works', workData);
        toast.success(isRTL ? 'تم إضافة العمل بنجاح' : 'Work added successfully');
      } else {
        await api.put(`/elite/works/${showWorkModal.workId}`, workData);
        toast.success(isRTL ? 'تم تحديث العمل بنجاح' : 'Work updated successfully');
      }

      setShowWorkModal(null);
      setWorkForm({
        title: '',
        description: '',
        category: '',
        documentation: '',
        files: [],
        thumbnail: ''
      });
      fetchWorks(user.eliteId);
    } catch (error) {
      console.error('Error saving work:', error);
      toast.error(isRTL ? 'خطأ في حفظ العمل' : 'Error saving work');
    }
  };

  // Submit work for review
  const handleSubmitWork = async (workId) => {
    try {
      await api.patch(`/elite/works/${workId}/submit`);
      toast.success(isRTL ? 'تم تقديم العمل للمراجعة' : 'Work submitted for review');
      fetchWorks(user.eliteId);
    } catch (error) {
      console.error('Error submitting work:', error);
      toast.error(isRTL ? 'خطأ في تقديم العمل' : 'Error submitting work');
    }
  };

  // Get task status badge
  const getTaskStatusBadge = (status) => {
    const config = {
      pending: { label: text.pending, class: 'task-pending' },
      in_progress: { label: text.in_progress, class: 'task-progress' },
      completed: { label: text.completed, class: 'task-completed' },
      cancelled: { label: text.cancelled, class: 'task-cancelled' }
    };
    return config[status] || config.pending;
  };

  // Get work status badge
  const getWorkStatusBadge = (status) => {
    const config = {
      draft: { label: text.draft, class: 'work-draft' },
      submitted: { label: text.submitted, class: 'work-submitted' },
      approved: { label: text.approved, class: 'work-approved' },
      rejected: { label: text.rejected, class: 'work-rejected' }
    };
    return config[status] || config.draft;
  };

  const getCategoryColor = (category) => {
    switch(category) {
      case 'A': return '#22c55e';
      case 'B': return '#3b82f6';
      case 'C': return '#f59e0b';
      case 'D': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getCategoryDescription = (category) => {
    const descriptions = {
      'A': text.categoryA,
      'B': text.categoryB,
      'C': text.categoryC,
      'D': text.categoryD,
      'Below D': text.belowD
    };
    return descriptions[category] || text.belowD;
  };

  const handleLogout = () => {
    if (window.confirm(text.logoutConfirm)) {
      localStorage.removeItem('eliteUser');
      toast.success(text.logoutSuccess);
      navigate('/elite/login');
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return text.active;
      case 'inactive': return text.inactive;
      case 'suspended': return text.suspended;
      default: return status;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'active': return 'status-active';
      case 'inactive': return 'status-inactive';
      case 'suspended': return 'status-suspended';
      default: return '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return text.notProvided;
    return new Date(dateString).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="elite-page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="elite-bg-pattern"></div>
        <div className="elite-floating-orbs">
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
        </div>
        <div className="elite-loading">
          <div className="loading-spinner large"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="elite-page elite-account-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="elite-bg-pattern"></div>

      {/* Animated Background Orbs */}
      <div className="elite-floating-orbs">
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
      </div>

      {/* Language Switch */}
      <motion.div
        className="elite-language-switch"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
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
      </motion.div>

      <div className="elite-account-container">
        {/* Sidebar */}
        <motion.div
          className="elite-sidebar"
          initial={{ x: isRTL ? 50 : -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          {/* User Card */}
          <div className="elite-user-card">
            <div className="elite-user-avatar">
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt={user.firstName} />
              ) : (
                <div className="avatar-placeholder">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </div>
              )}
            </div>
            <h3 className="elite-user-name">{user?.firstName} {user?.lastName}</h3>
            <p className="elite-user-id">{user?.uniqueId}</p>
            <span className={`elite-status-badge ${getStatusClass(user?.status)}`}>
              {getStatusLabel(user?.status)}
            </span>
          </div>

          {/* Navigation */}
          <nav className="elite-nav">
            <button
              className={`elite-nav-item ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => handleTabChange('performance')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              {text.performance}
            </button>
            <button
              className={`elite-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => handleTabChange('tasks')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              {text.myTasks}
            </button>
            <button
              className={`elite-nav-item ${activeTab === 'works' ? 'active' : ''}`}
              onClick={() => handleTabChange('works')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {text.myWork}
            </button>
            <button
              className={`elite-nav-item ${activeTab === 'schedules' ? 'active' : ''}`}
              onClick={() => handleTabChange('schedules')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {text.mySchedule}
            </button>
            <button
              className={`elite-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => handleTabChange('profile')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {text.profile}
            </button>
          </nav>

          {/* Logout Button */}
          <button className="elite-logout-btn" onClick={handleLogout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {text.logout}
          </button>
        </motion.div>

        {/* Main Content */}
        <motion.div
          className="elite-main-content"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* Header */}
          <div className="elite-content-header">
            <div className="elite-logo-small">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div>
              <h1>{text.myAccount}</h1>
              <p>{text.welcome}, {user?.firstName}!</p>
            </div>
          </div>

          {/* Tab Content */}
          <div className="elite-tab-content">
            {activeTab === 'performance' && (
              <motion.div
                className="elite-performance-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Category Badge */}
                {performance && (
                  <div
                    className="elite-category-card"
                    style={{ background: `linear-gradient(135deg, ${getCategoryColor(performance.category)}, ${getCategoryColor(performance.category)}dd)` }}
                  >
                    <div className="category-main">
                      <span className="category-letter">{performance.category}</span>
                      <div className="category-details">
                        <span className="category-percentage">{performance.finalPercentage}%</span>
                        <span className="category-label">{getCategoryDescription(performance.category)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Performance Breakdown */}
                <div className="elite-info-section performance-section">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                    </svg>
                    {text.performance}
                  </h3>
                  {performance && (
                    <div className="performance-bars">
                      <div className="perf-row">
                        <span className="perf-label">{text.adminRating}</span>
                        <div className="perf-bar-track">
                          <div
                            className="perf-bar-fill admin"
                            style={{ width: `${performance.adminRatingAvg}%` }}
                          ></div>
                        </div>
                        <span className="perf-value">{performance.adminRatingAvg}%</span>
                      </div>
                      <div className="perf-row">
                        <span className="perf-label">{text.engineerRating}</span>
                        <div className="perf-bar-track">
                          <div
                            className="perf-bar-fill engineer"
                            style={{ width: `${performance.engineerRatingAvg}%` }}
                          ></div>
                        </div>
                        <span className="perf-value">{performance.engineerRatingAvg}%</span>
                      </div>
                      <div className="perf-row credits-row">
                        <span className="perf-label">{text.systemCredits}</span>
                        <div className="credits-summary">
                          <span className="credit-award">+{performance.totalAwards}</span>
                          <span className="credit-deduct">-{performance.totalDeductions}</span>
                          <span className="credit-net">= {performance.netCredits}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent Ratings */}
                <div className="elite-info-section">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {text.recentRatings}
                  </h3>
                  {ratings.length === 0 ? (
                    <p className="empty-message">{text.noRatings}</p>
                  ) : (
                    <div className="ratings-grid">
                      {ratings.slice(0, 4).map(rating => (
                        <div key={rating.ratingId} className="rating-item">
                          <div className="rating-item-header">
                            <span className="rating-type-badge">
                              {rating.raterType === 'admin' ? text.adminRating : text.engineerRating}
                            </span>
                            <span className="rating-score">{rating.totalScore}%</span>
                          </div>
                          <span className="rating-period">{rating.period}</span>
                          <div className="rating-scores-mini">
                            <div className="score-mini">
                              <span>{text.attendance}</span>
                              <span>{rating.attendanceScore}%</span>
                            </div>
                            <div className="score-mini">
                              <span>{text.projectQuality}</span>
                              <span>{rating.projectQualityScore}%</span>
                            </div>
                            <div className="score-mini">
                              <span>{text.development}</span>
                              <span>{rating.developmentScore}%</span>
                            </div>
                            <div className="score-mini">
                              <span>{text.participation}</span>
                              <span>{rating.participationScore}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Credits */}
                <div className="elite-info-section">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    {text.recentCredits}
                  </h3>
                  {credits.length === 0 ? (
                    <p className="empty-message">{text.noCredits}</p>
                  ) : (
                    <div className="credits-grid">
                      {credits.slice(0, 6).map(credit => (
                        <div key={credit.creditId} className={`credit-item ${credit.type}`}>
                          <div className="credit-item-header">
                            <span className={`credit-points ${credit.type}`}>
                              {credit.type === 'award' ? '+' : '-'}{credit.points}
                            </span>
                            <span className="credit-source-badge">{credit.source}</span>
                          </div>
                          <p className="credit-reason">{credit.reason}</p>
                          <span className="credit-date">{formatDate(credit.creditDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div
                className="elite-profile-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Personal Info Section */}
                <div className="elite-info-section">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    {text.personalInfo}
                  </h3>
                  <div className="elite-info-grid">
                    <div className="elite-info-item">
                      <span className="info-label">{text.memberId}</span>
                      <span className="info-value highlight">{user?.uniqueId}</span>
                    </div>
                    <div className="elite-info-item">
                      <span className="info-label">{text.name}</span>
                      <span className="info-value">{user?.firstName} {user?.lastName}</span>
                    </div>
                    <div className="elite-info-item">
                      <span className="info-label">{text.nationalId}</span>
                      <span className="info-value">{user?.nationalId || text.notProvided}</span>
                    </div>
                    <div className="elite-info-item">
                      <span className="info-label">{text.nationality}</span>
                      <span className="info-value">{user?.nationality || text.notProvided}</span>
                    </div>
                    <div className="elite-info-item">
                      <span className="info-label">{text.gender}</span>
                      <span className="info-value">
                        {user?.sex === 'male' ? text.male : user?.sex === 'female' ? text.female : text.notProvided}
                      </span>
                    </div>
                    <div className="elite-info-item">
                      <span className="info-label">{text.dateOfBirth}</span>
                      <span className="info-value">{formatDate(user?.dateOfBirth)}</span>
                    </div>
                  </div>
                </div>

                {/* Contact Info Section */}
                <div className="elite-info-section">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {text.contactInfo}
                  </h3>
                  <div className="elite-info-grid">
                    <div className="elite-info-item">
                      <span className="info-label">{text.email}</span>
                      <span className="info-value">{user?.email}</span>
                    </div>
                    <div className="elite-info-item">
                      <span className="info-label">{text.phone}</span>
                      <span className="info-value">{user?.phoneNumber}</span>
                    </div>
                    <div className="elite-info-item">
                      <span className="info-label">{text.city}</span>
                      <span className="info-value">{user?.city || text.notProvided}</span>
                    </div>
                  </div>
                </div>

                {/* Professional Info Section */}
                <div className="elite-info-section">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    {text.professionalInfo}
                  </h3>
                  <div className="elite-info-grid">
                    <div className="elite-info-item">
                      <span className="info-label">{text.organization}</span>
                      <span className="info-value">{user?.organization || text.notProvided}</span>
                    </div>
                    <div className="elite-info-item">
                      <span className="info-label">{text.specialization}</span>
                      <span className="info-value">{user?.specialization || text.notProvided}</span>
                    </div>
                    <div className="elite-info-item full-width">
                      <span className="info-label">{text.bio}</span>
                      <span className="info-value bio">{user?.bio || text.notProvided}</span>
                    </div>
                  </div>
                </div>

                {/* Membership Info */}
                <div className="elite-membership-info">
                  <div className="membership-item">
                    <span>{text.memberSince}</span>
                    <strong>{formatDate(user?.createdAt)}</strong>
                  </div>
                  <div className="membership-item">
                    <span>{text.lastLogin}</span>
                    <strong>{formatDate(user?.lastLogin)}</strong>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <motion.div
                className="elite-tasks-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="elite-info-section">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4"/>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    {text.myTasks}
                  </h3>

                  {tasksLoading ? (
                    <div className="elite-loading-small">
                      <div className="loading-spinner"></div>
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="elite-empty-state">
                      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                      </svg>
                      <p>{text.noTasks}</p>
                    </div>
                  ) : (
                    <div className="elite-tasks-list">
                      {tasks.map(task => {
                        const statusBadge = getTaskStatusBadge(task.status);
                        return (
                          <div key={task.taskId} className="elite-task-card">
                            <div className="task-header">
                              <span className={`task-type-badge ${task.type}`}>
                                {text[task.type] || task.type}
                              </span>
                              <span className={`task-status-badge ${statusBadge.class}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                            <h4 className="task-title">{task.title}</h4>
                            {task.description && (
                              <p className="task-description">{task.description}</p>
                            )}
                            <div className="task-progress-section">
                              <div className="progress-header">
                                <span>{text.progress}</span>
                                <span>{task.progress || 0}%</span>
                              </div>
                              <div className="progress-bar-track">
                                <div
                                  className="progress-bar-fill"
                                  style={{ width: `${task.progress || 0}%` }}
                                ></div>
                              </div>
                              {task.status !== 'completed' && task.status !== 'cancelled' && (
                                <div className="progress-slider">
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={task.progress || 0}
                                    onChange={(e) => handleUpdateProgress(task.taskId, parseInt(e.target.value))}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="task-footer">
                              <div className="task-dates">
                                {task.endDate && (
                                  <span className="task-date">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                      <line x1="16" y1="2" x2="16" y2="6"/>
                                      <line x1="8" y1="2" x2="8" y2="6"/>
                                      <line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                    {formatDate(task.endDate)}
                                  </span>
                                )}
                              </div>
                              {task.creditsAwarded > 0 && (
                                <span className="task-credits">
                                  +{task.creditsAwarded} {text.creditsEarned}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Works Tab */}
            {activeTab === 'works' && (
              <motion.div
                className="elite-works-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="elite-info-section">
                  <div className="section-header-with-action">
                    <h3>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      {text.myWork}
                    </h3>
                    <button
                      className="elite-add-btn"
                      onClick={() => {
                        setWorkForm({
                          title: '',
                          description: '',
                          category: '',
                          documentation: '',
                          files: [],
                          thumbnail: ''
                        });
                        setShowWorkModal('create');
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      {text.addWork}
                    </button>
                  </div>

                  {worksLoading ? (
                    <div className="elite-loading-small">
                      <div className="loading-spinner"></div>
                    </div>
                  ) : works.length === 0 ? (
                    <div className="elite-empty-state">
                      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <p>{text.noWorks}</p>
                    </div>
                  ) : (
                    <div className="elite-works-grid">
                      {works.map(work => {
                        const statusBadge = getWorkStatusBadge(work.status);
                        return (
                          <div key={work.workId} className="elite-work-card">
                            <div className="work-thumbnail">
                              {work.thumbnail ? (
                                <img src={work.thumbnail} alt={work.title} />
                              ) : (
                                <div className="thumbnail-placeholder">
                                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="work-info">
                              <h4>{work.title}</h4>
                              {work.category && <span className="work-category">{work.category}</span>}
                              <span className={`work-status-badge ${statusBadge.class}`}>
                                {statusBadge.label}
                              </span>
                            </div>
                            <div className="work-actions">
                              {work.status === 'draft' && (
                                <>
                                  <button
                                    className="work-edit-btn"
                                    onClick={() => {
                                      setWorkForm({
                                        title: work.title,
                                        description: work.description || '',
                                        category: work.category || '',
                                        documentation: work.documentation || '',
                                        files: work.files || [],
                                        thumbnail: work.thumbnail || ''
                                      });
                                      setShowWorkModal(work);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                  <button
                                    className="work-submit-btn"
                                    onClick={() => handleSubmitWork(work.workId)}
                                  >
                                    {text.submitWork}
                                  </button>
                                </>
                              )}
                              {work.status === 'rejected' && (
                                <button
                                  className="work-submit-btn"
                                  onClick={() => handleSubmitWork(work.workId)}
                                >
                                  {text.submitWork}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Schedules Tab */}
            {activeTab === 'schedules' && (
              <motion.div
                className="elite-schedules-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="elite-info-section">
                  <h3>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    {text.mySchedule}
                  </h3>

                  {schedulesLoading ? (
                    <div className="elite-loading-small">
                      <div className="loading-spinner"></div>
                    </div>
                  ) : schedules.length === 0 ? (
                    <div className="elite-empty-state">
                      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <p>{text.noSchedules}</p>
                    </div>
                  ) : (
                    <div className="elite-schedules-list">
                      {schedules.map(schedule => {
                        const isToday = new Date(schedule.date).toDateString() === new Date().toDateString();
                        return (
                          <div
                            key={schedule.scheduleId}
                            className={`elite-schedule-card ${isToday ? 'today' : ''}`}
                            style={{ borderLeftColor: schedule.color || '#006c35' }}
                          >
                            <div className="schedule-date-badge" style={{ backgroundColor: schedule.color || '#006c35' }}>
                              <span className="date-day">{new Date(schedule.date).getDate()}</span>
                              <span className="date-month">
                                {new Date(schedule.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short' })}
                              </span>
                              {isToday && <span className="today-badge">{text.today}</span>}
                            </div>
                            <div className="schedule-content">
                              <div className="schedule-header">
                                <span className={`schedule-type-badge ${schedule.type}`}>
                                  {text[schedule.type] || schedule.type}
                                </span>
                                {schedule.isAllDay && (
                                  <span className="all-day-badge">{text.allDay}</span>
                                )}
                              </div>
                              <h4 className="schedule-title">{schedule.title}</h4>
                              {schedule.description && (
                                <p className="schedule-description">{schedule.description}</p>
                              )}
                              <div className="schedule-footer">
                                {!schedule.isAllDay && schedule.startTime && (
                                  <span className="schedule-time">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10"/>
                                      <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    {schedule.startTime} {schedule.endTime && `- ${schedule.endTime}`}
                                  </span>
                                )}
                                {schedule.isOnline ? (
                                  <span className="schedule-online">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                      <circle cx="12" cy="13" r="4"/>
                                    </svg>
                                    {text.online}
                                  </span>
                                ) : schedule.location && (
                                  <span className="schedule-location">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                      <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {schedule.location}
                                  </span>
                                )}
                              </div>
                              {schedule.isOnline && schedule.onlineLink && (
                                <a
                                  href={schedule.onlineLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="join-link"
                                >
                                  {isRTL ? 'انضم للاجتماع' : 'Join Meeting'}
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Work Modal */}
      <AnimatePresence>
        {showWorkModal && (
          <motion.div
            className="elite-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowWorkModal(null)}
          >
            <motion.div
              className="elite-modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="elite-modal-header">
                <h2>{showWorkModal === 'create' ? text.addWork : (isRTL ? 'تعديل العمل' : 'Edit Work')}</h2>
                <button className="elite-modal-close" onClick={() => setShowWorkModal(null)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="elite-modal-body">
                <div className="elite-form-group">
                  <label>{text.workTitle} *</label>
                  <input
                    type="text"
                    value={workForm.title}
                    onChange={e => setWorkForm({...workForm, title: e.target.value})}
                    placeholder={isRTL ? 'أدخل عنوان العمل' : 'Enter work title'}
                  />
                </div>
                <div className="elite-form-group">
                  <label>{isRTL ? 'الفئة' : 'Category'}</label>
                  <input
                    type="text"
                    value={workForm.category}
                    onChange={e => setWorkForm({...workForm, category: e.target.value})}
                    placeholder={isRTL ? 'مثال: برمجة، تصميم' : 'e.g., Programming, Design'}
                  />
                </div>
                <div className="elite-form-group">
                  <label>{text.description}</label>
                  <textarea
                    value={workForm.description}
                    onChange={e => setWorkForm({...workForm, description: e.target.value})}
                    rows="3"
                    placeholder={isRTL ? 'وصف مختصر للعمل' : 'Brief description of the work'}
                  />
                </div>
                <div className="elite-form-group">
                  <label>{text.documentation}</label>
                  <textarea
                    value={workForm.documentation}
                    onChange={e => setWorkForm({...workForm, documentation: e.target.value})}
                    rows="5"
                    placeholder={isRTL ? 'توثيق تفصيلي للعمل والخطوات المتبعة' : 'Detailed documentation of the work and steps taken'}
                  />
                </div>
              </div>
              <div className="elite-modal-footer">
                <button
                  className="elite-btn-secondary"
                  onClick={() => handleSaveWork('draft')}
                >
                  {text.saveAsDraft}
                </button>
                <button
                  className="elite-btn-primary"
                  onClick={() => handleSaveWork('submitted')}
                >
                  {text.submitWork}
                </button>
                <button
                  className="elite-btn-cancel"
                  onClick={() => setShowWorkModal(null)}
                >
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

export default EliteUserAccount;
