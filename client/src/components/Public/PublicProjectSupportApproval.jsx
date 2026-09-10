import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Public.css';

// Manager's token-gated approval page for a project support request.
// Loads the request by opaque UUID, shows all fields + file list
// (per-file download on demand), and captures the manager's response
// text (which is emailed to the user as part of the decision).

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

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

const PublicProjectSupportApproval = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get('decision');

  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [managerName, setManagerName] = useState('');
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingIdx, setDownloadingIdx] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/public/project-support/${token}`);
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (err) {
        if (!cancelled) {
          const status = err.response?.status;
          setState({
            loading: false,
            error: status === 404 ? 'الرابط غير صالح أو منتهي.' : 'تعذر تحميل الطلب.',
            data: null
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const downloadFile = async (idx, meta) => {
    setDownloadingIdx(idx);
    try {
      const { data } = await axios.get(`${API_URL}/public/project-support/${token}/file/${idx}`);
      const byteChars = atob(data.fileData);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const mimeGuess = ({
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        csv: 'text/csv',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        zip: 'application/zip',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg'
      }[String(data.fileType || '').toLowerCase()]) || 'application/octet-stream';
      const blob = new Blob([bytes], { type: mimeGuess });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName || `download.${data.fileType || 'bin'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (err) {
      alert('تعذر تنزيل الملف');
    } finally {
      setDownloadingIdx(null);
    }
  };

  const decide = async (decision) => {
    if (!managerName.trim()) return alert('يرجى كتابة اسمك للاعتماد');
    if (!response.trim()) return alert('يرجى كتابة الرد الذي سيصل للمستفيد (قبول أو اعتذار مع السبب)');
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/public/project-support/${token}/decide`, {
        decision,
        managerName: managerName.trim(),
        response: response.trim()
      });
      setResult(decision === 'approve' ? 'approved' : 'rejected');
    } catch (err) {
      alert(err?.response?.data?.messageAr || err?.response?.data?.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  if (state.loading) {
    return <div className="pub-shell"><div className="pub-center"><div className="pub-loader" /></div></div>;
  }
  if (state.error) {
    return (
      <div className="pub-shell">
        <div className="pub-center">
          <div className="pub-error">
            <h2>الرابط غير متاح</h2>
            <p>{state.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const r = state.data;
  const reqNo = `PSR-${String(r.requestNumber || 0).padStart(3, '0')}`;
  const alreadyDecided = r.approvalStatus === 'approved' || r.approvalStatus === 'rejected';
  const finalStatus = result || (alreadyDecided ? r.approvalStatus : null);

  return (
    <div className="pub-shell">
      <div className="pub-wrap">
        <div className="pub-brand">
          <div className="pub-brand-mark" style={{ background: '#8b5cf6' }}>FL</div>
          <div className="pub-brand-text">
            <b>فاب لاب الأحساء</b>
            <span>اعتماد طلب دعم مشروع</span>
          </div>
        </div>

        <div className="pub-header">
          <div className="pub-header-top">
            <div>
              <div className="pub-kicker" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>طلب دعم مشروع</span>
                <span style={{
                  padding: '2px 10px', borderRadius: 999,
                  background: '#f5f3ff', color: '#6d28d9',
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: 12
                }}>{reqNo}</span>
              </div>
              <h1 className="pub-title" style={{ marginTop: 6 }}>
                {r.projectTitle || `${r.firstName} ${r.lastName || ''}`.trim()}
              </h1>
              {preselect && !alreadyDecided && (
                <div className="pub-subtitle" style={{ color: preselect === 'approve' ? '#166534' : '#b91c1c' }}>
                  💡 {preselect === 'approve' ? 'مقترح: اعتماد' : 'مقترح: رفض'} — عدّل قبل التأكيد.
                </div>
              )}
            </div>
            <span className="pub-badge" style={{
              background: alreadyDecided
                ? (r.approvalStatus === 'approved' ? '#dcfce7' : '#fee2e2')
                : '#fef3c7',
              color: alreadyDecided
                ? (r.approvalStatus === 'approved' ? '#166534' : '#991b1b')
                : '#92400e'
            }}>
              {alreadyDecided
                ? (r.approvalStatus === 'approved' ? '✓ معتمد' : '✕ مرفوض')
                : '⏳ بانتظار قرارك'}
            </span>
          </div>

          {/* Requester info */}
          <div className="pub-info-grid" style={{ marginTop: 18 }}>
            <div className="pub-info">
              <div className="pub-info-label">مقدم الطلب</div>
              <div className="pub-info-value text">{r.firstName} {r.lastName || ''}</div>
            </div>
            <div className="pub-info">
              <div className="pub-info-label">رقم الهوية</div>
              <div className="pub-info-value">{r.nationalId}</div>
            </div>
            <div className="pub-info">
              <div className="pub-info-label">الجوال</div>
              <div className="pub-info-value">{r.phoneNumber}</div>
            </div>
            <div className="pub-info">
              <div className="pub-info-label">البريد</div>
              <div className="pub-info-value">{r.email}</div>
            </div>
            {r.city && <div className="pub-info"><div className="pub-info-label">المدينة</div><div className="pub-info-value text">{r.city}</div></div>}
            {r.supportType && <div className="pub-info"><div className="pub-info-label">نوع الدعم</div><div className="pub-info-value text">{r.supportType}</div></div>}
          </div>
        </div>

        {/* Description */}
        <div className="pub-panel" style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 10px', color: '#6d28d9' }}>📝 وصف الطلب</h3>
          <div style={{
            fontSize: 14, lineHeight: 1.85, whiteSpace: 'pre-wrap',
            color: '#0f172a', padding: '14px 18px',
            background: '#faf5ff', border: '1px solid #ede9fe', borderRadius: 10
          }}>
            {r.description}
          </div>
        </div>

        {/* Files */}
        {r.files && r.files.length > 0 && (
          <div className="pub-panel" style={{ marginTop: 16 }}>
            <h3 style={{ margin: '0 0 10px', color: '#6d28d9' }}>
              📎 الملفات المرفقة ({r.files.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.files.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: '#fff',
                  border: '1px solid #e2e8f0', borderRadius: 10
                }}>
                  <span style={{ fontSize: 20 }}>{iconFor(f.fileType)}</span>
                  <span style={{ flex: 1, fontWeight: 700, color: '#0f172a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.fileName}
                  </span>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5,
                    color: '#64748b', padding: '2px 8px', background: '#f1f5f9', borderRadius: 4
                  }}>{humanBytes(f.fileSize)}</span>
                  <button
                    onClick={() => downloadFile(i, f)}
                    disabled={downloadingIdx === i}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none',
                      background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                      color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      opacity: downloadingIdx === i ? 0.6 : 1
                    }}
                  >
                    {downloadingIdx === i ? '...' : '⬇️ تنزيل'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decision panel */}
        {finalStatus ? (
          <div className="pub-panel" style={{
            marginTop: 16,
            background: finalStatus === 'approved' ? '#f0fdf4' : '#fef2f2',
            border: `2px solid ${finalStatus === 'approved' ? '#16a34a' : '#dc2626'}`
          }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>
                {finalStatus === 'approved' ? '✅' : '❌'}
              </div>
              <h3 style={{
                margin: '0 0 8px',
                color: finalStatus === 'approved' ? '#166534' : '#991b1b'
              }}>
                {finalStatus === 'approved' ? 'تم اعتماد الطلب — شكراً لكم' : 'تم رفض الطلب — تم إشعار المستفيد'}
              </h3>
              <p style={{ margin: 0, color: '#475569', fontSize: 13.5 }}>
                سيصل قراركم للمستفيد عبر البريد الإلكتروني تلقائياً.
              </p>
            </div>
          </div>
        ) : (
          <div className="pub-panel" style={{ marginTop: 16 }}>
            <h3 style={{ margin: '0 0 12px', color: '#6d28d9' }}>💬 قراركم</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <label>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                  اسم المدير المعتمد *
                </div>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="مثال: أ. زكي اللويم"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit'
                  }}
                />
              </label>
              <label>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4, color: '#334155' }}>
                  الرد الذي سيصل للمستفيد * (يظهر في بريده الإلكتروني)
                </div>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={5}
                  placeholder="اكتب الرد بوضوح — عند الموافقة: التفاصيل والخطوة التالية. عند الاعتذار: السبب واقتراحات بديلة إن أمكن."
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </label>
              <div style={{
                display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap',
                marginTop: 6, paddingTop: 12, borderTop: '1px dashed #e2e8f0'
              }}>
                <button
                  onClick={() => decide('reject')}
                  disabled={submitting}
                  style={{
                    padding: '12px 24px', borderRadius: 10, border: '1.5px solid #fecaca',
                    background: '#fff', color: '#b91c1c',
                    fontFamily: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer'
                  }}
                >
                  ✕ رفض وإرسال الرد
                </button>
                <button
                  onClick={() => decide('approve')}
                  disabled={submitting}
                  style={{
                    padding: '12px 28px', borderRadius: 10, border: 'none',
                    background: submitting ? '#a7f3d0' : 'linear-gradient(135deg, #16a34a, #15803d)',
                    color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: 14,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 6px 16px -6px rgba(22, 163, 74, 0.5)'
                  }}
                >
                  {submitting ? '⏳ جارٍ...' : '✓ اعتماد وإرسال الرد'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pub-footer">
          <span>© {new Date().getFullYear()} فاب لاب الأحساء</span>
        </div>
      </div>
    </div>
  );
};

export default PublicProjectSupportApproval;
