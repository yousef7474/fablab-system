import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../../config/api';
import StarField from './StarField';
import { useSiteLang, useSiteContent, assetUrl, EMAIL_RE, apiError, scrollToId, safeUrl } from './siteCore';
import './site.css';

// Font Awesome is only needed on the public website — load it once here
// instead of on every page of the app.
const FA_HREF = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
const ensureFontAwesome = () => {
  if (typeof document === 'undefined' || document.querySelector(`link[href="${FA_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FA_HREF;
  link.crossOrigin = 'anonymous';
  link.referrerPolicy = 'no-referrer';
  document.head.appendChild(link);
};

const NAV = [
  { key: 'home', to: '/' },
  { key: 'aboutUs', items: [['aboutFablab', '/about'], ['paths', '/paths'], ['sections', '/sections'], ['facilities', '/facilities']] },
  { key: 'services', items: [['courses', '/workshops'], ['ourServices', '/services']] },
  { key: 'media', to: '/media' },
  { key: 'stories', to: '/success-stories' },
  { key: 'joinUs', items: [['volunteer', '/volunteer'], ['internship', '/internship'], ['talented', '/i-am-talented'], ['contact', '#contact']] }
];

export const REGISTER_MENU = [
  ['regServices', '/register', 'fa-clipboard-list'],
  ['regWorkshops', '/workshop', 'fa-chalkboard-teacher'],
  ['regVisit', '/fablab-visit', 'fa-building'],
  ['regProjectSupport', '/project-support', 'fa-lightbulb'],
  ['reg3d', '/print-service', 'fa-cube'],
  ['regStore', '/store', 'fa-store'],
  ['regTalented', '/i-am-talented', 'fa-star'],
  ['regInternship', '/internship', 'fa-user-graduate']
];
const LOGIN_MENU = [
  ['loginEmployee', '/employee/login', 'fa-id-badge'],
  ['loginAdmin', '/admin/login', 'fa-user-shield'],
  ['loginStore', '/store/my-orders', 'fa-receipt']
];

const isActivePath = (pathname, to) => {
  if (!to || to.startsWith('#')) return false;
  const base = to.split('?')[0];
  return base === '/' ? pathname === '/' : pathname === base || pathname.startsWith(`${base}/`);
};

// A menu link: in-page anchors scroll, everything else is a router link.
const MenuLink = ({ to, children, onNavigate, className }) => {
  if (to.startsWith('#')) {
    return (
      <a href={to} className={className} onClick={(e) => { e.preventDefault(); onNavigate?.(); scrollToId(to.slice(1)); }}>
        {children}
      </a>
    );
  }
  return <Link to={to} className={className} onClick={() => onNavigate?.()}>{children}</Link>;
};

const Dropdown = ({ id, label, icon, items, t, open, setOpen, pathname, variant = 'nav' }) => {
  const isOpen = open === id;
  const active = items.some(([, to]) => isActivePath(pathname, to));
  return (
    <li
      className={`site-dd ${isOpen ? 'open' : ''} ${variant === 'btn' ? 'site-dd--btn' : ''}`}
      onMouseEnter={() => window.matchMedia('(hover: hover)').matches && setOpen(id)}
      onMouseLeave={() => window.matchMedia('(hover: hover)').matches && setOpen(null)}
    >
      <button
        type="button"
        className={variant === 'btn' ? 'site-btn-control' : `site-dd-toggle ${active ? 'active' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setOpen(isOpen ? null : id)}
      >
        {icon && <i className={`fas ${icon}`} aria-hidden="true" />}
        <span>{label}</span>
        <i className="fas fa-chevron-down site-dd-caret" aria-hidden="true" />
      </button>
      <ul className="site-dd-menu" role="menu">
        {items.map(([key, to, ic]) => (
          <li key={key} role="none">
            <MenuLink to={to} onNavigate={() => setOpen(null)} className={isActivePath(pathname, to) ? 'active' : ''}>
              {ic && <i className={`fas ${ic}`} aria-hidden="true" />}
              {t(key)}
            </MenuLink>
          </li>
        ))}
      </ul>
    </li>
  );
};

const ContactForm = ({ t, isRTL }) => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [state, setState] = useState({ status: 'idle', msg: '' });
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return setState({ status: 'error', msg: t('fillAll') });
    if (!EMAIL_RE.test(form.email.trim())) return setState({ status: 'error', msg: t('validEmail') });
    setState({ status: 'sending', msg: '' });
    try {
      await api.post('/site/contact', { name: form.name.trim(), email: form.email.trim(), message: form.message.trim() });
      setForm({ name: '', email: '', message: '' });
      setState({ status: 'ok', msg: t('messageSent') });
    } catch (err) {
      setState({ status: 'error', msg: apiError(err, isRTL, t('sendError'), t('sendError')) });
    }
  };
  return (
    <form className="site-contact-form" onSubmit={submit} noValidate>
      <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('fullName')} aria-label={t('fullName')} maxLength={120} />
      <input type="email" dir="ltr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('yourEmail')} aria-label={t('yourEmail')} maxLength={150} />
      <textarea rows={3} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder={t('yourMessage')} aria-label={t('yourMessage')} maxLength={3000} />
      {state.msg && <div className={`site-form-msg ${state.status === 'ok' ? 'ok' : 'err'}`} role="status">{state.msg}</div>}
      <button type="submit" className="site-btn site-btn--primary site-btn--block" disabled={state.status === 'sending'}>
        {state.status === 'sending' ? t('sending') : t('sendButton')}
      </button>
    </form>
  );
};

const SiteLayout = ({ children, transparentHeader = false, className = '' }) => {
  const { lang, isRTL, t, toggle } = useSiteLang();
  const content = useSiteContent();
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(null);         // open desktop dropdown id
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => { ensureFontAwesome(); }, []);

  // The admin dashboards put data-theme="dark" on <html>, and their global
  // [data-theme] element rules would restyle this page after in-app
  // navigation. Lift it while the website is shown; restore on leave.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    if (prev) root.removeAttribute('data-theme');
    return () => { if (prev && !root.hasAttribute('data-theme')) root.setAttribute('data-theme', prev); };
  }, []);

  // Route change: close menus; jump to top (or to the #hash target).
  useEffect(() => {
    setOpen(null);
    setMobileOpen(false);
    if (hash) setTimeout(() => scrollToId(hash.slice(1)), 120);
    else window.scrollTo(0, 0);
  }, [pathname, hash]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdowns on outside click / Escape.
  useEffect(() => {
    const onDown = (e) => { if (headerRef.current && !headerRef.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(null); setMobileOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const c = content.contact;
  const social = content.social;
  const solid = !transparentHeader || scrolled;

  return (
    <div className={`site ${className}`} dir={isRTL ? 'rtl' : 'ltr'} lang={lang}>
      <div className="site-bg" aria-hidden="true" />
      <StarField />

      <header ref={headerRef} className={`site-header ${solid ? 'solid' : ''}`}>
        <Link to="/" className="site-logo" aria-label={t('home')}>
          <img src="/site/fablab-logo.png" alt={isRTL ? 'شعار فاب لاب الأحساء' : 'FabLab Al-Ahsa logo'} width="150" height="70" />
        </Link>

        <nav className="site-nav" aria-label={isRTL ? 'القائمة الرئيسية' : 'Main menu'}>
          <ul>
            {NAV.map(n => (n.items ? (
              <Dropdown key={n.key} id={n.key} label={t(n.key)} items={n.items} t={t} open={open} setOpen={setOpen} pathname={pathname} />
            ) : (
              <li key={n.key}><Link to={n.to} className={isActivePath(pathname, n.to) ? 'active' : ''}>{t(n.key)}</Link></li>
            )))}
          </ul>
        </nav>

        <ul className="site-controls">
          <li><button type="button" className="site-btn-control site-lang" onClick={toggle} lang={isRTL ? 'en' : 'ar'}>{t('langSwitch')}</button></li>
          <Dropdown id="register" variant="btn" icon="fa-user-plus" label={t('register')} items={REGISTER_MENU} t={t} open={open} setOpen={setOpen} pathname={pathname} />
          <Dropdown id="login" variant="btn" icon="fa-sign-in-alt" label={t('login')} items={LOGIN_MENU} t={t} open={open} setOpen={setOpen} pathname={pathname} />
        </ul>

        <button type="button" className="site-burger" aria-label={t('openMenu')} aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
          <i className="fas fa-bars" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile drawer */}
      <div className={`site-drawer-scrim ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <aside className={`site-drawer ${mobileOpen ? 'open' : ''}`} aria-hidden={!mobileOpen} aria-label={isRTL ? 'القائمة' : 'Menu'}>
        <div className="site-drawer-head">
          <img src="/site/fablab-logo.png" alt="" width="120" height="56" />
          <button type="button" className="site-drawer-close" aria-label={t('closeMenu')} onClick={() => setMobileOpen(false)}>
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>
        <nav className="site-drawer-nav">
          <ul>
            {NAV.map(n => (n.items ? (
              <li key={n.key}>
                <button type="button" className={`site-drawer-group ${mobileGroup === n.key ? 'open' : ''}`} aria-expanded={mobileGroup === n.key} onClick={() => setMobileGroup(mobileGroup === n.key ? null : n.key)}>
                  {t(n.key)} <i className="fas fa-chevron-down" aria-hidden="true" />
                </button>
                <ul className={`site-drawer-sub ${mobileGroup === n.key ? 'open' : ''}`}>
                  {n.items.map(([key, to]) => (
                    <li key={key}><MenuLink to={to} onNavigate={() => setMobileOpen(false)}>{t(key)}</MenuLink></li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={n.key}><Link to={n.to} className={isActivePath(pathname, n.to) ? 'active' : ''} onClick={() => setMobileOpen(false)}>{t(n.key)}</Link></li>
            )))}
            {[['register', REGISTER_MENU, 'fa-user-plus'], ['login', LOGIN_MENU, 'fa-sign-in-alt']].map(([key, items, icon]) => (
              <li key={key}>
                <button type="button" className={`site-drawer-group accent ${mobileGroup === key ? 'open' : ''}`} aria-expanded={mobileGroup === key} onClick={() => setMobileGroup(mobileGroup === key ? null : key)}>
                  <span><i className={`fas ${icon}`} aria-hidden="true" /> {t(key)}</span> <i className="fas fa-chevron-down" aria-hidden="true" />
                </button>
                <ul className={`site-drawer-sub ${mobileGroup === key ? 'open' : ''}`}>
                  {items.map(([k, to, ic]) => (
                    <li key={k}><MenuLink to={to} onNavigate={() => setMobileOpen(false)}><i className={`fas ${ic}`} aria-hidden="true" /> {t(k)}</MenuLink></li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="site-btn-control site-lang site-drawer-lang" onClick={toggle}>{t('langSwitch')}</button>
      </aside>

      <main className="site-main">{children}</main>

      <footer className="site-footer" id="contact">
        <div className="site-footer-grid">
          <div className="site-footer-col site-footer-brand">
            <img src="/site/fablab-logo.png" alt={isRTL ? 'شعار فاب لاب الأحساء' : 'FabLab Al-Ahsa logo'} width="170" height="80" loading="lazy" />
            <ul className="site-social" aria-label={t('followUs')}>
              {safeUrl(social.x) && <li><a href={safeUrl(social.x)} target="_blank" rel="noopener noreferrer" aria-label="X" data-social="x"><span className="site-x-icon" aria-hidden="true">𝕏</span></a></li>}
              {safeUrl(social.instagram) && <li><a href={safeUrl(social.instagram)} target="_blank" rel="noopener noreferrer" aria-label="Instagram" data-social="instagram"><i className="fab fa-instagram" aria-hidden="true" /></a></li>}
              {safeUrl(social.youtube) && <li><a href={safeUrl(social.youtube)} target="_blank" rel="noopener noreferrer" aria-label="YouTube" data-social="youtube"><i className="fab fa-youtube" aria-hidden="true" /></a></li>}
              {safeUrl(social.snapchat) && <li><a href={safeUrl(social.snapchat)} target="_blank" rel="noopener noreferrer" aria-label="Snapchat" data-social="snapchat"><i className="fab fa-snapchat" aria-hidden="true" /></a></li>}
            </ul>
          </div>

          <div className="site-footer-col">
            <h3>{t('location')}</h3>
            <div className="site-map">
              {c.mapEmbedUrl && (
                <iframe title={t('location')} src={c.mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
              )}
            </div>
          </div>

          <div className="site-footer-col">
            <h3>{t('contactInfo')}</h3>
            <ul className="site-contact-list">
              {c.email && <li><i className="fas fa-envelope" aria-hidden="true" /> <span>{t('email')}:</span> <a href={`mailto:${c.email}`} dir="ltr">{c.email}</a></li>}
              {c.phone && <li><i className="fas fa-phone" aria-hidden="true" /> <span>{t('phone')}:</span> <a href={`tel:${String(c.phone).replace(/[^0-9+]/g, '')}`} dir="ltr">{c.phone}</a></li>}
              {c.whatsapp && <li><i className="fab fa-whatsapp" aria-hidden="true" /> <span>{isRTL ? 'واتساب' : 'WhatsApp'}:</span> <a href={`https://wa.me/${String(c.whatsapp).replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" dir="ltr">+{String(c.whatsapp).replace(/[^0-9]/g, '')}</a></li>}
              {(isRTL ? c.addressAr : (c.addressEn || c.addressAr)) && <li><i className="fas fa-map-marker-alt" aria-hidden="true" /> <span>{t('address')}:</span> {isRTL ? c.addressAr : (c.addressEn || c.addressAr)}</li>}
            </ul>
            <h3 className="site-footer-sub">{t('workingHours')}</h3>
            <p className="site-hours"><i className="fas fa-clock" aria-hidden="true" /> {isRTL ? content.workingHoursAr : (content.workingHoursEn && content.workingHoursEn !== '-' ? content.workingHoursEn : content.workingHoursAr)}</p>
          </div>

          <div className="site-footer-col">
            <h3>{t('sendMessage')}</h3>
            <ContactForm t={t} isRTL={isRTL} />
          </div>
        </div>
        <div className="site-copyright">{t('copyright')}</div>
      </footer>
    </div>
  );
};

export { assetUrl };
export default SiteLayout;
