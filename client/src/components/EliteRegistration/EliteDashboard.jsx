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
      print: 'طباعة'
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
      print: 'Print'
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
    return format(new Date(date), 'dd MMM yyyy', { locale: isRTL ? ar : enUS });
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
            <button className="back-btn" onClick={() => navigate('/')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
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
                            onClick={() => setSelectedUser(user)}
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
              <div className="modal-body">
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

                    {/* Card Body */}
                    <div className="id-card-body">
                      {/* Profile Photo */}
                      <div className="id-photo-section">
                        {showIdCard.profilePicture ? (
                          <img src={showIdCard.profilePicture} alt="" className="id-photo" />
                        ) : (
                          <div className="id-photo-placeholder">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                              <circle cx="12" cy="7" r="4"/>
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Member Info */}
                      <div className="id-info-section">
                        <div className="id-name">{showIdCard.firstName} {showIdCard.lastName}</div>
                        <div className="id-member-number">{showIdCard.uniqueId}</div>
                        <div className="id-details">
                          <div className="id-detail-row">
                            <span className="id-label">{isRTL ? 'الهوية:' : 'ID:'}</span>
                            <span className="id-value">{showIdCard.nationalId}</span>
                          </div>
                          <div className="id-detail-row">
                            <span className="id-label">{isRTL ? 'الهاتف:' : 'Phone:'}</span>
                            <span className="id-value" dir="ltr">{showIdCard.phoneNumber}</span>
                          </div>
                          {showIdCard.organization && (
                            <div className="id-detail-row">
                              <span className="id-label">{isRTL ? 'المنظمة:' : 'Org:'}</span>
                              <span className="id-value">{showIdCard.organization}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="id-card-footer">
                      <div className="id-valid-date">
                        <span>{isRTL ? 'تاريخ الانضمام:' : 'Member Since:'}</span>
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
                          }
                          .id-photo-section {
                            flex-shrink: 0;
                          }
                          .id-photo {
                            width: 55px;
                            height: 65px;
                            object-fit: cover;
                            border-radius: 6px;
                            border: 2px solid #006c35;
                          }
                          .id-photo-placeholder {
                            width: 55px;
                            height: 65px;
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
                          }
                          .id-valid-date {
                            color: white;
                            font-size: 7px;
                            display: flex;
                            flex-direction: column;
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
    </div>
  );
};

export default EliteDashboard;
