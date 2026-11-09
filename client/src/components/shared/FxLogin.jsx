import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import '../../styles/fx.css';
import '../../styles/fx-login.css';

// Shared sign-in layout for the dashboards (admin / manager and employee),
// in the dashboards' "fx" studio look: a navy brand panel with the FabLab
// logo and what the portal holds, and the form card. The theme toggle
// writes the same key the dashboard reads (adminTheme / employeeTheme), so
// the choice carries over after signing in.
const FxLogin = ({ themeKey, portal, title, subtitle, features = [], children }) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(themeKey) || 'dark'; } catch { return 'dark'; }
  });

  // The admin boards leave their theme on <html>; the shared design-system
  // rules keyed on it would restyle this page — lift it while shown.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    if (prev) root.removeAttribute('data-theme');
    return () => { if (prev && !root.hasAttribute('data-theme')) root.setAttribute('data-theme', prev); };
  }, []);

  const toggleTheme = () => setTheme(t => {
    const next = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(themeKey, next); } catch { /* ignore */ }
    return next;
  });
  const toggleLanguage = () => i18n.changeLanguage(isRTL ? 'en' : 'ar');

  return (
    <div className="fx fx-login" data-theme={theme} dir={isRTL ? 'rtl' : 'ltr'}>
      <motion.aside
        className="fxl-brand"
        initial={{ opacity: 0, x: isRTL ? 30 : -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="fxl-brand-top">
          <span className="fxl-logo"><img src="/fablab.png" alt="FabLab Al-Ahsa" /></span>
          <div className="fxl-brand-name">
            <strong>{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</strong>
            <small>{isRTL ? 'مركز تنمية الإبداع والابتكار' : 'Creativity & Innovation Center'}</small>
          </div>
        </div>

        <div className="fxl-brand-mid">
          <span className="fxl-portal"><i aria-hidden="true" />{portal}</span>
          <h2>{isRTL ? <>نصنع الأفكار<br /><em>ونحوّلها إلى واقع</em></> : <>We make ideas<br /><em>into real things</em></>}</h2>
          <ul className="fxl-features">
            {features.map((f, i) => (
              <motion.li
                key={f.text}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.09, duration: 0.45 }}
              >
                <span className={`fxl-ftile t${i % 3}`} aria-hidden="true">{f.icon}</span>
                <span>{f.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="fxl-brand-foot">{isRTL ? 'فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية' : 'FabLab Al-Ahsa — Abdulmonem Al-Rashed Humanitarian Foundation'}</p>
      </motion.aside>

      <main className="fxl-main">
        <div className="fxl-tools">
          <button type="button" className="fxl-tool" onClick={toggleLanguage} title={isRTL ? 'English' : 'العربية'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            <span>{isRTL ? 'English' : 'العربية'}</span>
          </button>
          <button type="button" className="fxl-tool icon" onClick={toggleTheme} aria-label={isRTL ? 'تبديل المظهر' : 'Toggle theme'} title={theme === 'dark' ? (isRTL ? 'الوضع الفاتح' : 'Light mode') : (isRTL ? 'الوضع الداكن' : 'Dark mode')}>
            {theme === 'dark'
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>}
          </button>
        </div>

        <motion.section
          className="fxl-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <p className="fxl-eyebrow"><i className="fxl-live" aria-hidden="true" />{isRTL ? 'تسجيل الدخول' : 'Sign in'}</p>
          <h1>{title}</h1>
          <p className="fxl-sub">{subtitle}</p>
          {children}
        </motion.section>

        <button type="button" className="fxl-back" onClick={() => navigate('/')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={isRTL ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} /></svg>
          {isRTL ? 'العودة للتسجيل' : 'Back to Registration'}
        </button>
      </main>
    </div>
  );
};

// A field with its icon inside the input.
export const FxField = ({ label, icon, children, end }) => (
  <label className="fxl-field">
    <span className="fxl-label">{label}</span>
    <span className={`fxl-control${end ? ' has-end' : ''}`}>
      <span className="fxl-ficon" aria-hidden="true">{icon}</span>
      {children}
      {end}
    </span>
  </label>
);

export default FxLogin;
