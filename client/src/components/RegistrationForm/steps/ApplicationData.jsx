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

    // Validate file type - accept all image formats
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار صورة صالحة' : 'Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' : 'Image size must be less than 5MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ profilePicture: event.target.result });
    };
    reader.onerror = () => {
      toast.error(isRTL ? 'فشل في قراءة الصورة. يرجى المحاولة مرة أخرى.' : 'Failed to read image. Please try again.');
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
      return formData.firstName && formData.lastName && formData.sex &&
             formData.nationality && formData.nationalId && formData.currentJob &&
             formData.visitingEntity && formData.personInCharge &&
             formData.phoneNumber && formData.email;
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
        {['Beneficiary', 'Visitor', 'Volunteer', 'Talented', 'FABLAB Visit'].includes(formData.applicationType) && (
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
                {isRTL ? 'اسم الجهة التابع لها (مدرسة/جامعة/شركة/إلخ)' : 'Organization Name (School/University/Company/etc.)'} <span className="required">*</span>
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
              <div className="rgx-photo">
                {formData.profilePicture ? (
                  <div className="rgx-photo-img">
                    <img src={formData.profilePicture} alt="Profile" />
                    <button type="button" onClick={removeProfilePicture} aria-label={isRTL ? 'إزالة الصورة' : 'Remove photo'}>×</button>
                  </div>
                ) : (
                  <button type="button" className="rgx-photo-pick" onClick={() => fileInputRef.current?.click()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    {isRTL ? 'إضافة صورة' : 'Add Photo'}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  style={{ display: 'none' }}
                />
                <p className="rgx-photo-hint">
                  {isRTL ? (
                    <>
                      الصورة ستُطبع على بطاقة الهوية الخاصة بك<br />
                      • الحجم الأقصى: 5 ميجابايت<br />
                      • جميع صيغ الصور مدعومة
                    </>
                  ) : (
                    <>
                      Photo will be printed on your ID card<br />
                      • Max size: 5MB<br />
                      • All image formats supported
                    </>
                  )}
                </p>
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
          className="conflicts-warning rgx-conflicts"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rgx-conflicts-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{isRTL ? 'تم العثور على تعارض في البيانات' : 'Data Conflict Found'}</span>
          </div>
          {conflicts.map((conflict, index) => (
            <div key={index} className="rgx-conflict">
              <p>{isRTL ? conflict.messageAr : conflict.message}</p>
              {conflict.existingUser && (
                <p>
                  {isRTL ? 'المستخدم المسجل: ' : 'Registered user: '}
                  <strong>{conflict.existingUser.name}</strong>
                  {conflict.existingUser.email && ` (${conflict.existingUser.email})`}
                  {conflict.existingUser.phoneNumber && ` - ${conflict.existingUser.phoneNumber}`}
                </p>
              )}
            </div>
          ))}
          <p>
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
