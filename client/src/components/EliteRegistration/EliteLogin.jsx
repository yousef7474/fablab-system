import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import StudioShell, { useStudioTheme } from '../RegistrationForm/StudioShell';
import { ELITE_INTRO } from './eliteIntro';
import './EliteRegistration.css';
import './EliteStudio.css';

const EliteLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { i18n } = useTranslation();
  const language = i18n.language === 'en' ? 'en' : 'ar';
  const isRTL = language === 'ar';
  const [theme, toggleTheme] = useStudioTheme();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  // Check if already logged in
  useEffect(() => {
    const eliteUser = localStorage.getItem('eliteUser');
    if (eliteUser) {
      navigate('/elite/account');
    }
  }, [navigate]);

  // Translations
  const t = {
    ar: {
      elite: 'النخبة',
      login: 'تسجيل الدخول',
      welcomeBack: 'مرحباً بعودتك',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      enterEmail: 'أدخل بريدك الإلكتروني',
      enterPassword: 'أدخل كلمة المرور',
      loginBtn: 'دخول',
      noAccount: 'ليس لديك حساب؟',
      createAccount: 'إنشاء حساب جديد',
      backHome: 'العودة للرئيسية',
      fillRequired: 'يرجى إدخال البريد الإلكتروني وكلمة المرور',
      loginSuccess: 'تم تسجيل الدخول بنجاح',
      loginError: 'خطأ في تسجيل الدخول'
    },
    en: {
      elite: 'Elite',
      login: 'Login',
      welcomeBack: 'Welcome Back',
      email: 'Email',
      password: 'Password',
      enterEmail: 'Enter your email',
      enterPassword: 'Enter your password',
      loginBtn: 'Login',
      noAccount: "Don't have an account?",
      createAccount: 'Create Account',
      backHome: 'Back to Home',
      fillRequired: 'Please enter email and password',
      loginSuccess: 'Login successful',
      loginError: 'Login error'
    }
  };

  const text = t[language];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error(text.fillRequired);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/elite/login', {
        email: formData.email,
        password: formData.password
      });

      // Store user data in localStorage
      localStorage.setItem('eliteUser', JSON.stringify(response.data.user));

      toast.success(text.loginSuccess);
      navigate('/elite/account');
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = isRTL
        ? (error.response?.data?.message || text.loginError)
        : (error.response?.data?.messageEn || text.loginError);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <StudioShell
      isRTL={isRTL}
      theme={theme}
      onToggleTheme={toggleTheme}
      servicesHref="/register"
      subtitle={isRTL ? 'برنامج النخبة' : 'Elite program'}
      intro={ELITE_INTRO(isRTL)}
    >
        <motion.div
          className="rgx-hero"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <p className="rgx-eyebrow"><i aria-hidden="true" />{text.elite}</p>
          <h1>{text.welcomeBack}</h1>
        </motion.div>

        {/* Login Form Card */}
        <motion.div
          className="rgx-card elx elx-login"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="step-title">{text.login}</h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{text.email}</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={text.enterEmail}
                dir="ltr"
              />
            </div>

            <div className="form-group">
              <label>{text.password}</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={text.enterPassword}
              />
            </div>

            <div className="form-navigation" style={{ justifyContent: 'center' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <>
                    {text.loginBtn}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                      <polyline points="10 17 15 12 10 7"/>
                      <line x1="15" y1="12" x2="3" y2="12"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

        </motion.div>

    </StudioShell>
  );
};

export default EliteLogin;
