import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './Approvals.css';

// Manager's queue for FabLab visit requests. Approve/reject share the
// same decision panel so both can carry a note that gets emailed to
// the visitor. Delete removes the request entirely (irreversible).

const fmtWhen = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch { return '—'; }
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return String(iso).slice(0, 10); }
};
const fmtTime = (t) => t ? String(t).slice(0, 5) : '—';
const fmtVisitNo = (n) => n == null ? '—' : `V-${String(n).padStart(3, '0')}`;

const FablabVisitApprovals = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(() => new Set());
  // Shared decision panel: mode = 'approve' | 'reject'.
  const [deciding, setDeciding] = useState(null); // { id, mode }
  const [note, setNote] = useState('');

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

  const toggle = (id) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const openDecide = (row, mode) => {
    setDeciding({ id: row.visitId, mode });
    setNote('');
  };
  const cancelDecide = () => { setDeciding(null); setNote(''); };

  const submitDecision = async () => {
    if (!deciding) return;
    const trimmedNote = note.trim();
    // Reject requires a reason. Approve note is optional.
    if (deciding.mode === 'reject' && !trimmedNote) {
      return toast.error(isRTL ? 'سبب الرفض مطلوب' : 'Reason required');
    }
    setBusy(prev => new Set(prev).add(deciding.id));
    try {
      const endpoint = deciding.mode === 'approve' ? 'manager-approve' : 'manager-reject';
      await api.post(`/fablab-visits/${deciding.id}/${endpoint}`, { note: trimmedNote || undefined });
      toast.success(deciding.mode === 'approve'
        ? (isRTL ? 'تم اعتماد الزيارة ✓ — تم إرسال البريد للزائر' : 'Visit approved — visitor notified')
        : (isRTL ? 'تم رفض الزيارة — تم إرسال البريد للزائر' : 'Visit rejected — visitor notified'));
      setRows(prev => prev.filter(r => r.visitId !== deciding.id));
      cancelDecide();
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر حفظ القرار' : 'Failed to save decision'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(deciding.id); return n; });
    }
  };

  const deleteRow = async (row) => {
    const label = row.entityName || row.personInCharge || '';
    if (!window.confirm(isRTL
      ? `حذف طلب الزيارة "${label}" نهائياً؟ لا يمكن التراجع.`
      : `Delete visit request "${label}" permanently? This cannot be undone.`)) return;
    setBusy(prev => new Set(prev).add(row.visitId));
    try {
      await api.delete(`/fablab-visits/${row.visitId}`);
      toast.success(isRTL ? 'تم حذف الطلب' : 'Request deleted');
      setRows(prev => prev.filter(r => r.visitId !== row.visitId));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر الحذف' : 'Delete failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(row.visitId); return n; });
    }
  };

  return (
    <div className="ap">
      <div className="ap-head">
        <h2>🏢 {isRTL ? 'اعتماد طلبات زيارة فاب لاب' : 'FabLab Visit Approvals'}</h2>
        <span className="ap-count ap-count--sky">
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
          ✅ {isRTL ? 'لا توجد طلبات زيارة بحاجة لاعتماد.' : 'No pending visit approvals.'}
        </div>
      ) : (
        <div className="ap-grid">
          {rows.map(r => {
            const isExpanded = expanded.has(r.visitId);
            const isBusy = busy.has(r.visitId);
            const isDeciding = deciding?.id === r.visitId;
            return (
              <div key={r.visitId} className="ap-card ap-card--visit">
                <div className="ap-card-top">
                  <div className="ap-card-lead">
                    <div className="ap-card-lead-line">
                      <span className="ap-hash ap-hash--visit">{fmtVisitNo(r.visitNumber)}</span>
                      <div className="ap-title">{r.entityName}</div>
                    </div>
                    <div className="ap-sub">
                      <b>{r.personInCharge}</b>
                      {' · '}
                      <span dir="ltr">{fmtDate(r.visitDate)}</span>
                      {' · '}
                      <span dir="ltr">{fmtTime(r.visitStartTime)} → {fmtTime(r.visitEndTime)}</span>
                    </div>
                    {r.sentForApprovalAt && (
                      <div className="ap-when">📤 {isRTL ? 'أرسل:' : 'sent'} {fmtWhen(r.sentForApprovalAt)}</div>
                    )}
                  </div>
                  <div className="ap-card-right">
                    <span className="ap-pill ap-pill--visit">
                      👥 {r.visitorsCount} {isRTL ? 'زائر' : 'visitors'}
                    </span>
                    <button className="ap-toggle" onClick={() => toggle(r.visitId)}>
                      {isExpanded ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'التفاصيل' : 'Details')}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ap-body">
                    {/* Detail cards — every field, grouped */}
                    <div className="ap-detail-cards">
                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title">{isRTL ? 'الجهة والمسؤول' : 'Entity & Contact'}</div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'الجهة' : 'Entity'}</div><div className="ap-kv-value">{r.entityName || '—'}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'المسؤول' : 'Person in charge'}</div><div className="ap-kv-value">{r.personInCharge || '—'}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'الجوال' : 'Phone'}</div><div className="ap-kv-value" dir="ltr">{r.phone || '—'}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'البريد' : 'Email'}</div><div className="ap-kv-value" dir="ltr">{r.email || '—'}</div></div>
                          {r.nationalId && (
                            <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'رقم الهوية' : 'National ID'}</div><div className="ap-kv-value" dir="ltr">{r.nationalId}</div></div>
                          )}
                        </div>
                      </div>

                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title">{isRTL ? 'موعد الزيارة' : 'Visit Schedule'}</div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'التاريخ' : 'Date'}</div><div className="ap-kv-value" dir="ltr">{fmtDate(r.visitDate)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'من الساعة' : 'From'}</div><div className="ap-kv-value" dir="ltr">{fmtTime(r.visitStartTime)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'إلى الساعة' : 'To'}</div><div className="ap-kv-value" dir="ltr">{fmtTime(r.visitEndTime)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'عدد الزوار' : 'Visitors'}</div><div className="ap-kv-value">👥 {r.visitorsCount || 1}</div></div>
                        </div>
                      </div>

                      <div className="ap-detail-card">
                        <div className="ap-detail-card-title">{isRTL ? 'سجل الطلب' : 'Request Log'}</div>
                        <div className="ap-kv-grid">
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'أُرسل للاعتماد' : 'Sent'}</div><div className="ap-kv-value" dir="ltr">{fmtWhen(r.sentForApprovalAt)}</div></div>
                          <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'أُنشئ في' : 'Created'}</div><div className="ap-kv-value" dir="ltr">{fmtWhen(r.createdAt)}</div></div>
                          {r.managerEmail && (
                            <div className="ap-kv"><div className="ap-kv-label">{isRTL ? 'مدير المراجعة' : 'Reviewer'}</div><div className="ap-kv-value" dir="ltr">{r.managerEmail}</div></div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ap-block">
                      <div className="ap-block-label">{isRTL ? 'الغرض من الزيارة' : 'Purpose of visit'}</div>
                      <div className="ap-block-text">{r.purpose}</div>
                    </div>

                    {r.notes && (
                      <div className="ap-block ap-block--admin">
                        <div className="ap-block-label">{isRTL ? 'ملاحظات إضافية من مقدم الطلب' : 'Additional notes from the requester'}</div>
                        <div className="ap-block-text">{r.notes}</div>
                      </div>
                    )}
                  </div>
                )}

                {isDeciding ? (
                  <div className="ap-reject-panel" style={{ background: deciding.mode === 'approve' ? '#ecfdf5' : '#fef2f2', borderColor: deciding.mode === 'approve' ? '#a7f3d0' : '#fecaca' }}>
                    <div className="ap-reject-label" style={{ color: deciding.mode === 'approve' ? '#065f46' : '#991b1b' }}>
                      {deciding.mode === 'approve'
                        ? (isRTL ? 'ملاحظة للزائر (اختيارية) — سترفق مع بريد الموافقة' : 'Note to visitor (optional) — attached to the approval email')
                        : (isRTL ? 'سبب الرفض * — سيرسل للزائر' : 'Rejection reason * — emailed to the visitor')}
                    </div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      placeholder={deciding.mode === 'approve'
                        ? (isRTL ? 'مثال: يرجى الحضور من البوابة الجنوبية...' : 'e.g. Please enter through the south gate...')
                        : (isRTL ? 'اذكر سبب الرفض بوضوح...' : 'Explain why this visit is being rejected...')}
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

export default FablabVisitApprovals;
