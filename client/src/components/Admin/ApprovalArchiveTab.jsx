import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';

// Immutable archive of every approval request an admin sent to the
// manager. One row per send-event, capturing the exact HTML email that
// was mailed so it can be re-opened and re-printed later. Wired into
// the volunteer-opportunity + overtime send flows via
// server/controllers/approvalArchiveController.js.

const TYPE_LABELS = {
  volunteer_opportunity: { ar: 'فرصة تطوعية', en: 'Volunteer Opportunity', color: '#16a34a', bg: '#f0fdf4' },
  overtime:              { ar: 'ساعات إضافية', en: 'Overtime',              color: '#6d28d9', bg: '#faf5ff' }
};

const STATUS_LABELS = {
  pending:  { ar: 'قيد الاعتماد', en: 'Pending',  color: '#b45309', bg: '#fef3c7', dot: '#f59e0b' },
  approved: { ar: 'معتمد',        en: 'Approved', color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  rejected: { ar: 'مرفوض',        en: 'Rejected', color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' }
};

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return '—'; }
};

const ApprovalArchiveTab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(null); // full row w/ emailHtml

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get(`/approval-archive?${params.toString()}`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل الأرشيف' : 'Failed to load archive');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, search, isRTL]);

  useEffect(() => { load(); }, [load]);

  const openPreview = async (row) => {
    try {
      const { data } = await api.get(`/approval-archive/${row.archiveId}`);
      setPreview(data);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر فتح المعاينة' : 'Failed to open preview');
    }
  };

  const openPrint = (row) => {
    // Uses the public /print endpoint that auto-triggers window.print
    // once the tab loads. No auth header needed — the archiveId UUID
    // gates the access.
    const url = `${api.defaults.baseURL || ''}/approval-archive/${row.archiveId}/print`;
    window.open(url, '_blank', 'noopener');
  };

  const resend = async (row) => {
    const to = window.prompt(
      isRTL ? 'أدخل بريد المدير لإعادة الإرسال:' : 'Manager email to resend to:',
      row.managerEmail || ''
    );
    if (!to) return;
    try {
      await api.post(`/approval-archive/${row.archiveId}/resend`, { managerEmail: to });
      toast.success(isRTL ? 'تم إعادة الإرسال' : 'Resent');
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'فشل الإرسال' : 'Resend failed'));
    }
  };

  const remove = async (row) => {
    if (!window.confirm(isRTL
      ? `حذف السجل نهائياً — "${row.title || ''}"؟`
      : `Permanently delete archive entry — "${row.title || ''}"?`)) return;
    try {
      await api.delete(`/approval-archive/${row.archiveId}`);
      setRows(prev => prev.filter(r => r.archiveId !== row.archiveId));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch {
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    }
  };

  const summary = useMemo(() => {
    const byStatus = { pending: 0, approved: 0, rejected: 0 };
    for (const r of rows) if (byStatus[r.status] !== undefined) byStatus[r.status]++;
    return byStatus;
  }, [rows]);

  return (
    <div className="volunteers-content" style={{ padding: '4px 0' }}>
      <div className="volunteers-header">
        <h2>{isRTL ? 'أرشيف الاعتمادات' : 'Approvals Archive'}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SummaryChip label={isRTL ? 'قيد الاعتماد' : 'Pending'}  value={summary.pending}  color={STATUS_LABELS.pending} />
          <SummaryChip label={isRTL ? 'معتمد'        : 'Approved'} value={summary.approved} color={STATUS_LABELS.approved} />
          <SummaryChip label={isRTL ? 'مرفوض'        : 'Rejected'} value={summary.rejected} color={STATUS_LABELS.rejected} />
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        margin: '10px 0 18px', padding: '12px 14px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1px solid #e2e8f0', borderRadius: 12
      }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isRTL ? 'بحث بالعنوان / الرقم / بريد المدير…' : 'Search title / number / manager email…'}
          style={{ flex: '1 1 260px', minWidth: 220, padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontFamily: 'inherit' }}
        />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontFamily: 'inherit', minWidth: 170 }}>
          <option value="">{isRTL ? 'كل الأنواع' : 'All types'}</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontFamily: 'inherit', minWidth: 160 }}>
          <option value="">{isRTL ? 'كل الحالات' : 'All statuses'}</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty-state">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          {isRTL ? 'لا يوجد أي سجل بعد. عند إرسال طلبات للاعتماد ستظهر هنا.' : 'No archived approvals yet. Sent requests will appear here.'}
        </div>
      ) : (
        <div style={{ overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff' }}>
                <Th>{isRTL ? 'النوع' : 'Type'}</Th>
                <Th>{isRTL ? 'الرقم' : 'Ref #'}</Th>
                <Th>{isRTL ? 'العنوان' : 'Title'}</Th>
                <Th>{isRTL ? 'بريد المدير' : 'Manager'}</Th>
                <Th>{isRTL ? 'الحالة' : 'Status'}</Th>
                <Th>{isRTL ? 'أرسل في' : 'Sent'}</Th>
                <Th>{isRTL ? 'اتُخذ القرار في' : 'Decided'}</Th>
                <Th style={{ textAlign: 'center' }}>{isRTL ? 'الإجراءات' : 'Actions'}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const t = TYPE_LABELS[r.type] || { ar: r.type, en: r.type, color: '#475569', bg: '#f1f5f9' };
                const s = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
                return (
                  <tr key={r.archiveId} style={{ background: i % 2 ? '#fafbfc' : '#fff', borderTop: '1px solid #f1f5f9' }}>
                    <Td>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: t.bg, color: t.color, border: `1px solid ${t.color}25` }}>
                        {isRTL ? t.ar : t.en}
                      </span>
                    </Td>
                    <Td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#334155' }}>{r.requestNumber || '—'}</Td>
                    <Td style={{ fontWeight: 600, color: '#0f172a', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title || '—'}</Td>
                    <Td style={{ color: '#475569', fontSize: 12.5 }}>
                      <div dir="ltr" style={{ direction: 'ltr', textAlign: isRTL ? 'right' : 'left' }}>{r.managerEmail}</div>
                      {r.managerName && <div style={{ color: '#94a3b8', fontSize: 11 }}>{r.managerName}</div>}
                    </Td>
                    <Td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: s.bg, color: s.color, border: `1px solid ${s.color}25` }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }} />
                        {isRTL ? s.ar : s.en}
                      </span>
                    </Td>
                    <Td style={{ color: '#64748b', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{fmtDateTime(r.sentAt)}</Td>
                    <Td style={{ color: '#64748b', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{fmtDateTime(r.decidedAt)}</Td>
                    <Td style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <IconBtn onClick={() => openPreview(r)} bg="#eef2ff" color="#4338ca" border="#c7d2fe" title={isRTL ? 'معاينة' : 'Preview'}>👁</IconBtn>
                        <IconBtn onClick={() => openPrint(r)}   bg="#dbeafe" color="#1e40af" border="#bfdbfe" title={isRTL ? 'طباعة نسخة' : 'Print copy'}>🖨</IconBtn>
                        <IconBtn onClick={() => resend(r)}       bg="#dcfce7" color="#166534" border="#bbf7d0" title={isRTL ? 'إعادة إرسال' : 'Resend'}>↺</IconBtn>
                        <IconBtn onClick={() => remove(r)}       bg="#fee2e2" color="#991b1b" border="#fecaca" title={isRTL ? 'حذف' : 'Delete'}>🗑</IconBtn>
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview modal — renders the archived email HTML inside an iframe */}
      <AnimatePresence>
        {preview && (
          <div className="modal-overlay" onClick={() => setPreview(null)}>
            <motion.div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.22 }}
              style={{ maxWidth: 900, width: '92vw', maxHeight: '92vh', background: '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: 1 }}>{isRTL ? 'معاينة الرسالة المؤرشفة' : 'Archived email preview'}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{preview.subject || preview.title}</div>
                </div>
                <button onClick={() => setPreview(null)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700 }}>×</button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', background: '#f1f5f9' }}>
                <iframe
                  title="archived-email"
                  srcDoc={preview.emailHtml || ''}
                  style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                />
              </div>
              <div style={{ padding: '12px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
                <button onClick={() => openPrint(preview)} style={{ padding: '9px 18px', border: 'none', background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 800 }}>
                  🖨 {isRTL ? 'طباعة' : 'Print'}
                </button>
                <button onClick={() => resend(preview)} style={{ padding: '9px 18px', border: 'none', background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 800 }}>
                  ↺ {isRTL ? 'إعادة إرسال' : 'Resend'}
                </button>
                <button onClick={() => setPreview(null)} style={{ padding: '9px 18px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Th = ({ children, ...rest }) => (
  <th style={{ padding: '11px 12px', textAlign: 'inherit', fontSize: 11.5, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)', ...rest.style }}>{children}</th>
);
const Td = ({ children, ...rest }) => (
  <td style={{ padding: '11px 12px', verticalAlign: 'middle', ...rest.style }}>{children}</td>
);
const IconBtn = ({ onClick, bg, color, border, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      padding: '6px 10px', borderRadius: 8, border: `1px solid ${border}`,
      background: bg, color, cursor: 'pointer', fontWeight: 800, fontSize: 13,
      fontFamily: 'inherit'
    }}
  >{children}</button>
);
const SummaryChip = ({ label, value, color }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '6px 12px', borderRadius: 999,
    background: color.bg, border: `1px solid ${color.color}25`, color: color.color, fontWeight: 700, fontSize: 12.5
  }}>
    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color.dot }} />
    {label} · <b style={{ fontFamily: 'JetBrains Mono, monospace' }}>{value}</b>
  </div>
);

export default ApprovalArchiveTab;
