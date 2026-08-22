import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';

const fmtWhen = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
};
const fmtVisitNo = (n) => n == null ? '—' : `V-${String(n).padStart(3, '0')}`;

const FablabVisitApprovals = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(() => new Set());
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fablab-visits/pending');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل طلبات الزيارة' : 'Failed to load pending visits');
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const approve = async (row) => {
    setBusy(prev => new Set(prev).add(row.visitId));
    try {
      await api.post(`/fablab-visits/${row.visitId}/manager-approve`);
      toast.success(isRTL ? 'تم اعتماد الزيارة' : 'Visit approved');
      setRows(prev => prev.filter(r => r.visitId !== row.visitId));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الاعتماد' : 'Approve failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(row.visitId); return n; });
    }
  };

  const openReject = (row) => {
    setRejectingId(row.visitId);
    setRejectNote('');
  };
  const doReject = async () => {
    if (!rejectNote.trim()) {
      return toast.error(isRTL ? 'سبب الرفض مطلوب' : 'Reason required');
    }
    setBusy(prev => new Set(prev).add(rejectingId));
    try {
      await api.post(`/fablab-visits/${rejectingId}/manager-reject`, { note: rejectNote.trim() });
      toast.success(isRTL ? 'تم رفض الزيارة' : 'Visit rejected');
      setRows(prev => prev.filter(r => r.visitId !== rejectingId));
      setRejectingId(null);
      setRejectNote('');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الرفض' : 'Reject failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(rejectingId); return n; });
    }
  };

  return (
    <div style={{ padding: '4px 2px', marginTop: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
          🏢 {isRTL ? 'اعتماد طلبات زيارة فاب لاب' : 'FabLab Visit Approvals'}
        </h2>
        <span style={{
          padding: '4px 12px', borderRadius: 999,
          background: '#dbeafe', color: '#1e40af',
          border: '1px solid #93c5fd',
          fontSize: 12, fontWeight: 800
        }}>
          {rows.length} {isRTL ? 'بانتظار' : 'pending'}
        </span>
        <button
          onClick={load}
          style={{ marginInlineStart: 'auto', padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}
        >
          ↻ {isRTL ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
      ) : rows.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: 'var(--card-bg, #fff)', border: '1px dashed var(--border-color, #e2e8f0)',
          borderRadius: 12, color: 'var(--text-secondary, #94a3b8)'
        }}>
          ✅ {isRTL ? 'لا توجد طلبات زيارة بحاجة لاعتماد.' : 'No pending visit approvals.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(r => {
            const isExpanded = expanded.has(r.visitId);
            const isBusy = busy.has(r.visitId);
            return (
              <div key={r.visitId} style={{
                background: 'var(--card-bg, #fff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderInlineStart: '4px solid #0ea5e9',
                borderRadius: 12, overflow: 'hidden'
              }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0ea5e9', fontSize: 12, letterSpacing: 1.2 }}>
                        {fmtVisitNo(r.visitNumber)}
                      </span>
                      <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary, #0f172a)' }}>{r.entityName}</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      {r.personInCharge} · <span dir="ltr">{r.visitDate}</span> · <span dir="ltr">{r.visitStartTime} → {r.visitEndTime}</span>
                    </div>
                    {r.sentForApprovalAt && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        📤 {isRTL ? 'أرسل:' : 'sent'} {fmtWhen(r.sentForApprovalAt)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff',
                      padding: '6px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13
                    }}>
                      👥 {r.visitorsCount} {isRTL ? 'زائر' : 'visitors'}
                    </span>
                    <button
                      onClick={() => toggle(r.visitId)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}
                    >
                      {isExpanded ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'التفاصيل' : 'Details')}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 18px 12px', background: '#f8fafc' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 10 }}>
                      <div style={{ padding: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ color: '#64748b', fontWeight: 700, marginBottom: 2 }}>{isRTL ? 'الجوال' : 'Phone'}</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{r.phone || '—'}</div>
                      </div>
                      <div style={{ padding: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ color: '#64748b', fontWeight: 700, marginBottom: 2 }}>{isRTL ? 'البريد' : 'Email'}</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{r.email || '—'}</div>
                      </div>
                      <div style={{ padding: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ color: '#64748b', fontWeight: 700, marginBottom: 2 }}>{isRTL ? 'رقم الهوية' : 'National ID'}</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">{r.nationalId || '—'}</div>
                      </div>
                    </div>
                    <div style={{ padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                        {isRTL ? 'الغرض من الزيارة' : 'Purpose of visit'}
                      </div>
                      <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{r.purpose}</div>
                    </div>
                    {r.notes && (
                      <div style={{ padding: 10, background: '#fffbeb', border: '1px solid #fde68a', borderInlineStart: '3px solid #f59e0b', borderRadius: 8, fontSize: 13, color: '#78350f', whiteSpace: 'pre-wrap' }}>
                        <b>{isRTL ? 'ملاحظات: ' : 'Notes: '}</b>{r.notes}
                      </div>
                    )}
                  </div>
                )}

                {rejectingId === r.visitId ? (
                  <div style={{ padding: '12px 18px', background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>
                      {isRTL ? 'سبب الرفض *' : 'Rejection reason *'}
                    </div>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #fecaca', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setRejectingId(null); setRejectNote(''); }}
                        style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                      >
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        onClick={doReject}
                        disabled={isBusy}
                        style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}
                      >
                        {isBusy ? '…' : (isRTL ? 'تأكيد الرفض' : 'Confirm reject')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 12, display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                    <button
                      onClick={() => openReject(r)}
                      disabled={isBusy}
                      style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}
                    >
                      ✕ {isRTL ? 'رفض' : 'Reject'}
                    </button>
                    <button
                      onClick={() => approve(r)}
                      disabled={isBusy}
                      style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13 }}
                    >
                      {isBusy ? '…' : (isRTL ? '✓ اعتماد' : '✓ Approve')}
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

export default FablabVisitApprovals;
