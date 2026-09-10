import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './Approvals.css';

// Overtime approvals — approve/reject share the same panel so both can
// carry a note recorded against the request. Delete permanently
// removes the request (irreversible).

// Dates include the day-of-week (السبت / Sunday) so a manager can
// tell at a glance which weekday(s) the overtime lands on.
const fmtDate = (v, locale) => {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toLocaleDateString(locale || undefined, {
      weekday: 'long', year: 'numeric', month: 'short', day: '2-digit'
    });
  } catch { return String(v).slice(0, 10); }
};
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

const OvertimeApprovals = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const locale = isRTL ? 'ar-SA' : undefined;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(() => new Set());
  const [deciding, setDeciding] = useState(null); // { id, mode: 'approve' | 'reject' }
  const [note, setNote] = useState('');

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

  const openDecide = (row, mode) => { setDeciding({ id: row.overtimeId, mode }); setNote(''); };
  const cancelDecide = () => { setDeciding(null); setNote(''); };

  const submitDecision = async () => {
    if (!deciding) return;
    const trimmed = note.trim();
    if (deciding.mode === 'reject' && !trimmed) {
      return toast.error(isRTL ? 'سبب الرفض مطلوب' : 'Reason required');
    }
    setBusy(prev => new Set(prev).add(deciding.id));
    try {
      const endpoint = deciding.mode === 'approve' ? 'approve' : 'reject';
      await api.post(`/overtime/${deciding.id}/${endpoint}`, { note: trimmed || undefined });
      toast.success(deciding.mode === 'approve'
        ? (isRTL ? '✓ تم الاعتماد' : '✓ Approved')
        : (isRTL ? '✕ تم الرفض' : '✕ Rejected'));
      setRows(prev => prev.filter(r => r.overtimeId !== deciding.id));
      cancelDecide();
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر حفظ القرار' : 'Failed to save'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(deciding.id); return n; });
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(isRTL
      ? `حذف طلب الساعات الإضافية للموظف "${row.employeeName || ''}" نهائياً؟`
      : `Delete overtime request for "${row.employeeName || ''}" permanently?`)) return;
    setBusy(prev => new Set(prev).add(row.overtimeId));
    try {
      await api.delete(`/overtime/${row.overtimeId}`);
      toast.success(isRTL ? 'تم حذف الطلب' : 'Request deleted');
      setRows(prev => prev.filter(x => x.overtimeId !== row.overtimeId));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر الحذف' : 'Delete failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(row.overtimeId); return n; });
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
            const isDeciding = deciding?.id === r.overtimeId;
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
                      <span dir="ltr">{fmtDate(r.periodStart, locale)} → {fmtDate(r.periodEnd, locale)}</span>
                    </div>
                    {r.sentForApprovalAt && (
                      <div className="ap-when">📤 {isRTL ? 'أرسل:' : 'sent'} {fmtWhen(r.sentForApprovalAt, locale)}</div>
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
                    {/* Detail cards */}
                    <div className="ap-detail-cards">
                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title" style={{ color: '#d97706' }}>
                          {isRTL ? 'بيانات الموظف' : 'Employee'}
                        </div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'الاسم' : 'Name'}</div><div className="ap-kv-value">{r.employeeName || '—'}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'الوظيفة' : 'Position'}</div><div className="ap-kv-value">{r.position || '—'}</div></div>
                        </div>
                      </div>

                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title" style={{ color: '#d97706' }}>
                          {isRTL ? 'الفترة والساعات' : 'Period & Hours'}
                        </div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'من' : 'From'}</div><div className="ap-kv-value" dir="ltr">{fmtDate(r.periodStart, locale)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'إلى' : 'To'}</div><div className="ap-kv-value" dir="ltr">{fmtDate(r.periodEnd, locale)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'إجمالي الساعات' : 'Total hours'}</div><div className="ap-kv-value">{Number(r.totalHours || 0).toFixed(2)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'عدد الأيام' : 'Days'}</div><div className="ap-kv-value">{(r.days || []).length}</div></div>
                        </div>
                      </div>

                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title" style={{ color: '#d97706' }}>
                          {isRTL ? 'سجل الطلب' : 'Request Log'}
                        </div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'أُنشئ في' : 'Created'}</div><div className="ap-kv-value" dir="ltr">{fmtWhen(r.createdAt, locale)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'أُرسل للاعتماد' : 'Sent'}</div><div className="ap-kv-value" dir="ltr">{fmtWhen(r.sentForApprovalAt, locale)}</div></div>
                          {r.managerEmail && (
                            <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'مدير المراجعة' : 'Reviewer'}</div><div className="ap-kv-value" dir="ltr">{r.managerEmail}</div></div>
                          )}
                        </div>
                      </div>
                    </div>

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

                {isDeciding ? (
                  <div className="ap-reject-panel" style={{
                    background: deciding.mode === 'approve' ? '#ecfdf5' : '#fef2f2',
                    borderColor: deciding.mode === 'approve' ? '#a7f3d0' : '#fecaca'
                  }}>
                    <div className="ap-reject-label" style={{ color: deciding.mode === 'approve' ? '#065f46' : '#991b1b' }}>
                      {deciding.mode === 'approve'
                        ? (isRTL ? 'ملاحظة على الاعتماد (اختيارية)' : 'Approval note (optional)')
                        : (isRTL ? 'سبب الرفض *' : 'Rejection reason *')}
                    </div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder={deciding.mode === 'approve'
                        ? (isRTL ? 'ملاحظة تسجل مع الطلب...' : 'A note recorded with the request...')
                        : (isRTL ? 'اذكر سبب الرفض بوضوح...' : 'Explain why...')}
                    />
                    <div className="ap-reject-actions">
                      <button className="ap-btn ap-btn--ghost" onClick={cancelDecide}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        className={`ap-btn ${deciding.mode === 'approve' ? 'ap-btn--approve' : 'ap-btn--danger'}`}
                        onClick={submitDecision}
                        disabled={isBusy}
                      >
                        {isBusy ? '…' : (deciding.mode === 'approve'
                          ? (isRTL ? '✓ تأكيد الاعتماد' : '✓ Confirm approve')
                          : (isRTL ? 'تأكيد الرفض' : 'Confirm reject'))}
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
                      ✕ {isRTL ? 'رفض' : 'Reject'}
                    </button>
                    <button className="ap-btn ap-btn--approve" onClick={() => openDecide(r, 'approve')} disabled={isBusy}>
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
