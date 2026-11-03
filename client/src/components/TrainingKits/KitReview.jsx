import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { fmtKitNo, fmtDateTime, fmtDay, humanSize, normalize } from './kitModel';
import { AutoArea, AuthedImage, Portal, useBodyLock, KitHistory, StatusPill } from './KitParts';
import { KIT_ROUTES, downloadFile, fetchDocument, printDocument, errorText } from './kitApi';
import './TrainingKits.css';

/**
 * A submitted kit for its reviewers (scope 'pm' = مسؤول إدارة المشاريع,
 * 'admin' = manager) or its owner (scope 'mine'): the kit document of any
 * version, the edit history with every comment, all files, and — when it
 * is their turn — the approve / return decision.
 */
const KitReview = ({ api, scope, kitId, portalTarget, theme = 'dark', onClose, onChanged, onEdit }) => {
  useBodyLock();
  const R = KIT_ROUTES[scope];
  const [kit, setKit] = useState(null);
  const [version, setVersion] = useState(null);
  const [tab, setTab] = useState('doc');
  const [html, setHtml] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [deciding, setDeciding] = useState(false);
  const [zipping, setZipping] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(R.kit(kitId));
      setKit(data);
      setVersion(v => v || data.currentVersion || null);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تحميل الحقيبة'));
      closeRef.current?.();
    }
  }, [api, R, kitId]);
  useEffect(() => { load(); }, [load]);

  // Document of the selected version (or the draft for an unsent kit).
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
    return v ? normalize(v.data) : normalize(kit.data);
  }, [kit, version]);

  const myTurn = kit && ((scope === 'pm' && kit.status === 'pm_review') || (scope === 'admin' && kit.status === 'manager_review'));
  const decide = async (decision) => {
    if (decision === 'return' && !comment.trim()) { toast.error('اكتب الملاحظات المطلوب تعديلها قبل إعادة الحقيبة'); return; }
    setDeciding(true);
    try {
      const { data } = await api.post(R.decide(kitId), { decision, comment: comment.trim() });
      setKit(data);
      setVersion(data.currentVersion);
      setComment('');
      toast.success(decision === 'return'
        ? 'أُعيدت الحقيبة إلى الموظف مع ملاحظاتك'
        : scope === 'pm' ? 'اعتُمدت المراجعة وأُرسلت الحقيبة إلى المدير' : 'اعتُمدت الحقيبة اعتمادًا نهائيًا');
      onChanged?.(data);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر حفظ القرار'));
    } finally {
      setDeciding(false);
    }
  };

  const zip = async () => {
    setZipping(true);
    try {
      const name = `${fmtKitNo(kit.kitNumber)} - ${kit.title || 'حقيبة تدريبية'}${version ? ` - v${version}` : ''}.zip`;
      await downloadFile(api, `${R.zip(kitId)}${version ? `?version=${version}` : '?draft=1'}`, name);
    } catch (err) {
      toast.error(errorText(err, 'تعذّر تجهيز الملف المضغوط'));
    } finally {
      setZipping(false);
    }
  };

  const fileRows = shown ? shown.attachments.flatMap(a => a.files.map(f => ({ ...f, label: a.label }))) : [];
  const outCode = (id) => { const i = shown ? shown.outputs.findIndex(o => o.id === id) : -1; return i < 0 ? '' : `م${i + 1}`; };

  return (
    <Portal target={portalTarget}>
      <div className="tk tk-overlay" data-theme={theme} dir="rtl" lang="ar">
        <header className="tk-top">
          <button type="button" className="tk-btn ghost" onClick={onClose}>→ <span className="hide-sm">رجوع</span></button>
          <div className="tk-top-title"><b>{kit?.title || 'حقيبة تدريبية'}</b><span className="mono">{kit ? fmtKitNo(kit.kitNumber) : ''}</span></div>
          <span className="tk-sp" />
          {kit && scope === 'mine' && ['draft', 'returned'].includes(kit.status) && onEdit && (
            <button type="button" className="tk-btn primary" onClick={() => onEdit(kit)}>✎ <span className="hide-sm">تعديل الحقيبة</span></button>
          )}
        </header>

        {!kit ? <div className="tk-review"><div className="tk-doc-loading">جارٍ تحميل الحقيبة…</div></div> : (
          <div className="tk-review">
            <div className="tk-rv-head">
              <div className="ttl">
                <div className="sub"><span className="mono">{fmtKitNo(kit.kitNumber)}</span><StatusPill kit={kit} />{kit.author?.name && <span>إعداد: <b>{kit.author.name}</b></span>}{kit.submittedAt && <span>آخر إرسال: {fmtDateTime(kit.submittedAt)}</span>}</div>
                <h2>{kit.title || 'برنامج تدريبي بلا اسم'}</h2>
              </div>
              {(kit.versions || []).length > 0 && (
                <select className="tk-select" value={version || ''} onChange={(e) => setVersion(Number(e.target.value) || null)} aria-label="الإصدار المعروض">
                  {[...kit.versions].reverse().map(v => (
                    <option key={v.versionNumber} value={v.versionNumber}>الإصدار {v.versionNumber}{v.versionNumber === kit.currentVersion ? ' (الأحدث)' : ''}{v.managerDecision === 'approved' ? ' — معتمد' : ''}</option>
                  ))}
                  {scope === 'mine' && ['draft', 'returned'].includes(kit.status) && <option value="">المسودة الحالية</option>}
                </select>
              )}
              <button type="button" className="tk-btn" onClick={() => printDocument(api, R.doc(kitId), version ? { version } : { draft: 1 }).catch(err => toast.error(errorText(err, 'تعذّر تجهيز الطباعة')))}>🖨 <span className="hide-sm">طباعة / PDF</span></button>
              <button type="button" className="tk-btn" onClick={zip} disabled={zipping}>{zipping ? '⏳' : '⬇'} <span className="hide-sm">{zipping ? 'جارٍ التجهيز…' : 'تنزيل الكل (ZIP)'}</span></button>
            </div>

            {myTurn && (
              <section className="tk-decision" aria-labelledby="tk-dec-title">
                <h3 id="tk-dec-title">قرارك على الإصدار {kit.currentVersion}</h3>
                <p className="tk-muted-s" style={{ margin: 0 }}>
                  {scope === 'pm'
                    ? 'اعتمادك يرسل الحقيبة إلى المدير للاعتماد النهائي. الإعادة ترجعها للموظف مع ملاحظاتك ليعدّلها ويرسل إصدارًا جديدًا.'
                    : 'اعتمادك نهائي ويحفظ الحقيبة في «الحقائب المعتمدة». الإعادة ترجعها للموظف، ثم تمر على مسؤول إدارة المشاريع قبل أن تعود إليك.'}
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
                    <b>أعاد {byManager ? (v?.managerName || 'المدير') : (v?.pmName || 'مسؤول إدارة المشاريع')} الحقيبة للتعديل · {fmtDay(byManager ? v?.managerAt : v?.pmAt)}</b>
                    <div className="tk-quote">{byManager ? v?.managerComment : v?.pmComment}</div>
                  </div>
                </div>
              );
            })()}
            {kit.status === 'approved' && (
              <div className="tk-note mint"><span className="tk-note-ico">✓</span><div><b>حقيبة معتمدة — الإصدار {kit.approvedVersion}</b>اعتُمدت بتاريخ {fmtDay(kit.approvedAt)}.{scope === 'mine' ? ' ستتمكن قريبًا من اختيارها عند طلب ورشة جديدة.' : ''}</div></div>
            )}

            <div className="tk-tabs" role="tablist">
              {[['doc', '📄 الحقيبة'], ['history', `🕘 السجل والملاحظات (${(kit.versions || []).length})`], ['files', `📎 الملفات (${fileRows.length + (shown?.images.length || 0)})`]].map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === 'doc' && (docLoading && !html
              ? <div className="tk-doc-loading">جارٍ تجهيز المستند…</div>
              : <iframe className="tk-doc-frame" title="الحقيبة التدريبية" srcDoc={html}
                  onLoad={(e) => { try { e.currentTarget.style.height = `${e.currentTarget.contentDocument.documentElement.scrollHeight + 4}px`; } catch { /* keep default */ } }} />)}

            {tab === 'history' && (
              <KitHistory versions={kit.versions} currentVersion={kit.currentVersion} onView={(n) => { setVersion(n); setTab('doc'); }} />
            )}

            {tab === 'files' && shown && (
              <div className="tk-panel">
                <div className="tk-panel-head"><h3 className="tk-panel-title">مرفقات {version ? `الإصدار ${version}` : 'المسودة'}</h3><p className="tk-panel-note">«تنزيل الكل» يجمعها في ملف واحد مع مستند الحقيبة.</p></div>
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
                {shown.images.length > 0 && (
                  <>
                    <div className="tk-panel-head" style={{ marginTop: 20 }}><h3 className="tk-panel-title">الصور المرجعية</h3></div>
                    <div className="tk-igrid">
                      {shown.images.map(im => (
                        <figure className="tk-itile" key={im.id}>
                          <div className="ph"><AuthedImage api={api} url={R.file(im.fileId)} alt={im.caption} /></div>
                          <figcaption className="meta">
                            <span><b className="mono">{outCode(im.outputId)}</b> {im.caption}</span>
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
      </div>
    </Portal>
  );
};

export default KitReview;
