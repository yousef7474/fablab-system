import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import './RegisterStudio.css';

// The registration "studio" frame shared by /register and /workspace: a
// navy rail (brand + intro, then a vertical stepper while filling a form)
// beside the main column (tools + the card). Below 1100px the rail folds
// into a compact header with a segmented progress bar.

const THEME_KEY = 'fablab_registration_theme';

// One stroke icon (24-unit grid) per step, for the rail stepper.
const STEP_ICONS = [
  ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'],
  ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
  ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z']
];
const RAIL_FEATURES = [
  { ar: 'استشارات تقنية مع مهندسي الأقسام', en: 'Technical consultations with section engineers', d: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 13h5'] },
  { ar: 'حجز الأجهزة والمعدات لتنفيذ مشروعك', en: 'Book machines and tools for your project', d: ['M2 6h20v12H2z', 'M6 10v4', 'M10 10v4', 'M14 10v4', 'M18 10v4'] },
  { ar: 'ورش وبرامج ومساحات عمل للمبتكرين', en: 'Workshops, programs and workspaces', d: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c3 2 9 2 12 0v-5'] }
];

export const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map(p => <path key={p} d={p} />)}
  </svg>
);
const CHECK = ['M20 6 9 17l-5-5'];

// The page frame: the navy rail (brand, then the stepper while
// registering) beside the main column (tools + the card). Below 1100px
// the rail folds into a compact header with a segmented progress bar.
// `servicesHref`: shows a «الخدمات» icon back to the services list (e.g. '/register').
const StudioShell = ({ isRTL, theme, onToggleTheme, onHome, steps, activeStep, onJump, extra, intro, subtitle, servicesHref, railExtra, children }) => {
  const { i18n } = useTranslation();
  const inSteps = steps && activeStep >= 0;
  const total = steps ? steps.length : 0;
  const n = Math.min(Math.max(activeStep, 0) + 1, total);
  const pct = total ? Math.round((n / total) * 100) : 0;
  const toggleLanguage = () => {
    const next = isRTL ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.dir = next === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <div className="rgx" data-theme={theme} dir={isRTL ? 'rtl' : 'ltr'}>
      <aside className="rgx-rail">
        <motion.div
          className="rgx-rail-in"
          initial={{ opacity: 0, x: isRTL ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="rgx-brand">
            <span className="rgx-logo"><img src="/fablab.png" alt="" /></span>
            <span className="rgx-brand-text">
              <strong>{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</strong>
              <small>{isRTL ? 'مركز تنمية الإبداع والابتكار' : 'Creativity & Innovation Center'}</small>
            </span>
          </div>

          {inSteps ? (
            <div className="rgx-rail-steps">
              <p className="rgx-rail-kicker">
                {isRTL ? `الخطوة ${n} من ${total}` : `Step ${n} of ${total}`}
                <span>{pct}%</span>
              </p>
              <div className="rgx-rail-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
              <ol className="rgx-steps">
                {steps.map((s, i) => {
                  const state = i < activeStep ? 'done' : i === activeStep ? 'now' : 'next';
                  return (
                    <li key={s.key} className={`rgx-step is-${state}`}>
                      <button
                        type="button"
                        disabled={state !== 'done'}
                        onClick={() => onJump(i)}
                        aria-current={state === 'now' ? 'step' : undefined}
                        title={state === 'done' ? (isRTL ? 'الرجوع لهذه الخطوة' : 'Go back to this step') : undefined}
                      >
                        <span className="rgx-step-tile"><Icon d={state === 'done' ? CHECK : (s.icon || STEP_ICONS[i] || STEP_ICONS[0])} /></span>
                        <span className="rgx-step-text">
                          <small>{isRTL ? `الخطوة ${i + 1}` : `Step ${i + 1}`}</small>
                          <b>{s.label}</b>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="rgx-rail-intro">
              <span className="rgx-portal"><i aria-hidden="true" />{intro?.portal || (isRTL ? 'التسجيل وحجز المواعيد' : 'Registration & appointments')}</span>
              <h2>{intro?.title || (isRTL ? <>من الفكرة<br /><em>إلى النموذج الأول</em></> : <>From the idea<br /><em>to the first prototype</em></>)}</h2>
              <ul className="rgx-feats">
                {(intro?.features || RAIL_FEATURES).map((f, i) => (
                  <motion.li
                    key={f.en}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.09, duration: 0.45 }}
                  >
                    <span className={`rgx-ftile t${i}`}><Icon d={f.d} /></span>
                    <span>{isRTL ? f.ar : f.en}</span>
                  </motion.li>
                ))}
              </ul>
              {railExtra}
            </div>
          )}

          <p className="rgx-rail-foot">{isRTL ? 'فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية' : 'FabLab Al-Ahsa — Abdulmonem Al-Rashed Humanitarian Foundation'}</p>
        </motion.div>
      </aside>

      <main className="rgx-main">
        <header className="rgx-top">
          <a className="rgx-top-brand" href="/" aria-label={isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}>
            <span className="rgx-logo sm"><img src="/fablab.png" alt="" /></span>
            <span className="rgx-brand-text">
              <strong>{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</strong>
              <small>{subtitle || (isRTL ? 'التسجيل وحجز المواعيد' : 'Registration & appointments')}</small>
            </span>
          </a>
          <div className="rgx-tools">
            {servicesHref && (
              <Link className="rgx-tool" to={servicesHref} title={isRTL ? 'كل الخدمات' : 'All services'}>
                <Icon d={['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z']} />
                <span>{isRTL ? 'الخدمات' : 'Services'}</span>
              </Link>
            )}
            {inSteps && onHome && (
              <button type="button" className="rgx-tool" onClick={onHome} title={isRTL ? 'البدء من جديد' : 'Start over'}>
                <Icon d={['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5']} />
                <span>{isRTL ? 'من جديد' : 'Start over'}</span>
              </button>
            )}
            <a className="rgx-tool" href="/" title={isRTL ? 'الموقع الرئيسي' : 'Main website'}>
              <Icon d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10']} />
              <span>{isRTL ? 'الموقع' : 'Website'}</span>
            </a>
            <button type="button" className="rgx-tool" onClick={toggleLanguage} title={isRTL ? 'English' : 'العربية'}>
              <Icon d={['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z']} />
              <span>{isRTL ? 'English' : 'العربية'}</span>
            </button>
            <button
              type="button"
              className="rgx-tool icon"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? (isRTL ? 'الوضع الفاتح' : 'Light mode') : (isRTL ? 'الوضع الداكن' : 'Dark mode')}
              title={theme === 'dark' ? (isRTL ? 'الوضع الفاتح' : 'Light mode') : (isRTL ? 'الوضع الداكن' : 'Dark mode')}
            >
              {theme === 'dark'
                ? <Icon d={['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M4.93 19.07l1.41-1.41', 'M17.66 6.34l1.41-1.41']} />
                : <Icon d={['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z']} />}
            </button>
          </div>
        </header>

        {inSteps && (
          <div className="rgx-mprog">
            <div className="rgx-mprog-row">
              <b>{steps[Math.max(activeStep, 0)]?.label}</b>
              <span>{isRTL ? `الخطوة ${n} من ${total}` : `Step ${n} of ${total}`}</span>
            </div>
            <div className="rgx-mprog-bar" aria-hidden="true">
              {steps.map((s, i) => <i key={s.key} className={i < activeStep ? 'done' : i === activeStep ? 'now' : ''} />)}
            </div>
          </div>
        )}

        <div className="rgx-stage">{children}</div>
      </main>
      {extra}
    </div>
  );
};

// Theme for the studio pages (light by default, remembered), and lift the
// admin boards' theme off <html> while shown — the shared design-system
// rules keyed on it would restyle the page.
export const useStudioTheme = () => {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  });
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    if (prev) root.removeAttribute('data-theme');
    return () => { if (prev && !root.hasAttribute('data-theme')) root.setAttribute('data-theme', prev); };
  }, []);
  return [theme, toggleTheme];
};

export default StudioShell;
