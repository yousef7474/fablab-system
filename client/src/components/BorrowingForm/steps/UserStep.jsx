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
        <motion.div className="bfx-lookup" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="bfx-identifier">
              {isRTL ? 'رقم الهوية أو رقم الهاتف' : 'National ID or Phone Number'}
            </label>
            <input
              id="bfx-identifier"
              type="text"
              className="form-input"
              placeholder={isRTL ? 'أدخل رقم الهوية أو رقم الهاتف' : 'Enter National ID or Phone Number'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            />
          </div>
          <div className="bfx-lookup-actions">
            <button className="btn btn-primary" onClick={handleCheck} disabled={loading}>
              {loading ? <span className="loading-spinner" /> : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  {isRTL ? 'بحث' : 'Search'}
                </>
              )}
            </button>
            <button className="btn btn-secondary" onClick={() => { setIsNewUser(true); onChange({ existingUserId: null }); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>
              {isRTL ? 'مستخدم جديد' : 'New User'}
            </button>
          </div>
        </motion.div>
      )}

      {userFound && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bfx-found">
            <span className="bfx-found-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <div>
              <b>{isRTL ? `مرحباً ${formData.firstName} ${formData.lastName}` : `Welcome ${formData.firstName} ${formData.lastName}`}</b>
              <small>
                <span dir="ltr">{formData.phoneNumber}</span>
                {formData.email ? <> · <span dir="ltr">{formData.email}</span></> : null}
              </small>
            </div>
          </div>
          <button
            className="btn btn-secondary bfx-inline-btn"
            onClick={() => { setUserFound(false); setIdentifier(''); onChange({ existingUserId: null, firstName: '', lastName: '', phoneNumber: '', email: '', sex: '', nationality: '', nationalId: '' }); }}
          >
            {isRTL ? 'بحث عن مستخدم آخر' : 'Search for another user'}
          </button>
        </motion.div>
      )}

      {isNewUser && !userFound && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{isRTL ? 'الاسم الأول' : 'First Name'} <span className="required">*</span></label>
              <input type="text" className="form-input" value={formData.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'اسم العائلة' : 'Last Name'} <span className="required">*</span></label>
              <input type="text" className="form-input" value={formData.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'الجنس' : 'Gender'}</label>
              <select className="form-select" value={formData.sex} onChange={(e) => handleChange('sex', e.target.value)}>
                <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'الجنسية' : 'Nationality'}</label>
              <input type="text" className="form-input" value={formData.nationality} onChange={(e) => handleChange('nationality', e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label className="form-label">{isRTL ? 'رقم الهوية' : 'National ID'}</label>
              <input type="text" className="form-input" value={formData.nationalId} onChange={(e) => handleChange('nationalId', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'رقم الهاتف' : 'Phone Number'} <span className="required">*</span></label>
              <input type="tel" className="form-input" dir="ltr" value={formData.phoneNumber} onChange={(e) => handleChange('phoneNumber', e.target.value)} placeholder="05XXXXXXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">{isRTL ? 'البريد الإلكتروني' : 'Email'} <span className="required">*</span></label>
              <input type="email" className="form-input" dir="ltr" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="name@example.com" />
            </div>
          </div>
          <button className="btn btn-secondary bfx-inline-btn" onClick={() => { setIsNewUser(false); }}>
            {isRTL ? 'لدي حساب سابق' : 'I have an existing account'}
          </button>
        </motion.div>
      )}

      <div className="form-navigation">
        <button className="btn btn-primary" onClick={onNext} disabled={!canProceed()}>
          {isRTL ? 'التالي' : 'Next'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} aria-hidden="true">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default UserStep;
