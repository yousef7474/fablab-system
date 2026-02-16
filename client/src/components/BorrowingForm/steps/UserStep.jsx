import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../../config/api';

const UserStep = ({ formData, onChange, onNext }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userFound, setUserFound] = useState(false);

  const handleCheck = async () => {
    if (!identifier.trim()) {
      toast.error(isRTL ? 'الرجاء إدخال رقم الهوية أو رقم الهاتف' : 'Please enter National ID or Phone Number');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/borrowing/check-user', { identifier: identifier.trim() });

      if (response.data.exists) {
        const user = response.data.user;
        onChange({
          existingUserId: user.userId,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          sex: user.sex || '',
          nationality: user.nationality || '',
          nationalId: user.nationalId || '',
          phoneNumber: user.phoneNumber || '',
          email: user.email || ''
        });
        setUserFound(true);
        toast.success(isRTL ? 'مرحباً بعودتك!' : 'Welcome back!');
      } else {
        setIsNewUser(true);
        onChange({ existingUserId: null });
        toast.info(isRTL ? 'مستخدم جديد - يرجى إدخال المعلومات الشخصية' : 'New user - please enter personal information');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء التحقق' : 'Error checking user');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    onChange({ [field]: value });
  };

  const canProceed = () => {
    if (userFound) return true;
    if (isNewUser) {
      return formData.firstName && formData.lastName && formData.phoneNumber && formData.email;
    }
    return false;
  };

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'تحديد الهوية' : 'User Identification'}
      </h2>
      <p className="step-description">
        {isRTL ? 'أدخل رقم الهوية الوطنية أو رقم الهاتف للتحقق من بياناتك' : 'Enter your National ID or Phone Number to verify your information'}
      </p>

      {!isNewUser && !userFound && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="form-group">
            <label className="form-label">
              {isRTL ? 'رقم الهوية أو رقم الهاتف' : 'National ID or Phone Number'}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={isRTL ? 'أدخل رقم الهوية أو رقم الهاتف' : 'Enter National ID or Phone Number'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button className="btn btn-primary" onClick={handleCheck} disabled={loading}>
              {loading ? <span className="loading-spinner" /> : (isRTL ? 'بحث' : 'Search')}
            </button>
            <button className="btn btn-secondary" onClick={() => { setIsNewUser(true); onChange({ existingUserId: null }); }}>
              {isRTL ? 'مستخدم جديد' : 'New User'}
            </button>
          </div>
        </motion.div>
      )}

      {userFound && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ background: '#d4edda', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
            <p style={{ color: '#155724', fontWeight: '600', margin: 0 }}>
              {isRTL ? `مرحباً ${formData.firstName} ${formData.lastName}` : `Welcome ${formData.firstName} ${formData.lastName}`}
            </p>
            <p style={{ color: '#155724', margin: '4px 0 0 0', fontSize: '14px' }}>
              {isRTL ? `رقم الهاتف: ${formData.phoneNumber} | البريد: ${formData.email}` : `Phone: ${formData.phoneNumber} | Email: ${formData.email}`}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => { setUserFound(false); setIdentifier(''); onChange({ existingUserId: null, firstName: '', lastName: '', phoneNumber: '', email: '', sex: '', nationality: '', nationalId: '' }); }}>
            {isRTL ? 'بحث عن مستخدم آخر' : 'Search for another user'}
          </button>
        </motion.div>
      )}

      {isNewUser && !userFound && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{isRTL ? 'الاسم الأول *' : 'First Name *'}</label>
              <input type="text" className="form-input" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} style={{ textAlign: isRTL ? 'right' : 'left' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'اسم العائلة *' : 'Last Name *'}</label>
              <input type="text" className="form-input" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} style={{ textAlign: isRTL ? 'right' : 'left' }} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{isRTL ? 'الجنس' : 'Gender'}</label>
              <select className="form-input" value={formData.sex} onChange={(e) => handleChange('sex', e.target.value)}>
                <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'الجنسية' : 'Nationality'}</label>
              <input type="text" className="form-input" value={formData.nationality} onChange={(e) => handleChange('nationality', e.target.value)} style={{ textAlign: isRTL ? 'right' : 'left' }} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{isRTL ? 'رقم الهوية' : 'National ID'}</label>
            <input type="text" className="form-input" value={formData.nationalId} onChange={(e) => handleChange('nationalId', e.target.value)} style={{ textAlign: isRTL ? 'right' : 'left' }} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{isRTL ? 'رقم الهاتف *' : 'Phone Number *'}</label>
              <input type="tel" className="form-input" value={formData.phoneNumber} onChange={(e) => handleChange('phoneNumber', e.target.value)} style={{ textAlign: isRTL ? 'right' : 'left' }} />
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
              <input type="email" className="form-input" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} style={{ textAlign: isRTL ? 'right' : 'left' }} />
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => { setIsNewUser(false); }} style={{ marginTop: '8px' }}>
            {isRTL ? 'لدي حساب سابق' : 'I have an existing account'}
          </button>
        </motion.div>
      )}

      <div className="form-navigation" style={{ marginTop: '24px' }}>
        <div></div>
        <button className="btn btn-primary" onClick={onNext} disabled={!canProceed()}>
          {isRTL ? 'التالي' : 'Next'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default UserStep;
