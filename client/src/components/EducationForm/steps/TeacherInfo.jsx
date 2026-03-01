import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../../config/api';

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
        {isRTL ? 'أدخل رقم الهوية أو رقم الهاتف للتحقق' : 'Enter National ID or Phone Number to verify'}
      </p>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Lookup */}
        <div className="form-group">
          <label className="form-label">{isRTL ? 'رقم الهوية أو رقم الهاتف *' : 'National ID or Phone Number *'}</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              className="form-input"
              placeholder={isRTL ? 'رقم الهوية أو رقم الهاتف' : 'National ID or Phone Number'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
              style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}
            />
            <button
              className="btn btn-primary"
              onClick={handleCheck}
              disabled={loading}
              style={{ minWidth: '100px', background: 'linear-gradient(135deg, #6d28d9, #7c3aed)' }}
            >
              {loading ? <span className="loading-spinner" /> : (isRTL ? 'تحقق' : 'Check')}
            </button>
          </div>
        </div>

        {/* User Found */}
        {userFound && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#f0fdf4',
              border: '2px solid #22c55e',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span style={{ fontWeight: '700', color: '#155724' }}>{isRTL ? 'تم العثور على المستخدم' : 'User Found'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
              <div><span style={{ color: '#64748b' }}>{isRTL ? 'الاسم:' : 'Name:'}</span> <strong>{formData.firstName} {formData.lastName}</strong></div>
              <div><span style={{ color: '#64748b' }}>{isRTL ? 'الهاتف:' : 'Phone:'}</span> <strong>{formData.phoneNumber}</strong></div>
              <div><span style={{ color: '#64748b' }}>{isRTL ? 'البريد:' : 'Email:'}</span> <strong>{formData.email}</strong></div>
              {formData.nationalId && <div><span style={{ color: '#64748b' }}>{isRTL ? 'الهوية:' : 'ID:'}</span> <strong>{formData.nationalId}</strong></div>}
            </div>
          </motion.div>
        )}

        {/* New User Form */}
        {isNewUser && !userFound && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '16px' }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
              <span style={{ color: '#1e40af', fontSize: '14px' }}>
                {isRTL ? 'مستخدم جديد - يرجى إكمال البيانات الشخصية' : 'New user - please complete personal information'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'الاسم الأول *' : 'First Name *'}</label>
                <input type="text" className="form-input" value={formData.firstName} onChange={(e) => onChange({ firstName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'اسم العائلة *' : 'Last Name *'}</label>
                <input type="text" className="form-input" value={formData.lastName} onChange={(e) => onChange({ lastName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{isRTL ? 'الجنس' : 'Gender'}</label>
                <select className="form-input" value={formData.sex} onChange={(e) => onChange({ sex: e.target.value })}>
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
                <label className="form-label">{isRTL ? 'رقم الهاتف *' : 'Phone Number *'}</label>
                <input type="text" className="form-input" value={formData.phoneNumber} onChange={(e) => onChange({ phoneNumber: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
                <input type="email" className="form-input" value={formData.email} onChange={(e) => onChange({ email: e.target.value })} />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      <div className="form-navigation" style={{ marginTop: '24px' }}>
        <div />
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed()}
          style={{ background: canProceed() ? 'linear-gradient(135deg, #6d28d9, #7c3aed)' : undefined }}
        >
          {isRTL ? 'التالي' : 'Next'}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TeacherInfo;
