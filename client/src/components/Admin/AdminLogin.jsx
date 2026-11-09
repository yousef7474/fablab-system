import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import FxLogin, { FxField } from '../shared/FxLogin';

// What the admin / manager boards hold — shown on the sign-in brand panel.
const FEATURES = {
  ar: [
    { text: 'التسجيلات والورش ومساحات العمل في مكان واحد', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
    { text: 'اعتماد الحقائب والخطط والطلبات', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { text: 'مؤشرات وتقارير لحظية', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg> }
  ],
  en: [
    { text: 'Registrations, workshops and workspaces in one place', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
    { text: 'Approve kits, plans and requests', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { text: 'Live indicators and reports', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg> }
  ]
};

const AdminLogin = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/admin/login', formData);
      localStorage.setItem('adminToken', response.data.token);
      localStorage.setItem('adminData', JSON.stringify(response.data.admin));
      toast.success(isRTL ? 'تم تسجيل الدخول بنجاح!' : 'Login successful!');

      // Redirect based on role
      if (response.data.admin.role === 'manager') {
        navigate('/manager/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      // The server answers in English; show Arabic on the Arabic page.
      const d = error.response?.data;
      const wrong = error.response?.status === 401;
      toast.error(isRTL
        ? (d?.messageAr || (wrong ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'فشل تسجيل الدخول'))
        : (d?.message || 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <FxLogin
      themeKey="adminTheme"
      portal={isRTL ? 'لوحة الإدارة · المدير' : 'Admin & Manager'}
      title={isRTL ? 'مرحبًا بعودتك' : 'Welcome back'}
      subtitle={isRTL ? 'سجّل الدخول إلى لوحة الإدارة أو لوحة المدير.' : 'Sign in to the admin or manager board.'}
      features={FEATURES[isRTL ? 'ar' : 'en']}
    >
      <form onSubmit={handleSubmit} className="fxl-form">
        <FxField
          label={isRTL ? 'اسم المستخدم' : 'Username'}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
        >
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder={isRTL ? 'أدخل اسم المستخدم' : 'Enter username'}
            autoComplete="username"
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

export default AdminLogin;
