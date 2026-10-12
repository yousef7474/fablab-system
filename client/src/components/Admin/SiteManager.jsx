import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { errMsg, readFile, absUrl } from './SiteShared';
import { SiteMediaSection, SiteArchiveSection, SiteStoriesSection } from './SiteContentSections';
import { SiteTalentSection, SiteInternshipSection, SiteMessagesSection } from './SiteApplicationsSections';
import './SiteManager.css';

// Admin tab "🌐 الموقع الإلكتروني": everything the public website
// (fablabsahsa.com) shows that isn't driven by the operational tabs —
// media center, workshops archive, success stories, talent + internship
// applications, contact messages and the editable site content.
const SECTIONS = [
  { id: 'overview', icon: '📊', ar: 'نظرة عامة', en: 'Overview' },
  { id: 'media', icon: '📰', ar: 'المركز الإعلامي', en: 'Media center' },
  { id: 'archive', icon: '🗂️', ar: 'أرشيف الورش', en: 'Workshops archive' },
  { id: 'stories', icon: '🌟', ar: 'قصص النجاح', en: 'Success stories', badge: 'storiesPending' },
  { id: 'talent', icon: '🎨', ar: 'طلبات المواهب', en: 'Talent applications', badge: 'talentNew' },
  { id: 'internship', icon: '🎓', ar: 'التدريب التعاوني', en: 'Internship', badge: 'internshipNew' },
  { id: 'messages', icon: '✉️', ar: 'رسائل التواصل', en: 'Messages', badge: 'messagesUnread' },
  { id: 'content', icon: '⚙️', ar: 'محتوى الموقع', en: 'Site content' }
];
const SECTION_KEY = 'siteManagerSection';

// ───────────── Overview + import ─────────────
const STAGES = {
  starting: { ar: 'جاري البدء…', en: 'Starting…' },
  'downloading-media': { ar: 'جاري تنزيل الأخبار والتغطيات', en: 'Downloading news & coverage' },
  media: { ar: 'استيراد الأخبار والتغطيات', en: 'Importing news & coverage' },
  'downloading-workshops': { ar: 'جاري تنزيل الورش', en: 'Downloading workshops' },
  workshops: { ar: 'استيراد الورش', en: 'Importing workshops' },
  stories: { ar: 'قصص النجاح', en: 'Success stories' }
};

const Overview = ({ isRTL, summary, onGo, onImported }) => {
  // Import runs on the server in the background: POST starts it (202),
  // GET reports { running, progress, result, error }; polled every 3s.
  const [job, setJob] = useState(null);
  const [starting, setStarting] = useState(false);
  const poll = useRef(null);
  const wasRunning = useRef(false);

  const fetchJob = useCallback(async () => {
    try {
      const { data } = await api.get('/site-admin/import');
      setJob(data || null);
      if (data?.running) wasRunning.current = true;
      else if (wasRunning.current) {
        wasRunning.current = false;
        if (data?.error) toast.error((isRTL ? data.error.messageAr : data.error.message) || data.error.messageAr || (isRTL ? 'تعذّر الاستيراد' : 'Import failed'));
        else if (data?.result) { toast.success(isRTL ? 'اكتمل الاستيراد' : 'Import finished'); onImported && onImported(); }
      }
      return data;
    } catch {
      return null;
    }
  }, [isRTL, onImported]);

  // Poll while a job is running (also picks up one started elsewhere).
  useEffect(() => {
    clearInterval(poll.current);
    if (job?.running) poll.current = setInterval(fetchJob, 3000);
    return () => clearInterval(poll.current);
  }, [job?.running, fetchJob]);
  useEffect(() => { fetchJob(); }, [fetchJob]);

  const runImport = async () => {
    if (!window.confirm(isRTL
      ? 'استيراد الأخبار والتغطيات والتقارير وأرشيف الورش وقصص النجاح من الموقع القديم (main.fablabsahsa.com)؟\n\nالعناصر المستوردة سابقاً تُحدَّث ولا تتكرر. تستغرق العملية بضع دقائق وتعمل في الخلفية.'
      : 'Import news, coverage, reports, the workshops archive and success stories from the old site (main.fablabsahsa.com)?\n\nPreviously imported items are updated, not duplicated. It takes a few minutes and runs in the background.')) return;
    setStarting(true);
    try {
      const { data } = await api.post('/site-admin/import', { source: 'https://main.fablabsahsa.com' });
      wasRunning.current = true;
      setJob(data && typeof data === 'object' && 'running' in data ? data : { running: true, progress: { stage: 'starting' } });
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.info(errMsg(err, isRTL, 'الاستيراد يعمل بالفعل', 'An import is already running'));
        wasRunning.current = true;
        fetchJob();
      } else {
        toast.error(errMsg(err, isRTL, 'تعذّر بدء الاستيراد', 'Could not start the import'));
      }
    } finally {
      setStarting(false);
    }
  };

  const cards = [
    { key: 'talentNew', section: 'talent', icon: '🎨', ar: 'طلبات مواهب جديدة', en: 'New talent applications', hot: true },
    { key: 'internshipNew', section: 'internship', icon: '🎓', ar: 'طلبات تدريب جديدة', en: 'New internship applications', hot: true },
    { key: 'messagesUnread', section: 'messages', icon: '✉️', ar: 'رسائل غير مقروءة', en: 'Unread messages', hot: true },
    { key: 'storiesPending', section: 'stories', icon: '🌟', ar: 'قصص بانتظار المراجعة', en: 'Stories awaiting review', hot: true },
    { key: 'mediaCount', section: 'media', icon: '📰', ar: 'مواد المركز الإعلامي', en: 'Media center items' },
    { key: 'archiveCount', section: 'archive', icon: '🗂️', ar: 'ورش في الأرشيف', en: 'Archived workshops' }
  ];
  const running = !!job?.running;
  const stage = job?.progress?.stage;
  const done = Number(job?.progress?.done) || 0;
  const total = Number(job?.progress?.total) || 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
  const resRow = (label, r) => r && (
    <div className="sm-import-row">
      <span>{label}</span>
      <b>
        {isRTL ? `${r.created || 0} جديد · ${r.updated || 0} محدّث` : `${r.created || 0} new · ${r.updated || 0} updated`}
        {r.failed ? <em className="sm-import-failed">{isRTL ? ` · ${r.failed} تعذّر` : ` · ${r.failed} failed`}</em> : null}
      </b>
    </div>
  );
  const when = (d) => (d ? new Date(d).toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

  return (
    <div className="sm-section">
      <div className="sm-kpis">
        {cards.map(c => (
          <button key={c.key} type="button" className={`sm-kpi ${c.hot && summary && summary[c.key] > 0 ? 'hot' : ''}`} onClick={() => onGo(c.section)}>
            <span className="sm-kpi-icon" aria-hidden="true">{c.icon}</span>
            <span className="sm-kpi-num">{summary ? (summary[c.key] ?? 0) : '…'}</span>
            <span className="sm-kpi-label">{isRTL ? c.ar : c.en}</span>
          </button>
        ))}
      </div>

      <div className="sm-panel">
        <div className="sm-panel-head">
          <div>
            <h4>⬇️ {isRTL ? 'استيراد المحتوى من الموقع القديم' : 'Import content from the old site'}</h4>
            <p>{isRTL
              ? 'ينقل الأخبار والتغطيات الإعلامية والتقارير وأرشيف الورش وقصص النجاح من main.fablabsahsa.com إلى هذا الموقع. يعمل في الخلفية — يمكنك مغادرة الصفحة والعودة. نفّذه قبل إيقاف الموقع القديم، ويمكن تكراره بأمان.'
              : 'Copies news, media coverage, reports, the workshops archive and success stories from main.fablabsahsa.com into this site. It runs in the background — you can leave and come back. Run it before the old site is switched off; safe to repeat.'}</p>
          </div>
          <button type="button" className="sm-btn primary" onClick={runImport} disabled={running || starting}>
            {running || starting
              ? <><span className="sm-spin" aria-hidden="true" /> {isRTL ? 'جارٍ الاستيراد…' : 'Importing…'}</>
              : (isRTL ? 'استيراد الآن' : 'Import now')}
          </button>
        </div>

        {running && (
          <div className="sm-import-live">
            <div className="sm-import-stage">
              <b>{stage && STAGES[stage] ? (isRTL ? STAGES[stage].ar : STAGES[stage].en) : (isRTL ? 'جاري الاستيراد…' : 'Importing…')}</b>
              {total > 0 && <span dir="ltr">{done} / {total}</span>}
            </div>
            <div className={`sm-progress ${pct === null ? 'indet' : ''}`}>
              <div style={pct === null ? undefined : { width: `${pct}%` }} />
            </div>
            {job?.startedAt && <div className="sm-muted">{isRTL ? `بدأ ${when(job.startedAt)}` : `Started ${when(job.startedAt)}`}</div>}
          </div>
        )}

        {!running && job?.error && (
          <div className="sm-import-result err">{(isRTL ? job.error.messageAr : job.error.message) || job.error.messageAr || job.error.message}</div>
        )}
        {!running && !job?.error && job?.result && (
          <div className="sm-import-result ok">
            <div className="sm-review-title">✓ {isRTL ? 'آخر استيراد' : 'Last import'}{job.finishedAt ? ` · ${when(job.finishedAt)}` : ''}</div>
            {resRow(isRTL ? 'المركز الإعلامي' : 'Media center', job.result.media)}
            {resRow(isRTL ? 'أرشيف الورش' : 'Workshops archive', job.result.workshops)}
            {resRow(isRTL ? 'قصص النجاح' : 'Success stories', job.result.stories)}
          </div>
        )}
      </div>

      <div className="sm-panel sm-links">
        <a className="sm-btn ghost" href="/" target="_blank" rel="noopener noreferrer">🌐 {isRTL ? 'فتح الموقع' : 'Open the website'}</a>
        <button type="button" className="sm-btn ghost" onClick={() => onGo('media')}>📰 {isRTL ? 'إضافة خبر' : 'Add news'}</button>
        <button type="button" className="sm-btn ghost" onClick={() => onGo('content')}>⚙️ {isRTL ? 'تعديل أرقام الإنجازات والشركاء' : 'Edit stats & partners'}</button>
      </div>
    </div>
  );
};

// ───────────── محتوى الموقع ─────────────
const EMPTY_CONTENT = {
  stats: { beneficiaries: '', projects: '', workshops: '' },
  partners: [],
  internshipUniversities: [],
  contact: { email: '', phone: '', whatsapp: '', addressAr: '', addressEn: '', mapEmbedUrl: '' },
  social: { x: '', instagram: '', youtube: '', snapchat: '' },
  workingHoursAr: '',
  workingHoursEn: ''
};

const LogoList = ({ isRTL, items, onChange, titleAr, titleEn, addAr, addEn }) => {
  const fileRefs = useRef({});
  const update = (i, patch) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="sm-panel">
      <div className="sm-panel-head">
        <h4>{isRTL ? titleAr : titleEn} <span className="sm-count">{items.length}</span></h4>
        <button type="button" className="sm-btn" onClick={() => onChange([...items, { id: `new_${Date.now().toString(36)}`, name: '', nameEn: '', logoUrl: '' }])}>＋ {isRTL ? addAr : addEn}</button>
      </div>
      {items.length === 0 ? <div className="sm-muted">{isRTL ? 'لا توجد عناصر' : 'Nothing here yet'}</div> : (
        <div className="sm-logo-list">
          {items.map((p, i) => (
            <div key={p.id || i} className="sm-logo-row">
              <button type="button" className="sm-logo-box" onClick={() => fileRefs.current[i]?.click()} title={isRTL ? 'تغيير الشعار' : 'Change logo'}>
                {p.preview || p.logoUrl ? <img src={p.preview || absUrl(p.logoUrl)} alt="" /> : <span>⬆</span>}
              </button>
              <input ref={el => { fileRefs.current[i] = el; }} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={async e => {
                  const f = e.target.files && e.target.files[0];
                  e.target.value = '';
                  if (!f) return;
                  if (f.size > 2 * 1024 * 1024) { toast.error(isRTL ? 'الشعار أكبر من 2 ميجابايت' : 'Logo is larger than 2 MB'); return; }
                  const r = await readFile(f);
                  update(i, { logo: r.payload, preview: r.preview });
                }} />
              <input className="sm-input sm-logo-name" value={p.name || ''} onChange={e => update(i, { name: e.target.value })} placeholder={isRTL ? 'الاسم بالعربية' : 'Arabic name'} dir="rtl" />
              <input className="sm-input sm-logo-name-en" value={p.nameEn || ''} onChange={e => update(i, { nameEn: e.target.value })} placeholder={isRTL ? 'الاسم بالإنجليزية' : 'English name'} dir="ltr" />
              <div className="sm-row-tools">
                <button type="button" className="sm-icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title={isRTL ? 'لأعلى' : 'Up'}>↑</button>
                <button type="button" className="sm-icon-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} title={isRTL ? 'لأسفل' : 'Down'}>↓</button>
                <button type="button" className="sm-icon-btn danger" onClick={() => { if (window.confirm(isRTL ? 'حذف هذا العنصر؟' : 'Remove this item?')) onChange(items.filter((_, k) => k !== i)); }} title={isRTL ? 'حذف' : 'Delete'}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ContentSettings = ({ isRTL }) => {
  const [content, setContent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/site-admin/content');
      setContent({
        ...EMPTY_CONTENT, ...data,
        stats: { ...EMPTY_CONTENT.stats, ...(data.stats || {}) },
        contact: { ...EMPTY_CONTENT.contact, ...(data.contact || {}) },
        social: { ...EMPTY_CONTENT.social, ...(data.social || {}) },
        partners: data.partners || [],
        internshipUniversities: data.internshipUniversities || []
      });
      setDirty(false);
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر تحميل المحتوى', 'Could not load content'));
      setContent({ ...EMPTY_CONTENT });
    }
  }, [isRTL]);
  useEffect(() => { load(); }, [load]);

  const set = (patch) => { setContent(c => ({ ...c, ...patch })); setDirty(true); };
  const setIn = (group, key, v) => { setContent(c => ({ ...c, [group]: { ...c[group], [key]: v } })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const clean = (list) => list.map(({ preview, ...p }) => p).filter(p => (p.name || p.nameEn || '').trim() || p.logo || p.logoUrl);
      const body = {
        ...content,
        stats: Object.fromEntries(Object.entries(content.stats).map(([k, v]) => [k, v === '' ? 0 : Number(v)])),
        partners: clean(content.partners),
        internshipUniversities: clean(content.internshipUniversities)
      };
      await api.put('/site-admin/content', body);
      toast.success(isRTL ? 'تم حفظ محتوى الموقع' : 'Site content saved');
      load();
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر الحفظ', 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  if (!content) return <div className="sm-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>;

  const input = (group, key, labelAr, labelEn, props = {}) => (
    <div className={`sm-field ${props.full ? 'full' : ''}`}>
      <label>{isRTL ? labelAr : labelEn}</label>
      <input value={(group ? content[group][key] : content[key]) ?? ''} dir={props.dir} type={props.type || 'text'} min={props.min}
        onChange={e => (group ? setIn(group, key, e.target.value) : set({ [key]: e.target.value }))} placeholder={props.placeholder} />
    </div>
  );

  return (
    <div className="sm-section">
      <div className="sm-panel">
        <div className="sm-panel-head"><h4>📈 {isRTL ? 'إنجازاتنا بالأرقام (الصفحة الرئيسية)' : 'Achievements in numbers (home page)'}</h4></div>
        <div className="sm-form-grid three">
          {input('stats', 'beneficiaries', 'المستفيدين', 'Beneficiaries', { type: 'number', min: 0, dir: 'ltr' })}
          {input('stats', 'projects', 'المشاريع المنجزة', 'Projects completed', { type: 'number', min: 0, dir: 'ltr' })}
          {input('stats', 'workshops', 'ورش العمل', 'Workshops', { type: 'number', min: 0, dir: 'ltr' })}
        </div>
      </div>

      <LogoList isRTL={isRTL} items={content.partners} onChange={partners => set({ partners })}
        titleAr="🤝 شركاؤنا" titleEn="🤝 Partners" addAr="إضافة شريك" addEn="Add partner" />
      <LogoList isRTL={isRTL} items={content.internshipUniversities} onChange={internshipUniversities => set({ internshipUniversities })}
        titleAr="🏛️ الجامعات الشريكة (التدريب التعاوني)" titleEn="🏛️ Partner universities (internship)" addAr="إضافة جامعة" addEn="Add university" />

      <div className="sm-panel">
        <div className="sm-panel-head"><h4>📞 {isRTL ? 'معلومات التواصل' : 'Contact information'}</h4></div>
        <div className="sm-form-grid">
          {input('contact', 'email', 'البريد الإلكتروني', 'Email', { dir: 'ltr', type: 'email' })}
          {input('contact', 'phone', 'الهاتف', 'Phone', { dir: 'ltr' })}
          {input('contact', 'whatsapp', 'واتساب', 'WhatsApp', { dir: 'ltr', placeholder: '9665XXXXXXXX' })}
          {input('contact', 'addressAr', 'العنوان (عربي)', 'Address (Arabic)', { dir: 'rtl' })}
          {input('contact', 'addressEn', 'العنوان (إنجليزي)', 'Address (English)', { dir: 'ltr' })}
          {input('contact', 'mapEmbedUrl', 'رابط خريطة قوقل (Embed)', 'Google Maps embed URL', { dir: 'ltr', full: true })}
        </div>
        {content.contact.mapEmbedUrl && /^https:\/\/www\.google\.com\/maps\/embed/.test(content.contact.mapEmbedUrl) && (
          <iframe className="sm-map" title="map" src={content.contact.mapEmbedUrl} loading="lazy" />
        )}
      </div>

      <div className="sm-panel">
        <div className="sm-panel-head"><h4>🔗 {isRTL ? 'حسابات التواصل الاجتماعي' : 'Social accounts'}</h4></div>
        <div className="sm-form-grid">
          {input('social', 'x', 'منصة X', 'X (Twitter)', { dir: 'ltr' })}
          {input('social', 'instagram', 'إنستغرام', 'Instagram', { dir: 'ltr' })}
          {input('social', 'youtube', 'يوتيوب', 'YouTube', { dir: 'ltr' })}
          {input('social', 'snapchat', 'سناب شات', 'Snapchat', { dir: 'ltr' })}
        </div>
      </div>

      <div className="sm-panel">
        <div className="sm-panel-head"><h4>🕘 {isRTL ? 'أوقات العمل (تظهر في أسفل الموقع)' : 'Working hours (site footer)'}</h4></div>
        <div className="sm-form-grid">
          {input(null, 'workingHoursAr', 'بالعربية', 'Arabic', { dir: 'rtl', placeholder: 'الأحد - الخميس: 9:00 ص - 6:00 م' })}
          {input(null, 'workingHoursEn', 'بالإنجليزية', 'English', { dir: 'ltr', placeholder: 'Sun – Thu: 9:00 AM – 6:00 PM' })}
        </div>
      </div>

      <div className={`sm-savebar ${dirty ? 'dirty' : ''}`}>
        <span>{dirty ? (isRTL ? 'لديك تعديلات غير محفوظة' : 'You have unsaved changes') : (isRTL ? 'كل التعديلات محفوظة' : 'All changes saved')}</span>
        <button type="button" className="sm-btn ghost" onClick={load} disabled={saving || !dirty}>{isRTL ? 'تراجع' : 'Discard'}</button>
        <button type="button" className="sm-btn primary" onClick={save} disabled={saving || !dirty}>{saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ المحتوى' : 'Save content')}</button>
      </div>
    </div>
  );
};

// ───────────── Shell ─────────────
const SiteManager = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [section, setSection] = useState(() => {
    try { const s = localStorage.getItem(SECTION_KEY); return SECTIONS.some(x => x.id === s) ? s : 'overview'; } catch { return 'overview'; }
  });
  const [summary, setSummary] = useState(null);

  const loadSummary = useCallback(async () => {
    try { const { data } = await api.get('/site-admin/summary'); setSummary(data || {}); }
    catch { setSummary(s => s || {}); }
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const go = (id) => {
    setSection(id);
    try { localStorage.setItem(SECTION_KEY, id); } catch { /* ignore */ }
  };

  return (
    <motion.div className="sm" dir={isRTL ? 'rtl' : 'ltr'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="sm-header">
        <div>
          <span className="sm-kicker">{isRTL ? 'fablabsahsa.com · الموقع العام' : 'fablabsahsa.com · public site'}</span>
          <h2>{isRTL ? 'الموقع الإلكتروني' : 'Website'}</h2>
        </div>
        <a className="sm-btn ghost" href="/" target="_blank" rel="noopener noreferrer">↗ {isRTL ? 'عرض الموقع' : 'View site'}</a>
      </div>

      <nav className="sm-nav" aria-label={isRTL ? 'أقسام الموقع' : 'Website sections'}>
        {SECTIONS.map(s => {
          const n = s.badge && summary ? Number(summary[s.badge]) || 0 : 0;
          return (
            <button key={s.id} type="button" className={`sm-nav-btn ${section === s.id ? 'on' : ''}`} onClick={() => go(s.id)}>
              <span aria-hidden="true">{s.icon}</span>
              {isRTL ? s.ar : s.en}
              {n > 0 && <span className="sm-badge">{n}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sm-content">
        {section === 'overview' && <Overview isRTL={isRTL} summary={summary} onGo={go} onImported={loadSummary} />}
        {section === 'media' && <SiteMediaSection isRTL={isRTL} />}
        {section === 'archive' && <SiteArchiveSection isRTL={isRTL} />}
        {section === 'stories' && <SiteStoriesSection isRTL={isRTL} onChanged={loadSummary} />}
        {section === 'talent' && <SiteTalentSection isRTL={isRTL} onChanged={loadSummary} />}
        {section === 'internship' && <SiteInternshipSection isRTL={isRTL} onChanged={loadSummary} />}
        {section === 'messages' && <SiteMessagesSection isRTL={isRTL} onChanged={loadSummary} />}
        {section === 'content' && <ContentSettings isRTL={isRTL} />}
      </div>
    </motion.div>
  );
};

export default SiteManager;
