import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../../config/api';

const ELITE_PASSWORD = 'fabstar123';

const UserLookup = ({ onUserFound, onNewUser }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [elitePassword, setElitePassword] = useState('');
  const [showEducationOptions, setShowEducationOptions] = useState(false);

  const handleEliteAccess = () => {
    if (elitePassword === ELITE_PASSWORD) {
      setShowEliteModal(false);
      setElitePassword('');
      navigate('/elite-registration');
    } else {
      toast.error(isRTL ? 'كلمة المرور غير صحيحة' : 'Incorrect password');
    }
  };

  const handleCheck = async () => {
    if (!identifier.trim()) {
      toast.error(isRTL ? 'الرجاء إدخال رقم الهوية أو رقم الهاتف' : 'Please enter National ID or Phone Number');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/registration/check-user', { identifier: identifier.trim() });

      if (response.data.exists) {
        toast.success(isRTL ? 'مرحباً بعودتك!' : 'Welcome back!');
        onUserFound(response.data.user);
      } else {
        toast.info(isRTL ? 'مستخدم جديد - يرجى إكمال التسجيل' : 'New user - please complete registration');
        onNewUser();
      }
    } catch (error) {
      console.error('Error checking user:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء التحقق' : 'Error checking user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-lookup">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="user-lookup-icon">
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </motion.div>

      <motion.h2
        className="user-lookup-title"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {isRTL ? 'مرحباً بك في فاب لاب الأحساء' : 'Welcome to FABLAB Al-Ahsa'}
      </motion.h2>

      <motion.p
        className="user-lookup-description"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {isRTL
          ? 'أدخل رقم الهوية الوطنية أو رقم الهاتف للتحقق من تسجيلك السابق'
          : 'Enter your National ID or Phone Number to check your previous registration'}
      </motion.p>

      <motion.div
        className="user-lookup-input"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <input
          type="text"
          className="form-input"
          placeholder={isRTL ? 'رقم الهوية أو رقم الهاتف' : 'National ID or Phone Number'}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
          style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
        />
      </motion.div>

      <motion.div
        className="user-lookup-buttons"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button
          className="btn btn-primary"
          onClick={handleCheck}
          disabled={loading}
        >
          {loading ? (
            <span className="loading-spinner" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              {t('search')}
            </>
          )}
        </button>

        <button
          className="btn btn-secondary"
          onClick={onNewUser}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          {isRTL ? 'تسجيل جديد' : 'New Registration'}
        </button>
      </motion.div>

      {/* Borrow Components Button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        style={{ marginTop: '24px', textAlign: 'center' }}
      >
        <button
          onClick={() => navigate('/borrow')}
          style={{
            background: 'linear-gradient(135deg, #1a56db, #2563eb)',
            color: 'white',
            border: 'none',
            padding: '12px 32px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          {isRTL ? 'استعارة مكونات' : 'Borrow Components'}
        </button>
      </motion.div>

      {/* Education Button with Expandable Options */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.65 }}
        style={{ marginTop: '16px', textAlign: 'center' }}
      >
        <button
          onClick={() => setShowEducationOptions(!showEducationOptions)}
          style={{
            background: 'linear-gradient(135deg, #2596be, #2ba8cc)',
            color: 'white',
            border: 'none',
            padding: '12px 32px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(37, 150, 190, 0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          {isRTL ? 'التعليم' : 'Education'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: showEducationOptions ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <AnimatePresence>
          {showEducationOptions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
            >
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                onClick={() => navigate('/educate')}
                style={{
                  background: 'linear-gradient(135deg, #1e7a9a, #2596be)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 28px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 3px 12px rgba(37, 150, 190, 0.25)',
                  transition: 'all 0.3s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                {isRTL ? 'تسجيل المعلم' : 'Teacher Registration'}
              </motion.button>
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => navigate('/educate/students')}
                style={{
                  background: 'linear-gradient(135deg, #2ba8cc, #3bb0d4)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 28px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 3px 12px rgba(37, 150, 190, 0.25)',
                  transition: 'all 0.3s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                {isRTL ? 'تسجيل الطلاب' : 'Student Registration'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Elite Button */}
      <motion.div
        className="elite-button-container"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        style={{ marginTop: '16px', textAlign: 'center' }}
      >
        <button
          className="btn btn-elite"
          onClick={() => setShowEliteModal(true)}
          style={{
            background: 'linear-gradient(135deg, #006c35, #00a651)',
            color: 'white',
            border: 'none',
            padding: '12px 32px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(0, 166, 81, 0.3)',
            transition: 'all 0.3s ease'
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          النخبة
        </button>
      </motion.div>

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
                النخبة
              </h3>
              {/* Login Button for Existing Users */}
              <button
                onClick={() => {
                  setShowEliteModal(false);
                  navigate('/elite/login');
                }}
                style={{
                  width: '100%',
                  background: 'white',
                  color: '#006c35',
                  border: 'none',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                {isRTL ? 'تسجيل الدخول لحسابي' : 'Login to My Account'}
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '16px 0',
                color: 'rgba(255,255,255,0.7)'
              }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
                <span style={{ fontSize: '13px' }}>{isRTL ? 'أو إنشاء حساب جديد' : 'or create new account'}</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
              </div>

              <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '13px' }}>
                {isRTL ? 'أدخل كلمة المرور للتسجيل' : 'Enter password to register'}
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
                  style={{
                    width: '100%',
                    padding: '14px 18px 14px 44px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '16px',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={handleEliteAccess}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.5)',
                    padding: '12px 32px',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {isRTL ? 'تسجيل جديد' : 'Register'}
                </button>
                <button
                  onClick={() => {
                    setShowEliteModal(false);
                    setElitePassword('');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
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

export default UserLookup;
