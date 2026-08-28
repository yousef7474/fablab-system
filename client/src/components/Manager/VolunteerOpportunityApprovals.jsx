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
const fmtRequestNo = (n) => n == null ? '—' : `VOR-${String(n).padStart(3, '0')}`;

const VolunteerOpportunityApprovals = () => {
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

  const approve = async (row) => {
    setBusy(prev => new Set(prev).add(row.requestId));
    try {
      await api.post(`/volunteer-opportunity-requests/${row.requestId}/manager-approve`);
      toast.success(isRTL ? 'تم اعتماد الفرصة التطوعية' : 'Opportunity approved');
      setRows(prev => prev.filter(r => r.requestId !== row.requestId));
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الاعتماد' : 'Approve failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(row.requestId); return n; });
    }
  };

  const openReject = (row) => { setRejectingId(row.requestId); setRejectNote(''); };
  const doReject = async () => {
    if (!rejectNote.trim()) return toast.error(isRTL ? 'سبب الرفض مطلوب' : 'Reason required');
    setBusy(prev => new Set(prev).add(rejectingId));
    try {
      await api.post(`/volunteer-opportunity-requests/${rejectingId}/manager-reject`, { note: rejectNote.trim() });
      toast.success(isRTL ? 'تم رفض الفرصة التطوعية' : 'Opportunity rejected');
      setRows(prev => prev.filter(r => r.requestId !== rejectingId));
      setRejectingId(null);
      setRejectNote('');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الرفض' : 'Reject failed'));
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(rejectingId); return n; });
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
                      <div className="ap-when">📤 {isRTL ? 'أرسل:' : 'sent'} {fmtWhen(r.sentForApprovalAt)}</div>
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
                          <div className="ap-kv-value" dir="ltr">{r.startDate || '—'} → {r.endDate || '—'}</div>
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

                {rejectingId === r.requestId ? (
                  <div className="ap-reject-panel">
                    <div className="ap-reject-label">{isRTL ? 'سبب الرفض *' : 'Rejection reason *'}</div>
                    <textarea
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      rows={2}
                      placeholder={isRTL ? 'اذكر سبب رفض الفرصة التطوعية بوضوح...' : 'Explain why this opportunity is being rejected...'}
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

export default VolunteerOpportunityApprovals;
