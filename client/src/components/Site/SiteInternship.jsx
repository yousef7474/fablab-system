import React, { useCallback, useEffect, useState } from 'react';
import api from '../../config/api';
import SiteLayout from './SiteLayout';
import { PageHero, EmptyState, Spinner, Modal, FileDrop, Reveal, SectionHeader } from './SiteParts';
import { useSiteLang, useSiteContent, assetUrl, fmtDate, EMAIL_RE, apiError, scrollToId } from './siteCore';
import './sitePages.css';

const C = {
  ar: {
    heroTitle: 'برنامج التدريب التعاوني',
    heroSubtitle: 'اكتسب خبرة عملية حقيقية في بيئة إبداعية واحترافية',
    browse: 'استعرض البرامج',
    apply: 'تقديم طلب التدريب',
    aboutTitle: 'عن برنامج التدريب التعاوني',
    aboutText: 'يهدف برنامج التدريب التعاوني في فاب لاب الأحساء إلى ربط الجانب النظري الأكاديمي بالجانب العملي، حيث نوفر للطلاب بيئة تدريبية متكاملة تحت إشراف مدربين متخصصين في مختلف المجالات التقنية والإبداعية.',
    features: [
      ['fa-briefcase', 'خبرة عملية حقيقية', 'تطبيق المعرفة الأكاديمية في مشاريع واقعية'],
      ['fa-user-tie', 'إشراف متخصص', 'متابعة مباشرة من مدربين ذوي خبرة'],
      ['fa-network-wired', 'شبكة علاقات مهنية', 'التواصل مع محترفين في المجال'],
      ['fa-certificate', 'شهادة معتمدة', 'شهادة تدريب معتمدة من فاب لاب الأحساء']
    ],
    imgCaption: 'بيئة التدريب في فاب لاب',
    programsTitle: 'برامج التدريب المتاحة',
    programsSub: 'اختر البرنامج الذي يتوافق مع تخصصك واهتماماتك',
    loading: 'جاري تحميل فرص التدريب...',
    noneTitle: 'لا توجد فرص تدريب متاحة حالياً',
    noneText: 'تابع الصفحة للاطلاع على الفرص الجديدة',
    loadErr: 'تعذر تحميل فرص التدريب حالياً',
    duration: 'المدة', deadline: 'آخر موعد', seats: 'المقاعد', seatsUnit: 'مقعد',
    open: 'متاح للتقديم', closingSoon: 'ينتهي قريباً', closed: 'مغلق',
    details: 'التفاصيل', applyNow: 'قدّم الآن', closedBtn: 'التقديم مغلق',
    requirements: 'المتطلبات',
    processTitle: 'خطوات التقديم',
    steps: [
      ['التقديم الإلكتروني', 'املأ نموذج التقديم عبر المنصة الإلكترونية وأرفق المستندات المطلوبة'],
      ['مراجعة الطلب', 'سيتم مراجعة طلبك من قبل فريق القبول خلال 5-7 أيام عمل'],
      ['المقابلة الشخصية', 'سيتم التواصل معك لإجراء مقابلة شخصية أو عبر الإنترنت'],
      ['قبول الطلب', 'ستتلقى رسالة قبول رسمية مع تفاصيل بدء البرنامج']
    ],
    partnersTitle: 'الجامعات الشريكة',
    formTitle: 'طلب التدريب التعاوني',
    personal: 'المعلومات الشخصية', academic: 'المعلومات الأكاديمية', aboutYou: 'عن نفسك', attachments: 'المرفقات المطلوبة',
    fullName: 'الاسم الكامل', email: 'البريد الإلكتروني', phone: 'رقم الجوال', university: 'الجامعة', major: 'التخصص',
    gpa: 'المعدل التراكمي (من 5)', motivation: 'رسالة الدافع', motivationPh: 'أخبرنا لماذا تريد الانضمام لهذا البرنامج...',
    experience: 'الخبرات السابقة (اختياري)', experiencePh: 'اذكر أي خبرات سابقة أو مشاريع قمت بها...',
    cv: 'السيرة الذاتية (CV)', letter: 'خطاب من الجامعة', fileHint: 'PDF أو DOC أو DOCX — حتى 10 ميجابايت',
    submit: 'إرسال الطلب', sending: 'جاري الإرسال...',
    success: 'تم إرسال طلبك بنجاح! سنتواصل معك قريباً',
    required: 'هذا الحقل مطلوب', badEmail: 'يرجى إدخال بريد إلكتروني صحيح', badPhone: 'أدخل رقم جوال صحيح (05XXXXXXXX)',
    badGpa: 'المعدل يجب أن يكون بين 0 و 5', fileRequired: 'يرجى إرفاق الملف'
  },
  en: {
    heroTitle: 'Cooperative Training Program',
    heroSubtitle: 'Gain real hands-on experience in a creative and professional environment',
    browse: 'Browse Programs',
    apply: 'Apply for Training',
    aboutTitle: 'About the Cooperative Training Program',
    aboutText: 'The cooperative training program at FabLab Al-Ahsa aims to bridge the gap between academic theory and practical application, providing students with a comprehensive training environment under the supervision of specialized trainers in various technical and creative fields.',
    features: [
      ['fa-briefcase', 'Real Practical Experience', 'Apply academic knowledge to real-world projects'],
      ['fa-user-tie', 'Specialized Supervision', 'Direct follow-up from experienced trainers'],
      ['fa-network-wired', 'Professional Network', 'Connect with professionals in the field'],
      ['fa-certificate', 'Certified Certificate', 'Certified training certificate from FabLab Al-Ahsa']
    ],
    imgCaption: 'Training environment at FabLab',
    programsTitle: 'Available Training Programs',
    programsSub: 'Choose the program that matches your specialization and interests',
    loading: 'Loading training opportunities...',
    noneTitle: 'No training opportunities available at the moment',
    noneText: 'Follow the page for new opportunities',
    loadErr: 'Could not load training opportunities right now',
    duration: 'Duration', deadline: 'Deadline', seats: 'Seats', seatsUnit: 'seats',
    open: 'Open', closingSoon: 'Closing soon', closed: 'Closed',
    details: 'Details', applyNow: 'Apply Now', closedBtn: 'Applications closed',
    requirements: 'Requirements',
    processTitle: 'Application Steps',
    steps: [
      ['Online Application', 'Fill out the application form through the online platform and attach the required documents'],
      ['Application Review', 'Your application will be reviewed by the admissions team within 5-7 business days'],
      ['Personal Interview', 'You will be contacted to conduct an in-person or online interview'],
      ['Application Acceptance', 'You will receive an official acceptance letter with program start details']
    ],
    partnersTitle: 'Partner Universities',
    formTitle: 'Cooperative Training Application',
    personal: 'Personal Information', academic: 'Academic Information', aboutYou: 'About Yourself', attachments: 'Required Attachments',
    fullName: 'Full Name', email: 'Email', phone: 'Phone', university: 'University', major: 'Major',
    gpa: 'GPA (out of 5)', motivation: 'Motivation Letter', motivationPh: 'Tell us why you want to join this program...',
    experience: 'Previous Experience (optional)', experiencePh: 'Mention any previous experience or projects...',
    cv: 'Curriculum Vitae (CV)', letter: 'University Letter', fileHint: 'PDF, DOC or DOCX — up to 10 MB',
    submit: 'Submit Application', sending: 'Sending...',
    success: 'Your application was submitted successfully! We will contact you soon',
    required: 'This field is required', badEmail: 'Please enter a valid email', badPhone: 'Enter a valid mobile number (05XXXXXXXX)',
    badGpa: 'GPA must be between 0 and 5', fileRequired: 'Please attach the file'
  }
};

const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
const daysUntil = (d) => {
  if (!d) return null;
  const a = new Date(`${todayStr()}T00:00:00Z`).getTime();
  const b = new Date(`${String(d).slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isFinite(b) ? Math.round((b - a) / 86400000) : null;
};

const EMPTY = { fullName: '', email: '', phone: '', university: '', major: '', gpa: '', motivation: '', experience: '' };

const ApplyForm = ({ opp, c, ar, universities, pick }) => {
  const [f, setF] = useState(EMPTY);
  const [cv, setCv] = useState([]);
  const [letter, setLetter] = useState([]);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ busy: false, ok: '', err: '' });
  const set = (k) => (e) => { setF(x => ({ ...x, [k]: e.target.value })); setErrors(x => ({ ...x, [k]: '' })); setStatus(s => (s.err ? { ...s, err: '' } : s)); };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    ['fullName', 'email', 'phone', 'university', 'major', 'gpa', 'motivation'].forEach(k => { if (!String(f[k]).trim()) er[k] = c.required; });
    if (!er.email && !EMAIL_RE.test(f.email.trim())) er.email = c.badEmail;
    if (!er.phone && !/^(05\d{8}|\+?9665\d{8})$/.test(f.phone.replace(/[\s-]/g, ''))) er.phone = c.badPhone;
    const gpa = Number(f.gpa);
    if (!er.gpa && (!Number.isFinite(gpa) || gpa < 0 || gpa > 5)) er.gpa = c.badGpa;
    if (!cv.length) er.cv = c.fileRequired;
    if (!letter.length) er.letter = c.fileRequired;
    setErrors(er);
    if (Object.keys(er).length) {
      setStatus(s => ({ ...s, err: ar ? 'يرجى تصحيح الحقول المحددة' : 'Please fix the highlighted fields' }));
      return;
    }
    setStatus({ busy: true, ok: '', err: '' });
    const file = (x) => ({ fileName: x.fileName, fileType: x.fileType, fileData: x.fileData });
    try {
      const payload = {
        fullName: f.fullName.trim(), email: f.email.trim(), phone: f.phone.replace(/[\s-]/g, ''),
        university: f.university.trim(), major: f.major.trim(), gpa,
        motivation: f.motivation.trim(),
        ...(f.experience.trim() ? { experience: f.experience.trim() } : {}),
        cv: file(cv[0]), universityLetter: file(letter[0])
      };
      const { data } = await api.post(`/site/internships/${encodeURIComponent(opp.id)}/apply`, payload);
      setStatus({ busy: false, ok: (ar ? data?.messageAr : data?.message) || c.success, err: '' });
    } catch (err) {
      setStatus({ busy: false, ok: '', err: apiError(err, ar, 'حدث خطأ أثناء الإرسال، حاول مرة أخرى', 'Something went wrong, please try again') });
    }
  };

  if (status.ok) {
    return <div className="site-success"><i className="fas fa-check-circle" aria-hidden="true" /><p>{status.ok}</p></div>;
  }

  const field = (k, label, props = {}, full = false) => (
    <label className={`site-field ${full ? 'full' : ''} ${errors[k] ? 'has-error' : ''}`}>
      <span className="site-label">{label}{!/اختياري|optional/i.test(label) && ' *'}</span>
      {props.rows ? <textarea value={f[k]} onChange={set(k)} {...props} /> : <input value={f[k]} onChange={set(k)} {...props} />}
      {errors[k] && <span className="site-field-err">{errors[k]}</span>}
    </label>
  );

  return (
    <form className="site-form" onSubmit={submit} noValidate>
      <div className="site-apply-opp"><i className="fas fa-graduation-cap" aria-hidden="true" /> {pick(opp.title, opp.titleEn)}</div>
      <h4 className="site-form-title"><i className="fas fa-user" aria-hidden="true" /> {c.personal}</h4>
      <div className="site-form-grid">
        {field('fullName', c.fullName, { maxLength: 150, autoComplete: 'name' }, true)}
        {field('email', c.email, { type: 'email', dir: 'ltr', maxLength: 150, autoComplete: 'email' })}
        {field('phone', c.phone, { type: 'tel', dir: 'ltr', maxLength: 15, placeholder: '05XXXXXXXX', autoComplete: 'tel' })}
      </div>
      <h4 className="site-form-title"><i className="fas fa-university" aria-hidden="true" /> {c.academic}</h4>
      <div className="site-form-grid">
        {field('university', c.university, { maxLength: 200, list: 'site-universities' })}
        <datalist id="site-universities">
          {universities.map(u => <option key={u.id || u.name} value={pick(u.name, u.nameEn)} />)}
        </datalist>
        {field('major', c.major, { maxLength: 200 })}
        {field('gpa', c.gpa, { type: 'number', inputMode: 'decimal', step: '0.01', min: '0', max: '5', placeholder: '4.50', dir: 'ltr' })}
      </div>
      <h4 className="site-form-title"><i className="fas fa-comment-dots" aria-hidden="true" /> {c.aboutYou}</h4>
      <div className="site-form-grid">
        {field('motivation', c.motivation, { rows: 4, maxLength: 5000, placeholder: c.motivationPh }, true)}
        {field('experience', c.experience, { rows: 3, maxLength: 5000, placeholder: c.experiencePh }, true)}
      </div>
      <h4 className="site-form-title"><i className="fas fa-paperclip" aria-hidden="true" /> {c.attachments}</h4>
      <div className="site-form-grid">
        <FileDrop label={`${c.cv} *`} hint={c.fileHint} accept=".pdf,.doc,.docx" types={['pdf', 'doc', 'docx']} maxBytes={10 * 1024 * 1024} max={1}
          files={cv} onChange={(v) => { setCv(v); setErrors(x => ({ ...x, cv: '' })); }} isRTL={ar} error={errors.cv} />
        <FileDrop label={`${c.letter} *`} hint={c.fileHint} accept=".pdf,.doc,.docx" types={['pdf', 'doc', 'docx']} maxBytes={10 * 1024 * 1024} max={1}
          files={letter} onChange={(v) => { setLetter(v); setErrors(x => ({ ...x, letter: '' })); }} isRTL={ar} error={errors.letter} />
      </div>
      {status.err && <div className="site-form-msg err">{status.err}</div>}
      <button type="submit" className="site-btn site-btn--primary site-btn--block" disabled={status.busy}>
        {status.busy ? <><span className="site-spinner sm" /> {c.sending}</> : <><i className="fas fa-paper-plane" aria-hidden="true" /> {c.submit}</>}
      </button>
    </form>
  );
};

const lines = (txt) => String(txt || '').split(/\r?\n/).map(s => s.replace(/^[\s•\-*–]+/, '').trim()).filter(Boolean);

const SiteInternship = () => {
  const { lang, pick } = useSiteLang();
  const ar = lang === 'ar';
  const c = C[lang];
  const content = useSiteContent();
  const [opps, setOpps] = useState(null);
  const [err, setErr] = useState(false);
  const [details, setDetails] = useState(null);
  const [applyTo, setApplyTo] = useState(null);

  const load = useCallback(() => {
    setErr(false);
    api.get('/site/internships')
      .then(({ data }) => setOpps(Array.isArray(data?.items) ? data.items : []))
      .catch(() => { setOpps([]); setErr(true); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const openOnes = (opps || []).filter(o => o.isOpen);
  const onApplyHero = () => {
    if (openOnes.length === 1) setApplyTo(openOnes[0]);
    else scrollToId('programs');
  };
  const closeDetails = useCallback(() => setDetails(null), []);
  const closeApply = useCallback(() => setApplyTo(null), []);

  const status = (o) => {
    if (!o.isOpen) return ['closed', c.closed];
    const d = daysUntil(o.deadline);
    if (d !== null && d <= 3) return ['soon', c.closingSoon];
    return ['open', c.open];
  };

  return (
    <SiteLayout className="site-internship">
      <PageHero title={c.heroTitle} intro={c.heroSubtitle}>
        <div className="site-btn-row center">
          <button type="button" className="site-btn site-btn--outline" onClick={() => scrollToId('programs')}>
            <i className="fas fa-list" aria-hidden="true" /> {c.browse}
          </button>
          <button type="button" className="site-btn site-btn--primary" onClick={onApplyHero}>
            <i className="fas fa-paper-plane" aria-hidden="true" /> {c.apply}
          </button>
        </div>
      </PageHero>

      <section className="site-section">
        <div className="site-container">
          <Reveal className="site-panel site-split">
            <div>
              <h2 className="site-h2">{c.aboutTitle}</h2>
              <p className="site-lead">{c.aboutText}</p>
              <div className="site-mini-features">
                {c.features.map(([icon, title, text]) => (
                  <div key={icon} className="site-mini-feature">
                    <span><i className={`fas ${icon}`} aria-hidden="true" /></span>
                    <div><b>{title}</b><small>{text}</small></div>
                  </div>
                ))}
              </div>
            </div>
            <figure className="site-split-img">
              <img src="/site/sections/a8.jpeg" alt={c.imgCaption} width="640" height="420" loading="lazy" />
              <figcaption>{c.imgCaption}</figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="site-section" id="programs">
        <div className="site-container">
          <SectionHeader title={c.programsTitle} subtitle={c.programsSub} />
          {opps === null ? <Spinner label={c.loading} /> : opps.length === 0 ? (
            <div className="site-panel">
              <EmptyState icon="fa-briefcase" title={err ? c.loadErr : c.noneTitle} text={err ? '' : c.noneText} />
              {err && <div className="site-center-row"><button type="button" className="site-btn site-btn--outline" onClick={load}>{ar ? 'إعادة المحاولة' : 'Try again'}</button></div>}
            </div>
          ) : (
            <div className="site-card-grid">
              {opps.map((o, i) => {
                const [st, stLabel] = status(o);
                const dept = pick(o.department, o.departmentEn);
                const dur = pick(o.duration, o.durationEn);
                return (
                  <Reveal as="article" key={o.id} className="site-opp-card" delay={(i % 3) * 80}>
                    <div className="site-opp-top">
                      {dept && <span className="site-opp-dept"><i className="fas fa-laptop-code" aria-hidden="true" /> {dept}</span>}
                      <span className={`site-opp-status ${st}`}>{stLabel}</span>
                    </div>
                    <h3>{pick(o.title, o.titleEn)}</h3>
                    <p>{pick(o.description, o.descriptionEn)}</p>
                    <ul className="site-opp-details">
                      {dur && <li><i className="fas fa-clock" aria-hidden="true" /> <b>{c.duration}:</b> {dur}</li>}
                      {o.deadline && <li><i className="fas fa-calendar-alt" aria-hidden="true" /> <b>{c.deadline}:</b> {fmtDate(o.deadline, lang)}</li>}
                      {o.seats ? <li><i className="fas fa-users" aria-hidden="true" /> <b>{c.seats}:</b> {o.seats} {c.seatsUnit}</li> : null}
                    </ul>
                    <div className="site-opp-actions">
                      <button type="button" className="site-btn site-btn--blue site-btn--sm" onClick={() => setDetails(o)}>
                        <i className="fas fa-info-circle" aria-hidden="true" /> {c.details}
                      </button>
                      {o.isOpen ? (
                        <button type="button" className="site-btn site-btn--primary site-btn--sm" onClick={() => setApplyTo(o)}>
                          <i className="fas fa-paper-plane" aria-hidden="true" /> {c.applyNow}
                        </button>
                      ) : <span className="site-btn site-btn--sm site-btn-disabled">{c.closedBtn}</span>}
                    </div>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <SectionHeader title={c.processTitle} tone="amber" />
          <ol className="site-steps">
            {c.steps.map(([title, text], i) => (
              <Reveal as="li" key={title} className="site-step" delay={i * 90}>
                <span className="site-step-num">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <Reveal className="site-panel">
            <SectionHeader title={c.partnersTitle} tone="blue" />
            <div className="site-uni-grid">
              {content.internshipUniversities.map(u => (
                <div key={u.id || u.name} className={`site-uni ${u.logoUrl ? 'has-logo' : ''}`}>
                  {u.logoUrl
                    ? <><span className="site-uni-logo"><img src={assetUrl(u.logoUrl)} alt="" loading="lazy" /></span><span>{pick(u.name, u.nameEn)}</span></>
                    : <><i className="fas fa-university" aria-hidden="true" /><span>{pick(u.name, u.nameEn)}</span></>}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <Modal open={!!details} onClose={closeDetails} title={details ? pick(details.title, details.titleEn) : ''} wide dir={ar ? 'rtl' : 'ltr'}>
        {details && (
          <div className="site-detail">
            <ul className="site-opp-details">
              {pick(details.department, details.departmentEn) && <li><i className="fas fa-laptop-code" aria-hidden="true" /> {pick(details.department, details.departmentEn)}</li>}
              {pick(details.duration, details.durationEn) && <li><i className="fas fa-clock" aria-hidden="true" /> <b>{c.duration}:</b> {pick(details.duration, details.durationEn)}</li>}
              {details.deadline && <li><i className="fas fa-calendar-alt" aria-hidden="true" /> <b>{c.deadline}:</b> {fmtDate(details.deadline, lang)}</li>}
              {details.seats ? <li><i className="fas fa-users" aria-hidden="true" /> <b>{c.seats}:</b> {details.seats} {c.seatsUnit}</li> : null}
            </ul>
            <p className="site-detail-text">{pick(details.description, details.descriptionEn)}</p>
            {lines(pick(details.requirements, details.requirementsEn)).length > 0 && (
              <>
                <h4 className="site-form-title"><i className="fas fa-clipboard-check" aria-hidden="true" /> {c.requirements}</h4>
                <ul className="site-checklist">
                  {lines(pick(details.requirements, details.requirementsEn)).map(r => <li key={r}><i className="fas fa-check" aria-hidden="true" /> {r}</li>)}
                </ul>
              </>
            )}
            {details.isOpen && (
              <div className="site-btn-row">
                <button type="button" className="site-btn site-btn--primary" onClick={() => { const o = details; setDetails(null); setApplyTo(o); }}>
                  <i className="fas fa-paper-plane" aria-hidden="true" /> {c.applyNow}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!applyTo} onClose={closeApply} title={c.formTitle} wide dir={ar ? 'rtl' : 'ltr'}>
        {applyTo && <ApplyForm key={applyTo.id} opp={applyTo} c={c} ar={ar} universities={content.internshipUniversities} pick={pick} />}
      </Modal>
    </SiteLayout>
  );
};

export default SiteInternship;
