import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import api from '../../../config/api';
import '../RegistrationGuide.css';

// "Entity" (كيان) registrations are invite-only: the server checks an
// access password and returns a short-lived token that goes with the
// registration.
const EntityPasswordDialog = ({ theme, isRTL, onUnlock, onClose }) => {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/registration/entity-access', { password });
      onUnlock(data.token);
    } catch (err) {
      const d = err.response?.data;
      setError((isRTL ? d?.messageAr : d?.message) || (isRTL ? 'تعذّر التحقق — حاول مرة أخرى' : 'Could not verify — please try again'));
      setPassword('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="rg-overlay" data-theme={theme === 'light' ? 'light' : 'dark'} dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}>
      <motion.form
        className="ent-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ent-title"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <div className="ent-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h3 id="ent-title" className="ent-title">{isRTL ? 'التسجيل ككيان' : 'Register as an Entity'}</h3>
        <p className="ent-text">
          {isRTL
            ? 'هذا النوع مخصص للجهات المتعاونة مع فاب لاب. أدخل كلمة المرور التي زوّدتك بها إدارة فاب لاب للمتابعة.'
            : 'This type is for organisations partnering with FabLab. Enter the password provided by the FabLab team to continue.'}
        </p>
        <div className={`ent-field ${error ? 'has-error' : ''}`}>
          <input
            ref={inputRef}
            type={show ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            placeholder={isRTL ? 'كلمة المرور' : 'Password'}
            autoComplete="off"
            dir="ltr"
            aria-invalid={!!error}
          />
          <button type="button" className="ent-eye" onClick={() => setShow(v => !v)} aria-label={show ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'إظهار' : 'Show')}>
            {show ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
        </div>
        {error && <div className="ent-error" role="alert">{error}</div>}
        <div className="ent-actions">
          <button type="button" className="ent-btn ghost" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button type="submit" className="ent-btn primary" disabled={!password.trim() || busy}>
            {busy ? (isRTL ? 'جارٍ التحقق…' : 'Checking…') : (isRTL ? 'متابعة' : 'Continue')}
          </button>
        </div>
      </motion.form>
    </div>,
    document.body
  );
};

const ApplicationType = ({ formData, onChange, onNext, theme }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [entityPrompt, setEntityPrompt] = useState(null); // 'select' | 'next' | null

  const applicationTypes = [
    {
      value: 'Beneficiary',
      label: t('beneficiary'),
      labelAr: 'مستفيد',
      descriptionAr: 'الشخص الذي يستخدم مرافق وخدمات فاب لاب لتنفيذ مشروع شخصي أو للحصول على استشارة تقنية.',
      descriptionEn: 'A person who uses FABLAB facilities and services to build a personal project or receive technical consultation.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      )
    },
    {
      value: 'Visitor',
      label: t('visitor'),
      labelAr: 'زائر',
      descriptionAr: 'الشخص الذي يرغب بحضور فعالية أو نشاط أو ورشة عمل ينظمها فاب لاب.',
      descriptionEn: 'A person attending an event, activity, or workshop hosted at FABLAB.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      )
    },
    {
      value: 'Volunteer',
      label: t('volunteer'),
      labelAr: 'متطوع',
      descriptionAr: 'من يرغب بالمساهمة في فعاليات وخدمات فاب لاب من خلال العمل التطوعي بمجال يتناسب مع مهاراته.',
      descriptionEn: 'Someone who wants to contribute to FABLAB events and services through volunteer work matching their skills.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
        </svg>
      )
    },
    {
      value: 'Talented',
      label: t('talented'),
      labelAr: 'موهوب',
      descriptionAr: 'الطالب أو المتدرب المميز الذي يمتلك مهارات متقدمة ويرغب في تطوير مشاريع إبداعية بدعم من فاب لاب.',
      descriptionEn: 'A distinguished student or trainee with advanced skills who wants to develop creative projects with FABLAB support.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      )
    },
    {
      value: 'Entity',
      label: t('entity'),
      labelAr: 'كيان',
      descriptionAr: 'الجهات الحكومية أو الشركات أو الجمعيات التي ترغب بالتعاون مع فاب لاب في مشاريع أو فعاليات.',
      descriptionEn: 'Government agencies, companies, or associations wishing to partner with FABLAB on projects or events.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
          <path d="M10 6h4"/>
          <path d="M10 10h4"/>
          <path d="M10 14h4"/>
          <path d="M10 18h4"/>
        </svg>
      )
    }
  ];

  const entityUnlocked = !!formData.entityAccessToken;

  const handleSelect = (type) => {
    if (type === 'Entity' && !entityUnlocked) {
      setEntityPrompt('select');
      return;
    }
    onChange({ applicationType: type });
  };

  // Entity can arrive pre-selected (returning user, the guide, a saved
  // draft) — ask for the password before moving on.
  const handleNext = () => {
    if (formData.applicationType === 'Entity' && !entityUnlocked) {
      setEntityPrompt('next');
      return;
    }
    onNext();
  };

  // Entity already chosen (returning Entity user, the guide, a draft)
  // but not unlocked this visit → ask right away.
  useEffect(() => {
    if (formData.applicationType === 'Entity' && !formData.entityAccessToken) setEntityPrompt('next');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlock = (token) => {
    const thenNext = entityPrompt === 'next';
    setEntityPrompt(null);
    onChange({ applicationType: 'Entity', entityAccessToken: token });
    if (thenNext) onNext();
  };

  const canProceed = formData.applicationType !== '';

  return (
    <div>
      <h2 className="step-title">
        {isRTL ? 'نوع الطلب' : 'Application Type'}
      </h2>
      <p className="step-description">
        {isRTL ? 'اختر نوع التسجيل الذي يناسبك — كل بطاقة توضح المستهدفين منها' : 'Select the registration type that suits you — each card explains who it\'s for'}
      </p>

      <div className="selection-grid selection-grid--with-desc">
        {applicationTypes.map((type, index) => (
          <motion.div
            key={type.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`selection-card selection-card--with-desc ${formData.applicationType === type.value ? 'selected' : ''}`}
            onClick={() => handleSelect(type.value)}
          >
            <div className="selection-card-icon">
              {type.icon}
            </div>
            <div className="selection-card-title">
              {isRTL ? type.labelAr : type.label}
              {type.value === 'Entity' && (
                <span className="ent-lock-tag" title={isRTL ? 'يتطلب كلمة مرور' : 'Password required'}>
                  {entityUnlocked ? '🔓' : '🔒'}
                </span>
              )}
            </div>
            <div className="selection-card-description">
              {isRTL ? type.descriptionAr : type.descriptionEn}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="form-navigation">
        <div />
        <button
          className="btn btn-primary"
          onClick={handleNext}
          disabled={!canProceed}
        >
          {t('next')}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>

      {entityPrompt && (
        <EntityPasswordDialog
          theme={theme}
          isRTL={isRTL}
          onUnlock={handleUnlock}
          onClose={() => setEntityPrompt(null)}
        />
      )}
    </div>
  );
};

export default ApplicationType;
