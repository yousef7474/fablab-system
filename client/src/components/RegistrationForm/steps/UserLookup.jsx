import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import Lottie from 'lottie-react';
import welcomeAnimation from '../../../lottie/welcome.json';
import api from '../../../config/api';
import RegistrationGuide from '../RegistrationGuide';
import { SECTION_BY_VALUE, SERVICE_LABELS } from '../sectionCatalog';

const ELITE_PASSWORD = 'fabstar123';
const EDUCATION_PASSWORD = 'education123';

const UserLookup = ({ onUserFound, onNewUser, theme, guidedChoice, onGuideApply, onGuideClear }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const identifierRef = useRef(null);
  const [guide, setGuide] = useState({ open: false, intercept: null });
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [elitePassword, setElitePassword] = useState('');
  const [showEducationOptions, setShowEducationOptions] = useState(false);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [educationPassword, setEducationPassword] = useState('');
  const [pendingEducationPath, setPendingEducationPath] = useState('');

  const handleEducationAccess = () => {
    if (educationPassword === EDUCATION_PASSWORD) {
      setShowEducationModal(false);
      setEducationPassword('');
      navigate(pendingEducationPath);
    } else {
      toast.error(isRTL ? 'كلمة المرور غير صحيحة' : 'Incorrect password');
    }
  };

  const openEducationModal = (path) => {
    setPendingEducationPath(path);
    setShowEducationModal(true);
  };

  const openGuide = (intercept = null) => setGuide({ open: true, intercept });
  const closeGuide = () => setGuide(g => ({ ...g, open: false }));

  // Visit + project-support forms were catching people who really
  // wanted a consultation. The first click per session shows a short
  // "this form is for X — did you mean a consultation?" screen.
  const goWithIntercept = (kind, path) => {
    const key = `fablab_guide_seen_${kind}`;
    let seen = false;
    try { seen = sessionStorage.getItem(key) === '1'; } catch (e) {}
    if (seen) { navigate(path); return; }
    try { sessionStorage.setItem(key, '1'); } catch (e) {}
    openGuide(kind);
  };

  const handleGuideApply = (choice) => {
    onGuideApply?.(choice);
    // Bring the ID/phone field into view — it's the next thing to do.
    setTimeout(() => {
      identifierRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      identifierRef.current?.focus({ preventScroll: true });
    }, 250);
  };

  const pickedSection = guidedChoice ? SECTION_BY_VALUE[guidedChoice.fablabSection] : null;
  const pickedService = guidedChoice ? SERVICE_LABELS[guidedChoice.requiredServices?.[0]] : null;

  const handleEliteAccess = () => {
    if (elitePassword === ELITE_PASSWORD) {
      setShowEliteModal(false);
      setElitePassword('');
      navigate('/elite-registration');
    } else {
      toast.error(isRTL ? 'كلمة المرور غير صحيحة' : 'Incorrect password');
    }
  };

  const handleCheck = async () => {
    if (!identifier.trim()) {
      toast.error(isRTL ? 'الرجاء إدخال رقم الهوية أو رقم الهاتف' : 'Please enter National ID or Phone Number');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/registration/check-user', { identifier: identifier.trim() });

      if (response.data.exists) {
        toast.success(isRTL ? 'مرحباً بعودتك!' : 'Welcome back!');
        onUserFound(response.data.user);
      } else {
        toast.info(isRTL ? 'مستخدم جديد - يرجى إكمال التسجيل' : 'New user - please complete registration');
        onNewUser();
      }
    } catch (error) {
      console.error('Error checking user:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء التحقق' : 'Error checking user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-lookup">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="user-lookup-lottie">
          <Lottie animationData={welcomeAnimation} loop autoplay style={{ width: 180, height: 180, margin: '0 auto' }} />
        </div>
      </motion.div>

      <motion.h2
        className="user-lookup-title"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {isRTL ? 'مرحباً بك في فاب لاب الأحساء' : 'Welcome to FABLAB Al-Ahsa'}
      </motion.h2>

      <motion.p
        className="user-lookup-description"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {isRTL
          ? 'أدخل رقم الهوية الوطنية أو رقم الهاتف للتحقق من تسجيلك السابق'
          : 'Enter your National ID or Phone Number to check your previous registration'}
      </motion.p>

      {/* Consultation guide — consultations are booked through this
          registration, which wasn't obvious from the landing page. */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        {guidedChoice && pickedSection ? (
          <div className="rg-picked" role="status">
            <div className="rg-picked-top">
              <span className="rg-picked-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span className="rg-picked-title">
                {isRTL ? pickedService?.ar : pickedService?.en}
                {' · '}
                {isRTL ? pickedSection.labelAr : pickedSection.labelEn}
              </span>
              <span className="rg-picked-actions">
                <button type="button" onClick={() => openGuide()}>{isRTL ? 'تغيير' : 'Change'}</button>
                <button type="button" onClick={onGuideClear}>{isRTL ? 'إلغاء' : 'Clear'}</button>
              </span>
            </div>
            <p className="rg-picked-next">
              {isRTL
                ? 'الخطوة التالية: أدخل رقم هويتك أو جوالك بالأسفل واضغط «بحث»، أو اضغط «تسجيل جديد» إن كانت هذه أول مرة لك.'
                : 'Next: enter your ID or phone below and press "Search", or press "New Registration" if this is your first time.'}
            </p>
          </div>
        ) : (
          <button type="button" className="rg-launch" onClick={() => openGuide()}>
            <span className="rg-launch-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
            </span>
            <span className="rg-launch-text">
              <b>{isRTL ? 'تريد استشارة تقنية أو حجز جهاز؟' : 'Want a technical consultation or a machine?'}</b>
              <small>{isRTL ? 'أجب عن أسئلة سريعة ونوجّهك للقسم المناسب ونجهّز لك التسجيل' : "Answer a few quick questions — we'll pick the right section and set up your registration"}</small>
            </span>
            <span className="rg-launch-cta">
              {isRTL ? 'ساعدني أختار' : 'Help me choose'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }}>
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </span>
          </button>
        )}
      </motion.div>

      <motion.div
        className="user-lookup-input"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <input
          ref={identifierRef}
          type="text"
          className="form-input"
          placeholder={isRTL ? 'رقم الهوية أو رقم الهاتف' : 'National ID or Phone Number'}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
          style={{ width: '100%', textAlign: isRTL ? 'right' : 'left' }}
        />
      </motion.div>

      <motion.div
        className="user-lookup-buttons"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button
          className="btn btn-primary"
          onClick={handleCheck}
          disabled={loading}
        >
          {loading ? (
            <span className="loading-spinner" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              {t('search')}
            </>
          )}
        </button>

        <button
          className="btn btn-secondary"
          onClick={onNewUser}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          {isRTL ? 'تسجيل جديد' : 'New Registration'}
        </button>
      </motion.div>

      {/* Divider */}
      <motion.div
        className="service-divider"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
      >
        <span>{isRTL ? 'أو تصفح خدماتنا' : 'or browse our services'}</span>
      </motion.div>

      {/* Service cards grid */}
      <motion.div
        className="service-cards-grid"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {/* Technical consultation — booked through the main registration;
            opens the guide so people land in the right section. */}
        <button
          type="button"
          className="service-card service-card--consult"
          onClick={() => openGuide()}
        >
          <div className="service-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              <path d="M8 9h8M8 13h5"/>
            </svg>
          </div>
          <div className="service-card-body">
            <span className="service-card-badge">{isRTL ? 'ابدأ من هنا' : 'Start here'}</span>
            <div className="service-card-title">{isRTL ? 'استشارة تقنية وحجز الأجهزة' : 'Tech Consultation & Machines'}</div>
            <div className="service-card-description">
              {isRTL
                ? 'جلسة مع مهندس القسم حضورياً أو عن بعد، أو حجز جهاز لتنفيذ مشروعك — نساعدك في اختيار القسم'
                : 'Meet a section engineer in person or online, or reserve a machine — we help you pick the section'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">{isRTL ? '←' : '→'}</div>
        </button>

        {/* Borrow Components */}
        <button
          type="button"
          className="service-card service-card--borrow"
          onClick={() => navigate('/borrow')}
        >
          <div className="service-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div className="service-card-body">
            <div className="service-card-title">{isRTL ? 'استعارة مكونات' : 'Borrow Components'}</div>
            <div className="service-card-description">
              {isRTL ? 'استعارة الأدوات والمكونات الإلكترونية لمشاريعك' : 'Borrow tools and electronic components for your projects'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">{isRTL ? '←' : '→'}</div>
        </button>

        {/* Store */}
        <button
          type="button"
          className="service-card service-card--store"
          onClick={() => navigate('/store')}
        >
          <div className="service-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div className="service-card-body">
            <div className="service-card-title">{isRTL ? 'متجر فاب لاب' : 'FABLAB Store'}</div>
            <div className="service-card-description">
              {isRTL ? 'تسوّق الأدوات، المكونات، والمواد — الدفع نقداً عند الاستلام' : 'Shop tools, kits and materials — cash on pickup'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">{isRTL ? '←' : '→'}</div>
        </button>

        {/* 3D Printing Service */}
        <button
          type="button"
          className="service-card service-card--print3d"
          onClick={() => navigate('/print-service')}
        >
          <div className="service-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
          </div>
          <div className="service-card-body">
            <div className="service-card-title">{isRTL ? 'خدمة طباعة ثلاثية الأبعاد' : '3D Printing Service'}</div>
            <div className="service-card-description">
              {isRTL ? 'ارفع تصميمك، اختر الخامة واللون، وستصلك تكلفة الطباعة على بريدك قبل البدء' : 'Upload your design, pick material & color — quote emailed before printing'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">{isRTL ? '←' : '→'}</div>
        </button>

        {/* FABLAB Visit */}
        <button
          type="button"
          className="service-card service-card--visit"
          onClick={() => goWithIntercept('visit', '/fablab-visit')}
        >
          <div className="service-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
            </svg>
          </div>
          <div className="service-card-body">
            <div className="service-card-title">{isRTL ? 'طلب زيارة للفاب لاب' : 'FABLAB Visit'}</div>
            <div className="service-card-description">
              {isRTL ? 'زيارة جماعية تعريفية للمدارس والجامعات والجهات — ليست لحجز استشارة' : 'Group introductory tours for schools & organizations — not for consultations'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">{isRTL ? '←' : '→'}</div>
        </button>

        {/* Project Support Request — a new open-ended channel for
            people asking for funding, tech help, mentorship, or any
            other kind of support that doesn't fit the beneficiary /
            visitor / volunteer buckets. Own standalone page because
            the form needs description + up to 10 file attachments. */}
        <button
          type="button"
          className="service-card service-card--support"
          onClick={() => goWithIntercept('support', '/project-support')}
          style={{
            borderColor: '#c4b5fd',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04), rgba(109, 40, 217, 0.02))'
          }}
        >
          <div className="service-card-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <div className="service-card-body">
            <div className="service-card-title">{isRTL ? 'طلب دعم للمشروع' : 'Project Support Request'}</div>
            <div className="service-card-description">
              {isRTL
                ? 'اطلب تمويلاً أو رعاية لمشروعك أو دعماً لمشاركتك في مسابقة — تصلك الإجابة خلال 5 أيام عمل'
                : 'Request funding or sponsorship for your project or a competition entry — decision within 5 working days'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">{isRTL ? '←' : '→'}</div>
        </button>

        {/* Workshops */}
        <button
          type="button"
          className="service-card service-card--workshop"
          onClick={() => navigate('/workshop')}
        >
          <div className="service-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div className="service-card-body">
            <div className="service-card-title">{isRTL ? 'الورش التدريبية' : 'Training Workshops'}</div>
            <div className="service-card-description">
              {isRTL ? 'سجّل في ورش الإلكترونيات، الطباعة ثلاثية الأبعاد والمزيد' : 'Sign up for electronics, 3D printing and more'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">{isRTL ? '←' : '→'}</div>
        </button>

        {/* Education */}
        <button
          type="button"
          className={`service-card service-card--education${showEducationOptions ? ' is-active' : ''}`}
          onClick={() => setShowEducationOptions(!showEducationOptions)}
          aria-expanded={showEducationOptions}
        >
          <div className="service-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <div className="service-card-body">
            <div className="service-card-title">{isRTL ? 'التعليم' : 'Education'}</div>
            <div className="service-card-description">
              {isRTL ? 'تسجيل المعلمين والطلاب وإدارة الحضور' : 'Teacher and student registration, attendance management'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showEducationOptions ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </button>

        {/* Elite */}
        <button
          type="button"
          className="service-card service-card--elite"
          onClick={() => setShowEliteModal(true)}
        >
          <div className="service-card-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="service-card-body">
            <div className="service-card-title">{isRTL ? 'النخبة' : 'Elite'}</div>
            <div className="service-card-description">
              {isRTL ? 'برنامج النخبة للمميزين — تسجيل بكلمة مرور' : 'Elite program for top members — password protected'}
            </div>
          </div>
          <div className="service-card-arrow" aria-hidden="true">{isRTL ? '←' : '→'}</div>
        </button>
      </motion.div>

      {/* Education sub-options revealed when Education card is clicked */}
      <AnimatePresence>
        {showEducationOptions && (
          <motion.div
            className="service-suboptions"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <motion.button
              type="button"
              className="service-suboption"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onClick={() => openEducationModal('/educate')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              {isRTL ? 'تسجيل المعلم' : 'Teacher Registration'}
            </motion.button>
            <motion.button
              type="button"
              className="service-suboption"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => openEducationModal('/educate/students')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {isRTL ? 'تسجيل الطلاب' : 'Student Registration'}
            </motion.button>
            <motion.button
              type="button"
              className="service-suboption"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onClick={() => openEducationModal('/educate/attendance')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              {isRTL ? 'حضور الطلاب' : 'Student Attendance'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================
          Contact strip — three clickable actions (WhatsApp, email,
          phone) that hand off to the customer's device apps directly.
          ============================================================ */}
      <div className="contact-strip" aria-label={isRTL ? 'تواصل معنا' : 'Contact us'}>
        <div className="contact-strip-title">
          <span className="contact-strip-kicker">
            {isRTL ? 'تواصل معنا' : 'CONTACT US'}
          </span>
          <p>
            {isRTL
              ? 'لأي استفسار أو مساعدة، تواصل معنا مباشرة'
              : 'For any question or help, reach out directly'}
          </p>
        </div>
        <div className="contact-strip-actions">
          {/* WhatsApp — wa.me deep link with Saudi country code (966).
              Number given: 55 502 2605 → 0555022605 → 966555022605 */}
          <a
            className="contact-btn contact-btn--wa"
            href="https://wa.me/966555022605"
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp"
          >
            <span className="contact-btn-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </span>
            <div className="contact-btn-body">
              <span className="contact-btn-label">
                {isRTL ? 'واتساب' : 'WhatsApp'}
              </span>
              <span className="contact-btn-value" dir="ltr">+966 55 502 2605</span>
            </div>
          </a>

          {/* Email — mailto: hands off to the user's mail client */}
          <a
            className="contact-btn contact-btn--email"
            href="mailto:fablabspec@fablabsahsa.com"
            title="Email"
          >
            <span className="contact-btn-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </span>
            <div className="contact-btn-body">
              <span className="contact-btn-label">
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </span>
              <span className="contact-btn-value" dir="ltr">fablabspec@fablabsahsa.com</span>
            </div>
          </a>

          {/* Phone — tel: launches the dialer on mobile, VoIP app on desktop */}
          <a
            className="contact-btn contact-btn--phone"
            href="tel:+966135840004"
            title={isRTL ? 'اتصل بنا' : 'Call us'}
          >
            <span className="contact-btn-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </span>
            <div className="contact-btn-body">
              <span className="contact-btn-label">
                {isRTL ? 'الهاتف' : 'Phone'}
              </span>
              <span className="contact-btn-value" dir="ltr">+966 13 584 0004</span>
            </div>
          </a>
        </div>
      </div>

      {/* Education Password Modal */}
      <AnimatePresence>
        {showEducationModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEducationModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #5b21b6, #7c3aed)',
                borderRadius: '20px',
                padding: '32px',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <h3 style={{ color: 'white', fontSize: '24px', marginBottom: '8px', fontWeight: '700' }}>
                {isRTL ? 'التعليم' : 'Education'}
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '13px' }}>
                {isRTL ? 'أدخل كلمة المرور للوصول' : 'Enter password to access'}
              </p>
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none'
                  }}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  placeholder={isRTL ? '● ● ● ● ● ●' : '● ● ● ● ● ●'}
                  value={educationPassword}
                  onChange={(e) => setEducationPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleEducationAccess()}
                  style={{
                    width: '100%',
                    padding: '14px 18px 14px 44px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '16px',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={handleEducationAccess}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.5)',
                    padding: '12px 32px',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {isRTL ? 'دخول' : 'Enter'}
                </button>
                <button
                  onClick={() => {
                    setShowEducationModal(false);
                    setEducationPassword('');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.3)',
                    padding: '12px 32px',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elite Password Modal */}
      <AnimatePresence>
        {showEliteModal && (
          <motion.div
            className="elite-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEliteModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <motion.div
              className="elite-modal"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #006c35, #00a651)',
                borderRadius: '20px',
                padding: '32px',
                maxWidth: '400px',
                width: '90%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
              }}
            >
              <div style={{ marginBottom: '20px' }}>
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <h3 style={{ color: 'white', fontSize: '24px', marginBottom: '8px', fontWeight: '700' }}>
                النخبة
              </h3>
              {/* Login Button for Existing Users */}
              <button
                onClick={() => {
                  setShowEliteModal(false);
                  navigate('/elite/login');
                }}
                style={{
                  width: '100%',
                  background: 'white',
                  color: '#006c35',
                  border: 'none',
                  padding: '14px 24px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  marginBottom: '16px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                {isRTL ? 'تسجيل الدخول لحسابي' : 'Login to My Account'}
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '16px 0',
                color: 'rgba(255,255,255,0.7)'
              }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
                <span style={{ fontSize: '13px' }}>{isRTL ? 'أو إنشاء حساب جديد' : 'or create new account'}</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.3)' }}></div>
              </div>

              <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '16px', fontSize: '13px' }}>
                {isRTL ? 'أدخل كلمة المرور للتسجيل' : 'Enter password to register'}
              </p>
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="2"
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none'
                  }}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  type="password"
                  placeholder={isRTL ? '● ● ● ● ● ●' : '● ● ● ● ● ●'}
                  value={elitePassword}
                  onChange={(e) => setElitePassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleEliteAccess()}
                  style={{
                    width: '100%',
                    padding: '14px 18px 14px 44px',
                    borderRadius: '12px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.15)',
                    color: 'white',
                    fontSize: '16px',
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={handleEliteAccess}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.5)',
                    padding: '12px 32px',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {isRTL ? 'تسجيل جديد' : 'Register'}
                </button>
                <button
                  onClick={() => {
                    setShowEliteModal(false);
                    setElitePassword('');
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.3)',
                    padding: '12px 32px',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RegistrationGuide
        open={guide.open}
        intercept={guide.intercept}
        onClose={closeGuide}
        onApply={handleGuideApply}
        isRTL={isRTL}
        theme={theme}
      />
    </div>
  );
};

export default UserLookup;
