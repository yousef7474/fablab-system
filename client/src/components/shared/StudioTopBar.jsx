import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Icon } from '../RegistrationForm/StudioShell';
import './StudioTopBar.css';

// Top bar in the registration studio's style for full-width pages (store,
// elite account): brand on the start edge; the page's own tools
// (`children`) then the studio tools — services, website, language,
// theme — on the end edge, then `end` (e.g. the cart). Render it inside
// a `.rgx[data-theme]` root.
const StudioTopBar = ({ isRTL, theme, onToggleTheme, subtitle, onBrand, children, end }) => {
  const { i18n } = useTranslation();
  const toggleLanguage = () => {
    const next = isRTL ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.dir = next === 'ar' ? 'rtl' : 'ltr';
  };
  const themeLabel = theme === 'dark' ? (isRTL ? 'الوضع الفاتح' : 'Light mode') : (isRTL ? 'الوضع الداكن' : 'Dark mode');

  return (
    <header className="stb">
      <div className="stb-in">
        <button type="button" className="stb-brand" onClick={onBrand}>
          <span className="rgx-logo sm"><img src="/fablab.png" alt="" /></span>
          <span className="rgx-brand-text">
            <strong>{isRTL ? 'فاب لاب الأحساء' : 'FabLab Al-Ahsa'}</strong>
            <small>{subtitle}</small>
          </span>
        </button>
        <div className="rgx-tools stb-tools">
          {children}
          <Link className="rgx-tool" to="/register" title={isRTL ? 'كل الخدمات' : 'All services'}>
            <Icon d={['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z']} />
            <span>{isRTL ? 'الخدمات' : 'Services'}</span>
          </Link>
          <a className="rgx-tool stb-site" href="/" title={isRTL ? 'الموقع الرئيسي' : 'Main website'}>
            <Icon d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10']} />
            <span>{isRTL ? 'الموقع' : 'Website'}</span>
          </a>
          <button type="button" className="rgx-tool" onClick={toggleLanguage} title={isRTL ? 'English' : 'العربية'}>
            <Icon d={['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z']} />
            <span>{isRTL ? 'English' : 'العربية'}</span>
          </button>
          <button type="button" className="rgx-tool icon" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
            {theme === 'dark'
              ? <Icon d={['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M4.93 19.07l1.41-1.41', 'M17.66 6.34l1.41-1.41']} />
              : <Icon d={['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z']} />}
          </button>
          {end}
        </div>
      </div>
    </header>
  );
};

export default StudioTopBar;
