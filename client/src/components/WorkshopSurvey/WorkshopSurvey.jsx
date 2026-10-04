import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';
import './WorkshopSurvey.css';

// Public post-workshop survey, reached from the per-student link
// (/workshop-survey/:token). Submitting it is what releases the
// certificate — the server emails it right away when attendance is
// already enough.
const FACES = ['😞', '🙁', '😐', '🙂', '😍'];

const WorkshopSurvey = () => {
  const { token } = useParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
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

  const header = (
    <header className="wsurvey-head" style={data?.workshop?.color ? { '--ws-accent': data.workshop.color } : undefined}>
      <div className="wsurvey-logos">
        <img src="/fablab.png" alt="FabLab" />
        <img src="/found.png" alt="Foundation" />
      </div>
      <span className="wsurvey-kicker">{isRTL ? 'استبيان الورشة' : 'Workshop survey'}</span>
      {data?.workshop && (
        <>
          <h1>{data.workshop.title}</h1>
          <p className="wsurvey-meta">
            {data.workshop.presenter && <span>{isRTL ? 'المدرب:' : 'Trainer:'} {data.workshop.presenter}</span>}
            {data.workshop.startDate && (
              <span dir="ltr">{fmtDate(data.workshop.startDate)}{data.workshop.endDate && data.workshop.endDate !== data.workshop.startDate ? ` – ${fmtDate(data.workshop.endDate)}` : ''}</span>
            )}
          </p>
        </>
      )}
      <button type="button" className="wsurvey-lang" onClick={() => i18n.changeLanguage(isRTL ? 'en' : 'ar')}>
        {isRTL ? 'English' : 'العربية'}
      </button>
    </header>
  );

  const notice = (icon, title, text, tone = 'info') => (
    <div className={`wsurvey-notice ${tone}`}>
      <div className="wsurvey-notice-icon" aria-hidden="true">{icon}</div>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );

  let body;
  if (loadError) {
    body = loadError === 'invalid'
      ? notice('🔗', isRTL ? 'رابط الاستبيان غير صالح' : 'This survey link is not valid', isRTL ? 'تأكد من فتح الرابط كاملاً كما وصلك في البريد، أو تواصل مع فاب لاب.' : 'Make sure you opened the full link from your email, or contact FabLab.', 'error')
      : notice('⚠️', isRTL ? 'تعذّر تحميل الاستبيان' : 'Could not load the survey', isRTL ? 'تحقق من اتصالك ثم أعد تحميل الصفحة.' : 'Check your connection and reload the page.', 'error');
  } else if (!data) {
    body = <div className="wsurvey-loading"><span className="wsurvey-spinner" />{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>;
  } else if (result && result.preview) {
    body = notice('👁', isRTL ? 'انتهت المعاينة' : 'End of preview',
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
    body = notice('🎓', isRTL ? 'شكراً لك! تم استلام الاستبيان' : 'Thank you! Your survey was received', text, 'success');
  } else if (data.submitted) {
    body = notice('✅', isRTL ? 'سبق أن عبّأت هذا الاستبيان' : 'You have already filled in this survey',
      data.certificateSent
        ? (isRTL ? 'أُرسلت شهادتك إلى بريدك الإلكتروني.' : 'Your certificate was emailed to you.')
        : (isRTL ? 'شكراً لمشاركتك رأيك.' : 'Thank you for your feedback.'), 'success');
  } else if (!data.isOpen) {
    body = notice('🗓️', isRTL ? 'لم يُفتح الاستبيان بعد' : 'The survey is not open yet',
      isRTL ? `يُتاح الاستبيان من يوم بدء الورشة (${fmtDate(data.opensOn)}).` : `The survey opens on the workshop's start day (${fmtDate(data.opensOn)}).`);
  } else {
    body = (
      <>
        {data.preview && (
          <div className="wsurvey-preview">
            👁 {isRTL ? 'وضع المعاينة — هكذا يرى الطالب الاستبيان، ولا تُحفظ الإجابات.' : 'Preview mode — this is what students see; answers are not saved.'}
          </div>
        )}
        <div className="wsurvey-intro">
          <p>
            {isRTL ? `مرحباً ${data.student.firstName || ''} 👋` : `Hi ${data.student.firstName || ''} 👋`}
          </p>
          <p>
            {isRTL
              ? 'رأيك يساعدنا على تطوير ورشنا. يستغرق الاستبيان دقيقتين تقريباً، وبعد إرساله تُصدر شهادة إتمام الورشة.'
              : 'Your feedback helps us improve our workshops. It takes about two minutes, and your certificate is issued once you submit it.'}
          </p>
        </div>

        <div className="wsurvey-progress" aria-hidden="true">
          <div className="wsurvey-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <ol className="wsurvey-questions">
          {data.questions.map((q, i) => (
            <motion.li
              key={q.id}
              id={`q-${q.id}`}
              className={`wsurvey-q ${isMissing(q) ? 'missing' : ''}`}
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
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === n}
                      className={`wsurvey-rate ${answers[q.id] === n ? 'on' : ''}`}
                      onClick={() => setAnswer(q.id, n)}
                      title={(isRTL ? data.ratingLabels.ar : data.ratingLabels.en)[n - 1]}
                    >
                      <span className="wsurvey-face">{FACES[n - 1]}</span>
                      <span className="wsurvey-rate-n">{n}</span>
                    </button>
                  ))}
                  <div className="wsurvey-rating-caption">
                    {answers[q.id]
                      ? (isRTL ? data.ratingLabels.ar : data.ratingLabels.en)[answers[q.id] - 1]
                      : <><span>{(isRTL ? data.ratingLabels.ar : data.ratingLabels.en)[0]}</span><span>{(isRTL ? data.ratingLabels.ar : data.ratingLabels.en)[4]}</span></>}
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
                      className={`wsurvey-chip ${answers[q.id] === o.v ? 'on' : ''}`}
                      onClick={() => setAnswer(q.id, answers[q.id] === o.v && !q.required ? undefined : o.v)}
                    >
                      {L(o)}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'text' && (
                <textarea
                  className="wsurvey-text"
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

        {submitError && <div className="wsurvey-submit-error" role="alert">{submitError}</div>}
        <button type="button" className="wsurvey-submit" onClick={submit} disabled={submitting}>
          {submitting
            ? (isRTL ? 'جارٍ الإرسال…' : 'Submitting…')
            : (isRTL ? `إرسال الاستبيان (${answeredRequired}/${required.length})` : `Submit survey (${answeredRequired}/${required.length})`)}
        </button>
      </>
    );
  }

  return (
    <div className="wsurvey-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="wsurvey-card">
        {header}
        <AnimatePresence mode="wait">
          <motion.main
            key={result ? 'done' : data?.submitted ? 'submitted' : loadError || (data ? 'form' : 'loading')}
            className="wsurvey-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {body}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WorkshopSurvey;
