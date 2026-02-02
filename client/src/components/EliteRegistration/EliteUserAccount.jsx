import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
      behavior: 'السلوك والأخلاق'
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
      behavior: 'Behavior & Ethics'
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
              onClick={() => setActiveTab('performance')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              {text.performance}
            </button>
            <button
              className={`elite-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {text.profile}
            </button>
            <button
              className={`elite-nav-item ${activeTab === 'sessions' ? 'active' : ''}`}
              onClick={() => setActiveTab('sessions')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {text.sessions}
            </button>
            <button
              className={`elite-nav-item ${activeTab === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('courses')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              {text.courses}
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

            {activeTab === 'sessions' && (
              <motion.div
                className="elite-coming-soon"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="coming-soon-icon">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <path d="M8 14h.01"/>
                    <path d="M12 14h.01"/>
                    <path d="M16 14h.01"/>
                    <path d="M8 18h.01"/>
                    <path d="M12 18h.01"/>
                  </svg>
                </div>
                <h2>{text.comingSoon}</h2>
                <p>{text.sessionsInfo}</p>
              </motion.div>
            )}

            {activeTab === 'courses' && (
              <motion.div
                className="elite-coming-soon"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="coming-soon-icon">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    <line x1="9" y1="7" x2="15" y2="7"/>
                    <line x1="9" y1="11" x2="15" y2="11"/>
                    <line x1="9" y1="15" x2="12" y2="15"/>
                  </svg>
                </div>
                <h2>{text.comingSoon}</h2>
                <p>{text.coursesInfo}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EliteUserAccount;
