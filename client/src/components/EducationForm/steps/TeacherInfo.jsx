import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../../config/api';

export const NavArrow = ({ dir, isRTL }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
    style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
    <path d={dir === 'next' ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} />
  </svg>
);

const TeacherInfo = ({ formData, onChange, onNext }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [userFound, setUserFound] = useState(!!formData.existingUserId);
  const [isNewUser, setIsNewUser] = useState(false);

  const handleCheck = async () => {
    if (!identifier.trim()) {
      toast.error(isRTL ? 'الرجاء إدخال رقم الهوية أو رقم الهاتف' : 'Please enter National ID or Phone Number');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/education/check-user', { identifier: identifier.trim() });
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
        setIsNewUser(false);
        toast.success(isRTL ? 'مرحباً بعودتك!' : 'Welcome back!');
      } else {
        setIsNewUser(true);
        setUserFound(false);
        onChange({ existingUserId: null });
        toast.info(isRTL ? 'مستخدم جديد - يرجى إكمال البيانات' : 'New user - please complete info');
      }
    } catch (error) {
      toast.error(isRTL ? 'حدث خطأ أثناء التحقق' : 'Error checking user');
    } finally {
      setLoading(false);
    }
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
        {isRTL ? 'معلومات المعلم' : 'Teacher Information'}
      </h2>
      <p className="step-description">
        {isRTL ? 'أدخل رقم الهوية أو رقم الهاتف للتحقق — إن سجّلت في فاب لاب سابقًا سنجلب بياناتك تلقائيًا.' : 'Enter your National ID or phone number — if you registered at FabLab before, we fetch your details.'}
      </p>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        {/* Lookup */}
        <div className="form-group">
          <label className="form-label">{isRTL ? 'رقم الهوية أو رقم الهاتف' : 'National ID or Phone Number'} <span className="required">*</span></label>
          <div className="edu-lookup">
            <input
              type="text"
              className="form-input"
              placeholder={isRTL ? 'رقم الهوية أو رقم الهاتف' : 'National ID or Phone Number'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
            />
            <button type="button" className="btn btn-primary" onClick={handleCheck} disabled={loading}>
              {loading ? <span className="loading-spinner" /> : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  {isRTL ? 'تحقق' : 'Check'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* User Found */}
        {userFound && (
          <motion.div className="edu-found" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="edu-found-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>{isRTL ? 'تم العثور على المستخدم' : 'User Found'}</span>
            </div>
            <dl className="edu-facts">
              <div><dt>{isRTL ? 'الاسم' : 'Name'}</dt><dd>{formData.firstName} {formData.lastName}</dd></div>
              <div><dt>{isRTL ? 'الهاتف' : 'Phone'}</dt><dd><bdi>{formData.phoneNumber}</bdi></dd></div>
              <div><dt>{isRTL ? 'البريد' : 'Email'}</dt><dd><bdi>{formData.email}</bdi></dd></div>
              {formData.nationalId && <div><dt>{isRTL ? 'الهوية' : 'ID'}</dt><dd><bdi>{formData.nationalId}</bdi></dd></div>}
            </dl>
          </motion.div>
        )}

        {/* New User Form */}
        {isNewUser && !userFound && (
          <motion.div className="edu-new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="info-banner" style={{ margin: '0 0 16px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              <span>{isRTL ? 'مستخدم جديد - يرجى إكمال البيانات الشخصية' : 'New user - please complete personal information'}</span>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{isRTL ? 'الاسم الأول' : 'First Name'} <span className="required">*</span></label>
                <input type="text" className="form-input" value={formData.firstName} onChange={(e) => onChange({ firstName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'اسم العائلة' : 'Last Name'} <span className="required">*</span></label>
                <input type="text" className="form-input" value={formData.lastName} onChange={(e) => onChange({ lastName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'الجنس' : 'Gender'}</label>
                <select className="form-select" value={formData.sex} onChange={(e) => onChange({ sex: e.target.value })}>
                  <option value="">{isRTL ? 'اختر' : 'Select'}</option>
                  <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                  <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'الجنسية' : 'Nationality'}</label>
                <input type="text" className="form-input" value={formData.nationality} onChange={(e) => onChange({ nationality: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'رقم الهوية' : 'National ID'}</label>
                <input type="text" className="form-input" value={formData.nationalId} onChange={(e) => onChange({ nationalId: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'رقم الهاتف' : 'Phone Number'} <span className="required">*</span></label>
                <input type="tel" className="form-input" value={formData.phoneNumber} onChange={(e) => onChange({ phoneNumber: e.target.value })} />
              </div>
              <div className="form-group full-width">
                <label className="form-label">{isRTL ? 'البريد الإلكتروني' : 'Email'} <span className="required">*</span></label>
                <input type="email" className="form-input" value={formData.email} onChange={(e) => onChange({ email: e.target.value })} />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="form-navigation">
        <button type="button" className="btn btn-primary" onClick={onNext} disabled={!canProceed()}>
          {isRTL ? 'التالي' : 'Next'}
          <NavArrow dir="next" isRTL={isRTL} />
        </button>
      </div>
    </div>
  );
};

export default TeacherInfo;
