import React, { useCallback, useEffect, useState } from 'react';
import api from '../../config/api';
import SiteLayout from './SiteLayout';
import { PageHero, EmptyState, Spinner, Modal, FileDrop, Reveal } from './SiteParts';
import { useSiteLang, assetUrl, fmtDate, EMAIL_RE, apiError } from './siteCore';
import './sitePages.css';

const EMPTY = { name: '', email: '', phone: '', title: '', story: '' };

const StoryImage = ({ src, name }) => {
  const [ok, setOk] = useState(true);
  if (src && ok) return <img src={assetUrl(src)} alt="" loading="lazy" onError={() => setOk(false)} />;
  return <div className="site-story-ph" aria-hidden="true">{(name || '؟').trim().charAt(0)}</div>;
};

const ShareStoryForm = ({ ar, onDone }) => {
  const [form, setForm] = useState(EMPTY);
  const [image, setImage] = useState([]);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ busy: false, ok: '', err: '' });
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(x => ({ ...x, [k]: '' })); setStatus(s => (s.err ? { ...s, err: '' } : s)); };

  const submit = async (e) => {
    e.preventDefault();
    const req = ar ? 'هذا الحقل مطلوب' : 'This field is required';
    const er = {};
    if (!form.name.trim()) er.name = req;
    if (!form.email.trim()) er.email = req;
    else if (!EMAIL_RE.test(form.email.trim())) er.email = ar ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email';
    if (form.phone.trim() && !/^[+\d][\d\s-]{6,}$/.test(form.phone.trim())) er.phone = ar ? 'رقم الجوال غير صحيح' : 'Invalid phone number';
    if (!form.title.trim()) er.title = req;
    if (form.story.trim().length < 30) er.story = ar ? 'اكتب قصتك (30 حرفاً على الأقل)' : 'Write your story (at least 30 characters)';
    setErrors(er);
    if (Object.keys(er).length) return;
    setStatus({ busy: true, ok: '', err: '' });
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        title: form.title.trim(),
        story: form.story.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(image[0] ? { image: { fileName: image[0].fileName, fileType: image[0].fileType, fileData: image[0].fileData } } : {})
      };
      const { data } = await api.post('/site/stories', payload);
      setStatus({ busy: false, ok: (ar ? data?.messageAr : data?.message) || (ar ? 'شكراً لمشاركة قصتك! سنراجعها وننشرها قريباً.' : 'Thank you for sharing your story! We will review and publish it soon.'), err: '' });
      setForm(EMPTY);
      setImage([]);
      if (onDone) onDone();
    } catch (err) {
      setStatus({ busy: false, ok: '', err: apiError(err, ar, 'حدث خطأ أثناء الإرسال، حاول مرة أخرى', 'Something went wrong, please try again') });
    }
  };

  if (status.ok) {
    return (
      <div className="site-success">
        <i className="fas fa-check-circle" aria-hidden="true" />
        <p>{status.ok}</p>
      </div>
    );
  }

  return (
    <form className="site-form" onSubmit={submit} noValidate>
      <div className="site-form-grid">
        <label className={`site-field ${errors.name ? 'has-error' : ''}`}>
          <span className="site-label">{ar ? 'الاسم الكامل' : 'Full name'} *</span>
          <input value={form.name} onChange={set('name')} maxLength={120} autoComplete="name" />
          {errors.name && <span className="site-field-err">{errors.name}</span>}
        </label>
        <label className={`site-field ${errors.email ? 'has-error' : ''}`}>
          <span className="site-label">{ar ? 'البريد الإلكتروني' : 'Email'} *</span>
          <input type="email" dir="ltr" value={form.email} onChange={set('email')} maxLength={160} autoComplete="email" />
          {errors.email && <span className="site-field-err">{errors.email}</span>}
        </label>
        <label className={`site-field ${errors.phone ? 'has-error' : ''}`}>
          <span className="site-label">{ar ? 'رقم الجوال (اختياري)' : 'Phone (optional)'}</span>
          <input type="tel" dir="ltr" value={form.phone} onChange={set('phone')} maxLength={20} autoComplete="tel" placeholder="05xxxxxxxx" />
          {errors.phone && <span className="site-field-err">{errors.phone}</span>}
        </label>
        <label className={`site-field ${errors.title ? 'has-error' : ''}`}>
          <span className="site-label">{ar ? 'عنوان قصتك' : 'Story title'} *</span>
          <input value={form.title} onChange={set('title')} maxLength={200} />
          {errors.title && <span className="site-field-err">{errors.title}</span>}
        </label>
        <label className={`site-field full ${errors.story ? 'has-error' : ''}`}>
          <span className="site-label">{ar ? 'قصتك' : 'Your story'} *</span>
          <textarea rows={6} value={form.story} onChange={set('story')} maxLength={5000} placeholder={ar ? 'شاركنا قصتك الملهمة...' : 'Share your inspiring story...'} />
          {errors.story && <span className="site-field-err">{errors.story}</span>}
        </label>
        <div className="full">
          <FileDrop
            label={ar ? 'صورة القصة (اختياري)' : 'Story image (optional)'}
            hint={ar ? 'JPG أو PNG أو WEBP — حتى 5 ميجابايت' : 'JPG, PNG or WEBP — up to 5 MB'}
            accept=".jpg,.jpeg,.png,.webp"
            types={['jpg', 'jpeg', 'png', 'webp']}
            maxBytes={5 * 1024 * 1024}
            max={1}
            files={image}
            onChange={setImage}
            isRTL={ar}
          />
        </div>
      </div>
      {status.err && <div className="site-form-msg err">{status.err}</div>}
      <button type="submit" className="site-btn site-btn--primary site-btn--block" disabled={status.busy}>
        {status.busy ? <><span className="site-spinner sm" /> {ar ? 'جاري الإرسال...' : 'Sending...'}</> : <><i className="fas fa-paper-plane" aria-hidden="true" /> {ar ? 'إرسال القصة' : 'Submit Story'}</>}
      </button>
    </form>
  );
};

const SiteStories = () => {
  const { lang, t, pick } = useSiteLang();
  const ar = lang === 'ar';
  const [stories, setStories] = useState(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(null);
  const [share, setShare] = useState(false);

  const load = useCallback(() => {
    setErr(false);
    api.get('/site/stories')
      .then(({ data }) => setStories(Array.isArray(data?.items) ? data.items : []))
      .catch(() => { setStories([]); setErr(true); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const closeShare = useCallback(() => setShare(false), []);
  const closeStory = useCallback(() => setOpen(null), []);

  return (
    <SiteLayout className="site-stories">
      <PageHero
        title={ar ? 'قصص النجاح' : 'Success Stories'}
        intro={ar ? 'اكتشف قصصًا ملهمة لمبتكرين ومبدعين من مجتمع فاب لاب الأحساء' : 'Discover inspiring stories of innovators and creators from the FabLab Al-Ahsa community'}
      >
        <button type="button" className="site-btn site-btn--primary site-page-cta" onClick={() => setShare(true)}>
          <i className="fas fa-pen" aria-hidden="true" /> {ar ? 'شارك قصتك' : 'Share Your Story'}
        </button>
      </PageHero>

      <section className="site-section">
        <div className="site-container">
          {stories === null ? <Spinner label={ar ? 'جاري تحميل قصص النجاح...' : 'Loading success stories...'} /> : stories.length === 0 ? (
            <div className="site-panel">
              <EmptyState
                icon="fa-trophy"
                title={err ? (ar ? 'تعذر تحميل القصص حالياً' : 'Could not load stories right now') : (ar ? 'لا توجد قصص منشورة بعد' : 'No stories published yet')}
                text={err ? '' : (ar ? 'كن أول من يشارك قصة نجاحه مع فاب لاب الأحساء!' : 'Be the first to share your success story with FabLab Al-Ahsa!')}
              />
              {err && <div className="site-center-row"><button type="button" className="site-btn site-btn--outline" onClick={load}>{ar ? 'إعادة المحاولة' : 'Try again'}</button></div>}
            </div>
          ) : (
            <div className="site-card-grid">
              {stories.map((s, i) => {
                const title = pick(s.title, s.titleEn);
                const text = pick(s.story, s.storyEn);
                return (
                  <Reveal as="article" key={s.id} className="site-story-card" delay={(i % 3) * 80}>
                    <div className="site-story-img"><StoryImage src={s.imageUrl} name={s.name} /></div>
                    <div className="site-story-body">
                      <h3>{title}</h3>
                      <div className="site-story-meta">
                        {s.name && <span><i className="fas fa-user" aria-hidden="true" /> {s.name}</span>}
                        {s.date && <span><i className="far fa-calendar" aria-hidden="true" /> {fmtDate(s.date, lang)}</span>}
                      </div>
                      <p>{text}</p>
                      <button type="button" className="site-link-btn" onClick={() => setOpen(s)}>
                        {t('readMore')} <i className={`fas ${ar ? 'fa-arrow-left' : 'fa-arrow-right'}`} aria-hidden="true" />
                      </button>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          )}

          <Reveal className="site-cta-band">
            <div>
              <h3>{ar ? 'شاركنا قصتك' : 'Share Your Story'}</h3>
              <p>{ar
                ? 'هل لديك قصة نجاح ملهمة مع فاب لاب الأحساء؟ نحن نرغب في مشاركتها مع مجتمعنا الملهم ودعم رحلتك نحو النجاح'
                : 'Do you have an inspiring success story with FabLab Al-Ahsa? We would love to share it with our community and support your journey to success'}</p>
            </div>
            <button type="button" className="site-btn site-btn--primary" onClick={() => setShare(true)}>
              <i className="fas fa-pen" aria-hidden="true" /> {ar ? 'شارك قصتك' : 'Share Your Story'}
            </button>
          </Reveal>
        </div>
      </section>

      <Modal open={share} onClose={closeShare} title={ar ? 'شارك قصة نجاحك' : 'Share Your Success Story'} dir={ar ? 'rtl' : 'ltr'}>
        <p className="site-modal-intro">{ar ? 'ستتم مراجعة قصتك من فريق فاب لاب قبل نشرها.' : 'Your story will be reviewed by the FabLab team before it is published.'}</p>
        <ShareStoryForm ar={ar} />
      </Modal>

      <Modal open={!!open} onClose={closeStory} title={open ? pick(open.title, open.titleEn) : ''} wide dir={ar ? 'rtl' : 'ltr'}>
        {open && (
          <div className="site-detail">
            {open.imageUrl && <div className="site-detail-img"><StoryImage src={open.imageUrl} name={open.name} /></div>}
            <div className="site-media-stats">
              {open.name && <span><i className="fas fa-user" aria-hidden="true" /> {open.name}</span>}
              {open.date && <span><i className="far fa-calendar" aria-hidden="true" /> {fmtDate(open.date, lang)}</span>}
            </div>
            <p className="site-detail-text">{pick(open.story, open.storyEn)}</p>
          </div>
        )}
      </Modal>
    </SiteLayout>
  );
};

export default SiteStories;
