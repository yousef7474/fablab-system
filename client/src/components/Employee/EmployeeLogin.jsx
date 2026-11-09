import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import employeeApi from '../../config/employeeApi';
import FxLogin, { FxField } from '../shared/FxLogin';

// What the employee portal holds — shown on the sign-in brand panel.
const FEATURES = {
  ar: [
    { text: 'مهامك وجدولك وحضورك', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { text: 'الحقائب التدريبية والخطة التنفيذية', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> },
    { text: 'طلبات الورش والصرف والتصميم', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> }
  ],
  en: [
    { text: 'Your tasks, schedule and attendance', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { text: 'Training kits and the execution plan', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> },
    { text: 'Workshop, finance and design requests', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> }
  ]
};

const EmployeeLogin = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await employeeApi.post('/employee/login', formData);
      localStorage.setItem('employeeToken', response.data.token);
      localStorage.setItem('employeeData', JSON.stringify(response.data.employee));
      toast.success(isRTL ? 'تم تسجيل الدخول بنجاح!' : 'Login successful!');
      navigate('/employee/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      // The server answers in English; show Arabic on the Arabic page.
      const d = error.response?.data;
      const wrong = error.response?.status === 401;
      toast.error(isRTL
        ? (d?.messageAr || (wrong ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'فشل تسجيل الدخول'))
        : (d?.message || 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FxLogin
      themeKey="employeeTheme"
      portal={isRTL ? 'بوابة الموظفين' : 'Employee Portal'}
      title={isRTL ? 'مرحبًا بعودتك' : 'Welcome back'}
      subtitle={isRTL ? 'سجّل الدخول إلى بوابة الموظفين.' : 'Sign in to the employee portal.'}
      features={FEATURES[isRTL ? 'ar' : 'en']}
    >
      <form onSubmit={handleSubmit} className="fxl-form">
        <FxField
          label={isRTL ? 'البريد الإلكتروني' : 'Email'}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
        >
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
            autoComplete="email"
            required
            autoFocus
          />
        </FxField>

        <FxField
          label={isRTL ? 'كلمة المرور' : 'Password'}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          end={(
            <button type="button" className="fxl-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? (isRTL ? 'إخفاء كلمة المرور' : 'Hide password') : (isRTL ? 'إظهار كلمة المرور' : 'Show password')}>
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          )}
        >
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={isRTL ? 'أدخل كلمة المرور' : 'Enter password'}
            autoComplete="current-password"
            required
          />
        </FxField>

        <button type="submit" className="fxl-submit" disabled={loading}>
          {loading ? (
            <>
              <span className="fxl-spin" aria-hidden="true" />
              {isRTL ? 'جاري تسجيل الدخول...' : 'Signing in...'}
            </>
          ) : (
            <>
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d={isRTL ? 'M19 12H5M11 18l-6-6 6-6' : 'M5 12h14M13 6l6 6-6 6'}/>
              </svg>
            </>
          )}
        </button>
      </form>
    </FxLogin>
  );
};

export default EmployeeLogin;
