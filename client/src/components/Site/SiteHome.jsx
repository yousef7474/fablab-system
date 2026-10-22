import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import SiteLayout, { REGISTER_MENU } from './SiteLayout';
import { Reveal, SectionHeader } from './SiteParts';
import SiteWorkshopCard from './SiteWorkshopCard';
import { useSiteLang, useSiteContent, useInView, prefersReducedMotion, assetUrl, scrollToId } from './siteCore';
import './siteHome.css';

// ---------- Hero (background video + headline) ----------
const Hero = ({ t }) => {
  const [videoOk, setVideoOk] = useState(true);
  const videoRef = useRef(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (prefersReducedMotion()) { v.pause(); return; }
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }, []);
  return (
    <section className="site-hero" id="home">
      <div className="site-hero-media" style={{ backgroundImage: 'url(/site/hero-poster.jpg)' }}>
        {videoOk && (
          <video
            ref={videoRef}
            className="site-hero-video"
            src="/site/hero.mp4"
            poster="/site/hero-poster.jpg"
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden="true"
            onError={() => setVideoOk(false)}
          />
        )}
      </div>
      <div className="site-hero-overlay" aria-hidden="true" />
      <div className="site-hero-text">
        <h1>{t('heroTitle')}</h1>
        <p>{t('heroSubtitle')}</p>
        <div className="site-hero-cta">
          <button type="button" className="site-btn site-btn--primary" onClick={() => scrollToId('quick-register')}>
            <i className="fas fa-user-plus" aria-hidden="true" /> {t('heroCta')}
          </button>
          <Link to="/services" className="site-btn site-btn--outline">{t('heroCta2')}</Link>
        </div>
      </div>
      <button type="button" className="site-hero-scroll" aria-label="scroll" onClick={() => scrollToId('about-fablab')}>
        <i className="fas fa-chevron-down" aria-hidden="true" />
      </button>
    </section>
  );
};

// ---------- About (typing text) ----------
const TypingText = ({ text }) => {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const [shown, setShown] = useState(prefersReducedMotion() ? text : '');
  useEffect(() => {
    if (!inView) return undefined;
    if (prefersReducedMotion()) { setShown(text); return undefined; }
    setShown('');
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [inView, text]);
  const done = shown.length >= text.length;
  return (
    <p ref={ref} className="site-typing" aria-label={text}>
      <span className="site-typing-text" aria-hidden="true">
        {shown}
        {!done && <span className="site-typing-cursor" />}
      </span>
      {/* invisible full copy reserves the final height — nothing jumps */}
      <span className="site-typing-ghost" aria-hidden="true">{text}</span>
    </p>
  );
};

// ---------- Live workshops carousel ----------
const WorkshopsCarousel = ({ t, lang, isRTL }) => {
  const [items, setItems] = useState(null);
  const trackRef = useRef(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      let list = [];
      try {
        const { data } = await api.get('/workshops/active');
        list = (Array.isArray(data) ? data : []).filter(w => w.isOpen !== false || ['full', 'started', 'deadline'].includes(w.closedReason));
      } catch { /* fall back to the archive */ }
      if (!list.length) {
        try {
          const { data } = await api.get('/site/workshops-archive', { params: { limit: 8, offset: 0 } });
          list = (data?.items || []).map(x => ({ ...x, _archive: true }));
        } catch { /* nothing to show */ }
      }
      if (alive) setItems(list);
    })();
    return () => { alive = false; };
  }, []);

  const scroll = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('.site-ws-card');
    const step = card ? card.getBoundingClientRect().width + 20 : el.clientWidth * 0.8;
    // "next" moves toward the end of the reading direction.
    el.scrollBy({ left: (isRTL ? -1 : 1) * dir * step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('.site-ws-card');
    const step = card ? card.getBoundingClientRect().width + 20 : 1;
    setPage(Math.round(Math.abs(el.scrollLeft) / step));
  };
  const goTo = (i) => {
    const el = trackRef.current;
    const card = el?.querySelector('.site-ws-card');
    if (!el || !card) return;
    const step = card.getBoundingClientRect().width + 20;
    el.scrollTo({ left: (isRTL ? -1 : 1) * i * step, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <section className="site-section" id="workshops">
      <div className="site-container">
        <Reveal className="site-panel">
          <SectionHeader title={t('workshopsTitle')} />
          {items === null ? (
            <div className="site-ws-skeleton" aria-hidden="true"><span /><span /><span /></div>
          ) : items.length === 0 ? (
            <p className="site-muted-center">{t('noWorkshops')}</p>
          ) : (
            <div className="site-carousel">
              <button type="button" className="site-carousel-btn prev" onClick={() => scroll(-1)} aria-label={t('prev')}>
                <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'}`} aria-hidden="true" />
              </button>
              <div className="site-carousel-track" ref={trackRef} onScroll={onScroll}>
                {items.map(w => <SiteWorkshopCard key={w.workshopId || w.id} w={w} t={t} lang={lang} />)}
              </div>
              <button type="button" className="site-carousel-btn next" onClick={() => scroll(1)} aria-label={t('next')}>
                <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'}`} aria-hidden="true" />
              </button>
            </div>
          )}
          {items && items.length > 1 && (
            <div className="site-carousel-dots">
              {items.slice(0, 12).map((w, i) => (
                <button key={w.workshopId || w.id} type="button" className={page === i ? 'on' : ''} onClick={() => goTo(i)} aria-label={`${i + 1}`} />
              ))}
            </div>
          )}
          <div className="site-center-row">
            <Link to="/workshops" className="site-btn-control"><i className="fas fa-th-large" aria-hidden="true" /> {t('viewAll')}</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// ---------- Counters ----------
const Counter = ({ target }) => {
  const [ref, inView] = useInView({ threshold: 0.4 });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    const end = Number(target) || 0;
    if (prefersReducedMotion() || end <= 0) { setVal(end); return undefined; }
    const start = performance.now();
    const dur = 1800;
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      setVal(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);
  return <span ref={ref} className="site-counter">{val.toLocaleString('en-US')}</span>;
};

// ---------- Partners: mobile grid + desktop 3D carousel ----------
const Partners = ({ t, partners, pick }) => {
  const n = partners.length;
  const faceW = 210;
  const radius = n > 2 ? Math.round((faceW / 2) / Math.tan(Math.PI / n)) + 30 : 260;
  return (
    <section className="site-section" id="partners">
      <div className="site-container">
        <Reveal className="site-panel">
          <SectionHeader title={t('partnersTitle')} subtitle={t('partnersText')} />
          <div className="site-partners-grid">
            {partners.map(p => (
              <div className="site-partner" key={p.id || p.name}>
                <div className="site-partner-logo">
                  {p.logoUrl ? <img src={assetUrl(p.logoUrl)} alt={pick(p.name, p.nameEn)} loading="lazy" /> : <i className="fas fa-handshake" aria-hidden="true" />}
                </div>
                <span>{pick(p.name, p.nameEn)}</span>
              </div>
            ))}
          </div>
          <div className="site-3d-wrap" aria-hidden="true">
            <div className="site-3d" style={{ '--n': n, '--r': `${radius}px` }}>
              {partners.map((p, i) => (
                <div key={p.id || p.name} className="site-3d-face" style={{ transform: `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)` }}>
                  {p.logoUrl ? <img src={assetUrl(p.logoUrl)} alt="" loading="lazy" /> : null}
                  <span>{pick(p.name, p.nameEn)}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const QUICK_ICON_COLORS = ['#9C27B0', '#03A9F4', '#FFC107', '#4CAF50', '#E91E63', '#00BCD4', '#FF7043', '#7C4DFF', '#26A69A'];

const SiteHome = () => {
  const { lang, isRTL, t, pick } = useSiteLang();
  const content = useSiteContent();
  const [flipped, setFlipped] = useState(null);
  const stats = content.stats || {};
  const cards = useMemo(() => [['fa-lightbulb', 'creativity'], ['fa-book', 'education'], ['fa-users', 'partnerships']], []);

  return (
    <SiteLayout transparentHeader className="site-home">
      <Hero t={t} />

      <section className="site-section" id="about-fablab">
        <div className="site-container">
          <Reveal className="site-panel">
            <SectionHeader title={t('aboutTitle')} />
            <div className="site-about-content">
              <TypingText key={lang} text={t('aboutText')} />
              <div className="site-cards-3">
                {cards.map(([icon, key], i) => (
                  <Reveal key={key} className="site-mini-card" delay={i * 90}>
                    <i className={`fas ${icon}`} aria-hidden="true" />
                    <span>{t(key)}</span>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section" id="quick-register">
        <div className="site-container">
          <Reveal className="site-panel">
            <SectionHeader title={t('quickTitle')} subtitle={t('quickText')} />
            <div className="site-quick-grid">
              {REGISTER_MENU.map(([key, to, icon], i) => (
                <Reveal key={key} delay={i * 50}>
                  <Link to={to} className="site-quick" style={{ '--qc': QUICK_ICON_COLORS[i % QUICK_ICON_COLORS.length] }}>
                    <span className="site-quick-icon"><i className={`fas ${icon}`} aria-hidden="true" /></span>
                    <span className="site-quick-label">{t(key)}</span>
                    <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} site-quick-go`} aria-hidden="true" />
                  </Link>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section" id="vision">
        <div className="site-container">
          <Reveal className="site-panel">
            <SectionHeader title={t('visionMission')} />
            <div className="site-vision-boxes">
              {[['mission', 'fa-lightbulb', 'missionText'], ['vision', 'fa-eye', 'visionText']].map(([key, icon, text]) => (
                <button
                  type="button"
                  key={key}
                  className={`site-vision-box ${flipped === key ? 'on' : ''}`}
                  onClick={() => setFlipped(flipped === key ? null : key)}
                  aria-expanded={flipped === key}
                >
                  <span className="site-vision-label"><i className={`fas ${icon}`} aria-hidden="true" /> <span>{t(key)}</span></span>
                  <span className="site-vision-text">{t(text)}</span>
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <WorkshopsCarousel t={t} lang={lang} isRTL={isRTL} />

      <section className="site-section" id="achievements">
        <div className="site-container">
          <Reveal className="site-panel">
            <SectionHeader title={t('achievementsTitle')} subtitle={t('achievementsText')} />
            <div className="site-achievements">
              {[['fa-users', stats.beneficiaries, 'beneficiaries'], ['fa-project-diagram', stats.projects, 'projects'], ['fa-chalkboard-teacher', stats.workshops, 'workshopsCount']].map(([icon, value, label], i) => (
                <Reveal key={label} className="site-achievement" delay={i * 100}>
                  <div className="site-achievement-icon"><i className={`fas ${icon}`} aria-hidden="true" /></div>
                  <div className="site-achievement-num"><Counter target={value} /><sup>+</sup></div>
                  <p>{t(label)}</p>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <Partners t={t} partners={content.partners || []} pick={pick} />
    </SiteLayout>
  );
};

export default SiteHome;
