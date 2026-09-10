import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import printVolunteerOpportunity from '../shared/printVolunteerOpportunity';
import './Approvals.css';

// Include the day-of-week (السبت / Sunday) for at-a-glance clarity.
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
const fmtRequestNo = (n) => n == null ? '—' : `VOR-${String(n).padStart(3, '0')}`;

const VolunteerOpportunityApprovals = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const locale = isRTL ? 'ar-SA' : undefined;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(() => new Set());
  // Shared decision panel — approve and reject both capture an
  // optional / required note. Approve keeps the auto-print behavior.
  const [deciding, setDeciding] = useState(null); // { id, mode: 'approve' | 'reject' }
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/volunteer-opportunity-requests/pending');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل طلبات الفرص التطوعية' : 'Failed to load pending requests');
    } finally { setLoading(false); }
  }, [isRTL]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  // Manual print — useful if the manager blocks the popup on the
  // first attempt and needs to retry.
  const reprint = (row) => printVolunteerOpportunity({
    ...row,
    approvalStatus: 'approved',
    approvedAt: row.approvedAt || new Date().toISOString()
  });

  const openDecide = (row, mode) => { setDeciding({ id: row.requestId, mode }); setNote(''); };
  const cancelDecide = () => { setDeciding(null); setNote(''); };

  const submitDecision = async () => {
    if (!deciding) return;
    const trimmed = note.trim();
    if (deciding.mode === 'reject' && !trimmed) {
      return toast.error(isRTL ? 'سبب الرفض مطلوب' : 'Reason required');
    }
    setBusy(prev => new Set(prev).add(deciding.id));
    const currentRow = rows.find(r => r.requestId === deciding.id);
    try {
      const endpoint = deciding.mode === 'approve' ? 'manager-approve' : 'manager-reject';
      const { data } = await api.post(
        `/volunteer-opportunity-requests/${deciding.id}/${endpoint}`,
        { note: trimmed || undefined }
      );
      if (deciding.mode === 'approve') {
        toast.success(isRTL
          ? '✅ تم الاعتماد — سيتم فتح صفحة الطباعة'
          : '✅ Approved — opening the printable document');
        const approvedRow = data?.row || {
          ...(currentRow || {}),
          approvalStatus: 'approved',
          approvedAt: new Date().toISOString(),
          managerNote: trimmed || null
        };
        setTimeout(() => { try { printVolunteerOpportunity(approvedRow); } catch {} }, 400);
      } else {
        toast.success(isRTL ? 'تم رفض الفرصة التطوعية' : 'Opportunity rejected');
      }
      setRows(prev => prev.filter(r => r.requestId !== deciding.id));
      cancelDecide();
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر حفظ القرار' : 'Failed to save'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(deciding.id); return n; });
    }
  };

  const deleteRow = async (row) => {
    if (!window.confirm(isRTL
      ? `حذف الفرصة التطوعية "${row.title || ''}" نهائياً؟`
      : `Delete volunteer opportunity "${row.title || ''}" permanently?`)) return;
    setBusy(prev => new Set(prev).add(row.requestId));
    try {
      await api.delete(`/volunteer-opportunity-requests/${row.requestId}`);
      toast.success(isRTL ? 'تم حذف الطلب' : 'Request deleted');
      setRows(prev => prev.filter(x => x.requestId !== row.requestId));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر الحذف' : 'Delete failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(row.requestId); return n; });
    }
  };

  const modeAr = (m) => m === 'remote' ? 'عن بُعد' : m === 'hybrid' ? 'هجين' : 'حضوري';
  const genderAr = (g) => g === 'male' ? 'ذكور فقط' : g === 'female' ? 'إناث فقط' : 'الجميع';

  return (
    <div className="ap">
      <div className="ap-head">
        <h2>🤝 {isRTL ? 'اعتماد الفرص التطوعية' : 'Volunteer Opportunity Approvals'}</h2>
        <span className="ap-count" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
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
          ✅ {isRTL ? 'لا توجد فرص تطوعية بحاجة لاعتماد.' : 'No pending volunteer opportunities.'}
        </div>
      ) : (
        <div className="ap-grid">
          {rows.map(r => {
            const isExpanded = expanded.has(r.requestId);
            const isBusy = busy.has(r.requestId);
            const isDeciding = deciding?.id === r.requestId;
            return (
              <div key={r.requestId} className="ap-card" style={{ borderInlineStartColor: '#16a34a' }}>
                <div className="ap-card-top">
                  <div className="ap-card-lead">
                    <div className="ap-card-lead-line">
                      <span className="ap-hash" style={{ color: '#166534', background: '#dcfce7' }}>{fmtRequestNo(r.requestNumber)}</span>
                      <div className="ap-title">{r.title}</div>
                    </div>
                    <div className="ap-sub">
                      {isRTL ? 'المنسق: ' : 'Coordinator: '}<b>{r.coordinatorName}</b>
                      {' · '}
                      <span dir="ltr">📞 {r.coordinatorPhone}</span>
                    </div>
                    {r.sentForApprovalAt && (
                      <div className="ap-when">📤 {isRTL ? 'أرسل:' : 'sent'} {fmtWhen(r.sentForApprovalAt, locale)}</div>
                    )}
                  </div>
                  <div className="ap-card-right">
                    <span className="ap-pill" style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                      👥 {r.volunteersNeeded || 1} {isRTL ? 'متطوع' : 'volunteers'}
                    </span>
                    <button className="ap-toggle" onClick={() => toggle(r.requestId)}>
                      {isExpanded ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'التفاصيل' : 'Details')}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="ap-body">
                    <div className="ap-kv-grid">
                      {r.location && (
                        <div className="ap-kv">
                          <div className="ap-kv-label">{isRTL ? 'المكان' : 'Location'}</div>
                          <div className="ap-kv-value ap-kv-value--plain">{r.location}</div>
                        </div>
                      )}
                      <div className="ap-kv">
                        <div className="ap-kv-label">{isRTL ? 'طبيعة الفرصة' : 'Mode'}</div>
                        <div className="ap-kv-value ap-kv-value--plain">{isRTL ? modeAr(r.mode) : r.mode}</div>
                      </div>
                      <div className="ap-kv">
                        <div className="ap-kv-label">{isRTL ? 'الجنس' : 'Gender'}</div>
                        <div className="ap-kv-value ap-kv-value--plain">{isRTL ? genderAr(r.genderPreference) : r.genderPreference}</div>
                      </div>
                      {(r.minAge || r.maxAge) && (
                        <div className="ap-kv">
                          <div className="ap-kv-label">{isRTL ? 'العمر' : 'Age range'}</div>
                          <div className="ap-kv-value">{r.minAge || '—'} - {r.maxAge || '—'} {isRTL ? 'سنة' : 'yrs'}</div>
                        </div>
                      )}
                      {(r.programStartTime || r.programEndTime) && (
                        <div className="ap-kv">
                          <div className="ap-kv-label">{isRTL ? 'وقت البرنامج' : 'Program time'}</div>
                          <div className="ap-kv-value" dir="ltr">{r.programStartTime || '—'} → {r.programEndTime || '—'}</div>
                        </div>
                      )}
                      {(r.startDate || r.endDate) && (
                        <div className="ap-kv">
                          <div className="ap-kv-label">{isRTL ? 'الفترة' : 'Period'}</div>
                          <div className="ap-kv-value" dir="ltr">{r.startDate ? fmtDate(r.startDate, locale) : '—'} → {r.endDate ? fmtDate(r.endDate, locale) : '—'}</div>
                        </div>
                      )}
                      {r.educationLevel && (
                        <div className="ap-kv">
                          <div className="ap-kv-label">{isRTL ? 'المؤهل العلمي' : 'Education'}</div>
                          <div className="ap-kv-value ap-kv-value--plain">{r.educationLevel}</div>
                        </div>
                      )}
                    </div>

                    {r.description && (
                      <div className="ap-block">
                        <div className="ap-block-label">{isRTL ? 'وصف الفرصة' : 'Description'}</div>
                        <div className="ap-block-text">{r.description}</div>
                      </div>
                    )}
                    {r.responsibilities && (
                      <div className="ap-block">
                        <div className="ap-block-label">{isRTL ? 'مهام ومسؤوليات المتطوع' : 'Duties & responsibilities'}</div>
                        <div className="ap-block-text">{r.responsibilities}</div>
                      </div>
                    )}
                    {r.requiredSkills && (
                      <div className="ap-block">
                        <div className="ap-block-label">{isRTL ? 'المهارات المطلوبة' : 'Required skills'}</div>
                        <div className="ap-block-text">{r.requiredSkills}</div>
                      </div>
                    )}
                    {r.supportProvided && (
                      <div className="ap-block">
                        <div className="ap-block-label">{isRTL ? 'الدعم المقدم للمتطوع' : 'Support provided'}</div>
                        <div className="ap-block-text">{r.supportProvided}</div>
                      </div>
                    )}
                    {r.risksAndChallenges && (
                      <div className="ap-block ap-block--admin">
                        <div className="ap-block-label">{isRTL ? '⚠️ المخاطر والتحديات' : '⚠️ Risks & challenges'}</div>
                        <div className="ap-block-text">{r.risksAndChallenges}</div>
                      </div>
                    )}
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
                        ? (isRTL ? 'ملاحظة تسجل مع اعتماد الفرصة...' : 'A note recorded with the approval...')
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
                          ? (isRTL ? '✓ اعتماد وطباعة' : '✓ Approve & Print')
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
                    <button
                      className="ap-btn ap-btn--ghost"
                      onClick={() => reprint(r)}
                      title={isRTL ? 'معاينة الوثيقة قبل الاعتماد' : 'Preview the document before approving'}
                    >
                      👁 {isRTL ? 'معاينة الوثيقة' : 'Preview doc'}
                    </button>
                    <button className="ap-btn ap-btn--reject" onClick={() => openDecide(r, 'reject')} disabled={isBusy}>
                      ✕ {isRTL ? 'رفض' : 'Reject'}
                    </button>
                    <button className="ap-btn ap-btn--approve" onClick={() => openDecide(r, 'approve')} disabled={isBusy}>
                      {isBusy ? '…' : (isRTL ? '✓ اعتماد وطباعة' : '✓ Approve & Print')}
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

export default VolunteerOpportunityApprovals;
