import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './Approvals.css';

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

  const toggle = (id) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

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

  const openReject = (row) => { setRejectingId(row.visitId); setRejectNote(''); };
  const doReject = async () => {
    if (!rejectNote.trim()) return toast.error(isRTL ? 'سبب الرفض مطلوب' : 'Reason required');
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
                      <span dir="ltr">{r.visitDate}</span>
                      {' · '}
                      <span dir="ltr">{r.visitStartTime} → {r.visitEndTime}</span>
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
                    <div className="ap-kv-grid">
                      <div className="ap-kv">
                        <div className="ap-kv-label">{isRTL ? 'الجوال' : 'Phone'}</div>
                        <div className="ap-kv-value" dir="ltr">{r.phone || '—'}</div>
                      </div>
                      <div className="ap-kv">
                        <div className="ap-kv-label">{isRTL ? 'البريد الإلكتروني' : 'Email'}</div>
                        <div className="ap-kv-value" dir="ltr">{r.email || '—'}</div>
                      </div>
                      <div className="ap-kv">
                        <div className="ap-kv-label">{isRTL ? 'رقم الهوية' : 'National ID'}</div>
                        <div className="ap-kv-value" dir="ltr">{r.nationalId || '—'}</div>
                      </div>
                    </div>

                    <div className="ap-block">
                      <div className="ap-block-label">{isRTL ? 'الغرض من الزيارة' : 'Purpose of visit'}</div>
                      <div className="ap-block-text">{r.purpose}</div>
                    </div>

                    {r.notes && (
                      <div className="ap-block ap-block--admin">
                        <div className="ap-block-label">{isRTL ? 'ملاحظات' : 'Notes'}</div>
                        <div className="ap-block-text">{r.notes}</div>
                      </div>
                    )}
                  </div>
                )}

                {rejectingId === r.visitId ? (
                  <div className="ap-reject-panel">
                    <div className="ap-reject-label">{isRTL ? 'سبب الرفض *' : 'Rejection reason *'}</div>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder={isRTL ? 'اذكر سبب رفض طلب الزيارة بوضوح...' : 'Explain why this visit is being rejected...'}
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

export default FablabVisitApprovals;
