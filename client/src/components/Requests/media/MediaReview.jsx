import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { normalize, fmtMediaNo, statusOf, currentDelivery, deliveries, lastReturn, EDITABLE, fmtDateTime, has } from './mediaModel';
import { MEDIA_FIELDS, weekdayOf } from './mediaForm';
import { MEDIA_ROUTES } from './mediaKind';
import { fmtDay } from '../../TrainingKits/kitModel';
import { AutoArea, AuthedImage, Portal, useBodyLock, Modal } from '../../TrainingKits/KitParts';
import { uploadFile, fetchDocument, printDocument, errorText } from '../../TrainingKits/kitApi';
import { StageStrip, DesignView, MediaTimeline, DesignFile } from './MediaParts';
import '../../TrainingKits/TrainingKits.css';
import './Media.css';

const SHOW = (f, k) => {
  const v = f[k];
  if (!has(v)) return '—';
  if (k === 'dateFrom' || k === 'dateTo' || k === 'dueDate') return `${weekdayOf(v) ? `${weekdayOf(v)} ` : ''}${fmtDay(v)}`;
  return String(v);
};

/**
 * A media design request for any of its four roles:
 *   employee  — sees the line; checks a delivered design (approve → PM,
 *               reject with notes → designer); edits when it is with them
 *   designer  — the design team (admin dashboard): uploads the design
 *               files and delivers version N to the employee
 *   pm        — مسؤول إدارة المشاريع: approve → manager, or return to the
 *               designer / to the employee
 *   manager   — final approval or return (designer / employee); delete
 * Everyone sees the request, the current design, every design version and
 * the whole line with its notes, and can print it.
 */
const MediaReview = ({ api, role, requestId, portalTarget, theme = 'dark', onClose, onChanged, onEdit }) => {
  useBodyLock();
  const R = MEDIA_ROUTES[role];
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState(null);
  const [html, setHtml] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(R.kit(requestId));
      setDoc(data);
      return data;
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الطلب'));
      closeRef.current?.();
      return null;
    }
  }, [api, R, requestId]);
  useEffect(() => { load(); }, [load]);

  const fileUrl = useCallback((fid) => R.file(fid), [R]);
  const data = useMemo(() => (doc ? normalize(doc.data) : null), [doc]);
  const events = useMemo(() => doc?.events || [], [doc]);
  const cur = doc ? currentDelivery(doc) : null;
  const allDeliveries = useMemo(() => deliveries(events).slice().reverse(), [events]);
  const no = doc ? fmtMediaNo(doc.number) : '';
  const st = doc ? statusOf(doc) : null;

  // First tab: the design once there is one, else the request.
  useEffect(() => { if (doc && !tab) setTab(doc.designVersion > 0 ? 'design' : 'request'); }, [doc, tab]);
  useEffect(() => {
    if (tab !== 'doc' || !doc) return undefined;
    let live = true;
    fetchDocument(api, R.doc(doc.id)).then(h => { if (live) setHtml(h); }).catch(err => toast.error(errorText(err, 'تعذّر تحميل المستند')));
    return () => { live = false; };
  }, [api, R, tab, doc]);

  // Design files uploaded for the next version (not delivered yet).
  const delivered = useMemo(() => new Set(events.flatMap(e => (e.files || []).map(f => f.fileId))), [events]);
  const pending = useMemo(() => (doc?.files || []).filter(f => f.kind === 'design' && !delivered.has(f.fileId)), [doc, delivered]);
  useEffect(() => { setPicked(new Set(pending.map(f => f.fileId))); }, [pending]);

  const after = (updated, msg) => {
    setDoc(updated);
    setComment('');
    toast.success(msg);
    onChanged?.(updated);
  };
  const act = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (err) { toast.error(errorText(err, 'تعذّر حفظ الإجراء')); } finally { setBusy(false); }
  };

  // ── employee: check the design ──
  const check = (decision) => {
    if (decision === 'reject' && !comment.trim()) { toast.error('اكتب ما المطلوب تعديله في التصميم'); return; }
    act(async () => {
      const { data: u } = await api.post(R.check(doc.id), { decision, comment: comment.trim() });
      after(u, decision === 'approve' ? 'اعتُمد التصميم وأُرسل الطلب لمسؤول إدارة المشاريع' : 'أُعيد التصميم للمصمم مع ملاحظاتك');
    });
  };
  // ── designer: upload + deliver ──
  const addDesign = async (files) => {
    for (const f of Array.from(files || [])) {
      setUploading(u => [...u, f.name]);
      try {
        await uploadFile(api, doc.id, f, 'design', R.upload(doc.id));
      } catch (err) {
        toast.error(errorText(err, `تعذّر رفع ${f.name}`));
      } finally {
        setUploading(u => u.filter(x => x !== f.name));
      }
    }
    await load();
  };
  const dropDesign = (fid) => act(async () => { await api.delete(R.dropFile(doc.id, fid)); await load(); });
  const deliver = () => {
    if (!picked.size) { toast.error('أرفق ملف التصميم واختره قبل الإرسال'); return; }
    act(async () => {
      const { data: u } = await api.post(R.deliver(doc.id), { fileIds: [...picked], note: comment.trim() });
      after(u, `سُلّم التصميم — الإصدار ${u.designVersion} — وأُرسل لمنفذ الطلب`);
    });
  };
  // ── PM / manager ──
  const decide = (decision, returnTo) => {
    if (decision === 'return' && !comment.trim()) { toast.error('اكتب الملاحظات المطلوب تعديلها قبل إعادة الطلب'); return; }
    act(async () => {
      const { data: u } = await api.post(R.decide(doc.id), { decision, comment: comment.trim(), returnTo });
      after(u, decision === 'approve'
        ? (role === 'pm' ? 'اعتُمد الطلب وأُرسل إلى المدير' : 'اعتُمد الطلب اعتمادًا نهائيًا')
        : (returnTo === 'designer' ? 'أُعيد الطلب لفريق التصميم مع ملاحظاتك' : 'أُعيد الطلب لمنفذ الطلب مع ملاحظاتك'));
    });
  };
  const remove = () => act(async () => {
    await api.delete(R.remove(doc.id));
    toast.success(`حُذف الطلب ${no}`);
    setDelOpen(false);
    onChanged?.(null);
    onClose?.();
  });

  const toDesigner = doc?.status === 'design' ? lastReturn(events, 'designer') : null;
  const toEmployee = doc?.status === 'returned_employee' ? lastReturn(events, 'employee') : null;

  const actionPanel = () => {
    if (!doc) return null;
    if (role === 'employee' && doc.status === 'employee_check') {
      return (
        <section className="mr-act" aria-labelledby="mr-act-t">
          <h3 id="mr-act-t">راجع التصميم — الإصدار {doc.designVersion}</h3>
          <p className="tk-muted-s" style={{ margin: 0 }}>تحقق من كل التفاصيل (الاسم، التاريخ، الوقت، الأعمار، الرسوم، الصور). اعتمادك يرسل الطلب إلى مسؤول إدارة المشاريع ثم المدير، والرفض يعيده للمصمم مع ملاحظاتك.</p>
          <AutoArea rows={3} value={comment} onChange={setComment} placeholder="ملاحظاتك — مطلوبة عند الرفض، واختيارية عند الاعتماد" aria-label="ملاحظاتك على التصميم" />
          <div className="row">
            <button type="button" className="tk-btn ok" disabled={busy} onClick={() => check('approve')}>✓ اعتماد التصميم وإرساله لمسؤول إدارة المشاريع</button>
            <button type="button" className="tk-btn warn" disabled={busy} onClick={() => check('reject')}>↩ رفض وإعادته للمصمم مع الملاحظات</button>
          </div>
        </section>
      );
    }
    if (role === 'designer' && doc.status === 'design') {
      return (
        <section className="mr-act" aria-labelledby="mr-act-t">
          <h3 id="mr-act-t">{doc.designVersion ? `تعديل التصميم — الإصدار ${doc.designVersion + 1}` : 'تصميم الإعلان — الإصدار 1'}</h3>
          {toDesigner && (
            <div className="tk-note red" style={{ margin: 0 }}>
              <span className="tk-note-ico">↩</span>
              <div><b>ملاحظات {toDesigner.actorName} · {fmtDay(toDesigner.createdAt)}</b><div className="tk-quote">{toDesigner.note}</div></div>
            </div>
          )}
          <p className="tk-muted-s" style={{ margin: 0 }}>راجع بيانات الطلب وصوره في تبويب «الطلب»، ثم ارفع ملفات التصميم (صور أو PDF أو ملفات المصدر) واختر ما يُسلَّم في هذا الإصدار.</p>
          <div className="mr-up-list">
            {pending.map(f => (
              <div className="tk-file" key={f.fileId}>
                <input type="checkbox" checked={picked.has(f.fileId)} aria-label={`تسليم ${f.name}`}
                  onChange={(e) => setPicked(s => { const x = new Set(s); if (e.target.checked) x.add(f.fileId); else x.delete(f.fileId); return x; })} />
                <span className="name" title={f.name}>{f.name}</span>
                <button type="button" className="tk-ibtn danger" title="حذف" aria-label={`حذف ${f.name}`} disabled={busy} onClick={() => dropDesign(f.fileId)}>🗑</button>
              </div>
            ))}
            {uploading.map(n => <div className="tk-file busy" key={n}><span>⏳</span><span className="name">{n}</span><span className="size">جارٍ الرفع…</span></div>)}
            <label className="tk-up">⬆ {pending.length ? 'إضافة ملف آخر' : 'رفع ملفات التصميم'}
              <input type="file" multiple hidden onChange={(e) => { addDesign(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
          <AutoArea rows={2} value={comment} onChange={setComment} placeholder="ملاحظة لمنفذ الطلب (اختياري) — مثال: عدّلت الألوان والتاريخ حسب الملاحظات" aria-label="ملاحظة المصمم" />
          <div className="row">
            <button type="button" className="tk-btn primary" disabled={busy || !picked.size || uploading.length > 0} onClick={deliver}>🎨 إرسال التصميم لمنفذ الطلب</button>
            <span className="tk-muted-s">{picked.size ? `${picked.size} ملف سيُسلَّم` : 'لم يُختر ملف بعد'}</span>
          </div>
        </section>
      );
    }
    if ((role === 'pm' && doc.status === 'pm_review') || (role === 'manager' && doc.status === 'manager_review')) {
      return (
        <section className="mr-act" aria-labelledby="mr-act-t">
          <h3 id="mr-act-t">قرارك على الطلب — التصميم الإصدار {doc.designVersion}</h3>
          <p className="tk-muted-s" style={{ margin: 0 }}>
            {role === 'pm' ? 'اعتمادك يرسل الطلب إلى المدير للاعتماد النهائي.' : 'اعتمادك نهائي ويُحفظ التصميم المعتمد مع الطلب.'}
            {' '}عند الإعادة اختر: للمصمم (تعديل التصميم، ثم يراجعه منفذ الطلب) أو لمنفذ الطلب (تعديل بيانات الطلب، ثم يعود للتصميم).
          </p>
          <AutoArea rows={3} value={comment} onChange={setComment} placeholder="الملاحظات — مطلوبة عند الإعادة، واختيارية عند الاعتماد" aria-label="ملاحظات القرار" />
          <div className="row">
            <button type="button" className="tk-btn ok" disabled={busy} onClick={() => decide('approve')}>✓ {role === 'pm' ? 'اعتماد وإرسال للمدير' : 'اعتماد نهائي'}</button>
            <button type="button" className="tk-btn warn" disabled={busy} onClick={() => decide('return', 'designer')}>↩ إعادة للمصمم</button>
            <button type="button" className="tk-btn warn" disabled={busy} onClick={() => decide('return', 'employee')}>↩ إعادة لمنفذ الطلب</button>
          </div>
        </section>
      );
    }
    if (role === 'employee' && toEmployee) {
      return (
        <div className="tk-note red">
          <span className="tk-note-ico">↩</span>
          <div>
            <b>أعاد {toEmployee.actorName} الطلب إليك لتعديل بياناته · {fmtDay(toEmployee.createdAt)}</b>
            <div className="tk-quote">{toEmployee.note}</div>
            {onEdit && <div style={{ marginTop: 8 }}><button type="button" className="tk-btn primary sm" onClick={() => onEdit(doc)}>✎ تعديل الطلب وإعادة إرساله</button></div>}
          </div>
        </div>
      );
    }
    if (doc.status === 'approved') {
      return <div className="tk-note mint"><span className="tk-note-ico">✓</span><div><b>طلب معتمد — التصميم الإصدار {doc.designVersion}</b>اعتُمد بتاريخ {fmtDay(doc.approvedAt)}. التصميم المعتمد في تبويب «التصميم» ويمكن طباعة الطلب كاملًا.</div></div>;
    }
    return <div className="tk-note cyan"><span className="tk-note-ico">⏳</span><div><b>الطلب الآن لدى {st.holder}</b>{st.label}.</div></div>;
  };

  const form = data?.form;
  const tabs = [
    ['design', `🎨 التصميم${doc?.designVersion ? ` (الإصدار ${doc.designVersion})` : ''}`],
    ['request', '📝 الطلب'],
    ['line', `🗂 المسار الكامل (${events.length})`],
    ['doc', '📄 المستند']
  ];

  return (
    <Portal target={portalTarget}>
      <div className="tk tk-overlay" data-theme={theme} dir="rtl" lang="ar">
        <header className="tk-top">
          <button type="button" className="tk-btn ghost" onClick={onClose}>→ <span className="hide-sm">رجوع</span></button>
          <div className="tk-top-title"><b>{doc?.title || 'طلب تصميم إعلان'}</b><span className="mono">{no}</span></div>
          <span className="tk-sp" />
          {doc && role === 'employee' && EDITABLE.includes(doc.status) && onEdit && (
            <button type="button" className="tk-btn primary" onClick={() => onEdit(doc)}>✎ <span className="hide-sm">تعديل الطلب</span></button>
          )}
          {doc && <button type="button" className="tk-btn" onClick={() => printDocument(api, R.doc(doc.id)).catch(err => toast.error(errorText(err, 'تعذّر تجهيز الطباعة')))}>🖨 <span className="hide-sm">طباعة / PDF</span></button>}
          {doc && role === 'manager' && <button type="button" className="tk-btn danger" onClick={() => { setDelText(''); setDelOpen(true); }} title="حذف الطلب — للمدير فقط">🗑 <span className="hide-sm">حذف</span></button>}
        </header>

        {!doc ? <div className="tk-review"><div className="tk-doc-loading">جارٍ تحميل الطلب…</div></div> : (
          <div className="tk-review">
            <div className="tk-rv-head">
              <div className="ttl">
                <div className="sub">
                  <span className="mono">{no}</span><span className={`tk-pill ${st.tone}`}>{st.label}</span>
                  {doc.author?.name && <span>منفذ الطلب: <b>{doc.author.name}</b></span>}
                  {doc.submittedAt && <span>آخر إرسال: {fmtDateTime(doc.submittedAt)}</span>}
                </div>
                <h2>{doc.title || 'طلب تصميم بلا عنوان'}</h2>
              </div>
            </div>

            <StageStrip status={doc.status} />
            {actionPanel()}

            <div className="tk-tabs" role="tablist">
              {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
            </div>

            {tab === 'design' && (
              <div className="tk-panel" style={{ display: 'grid', gap: 18 }}>
                <DesignView api={api} delivery={cur} url={fileUrl} approved={doc.status === 'approved'} />
                {allDeliveries.length > 1 && (
                  <div>
                    <div className="tk-panel-head"><h3 className="tk-panel-title">الإصدارات السابقة</h3><p className="tk-panel-note">كل إصدار سُلّم يبقى محفوظًا بملفاته.</p></div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {allDeliveries.filter(d => d !== cur).map(d => (
                        <details key={d.seq} className="tk-ver">
                          <summary className="tk-ver-head"><h4>الإصدار <span className="mono">{d.designVersion}</span></h4><span className="when">{d.actorName} · {fmtDateTime(d.createdAt)}</span></summary>
                          {d.note && <div className="tk-ver-note"><b>ملاحظة المصمم</b>{d.note}</div>}
                          <div className="mr-ev-files">{(d.files || []).map(f => <DesignFile key={f.fileId} api={api} f={f} url={fileUrl} />)}</div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'request' && form && (
              <div className="tk-panel" style={{ display: 'grid', gap: 14 }}>
                {(data.source.planId || data.source.kitId) && (
                  <div className="mr-source">
                    <span>مرتبط بـ</span>
                    {data.source.planId && <span>🗓 الخطة التنفيذية <b>{data.source.planNo}</b>{data.source.targetName ? <> — المستهدف «<b>{data.source.targetName}</b>»</> : null}</span>}
                    {data.source.kitId && <span>🎒 الحقيبة <b>{data.source.kitNo}</b></span>}
                  </div>
                )}
                <table className="mr-kv"><tbody>
                  {MEDIA_FIELDS.map(([k, l]) => <tr key={k}><th>{l}</th><td>{SHOW(form, k)}</td></tr>)}
                </tbody></table>
                <div>
                  <div className="tk-panel-head"><h3 className="tk-panel-title">المحاور</h3></div>
                  {form.axes.some(a => has(a.title)) ? <ol className="mr-axes">{form.axes.filter(a => has(a.title) || has(a.desc)).map(a => <li key={a.id}><b>{a.title}</b>{has(a.desc) && <small>{a.desc}</small>}</li>)}</ol> : <p className="tk-empty">—</p>}
                </div>
                <div>
                  <div className="tk-panel-head"><h3 className="tk-panel-title">صور الإعلان</h3><p className="tk-panel-note">{form.images.length} صور</p></div>
                  <div className="tk-igrid">
                    {form.images.map(im => (
                      <figure className="tk-itile" key={im.fileId}>
                        <div className="ph"><AuthedImage api={api} url={fileUrl(im.fileId)} alt={im.caption || im.name} /></div>
                        <figcaption className="meta"><span>{im.caption || im.name}</span></figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'line' && <div className="tk-panel"><MediaTimeline api={api} events={events} url={fileUrl} /></div>}

            {tab === 'doc' && (html
              ? <iframe className="tk-doc-frame" title="طلب تصميم إعلان" srcDoc={html}
                  onLoad={(e) => { try { e.currentTarget.style.height = `${e.currentTarget.contentDocument.documentElement.scrollHeight + 4}px`; } catch { /* keep default */ } }} />
              : <div className="tk-doc-loading">جارٍ تجهيز المستند…</div>)}
          </div>
        )}

        {delOpen && doc && (
          <Modal onClose={() => !busy && setDelOpen(false)} labelledBy="mr-del-title">
            <h3 id="mr-del-title">حذف الطلب {no}</h3>
            <p>سيختفي «{doc.title || 'طلب تصميم'}» من جميع الشاشات: لوحة الموظف ولوحة الإدارة (فريق التصميم) ولوحة إدارة المشاريع ولوحة المدير، مع مساره وتصاميمه.</p>
            <div className="tk-field">
              <label className="tk-lbl" htmlFor="mr-del-confirm">للتأكيد اكتب الرقم <b className="mono">{no}</b></label>
              <input id="mr-del-confirm" className="tk-in" dir="ltr" autoComplete="off" value={delText} onChange={(e) => setDelText(e.target.value)} placeholder={no} />
            </div>
            <div className="tk-modal-actions">
              <button type="button" className="tk-btn ghost" onClick={() => setDelOpen(false)} disabled={busy}>إلغاء</button>
              <button type="button" className="tk-btn danger solid" onClick={remove} disabled={busy || delText.trim().toUpperCase() !== no.toUpperCase()}>{busy ? 'جارٍ الحذف…' : '🗑 حذف نهائيًا'}</button>
            </div>
          </Modal>
        )}
      </div>
    </Portal>
  );
};

export default MediaReview;
