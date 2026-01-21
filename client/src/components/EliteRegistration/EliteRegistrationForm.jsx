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
      toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
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
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('البريد الإلكتروني غير صالح');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.nationalId || !formData.sex || !formData.city) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.password || !formData.confirmPassword) {
      toast.error('يرجى إدخال كلمة المرور');
      return false;
    }
    if (formData.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين');
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
      toast.success('تم إنشاء حسابك بنجاح!');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء التسجيل');
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="elite-page">
        <div className="elite-bg-pattern"></div>
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
            <h2>مرحباً بك في النخبة!</h2>
            <p>تم إنشاء حسابك بنجاح</p>
            {createdUser && (
              <div className="user-info-display">
                <div className="info-item">
                  <span className="info-label">رقم العضوية:</span>
                  <span className="info-value">{createdUser.eliteId}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">الاسم:</span>
                  <span className="info-value">{createdUser.firstName} {createdUser.lastName}</span>
                </div>
              </div>
            )}
            <button
              className="elite-btn"
              onClick={() => navigate('/')}
            >
              العودة للرئيسية
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="elite-page">
      <div className="elite-bg-pattern"></div>

      {/* Saudi Decorative Elements */}
      <div className="saudi-decoration top-left"></div>
      <div className="saudi-decoration top-right"></div>
      <div className="saudi-decoration bottom-left"></div>
      <div className="saudi-decoration bottom-right"></div>

      <div className="elite-container">
        {/* Header */}
        <motion.div
          className="elite-header"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="elite-logo">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <h1 className="elite-title">النخبة</h1>
          <p className="elite-subtitle">تسجيل حساب جديد</p>
        </motion.div>

        {/* Progress Steps */}
        <div className="elite-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-number">{step > 1 ? '✓' : '1'}</div>
            <span>المعلومات الأساسية</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-number">{step > 2 ? '✓' : '2'}</div>
            <span>البيانات الشخصية</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <span>كلمة المرور</span>
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
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
              >
                <h3 className="step-title">المعلومات الأساسية</h3>

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
                  <span className="upload-hint">اضغط لرفع صورة شخصية</span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>الاسم الأول <span className="required">*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="أدخل الاسم الأول"
                    />
                  </div>
                  <div className="form-group">
                    <label>الاسم الأخير <span className="required">*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="أدخل الاسم الأخير"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>البريد الإلكتروني <span className="required">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="example@email.com"
                  />
                </div>

                <div className="form-group">
                  <label>رقم الهاتف <span className="required">*</span></label>
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
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
              >
                <h3 className="step-title">البيانات الشخصية</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>رقم الهوية <span className="required">*</span></label>
                    <input
                      type="text"
                      name="nationalId"
                      value={formData.nationalId}
                      onChange={handleChange}
                      placeholder="رقم الهوية الوطنية"
                      dir="ltr"
                    />
                  </div>
                  <div className="form-group">
                    <label>الجنسية</label>
                    <input
                      type="text"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      placeholder="الجنسية"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>الجنس <span className="required">*</span></label>
                    <select name="sex" value={formData.sex} onChange={handleChange}>
                      <option value="">اختر</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>تاريخ الميلاد</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>المدينة <span className="required">*</span></label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="المدينة"
                  />
                </div>

                <div className="form-group">
                  <label>جهة العمل / الدراسة</label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    placeholder="اسم الجهة"
                  />
                </div>

                <div className="form-group">
                  <label>التخصص</label>
                  <input
                    type="text"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleChange}
                    placeholder="تخصصك أو مجال اهتمامك"
                  />
                </div>

                <div className="form-group">
                  <label>نبذة تعريفية</label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    placeholder="اكتب نبذة قصيرة عنك..."
                    rows="3"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                className="form-step"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
              >
                <h3 className="step-title">إنشاء كلمة المرور</h3>

                <div className="password-info">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <p>أنشئ كلمة مرور قوية لحماية حسابك</p>
                </div>

                <div className="form-group">
                  <label>كلمة المرور <span className="required">*</span></label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="أدخل كلمة المرور"
                  />
                </div>

                <div className="form-group">
                  <label>تأكيد كلمة المرور <span className="required">*</span></label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="أعد إدخال كلمة المرور"
                  />
                </div>

                <div className="password-requirements">
                  <p>متطلبات كلمة المرور:</p>
                  <ul>
                    <li className={formData.password.length >= 6 ? 'met' : ''}>
                      6 أحرف على الأقل
                    </li>
                    <li className={formData.password === formData.confirmPassword && formData.password ? 'met' : ''}>
                      تطابق كلمتي المرور
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
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                السابق
              </button>
            )}

            {step < 3 ? (
              <button
                className="elite-btn primary"
                onClick={handleNext}
              >
                التالي
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
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
                    إنشاء الحساب
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
          العودة للرئيسية
        </motion.button>
      </div>
    </div>
  );
};

export default EliteRegistrationForm;
