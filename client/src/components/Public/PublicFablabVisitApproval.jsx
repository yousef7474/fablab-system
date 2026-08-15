import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Public.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const fmtDate = (v) => v ? String(v).slice(0, 10) : '—';
const fmtTime = (t) => t ? String(t).slice(0, 5) : '—';

const PublicFablabVisitApproval = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get('decision');

  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [managerName, setManagerName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/public/fablab-visit/${token}`);
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

  const decide = async (decision) => {
    if (!managerName.trim()) return alert('يرجى كتابة اسمك للاعتماد');
    if (decision === 'reject' && !note.trim()) return alert('يرجى كتابة سبب الرفض');
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/public/fablab-visit/${token}/decide`, {
        decision,
        managerName: managerName.trim(),
        note: note.trim() || null
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
  const alreadyDecided = r.approvalStatus === 'approved' || r.approvalStatus === 'rejected';
  const finalStatus = result || (alreadyDecided ? r.approvalStatus : null);

  return (
    <div className="pub-shell">
      <div className="pub-wrap">
        <div className="pub-brand">
          <div className="pub-brand-mark" style={{ background: '#0ea5e9' }}>FL</div>
          <div className="pub-brand-text">
            <b>فاب لاب الأحساء</b>
            <span>اعتماد طلب زيارة</span>
          </div>
        </div>

        <div className="pub-header">
          <div className="pub-header-top">
            <div>
              <div className="pub-kicker" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>طلب زيارة</span>
                {r.visitNumber != null && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '2px 10px', borderRadius: 999, letterSpacing: 1 }}>
                    V-{String(r.visitNumber).padStart(3, '0')}
                  </span>
                )}
              </div>
              <h1 className="pub-title">{r.entityName}</h1>
              {r.personInCharge && <div className="pub-subtitle">مسؤول: {r.personInCharge}</div>}
            </div>
            {finalStatus === 'approved' && (
              <span className="pub-badge" style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #a7f3d0' }}>
                <span className="pub-badge-dot" style={{ background: '#16a34a' }} />
                معتمد
              </span>
            )}
            {finalStatus === 'rejected' && (
              <span className="pub-badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                <span className="pub-badge-dot" style={{ background: '#dc2626' }} />
                مرفوض
              </span>
            )}
            {!finalStatus && (
              <span className="pub-badge" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                <span className="pub-badge-dot" style={{ background: '#d97706' }} />
                بانتظار الاعتماد
              </span>
            )}
          </div>

          <div className="pub-info-grid">
            <div className="pub-info"><div className="pub-info-label">الجوال</div><div className="pub-info-value" dir="ltr">{r.phone}</div></div>
            <div className="pub-info"><div className="pub-info-label">البريد</div><div className="pub-info-value" dir="ltr">{r.email}</div></div>
            <div className="pub-info"><div className="pub-info-label">عدد الزوار</div><div className="pub-info-value">{r.visitorsCount || 1}</div></div>
            <div className="pub-info"><div className="pub-info-label">تاريخ الزيارة</div><div className="pub-info-value" dir="ltr">{fmtDate(r.visitDate)}</div></div>
            <div className="pub-info"><div className="pub-info-label">الوقت</div><div className="pub-info-value" dir="ltr">{fmtTime(r.visitStartTime)} → {fmtTime(r.visitEndTime)}</div></div>
          </div>
        </div>

        <div className="pub-panel">
          <div className="pub-panel-title"><h3>الغرض من الزيارة</h3></div>
          <div style={{ padding: '4px 4px 8px', whiteSpace: 'pre-wrap', color: '#334155', lineHeight: 1.75 }}>
            {r.purpose}
          </div>
          {r.notes && (
            <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 14, color: '#334155' }}>
              <b>ملاحظات: </b>{r.notes}
            </div>
          )}
        </div>

        {!finalStatus && (
          <div className="pub-panel" style={{ borderColor: '#fde68a' }}>
            <div className="pub-panel-title">
              <h3>القرار</h3>
              <span className="pub-panel-hint">
                {preselect === 'approve' ? 'مقترح: اعتماد' : preselect === 'reject' ? 'مقترح: رفض' : ''}
              </span>
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
              <label>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>اسمك (المعتمد) *</div>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="اسم المدير"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: 14 }}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>ملاحظة (اختيارية للاعتماد، مطلوبة للرفض)</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="ملاحظة اختيارية…"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => decide('approve')}
                disabled={submitting}
                style={{
                  padding: '14px 32px', borderRadius: 10, border: 'none',
                  background: '#16a34a', color: '#fff', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 800, fontSize: 15,
                  boxShadow: '0 4px 14px rgba(22,163,74,0.35)'
                }}
              >
                ✓ اعتماد الطلب
              </button>
              <button
                onClick={() => decide('reject')}
                disabled={submitting}
                style={{
                  padding: '14px 32px', borderRadius: 10, border: '1px solid #fecaca',
                  background: '#fff', color: '#dc2626', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 800, fontSize: 15
                }}
              >
                ✕ رفض
              </button>
            </div>
          </div>
        )}

        {finalStatus === 'approved' && (
          <div className="pub-panel" style={{ borderColor: '#a7f3d0', background: '#ecfdf5' }}>
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
              <h3 style={{ color: '#16a34a', margin: '0 0 8px', fontSize: 22 }}>تم اعتماد الطلب</h3>
              <p style={{ color: '#475569', margin: 0 }}>ستقوم الإدارة الآن بإشعار الجهة الزائرة بالقرار النهائي.</p>
              {r.managerName && <p style={{ marginTop: 10, color: '#334155' }}>المعتمد: <b>{r.managerName}</b></p>}
            </div>
          </div>
        )}

        {finalStatus === 'rejected' && (
          <div className="pub-panel" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>❌</div>
              <h3 style={{ color: '#dc2626', margin: '0 0 8px', fontSize: 22 }}>تم رفض الطلب</h3>
              {r.managerNote && <p style={{ color: '#475569', margin: 0 }}>السبب: {r.managerNote}</p>}
            </div>
          </div>
        )}

        <div className="pub-footer">
          <span>© {new Date().getFullYear()} فاب لاب الأحساء</span>
          <span>fablabsahsa.com</span>
        </div>
      </div>
    </div>
  );
};

export default PublicFablabVisitApproval;
