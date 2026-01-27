import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './EliteRegistration.css';

const EliteLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('ar');
  const isRTL = language === 'ar';

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
          <p className="elite-subtitle">{text.welcomeBack}</p>
        </motion.div>

        {/* Login Form Card */}
        <motion.div
          className="elite-form-card"
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
                className="elite-btn primary"
                disabled={loading}
                style={{ marginRight: 0, width: '100%' }}
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

          <div className="elite-login-links">
            <p>{text.noAccount}</p>
            <Link to="/elite-registration" className="elite-link">
              {text.createAccount}
            </Link>
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

export default EliteLogin;
