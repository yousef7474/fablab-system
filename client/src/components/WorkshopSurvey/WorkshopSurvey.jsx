import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import './WorkshopSurvey.css';

// Public post-workshop survey, reached from the per-student link
// (/workshop-survey/:token). Submitting it is what releases the
// certificate — the server emails it right away when attendance is
// already enough.
const FACES = ['😞', '🙁', '😐', '🙂', '😍'];
const SI = {
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  cal: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  cap: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c3 2 9 2 12 0v-5'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6l-10 7L2 6'],
  check: ['M20 6 9 17l-5-5'],
  link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  alert: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  send: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4 20-7z']
};

const WorkshopSurvey = () => {
  const { token } = useParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [theme, toggleTheme] = useStudioTheme();
  const L = (q) => (isRTL ? q.ar : q.en);

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState({});
  const [showMissing, setShowMissing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get(`/workshops/public/survey/${encodeURIComponent(token)}`)
      .then(res => setData(res.data))
      .catch(err => setLoadError(err?.response?.status === 404 ? 'invalid' : 'failed'));
  }, [token]);

  const required = useMemo(() => (data?.questions || []).filter(q => q.required), [data]);
  const answeredRequired = required.filter(q => answers[q.id] !== undefined && answers[q.id] !== '').length;
  const progress = required.length ? Math.round((answeredRequired / required.length) * 100) : 0;
  const isMissing = (q) => showMissing && q.required && (answers[q.id] === undefined || answers[q.id] === '');

  const setAnswer = (id, value) => setAnswers(prev => ({ ...prev, [id]: value }));

  const submit = async () => {
    if (answeredRequired < required.length) {
      setShowMissing(true);
      const first = required.find(q => answers[q.id] === undefined || answers[q.id] === '');
      document.getElementById(`q-${first?.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (data.preview) {
      // Admin preview: nothing is saved.
      setResult({ preview: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.post(`/workshops/public/survey/${encodeURIComponent(token)}`, { answers });
      setResult(res.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const d = err?.response?.data;
      if (err?.response?.status === 409) {
        setData(prev => ({ ...prev, submitted: true }));
      } else {
        setSubmitError((isRTL ? d?.messageAr : d?.message) || (isRTL ? 'تعذّر الإرسال — حاول مرة أخرى' : 'Could not submit — please try again'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');

  const tx = (ar, en) => (isRTL ? ar : en);

  const hero = (
    <motion.div className="rgx-hero wsurvey-hero" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <p className="rgx-eyebrow"><i aria-hidden="true" />{tx('استبيان الورشة', 'Workshop survey')}</p>
      {data?.workshop ? (
        <>
          <h1><em>{data.workshop.title}</em></h1>
          <p className="wsurvey-meta">
            {data.workshop.presenter && <span><Icon d={SI.user} />{tx('المدرب:', 'Trainer:')} <bdi>{data.workshop.presenter}</bdi></span>}
            {data.workshop.startDate && (
              <span><Icon d={SI.cal} /><bdi dir="ltr">{fmtDate(data.workshop.startDate)}{data.workshop.endDate && data.workshop.endDate !== data.workshop.startDate ? ` – ${fmtDate(data.workshop.endDate)}` : ''}</bdi></span>
            )}
          </p>
        </>
      ) : (
        <h1>{isRTL ? <>رأيك <em>يهمّنا</em></> : <>Your feedback <em>matters</em></>}</h1>
      )}
    </motion.div>
  );

  const notice = (icon, title, text, tone = 'info') => (
    <section className={`rgx-card rgx-closed wsurvey-notice ${tone}`}>
      <span className="rgx-closed-ico"><Icon d={icon} /></span>
      <h2>{title}</h2>
      {text && <p className="rgx-closed-text">{text}</p>}
    </section>
  );

  let body;
  if (loadError) {
    body = loadError === 'invalid'
      ? notice(SI.link, isRTL ? 'رابط الاستبيان غير صالح' : 'This survey link is not valid', isRTL ? 'تأكد من فتح الرابط كاملاً كما وصلك في البريد، أو تواصل مع فاب لاب.' : 'Make sure you opened the full link from your email, or contact FabLab.', 'error')
      : notice(SI.alert, isRTL ? 'تعذّر تحميل الاستبيان' : 'Could not load the survey', isRTL ? 'تحقق من اتصالك ثم أعد تحميل الصفحة.' : 'Check your connection and reload the page.', 'error');
  } else if (!data) {
    body = <section className="rgx-card wsurvey-loading"><span className="loading-spinner" />{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</section>;
  } else if (result && result.preview) {
    body = notice(SI.eye, isRTL ? 'انتهت المعاينة' : 'End of preview',
      isRTL ? 'هذه معاينة للاستبيان كما يراه الطالب — لم تُحفظ أي إجابات.' : 'This is a preview of the survey as students see it — no answers were saved.');
  } else if (result) {
    const att = result.attendance || {};
    let text;
    if (result.certificateSent) {
      text = isRTL ? 'أُرسلت شهادة إتمام الورشة إلى بريدك الإلكتروني. تحقق من صندوق الوارد (أو الرسائل غير المرغوب فيها).' : 'Your certificate has been emailed to you. Check your inbox (or spam folder).';
    } else if (result.certificateAlreadySent) {
      text = isRTL ? 'شكراً لمشاركتك رأيك.' : 'Thank you for sharing your feedback.';
    } else if (!att.ok) {
      text = isRTL
        ? `تُصدر الشهادة بعد اكتمال الحضور المطلوب (${att.requiredDays} من ${att.workshopDays} يوم — الحالي: ${att.attendedDays}).`
        : `Your certificate is issued once the required attendance is met (${att.requiredDays} of ${att.workshopDays} days — so far: ${att.attendedDays}).`;
    } else if (!result.hasEmail) {
      text = isRTL ? 'لا يوجد بريد إلكتروني مسجّل لك — يمكنك استلام شهادتك من فاب لاب.' : 'No email is on file for you — you can collect your certificate from FabLab.';
    } else {
      text = isRTL ? 'ستصلك الشهادة على بريدك الإلكتروني قريباً.' : 'Your certificate will be emailed to you shortly.';
    }
    body = notice(SI.cap, isRTL ? 'شكراً لك! تم استلام الاستبيان' : 'Thank you! Your survey was received', text, 'success');
  } else if (data.submitted) {
    body = notice(SI.check, isRTL ? 'سبق أن عبّأت هذا الاستبيان' : 'You have already filled in this survey',
      data.certificateSent
        ? (isRTL ? 'أُرسلت شهادتك إلى بريدك الإلكتروني.' : 'Your certificate was emailed to you.')
        : (isRTL ? 'شكراً لمشاركتك رأيك.' : 'Thank you for your feedback.'), 'success');
  } else if (!data.isOpen) {
    body = notice(SI.cal, isRTL ? 'لم يُفتح الاستبيان بعد' : 'The survey is not open yet',
      isRTL ? `يُتاح الاستبيان من يوم بدء الورشة (${fmtDate(data.opensOn)}).` : `The survey opens on the workshop's start day (${fmtDate(data.opensOn)}).`);
  } else {
    const labels = isRTL ? data.ratingLabels.ar : data.ratingLabels.en;
    body = (
      <section className="rgx-card wsurvey-form">
        {data.preview && (
          <div className="info-banner warning wsurvey-preview">
            <Icon d={SI.eye} />
            <span>{isRTL ? 'وضع المعاينة — هكذا يرى الطالب الاستبيان، ولا تُحفظ الإجابات.' : 'Preview mode — this is what students see; answers are not saved.'}</span>
          </div>
        )}
        <div className="wsurvey-intro">
          <h2 className="step-title">{isRTL ? `مرحباً ${data.student.firstName || ''} 👋` : `Hi ${data.student.firstName || ''} 👋`}</h2>
          <p className="step-description">
            {isRTL
              ? 'رأيك يساعدنا على تطوير ورشنا. يستغرق الاستبيان دقيقتين تقريباً، وبعد إرساله تُصدر شهادة إتمام الورشة.'
              : 'Your feedback helps us improve our workshops. It takes about two minutes, and your certificate is issued once you submit it.'}
          </p>
        </div>

        <div className="wsurvey-progress" aria-hidden="true">
          <div className="wsurvey-progress-bar"><i style={{ width: `${progress}%` }} /></div>
          <span>{answeredRequired}/{required.length}</span>
        </div>

        <ol className="wsurvey-questions">
          {data.questions.map((q, i) => (
            <motion.li
              key={q.id}
              id={`q-${q.id}`}
              className={`wsurvey-q${isMissing(q) ? ' missing' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <div className="wsurvey-q-title">
                <span className="wsurvey-q-num">{i + 1}</span>
                <span>{L(q)}{q.required ? <span className="wsurvey-req" aria-label={isRTL ? 'مطلوب' : 'required'}> *</span> : <span className="wsurvey-opt"> {isRTL ? '(اختياري)' : '(optional)'}</span>}</span>
              </div>

              {q.type === 'rating' && (
                <div className="wsurvey-rating" role="radiogroup" aria-label={L(q)}>
                  <div className="wsurvey-rates">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={answers[q.id] === n}
                        className={`wsurvey-rate${answers[q.id] === n ? ' on' : ''}`}
                        onClick={() => setAnswer(q.id, n)}
                        title={labels[n - 1]}
                      >
                        <span className="wsurvey-face">{FACES[n - 1]}</span>
                        <span className="wsurvey-rate-n">{n}</span>
                      </button>
                    ))}
                  </div>
                  <div className={`wsurvey-rating-caption${answers[q.id] ? ' picked' : ''}`}>
                    {answers[q.id]
                      ? labels[answers[q.id] - 1]
                      : <><span>{labels[0]}</span><span>{labels[4]}</span></>}
                  </div>
                </div>
              )}

              {q.type === 'choice' && (
                <div className="wsurvey-choices" role="radiogroup" aria-label={L(q)}>
                  {q.options.map(o => (
                    <button
                      key={o.v}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === o.v}
                      className={`wsurvey-chip${answers[q.id] === o.v ? ' on' : ''}`}
                      onClick={() => setAnswer(q.id, answers[q.id] === o.v && !q.required ? undefined : o.v)}
                    >
                      {answers[q.id] === o.v && <Icon d={SI.check} />}
                      {L(o)}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  className="form-textarea wsurvey-text"
                  rows={3}
                  maxLength={1000}
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder={isRTL ? 'اكتب هنا…' : 'Type here…'}
                />
              )}

              {isMissing(q) && <div className="wsurvey-q-error">{isRTL ? 'هذا السؤال مطلوب' : 'This question is required'}</div>}
            </motion.li>
          ))}
        </ol>

        {submitError && <div className="info-banner warning" role="alert"><Icon d={SI.alert} /><span>{submitError}</span></div>}
        <div className="form-navigation wsurvey-nav">
          <button type="button" className="btn btn-primary btn-submit" onClick={submit} disabled={submitting}>
            {submitting ? <span className="loading-spinner" /> : <Icon d={SI.send} />}
            {submitting
              ? (isRTL ? 'جارٍ الإرسال…' : 'Submitting…')
              : (isRTL ? `إرسال الاستبيان (${answeredRequired}/${required.length})` : `Submit survey (${answeredRequired}/${required.length})`)}
          </button>
        </div>
      </section>
    );
  }

  const intro = {
    portal: tx('استبيان الورشة', 'Workshop survey'),
    title: isRTL ? <>رأيك يطوّر<br /><em>ورشنا القادمة</em></> : <>Your feedback<br /><em>shapes our workshops</em></>,
    features: [
      { ar: 'دقيقتان تقريبًا لتعبئة الاستبيان', en: 'Takes about two minutes', d: SI.clock },
      { ar: 'تُصدر شهادة الإتمام بعد إرسال الاستبيان', en: 'Your certificate is issued once you submit', d: SI.cap },
      { ar: 'تصل الشهادة إلى بريدك الإلكتروني', en: 'The certificate is emailed to you', d: SI.mail }
    ]
  };

  return (
    <StudioShell
      isRTL={isRTL}
      theme={theme}
      onToggleTheme={toggleTheme}
      intro={intro}
      subtitle={tx('استبيان الورشة', 'Workshop survey')}
    >
      {hero}
      <AnimatePresence mode="wait">
        <motion.div
          key={result ? 'done' : data?.submitted ? 'submitted' : loadError || (data ? 'form' : 'loading')}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </StudioShell>
  );
};

export default WorkshopSurvey;
