import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../config/api';
import './FabFormPage.css';

// Public FabLab form (/forms/:slug) — our own replacement for Google
// Forms. The admin builds the questions in "نماذج فاب لاب"; the server
// (fabFormController) re-checks every answer. `FormQuestions` is also
// used by the admin editor's preview.

const T = {
  ar: {
    brand: 'فاب لاب الأحساء',
    brandSub: 'مركز تنمية الإبداع والابتكار',
    required: 'مطلوب',
    requiredNote: 'الحقول المعلَّمة بـ * إلزامية',
    optional: 'اختياري',
    submit: 'إرسال',
    sending: 'جارٍ الإرسال…',
    choose: 'اختر…',
    words: (n, max) => `${n} / ${max} كلمة`,
    tooManyWords: (max) => `لا يتجاوز ${max} كلمة`,
    badEmail: 'بريد إلكتروني غير صحيح',
    badPhone: 'رقم جوال غير صحيح',
    badNumber: 'يجب أن يكون رقمًا',
    min: (n) => `الحد الأدنى ${n}`,
    max: (n) => `الحد الأعلى ${n}`,
    fixErrors: 'يرجى مراجعة الحقول المعلَّمة باللون الأحمر',
    progress: (a, b) => `${a} من ${b} إلزامي`,
    closesAt: 'يُغلق في',
    doneTitle: 'تم الإرسال بنجاح',
    doneDefault: 'شكرًا لك، وصلتنا إجابتك.',
    reference: 'رقم التسجيل',
    keepRef: 'احتفظ بهذا الرقم للمراجعة.',
    home: 'زيارة موقع فاب لاب',
    closedTitle: 'النموذج غير متاح حاليًا',
    notYetTitle: 'لم يُفتح النموذج بعد',
    opensAt: 'يُفتح في',
    notFoundTitle: 'النموذج غير موجود',
    notFoundText: 'تأكد من الرابط أو تواصل مع فاب لاب الأحساء.',
    errorTitle: 'تعذّر تحميل النموذج',
    errorText: 'تحقق من اتصالك ثم أعد المحاولة.',
    retry: 'إعادة المحاولة',
    tooMany: 'محاولات كثيرة، حاول بعد قليل.',
    sendFailed: 'تعذّر الإرسال، حاول مرة أخرى.',
    lang: 'English'
  },
  en: {
    brand: 'FabLab Al-Ahsa',
    brandSub: 'Creativity & Innovation Center',
    required: 'Required',
    requiredNote: 'Fields marked * are required',
    optional: 'Optional',
    submit: 'Submit',
    sending: 'Sending…',
    choose: 'Choose…',
    words: (n, max) => `${n} / ${max} words`,
    tooManyWords: (max) => `At most ${max} words`,
    badEmail: 'Invalid email address',
    badPhone: 'Invalid phone number',
    badNumber: 'Must be a number',
    min: (n) => `At least ${n}`,
    max: (n) => `At most ${n}`,
    fixErrors: 'Please check the fields marked in red',
    progress: (a, b) => `${a} of ${b} required`,
    closesAt: 'Closes',
    doneTitle: 'Submitted successfully',
    doneDefault: 'Thank you — we received your answers.',
    reference: 'Reference',
    keepRef: 'Keep this number for follow-up.',
    home: 'Visit the FabLab website',
    closedTitle: 'This form is not available',
    notYetTitle: 'This form is not open yet',
    opensAt: 'Opens',
    notFoundTitle: 'Form not found',
    notFoundText: 'Check the link or contact FabLab Al-Ahsa.',
    errorTitle: 'Could not load the form',
    errorText: 'Check your connection and try again.',
    retry: 'Try again',
    tooMany: 'Too many attempts — try again shortly.',
    sendFailed: 'Could not send — please try again.',
    lang: 'العربية'
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d{8,15}$/;
const toLatinDigits = (s) => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const countWords = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const isEmpty = (v) => v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);

export const fmtWhen = (d, lang) => (d ? new Date(d).toLocaleString(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
  timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit'
}) : '');

// Which fields are shown for these answers (showIf on an earlier choice).
export const visibleFields = (fields, answers) => {
  const shown = [];
  const seen = {};
  for (const f of fields || []) {
    let ok = true;
    if (f.showIf) {
      const a = seen[f.showIf.field];
      ok = Array.isArray(a) ? a.includes(f.showIf.value) : a === f.showIf.value;
    }
    if (ok) {
      shown.push(f);
      if (f.type !== 'section') seen[f.id] = answers[f.id];
    }
  }
  return shown;
};

// One field's problem (mirrors server/utils/fabForms.js cleanAnswers), or null.
export const checkField = (f, v, t) => {
  if (f.type === 'section') return null;
  const val = typeof v === 'string' ? v.trim() : v;
  if (isEmpty(val)) return f.required ? t.required : null;
  switch (f.type) {
    case 'short':
    case 'paragraph':
      return f.maxWords && countWords(val) > f.maxWords ? t.tooManyWords(f.maxWords) : null;
    case 'email':
      return EMAIL_RE.test(val) ? null : t.badEmail;
    case 'phone':
      return PHONE_RE.test(toLatinDigits(val).replace(/[\s()-]/g, '')) ? null : t.badPhone;
    case 'number': {
      const n = Number(toLatinDigits(val));
      if (!Number.isFinite(n)) return t.badNumber;
      if (f.min != null && n < f.min) return t.min(f.min);
      if (f.max != null && n > f.max) return t.max(f.max);
      return null;
    }
    default:
      return null;
  }
};

const TICK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;

// The questions themselves (public page + admin preview).
export const FormQuestions = ({ fields, answers, errors = {}, onChange, lang = 'ar', disabled = false }) => {
  const t = T[lang] || T.ar;
  const shown = visibleFields(fields, answers);
  let qn = 0;
  return (
    <div className="ffp-questions">
      <AnimatePresence initial={false}>
        {shown.map((f) => {
          if (f.type === 'section') {
            return (
              <motion.section key={f.id} className="ffp-section" layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                <h2>{f.label}</h2>
                {f.help && <p>{f.help}</p>}
              </motion.section>
            );
          }
          qn += 1;
          const v = answers[f.id];
          const err = errors[f.id];
          const set = (val) => onChange(f.id, val);
          const name = `q-${f.id}`;
          return (
            <motion.div
              key={f.id}
              id={name}
              className={`ffp-q${err ? ' has-error' : ''}${f.type === 'consent' ? ' is-consent' : ''}`}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.22 }}
            >
              {f.type !== 'consent' && (
                <label className="ffp-label" htmlFor={['radio', 'checkbox'].includes(f.type) ? undefined : `${name}-in`}>
                  <span className="ffp-qn">{qn}</span>
                  <span className="ffp-label-text">
                    {f.label}
                    {f.required ? <b className="ffp-req" aria-label={t.required}>*</b> : <em className="ffp-opt">{t.optional}</em>}
                  </span>
                </label>
              )}
              {f.help && f.type !== 'consent' && <p className="ffp-help">{f.help}</p>}

              {['short', 'email', 'phone', 'number'].includes(f.type) && (
                <input
                  id={`${name}-in`}
                  className="ffp-input"
                  type={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text'}
                  inputMode={f.type === 'number' ? 'decimal' : f.type === 'phone' ? 'tel' : f.type === 'email' ? 'email' : undefined}
                  dir={['email', 'phone', 'number'].includes(f.type) ? 'ltr' : undefined}
                  autoComplete={f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : undefined}
                  placeholder={f.placeholder || ''}
                  value={v ?? ''}
                  onChange={(e) => set(e.target.value)}
                  disabled={disabled}
                  aria-invalid={!!err}
                />
              )}
              {f.type === 'paragraph' && (
                <textarea
                  id={`${name}-in`}
                  className="ffp-input ffp-textarea"
                  rows={4}
                  placeholder={f.placeholder || ''}
                  value={v ?? ''}
                  onChange={(e) => set(e.target.value)}
                  disabled={disabled}
                  aria-invalid={!!err}
                />
              )}
              {['short', 'paragraph'].includes(f.type) && f.maxWords ? (
                <div className={`ffp-words${countWords(v) > f.maxWords ? ' over' : ''}`}>{t.words(countWords(v), f.maxWords)}</div>
              ) : null}
              {f.type === 'date' && (
                <input id={`${name}-in`} className="ffp-input ffp-narrow" type="date" value={v ?? ''} onChange={(e) => set(e.target.value)} disabled={disabled} aria-invalid={!!err} />
              )}
              {f.type === 'time' && (
                <input id={`${name}-in`} className="ffp-input ffp-narrow" type="time" value={v ?? ''} onChange={(e) => set(e.target.value)} disabled={disabled} aria-invalid={!!err} />
              )}
              {f.type === 'dropdown' && (
                <select id={`${name}-in`} className="ffp-input ffp-select" value={v ?? ''} onChange={(e) => set(e.target.value)} disabled={disabled} aria-invalid={!!err}>
                  <option value="">{t.choose}</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {f.type === 'radio' && (
                <div className="ffp-options" role="radiogroup" aria-label={f.label}>
                  {f.options.map(o => (
                    <label key={o} className={`ffp-option${v === o ? ' on' : ''}`}>
                      <input type="radio" name={name} checked={v === o} onChange={() => set(o)} onClick={() => { if (v === o && !f.required) set(''); }} disabled={disabled} />
                      <i className="ffp-dot" aria-hidden="true" />
                      <span>{o}</span>
                    </label>
                  ))}
                </div>
              )}
              {f.type === 'checkbox' && (
                <div className="ffp-options" role="group" aria-label={f.label}>
                  {f.options.map(o => {
                    const list = Array.isArray(v) ? v : [];
                    const on = list.includes(o);
                    return (
                      <label key={o} className={`ffp-option is-box${on ? ' on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => set(on ? list.filter(x => x !== o) : [...list, o])} disabled={disabled} />
                        <i className="ffp-box" aria-hidden="true">{TICK}</i>
                        <span>{o}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {f.type === 'consent' && (
                <label className={`ffp-consent${v ? ' on' : ''}`}>
                  <input type="checkbox" checked={!!v} onChange={() => set(!v)} disabled={disabled} />
                  <i className="ffp-box" aria-hidden="true">{TICK}</i>
                  <span className="ffp-consent-text">
                    <span className="ffp-consent-label">{f.label}{f.required && <b className="ffp-req">*</b>}</span>
                    {f.help && <small>{f.help}</small>}
                    <strong>{f.options?.[0] || (lang === 'ar' ? 'أوافق' : 'I agree')}</strong>
                  </span>
                </label>
              )}

              <AnimatePresence>
                {err && (
                  <motion.p className="ffp-error" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
                    {err}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

const FabFormPage = () => {
  const { slug } = useParams();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ar';
  const t = T[lang];
  const isRTL = lang === 'ar';

  const [state, setState] = useState('loading'); // loading | ready | closed | notfound | error | done
  const [form, setForm] = useState(null);
  const [closed, setClosed] = useState(null); // { reason, message }
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  // A dashboard opened earlier in this tab may have left its theme on
  // <html>; the old global dark rules would restyle this light page.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.getAttribute('data-theme');
    if (prev) root.removeAttribute('data-theme');
    return () => { if (prev && !root.hasAttribute('data-theme')) root.setAttribute('data-theme', prev); };
  }, []);
  useEffect(() => { if (form?.title) document.title = `${form.title} · ${t.brand}`; }, [form, t.brand]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const { data } = await api.get(`/forms/${encodeURIComponent(slug)}`);
      setForm(data.form);
      if (data.closedReason) {
        setClosed({ reason: data.closedReason, message: data.closedMessage });
        setState('closed');
      } else {
        setState('ready');
      }
    } catch (err) {
      setState(err.response?.status === 404 ? 'notfound' : 'error');
    }
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const fields = useMemo(() => form?.fields || [], [form]);
  const shown = useMemo(() => visibleFields(fields, answers), [fields, answers]);
  const requiredShown = shown.filter(f => f.required && f.type !== 'section');
  const requiredDone = requiredShown.filter(f => !isEmpty(typeof answers[f.id] === 'string' ? answers[f.id].trim() : answers[f.id])).length;

  const onChange = (id, val) => {
    setAnswers(prev => {
      const next = { ...prev, [id]: val };
      // Drop answers of questions a change has just hidden.
      const still = new Set(visibleFields(fields, next).map(f => f.id));
      Object.keys(next).forEach(k => { if (!still.has(k)) delete next[k]; });
      return next;
    });
    if (errors[id]) setErrors(e => { const n = { ...e }; delete n[id]; return n; });
    if (banner) setBanner('');
  };

  const scrollToFirst = (errs) => {
    const first = shown.find(f => errs[f.id]);
    if (first) document.getElementById(`q-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    shown.forEach(f => { const m = checkField(f, answers[f.id], t); if (m) errs[f.id] = m; });
    setErrors(errs);
    if (Object.keys(errs).length) { setBanner(t.fixErrors); scrollToFirst(errs); return; }

    const payload = {};
    shown.forEach(f => {
      if (f.type === 'section') return;
      const v = answers[f.id];
      if (f.type === 'consent') payload[f.id] = !!v;
      else if (!isEmpty(v)) payload[f.id] = typeof v === 'string' ? v.trim() : v;
    });

    setSending(true);
    try {
      const { data } = await api.post(`/forms/${encodeURIComponent(slug)}`, { answers: payload });
      setDone(data);
      setState('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const d = err.response?.data || {};
      const status = err.response?.status;
      if (status === 409) {
        setClosed({ reason: d.closedReason || 'inactive', message: lang === 'ar' ? d.messageAr : d.message });
        setState('closed');
      } else if (status === 400 && Array.isArray(d.errors)) {
        const mapped = {};
        d.errors.forEach(x => {
          const f = fields.find(ff => ff.id === x.field);
          const raw = lang === 'ar' ? x.messageAr : x.message;
          const prefix = f ? `${f.label}: ` : '';
          mapped[x.field] = prefix && raw?.startsWith(prefix) ? raw.slice(prefix.length) : raw;
        });
        setErrors(mapped);
        setBanner(t.fixErrors);
        scrollToFirst(mapped);
      } else if (status === 429) {
        setBanner(t.tooMany);
      } else {
        setBanner((lang === 'ar' ? d.messageAr : d.message) || t.sendFailed);
      }
    } finally {
      setSending(false);
    }
  };

  const toggleLang = () => i18n.changeLanguage(isRTL ? 'en' : 'ar');

  const Status = ({ icon, tone, title, text, children }) => (
    <motion.div className={`ffp-status ${tone}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="ffp-status-icon" aria-hidden="true">{icon}</div>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
      {children}
    </motion.div>
  );

  return (
    <div className="ffp" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="ffp-bg" aria-hidden="true"><i /><i /><i /></div>

      <header className="ffp-top">
        <a className="ffp-brand" href="/">
          <span className="ffp-logo"><img src="/fablab.png" alt="" /></span>
          <span className="ffp-brand-text"><strong>{t.brand}</strong><small>{t.brandSub}</small></span>
        </a>
        <button type="button" className="ffp-lang" onClick={toggleLang}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          {t.lang}
        </button>
      </header>

      <main className="ffp-main">
        {state === 'loading' && (
          <div className="ffp-skeleton" aria-busy="true">
            <div className="ffp-sk ffp-sk-hero" />
            <div className="ffp-sk ffp-sk-q" />
            <div className="ffp-sk ffp-sk-q" />
            <div className="ffp-sk ffp-sk-q short" />
          </div>
        )}

        {state === 'notfound' && (
          <Status tone="muted" title={t.notFoundTitle} text={t.notFoundText}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8.5 8.5l5 5M13.5 8.5l-5 5" /></svg>}>
            <a className="ffp-btn ghost" href="/">{t.home}</a>
          </Status>
        )}

        {state === 'error' && (
          <Status tone="muted" title={t.errorTitle} text={t.errorText}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>}>
            <button type="button" className="ffp-btn primary" onClick={load}>{t.retry}</button>
          </Status>
        )}

        {state === 'closed' && (
          <>
            {form && (
              <div className="ffp-hero compact">
                <h1>{form.title}</h1>
              </div>
            )}
            <Status tone="amber"
              title={closed?.reason === 'not_yet' ? t.notYetTitle : t.closedTitle}
              text={closed?.message}
              icon={closed?.reason === 'not_yet'
                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>}>
              {closed?.reason === 'not_yet' && form?.opensAt && (
                <div className="ffp-when"><span>{t.opensAt}</span><b>{fmtWhen(form.opensAt, lang)}</b></div>
              )}
              <a className="ffp-btn ghost" href="/">{t.home}</a>
            </Status>
          </>
        )}

        {state === 'done' && (
          <Status tone="green" title={t.doneTitle}
            text={done?.successMessage || t.doneDefault}
            icon={<motion.svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><motion.path d="M20 6 9 17l-5-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.2 }} /></motion.svg>}>
            {done?.reference && (
              <div className="ffp-ref">
                <span>{t.reference}</span>
                <b dir="ltr">{done.reference}</b>
                <small>{t.keepRef}</small>
              </div>
            )}
            <a className="ffp-btn ghost" href="/">{t.home}</a>
          </Status>
        )}

        {state === 'ready' && form && (
          <form className="ffp-form" onSubmit={submit} noValidate>
            <motion.div className="ffp-hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <span className="ffp-hero-strip" aria-hidden="true" />
              <h1>{form.title}</h1>
              {form.description && <p className="ffp-desc">{form.description}</p>}
              <div className="ffp-meta">
                {requiredShown.length > 0 && <span className="ffp-chip"><b className="ffp-req">*</b> {t.requiredNote}</span>}
                {form.closesAt && <span className="ffp-chip">⏰ {t.closesAt}: {fmtWhen(form.closesAt, lang)}</span>}
              </div>
            </motion.div>

            {requiredShown.length > 0 && (
              <div className="ffp-progress" aria-hidden="true">
                <div className="ffp-progress-bar"><i style={{ width: `${(requiredDone / requiredShown.length) * 100}%` }} /></div>
                <span>{t.progress(requiredDone, requiredShown.length)}</span>
              </div>
            )}

            <FormQuestions fields={fields} answers={answers} errors={errors} onChange={onChange} lang={lang} disabled={sending} />

            <AnimatePresence>
              {banner && (
                <motion.div className="ffp-banner" role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {banner}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="ffp-actions">
              <button type="submit" className="ffp-btn primary big" disabled={sending}>
                {sending ? <><span className="ffp-spin" aria-hidden="true" />{t.sending}</> : <>
                  {t.submit}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d={isRTL ? 'M19 12H5M11 18l-6-6 6-6' : 'M5 12h14M13 6l6 6-6 6'} /></svg>
                </>}
              </button>
            </div>
          </form>
        )}
      </main>

      <footer className="ffp-foot">
        <img src="/found.png" alt="" />
        <span>{isRTL ? 'فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية' : 'FabLab Al-Ahsa — Abdulmonem Al-Rashed Humanitarian Foundation'}</span>
      </footer>
    </div>
  );
};

export default FabFormPage;
