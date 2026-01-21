import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './EliteRegistration.css';

const EliteRegistrationForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [language, setLanguage] = useState('ar');
  const isRTL = language === 'ar';

  // Translations
  const t = {
    ar: {
      elite: 'النخبة',
      newAccount: 'تسجيل حساب جديد',
      step1: 'المعلومات الأساسية',
      step2: 'البيانات الشخصية',
      step3: 'كلمة المرور',
      firstName: 'الاسم الأول',
      lastName: 'الاسم الأخير',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      nationalId: 'رقم الهوية',
      nationality: 'الجنسية',
      gender: 'الجنس',
      male: 'ذكر',
      female: 'أنثى',
      select: 'اختر',
      dateOfBirth: 'تاريخ الميلاد',
      city: 'المدينة',
      organization: 'جهة العمل / الدراسة',
      specialization: 'التخصص',
      bio: 'نبذة تعريفية',
      password: 'كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      createPassword: 'إنشاء كلمة المرور',
      passwordInfo: 'أنشئ كلمة مرور قوية لحماية حسابك',
      passwordRequirements: 'متطلبات كلمة المرور:',
      minChars: '6 أحرف على الأقل',
      passwordMatch: 'تطابق كلمتي المرور',
      next: 'التالي',
      previous: 'السابق',
      createAccount: 'إنشاء الحساب',
      backHome: 'العودة للرئيسية',
      uploadPhoto: 'اضغط لرفع صورة شخصية',
      welcomeElite: 'مرحباً بك في النخبة!',
      accountCreated: 'تم إنشاء حسابك بنجاح',
      memberId: 'رقم العضوية:',
      name: 'الاسم:',
      enterFirstName: 'أدخل الاسم الأول',
      enterLastName: 'أدخل الاسم الأخير',
      enterNationalId: 'رقم الهوية الوطنية',
      enterCity: 'المدينة',
      enterOrg: 'اسم الجهة',
      enterSpec: 'تخصصك أو مجال اهتمامك',
      enterBio: 'اكتب نبذة قصيرة عنك...',
      enterPassword: 'أدخل كلمة المرور',
      reenterPassword: 'أعد إدخال كلمة المرور',
      fillRequired: 'يرجى ملء جميع الحقول المطلوبة',
      invalidEmail: 'البريد الإلكتروني غير صالح',
      enterPasswordError: 'يرجى إدخال كلمة المرور',
      minPassword: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      passwordMismatch: 'كلمتا المرور غير متطابقتين',
      imageTooLarge: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت',
      successMessage: 'تم إنشاء حسابك بنجاح!'
    },
    en: {
      elite: 'Elite',
      newAccount: 'Create New Account',
      step1: 'Basic Information',
      step2: 'Personal Data',
      step3: 'Password',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone Number',
      nationalId: 'National ID',
      nationality: 'Nationality',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      select: 'Select',
      dateOfBirth: 'Date of Birth',
      city: 'City',
      organization: 'Organization',
      specialization: 'Specialization',
      bio: 'Bio',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      createPassword: 'Create Password',
      passwordInfo: 'Create a strong password to protect your account',
      passwordRequirements: 'Password requirements:',
      minChars: 'At least 6 characters',
      passwordMatch: 'Passwords match',
      next: 'Next',
      previous: 'Previous',
      createAccount: 'Create Account',
      backHome: 'Back to Home',
      uploadPhoto: 'Click to upload photo',
      welcomeElite: 'Welcome to Elite!',
      accountCreated: 'Your account has been created successfully',
      memberId: 'Member ID:',
      name: 'Name:',
      enterFirstName: 'Enter first name',
      enterLastName: 'Enter last name',
      enterNationalId: 'National ID number',
      enterCity: 'City',
      enterOrg: 'Organization name',
      enterSpec: 'Your specialization or field of interest',
      enterBio: 'Write a short bio about yourself...',
      enterPassword: 'Enter password',
      reenterPassword: 'Re-enter password',
      fillRequired: 'Please fill all required fields',
      invalidEmail: 'Invalid email address',
      enterPasswordError: 'Please enter password',
      minPassword: 'Password must be at least 6 characters',
      passwordMismatch: 'Passwords do not match',
      imageTooLarge: 'Image size must be less than 5MB',
      successMessage: 'Your account has been created successfully!'
    }
  };

  const text = t[language];

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    nationalId: '',
    nationality: 'Saudi',
    sex: '',
    dateOfBirth: '',
    city: '',
    organization: '',
    specialization: '',
    bio: '',
    password: '',
    confirmPassword: '',
    profilePicture: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(text.imageTooLarge);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, profilePicture: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const validateStep1 = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phoneNumber) {
      toast.error(text.fillRequired);
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error(text.invalidEmail);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.nationalId || !formData.sex || !formData.city) {
      toast.error(text.fillRequired);
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.password || !formData.confirmPassword) {
      toast.error(text.enterPasswordError);
      return false;
    }
    if (formData.password.length < 6) {
      toast.error(text.minPassword);
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error(text.passwordMismatch);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setLoading(true);
    try {
      const response = await api.post('/elite/register', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        nationalId: formData.nationalId,
        nationality: formData.nationality,
        sex: formData.sex,
        dateOfBirth: formData.dateOfBirth,
        city: formData.city,
        organization: formData.organization,
        specialization: formData.specialization,
        bio: formData.bio,
        password: formData.password,
        profilePicture: formData.profilePicture
      });

      setCreatedUser(response.data.user);
      setShowSuccess(true);
      toast.success(text.successMessage);
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.message || (isRTL ? 'حدث خطأ أثناء التسجيل' : 'Registration error'));
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="elite-page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="elite-bg-pattern"></div>
        {/* Animated Background Orbs */}
        <div className="elite-floating-orbs">
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
        </div>
        <div className="elite-container">
          <motion.div
            className="elite-success-card"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="success-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2>{text.welcomeElite}</h2>
            <p>{text.accountCreated}</p>
            {createdUser && (
              <div className="user-info-display">
                <div className="info-item">
                  <span className="info-label">{text.memberId}</span>
                  <span className="info-value">{createdUser.uniqueId}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">{text.name}</span>
                  <span className="info-value">{createdUser.firstName} {createdUser.lastName}</span>
                </div>
              </div>
            )}
            <button
              className="elite-btn primary"
              onClick={() => navigate('/')}
            >
              {text.backHome}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="elite-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="elite-bg-pattern"></div>

      {/* Animated Background Orbs */}
      <div className="elite-floating-orbs">
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
      </div>

      {/* Animated Stars */}
      <div className="elite-stars">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="elite-star" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`
          }}></div>
        ))}
      </div>

      {/* Language Switch */}
      <motion.div
        className="elite-language-switch"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
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
      </motion.div>

      <div className="elite-container">
        {/* Header */}
        <motion.div
          className="elite-header"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="elite-logo">
            <motion.svg
              width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </motion.svg>
          </div>
          <h1 className="elite-title">{text.elite}</h1>
          <p className="elite-subtitle">{text.newAccount}</p>
        </motion.div>

        {/* Progress Steps */}
        <div className="elite-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-number">{step > 1 ? '✓' : '1'}</div>
            <span>{text.step1}</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-number">{step > 2 ? '✓' : '2'}</div>
            <span>{text.step2}</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <span>{text.step3}</span>
          </div>
        </div>

        {/* Form Card */}
        <motion.div
          className="elite-form-card"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                className="form-step"
                initial={{ x: isRTL ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 50 : -50, opacity: 0 }}
              >
                <h3 className="step-title">{text.step1}</h3>

                {/* Profile Picture Upload */}
                <div className="profile-upload-section">
                  <div
                    className="profile-upload-circle"
                    onClick={() => document.getElementById('profilePicInput').click()}
                  >
                    {formData.profilePicture ? (
                      <img src={formData.profilePicture} alt="Profile" />
                    ) : (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    )}
                    <div className="upload-overlay">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                  </div>
                  <input
                    type="file"
                    id="profilePicInput"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <span className="upload-hint">{text.uploadPhoto}</span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{text.firstName} <span className="required">*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder={text.enterFirstName}
                    />
                  </div>
                  <div className="form-group">
                    <label>{text.lastName} <span className="required">*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder={text.enterLastName}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{text.email} <span className="required">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                </div>

                <div className="form-group">
                  <label>{text.phone} <span className="required">*</span></label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                className="form-step"
                initial={{ x: isRTL ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 50 : -50, opacity: 0 }}
              >
                <h3 className="step-title">{text.step2}</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>{text.nationalId} <span className="required">*</span></label>
                    <input
                      type="text"
                      name="nationalId"
                      value={formData.nationalId}
                      onChange={handleChange}
                      placeholder={text.enterNationalId}
                      dir="ltr"
                    />
                  </div>
                  <div className="form-group">
                    <label>{text.nationality}</label>
                    <input
                      type="text"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      placeholder={text.nationality}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{text.gender} <span className="required">*</span></label>
                    <select name="sex" value={formData.sex} onChange={handleChange}>
                      <option value="">{text.select}</option>
                      <option value="male">{text.male}</option>
                      <option value="female">{text.female}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{text.dateOfBirth}</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{text.city} <span className="required">*</span></label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder={text.enterCity}
                  />
                </div>

                <div className="form-group">
                  <label>{text.organization}</label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    placeholder={text.enterOrg}
                  />
                </div>

                <div className="form-group">
                  <label>{text.specialization}</label>
                  <input
                    type="text"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleChange}
                    placeholder={text.enterSpec}
                  />
                </div>

                <div className="form-group">
                  <label>{text.bio}</label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    placeholder={text.enterBio}
                    rows="3"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                className="form-step"
                initial={{ x: isRTL ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 50 : -50, opacity: 0 }}
              >
                <h3 className="step-title">{text.createPassword}</h3>

                <div className="password-info">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <p>{text.passwordInfo}</p>
                </div>

                <div className="form-group">
                  <label>{text.password} <span className="required">*</span></label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={text.enterPassword}
                  />
                </div>

                <div className="form-group">
                  <label>{text.confirmPassword} <span className="required">*</span></label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder={text.reenterPassword}
                  />
                </div>

                <div className="password-requirements">
                  <p>{text.passwordRequirements}</p>
                  <ul>
                    <li className={formData.password.length >= 6 ? 'met' : ''}>
                      {text.minChars}
                    </li>
                    <li className={formData.password === formData.confirmPassword && formData.password ? 'met' : ''}>
                      {text.passwordMatch}
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="form-navigation">
            {step > 1 && (
              <button
                className="elite-btn secondary"
                onClick={() => setStep(step - 1)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points={isRTL ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/>
                </svg>
                {text.previous}
              </button>
            )}

            {step < 3 ? (
              <button
                className="elite-btn primary"
                onClick={handleNext}
              >
                {text.next}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points={isRTL ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}/>
                </svg>
              </button>
            ) : (
              <button
                className="elite-btn primary"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <>
                    {text.createAccount}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Back to Home */}
        <motion.button
          className="back-home-btn"
          onClick={() => navigate('/')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          {text.backHome}
        </motion.button>
      </div>
    </div>
  );
};

export default EliteRegistrationForm;
