import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Admin editor for the post-workshop survey questions (one list used by
// every workshop). Saving affects surveys submitted from then on; past
// answers keep the questions they were given.
const TYPE_LABELS = {
  rating: { ar: 'تقييم من 1 إلى 5', en: 'Rating 1–5' },
  choice: { ar: 'اختيار من متعدد', en: 'Multiple choice' },
  text: { ar: 'إجابة نصية', en: 'Text answer' }
};

const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const blankQuestion = (type = 'rating') => ({
  id: newId('q'),
  type,
  required: type !== 'text',
  ar: '',
  en: '',
  ...(type === 'choice' ? { options: [{ v: newId('o'), ar: '', en: '' }, { v: newId('o'), ar: '', en: '' }] } : {})
});

const WorkshopSurveyEditor = ({ isRTL, onClose }) => {
  const [questions, setQuestions] = useState(null);
  const [isDefault, setIsDefault] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const L = (o) => (isRTL ? o.ar : o.en);

  useEffect(() => {
    api.get('/workshops/admin/survey')
      .then(res => { setQuestions(res.data.questions); setIsDefault(res.data.isDefault); })
      .catch(err => {
        const d = err?.response?.data;
        setError((isRTL ? d?.messageAr : d?.message) || (isRTL ? 'تعذّر تحميل الاستبيان' : 'Could not load the survey'));
      });
  }, [isRTL]);

  const close = () => {
    if (dirty && !window.confirm(isRTL ? 'لديك تعديلات غير محفوظة — إغلاق دون حفظ؟' : 'You have unsaved changes — close without saving?')) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const update = (fn) => { setQuestions(prev => fn(prev.map(q => ({ ...q, options: q.options ? q.options.map(o => ({ ...o })) : undefined })))); setDirty(true); };
  const patchQ = (i, patch) => update(list => { list[i] = { ...list[i], ...patch }; return list; });
  const move = (i, dir) => update(list => { const j = i + dir; if (j < 0 || j >= list.length) return list; [list[i], list[j]] = [list[j], list[i]]; return list; });
  const removeQ = (i) => {
    if (!window.confirm(isRTL ? 'حذف هذا السؤال؟' : 'Delete this question?')) return;
    update(list => list.filter((_, k) => k !== i));
  };
  const changeType = (i, type) => update(list => {
    const q = list[i];
    list[i] = { ...q, type, options: type === 'choice' ? (q.options && q.options.length ? q.options : blankQuestion('choice').options) : undefined };
    if (type !== 'choice') delete list[i].options;
    return list;
  });
  const patchOpt = (i, k, patch) => update(list => { list[i].options[k] = { ...list[i].options[k], ...patch }; return list; });
  const addOpt = (i) => update(list => { list[i].options.push({ v: newId('o'), ar: '', en: '' }); return list; });
  const removeOpt = (i, k) => update(list => { list[i].options = list[i].options.filter((_, x) => x !== k); return list; });
  const addQ = (type) => update(list => [...list, blankQuestion(type)]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/workshops/admin/survey', { questions });
      setQuestions(data.questions);
      setIsDefault(false);
      setDirty(false);
      toast.success(isRTL ? 'تم حفظ أسئلة الاستبيان' : 'Survey questions saved');
    } catch (err) {
      const d = err?.response?.data;
      toast.error((isRTL ? d?.messageAr : d?.message) || (err?.response?.status === 403
        ? (isRTL ? 'تعديل الاستبيان متاح للمدير فقط' : 'Only managers can edit the survey')
        : (isRTL ? 'تعذّر الحفظ' : 'Could not save')));
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    if (!window.confirm(isRTL ? 'استعادة الأسئلة الافتراضية؟ ستُحذف تعديلاتك على الأسئلة.' : 'Restore the default questions? Your edits will be removed.')) return;
    setSaving(true);
    try {
      const { data } = await api.put('/workshops/admin/survey', { reset: true });
      setQuestions(data.questions);
      setIsDefault(true);
      setDirty(false);
      toast.success(isRTL ? 'تمت استعادة الأسئلة الافتراضية' : 'Default questions restored');
    } catch (err) {
      const d = err?.response?.data;
      toast.error((isRTL ? d?.messageAr : d?.message) || (isRTL ? 'تعذّر الحفظ' : 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <motion.div
        className="modal-content wsr wse"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        role="dialog"
        aria-modal="true"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="wsr-head">
          <div>
            <span className="wsr-kicker">📝 {isRTL ? 'استبيان ما بعد الورشة' : 'Post-workshop survey'}</span>
            <h3>{isRTL ? 'أسئلة الاستبيان' : 'Survey questions'}</h3>
            <p className="wse-note">
              {isRTL
                ? 'يعبّئه الطالب بعد الحضور، وتُصدر الشهادة بعد تعبئته. التعديلات تسري على الاستبيانات الجديدة فقط — الإجابات السابقة تحتفظ بأسئلتها.'
                : 'Students fill it after attending; the certificate is issued once it is submitted. Changes apply to new submissions only — earlier answers keep their questions.'}
            </p>
          </div>
          <button type="button" className="wsr-close" onClick={close} aria-label={isRTL ? 'إغلاق' : 'Close'}>✕</button>
        </div>

        {error && <div className="wsr-empty">{error}</div>}
        {!error && !questions && <div className="wsr-empty">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>}

        {questions && (
          <div className="wsr-body">
            <div className="wse-toolbar">
              <span className={`wse-badge ${isDefault ? '' : 'custom'}`}>
                {isDefault ? (isRTL ? 'الأسئلة الافتراضية' : 'Default questions') : (isRTL ? 'أسئلة معدّلة' : 'Customised questions')}
                {' · '}{questions.length} {isRTL ? 'سؤال' : 'questions'}
              </span>
              <a className="wse-link" href="/workshop-survey/preview" target="_blank" rel="noopener noreferrer">
                👁 {isRTL ? 'معاينة كما يراها الطالب' : 'Preview as a student'}
              </a>
            </div>
            {dirty && (
              <div className="wse-dirty">{isRTL ? 'المعاينة تعرض آخر نسخة محفوظة — احفظ لرؤية تعديلاتك.' : 'The preview shows the last saved version — save to see your edits.'}</div>
            )}

            <ol className="wse-list">
              {questions.map((q, i) => (
                <li key={q.id} className="wse-q">
                  <div className="wse-q-head">
                    <span className="wse-num">{i + 1}</span>
                    <select value={q.type} onChange={e => changeType(i, e.target.value)} aria-label={isRTL ? 'نوع السؤال' : 'Question type'}>
                      {Object.keys(TYPE_LABELS).map(t => <option key={t} value={t}>{L(TYPE_LABELS[t])}</option>)}
                    </select>
                    <label className="wse-req">
                      <input type="checkbox" checked={!!q.required} onChange={e => patchQ(i, { required: e.target.checked })} />
                      {isRTL ? 'إجباري' : 'Required'}
                    </label>
                    <div className="wse-q-tools">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title={isRTL ? 'لأعلى' : 'Move up'}>↑</button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} title={isRTL ? 'لأسفل' : 'Move down'}>↓</button>
                      <button type="button" className="del" onClick={() => removeQ(i)} title={isRTL ? 'حذف' : 'Delete'}>🗑</button>
                    </div>
                  </div>
                  <input className="wse-input" dir="rtl" value={q.ar} onChange={e => patchQ(i, { ar: e.target.value })} placeholder="نص السؤال بالعربية" maxLength={300} />
                  <input className="wse-input" dir="ltr" value={q.en} onChange={e => patchQ(i, { en: e.target.value })} placeholder="Question in English (optional)" maxLength={300} />
                  {q.type === 'choice' && (
                    <div className="wse-opts">
                      {q.options.map((o, k) => (
                        <div key={o.v} className="wse-opt">
                          <span className="wse-opt-dot" />
                          <input dir="rtl" value={o.ar} onChange={e => patchOpt(i, k, { ar: e.target.value })} placeholder={`الخيار ${k + 1}`} maxLength={120} />
                          <input dir="ltr" value={o.en} onChange={e => patchOpt(i, k, { en: e.target.value })} placeholder={`Option ${k + 1}`} maxLength={120} />
                          <button type="button" onClick={() => removeOpt(i, k)} disabled={q.options.length <= 2} title={isRTL ? 'حذف الخيار' : 'Remove option'}>✕</button>
                        </div>
                      ))}
                      {q.options.length < 12 && (
                        <button type="button" className="wse-add-opt" onClick={() => addOpt(i)}>+ {isRTL ? 'إضافة خيار' : 'Add option'}</button>
                      )}
                    </div>
                  )}
                  {q.type === 'rating' && (
                    <div className="wse-hint">{isRTL ? 'يختار الطالب من 1 (غير راضٍ إطلاقاً) إلى 5 (راضٍ جداً).' : 'Students pick 1 (very dissatisfied) to 5 (very satisfied).'}</div>
                  )}
                </li>
              ))}
            </ol>

            <div className="wse-add">
              <span>{isRTL ? 'إضافة سؤال:' : 'Add a question:'}</span>
              {Object.keys(TYPE_LABELS).map(t => (
                <button key={t} type="button" onClick={() => addQ(t)}>+ {L(TYPE_LABELS[t])}</button>
              ))}
            </div>
          </div>
        )}

        <div className="wsr-foot">
          {questions && !isDefault && (
            <button type="button" className="wsr-btn ghost wse-reset" onClick={resetDefaults} disabled={saving}>
              {isRTL ? 'استعادة الافتراضي' : 'Restore defaults'}
            </button>
          )}
          <button type="button" className="wsr-btn ghost" onClick={close}>{isRTL ? 'إغلاق' : 'Close'}</button>
          {questions && (
            <button type="button" className="wsr-btn" onClick={save} disabled={saving || !dirty}>
              {saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ الأسئلة' : 'Save questions')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default WorkshopSurveyEditor;
