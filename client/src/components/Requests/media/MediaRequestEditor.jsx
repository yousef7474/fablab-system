import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { normalize, analyze, idOf, getPath, setPath, has, fmtMediaNo, statusOf, lastReturn, EDITABLE } from './mediaModel';
import { MEDIA_ROUTES } from './mediaKind';
import { fmtDay, ar, NOTES } from '../../TrainingKits/kitModel';
import { AutoArea, Seg, Portal, useBodyLock, Modal } from '../../TrainingKits/KitParts';
import { uploadFile, printDocument, errorText, compressImage } from '../../TrainingKits/kitApi';
import MediaFormFields from './MediaFormFields';
import { MediaTimeline, StageStrip } from './MediaParts';
import '../../TrainingKits/TrainingKits.css';
import './Media.css';

const clone = (x) => (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));
const R = MEDIA_ROUTES.employee;

/**
 * The employee's media design request (طلب تصميم إعلان) — the paper form
 * «نموذج اعتماد طلب تصميم إعلان» in the system. Saves as you type;
 * «إرسال لفريق التصميم» sends it to the design team (admin dashboard).
 * Editable while a draft or after a reviewer returned it to the employee.
 */
const MediaRequestEditor = ({ api, doc, portalTarget, theme = 'dark', onClose, onSubmitted }) => {
  useBodyLock();
  const [data, setData] = useState(() => normalize(doc.data));
  const [save, setSave] = useState({ state: 'idle', at: null });
  const [busy, setBusy] = useState([]);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const dirty = useRef(false);
  const latest = useRef(data);
  const id = doc.id || doc.requestId;
  const events = useMemo(() => doc.events || [], [doc.events]);

  const A = useMemo(() => analyze(data), [data]);
  const locked = !EDITABLE.includes(doc.status);
  const resend = doc.status === 'returned_employee' || events.length > 0;

  // ── state ──
  const update = useCallback((fn) => {
    setData(prev => { const n = clone(prev); fn(n); return n; });
    dirty.current = true;
  }, []);
  const set = useCallback((path, value) => update(n => setPath(n, path, value)), [update]);
  const val = (path) => { const v = getPath(data, path); return v == null ? '' : v; };

  // ── autosave ──
  const persist = useCallback(async () => {
    if (!dirty.current) return true;
    dirty.current = false;
    setSave(s => ({ ...s, state: 'pending' }));
    try {
      await api.put(R.kit(id), { data: latest.current, completion: analyze(latest.current).pct });
      setSave({ state: 'ok', at: new Date() });
      return true;
    } catch (err) {
      dirty.current = true;
      setSave({ state: 'error', at: null, msg: errorText(err, 'تعذّر الحفظ — تحقق من الاتصال') });
      return false;
    }
  }, [api, id]);
  useEffect(() => {
    latest.current = data;
    if (!dirty.current) return undefined;
    setSave(s => ({ ...s, state: 'pending' }));
    const t = setTimeout(persist, 900);
    return () => clearTimeout(t);
  }, [data, persist]);

  const close = async () => {
    if (dirty.current && !(await persist())) {
      if (!window.confirm('لم تُحفظ آخر التعديلات. هل تريد الخروج على أي حال؟')) return;
    }
    onClose?.();
  };

  const goto = (target) => {
    const el = document.getElementById(target);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const f = el.matches('input,select,textarea,button') ? el : el.querySelector('textarea,input,select,button,label');
    const ring = el.closest('.tk-field,.ep-sub,.tk-panel') || el;
    setTimeout(() => {
      if (f && f.focus) f.focus({ preventScroll: true });
      ring.classList.remove('tk-flash'); void ring.offsetWidth; ring.classList.add('tk-flash');
    }, 380);
  };

  // ── ad images ──
  const addImages = async (files) => {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type));
    if (!list.length) { toast.error('اختر صورة بصيغة PNG أو JPG'); return; }
    for (const f of list) {
      setBusy(b => [...b, f.name]);
      try {
        const small = await compressImage(f);
        const up = await uploadFile(api, id, small, 'image', R.upload(id));
        update(n => { n.form.images.push({ fileId: up.fileId, name: up.name, size: up.size, mime: up.mime, caption: '' }); });
      } catch (err) {
        toast.error(errorText(err, `تعذّر رفع الصورة ${f.name}`));
      } finally {
        setBusy(b => b.filter(x => x !== f.name));
      }
    }
  };
  const removeImage = (j) => {
    const im = data.form.images[j];
    update(n => { n.form.images.splice(j, 1); });
    if (im?.fileId) api.delete(R.dropFile(id, im.fileId)).catch(() => {});
  };

  const preview = async () => {
    await persist();
    printDocument(api, R.doc(id)).catch(err => toast.error(errorText(err, 'تعذّر تجهيز المعاينة')));
  };

  // ── send to the design team ──
  const openSubmit = () => {
    if (A.issues.length) { toast.error('أكمل النموذج قبل الإرسال — اضغط أي ملاحظة للانتقال إليها'); goto(A.issues[0].target); return; }
    setSubmitOpen(true);
  };
  const submit = async () => {
    if (resend && !note.trim()) { toast.error('اكتب ما الذي عدّلته في الطلب'); return; }
    setSending(true);
    try {
      if (!(await persist())) throw new Error('save');
      const { data: updated } = await api.post(R.submit(id), { note: note.trim() });
      toast.success(`أُرسل الطلب ${fmtMediaNo(updated.number)} إلى فريق التصميم`);
      setSubmitOpen(false);
      onSubmitted?.(updated);
    } catch (err) {
      toast.error(err.message === 'save' ? 'تعذّر حفظ آخر التعديلات قبل الإرسال' : errorText(err, 'تعذّر الإرسال'));
    } finally {
      setSending(false);
    }
  };

  // ── field builders (the form's interface) ──
  const text = (path, o = {}) => (
    <input className={`tk-in ${o.cls || ''}`} type="text" id={idOf(path)} value={val(path)} placeholder={o.ph || ''} dir={o.dir}
      aria-label={o.label} autoComplete="off" disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const area = (path, o = {}) => (
    <AutoArea id={idOf(path)} value={val(path)} rows={o.rows || 1} placeholder={o.ph || ''} aria-label={o.label} disabled={locked} onChange={(v) => set(path, v)} />
  );
  const dateIn = (path, label) => (
    <input className="tk-in" type="date" id={idOf(path)} value={val(path)} aria-label={label} disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const timeIn = (path, label) => (
    <input className="tk-in ep-time" type="time" id={idOf(path)} value={val(path)} aria-label={label} disabled={locked} onChange={(e) => set(path, e.target.value)} />
  );
  const numIn = (path, o = {}) => {
    const input = (
      <input className="tk-in num" type="number" inputMode="decimal" id={idOf(path)} value={val(path)} min={o.min == null ? 0 : o.min} step="1"
        placeholder={o.ph || ''} aria-label={o.label} disabled={locked}
        onChange={(e) => { const v = e.target.value; set(path, v === '' ? '' : (isFinite(+v) ? +v : '')); }} />
    );
    return o.sfx ? <span className="tk-affix" style={o.sfxW ? { '--sfx': `${o.sfxW}px` } : undefined}>{input}<span className="sfx">{o.sfx}</span></span> : input;
  };
  const segIn = (path, opts, labelId) => <Seg id={idOf(path)} options={opts} value={val(path)} labelledBy={labelId} onChange={(v) => !locked && set(path, v)} />;
  const field = (o) => (
    <div className={`tk-field${o.wide ? ' wide' : ''}`} key={o.key}>
      {o.for
        ? <label className="tk-lbl" htmlFor={o.for}>{o.label}{o.req && <span className="tk-req" aria-hidden="true">*</span>}</label>
        : <span className="tk-lbl" id={o.labelId}>{o.label}{o.req && <span className="tk-req" aria-hidden="true">*</span>}</span>}
      {o.hint && <p className="tk-hint">{o.hint}</p>}
      {o.control}
    </div>
  );
  const C = { field, text, area, num: numIn, date: dateIn, time: timeIn, seg: segIn, id: idOf, update, get: getPath };
  const images = { api, url: (fid) => R.file(fid), add: addImages, remove: removeImage, busy };

  const f = data.form; const src = data.source;
  const ret = doc.status === 'returned_employee' ? lastReturn(events, 'employee') : null;
  const chips = [
    has(f.dateFrom) ? (f.dateTo && f.dateTo !== f.dateFrom ? `${fmtDay(f.dateFrom)} — ${fmtDay(f.dateTo)}` : fmtDay(f.dateFrom)) : '',
    has(f.ageMin) && has(f.ageMax) ? `من ${f.ageMin} إلى ${f.ageMax} سنة` : '',
    has(f.beneficiaries) ? `${f.beneficiaries} مستفيد` : '', f.gender, f.urgency
  ].filter(Boolean);
  const saveText = save.state === 'pending' ? 'جارٍ الحفظ…' : save.state === 'error' ? (save.msg || 'تعذّر الحفظ') : save.state === 'ok' ? `محفوظ · ${save.at?.toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' })}` : 'التعديلات تُحفظ تلقائيًا';

  return (
    <Portal target={portalTarget}>
      <div className="tk tk-overlay" data-theme={theme} dir="rtl" lang="ar">
        <header className="tk-top">
          <button type="button" className="tk-btn ghost" onClick={close}>→ <span className="hide-sm">طلبات التصميم</span></button>
          <div className="tk-top-title"><b>{f.activity || 'طلب تصميم إعلان جديد'}</b><span className="mono">{fmtMediaNo(doc.number)}</span></div>
          <span className="tk-sp" />
          {!locked && <span className={`tk-save ${save.state === 'pending' ? 'pending' : save.state === 'error' ? 'err' : ''}`} role="status"><i aria-hidden="true" /><span className="hide-sm">{saveText}</span></span>}
          {events.length > 0 && <button type="button" className="tk-btn" onClick={() => setLineOpen(true)}>🗂 <span className="hide-sm">مسار الطلب</span></button>}
          <button type="button" className="tk-btn" onClick={preview} title="معاينة الطلب كمستند وطباعته">🖨 <span className="hide-sm">معاينة</span></button>
          {!locked && <button type="button" className="tk-btn primary" onClick={openSubmit}>🎨 <span className="hide-sm">{resend ? 'إعادة الإرسال لفريق التصميم' : 'إرسال لفريق التصميم'}</span></button>}
        </header>

        <section className="tk-band" aria-label="ملخص الطلب">
          <div className="tk-band-in">
            <div>
              <p className="tk-eyebrow"><span>طلب تصميم إعلان · {fmtMediaNo(doc.number)}</span></p>
              <h1 className={f.activity ? '' : 'empty'}>{f.activity || 'نشاط بلا اسم'}</h1>
              {chips.length > 0 && <ul className="tk-chips">{chips.map(t => <li key={t}>{t}</li>)}</ul>}
            </div>
            <dl className="tk-tblock">
              <div><dt>الحالة</dt><dd>{statusOf(doc).label}</dd></div>
              <div><dt>التصميم</dt><dd>{doc.designVersion ? `الإصدار ${doc.designVersion}` : 'لم يُسلَّم بعد'}</dd></div>
              <div className="span"><dt>اكتمال النموذج</dt><dd className="tk-pct"><span className="mono">{A.pct}%</span><span className="tk-meter"><i style={{ width: `${A.pct}%` }} /></span></dd></div>
            </dl>
          </div>
        </section>

        <div className="tk-wrap" style={{ display: 'grid', gap: 12 }}>
          {events.length > 0 && <StageStrip status={doc.status} />}
          {ret && (
            <div className="tk-note red">
              <span className="tk-note-ico">↩</span>
              <div>
                <b>أعاد {ret.actorName} الطلب إليك لتعديل بياناته · {fmtDay(ret.createdAt)}</b>
                <div className="tk-quote">{ret.note}</div>
                <div className="tk-muted-s" style={{ marginTop: 6 }}>عدّل ما يلزم ثم اضغط «إعادة الإرسال لفريق التصميم» — يُحفظ كل ما سبق في مسار الطلب.</div>
              </div>
            </div>
          )}
          {!events.length && (
            <div className="tk-note cyan">
              <span className="tk-note-ico">📣</span>
              <div><b>نموذج اعتماد طلب تصميم إعلان (لقسم، ورشة، برامج)</b>عبّئ بيانات النشاط وأرفق 3 صور على الأقل، ثم أرسله لفريق التصميم. يعود إليك التصميم لتراجعه وتعتمده، ثم يمر على مسؤول إدارة المشاريع والمدير.</div>
            </div>
          )}
          {locked && <div className="tk-note cyan"><span className="tk-note-ico">🔒</span><div><b>الطلب لدى {statusOf(doc).holder || 'المراجعين'}</b>لا يمكن تعديل النموذج الآن.</div></div>}
          {(src.planId || src.kitId) && (
            <div className="tk-panel mr-source">
              <span>مرتبط بـ</span>
              {src.planId && <span>🗓 الخطة التنفيذية <b>{src.planNo}</b>{src.targetName ? <> — المستهدف «<b>{src.targetName}</b>»</> : null}</span>}
              {src.kitId && <span>🎒 الحقيبة <b>{src.kitNo}</b></span>}
            </div>
          )}

          <section className="tk-panel">
            <div className="tk-panel-head"><h3 className="tk-panel-title">بيانات الطلب</h3><p className="tk-panel-note">الحقول المعلَّمة بـ * مطلوبة قبل الإرسال.</p></div>
            <MediaFormFields f={f} base="form" c={C} locked={locked} images={images} />
          </section>

          {!locked && (
            <section className="tk-panel">
              <div className="tk-panel-head"><h3 className="tk-panel-title">اكتمال النموذج</h3></div>
              <div className="tk-done-top">
                <b className="tk-big">{A.pct}%</b>
                <div><div className="tk-meter lg"><i style={{ width: `${A.pct}%` }} /></div><p className="tk-done-sum">{A.issues.length ? `${ar(A.issues.length, NOTES)} — اضغط أي ملاحظة للانتقال إلى موضعها.` : 'النموذج مكتمل وجاهز للإرسال إلى فريق التصميم.'}</p></div>
              </div>
              {A.issues.length > 0 && <div className="tk-issues">{A.issues.map((x, i) => <button type="button" key={i} className="tk-issue" onClick={() => goto(x.target)}>{x.text}</button>)}</div>}
            </section>
          )}
        </div>

        {submitOpen && (
          <Modal onClose={() => !sending && setSubmitOpen(false)} labelledBy="mr-submit-title">
            <h3 id="mr-submit-title">{resend ? 'إعادة إرسال الطلب لفريق التصميم' : 'إرسال الطلب لفريق التصميم'}</h3>
            <p>يصل الطلب إلى فريق التصميم في لوحة الإدارة. عند تسليم التصميم يعود إليك لتراجعه وتعتمده أو تعيده بملاحظاتك، ثم يمر على مسؤول إدارة المشاريع والمدير.</p>
            <div className="tk-field">
              <label className="tk-lbl" htmlFor="mr-submit-note">{resend ? <>ما الذي عدّلته في الطلب؟ <span className="tk-req">*</span></> : 'ملاحظة لفريق التصميم (اختياري)'}</label>
              <AutoArea id="mr-submit-note" rows={3} value={note} onChange={setNote} placeholder={resend ? 'مثال: غيّرت التاريخ إلى 12 فبراير وأضفت محورًا جديدًا حسب الملاحظات.' : 'مثال: نفضّل الألوان الداكنة مع شعار المؤسسة.'} />
            </div>
            <div className="tk-modal-actions">
              <button type="button" className="tk-btn ghost" onClick={() => setSubmitOpen(false)} disabled={sending}>إلغاء</button>
              <button type="button" className="tk-btn primary" onClick={submit} disabled={sending || (resend && !note.trim())}>{sending ? 'جارٍ الإرسال…' : '🎨 إرسال'}</button>
            </div>
          </Modal>
        )}

        {lineOpen && (
          <Modal onClose={() => setLineOpen(false)} labelledBy="mr-line-title">
            <h3 id="mr-line-title">مسار الطلب كاملًا</h3>
            <MediaTimeline api={api} events={events} url={(fid) => R.file(fid)} />
            <div className="tk-modal-actions"><button type="button" className="tk-btn" onClick={() => setLineOpen(false)}>إغلاق</button></div>
          </Modal>
        )}
      </div>
    </Portal>
  );
};

export default MediaRequestEditor;
