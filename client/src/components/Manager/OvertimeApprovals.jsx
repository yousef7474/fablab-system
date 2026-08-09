import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';

const fmtDate = (v) => v ? String(v).slice(0, 10) : '—';
const fmtWhen = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch { return ''; }
};

const OvertimeApprovals = () => {
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
      const { data } = await api.get('/overtime/pending');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل الطلبات' : 'Failed to load pending requests');
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
    setBusy(prev => new Set(prev).add(row.overtimeId));
    try {
      await api.post(`/overtime/${row.overtimeId}/approve`);
      toast.success(isRTL ? 'تم الاعتماد' : 'Approved');
      setRows(prev => prev.filter(r => r.overtimeId !== row.overtimeId));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الاعتماد' : 'Approve failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(row.overtimeId); return n; });
    }
  };

  const openReject = (row) => {
    setRejectingId(row.overtimeId);
    setRejectNote('');
  };
  const doReject = async () => {
    if (!rejectNote.trim()) {
      return toast.error(isRTL ? 'سبب الرفض مطلوب' : 'Reason required');
    }
    setBusy(prev => new Set(prev).add(rejectingId));
    try {
      await api.post(`/overtime/${rejectingId}/reject`, { note: rejectNote.trim() });
      toast.success(isRTL ? 'تم الرفض' : 'Rejected');
      setRows(prev => prev.filter(r => r.overtimeId !== rejectingId));
      setRejectingId(null);
      setRejectNote('');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الرفض' : 'Reject failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(rejectingId); return n; });
    }
  };

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
          🕓 {isRTL ? 'اعتماد الساعات الإضافية' : 'Overtime Approvals'}
        </h2>
        <span style={{
          padding: '4px 12px', borderRadius: 999,
          background: '#fef3c7', color: '#92400e',
          border: '1px solid #fde68a',
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
          ✅ {isRTL ? 'لا توجد طلبات بحاجة لاعتماد.' : 'No pending approvals.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(r => {
            const isExpanded = expanded.has(r.overtimeId);
            const isBusy = busy.has(r.overtimeId);
            return (
              <div key={r.overtimeId} style={{
                background: 'var(--card-bg, #fff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderInlineStart: '4px solid #d97706',
                borderRadius: 12, overflow: 'hidden'
              }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary, #0f172a)' }}>{r.employeeName}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {r.position || '—'} · {fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}
                    </div>
                    {r.sentForApprovalAt && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        📤 {isRTL ? 'أرسل:' : 'sent'} {fmtWhen(r.sentForApprovalAt)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#fff',
                      padding: '6px 14px', borderRadius: 999, fontWeight: 800, fontSize: 13
                    }}>
                      {Number(r.totalHours || 0).toFixed(2)} {isRTL ? 'ساعة' : 'hrs'}
                    </span>
                    <button
                      onClick={() => toggle(r.overtimeId)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}
                    >
                      {isExpanded ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'التفاصيل' : 'Details')}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 18px 12px', background: '#f8fafc' }}>
                    {r.note && (
                      <div style={{ padding: 10, marginBottom: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#334155' }}>
                        <b>{isRTL ? 'ملاحظة الإدارة: ' : 'Admin note: '}</b>{r.note}
                      </div>
                    )}
                    <div style={{ overflow: 'auto', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f5f3ff' }}>
                            <th style={{ padding: 8, textAlign: 'right', color: '#6d28d9' }}>{isRTL ? 'التاريخ' : 'Date'}</th>
                            <th style={{ padding: 8, textAlign: 'center', color: '#6d28d9' }}>{isRTL ? 'الوقت' : 'Time'}</th>
                            <th style={{ padding: 8, textAlign: 'center', color: '#6d28d9' }}>{isRTL ? 'الساعات' : 'Hours'}</th>
                            <th style={{ padding: 8, textAlign: 'right', color: '#6d28d9' }}>{isRTL ? 'المهمة' : 'Task'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(r.days || []).map((d, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: 8, fontFamily: 'JetBrains Mono, monospace' }}>{d.date || '—'}</td>
                              <td style={{ padding: 8, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }} dir="ltr">
                                {d.startTime || ''}{d.startTime && d.endTime ? ' - ' : ''}{d.endTime || ''}
                              </td>
                              <td style={{ padding: 8, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}>{Number(d.hours || 0).toFixed(2)}</td>
                              <td style={{ padding: 8 }}>{d.task || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {rejectingId === r.overtimeId ? (
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

export default OvertimeApprovals;
