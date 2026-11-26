import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import api from '../../config/api';
import { fmtWhen } from './FabFormPage';
import './FabFormPage.css';

// "Will you attend?" — opened from a FabLab form's event reminder email
// (/forms/attend/:token?a=yes|no). The email's button only pre-selects the
// answer; the person confirms it here with one tap.

const T = {
  ar: {
    brand: 'فاب لاب الأحساء', brandSub: 'مركز تنمية الإبداع والابتكار',
    ask: 'هل ستحضر؟', hello: (n) => (n ? `مرحبًا ${n}` : 'مرحبًا'), ref: 'رقم التسجيل', when: 'الموعد',
    yes: 'نعم، سأحضر', no: 'أعتذر عن الحضور', tapToConfirm: 'اضغط على اختيارك للتأكيد',
    savedYes: 'تم تأكيد حضورك — نراك في الموعد!', savedNo: 'تم تسجيل اعتذارك، شكرًا لإبلاغنا.',
    current: { yes: 'ردّك الحالي: سأحضر', no: 'ردّك الحالي: أعتذر' }, change: 'يمكنك تغيير ردّك حتى بداية الفعالية.',
    locked: 'بدأت الفعالية، ولا يمكن تعديل الرد الآن.', invalid: 'الرابط غير صحيح', invalidText: 'تأكد من الرابط في رسالة التذكير.',
    error: 'تعذّر الحفظ، حاول مرة أخرى.', home: 'زيارة موقع فاب لاب', lang: 'English'
  },
  en: {
    brand: 'FabLab Al-Ahsa', brandSub: 'Creativity & Innovation Center',
    ask: 'Will you attend?', hello: (n) => (n ? `Hello ${n}` : 'Hello'), ref: 'Registration', when: 'When',
    yes: "Yes, I'll attend", no: "I can't attend", tapToConfirm: 'Tap your answer to confirm',
    savedYes: 'Your attendance is confirmed — see you there!', savedNo: 'Thanks for letting us know you can’t make it.',
    current: { yes: 'Your answer: attending', no: 'Your answer: not attending' }, change: 'You can change your answer until the event starts.',
    locked: 'The event has started; the answer can no longer be changed.', invalid: 'Invalid link', invalidText: 'Check the link in the reminder email.',
    error: 'Could not save — please try again.', home: 'Visit the FabLab website', lang: 'العربية'
  }
};

const FabFormAttend = () => {
  const { token } = useParams();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const t = T[lang];
  const isRTL = lang === 'ar';
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | invalid
  const [pick] = useState(() => new URLSearchParams(window.location.search).get('a'));
  const [saving, setSaving] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    let alive = true;
    api.get(`/forms/attend/${encodeURIComponent(token)}`)
      .then(({ data: d }) => { if (alive) { setData(d); setState('ready'); } })
      .catch(() => { if (alive) setState('invalid'); });
    return () => { alive = false; };
  }, [token]);

  const answer = async (a) => {
    setSaving(a); setError('');
    try {
      const { data: d } = await api.post(`/forms/attend/${encodeURIComponent(token)}`, { answer: a });
      setData(d); setSaved(a);
    } catch (err) {
      const d = err.response?.data;
      setError((isRTL ? d?.messageAr : d?.message) || t.error);
    } finally { setSaving(''); }
  };

  const title = data ? ((lang === 'en' && data.titleEn) || data.title) : '';
  const highlight = saved || (['yes', 'no'].includes(pick) ? pick : data?.attendance);

  return (
    <div className="ffp" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="ffp-bg" aria-hidden="true"><i /><i /><i /></div>
      <header className="ffp-top">
        <a className="ffp-brand" href="/">
          <span className="ffp-logo"><img src="/fablab.png" alt="" /></span>
          <span className="ffp-brand-text"><strong>{t.brand}</strong><small>{t.brandSub}</small></span>
        </a>
        <button type="button" className="ffp-lang" onClick={() => i18n.changeLanguage(isRTL ? 'en' : 'ar')}>{t.lang}</button>
      </header>
      <main className="ffp-main">
        {state === 'loading' && <div className="ffp-skeleton" aria-busy="true"><div className="ffp-sk ffp-sk-hero" /></div>}
        {state === 'invalid' && (
          <div className="ffp-status muted">
            <div className="ffp-status-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg></div>
            <h1>{t.invalid}</h1>
            <p>{t.invalidText}</p>
            <a className="ffp-btn ghost" href="/">{t.home}</a>
          </div>
        )}
        {state === 'ready' && data && (
          <motion.div className={`ffp-status ${saved === 'yes' ? 'green' : saved === 'no' ? 'muted' : 'amber'}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="ffp-status-icon" aria-hidden="true">
              {saved === 'yes'
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2.5" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
            </div>
            <h1>{saved ? (saved === 'yes' ? t.savedYes : t.savedNo) : t.ask}</h1>
            <p>{t.hello(data.name)} — <b>{title}</b></p>
            <div className="ffp-attend-meta">
              {data.eventStartsAt && <span><small>{t.when}</small><b>{fmtWhen(data.eventStartsAt, lang)}</b></span>}
              <span><small>{t.ref}</small><b dir="ltr">{data.reference}</b></span>
            </div>
            {data.locked ? <p className="ffp-attend-note">{t.locked}</p> : (
              <>
                {!saved && <p className="ffp-attend-note">{t.tapToConfirm}</p>}
                <div className="ffp-attend-btns">
                  <button type="button" className={`ffp-btn ${highlight === 'yes' ? 'yes on' : 'ghost'}`} onClick={() => answer('yes')} disabled={!!saving}>
                    {saving === 'yes' ? <span className="ffp-spin" aria-hidden="true" /> : '✓'} {t.yes}
                  </button>
                  <button type="button" className={`ffp-btn ${highlight === 'no' ? 'no on' : 'ghost'}`} onClick={() => answer('no')} disabled={!!saving}>
                    {saving === 'no' ? <span className="ffp-spin" aria-hidden="true" /> : '✕'} {t.no}
                  </button>
                </div>
                {data.attendance && !saved && <p className="ffp-attend-note">{t.current[data.attendance]} · {t.change}</p>}
              </>
            )}
            {error && <div className="ffp-banner" role="alert">{error}</div>}
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default FabFormAttend;
