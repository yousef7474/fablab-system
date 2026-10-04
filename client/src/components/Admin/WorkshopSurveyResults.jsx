import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../../config/api';

// Admin view of a workshop's post-workshop survey: response rate,
// average per rating question, answer breakdowns, written comments,
// CSV export. With `studentId` it opens on that one student's answers.
const WorkshopSurveyResults = ({ workshopId, studentId, isRTL, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [focusId, setFocusId] = useState(studentId || null);

  useEffect(() => {
    let alive = true;
    api.get(`/workshops/${workshopId}/survey-results`)
      .then(res => { if (alive) setData(res.data); })
      .catch(err => {
        if (!alive) return;
        const d = err?.response?.data;
        setError((isRTL ? d?.messageAr : d?.message) || (isRTL ? 'تعذّر تحميل النتائج' : 'Could not load the results'));
      });
    return () => { alive = false; };
  }, [workshopId, isRTL]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const L = (o) => (isRTL ? o.ar : o.en);
  const ratingLabel = (n) => (data ? (isRTL ? data.ratingLabels.ar : data.ratingLabels.en)[n - 1] : '');

  const stats = useMemo(() => {
    if (!data) return {};
    const out = {};
    for (const q of data.questions) {
      const vals = data.responses.map(r => r.answers[q.id]).filter(v => v !== undefined && v !== '');
      if (q.type === 'rating') {
        const dist = [0, 0, 0, 0, 0];
        vals.forEach(v => { if (v >= 1 && v <= 5) dist[v - 1]++; });
        out[q.id] = { n: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, dist };
      } else if (q.type === 'choice') {
        out[q.id] = { n: vals.length, counts: Object.fromEntries(q.options.map(o => [o.v, vals.filter(v => v === o.v).length])) };
      } else {
        out[q.id] = {
          n: vals.length,
          items: data.responses.filter(r => r.answers[q.id]).map(r => ({ name: r.name, text: r.answers[q.id] }))
        };
      }
    }
    return out;
  }, [data]);

  const overallAvg = useMemo(() => {
    if (!data) return 0;
    const ratingQs = data.questions.filter(q => q.type === 'rating' && stats[q.id]?.n);
    return ratingQs.length ? ratingQs.reduce((a, q) => a + stats[q.id].avg, 0) / ratingQs.length : 0;
  }, [data, stats]);

  const answerText = (q, v) => {
    if (v === undefined || v === '') return '';
    if (q.type === 'rating') return `${v}/5 — ${ratingLabel(v)}`;
    if (q.type === 'choice') { const o = q.options.find(x => x.v === v); return o ? L(o) : v; }
    return v;
  };

  const exportCsv = () => {
    if (!data) return;
    const fmt = (v) => {
      const s = String(v == null ? '' : v).replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };
    const header = [isRTL ? 'الاسم' : 'Name', isRTL ? 'الهاتف' : 'Phone', isRTL ? 'تاريخ الإرسال' : 'Submitted', ...data.questions.map(q => L(q))];
    const rows = data.responses.map(r => [
      r.name, r.phone || '', new Date(r.submittedAt).toLocaleString('en-GB'),
      ...data.questions.map(q => {
        const v = r.answers[q.id];
        if (q.type === 'rating') return v ?? '';
        return answerText(q, v);
      })
    ]);
    const csv = '﻿' + [header, ...rows].map(r => r.map(fmt).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `survey-${(data.workshop.title || 'workshop').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const focused = focusId && data ? data.responses.find(r => r.studentId === focusId) : null;
  const rate = data && data.totals.students ? Math.round((data.totals.responses / data.totals.students) * 100) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-content wsr"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        role="dialog"
        aria-modal="true"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="wsr-head">
          <div>
            <span className="wsr-kicker">📊 {isRTL ? 'نتائج استبيان الورشة' : 'Workshop survey results'}</span>
            <h3>{data?.workshop?.title || '…'}</h3>
          </div>
          <button type="button" className="wsr-close" onClick={onClose} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
        </div>

        {error && <div className="wsr-empty">{error}</div>}
        {!error && !data && <div className="wsr-empty">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>}

        {data && focused && (
          <div className="wsr-body">
            <button type="button" className="wsr-back" onClick={() => setFocusId(null)}>
              {isRTL ? '→ كل النتائج' : '← All results'}
            </button>
            <div className="wsr-person">
              <strong>{focused.name}</strong>
              <span>{new Date(focused.submittedAt).toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB')}</span>
            </div>
            <dl className="wsr-answers">
              {data.questions.map(q => (
                <div key={q.id} className="wsr-answer">
                  <dt>{L(q)}</dt>
                  <dd className={focused.answers[q.id] === undefined ? 'none' : ''}>
                    {focused.answers[q.id] === undefined ? '—' : answerText(q, focused.answers[q.id])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {data && focusId && !focused && (
          <div className="wsr-body">
            <button type="button" className="wsr-back" onClick={() => setFocusId(null)}>
              {isRTL ? '→ كل النتائج' : '← All results'}
            </button>
            <div className="wsr-empty">{isRTL ? 'لم يعبّئ هذا الطالب الاستبيان بعد.' : 'This student has not filled in the survey yet.'}</div>
          </div>
        )}

        {data && !focusId && (
          <div className="wsr-body">
            <div className="wsr-kpis">
              <div className="wsr-kpi">
                <span className="v">{data.totals.responses}<small>/{data.totals.students}</small></span>
                <span className="l">{isRTL ? 'استجابة' : 'Responses'}</span>
              </div>
              <div className="wsr-kpi">
                <span className="v">{rate}%</span>
                <span className="l">{isRTL ? 'نسبة الاستجابة' : 'Response rate'}</span>
              </div>
              <div className="wsr-kpi accent">
                <span className="v">{overallAvg ? overallAvg.toFixed(2) : '—'}<small>/5</small></span>
                <span className="l">{isRTL ? 'متوسط التقييم' : 'Average rating'}</span>
              </div>
            </div>

            {data.totals.responses === 0 ? (
              <div className="wsr-empty">{isRTL ? 'لا توجد استجابات بعد. أرسل الاستبيان للطلاب الحاضرين من زر «إرسال الاستبيان».' : 'No responses yet. Send the survey to attended students with “Send survey”.'}</div>
            ) : (
              <>
                <section className="wsr-section">
                  <h4>{isRTL ? 'التقييمات' : 'Ratings'}</h4>
                  {data.questions.filter(q => q.type === 'rating').map(q => {
                    const st = stats[q.id];
                    return (
                      <div key={q.id} className="wsr-rating">
                        <div className="wsr-rating-top">
                          <span>{L(q)}</span>
                          <b>{st.n ? st.avg.toFixed(2) : '—'}</b>
                        </div>
                        <div className="wsr-meter"><div style={{ width: `${(st.avg / 5) * 100}%` }} /></div>
                        <div className="wsr-dist">
                          {st.dist.map((c, i) => (
                            <span key={i} dir="ltr" title={ratingLabel(i + 1)}>{i + 1}★ · <b>{c}</b></span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </section>

                <section className="wsr-section">
                  <h4>{isRTL ? 'الاختيارات' : 'Choices'}</h4>
                  {data.questions.filter(q => q.type === 'choice').map(q => {
                    const st = stats[q.id];
                    return (
                      <div key={q.id} className="wsr-choice">
                        <div className="wsr-choice-q">{L(q)} <small>({st.n})</small></div>
                        {q.options.map(o => {
                          const c = st.counts[o.v] || 0;
                          const pct = st.n ? Math.round((c / st.n) * 100) : 0;
                          return (
                            <div key={o.v} className="wsr-bar">
                              <span className="wsr-bar-label">{L(o)}</span>
                              <span className="wsr-bar-track"><span style={{ width: `${pct}%` }} /></span>
                              <span className="wsr-bar-val">{c} · {pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </section>

                <section className="wsr-section">
                  <h4>{isRTL ? 'التعليقات' : 'Comments'}</h4>
                  {data.questions.filter(q => q.type === 'text').map(q => (
                    <details key={q.id} className="wsr-texts" open={stats[q.id].n > 0 && stats[q.id].n <= 6}>
                      <summary>{L(q)} <small>({stats[q.id].n})</small></summary>
                      {stats[q.id].items.length === 0
                        ? <p className="wsr-muted">{isRTL ? 'لا توجد إجابات' : 'No answers'}</p>
                        : stats[q.id].items.map((it, i) => (
                          <blockquote key={i}><p>{it.text}</p><cite>— {it.name}</cite></blockquote>
                        ))}
                    </details>
                  ))}
                </section>

                <section className="wsr-section">
                  <h4>{isRTL ? 'المشاركون' : 'Respondents'}</h4>
                  <div className="wsr-people">
                    {data.responses.map(r => (
                      <button key={r.studentId} type="button" className="wsr-chip" onClick={() => setFocusId(r.studentId)}>
                        {r.name}{r.answers.overall ? ` · ${r.answers.overall}★` : ''}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        <div className="wsr-foot">
          {data && data.totals.responses > 0 && (
            <button type="button" className="wsr-btn" onClick={exportCsv}>📥 {isRTL ? 'تصدير CSV' : 'Export CSV'}</button>
          )}
          <button type="button" className="wsr-btn ghost" onClick={onClose}>{isRTL ? 'إغلاق' : 'Close'}</button>
        </div>
      </motion.div>
    </div>
  );
};

export default WorkshopSurveyResults;
