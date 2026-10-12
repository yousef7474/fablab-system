import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { assetUrl, fmtDate, safeUrl } from './siteCore';
import './siteWorkshopCard.css';

const CLOSED = {
  full: ['مكتملة', 'Full'],
  started: ['بدأت الورشة', 'Started'],
  deadline: ['انتهى التسجيل', 'Registration ended'],
  disabled: ['التسجيل مغلق', 'Registration closed']
};

// Live workshops come from /api/workshops/active; archive entries
// (`_archive: true`) come from /api/site/workshops-archive.
const SiteWorkshopCard = ({ w, t, lang, showDesc = false }) => {
  const [imgOk, setImgOk] = useState(true);
  const archive = !!w._archive;
  const en = lang === 'en';
  const img = w.photo ? assetUrl(w.photo) : (w.imageUrl ? assetUrl(w.imageUrl) : '');
  const title = archive && en && w.titleEn ? w.titleEn : w.title;
  const desc = archive && en && w.descriptionEn ? w.descriptionEn : w.description;
  const open = !archive && w.isOpen !== false;
  const closedLabel = (CLOSED[w.closedReason] || CLOSED.disabled)[en ? 1 : 0];
  return (
    <article className="site-ws-card">
      <div className="site-ws-img">
        {img && imgOk
          ? <img src={img} alt={title} loading="lazy" onError={() => setImgOk(false)} />
          : <div className="site-ws-img-ph" style={w.color ? { '--ws-c': w.color } : undefined}><i className="fas fa-tools" aria-hidden="true" /></div>}
        {!archive && (
          <span className={`site-ws-badge ${open ? 'open' : 'closed'}`}>
            {open ? t('registerNow') : closedLabel}
          </span>
        )}
      </div>
      <div className="site-ws-body">
        <h3>{title}</h3>
        {showDesc && desc && <p className="site-ws-desc">{desc}</p>}
        <div className="site-ws-meta">
          {w.startDate && (
            <span><i className="far fa-calendar" aria-hidden="true" /> {fmtDate(w.startDate, lang)}{w.endDate && w.endDate !== w.startDate ? ` – ${fmtDate(w.endDate, lang)}` : ''}</span>
          )}
          {!archive && w.totalHours ? <span><i className="far fa-clock" aria-hidden="true" /> {w.totalHours} {en ? 'hrs' : 'ساعة'}</span> : null}
          {archive && w.duration ? <span><i className="far fa-clock" aria-hidden="true" /> {w.duration}</span> : null}
          {!archive && w.presenter ? <span><i className="fas fa-chalkboard-teacher" aria-hidden="true" /> {w.presenter}</span> : null}
          {!archive && <span className="site-ws-price">{Number(w.price) > 0 ? `${w.price} ${t('sar')}` : t('free')}</span>}
        </div>
        {archive ? (
          safeUrl(w.link) ? <a href={safeUrl(w.link)} target="_blank" rel="noopener noreferrer" className="site-btn site-btn--outline site-btn--sm">{t('readMore')} <i className="fas fa-external-link-alt" aria-hidden="true" /></a> : null
        ) : open ? (
          <Link to="/workshop" className="site-btn site-btn--primary site-btn--sm"><i className="fas fa-user-plus" aria-hidden="true" /> {t('registerNow')}</Link>
        ) : (
          <span className="site-btn site-btn--sm site-btn-disabled">{t('regClosed')}</span>
        )}
      </div>
    </article>
  );
};

export default SiteWorkshopCard;
