import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../config/api';
import SiteLayout from './SiteLayout';
import { PageHero, EmptyState, Spinner, Modal } from './SiteParts';
import { useSiteLang, assetUrl, fmtDate, safeUrl } from './siteCore';
import './sitePages.css';

const PAGE = 9;

const TABS = [
  { kind: 'news', icon: 'fa-newspaper', ar: ['الأخبار', 'آخر الأخبار', 'المزيد من الأخبار', 'لا توجد أخبار حالياً', 'سيتم إضافة أخبار قريباً'], en: ['News', 'Latest News', 'More News', 'No news available', 'News will be added soon'] },
  { kind: 'coverage', icon: 'fa-video', ar: ['التغطيات الإعلامية', 'التغطيات الإعلامية', 'المزيد من المقاطع', 'لا توجد تغطيات إعلامية حالياً', 'سيتم إضافة تغطيات إعلامية قريباً'], en: ['Media Coverage', 'Media Coverage', 'More Videos', 'No media coverage available', 'Media coverage will be added soon'] },
  { kind: 'report', icon: 'fa-file-alt', ar: ['التقارير', 'التقارير', 'المزيد من التقارير', 'لا توجد تقارير حالياً', 'سيتم إضافة تقارير قريباً'], en: ['Reports', 'Reports', 'More Reports', 'No reports available', 'Reports will be added soon'] }
];

// youtube.com/watch?v=…, youtu.be/…, /shorts/…, /embed/… → video id
const youtubeId = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
      if (m) return m[2];
    }
  } catch { /* not a URL */ }
  return null;
};

const MediaImage = ({ src, alt, icon }) => {
  const [ok, setOk] = useState(true);
  return src && ok
    ? <img src={assetUrl(src)} alt={alt} loading="lazy" onError={() => setOk(false)} />
    : <div className="site-media-ph"><i className={`fas ${icon}`} aria-hidden="true" /></div>;
};

const SiteMedia = () => {
  const { lang, t, pick } = useSiteLang();
  const ar = lang === 'ar';
  const [params, setParams] = useSearchParams();
  const kind = TABS.some(x => x.kind === params.get('tab')) ? params.get('tab') : 'news';
  const tabDef = TABS.find(x => x.kind === kind);
  const L = tabDef[lang];

  const [data, setData] = useState({}); // kind → { items, total, loaded, loading, err }
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [video, setVideo] = useState(null); // { id, title }
  const [detail, setDetail] = useState(null);
  const reqRef = useRef({}); // kind → latest request number

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async (k, offset, search) => {
    const req = (reqRef.current[k] || 0) + 1;
    reqRef.current[k] = req;
    setData(d => ({ ...d, [k]: { ...(d[k] || { items: [], total: 0 }), loading: true, err: false } }));
    try {
      const { data: res } = await api.get('/site/media', { params: { kind: k, limit: PAGE, offset, ...(search ? { q: search } : {}) } });
      if (req !== reqRef.current[k]) return; // a newer request for this tab is in flight
      setData(d => ({
        ...d,
        [k]: { items: offset ? [...(d[k]?.items || []), ...(res?.items || [])] : (res?.items || []), total: Number(res?.total) || 0, loaded: true, loading: false, err: false, q: search }
      }));
    } catch {
      if (req !== reqRef.current[k]) return;
      setData(d => ({ ...d, [k]: { ...(d[k] || { items: [], total: 0 }), loaded: true, loading: false, err: true, q: search } }));
    }
  }, []);

  const cur = data[kind];
  useEffect(() => {
    if (!cur || (!cur.loading && cur.q !== query)) load(kind, 0, query);
  }, [kind, query, cur, load]);

  const setTab = (k) => setParams(k === 'news' ? {} : { tab: k }, { replace: true });

  const openItem = (item) => {
    const yt = youtubeId(item.videoUrl);
    if (yt) { setVideo({ id: yt, title: pick(item.title, item.titleEn) }); return; }
    const url = safeUrl(item.videoUrl) || safeUrl(item.link);
    if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
    setDetail(item);
  };

  const items = cur?.items || [];
  const views = (n) => (Number(n) > 0 ? `${Number(n).toLocaleString(ar ? 'ar-SA-u-nu-latn' : 'en-US')} ${t('views')}` : '');

  const renderNews = (item) => {
    const title = pick(item.title, item.titleEn);
    const desc = pick(item.description, item.descriptionEn);
    return (
      <article key={item.id} className="site-media-card">
        <div className="site-media-img">
          <MediaImage src={item.imageUrl} alt={title} icon="fa-newspaper" />
          {item.date && <span className="site-media-date">{fmtDate(item.date, lang)}</span>}
          {item.videoUrl && <button type="button" className="site-media-play" onClick={() => openItem(item)} aria-label={title}><i className="fas fa-play" aria-hidden="true" /></button>}
        </div>
        <div className="site-media-body">
          {item.category && <span className="site-media-cat">{item.category}</span>}
          <h3>{title}</h3>
          {desc && <p>{desc}</p>}
          <button type="button" className="site-link-btn" onClick={() => setDetail(item)}>
            {t('readMore')} <i className={`fas ${ar ? 'fa-arrow-left' : 'fa-arrow-right'}`} aria-hidden="true" />
          </button>
        </div>
      </article>
    );
  };

  const renderCoverage = (item) => {
    const title = pick(item.title, item.titleEn);
    const desc = pick(item.description, item.descriptionEn);
    const playable = youtubeId(item.videoUrl) || safeUrl(item.videoUrl) || safeUrl(item.link);
    return (
      <article key={item.id} className="site-media-card video">
        <button type="button" className="site-media-img as-btn" onClick={() => openItem(item)} aria-label={title}>
          <MediaImage src={item.imageUrl} alt="" icon={item.mediaType === 'video' || item.videoUrl ? 'fa-video' : 'fa-image'} />
          {playable && <span className="site-media-play"><i className={`fas ${item.videoUrl ? 'fa-play' : 'fa-external-link-alt'}`} aria-hidden="true" /></span>}
          {item.duration && <span className="site-media-duration">{item.duration}</span>}
        </button>
        <div className="site-media-body">
          <h3>{title}</h3>
          {desc && <p>{desc}</p>}
          <div className="site-media-stats">
            {item.date && <span><i className="far fa-calendar" aria-hidden="true" /> {fmtDate(item.date, lang)}</span>}
            {views(item.views) && <span><i className="far fa-eye" aria-hidden="true" /> {views(item.views)}</span>}
          </div>
        </div>
      </article>
    );
  };

  const renderReport = (item) => {
    const title = pick(item.title, item.titleEn);
    const desc = pick(item.description, item.descriptionEn);
    return (
      <article key={item.id} className="site-report-card">
        <div className="site-report-head">
          <span className="site-report-icon"><i className="fas fa-file-alt" aria-hidden="true" /></span>
          <div>
            <h3>{title}</h3>
            {item.date && <span className="site-report-date">{fmtDate(item.date, lang)}</span>}
          </div>
        </div>
        {item.imageUrl && <div className="site-report-img"><MediaImage src={item.imageUrl} alt="" icon="fa-file-alt" /></div>}
        {desc && <p>{desc}</p>}
        <div className="site-report-actions">
          {desc && desc.length > 220 && (
            <button type="button" className="site-link-btn" onClick={() => setDetail(item)}>{t('readMore')}</button>
          )}
          {safeUrl(item.link) && (
            <a href={safeUrl(item.link)} target="_blank" rel="noopener noreferrer" className="site-btn site-btn--blue site-btn--sm">
              <i className="fas fa-download" aria-hidden="true" /> {ar ? 'تحميل التقرير الكامل' : 'Download Full Report'}
            </a>
          )}
        </div>
      </article>
    );
  };

  const detailTitle = detail ? pick(detail.title, detail.titleEn) : '';
  const detailDesc = detail ? pick(detail.description, detail.descriptionEn) : '';

  return (
    <SiteLayout className="site-media">
      <PageHero
        title={ar ? 'المركز الإعلامي' : 'Media Center'}
        intro={ar
          ? 'استكشف آخر الأخبار والفعاليات والمنشورات الإعلامية لفاب لاب الأحساء. تابع إبداعاتنا وأحدث مشاريعنا.'
          : 'Explore the latest news, events, and media publications from FabLab Al-Ahsa. Follow our innovations and latest projects.'}
      >
        <div className="site-tabs" role="tablist">
          {TABS.map(x => (
            <button key={x.kind} type="button" role="tab" aria-selected={kind === x.kind} className={`site-tab ${kind === x.kind ? 'on' : ''}`} onClick={() => setTab(x.kind)}>
              <i className={`fas ${x.icon}`} aria-hidden="true" /> {x[lang][0]}
            </button>
          ))}
        </div>
      </PageHero>

      <section className="site-section">
        <div className="site-container">
          <div className="site-list-head">
            <h2>{L[1]}</h2>
            <label className="site-search">
              <i className="fas fa-search" aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'ابحث...' : 'Search...'} aria-label={ar ? 'بحث' : 'Search'} />
            </label>
          </div>

          {(!cur || (!cur.loaded && cur.loading)) && <Spinner label={t('loading')} />}

          {cur?.loaded && items.length === 0 && !cur.loading && (
            <div className="site-panel">
              <EmptyState
                icon={tabDef.icon}
                title={cur.err ? (ar ? 'تعذر تحميل المحتوى حالياً' : 'Could not load content right now') : (query ? (ar ? 'لا توجد نتائج مطابقة' : 'No matching results') : L[3])}
                text={cur.err || query ? '' : L[4]}
              />
              {cur.err && <div className="site-center-row"><button type="button" className="site-btn site-btn--outline" onClick={() => load(kind, 0, query)}>{ar ? 'إعادة المحاولة' : 'Try again'}</button></div>}
            </div>
          )}

          {items.length > 0 && (
            <div className={kind === 'report' ? 'site-report-grid' : 'site-card-grid'}>
              {items.map(kind === 'news' ? renderNews : kind === 'coverage' ? renderCoverage : renderReport)}
            </div>
          )}

          {items.length > 0 && items.length < (cur?.total || 0) && (
            <div className="site-center-row">
              <button type="button" className="site-btn site-btn--outline" disabled={cur.loading} onClick={() => load(kind, items.length, query)}>
                {cur.loading ? <span className="site-spinner sm" /> : <i className="fas fa-plus" aria-hidden="true" />} {L[2]}
              </button>
            </div>
          )}
          {items.length > PAGE && items.length >= (cur?.total || 0) && (
            <p className="site-muted-center">{ar ? 'تم عرض كل المحتوى' : 'All content displayed'}</p>
          )}
        </div>
      </section>

      <Modal open={!!video} onClose={() => setVideo(null)} title={video?.title || ''} wide dir={ar ? 'rtl' : 'ltr'}>
        {video && (
          <div className="site-video-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detailTitle} wide dir={ar ? 'rtl' : 'ltr'}>
        {detail && (
          <div className="site-detail">
            {detail.imageUrl && <div className="site-detail-img"><MediaImage src={detail.imageUrl} alt={detailTitle} icon="fa-newspaper" /></div>}
            <div className="site-media-stats">
              {detail.date && <span><i className="far fa-calendar" aria-hidden="true" /> {fmtDate(detail.date, lang)}</span>}
              {detail.category && <span><i className="fas fa-tag" aria-hidden="true" /> {detail.category}</span>}
            </div>
            {detailDesc && <p className="site-detail-text">{detailDesc}</p>}
            <div className="site-btn-row">
              {detail.videoUrl && (
                <button type="button" className="site-btn site-btn--primary site-btn--sm" onClick={() => { const it = detail; setDetail(null); openItem(it); }}>
                  <i className="fas fa-play" aria-hidden="true" /> {ar ? 'مشاهدة' : 'Watch'}
                </button>
              )}
              {safeUrl(detail.link) && (
                <a href={safeUrl(detail.link)} target="_blank" rel="noopener noreferrer" className="site-btn site-btn--outline site-btn--sm">
                  <i className="fas fa-external-link-alt" aria-hidden="true" /> {ar ? 'المصدر' : 'Source'}
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </SiteLayout>
  );
};

export default SiteMedia;
