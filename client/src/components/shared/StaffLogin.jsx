import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../config/api';
import FxLogin, { FxField } from './FxLogin';

// One sign-in for the admin, manager and employee boards. The server
// (/auth/login) works out whose account the email / username and password
// open, and the page sends them to that board. When they open both an
// admin and an employee account, the person picks where to go.

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{children}</svg>
);
const ICONS = {
  grid: <Icon><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>,
  check: <Icon><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Icon>,
  user: <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>,
  shield: <Icon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>,
  badge: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="11" r="2.5" /><path d="M14 10h4M14 14h4M6 17c.6-1.6 1.8-2.5 3-2.5s2.4.9 3 2.5" /></Icon>,
  lock: <Icon><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>,
  eye: <Icon><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Icon>,
  eyeOff: <Icon><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></Icon>
};

// What the boards hold — shown on the sign-in brand panel.
const FEATURES = {
  ar: [
    { text: 'دخول واحد للإدارة والمدير والموظفين', icon: ICONS.user },
    { text: 'الحقائب التدريبية والخطط والطلبات واعتمادها', icon: ICONS.check },
    { text: 'المهام والجدول والحضور والمؤشرات', icon: ICONS.grid }
  ],
  en: [
    { text: 'One sign-in for admins, managers and employees', icon: ICONS.user },
    { text: 'Training kits, plans and requests — and their approvals', icon: ICONS.check },
    { text: 'Tasks, schedule, attendance and indicators', icon: ICONS.grid }
  ]
};

const boardOf = (acc, isRTL) => {
  if (acc.kind === 'employee') {
    return {
      icon: ICONS.badge,
      title: isRTL ? 'بوابة الموظف' : 'Employee portal',
      sub: isRTL ? 'مهامك وجدولك والحقائب والطلبات' : 'Your tasks, schedule, kits and requests',
      name: acc.employee.name
    };
  }
  const manager = acc.admin.role === 'manager';
  return {
    icon: manager ? ICONS.shield : ICONS.grid,
    title: manager ? (isRTL ? 'لوحة المدير' : 'Manager board') : (isRTL ? 'لوحة الإدارة' : 'Admin board'),
    sub: manager
      ? (isRTL ? 'الاعتمادات والمهام والموظفون' : 'Approvals, tasks and staff')
      : (isRTL ? 'التسجيلات والورش والإعدادات' : 'Registrations, workshops and settings'),
    name: acc.admin.fullName || acc.admin.username
  };
};

const StaffLogin = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [choices, setChoices] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const enter = (acc) => {
    if (acc.kind === 'employee') {
      localStorage.setItem('employeeToken', acc.token);
      localStorage.setItem('employeeData', JSON.stringify(acc.employee));
    } else {
      localStorage.setItem('adminToken', acc.token);
      localStorage.setItem('adminData', JSON.stringify(acc.admin));
    }
    const { name } = boardOf(acc, isRTL);
    toast.dismiss(); // clear any earlier "wrong password" message
    toast.success(isRTL ? `أهلًا ${name}، تم تسجيل الدخول بنجاح` : `Welcome, ${name} — you're signed in`);
    if (acc.kind === 'employee') navigate('/employee/dashboard');
    else navigate(acc.admin.role === 'manager' ? '/manager/dashboard' : '/admin/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', formData);
      const accounts = data.accounts || [];
      if (accounts.length > 1) setChoices(accounts);
      else enter(accounts[0]);
    } catch (error) {
      console.error('Login error:', error);
      const d = error.response?.data;
      if (!error.response) {
        toast.error(isRTL ? 'تعذّر الاتصال بالخادم، حاول مرة أخرى' : 'Could not reach the server — try again');
      } else {
        toast.error(isRTL ? (d?.messageAr || 'فشل تسجيل الدخول') : (d?.message || 'Login failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <FxLogin
      portal={isRTL ? 'دخول موحّد · الإدارة والموظفون' : 'One sign-in · admins & staff'}
      title={choices ? (isRTL ? 'اختر اللوحة' : 'Choose a board') : (isRTL ? 'مرحبًا بعودتك' : 'Welcome back')}
      subtitle={choices
        ? (isRTL ? 'بياناتك تفتح أكثر من لوحة — إلى أين تريد الدخول؟' : 'Your details open more than one board — where to?')
        : (isRTL ? 'ادخل ببريدك الإلكتروني أو اسم المستخدم، وسننقلك إلى لوحتك تلقائيًا.' : 'Use your email or username — we take you to your board.')}
      features={FEATURES[isRTL ? 'ar' : 'en']}
    >
      <AnimatePresence mode="wait" initial={false}>
        {choices ? (
          <motion.div
            key="choose"
            className="fxl-choices"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {choices.map((acc, i) => {
              const b = boardOf(acc, isRTL);
              return (
                <button key={acc.kind} type="button" className={`fxl-choice t${i % 3}`} onClick={() => enter(acc)}>
                  <span className="fxl-choice-tile">{b.icon}</span>
                  <span className="fxl-choice-text">
                    <strong>{b.title}</strong>
                    <small>{b.sub}</small>
                  </span>
                  <svg className="fxl-choice-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d={isRTL ? 'M19 12H5M11 18l-6-6 6-6' : 'M5 12h14M13 6l6 6-6 6'} />
                  </svg>
                </button>
              );
            })}
            <button type="button" className="fxl-link" onClick={() => setChoices(null)}>
              {isRTL ? 'رجوع' : 'Back'}
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            className="fxl-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <FxField label={isRTL ? 'البريد الإلكتروني أو اسم المستخدم' : 'Email or username'} icon={ICONS.user}>
              <input
                type="text"
                name="identifier"
                value={formData.identifier}
                onChange={handleChange}
                placeholder={isRTL ? 'أدخل بريدك الإلكتروني أو اسم المستخدم' : 'Enter your email or username'}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
              />
            </FxField>

            <FxField
              label={isRTL ? 'كلمة المرور' : 'Password'}
              icon={ICONS.lock}
              end={(
                <button type="button" className="fxl-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? (isRTL ? 'إخفاء كلمة المرور' : 'Hide password') : (isRTL ? 'إظهار كلمة المرور' : 'Show password')}>
                  {showPassword ? ICONS.eyeOff : ICONS.eye}
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
                    <path d={isRTL ? 'M19 12H5M11 18l-6-6 6-6' : 'M5 12h14M13 6l6 6-6 6'} />
                  </svg>
                </>
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </FxLogin>
  );
};

export default StaffLogin;
