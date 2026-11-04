import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { fmtDateTime, fmtDay, humanSize } from './kitModel';
import { AutoArea, AuthedImage, Portal, useBodyLock, KitHistory, StatusPill, Modal } from './KitParts';
import { downloadFile, fetchDocument, printDocument, errorText } from './kitApi';
import { KIT_KIND, numberOfDoc, g } from './kinds';
import './TrainingKits.css';

/**
 * A submitted kit / plan for its reviewers (scope 'pm' = مسؤول إدارة
 * المشاريع, 'admin' = manager) or its owner (scope 'mine'): the document of
 * any version, the edit history with every comment, all files, and — when
 * it is their turn — the approve / return decision. The manager can also
 * delete it.
 */
// extraActions(doc) — more top-bar buttons (e.g. «طلب ورشة» on an
// approved kit).
const KitReview = ({ api, scope, kitId, portalTarget, theme = 'dark', onClose, onChanged, onEdit, extraActions, kind = KIT_KIND }) => {
  useBodyLock();
  const R = kind.routes[scope];
  const [kit, setKit] = useState(null);
  const [version, setVersion] = useState(null);
  const [tab, setTab] = useState('doc');
  const [html, setHtml] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(R.kit(kitId));
      setKit(data);
      setVersion(v => v || data.currentVersion || null);
    } catch (err) {
      toast.error(errorText(err, `تعذّر تحميل ${kind.the}`));
      closeRef.current?.();
    }
  }, [api, R, kitId, kind.the]);
  useEffect(() => { load(); }, [load]);

  // Document of the selected version (or the draft for an unsent one).
  useEffect(() => {
    if (!kit) return undefined;
    let live = true;
    setDocLoading(true);
    fetchDocument(api, R.doc(kitId), version ? { version } : { draft: 1 })
      .then(h => { if (live) setHtml(h); })
      .catch(err => { if (live) { setHtml(''); toast.error(errorText(err, 'تعذّر تحميل المستند')); } })
      .finally(() => { if (live) setDocLoading(false); });
    return () => { live = false; };
  }, [api, R, kitId, kit, version]);

  const shown = useMemo(() => {
    if (!kit) return null;
    const v = (kit.versions || []).find(x => x.versionNumber === version);
    return v ? kind.normalize(v.data) : kind.normalize(kit.data);
  }, [kit, version, kind]);

  const no = kit ? kind.fmtNo(numberOfDoc(kit)) : '';
  const myTurn = kit && ((scope === 'pm' && kit.status === 'pm_review') || (scope === 'admin' && kit.status === 'manager_review'));
  const decide = async (decision) => {
    if (decision === 'return' && !comment.trim()) { toast.error(`اكتب الملاحظات المطلوب تعديلها قبل إعادة ${kind.the}`); return; }
    setDeciding(true);
    try {
      const { data } = await api.post(R.decide(kitId), { decision, comment: comment.trim() });
      setKit(data);
      setVersion(data.currentVersion);
      setComment('');
      toast.success(decision === 'return'
        ? `${g(kind, 'أُعيدت', 'أُعيد')} ${kind.the} إلى الموظف مع ملاحظاتك`
        : scope === 'pm' ? `اعتُمدت المراجعة ${g(kind, 'وأُرسلت', 'وأُرسل')} ${kind.the} إلى المدير` : `${g(kind, 'اعتُمدت', 'اعتُمد')} ${kind.the} اعتمادًا نهائيًا`);
      onChanged?.(data);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر حفظ القرار'));
    } finally {
      setDeciding(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.delete(R.remove(kitId));
      toast.success(`${g(kind, 'حُذفت', 'حُذف')} ${kind.the} ${no}`);
      setDelOpen(false);
      onChanged?.(null);
      onClose?.();
    } catch (err) {
      toast.error(errorText(err, 'تعذّر الحذف'));
    } finally {
      setDeleting(false);
    }
  };

  const zip = async () => {
    setZipping(true);
    try {
      const name = `${no} - ${kit.title || kind.a}${version ? ` - v${version}` : ''}.zip`;
      await downloadFile(api, `${R.zip(kitId)}${version ? `?version=${version}` : '?draft=1'}`, name);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تجهيز الملف المضغوط'));
    } finally {
      setZipping(false);
    }
  };

  const docParams = version ? { version } : { draft: 1 };
  const printPart = (part, audience) => printDocument(api, R.doc(kitId), { ...docParams, part, ...(audience ? { audience } : {}) })
    .catch(err => toast.error(errorText(err, 'تعذّر تجهيز الطباعة')));

  const fileRows = shown ? kind.filesOf(shown) : [];
  const imageRows = shown ? kind.imagesOf(shown) : [];
  const parts = shown ? kind.partsOf(shown) : [];

  return (
    <Portal target={portalTarget}>
      <div className="tk tk-overlay" data-theme={theme} dir="rtl" lang="ar">
        <header className="tk-top">
          <button type="button" className="tk-btn ghost" onClick={onClose}>→ <span className="hide-sm">رجوع</span></button>
          <div className="tk-top-title"><b>{kit?.title || kind.a}</b><span className="mono">{no}</span></div>
          <span className="tk-sp" />
          {kit && scope === 'mine' && ['draft', 'returned'].includes(kit.status) && onEdit && (
            <button type="button" className="tk-btn primary" onClick={() => onEdit(kit)}>✎ <span className="hide-sm">تعديل {kind.the}</span></button>
          )}
          {kit && extraActions && extraActions(kit)}
          {kit && scope === 'admin' && R.remove && (
            <button type="button" className="tk-btn danger" onClick={() => { setDelText(''); setDelOpen(true); }} title={`حذف ${kind.the} — للمدير فقط`}>🗑 <span className="hide-sm">حذف</span></button>
          )}
        </header>

        {!kit ? <div className="tk-review"><div className="tk-doc-loading">جارٍ تحميل {kind.the}…</div></div> : (
          <div className="tk-review">
            <div className="tk-rv-head">
              <div className="ttl">
                <div className="sub"><span className="mono">{no}</span><StatusPill kit={kit} m={kind.m} />{kit.author?.name && <span>إعداد: <b>{kit.author.name}</b></span>}{kit.submittedAt && <span>آخر إرسال: {fmtDateTime(kit.submittedAt)}</span>}</div>
                <h2>{kit.title || kind.untitled}</h2>
              </div>
              {(kit.versions || []).length > 0 && (
                <select className="tk-select" value={version || ''} onChange={(e) => setVersion(Number(e.target.value) || null)} aria-label="الإصدار المعروض">
                  {[...kit.versions].reverse().map(v => (
                    <option key={v.versionNumber} value={v.versionNumber}>الإصدار {v.versionNumber}{v.versionNumber === kit.currentVersion ? ' (الأحدث)' : ''}{v.managerDecision === 'approved' ? ' — معتمد' : ''}</option>
                  ))}
                  {scope === 'mine' && ['draft', 'returned'].includes(kit.status) && <option value="">المسودة الحالية</option>}
                </select>
              )}
              <button type="button" className="tk-btn" onClick={() => printDocument(api, R.doc(kitId), docParams).catch(err => toast.error(errorText(err, 'تعذّر تجهيز الطباعة')))}>🖨 <span className="hide-sm">طباعة / PDF</span></button>
              <button type="button" className="tk-btn" onClick={zip} disabled={zipping}>{zipping ? '⏳' : '⬇'} <span className="hide-sm">{zipping ? 'جارٍ التجهيز…' : 'تنزيل الكل (ZIP)'}</span></button>
            </div>

            {myTurn && (
              <section className="tk-decision" aria-labelledby="tk-dec-title">
                <h3 id="tk-dec-title">قرارك على الإصدار {kit.currentVersion}</h3>
                <p className="tk-muted-s" style={{ margin: 0 }}>
                  {scope === 'pm'
                    ? `اعتمادك يرسل ${kind.the} إلى المدير للاعتماد النهائي. الإعادة ${g(kind, 'ترجعها', 'ترجعه')} للموظف مع ملاحظاتك ${g(kind, 'ليعدّلها', 'ليعدّله')} ويرسل إصدارًا جديدًا.`
                    : `اعتمادك نهائي ويحفظ ${kind.the} في ${kind.archive}. الإعادة ${g(kind, 'ترجعها للموظف، ثم تمر', 'ترجعه للموظف، ثم يمر')} على مسؤول إدارة المشاريع قبل أن ${g(kind, 'تعود', 'يعود')} إليك.`}
                </p>
                <AutoArea rows={3} value={comment} onChange={setComment} placeholder="الملاحظات — مطلوبة عند الإعادة، واختيارية عند الاعتماد" aria-label="ملاحظات القرار" />
                <div className="tk-decision-actions">
                  <button type="button" className="tk-btn ok" disabled={deciding} onClick={() => decide('approve')}>✓ {scope === 'pm' ? 'اعتماد وإرسال للمدير' : 'اعتماد نهائي'}</button>
                  <button type="button" className="tk-btn warn" disabled={deciding} onClick={() => decide('return')}>↩ إعادة للموظف مع الملاحظات</button>
                </div>
              </section>
            )}

            {scope === 'mine' && kit.status === 'returned' && (() => {
              const v = kit.versions[kit.versions.length - 1];
              const byManager = kit.returnedBy === 'manager';
              return (
                <div className="tk-note red">
                  <span className="tk-note-ico">↩</span>
                  <div>
                    <b>أعاد {byManager ? (v?.managerName || 'المدير') : (v?.pmName || 'مسؤول إدارة المشاريع')} {kind.the} للتعديل · {fmtDay(byManager ? v?.managerAt : v?.pmAt)}</b>
                    <div className="tk-quote">{byManager ? v?.managerComment : v?.pmComment}</div>
                  </div>
                </div>
              );
            })()}
            {kit.status === 'approved' && (
              <div className="tk-note mint"><span className="tk-note-ico">✓</span><div><b>{kind.a} {g(kind, 'معتمدة', 'معتمد')} — الإصدار {kit.approvedVersion}</b>{g(kind, 'اعتُمدت', 'اعتُمد')} بتاريخ {fmtDay(kit.approvedAt)}.{scope === 'mine' ? kind.approvedMine : ''}</div></div>
            )}

            <div className="tk-tabs" role="tablist">
              {[['doc', kind.docTab], ['history', `🕘 السجل والملاحظات (${(kit.versions || []).length})`], ['files', `📎 الملفات (${fileRows.length + imageRows.length})`]].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === 'doc' && (docLoading && !html
              ? <div className="tk-doc-loading">جارٍ تجهيز المستند…</div>
              : <iframe className="tk-doc-frame" title={kind.a} srcDoc={html}
                  onLoad={(e) => { try { e.currentTarget.style.height = `${e.currentTarget.contentDocument.documentElement.scrollHeight + 4}px`; } catch { /* keep default */ } }} />)}

            {tab === 'history' && (
              <KitHistory versions={kit.versions} currentVersion={kit.currentVersion} diff={kind.diff} the={kind.the} onView={(n) => { setVersion(n); setTab('doc'); }} />
            )}

            {tab === 'files' && shown && (
              <div className="tk-panel">
                {parts.length > 0 && (
                  <>
                    <div className="tk-panel-head"><h3 className="tk-panel-title">النماذج المعبأة</h3><p className="tk-panel-note">كل نموذج مستند مستقل للطباعة أو الحفظ PDF.</p></div>
                    <div className="tk-files" style={{ marginBottom: 20 }}>
                      {parts.map(p => (
                        <div className="tk-file" key={p.key}>
                          <span aria-hidden="true">📝</span>
                          <span className="name" title={p.label}><b>{p.label}</b></span>
                          {(p.audiences || [null]).map(a => (
                            <button key={a || 'all'} type="button" className="tk-btn sm" onClick={() => printPart(p.key, a)}>🖨 {a === 'participant' ? 'نسخة المشارك' : a === 'trainer' ? 'نسخة المدرب' : 'طباعة'}</button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="tk-panel-head"><h3 className="tk-panel-title">مرفقات {version ? `الإصدار ${version}` : 'المسودة'}</h3><p className="tk-panel-note">«تنزيل الكل» يجمعها في ملف واحد مع المستند.</p></div>
                {!fileRows.length && <p className="tk-empty">لا توجد ملفات مرفقة.</p>}
                <div className="tk-files">
                  {fileRows.map(f => (
                    <div className="tk-file" key={f.fileId}>
                      <span aria-hidden="true">📎</span>
                      <span className="name" title={f.name}><b>{f.label}</b> — {f.name}</span>
                      <span className="size">{f.size ? humanSize(f.size) : ''}</span>
                      <button type="button" className="tk-ibtn" title="تنزيل" aria-label={`تنزيل ${f.name}`} onClick={() => downloadFile(api, R.file(f.fileId), f.name).catch(err => toast.error(errorText(err, 'تعذّر التنزيل')))}>⬇</button>
                    </div>
                  ))}
                </div>
                {imageRows.length > 0 && (
                  <>
                    <div className="tk-panel-head" style={{ marginTop: 20 }}><h3 className="tk-panel-title">الصور</h3></div>
                    <div className="tk-igrid">
                      {imageRows.map(im => (
                        <figure className="tk-itile" key={im.id || im.fileId}>
                          <div className="ph"><AuthedImage api={api} url={R.file(im.fileId)} alt={im.caption} /></div>
                          <figcaption className="meta">
                            <span>{im.code && <b className="mono">{im.code}</b>} {im.caption}</span>
                            <button type="button" className="tk-btn sm" onClick={() => downloadFile(api, R.file(im.fileId), im.name || 'image.jpg').catch(err => toast.error(errorText(err, 'تعذّر التنزيل')))}>⬇ تنزيل</button>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {delOpen && kit && (
          <Modal onClose={() => !deleting && setDelOpen(false)} labelledBy="tk-del-title">
            <h3 id="tk-del-title">حذف {kind.the} {no}</h3>
            <p>{g(kind, 'ستختفي', 'سيختفي')} «{kit.title || kind.untitled}» من جميع الشاشات: لوحة الموظف ولوحة إدارة المشاريع ولوحة المدير، مع {g(kind, 'إصداراتها وملفاتها', 'إصداراته وملفاته')}.</p>
            <div className="tk-field">
              <label className="tk-lbl" htmlFor="tk-del-confirm">للتأكيد اكتب الرقم <b className="mono">{no}</b></label>
              <input id="tk-del-confirm" className="tk-in" dir="ltr" autoComplete="off" value={delText} onChange={(e) => setDelText(e.target.value)} placeholder={no} />
            </div>
            <div className="tk-modal-actions">
              <button type="button" className="tk-btn ghost" onClick={() => setDelOpen(false)} disabled={deleting}>إلغاء</button>
              <button type="button" className="tk-btn danger solid" onClick={remove} disabled={deleting || delText.trim().toUpperCase() !== no.toUpperCase()}>{deleting ? 'جارٍ الحذف…' : '🗑 حذف نهائيًا'}</button>
            </div>
          </Modal>
        )}
      </div>
    </Portal>
  );
};

export default KitReview;
