import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './Public.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const fmtDate = (v) => v ? String(v).slice(0, 10) : '—';

const PublicOvertimeApproval = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get('decision'); // 'approve' | 'reject' | null

  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [approverName, setApproverName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // 'approved' | 'rejected' | null

  // Scroll to top on mount so a long email dump doesn't scroll the
  // reader past the header.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/public/overtime/${token}`);
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
    if (!approverName.trim()) {
      return alert('يرجى كتابة اسمك للاعتماد');
    }
    if (decision === 'reject' && !note.trim()) {
      return alert('يرجى كتابة سبب الرفض');
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/public/overtime/${token}/decide`, {
        decision,
        approvedBy: approverName.trim(),
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
    return (
      <div className="pub-shell">
        <div className="pub-center"><div className="pub-loader" /></div>
      </div>
    );
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
          <div className="pub-brand-mark">FL</div>
          <div className="pub-brand-text">
            <b>فاب لاب الأحساء</b>
            <span>اعتماد ساعات إضافية</span>
          </div>
        </div>

        <div className="pub-header">
          <div className="pub-header-top">
            <div>
              <div className="pub-kicker">طلب اعتماد</div>
              <h1 className="pub-title">{r.employeeName}</h1>
              {r.position && <div className="pub-subtitle">{r.position}</div>}
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
            {r.nationalId && (
              <div className="pub-info">
                <div className="pub-info-label">رقم الهوية</div>
                <div className="pub-info-value">{r.nationalId}</div>
              </div>
            )}
            {r.phone && (
              <div className="pub-info">
                <div className="pub-info-label">الجوال</div>
                <div className="pub-info-value">{r.phone}</div>
              </div>
            )}
            <div className="pub-info">
              <div className="pub-info-label">الفترة</div>
              <div className="pub-info-value">{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</div>
            </div>
            <div className="pub-info">
              <div className="pub-info-label">إجمالي الساعات</div>
              <div className="pub-info-value">{Number(r.totalHours || 0).toFixed(2)}</div>
            </div>
          </div>

          {r.note && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 14, color: '#334155' }}>
              <b>ملاحظة الإدارة: </b>{r.note}
            </div>
          )}
        </div>

        {/* Days table */}
        <div className="pub-panel">
          <div className="pub-panel-title">
            <h3>تفصيل الأيام</h3>
            <span className="pub-panel-hint">{(r.days || []).length} يوم</span>
          </div>
          <div className="pub-table-wrap">
            <table className="pub-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الوقت</th>
                  <th>الساعات</th>
                  <th>المهمة</th>
                </tr>
              </thead>
              <tbody>
                {(r.days || []).map((d, i) => (
                  <tr key={i}>
                    <td className="pub-num">{d.date || '—'}</td>
                    <td className="pub-time">
                      {d.startTime || d.endTime
                        ? <span dir="ltr">{d.startTime || ''}{d.startTime && d.endTime ? ' - ' : ''}{d.endTime || ''}</span>
                        : '—'}
                    </td>
                    <td className="pub-num">{Number(d.hours || 0).toFixed(2)}</td>
                    <td>{d.task || <span className="pub-cell-empty">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Decision panel */}
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
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  اسمك (المعتمد) *
                </div>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  placeholder="اسم المدير"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: 14 }}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  ملاحظة (اختيارية للاعتماد، مطلوبة للرفض)
                </div>
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
              <h3 style={{ color: '#16a34a', margin: '0 0 8px', fontSize: 22 }}>تم الاعتماد</h3>
              <p style={{ color: '#475569', margin: 0 }}>سيتمكن الإدارة الآن من طباعة السند.</p>
              {r.approvedBy && (
                <p style={{ marginTop: 10, color: '#334155' }}>المعتمد: <b>{r.approvedBy}</b></p>
              )}
            </div>
          </div>
        )}

        {finalStatus === 'rejected' && (
          <div className="pub-panel" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>❌</div>
              <h3 style={{ color: '#dc2626', margin: '0 0 8px', fontSize: 22 }}>تم رفض الطلب</h3>
              {r.managerNote && (
                <p style={{ color: '#475569', margin: 0 }}>السبب: {r.managerNote}</p>
              )}
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

export default PublicOvertimeApproval;
