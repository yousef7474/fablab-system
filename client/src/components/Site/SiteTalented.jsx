import React, { useState } from 'react';
import api from '../../config/api';
import SiteLayout from './SiteLayout';
import { PageHero, Reveal, SectionHeader, FileDrop } from './SiteParts';
import { useSiteLang, EMAIL_RE, apiError, scrollToId } from './siteCore';
import './sitePages.css';

const MAX_TEXT = 500;
const MAX_TOTAL = 30 * 1024 * 1024;

const EDUCATION = [
  ['primary', 'ابتدائي', 'Primary'],
  ['intermediate', 'متوسط', 'Intermediate'],
  ['secondary', 'ثانوي', 'Secondary'],
  ['diploma', 'دبلوم', 'Diploma'],
  ['bachelor', 'بكالوريوس', "Bachelor's"],
  ['master', 'ماجستير', "Master's"],
  ['phd', 'دكتوراه', 'PhD'],
  ['other', 'أخرى', 'Other']
];

const COUNTRIES = [
  ['+966', 'السعودية', 'Saudi Arabia'],
  ['+971', 'الإمارات', 'UAE'],
  ['+965', 'الكويت', 'Kuwait'],
  ['+974', 'قطر', 'Qatar'],
  ['+973', 'البحرين', 'Bahrain'],
  ['+968', 'عمان', 'Oman'],
  ['+20', 'مصر', 'Egypt'],
  ['+962', 'الأردن', 'Jordan']
];

const C = {
  ar: {
    title: 'أنا موهوب',
    intro: 'شارك موهبتك مع مجتمع فاب لاب الأحساء وانضم إلى عائلة المبدعين',
    formTitle: 'سجل موهبتك الآن',
    formSub: 'املأ النموذج التالي لتسجيل موهبتك في قاعدة بيانات فاب لاب الأحساء',
    personal: 'المعلومات الشخصية',
    fullName: 'الاسم الكامل', fullNamePh: 'أدخل اسمك الكامل',
    age: 'العمر', agePh: 'أدخل عمرك',
    education: 'المرحلة الدراسية / المؤهل الدراسي', educationPh: 'اختر المرحلة الدراسية',
    nationality: 'الجنسية', nationalityPh: 'أدخل جنسيتك',
    phone: 'رقم التواصل', email: 'البريد الإلكتروني (اختياري)',
    talentInfo: 'معلومات الموهبة',
    talent: 'نبذة عن الموهبة', talentPh: 'صف موهبتك بالتفصيل، متى بدأت، وما هي المجالات التي تبرع فيها...',
    achievementsTitle: 'المنجزات والأعمال',
    achievements: 'أهم المنجزات', achievementsPh: 'اذكر أهم إنجازاتك في مجال موهبتك، الجوائز، المشاريع الناجحة...',
    files: 'رفع ملفات وصور المنجزات', filesHint: 'الحد الأقصى 10 ملفات - الصور: JPG, PNG | الملفات: PDF, DOC, DOCX (حتى 10 ميجابايت لكل ملف)',
    chars: 'حرف',
    terms: 'أوافق على شروط الاستخدام وسياسة الخصوصية لفاب لاب الأحساء، وعلى استخدام بياناتي للتواصل معي بخصوص موهبتي',
    submit: 'تسجيل الموهبة', reset: 'مسح النموذج', sending: 'جاري الإرسال...',
    success: 'تم استلام تسجيل موهبتك بنجاح! سيتواصل معك فريق فاب لاب الأحساء قريباً.',
    another: 'تسجيل موهبة أخرى',
    required: 'هذا الحقل مطلوب', badAge: 'أدخل عمراً صحيحاً (5 - 100)', badPhone: 'أدخل رقم تواصل صحيح',
    badEmail: 'يرجى إدخال بريد إلكتروني صحيح', termsErr: 'يجب الموافقة على الشروط والأحكام',
    tooBig: 'مجموع الملفات أكبر من 30 ميجابايت', fixErrors: 'يرجى تصحيح الحقول المحددة',
    benefitsTitle: 'مزايا تسجيل موهبتك معنا',
    benefitsSub: 'اكتشف الفوائد التي تنتظرك عند تسجيل موهبتك في فاب لاب الأحساء',
    benefits: [
      ['fa-trophy', 'عرض المواهب', 'عرض موهبتك في معارض فاب لاب والمشاركة في فعالياتنا المحلية والدولية'],
      ['fa-users', 'مجتمع الموهوبين', 'انضم إلى مجتمع الموهوبين وتواصل مع أشخاص يشاركونك نفس الاهتمامات'],
      ['fa-graduation-cap', 'تدريب متخصص', 'احصل على فرص تدريبية متخصصة لتطوير موهبتك وصقل مهاراتك']
    ]
  },
  en: {
    title: 'I Am Talented',
    intro: 'Share your talent with the FabLab Al-Ahsa community and join the family of creators',
    formTitle: 'Register Your Talent Now',
    formSub: 'Fill in the form below to register your talent in the FabLab Al-Ahsa database',
    personal: 'Personal Information',
    fullName: 'Full name', fullNamePh: 'Enter your full name',
    age: 'Age', agePh: 'Enter your age',
    education: 'Education level / qualification', educationPh: 'Choose your education level',
    nationality: 'Nationality', nationalityPh: 'Enter your nationality',
    phone: 'Contact number', email: 'Email (optional)',
    talentInfo: 'Talent Information',
    talent: 'About your talent', talentPh: 'Describe your talent in detail, when you started and the areas you excel in...',
    achievementsTitle: 'Achievements & Work',
    achievements: 'Key achievements', achievementsPh: 'List your main achievements in your field — awards, successful projects...',
    files: 'Upload files and photos of your achievements', filesHint: 'Up to 10 files - Images: JPG, PNG | Files: PDF, DOC, DOCX (up to 10 MB each)',
    chars: 'characters',
    terms: 'I agree to the FabLab Al-Ahsa terms of use and privacy policy, and to my data being used to contact me about my talent',
    submit: 'Register Talent', reset: 'Clear Form', sending: 'Sending...',
    success: 'Your talent registration was received! The FabLab Al-Ahsa team will contact you soon.',
    another: 'Register another talent',
    required: 'This field is required', badAge: 'Enter a valid age (5 - 100)', badPhone: 'Enter a valid contact number',
    badEmail: 'Please enter a valid email', termsErr: 'You must accept the terms and conditions',
    tooBig: 'Files total more than 30 MB', fixErrors: 'Please fix the highlighted fields',
    benefitsTitle: 'Benefits of registering your talent',
    benefitsSub: 'Discover what awaits you when you register your talent at FabLab Al-Ahsa',
    benefits: [
      ['fa-trophy', 'Showcase talents', 'Show your talent at FabLab exhibitions and take part in our local and international events'],
      ['fa-users', 'Talent community', 'Join a community of talented people and connect with others who share your interests'],
      ['fa-graduation-cap', 'Specialized training', 'Get specialized training opportunities to develop your talent and sharpen your skills']
    ]
  }
};

const EMPTY = { fullName: '', age: '', educationLevel: '', nationality: '', countryCode: '+966', phone: '', email: '', talentDescription: '', achievements: '', terms: false };

const SiteTalented = () => {
  const { lang } = useSiteLang();
  const ar = lang === 'ar';
  const c = C[lang];
  const [f, setF] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ busy: false, ok: '', err: '' });

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF(x => ({ ...x, [k]: v }));
    setErrors(x => ({ ...x, [k]: '' }));
    setStatus(s => (s.err ? { ...s, err: '' } : s));
  };

  const validate = () => {
    const er = {};
    ['fullName', 'age', 'educationLevel', 'nationality', 'phone', 'talentDescription', 'achievements'].forEach(k => { if (!String(f[k]).trim()) er[k] = c.required; });
    const age = Number(f.age);
    if (!er.age && (!Number.isInteger(age) || age < 5 || age > 100)) er.age = c.badAge;
    const digits = f.phone.replace(/[\s-]/g, '');
    if (!er.phone && !/^\d{7,12}$/.test(digits)) er.phone = c.badPhone;
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) er.email = c.badEmail;
    if (!f.terms) er.terms = c.termsErr;
    if (files.reduce((n, x) => n + (x.fileSize || 0), 0) > MAX_TOTAL) er.files = c.tooBig;
    return er;
  };

  const submit = async (e) => {
    e.preventDefault();
    const er = validate();
    setErrors(er);
    if (Object.keys(er).length) {
      setStatus({ busy: false, ok: '', err: c.fixErrors });
      // after the error classes render
      setTimeout(() => document.querySelector('.site-talent-form .has-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 30);
      return;
    }
    setStatus({ busy: true, ok: '', err: '' });
    const edu = EDUCATION.find(x => x[0] === f.educationLevel);
    try {
      const payload = {
        fullName: f.fullName.trim(),
        age: Number(f.age),
        // Stored as readable Arabic text for the admin panel.
        educationLevel: edu ? edu[1] : f.educationLevel,
        nationality: f.nationality.trim(),
        countryCode: f.countryCode,
        phone: f.phone.replace(/[\s-]/g, '').replace(/^0+/, ''),
        ...(f.email.trim() ? { email: f.email.trim() } : {}),
        talentDescription: f.talentDescription.trim(),
        achievements: f.achievements.trim(),
        files: files.map(x => ({ fileName: x.fileName, fileType: x.fileType, fileData: x.fileData })),
        termsAccepted: true
      };
      const { data } = await api.post('/site/talent', payload);
      setStatus({ busy: false, ok: (ar ? data?.messageAr : data?.message) || c.success, err: '' });
      setF(EMPTY);
      setFiles([]);
      scrollToId('talent-form');
    } catch (err) {
      setStatus({ busy: false, ok: '', err: apiError(err, ar, 'حدث خطأ أثناء الإرسال، حاول مرة أخرى', 'Something went wrong, please try again') });
    }
  };

  const reset = () => { setF(EMPTY); setFiles([]); setErrors({}); setStatus({ busy: false, ok: '', err: '' }); };

  const err = (k) => errors[k] && <span className="site-field-err">{errors[k]}</span>;
  const cls = (k, extra = '') => `site-field ${extra} ${errors[k] ? 'has-error' : ''}`;

  return (
    <SiteLayout className="site-talented">
      <PageHero title={c.title} intro={c.intro} />

      <section className="site-section" id="talent-form">
        <div className="site-container site-narrow">
          <Reveal className="site-panel">
            <SectionHeader title={c.formTitle} subtitle={c.formSub} />
            {status.ok ? (
              <div className="site-success">
                <i className="fas fa-check-circle" aria-hidden="true" />
                <p>{status.ok}</p>
                <button type="button" className="site-btn site-btn--outline site-btn--sm" onClick={reset}>{c.another}</button>
              </div>
            ) : (
              <form className="site-form site-talent-form" onSubmit={submit} noValidate>
                <h4 className="site-form-title"><i className="fas fa-user" aria-hidden="true" /> {c.personal}</h4>
                <div className="site-form-grid">
                  <label className={cls('fullName')}>
                    <span className="site-label">{c.fullName} *</span>
                    <input value={f.fullName} onChange={set('fullName')} placeholder={c.fullNamePh} maxLength={150} autoComplete="name" />
                    {err('fullName')}
                  </label>
                  <label className={cls('age')}>
                    <span className="site-label">{c.age} *</span>
                    <input type="number" inputMode="numeric" min="5" max="100" value={f.age} onChange={set('age')} placeholder={c.agePh} dir="ltr" />
                    {err('age')}
                  </label>
                  <label className={cls('educationLevel')}>
                    <span className="site-label">{c.education} *</span>
                    <select value={f.educationLevel} onChange={set('educationLevel')}>
                      <option value="">{c.educationPh}</option>
                      {EDUCATION.map(([v, a, en]) => <option key={v} value={v}>{ar ? a : en}</option>)}
                    </select>
                    {err('educationLevel')}
                  </label>
                  <label className={cls('nationality')}>
                    <span className="site-label">{c.nationality} *</span>
                    <input value={f.nationality} onChange={set('nationality')} placeholder={c.nationalityPh} maxLength={80} />
                    {err('nationality')}
                  </label>
                  <div className={cls('phone')}>
                    <span className="site-label">{c.phone} *</span>
                    <div className="site-phone" dir="ltr">
                      <select value={f.countryCode} onChange={set('countryCode')} aria-label={ar ? 'رمز الدولة' : 'Country code'}>
                        {COUNTRIES.map(([code, a, en]) => <option key={code} value={code}>{code} {ar ? a : en}</option>)}
                      </select>
                      <input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="5XXXXXXXX" maxLength={15} aria-label={c.phone} autoComplete="tel-national" />
                    </div>
                    {err('phone')}
                  </div>
                  <label className={cls('email')}>
                    <span className="site-label">{c.email}</span>
                    <input type="email" dir="ltr" value={f.email} onChange={set('email')} placeholder="example@email.com" maxLength={150} autoComplete="email" />
                    {err('email')}
                  </label>
                </div>

                <h4 className="site-form-title"><i className="fas fa-star" aria-hidden="true" /> {c.talentInfo}</h4>
                <div className="site-form-grid">
                  <label className={cls('talentDescription', 'full')}>
                    <span className="site-label">{c.talent} *</span>
                    <textarea rows={5} value={f.talentDescription} onChange={set('talentDescription')} placeholder={c.talentPh} maxLength={MAX_TEXT} />
                    <span className="site-counter">{f.talentDescription.length} / {MAX_TEXT} {c.chars}</span>
                    {err('talentDescription')}
                  </label>
                </div>

                <h4 className="site-form-title"><i className="fas fa-award" aria-hidden="true" /> {c.achievementsTitle}</h4>
                <div className="site-form-grid">
                  <label className={cls('achievements', 'full')}>
                    <span className="site-label">{c.achievements} *</span>
                    <textarea rows={5} value={f.achievements} onChange={set('achievements')} placeholder={c.achievementsPh} maxLength={MAX_TEXT} />
                    <span className="site-counter">{f.achievements.length} / {MAX_TEXT} {c.chars}</span>
                    {err('achievements')}
                  </label>
                  <div className="full">
                    <FileDrop
                      label={c.files}
                      hint={c.filesHint}
                      accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                      types={['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx']}
                      maxBytes={10 * 1024 * 1024}
                      max={10}
                      files={files}
                      onChange={(v) => { setFiles(v); setErrors(x => ({ ...x, files: '' })); }}
                      isRTL={ar}
                      error={errors.files}
                    />
                  </div>
                </div>

                <label className={`site-check ${errors.terms ? 'has-error' : ''}`}>
                  <input type="checkbox" checked={f.terms} onChange={set('terms')} />
                  <span>{c.terms} *</span>
                </label>
                {err('terms')}

                {status.err && <div className="site-form-msg err">{status.err}</div>}
                <div className="site-btn-row">
                  <button type="submit" className="site-btn site-btn--primary" disabled={status.busy}>
                    {status.busy ? <><span className="site-spinner sm" /> {c.sending}</> : <><i className="fas fa-paper-plane" aria-hidden="true" /> {c.submit}</>}
                  </button>
                  <button type="button" className="site-btn site-btn--outline" onClick={reset} disabled={status.busy}>
                    <i className="fas fa-redo" aria-hidden="true" /> {c.reset}
                  </button>
                </div>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <SectionHeader title={c.benefitsTitle} subtitle={c.benefitsSub} tone="amber" />
          <div className="site-feature-grid three">
            {c.benefits.map(([icon, title, text], i) => (
              <Reveal key={icon} className="site-feature-card" delay={i * 90}>
                <span className="site-feature-icon"><i className={`fas ${icon}`} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};

export default SiteTalented;
