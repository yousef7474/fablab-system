import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../../config/api';

const UserLookup = ({ onUserFound, onNewUser }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

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
    </div>
  );
};

export default UserLookup;
