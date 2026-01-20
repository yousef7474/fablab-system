import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../../config/api';

const ApplicationData = ({ formData, onChange, onNext, onBack }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [validating, setValidating] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const fileInputRef = useRef(null);

  const handleChange = (field, value) => {
    onChange({ [field]: value });
    // Clear conflicts when user modifies the conflicting field
    if (conflicts.some(c => c.field === field)) {
      setConflicts(conflicts.filter(c => c.field !== field));
    }
  };

  // Handle profile picture upload
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة صالحة' : 'Please select a valid image');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت' : 'Image size must be less than 2MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ profilePicture: event.target.result });
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePicture = () => {
    onChange({ profilePicture: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canProceed = () => {
    if (['Beneficiary', 'Visitor', 'Volunteer', 'Talented'].includes(formData.applicationType)) {
      return formData.firstName && formData.lastName && formData.sex &&
             formData.nationality && formData.nationalId && formData.phoneNumber && formData.email &&
             formData.currentJob;
    } else if (formData.applicationType === 'Entity') {
      return formData.entityName && formData.name && formData.phoneNumber && formData.email;
    } else if (formData.applicationType === 'FABLAB Visit') {
      return formData.visitingEntity && formData.personInCharge && formData.phoneNumber && formData.email;
    }
    return false;
  };

  const entities = [
    { value: 'FABLAB AL-Ahsa', labelEn: 'FABLAB Al-Ahsa', labelAr: 'فاب لاب الأحساء' },
    { value: 'Noura Al-Mousa House for Culture and Arts', labelEn: 'Noura Al-Mousa House for Culture and Arts', labelAr: 'دار نورة الموسى للثقافة والفنون' },
    { value: 'Al-Ahsa Academy for Crafts', labelEn: 'Al-Ahsa Academy for Crafts', labelAr: 'أكاديمية الأحساء للحرف' },
    { value: 'Creativity and Innovation Training Center', labelEn: 'Creativity and Innovation Training Center', labelAr: 'مركز الإبداع والابتكار للتدريب' },
    { value: 'Abdulmonem Al-Rashed Foundation', labelEn: 'Abdulmonem Al-Rashed Foundation', labelAr: 'مؤسسة عبدالمنعم الراشد' }
  ];

  // Validate user info before proceeding
  const handleValidateAndProceed = async () => {
    // If user already exists (has existingUserId), skip validation
    if (formData.existingUserId) {
      onNext();
      return;
    }

    setValidating(true);
    setConflicts([]);

    try {
      const response = await api.post('/registration/validate-user', {
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        nationalId: formData.nationalId,
        existingUserId: formData.existingUserId
      });

      if (response.data.valid) {
        onNext();
      }
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.conflicts) {
        setConflicts(error.response.data.conflicts);
        toast.error(isRTL
          ? 'تم العثور على تعارض في البيانات. يرجى مراجعة المعلومات.'
          : 'Data conflict found. Please review the information.');
      } else {
        console.error('Error validating user:', error);
        toast.error(isRTL ? 'حدث خطأ أثناء التحقق' : 'Error validating user info');
      }
    } finally {
      setValidating(false);
    }
  };

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'بيانات مقدم الطلب' : 'Applicant Information'}
      </h2>
      <p className="step-description">
        {isRTL ? 'يرجى إدخال معلوماتك الشخصية' : 'Please enter your personal information'}
      </p>

      <div className="form-grid">
        {['Beneficiary', 'Visitor', 'Volunteer', 'Talented'].includes(formData.applicationType) && (
          <>
            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="form-label">
                {isRTL ? 'الاسم الأول' : 'First Name'} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder={isRTL ? 'أدخل الاسم الأول' : 'Enter first name'}
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <label className="form-label">
                {isRTL ? 'اسم العائلة' : 'Last Name'} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                placeholder={isRTL ? 'أدخل اسم العائلة' : 'Enter last name'}
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="form-label">
                {isRTL ? 'الجنس' : 'Gender'} <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={formData.sex}
                onChange={(e) => handleChange('sex', e.target.value)}
              >
                <option value="">{isRTL ? 'اختر الجنس' : 'Select gender'}</option>
                <option value="Male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="Female">{isRTL ? 'أنثى' : 'Female'}</option>
              </select>
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <label className="form-label">
                {isRTL ? 'الجنسية' : 'Nationality'} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.nationality}
                onChange={(e) => handleChange('nationality', e.target.value)}
                placeholder={isRTL ? 'أدخل الجنسية' : 'Enter nationality'}
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="form-label">
                {isRTL ? 'رقم الهوية الوطنية' : 'National ID'} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.nationalId}
                onChange={(e) => handleChange('nationalId', e.target.value)}
                placeholder={isRTL ? 'أدخل رقم الهوية' : 'Enter national ID'}
              />
            </motion.div>

            <motion.div
              className="form-group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <label className="form-label">
                {isRTL ? 'اسم الجهة التابع لها (مدرسة/جامعة/شركة/إلخ)' : 'Organization Name (School/University/Company/etc.)'} <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.currentJob}
                onChange={(e) => handleChange('currentJob', e.target.value)}
                placeholder={isRTL ? 'أدخل اسم الجهة التابع لها' : 'Enter organization name'}
                required
              />
            </motion.div>

            <motion.div
              className="form-group full-width"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label className="form-label">{isRTL ? 'العنوان الوطني' : 'National Address'}</label>
              <textarea
                className="form-textarea"
                value={formData.nationalAddress}
                onChange={(e) => handleChange('nationalAddress', e.target.value)}
                placeholder={isRTL ? 'أدخل العنوان الوطني' : 'Enter national address'}
                rows={2}
              />
            </motion.div>

            {/* Profile Picture Upload */}
            <motion.div
              className="form-group full-width"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
            >
              <label className="form-label">
                {isRTL ? 'الصورة الشخصية (للبطاقة)' : 'Profile Picture (for ID Card)'}
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                {formData.profilePicture ? (
                  <div style={{
                    position: 'relative',
                    width: '100px',
                    height: '120px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '2px solid #e02529',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <img
                      src={formData.profilePicture}
                      alt="Profile"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                    <button
                      type="button"
                      onClick={removeProfilePicture}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '24px',
                        height: '24px',
                        background: '#e02529',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100px',
                      height: '120px',
                      border: '2px dashed #ccc',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      background: '#f9f9f9'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#e02529';
                      e.currentTarget.style.background = '#fff5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#ccc';
                      e.currentTarget.style.background = '#f9f9f9';
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    <span style={{ fontSize: '11px', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                      {isRTL ? 'إضافة صورة' : 'Add Photo'}
                    </span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  style={{ display: 'none' }}
                />
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: 1.5 }}>
                    {isRTL ? (
                      <>
                        📷 الصورة ستُطبع على بطاقة الهوية الخاصة بك<br />
                        • الحجم الأقصى: 2 ميجابايت<br />
                        • الصيغ المدعومة: JPG, PNG
                      </>
                    ) : (
                      <>
                        📷 Photo will be printed on your ID card<br />
                        • Max size: 2MB<br />
                        • Supported formats: JPG, PNG
                      </>
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {formData.applicationType === 'Entity' && (
          <>
            <motion.div
              className="form-group full-width"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="form-label">
                {isRTL ? 'الكيان' : 'Entity'} <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={formData.entityName}
                onChange={(e) => handleChange('entityName', e.target.value)}
              >
                <option value="">{isRTL ? 'اختر الكيان' : 'Select entity'}</option>
                {entities.map((entity) => (
                  <option key={entity.value} value={entity.value}>
                    {isRTL ? entity.labelAr : entity.labelEn}
                  </option>
                ))}
              </select>
            </motion.div>

            <motion.div
              className="form-group full-width"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <label className="form-label">
                {isRTL ? 'الاسم' : 'Name'} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={isRTL ? 'أدخل الاسم' : 'Enter name'}
              />
            </motion.div>
          </>
        )}

        {formData.applicationType === 'FABLAB Visit' && (
          <>
            <motion.div
              className="form-group full-width"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="form-label">
                {isRTL ? 'الجهة الزائرة' : 'Visiting Entity'} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.visitingEntity}
                onChange={(e) => handleChange('visitingEntity', e.target.value)}
                placeholder={isRTL ? 'أدخل اسم الجهة الزائرة' : 'Enter visiting entity name'}
              />
            </motion.div>

            <motion.div
              className="form-group full-width"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <label className="form-label">
                {isRTL ? 'المسؤول' : 'Person in Charge'} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.personInCharge}
                onChange={(e) => handleChange('personInCharge', e.target.value)}
                placeholder={isRTL ? 'أدخل اسم المسؤول' : 'Enter person in charge name'}
              />
            </motion.div>
          </>
        )}

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <label className="form-label">
            {isRTL ? 'رقم الهاتف' : 'Phone Number'} <span className="required">*</span>
          </label>
          <input
            type="tel"
            className="form-input"
            value={formData.phoneNumber}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            placeholder={isRTL ? 'أدخل رقم الهاتف' : 'Enter phone number'}
          />
        </motion.div>

        <motion.div
          className="form-group"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <label className="form-label">
            {isRTL ? 'البريد الإلكتروني' : 'Email'} <span className="required">*</span>
          </label>
          <input
            type="email"
            className="form-input"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder={isRTL ? 'أدخل البريد الإلكتروني' : 'Enter email address'}
          />
        </motion.div>
      </div>

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <motion.div
          className="conflicts-warning"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '1rem',
            marginTop: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ color: '#dc2626', fontWeight: '600' }}>
              {isRTL ? 'تم العثور على تعارض في البيانات' : 'Data Conflict Found'}
            </span>
          </div>
          {conflicts.map((conflict, index) => (
            <div key={index} style={{
              background: 'white',
              padding: '0.75rem',
              borderRadius: '8px',
              marginBottom: index < conflicts.length - 1 ? '0.5rem' : 0
            }}>
              <p style={{ color: '#991b1b', margin: 0, fontSize: '0.9rem' }}>
                {isRTL ? conflict.messageAr : conflict.message}
              </p>
              {conflict.existingUser && (
                <p style={{ color: '#666', margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                  {isRTL ? 'المستخدم المسجل: ' : 'Registered user: '}
                  <strong>{conflict.existingUser.name}</strong>
                  {conflict.existingUser.email && ` (${conflict.existingUser.email})`}
                  {conflict.existingUser.phoneNumber && ` - ${conflict.existingUser.phoneNumber}`}
                </p>
              )}
            </div>
          ))}
          <p style={{ color: '#666', margin: '0.75rem 0 0 0', fontSize: '0.85rem' }}>
            {isRTL
              ? 'يرجى استخدام خيار "البحث" في الصفحة الرئيسية للدخول بحسابك المسجل، أو تعديل البيانات المتعارضة.'
              : 'Please use the "Search" option on the home page to login with your registered account, or modify the conflicting data.'}
          </p>
        </motion.div>
      )}

      <div className="form-navigation">
        <button className="btn btn-secondary" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {t('previous')}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleValidateAndProceed}
          disabled={!canProceed() || validating}
        >
          {validating ? (
            <span className="loading-spinner" />
          ) : (
            <>
              {t('next')}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ApplicationData;
