import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './Approvals.css';

// Manager's queue for طلبات الدعم للمشروع (project support requests).
// Same shape as FablabVisitApprovals but the decision requires a
// written response — that text is what gets emailed to the user.

// Dates render with the day-of-week (السبت / Sunday) for at-a-glance
// clarity in the queue.
const fmtWhen = (iso, locale) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(locale || undefined, {
      weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
};
const fmtReqNo = (n) => n == null ? '—' : `PSR-${String(n).padStart(3, '0')}`;

const iconFor = (ext) => {
  const e = String(ext || '').toLowerCase();
  if (['doc', 'docx'].includes(e)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📊';
  if (['ppt', 'pptx'].includes(e)) return '📽️';
  if (['pdf'].includes(e)) return '📕';
  if (['zip', 'rar', '7z'].includes(e)) return '📦';
  if (['png', 'jpg', 'jpeg'].includes(e)) return '🖼️';
  return '📎';
};
const humanBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

// Support-type label map (mirrors the whitelist on the server).
const SUPPORT_TYPE_LABELS = {
  funding:    '💰 دعم مالي',
  tech:       '🛠 دعم فني',
  materials:  '📦 مواد وأدوات',
  mentorship: '👨‍🏫 إرشاد وتوجيه',
  other:      '🎯 أخرى'
};
const labelSupportType = (v) => SUPPORT_TYPE_LABELS[v] || v;
const supportTypeList = (r) => {
  if (Array.isArray(r?.supportTypes)) return r.supportTypes;
  if (r?.supportType) return [r.supportType];
  return [];
};

const ProjectSupportApprovals = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const locale = isRTL ? 'ar-SA' : undefined;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(() => new Set());
  // decidingId + decisionMode + response text captured together so
  // approve and reject share the same input UX.
  const [deciding, setDeciding] = useState(null); // { id, mode: 'approve' | 'reject' }
  const [response, setResponse] = useState('');
  const [detailFiles, setDetailFiles] = useState({}); // { [requestId]: [{ index, fileName, fileType, fileSize }] }
  const [downloadingKey, setDownloadingKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/project-support/pending');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل طلبات الدعم' : 'Failed to load support requests');
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    // Lazy-load file metadata for this request when first expanded.
    if (!detailFiles[id]) {
      try {
        const { data } = await api.get(`/project-support/${id}`);
        setDetailFiles(prev => ({
          ...prev,
          [id]: (Array.isArray(data.files) ? data.files : []).map((f, i) => ({
            index: i,
            fileName: f.fileName,
            fileType: f.fileType,
            fileSize: f.fileSize
          }))
        }));
      } catch { /* silently ignore — files just won't show */ }
    }
  };

  const downloadFile = async (requestId, index, meta) => {
    const key = `${requestId}:${index}`;
    setDownloadingKey(key);
    try {
      const { data } = await api.get(`/project-support/${requestId}/files/${index}`);
      const byteChars = atob(data.fileData);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.fileName || `download.${data.fileType || 'bin'}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch {
      toast.error(isRTL ? 'تعذر تنزيل الملف' : 'Download failed');
    } finally {
      setDownloadingKey(null);
    }
  };

  const openDecide = (row, mode) => {
    setDeciding({ id: row.requestId, mode });
    setResponse('');
  };

  const deleteRow = async (row) => {
    const label = row.projectTitle || `${row.firstName || ''} ${row.lastName || ''}`.trim();
    if (!window.confirm(isRTL
      ? `حذف طلب الدعم "${label}" نهائياً؟ لا يمكن التراجع.`
      : `Delete support request "${label}" permanently? This cannot be undone.`)) return;
    setBusy(prev => new Set(prev).add(row.requestId));
    try {
      await api.delete(`/project-support/${row.requestId}`);
      toast.success(isRTL ? 'تم حذف الطلب' : 'Request deleted');
      setRows(prev => prev.filter(x => x.requestId !== row.requestId));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر الحذف' : 'Delete failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(row.requestId); return n; });
    }
  };
  const submitDecide = async () => {
    if (!deciding) return;
    if (!response.trim()) {
      return toast.error(isRTL
        ? 'اكتب الرد الذي سيصل للمستفيد'
        : 'Write the response that will be emailed to the user');
    }
    setBusy(prev => new Set(prev).add(deciding.id));
    try {
      const url = `/project-support/${deciding.id}/${deciding.mode === 'approve' ? 'manager-approve' : 'manager-reject'}`;
      await api.post(url, { response: response.trim() });
      toast.success(deciding.mode === 'approve'
        ? (isRTL ? '✓ تم اعتماد الطلب وإرسال الرد' : '✓ Approved & response emailed')
        : (isRTL ? '✕ تم رفض الطلب وإرسال الرد' : '✕ Rejected & response emailed'));
      setRows(prev => prev.filter(r => r.requestId !== deciding.id));
      setDeciding(null);
      setResponse('');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الإرسال' : 'Failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(deciding.id); return n; });
    }
  };

  return (
    <div className="ap">
      <div className="ap-head">
        <h2>💜 {isRTL ? 'اعتماد طلبات دعم المشاريع' : 'Project Support Approvals'}</h2>
        <span className="ap-count" style={{ background: '#8b5cf6' }}>
          {rows.length} {isRTL ? 'بانتظار' : 'pending'}
        </span>
        <button className="ap-refresh" onClick={load}>
          ↻ {isRTL ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="ap-loading">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
      ) : rows.length === 0 ? (
        <div className="ap-empty">
          ✅ {isRTL ? 'لا توجد طلبات دعم بحاجة لاعتماد.' : 'No pending support requests.'}
        </div>
      ) : (
        <div className="ap-grid">
          {rows.map(r => {
            const isExpanded = expanded.has(r.requestId);
            const isBusy = busy.has(r.requestId);
            const isDeciding = deciding?.id === r.requestId;
            const files = detailFiles[r.requestId] || [];
            return (
              <div key={r.requestId} className="ap-card" style={{ borderInlineStart: '4px solid #8b5cf6' }}>
                <div className="ap-card-top">
                  <div className="ap-card-lead">
                    <div className="ap-card-lead-line">
                      <span className="ap-hash" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
                        {fmtReqNo(r.requestNumber)}
                      </span>
                      <div className="ap-title">
                        {r.projectTitle || `${r.firstName} ${r.lastName || ''}`.trim()}
                      </div>
                    </div>
                    <div className="ap-sub">
                      <b>{r.firstName} {r.lastName || ''}</b>
                      {' · '}
                      <span dir="ltr">{r.phoneNumber}</span>
                      {' · '}
                      <span dir="ltr">{r.email}</span>
                    </div>
                    {r.sentForApprovalAt && (
                      <div className="ap-when">📤 {isRTL ? 'أرسل:' : 'sent'} {fmtWhen(r.sentForApprovalAt, locale)}</div>
                    )}
                  </div>
                  <div className="ap-card-right">
                    {supportTypeList(r).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
                        {supportTypeList(r).map(v => (
                          <span key={v} className="ap-pill" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
                            {labelSupportType(v)}
                          </span>
                        ))}
                      </div>
                    )}
                    <button className="ap-toggle" onClick={() => toggle(r.requestId)}>
                      {isExpanded ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'التفاصيل' : 'Details')}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ap-body">
                    {/* Detail cards — every field, grouped */}
                    <div className="ap-detail-cards">
                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title" style={{ color: '#8b5cf6' }}>
                          {isRTL ? 'بيانات مقدم الطلب' : 'Requester'}
                        </div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'الاسم' : 'Name'}</div><div className="ap-kv-value">{r.firstName} {r.lastName || ''}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'رقم الهوية' : 'National ID'}</div><div className="ap-kv-value" dir="ltr">{r.nationalId || '—'}</div></div>
                          {r.age && <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'العمر' : 'Age'}</div><div className="ap-kv-value">{r.age}</div></div>}
                          {r.city && <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'المدينة' : 'City'}</div><div className="ap-kv-value">{r.city}</div></div>}
                          {r.nationality && <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'الجنسية' : 'Nationality'}</div><div className="ap-kv-value">{r.nationality}</div></div>}
                        </div>
                      </div>

                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title" style={{ color: '#8b5cf6' }}>
                          {isRTL ? 'التواصل' : 'Contact'}
                        </div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'الجوال' : 'Phone'}</div><div className="ap-kv-value" dir="ltr">{r.phoneNumber || '—'}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'البريد' : 'Email'}</div><div className="ap-kv-value" dir="ltr">{r.email || '—'}</div></div>
                        </div>
                      </div>

                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title" style={{ color: '#8b5cf6' }}>
                          {isRTL ? 'سجل الطلب' : 'Request Log'}
                        </div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'رقم الطلب' : 'Number'}</div><div className="ap-kv-value">{fmtReqNo(r.requestNumber)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'أُنشئ في' : 'Created'}</div><div className="ap-kv-value" dir="ltr">{fmtWhen(r.createdAt, locale)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'أُرسل للاعتماد' : 'Sent'}</div><div className="ap-kv-value" dir="ltr">{fmtWhen(r.sentForApprovalAt, locale)}</div></div>
                        </div>
                      </div>
                    </div>

                    <div className="ap-block">
                      <div className="ap-block-label">{isRTL ? 'وصف الطلب' : 'Description'}</div>
                      <div className="ap-block-text" style={{ whiteSpace: 'pre-wrap' }}>{r.description}</div>
                    </div>

                    {files.length > 0 && (
                      <div className="ap-block">
                        <div className="ap-block-label">
                          {isRTL ? `الملفات المرفقة (${files.length})` : `Attached files (${files.length})`}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {files.map(f => (
                            <div key={f.index} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px', background: '#fff',
                              border: '1px solid #e2e8f0', borderRadius: 8
                            }}>
                              <span style={{ fontSize: 18 }}>{iconFor(f.fileType)}</span>
                              <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.fileName}
                              </span>
                              <span style={{
                                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                                color: '#64748b', padding: '2px 8px', background: '#f1f5f9', borderRadius: 4
                              }}>{humanBytes(f.fileSize)}</span>
                              <button
                                onClick={() => downloadFile(r.requestId, f.index, f)}
                                disabled={downloadingKey === `${r.requestId}:${f.index}`}
                                style={{
                                  padding: '5px 12px', border: 'none', borderRadius: 6,
                                  background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                                  color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 11.5,
                                  cursor: 'pointer'
                                }}
                              >
                                {downloadingKey === `${r.requestId}:${f.index}` ? '...' : (isRTL ? '⬇️ تنزيل' : '⬇️ Download')}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isDeciding ? (
                  <div className="ap-reject-panel" style={{
                    background: deciding.mode === 'approve' ? '#f0fdf4' : '#fef2f2',
                    borderColor: deciding.mode === 'approve' ? '#86efac' : '#fecaca'
                  }}>
                    <div className="ap-reject-label">
                      💬 {isRTL
                        ? (deciding.mode === 'approve'
                            ? 'رد الموافقة (سيصل للمستفيد على بريده) *'
                            : 'رد الاعتذار (سيصل للمستفيد على بريده) *')
                        : (deciding.mode === 'approve'
                            ? 'Approval response (emailed to the user) *'
                            : 'Rejection response (emailed to the user) *')}
                    </div>
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      rows={4}
                      placeholder={deciding.mode === 'approve'
                        ? (isRTL ? 'اذكر تفاصيل الموافقة والخطوة التالية للمستفيد...' : 'Explain approval + next steps...')
                        : (isRTL ? 'اذكر سبب الاعتذار واقتراحات بديلة إن أمكن...' : 'Explain why + alternatives...')}
                      autoFocus
                    />
                    <div className="ap-reject-actions">
                      <button className="ap-btn ap-btn--ghost" onClick={() => { setDeciding(null); setResponse(''); }}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        className={`ap-btn ${deciding.mode === 'approve' ? 'ap-btn--approve' : 'ap-btn--danger'}`}
                        onClick={submitDecide}
                        disabled={isBusy}
                      >
                        {isBusy ? '…' : (deciding.mode === 'approve'
                          ? (isRTL ? '✓ اعتماد وإرسال الرد' : '✓ Approve & send')
                          : (isRTL ? '✕ رفض وإرسال الرد' : '✕ Reject & send'))}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ap-actions">
                    <button
                      className="ap-btn"
                      style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}
                      onClick={() => deleteRow(r)}
                      disabled={isBusy}
                      title={isRTL ? 'حذف الطلب نهائياً' : 'Delete permanently'}
                    >
                      🗑 {isRTL ? 'حذف' : 'Delete'}
                    </button>
                    <button className="ap-btn ap-btn--reject" onClick={() => openDecide(r, 'reject')} disabled={isBusy}>
                      ✕ {isRTL ? 'رفض مع رد' : 'Reject w/ response'}
                    </button>
                    <button className="ap-btn ap-btn--approve" onClick={() => openDecide(r, 'approve')} disabled={isBusy}>
                      ✓ {isRTL ? 'اعتماد مع رد' : 'Approve w/ response'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectSupportApprovals;
