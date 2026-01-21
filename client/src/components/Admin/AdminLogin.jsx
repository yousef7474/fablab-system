import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './Admin.css';

const ELITE_PASSWORD = 'fabstar123';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [elitePassword, setElitePassword] = useState('');

  const handleEliteAccess = () => {
    if (elitePassword === ELITE_PASSWORD) {
      setShowEliteModal(false);
      setElitePassword('');
      navigate('/elite-dashboard');
    } else {
      toast.error(isRTL ? 'كلمة المرور غير صحيحة' : 'Incorrect password');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/admin/login', formData);
      localStorage.setItem('adminToken', response.data.token);
      localStorage.setItem('adminData', JSON.stringify(response.data.admin));
      toast.success(isRTL ? 'تم تسجيل الدخول بنجاح!' : 'Login successful!');

      // Redirect based on role
      if (response.data.admin.role === 'manager') {
        navigate('/manager/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.response?.data?.message || (isRTL ? 'فشل تسجيل الدخول' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="admin-login-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="admin-login-container">
        <motion.div
          className="admin-login-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="admin-login-header">
            <div className="admin-login-logo">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1>{isRTL ? 'لوحة التحكم' : 'Admin Panel'}</h1>
            <p>FABLAB Al-Ahsa</p>
          </div>

          <form onSubmit={handleSubmit} className="admin-login-form">
            <div className="admin-form-group">
              <label>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                {isRTL ? 'اسم المستخدم' : 'Username'}
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder={isRTL ? 'أدخل اسم المستخدم' : 'Enter username'}
                required
                autoFocus
              />
            </div>

            <div className="admin-form-group">
              <label>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                {isRTL ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={isRTL ? 'أدخل كلمة المرور' : 'Enter password'}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="admin-login-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner" />
                  {isRTL ? 'جاري تسجيل الدخول...' : 'Signing in...'}
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  {isRTL ? 'تسجيل الدخول' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="admin-login-footer">
            <button className="back-link" onClick={() => navigate('/')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6"/>
              </svg>
              {isRTL ? 'العودة للتسجيل' : 'Back to Registration'}
            </button>

            <button className="lang-toggle" onClick={toggleLanguage}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {i18n.language === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>

          {/* Elite Dashboard Button */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setShowEliteModal(true)}
              style={{
                background: 'linear-gradient(135deg, #006c35, #00a651)',
                color: 'white',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0, 166, 81, 0.3)',
                transition: 'all 0.3s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              {isRTL ? 'لوحة النخبة' : 'Elite Dashboard'}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Elite Password Modal */}
      <AnimatePresence>
        {showEliteModal && (
          <motion.div
            className="elite-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEliteModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <motion.div
              className="elite-modal"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #006c35, #00a651)',
                borderRadius: '20px',
                padding: '32px',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <h3 style={{ color: 'white', fontSize: '24px', marginBottom: '8px', fontWeight: '700' }}>
                {isRTL ? 'لوحة النخبة' : 'Elite Dashboard'}
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '24px', fontSize: '14px' }}>
                {isRTL ? 'أدخل كلمة المرور للدخول' : 'Enter password to access'}
              </p>
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none'
                  }}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  placeholder={isRTL ? '● ● ● ● ● ●' : '● ● ● ● ● ●'}
                  value={elitePassword}
                  onChange={(e) => setElitePassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleEliteAccess()}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '14px 18px 14px 44px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '16px',
                    textAlign: 'center',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={handleEliteAccess}
                  style={{
                    background: 'white',
                    color: '#006c35',
                    border: 'none',
                    padding: '12px 32px',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {isRTL ? 'دخول' : 'Enter'}
                </button>
                <button
                  onClick={() => {
                    setShowEliteModal(false);
                    setElitePassword('');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.3)',
                    padding: '12px 32px',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLogin;
