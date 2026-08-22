import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './Approvals.css';

const fmtDate = (v) => v ? String(v).slice(0, 10) : '—';
const fmtWhen = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
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

  const toggle = (id) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

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

  const openReject = (row) => { setRejectingId(row.overtimeId); setRejectNote(''); };
  const doReject = async () => {
    if (!rejectNote.trim()) return toast.error(isRTL ? 'سبب الرفض مطلوب' : 'Reason required');
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
    <div className="ap">
      <div className="ap-head">
        <h2>🕓 {isRTL ? 'اعتماد الساعات الإضافية' : 'Overtime Approvals'}</h2>
        <span className="ap-count ap-count--amber">
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
          ✅ {isRTL ? 'لا توجد طلبات ساعات إضافية بحاجة لاعتماد.' : 'No pending overtime approvals.'}
        </div>
      ) : (
        <div className="ap-grid">
          {rows.map(r => {
            const isExpanded = expanded.has(r.overtimeId);
            const isBusy = busy.has(r.overtimeId);
            return (
              <div key={r.overtimeId} className="ap-card ap-card--overtime">
                <div className="ap-card-top">
                  <div className="ap-card-lead">
                    <div className="ap-card-lead-line">
                      <div className="ap-title">{r.employeeName}</div>
                    </div>
                    <div className="ap-sub">
                      <b>{r.position || (isRTL ? 'غير محدد' : 'Unspecified')}</b>
                      {' · '}
                      <span dir="ltr">{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</span>
                    </div>
                    {r.sentForApprovalAt && (
                      <div className="ap-when">📤 {isRTL ? 'أرسل:' : 'sent'} {fmtWhen(r.sentForApprovalAt)}</div>
                    )}
                  </div>
                  <div className="ap-card-right">
                    <span className="ap-pill ap-pill--overtime">
                      {Number(r.totalHours || 0).toFixed(2)} {isRTL ? 'ساعة' : 'hrs'}
                    </span>
                    <button className="ap-toggle" onClick={() => toggle(r.overtimeId)}>
                      {isExpanded ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'التفاصيل' : 'Details')}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ap-body">
                    {r.note && (
                      <div className="ap-block ap-block--admin">
                        <div className="ap-block-label">{isRTL ? 'ملاحظة الإدارة' : 'Admin note'}</div>
                        <div className="ap-block-text">{r.note}</div>
                      </div>
                    )}
                    <div className="ap-table-wrap">
                      <table className="ap-table">
                        <thead>
                          <tr>
                            <th>{isRTL ? 'التاريخ' : 'Date'}</th>
                            <th className="center">{isRTL ? 'الوقت' : 'Time'}</th>
                            <th className="center">{isRTL ? 'الساعات' : 'Hours'}</th>
                            <th>{isRTL ? 'المهمة' : 'Task'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(r.days || []).map((d, i) => (
                            <tr key={i}>
                              <td className="mono">{d.date || '—'}</td>
                              <td className="mono center" dir="ltr">
                                {d.startTime || ''}{d.startTime && d.endTime ? ' - ' : ''}{d.endTime || ''}
                              </td>
                              <td className="mono center">{Number(d.hours || 0).toFixed(2)}</td>
                              <td>{d.task || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {rejectingId === r.overtimeId ? (
                  <div className="ap-reject-panel">
                    <div className="ap-reject-label">{isRTL ? 'سبب الرفض *' : 'Rejection reason *'}</div>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder={isRTL ? 'اذكر سبب الرفض بوضوح للموظف...' : 'Explain why this is being rejected...'}
                    />
                    <div className="ap-reject-actions">
                      <button className="ap-btn ap-btn--ghost" onClick={() => { setRejectingId(null); setRejectNote(''); }}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button className="ap-btn ap-btn--danger" onClick={doReject} disabled={isBusy}>
                        {isBusy ? '…' : (isRTL ? 'تأكيد الرفض' : 'Confirm reject')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="ap-actions">
                    <button className="ap-btn ap-btn--reject" onClick={() => openReject(r)} disabled={isBusy}>
                      ✕ {isRTL ? 'رفض' : 'Reject'}
                    </button>
                    <button className="ap-btn ap-btn--approve" onClick={() => approve(r)} disabled={isBusy}>
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
