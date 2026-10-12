import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../config/api';
import SiteLayout from './SiteLayout';
import { PageHero, EmptyState, Spinner } from './SiteParts';
import SiteWorkshopCard from './SiteWorkshopCard';
import { useSiteLang } from './siteCore';
import './sitePages.css';

const PAGE = 12;

const SiteWorkshops = () => {
  const { lang, t } = useSiteLang();
  const ar = lang === 'ar';
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'archive' ? 'archive' : 'live';
  const setTab = (k) => setParams(k === 'archive' ? { tab: 'archive' } : {}, { replace: true });

  const [live, setLive] = useState(null);
  const [liveErr, setLiveErr] = useState(false);
  const [arch, setArch] = useState({ items: [], total: 0, loaded: false, loading: false, err: false });

  useEffect(() => {
    let alive = true;
    api.get('/workshops/active')
      .then(({ data }) => { if (alive) setLive(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) { setLive([]); setLiveErr(true); } });
    return () => { alive = false; };
  }, []);

  const loadArchive = useCallback(async (offset) => {
    setArch(a => ({ ...a, loading: true, err: false }));
    try {
      const { data } = await api.get('/site/workshops-archive', { params: { limit: PAGE, offset } });
      const items = (data?.items || []).map(x => ({ ...x, _archive: true }));
      setArch(a => ({ items: offset ? [...a.items, ...items] : items, total: Number(data?.total) || 0, loaded: true, loading: false, err: false }));
    } catch {
      setArch(a => ({ ...a, loaded: true, loading: false, err: true }));
    }
  }, []);

  useEffect(() => {
    if (tab === 'archive' && !arch.loaded && !arch.loading) loadArchive(0);
  }, [tab, arch.loaded, arch.loading, loadArchive]);

  return (
    <SiteLayout className="site-workshops">
      <PageHero
        title={ar ? 'الورش التدريبية' : 'Training Workshops'}
        intro={ar
          ? 'ورش عملية في التصنيع الرقمي والبرمجة والإلكترونيات وغيرها، يقدمها مدربون متخصصون داخل معامل فاب لاب الأحساء.'
          : 'Hands-on workshops in digital fabrication, programming, electronics and more, delivered by specialist trainers in the FabLab Al-Ahsa labs.'}
      >
        <div className="site-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'live'} className={`site-tab ${tab === 'live' ? 'on' : ''}`} onClick={() => setTab('live')}>
            <i className="fas fa-bolt" aria-hidden="true" /> {ar ? 'الورش المتاحة والقادمة' : 'Open & Upcoming'}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'archive'} className={`site-tab ${tab === 'archive' ? 'on' : ''}`} onClick={() => setTab('archive')}>
            <i className="fas fa-archive" aria-hidden="true" /> {ar ? 'أرشيف الورش' : 'Workshop Archive'}
          </button>
        </div>
      </PageHero>

      <section className="site-section">
        <div className="site-container">
          {tab === 'live' ? (
            live === null ? <Spinner label={t('loading')} /> : live.length === 0 ? (
              <div className="site-panel">
                <EmptyState
                  icon="fa-tools"
                  title={liveErr ? (ar ? 'تعذر تحميل الورش حالياً' : 'Could not load workshops right now') : (ar ? 'لا توجد ورش متاحة حالياً' : 'No workshops are open right now')}
                  text={ar ? 'سيتم الإعلان عن ورش جديدة قريباً — تصفّح أرشيف الورش السابقة.' : 'New workshops will be announced soon — browse our past workshops.'}
                />
                <div className="site-center-row">
                  <button type="button" className="site-btn site-btn--outline" onClick={() => setTab('archive')}>
                    <i className="fas fa-archive" aria-hidden="true" /> {ar ? 'أرشيف الورش' : 'Workshop Archive'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="site-card-grid">
                  {live.map(w => <SiteWorkshopCard key={w.workshopId} w={w} t={t} lang={lang} showDesc />)}
                </div>
                <div className="site-center-row">
                  <Link to="/workshop" className="site-btn site-btn--primary"><i className="fas fa-user-plus" aria-hidden="true" /> {ar ? 'التسجيل في الورش' : 'Register for a Workshop'}</Link>
                </div>
              </>
            )
          ) : (
            <>
              {!arch.loaded && arch.loading && <Spinner label={t('loading')} />}
              {arch.loaded && arch.items.length === 0 && (
                <div className="site-panel">
                  <EmptyState
                    icon="fa-archive"
                    title={arch.err ? (ar ? 'تعذر تحميل الأرشيف حالياً' : 'Could not load the archive right now') : (ar ? 'لا توجد ورش في الأرشيف بعد' : 'No archived workshops yet')}
                  />
                  {arch.err && <div className="site-center-row"><button type="button" className="site-btn site-btn--outline" onClick={() => loadArchive(0)}>{ar ? 'إعادة المحاولة' : 'Try again'}</button></div>}
                </div>
              )}
              {arch.items.length > 0 && (
                <div className="site-card-grid">
                  {arch.items.map(w => <SiteWorkshopCard key={w.id} w={w} t={t} lang={lang} showDesc />)}
                </div>
              )}
              {arch.items.length > 0 && arch.items.length < arch.total && (
                <div className="site-center-row">
                  <button type="button" className="site-btn site-btn--outline" disabled={arch.loading} onClick={() => loadArchive(arch.items.length)}>
                    {arch.loading ? <span className="site-spinner sm" /> : <i className="fas fa-plus" aria-hidden="true" />} {t('loadMore')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </SiteLayout>
  );
};

export default SiteWorkshops;
