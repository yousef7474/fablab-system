import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SECTIONS, SECTION_BY_VALUE, SERVICE_LABELS, matchSections } from './sectionCatalog';
import './RegistrationGuide.css';

// "Help me choose" wizard for the registration page.
//
// People who wanted a technical consultation kept filing FabLab-visit
// or project-support requests, because consultation lives inside the
// main registration flow (Beneficiary → section → service) and nothing
// on the landing page said so. This guide asks what they want, routes
// non-consultation goals to their own pages, and for consultation /
// machine use recommends a section and pre-fills the registration.
//
// Modes:
//   full    — landing page: goal → section → how → result
//   section — FablabSection step: section finder only
// `intercept` ('visit' | 'support') opens with a "this form is for X —
// did you mean a consultation?" screen before those two pages.
//
// Rendered through a portal: .form-card uses backdrop-filter, which
// would trap a position:fixed overlay inside the card.

const WHATSAPP_URL = 'https://wa.me/966555022605';

const Icon = ({ d, children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d ? <path d={d} /> : children}
  </svg>
);

const GOALS = [
  {
    key: 'consult',
    inFlow: true,
    titleAr: 'استشارة تقنية لمشروعي',
    titleEn: 'A technical consultation for my project',
    subAr: 'جلسة مع مهندس القسم لمناقشة فكرتك أو حل مشكلة تقنية — حضورياً أو عن بعد',
    subEn: 'A session with a section engineer about your idea or a technical problem — in person or online',
    icon: <Icon><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></Icon>
  },
  {
    key: 'machine',
    inFlow: true,
    titleAr: 'استخدام جهاز لتنفيذ مشروعي',
    titleEn: 'Use a machine to build my project',
    subAr: 'حجز جهاز (ليزر، طابعة، CNC…) والعمل عليه بنفسك',
    subEn: 'Reserve a machine (laser, printer, CNC…) and work on it yourself',
    icon: <Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>
  },
  {
    key: 'visit',
    path: '/fablab-visit',
    titleAr: 'زيارة جماعية تعريفية',
    titleEn: 'A group introductory visit',
    subAr: 'لمدرسة أو جامعة أو جهة تريد التعرّف على فاب لاب',
    subEn: 'For a school, university or organization touring FabLab',
    icon: <Icon><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Icon>
  },
  {
    key: 'support',
    path: '/project-support',
    titleAr: 'تمويل أو رعاية لمشروع',
    titleEn: 'Funding or sponsorship for a project',
    subAr: 'دعم مالي أو رعاية لمشروعك، أو دعم مشاركتك في مسابقة',
    subEn: 'Financial support or sponsorship, or support for a competition entry',
    icon: <Icon d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  },
  {
    key: 'workshop',
    path: '/workshop',
    titleAr: 'ورشة أو دورة تدريبية',
    titleEn: 'A training workshop',
    subAr: 'التسجيل في ورشة معلنة بموعد محدد',
    subEn: 'Sign up for a scheduled workshop',
    icon: <Icon><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></Icon>
  },
  {
    key: 'print',
    path: '/print-service',
    titleAr: 'طباعة ملف ثلاثي الأبعاد جاهز',
    titleEn: 'Print a ready 3D file',
    subAr: 'عندك ملف جاهز وتريد استلامه مطبوعاً',
    subEn: 'You have a file and want it printed for you',
    icon: <Icon><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></Icon>
  },
  {
    key: 'borrow',
    path: '/borrow',
    titleAr: 'استعارة قطع إلكترونية',
    titleEn: 'Borrow electronic components',
    subAr: 'استعارة أدوات أو مكونات لفترة محددة',
    subEn: 'Borrow tools or components for a set period',
    icon: <Icon><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/></Icon>
  }
];

const HOW_OPTIONS = [
  {
    value: 'In-person consultation',
    titleAr: 'حضورياً في فاب لاب',
    titleEn: 'In person at FabLab',
    subAr: 'تقابل مهندس القسم ومعك مشروعك أو قطعك',
    subEn: 'Meet the section engineer with your project or parts',
    icon: <Icon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>
  },
  {
    value: 'Online consultation',
    titleAr: 'عن بعد (اجتماع مرئي)',
    titleEn: 'Online (video call)',
    subAr: 'مناسبة للأسئلة والتصميم والبرمجة',
    subEn: 'Good for questions, design and code',
    icon: <Icon><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></Icon>
  }
];

const INTERCEPTS = {
  visit: {
    path: '/fablab-visit',
    titleAr: 'طلب الزيارة مخصص للزيارات الجماعية',
    titleEn: 'The visit form is for group visits',
    bodyAr: 'هذا النموذج لتنظيم زيارة تعريفية لمجموعة — مدرسة أو جامعة أو جهة. إذا كنت تريد استشارة تقنية لمشروعك أو حجز جهاز، فالتسجيل يتم من «تسجيل جديد»، وسنساعدك الآن في اختيار القسم المناسب.',
    bodyEn: 'This form organizes an introductory visit for a group — a school, university or organization. If you want a technical consultation or to reserve a machine, that is booked through "New Registration", and we can help you pick the right section now.',
    continueAr: 'أكمل إلى طلب الزيارة',
    continueEn: 'Continue to the visit form'
  },
  support: {
    path: '/project-support',
    titleAr: 'طلب الدعم مخصص للتمويل والرعاية',
    titleEn: 'The support form is for funding & sponsorship',
    bodyAr: 'هذا النموذج لطلب تمويل أو رعاية لمشروعك أو دعم مشاركتك في مسابقة، وتراجعه الإدارة خلال 5 أيام عمل. أما الاستشارة التقنية مع مهندس القسم فلها تسجيل مستقل وأسرع.',
    bodyEn: 'This form requests funding or sponsorship for your project or a competition entry, reviewed by management within 5 working days. A technical consultation with a section engineer has its own, faster registration.',
    continueAr: 'أكمل إلى طلب الدعم',
    continueEn: 'Continue to the support form'
  }
};

const Arrow = ({ isRTL }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const RegistrationGuide = ({
  open,
  onClose,
  onApply,
  isRTL = true,
  theme = 'dark',
  mode = 'full',
  intercept = null,
  initialSection = ''
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState('goal');
  const [history, setHistory] = useState([]);
  const [goal, setGoal] = useState(null);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');
  const [service, setService] = useState('');
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const L = (ar, en) => (isRTL ? ar : en);

  // Each step starts at the top of the scroll area.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [step]);

  // Fresh state every time the guide opens.
  useEffect(() => {
    if (!open) return;
    setHistory([]);
    setQuery('');
    setSection(initialSection || '');
    setService('');
    setGoal(intercept ? 'consult' : null);
    setStep(mode === 'section' ? 'topic' : intercept ? 'intercept' : 'goal');
  }, [open, mode, intercept, initialSection]);

  // Callers pass inline handlers; keep the latest in a ref so the
  // open/close effect below doesn't re-run on every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Esc closes; lock page scroll while open; focus the dialog.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => dialogRef.current?.focus(), 40);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const go = useCallback((next) => {
    setHistory(h => [...h, step]);
    setStep(next);
  }, [step]);

  const back = () => {
    if (history.length === 0) return;
    setStep(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  const leaveTo = (path) => {
    onClose();
    navigate(path);
  };

  const matches = useMemo(() => matchSections(query).slice(0, 2), [query]);
  const suggested = useMemo(() => new Set(matches.map(m => m.section.value)), [matches]);

  const flow = mode === 'section'
    ? ['topic', 'result']
    : [intercept ? 'intercept' : 'goal', 'topic', ...(goal === 'machine' ? [] : ['how']), 'result'];
  const stepIndex = Math.max(0, flow.indexOf(step));

  const pickGoal = (g) => {
    if (!g.inFlow) { leaveTo(g.path); return; }
    setGoal(g.key);
    go('topic');
  };

  const pickSection = (value) => {
    setSection(value);
    if (mode === 'section') { go('result'); return; }
    if (goal === 'machine') {
      setService('Machine/Device reservation');
      go('result');
      return;
    }
    go('how');
  };

  const pickHow = (value) => {
    setService(value);
    go('result');
  };

  const apply = () => {
    if (!section) return;
    if (mode === 'section') {
      onApply({ fablabSection: section });
    } else {
      onApply({
        applicationType: 'Beneficiary',
        fablabSection: section,
        requiredServices: [service || 'In-person consultation']
      });
    }
    onClose();
  };

  const sec = SECTION_BY_VALUE[section];
  const svc = SERVICE_LABELS[service];

  const titles = {
    intercept: intercept ? L(INTERCEPTS[intercept].titleAr, INTERCEPTS[intercept].titleEn) : '',
    goal: L('ماذا تريد من فاب لاب؟', 'What do you need from FabLab?'),
    topic: L('عن ماذا يدور مشروعك؟', 'What is your project about?'),
    how: L('كيف تفضّل الاستشارة؟', 'How would you like the consultation?'),
    result: mode === 'section' ? L('القسم المناسب لك', 'Your best-fit section') : L('توصيتنا لك', 'Our recommendation')
  };

  if (!open) return null;

  const body = (
      <motion.div
        className="rg-overlay"
        data-theme={theme === 'light' ? 'light' : 'dark'}
        dir={isRTL ? 'rtl' : 'ltr'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="rg-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rg-title"
          tabIndex={-1}
          ref={dialogRef}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <div className="rg-head">
            <div className="rg-head-text">
              <span className="rg-kicker">
                {L('دليل التسجيل', 'Registration guide')}
                <span className="rg-kicker-step">{stepIndex + 1} / {flow.length}</span>
              </span>
              <h2 id="rg-title" className="rg-title">{titles[step]}</h2>
            </div>
            <button type="button" className="rg-close" onClick={onClose} aria-label={L('إغلاق', 'Close')}>
              <Icon><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>
            </button>
          </div>

          <div className="rg-progress" aria-hidden="true">
            {flow.map((s, i) => (
              <span key={s} className={i <= stepIndex ? 'is-on' : ''} />
            ))}
          </div>

          <div className="rg-body" ref={bodyRef}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: isRTL ? -18 : 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRTL ? 18 : -18 }}
                transition={{ duration: 0.18 }}
              >
                {step === 'intercept' && intercept && (
                  <div className="rg-intercept">
                    <p className="rg-lead">{L(INTERCEPTS[intercept].bodyAr, INTERCEPTS[intercept].bodyEn)}</p>
                    <div className="rg-intercept-actions">
                      <button type="button" className="rg-btn rg-btn--primary rg-btn--block" onClick={() => go('topic')}>
                        {L('أريد استشارة تقنية — ساعدني أختار القسم', 'I want a technical consultation — help me pick')}
                        <Arrow isRTL={isRTL} />
                      </button>
                      <button type="button" className="rg-btn rg-btn--block" onClick={() => leaveTo(INTERCEPTS[intercept].path)}>
                        {L(INTERCEPTS[intercept].continueAr, INTERCEPTS[intercept].continueEn)}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'goal' && (
                  <div className="rg-goal-grid">
                    {GOALS.map((g, i) => (
                      <button
                        key={g.key}
                        type="button"
                        className={`rg-goal ${g.inFlow ? 'rg-goal--inflow' : ''} ${i === 0 ? 'rg-goal--featured' : ''}`}
                        onClick={() => pickGoal(g)}
                      >
                        <span className="rg-goal-ico">{g.icon}</span>
                        <span className="rg-goal-text">
                          <span className="rg-goal-title">
                            {L(g.titleAr, g.titleEn)}
                            {i === 0 && <span className="rg-badge">{L('الأكثر طلباً', 'Most common')}</span>}
                          </span>
                          <span className="rg-goal-sub">{L(g.subAr, g.subEn)}</span>
                        </span>
                        {!g.inFlow && (
                          <span className="rg-goal-out" title={L('ينقلك لصفحة مخصصة', 'Opens its own page')}>
                            <Icon><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></Icon>
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {step === 'topic' && (
                  <div className="rg-topic">
                    <label className="rg-search">
                      <Icon><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></Icon>
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={L('اكتب فكرتك بكلماتك… مثال: روبوت يتبع الخط، ملصقات لمحلي', 'Describe your idea… e.g. line-follower robot, stickers for my shop')}
                        aria-label={L('صف فكرتك', 'Describe your idea')}
                      />
                    </label>

                    {query.trim().length >= 2 && (
                      <div className="rg-suggest" aria-live="polite">
                        {matches.length > 0 ? (
                          <>
                            <span className="rg-suggest-label">{L('الأنسب لفكرتك:', 'Best match for your idea:')}</span>
                            {matches.map(m => (
                              <button key={m.section.value} type="button" className="rg-chip" onClick={() => pickSection(m.section.value)}>
                                {L(m.section.labelAr, m.section.labelEn)}
                                <Arrow isRTL={isRTL} />
                              </button>
                            ))}
                          </>
                        ) : (
                          <span className="rg-suggest-label">{L('لم نتعرّف على فكرتك — اختر من الأقسام بالأسفل', "We couldn't match that — pick a section below")}</span>
                        )}
                      </div>
                    )}

                    <div className="rg-sec-grid">
                      {SECTIONS.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          className={`rg-sec ${suggested.has(s.value) ? 'is-suggested' : ''} ${section === s.value ? 'is-selected' : ''}`}
                          onClick={() => pickSection(s.value)}
                        >
                          {suggested.has(s.value) && <span className="rg-sec-flag">{L('مقترح', 'Suggested')}</span>}
                          <span className="rg-sec-ico">{s.icon}</span>
                          <span className="rg-sec-title">{L(s.labelAr, s.labelEn)}</span>
                          <span className="rg-sec-desc">{L(s.descAr, s.descEn)}</span>
                        </button>
                      ))}
                    </div>

                    <p className="rg-help">
                      {L('لم تجد ما يناسب فكرتك؟ ', "Can't find a fit? ")}
                      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                        {L('راسلنا على واتساب وسنوجّهك للقسم المناسب', "Message us on WhatsApp and we'll point you to the right section")}
                      </a>
                    </p>
                  </div>
                )}

                {step === 'how' && (
                  <div className="rg-how">
                    {HOW_OPTIONS.map(o => (
                      <button key={o.value} type="button" className={`rg-how-card ${service === o.value ? 'is-selected' : ''}`} onClick={() => pickHow(o.value)}>
                        <span className="rg-how-ico">{o.icon}</span>
                        <span className="rg-how-title">{L(o.titleAr, o.titleEn)}</span>
                        <span className="rg-how-sub">{L(o.subAr, o.subEn)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {step === 'result' && sec && (
                  <div className="rg-result">
                    <div className="rg-result-card">
                      <span className="rg-result-ico">{sec.icon}</span>
                      <div>
                        <div className="rg-result-label">{L('القسم', 'Section')}</div>
                        <div className="rg-result-name">{L(sec.labelAr, sec.labelEn)}</div>
                        <div className="rg-result-desc">{L(sec.descAr, sec.descEn)}</div>
                      </div>
                    </div>

                    {mode !== 'section' && svc && (
                      <div className="rg-result-row">
                        <span className="rg-pill">{L('الخدمة', 'Service')}: <b>{L(svc.ar, svc.en)}</b></span>
                        <span className="rg-pill">{L('نوع الطلب', 'Type')}: <b>{L('مستفيد', 'Beneficiary')}</b></span>
                      </div>
                    )}

                    {mode !== 'section' && (
                      <ol className="rg-next">
                        <li>{L('أدخل رقم هويتك أو جوالك واضغط «بحث» إن سجّلت سابقاً، أو اضغط «تسجيل جديد».', 'Enter your ID or phone and press "Search" if you registered before, or press "New Registration".')}</li>
                        <li>{L('نوع الطلب والقسم والخدمة محددة لك مسبقاً — تأكد منها واضغط «التالي».', 'Type, section and service are pre-selected — check them and press "Next".')}</li>
                        <li>{L('أكمل بياناتك واختر الموعد المناسب لك.', 'Complete your details and pick a time that suits you.')}</li>
                      </ol>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {step !== 'intercept' && (history.length > 0 || step === 'result') && (
            <div className="rg-foot">
              {history.length > 0 ? (
                <button type="button" className="rg-btn" onClick={back}>
                  <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><Arrow isRTL={isRTL} /></span>
                  {L('رجوع', 'Back')}
                </button>
              ) : <span />}
              {step === 'result' && (
                <button type="button" className="rg-btn rg-btn--primary" onClick={apply}>
                  {mode === 'section' ? L('اختر هذا القسم', 'Choose this section') : L('اعتمد اختياري وابدأ التسجيل', 'Use this & start registering')}
                  <Arrow isRTL={isRTL} />
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
  );

  return createPortal(body, document.body);
};

export default RegistrationGuide;
