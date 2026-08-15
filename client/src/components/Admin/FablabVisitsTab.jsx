import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Manager approver quick-pick (mirrors the overtime tab convention).
// Empty emails are hidden — admin can still type a custom one.
const APPROVER_EMAILS = [
  { name: 'أ. زكي اللويم',        email: 'FabLab.Spc1@fablabahsa.org' },
  { name: 'م. نوف البوعبيد',      email: '' },
  { name: 'أ. عبدالله الصفي',     email: '' },
  { name: 'أ. عبدالمحسن السلطان', email: '' }
];

const fmtDate = (v) => v ? String(v).slice(0, 10) : '—';
const fmtTime = (t) => t ? String(t).slice(0, 5) : '—';
const fmtWhen = (v) => v ? new Date(v).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—';
const fmtVisitNo = (n) => n == null ? '—' : `V-${String(n).padStart(3, '0')}`;

// ---------- Status badge helpers ----------
const managerBadge = (s) => {
  if (s === 'approved') return { text: 'معتمد من المدير', bg: '#ecfdf5', fg: '#166534', border: '#a7f3d0' };
  if (s === 'rejected') return { text: 'مرفوض من المدير',  bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' };
  if (s === 'pending')  return { text: 'بانتظار المدير',   bg: '#fffbeb', fg: '#b45309', border: '#fde68a' };
  return { text: 'مسودة', bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0' };
};
const visitorBadge = (s) => {
  if (s === 'accepted') return { text: 'أُشعر الزائر بالقبول', bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' };
  if (s === 'rejected') return { text: 'أُشعر الزائر بالرفض',  bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' };
  return null;
};

const FablabVisitsTab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [openVisit, setOpenVisit] = useState(null);
  const [approveModal, setApproveModal] = useState(null); // { visit }
  const [approverChoice, setApproverChoice] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [sendingApproval, setSendingApproval] = useState(false);

  const [notifyModal, setNotifyModal] = useState(null); // { visit, decision }
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifying, setNotifying] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fablab-visits');
      setVisits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetch visits:', err);
      toast.error('تعذّر تحميل طلبات الزيارة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    let list = visits;
    if (statusFilter === 'draft')    list = list.filter(v => v.approvalStatus === 'draft');
    if (statusFilter === 'pending')  list = list.filter(v => v.approvalStatus === 'pending');
    if (statusFilter === 'approved') list = list.filter(v => v.approvalStatus === 'approved' && v.visitorDecision === 'pending');
    if (statusFilter === 'done')     list = list.filter(v => v.visitorDecision !== 'pending');
    if (statusFilter === 'rejected') list = list.filter(v => v.approvalStatus === 'rejected');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(v => (v.entityName || '').toLowerCase().includes(q)
                           || (v.personInCharge || '').toLowerCase().includes(q)
                           || (v.email || '').toLowerCase().includes(q)
                           || (v.phone || '').includes(q));
    }
    return list;
  }, [visits, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { total: visits.length, draft: 0, pending: 0, approved: 0, done: 0, rejected: 0 };
    for (const v of visits) {
      if (v.approvalStatus === 'draft') c.draft++;
      else if (v.approvalStatus === 'pending') c.pending++;
      else if (v.approvalStatus === 'approved' && v.visitorDecision === 'pending') c.approved++;
      else if (v.visitorDecision !== 'pending') c.done++;
      else if (v.approvalStatus === 'rejected') c.rejected++;
    }
    return c;
  }, [visits]);

  // -------------------- ACTIONS --------------------

  const openApprovalModal = (visit) => {
    setApproveModal({ visit });
    setApproverChoice('');
    setCustomEmail('');
  };

  const sendForApproval = async () => {
    if (!approveModal) return;
    const email = approverChoice === '__custom__'
      ? customEmail.trim()
      : approverChoice.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('اختر مدير أو أدخل بريد صحيح');
      return;
    }
    setSendingApproval(true);
    try {
      const { data } = await api.post(`/fablab-visits/${approveModal.visit.visitId}/send-for-approval`, {
        managerEmail: email
      });
      toast.success(data?.emailFailed
        ? 'تم إرسال الطلب — فشل إرسال البريد. حاول الإرسال مجدداً'
        : 'تم إرسال الطلب للمدير للاعتماد');
      setApproveModal(null);
      await fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || 'تعذر إرسال الطلب');
    } finally {
      setSendingApproval(false);
    }
  };

  const openNotifyModal = (visit, decision) => {
    setNotifyModal({ visit, decision });
    setNotifyMessage('');
  };

  const notifyVisitor = async () => {
    if (!notifyModal) return;
    if (notifyModal.decision === 'reject' && !notifyMessage.trim()) {
      toast.error('اكتب سبب الرفض ليصل للزائر');
      return;
    }
    setNotifying(true);
    try {
      const { data } = await api.post(`/fablab-visits/${notifyModal.visit.visitId}/notify-visitor`, {
        decision: notifyModal.decision,
        message: notifyMessage.trim() || null
      });
      toast.success(data?.emailFailed
        ? 'تم تسجيل القرار — لكن فشل إرسال البريد للزائر'
        : (notifyModal.decision === 'accept' ? 'تم قبول الزيارة وإشعار الزائر' : 'تم رفض الزيارة وإشعار الزائر'));
      setNotifyModal(null);
      setOpenVisit(null);
      await fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || 'تعذر إرسال الإشعار');
    } finally {
      setNotifying(false);
    }
  };

  const deleteVisit = async (visit) => {
    if (!window.confirm('حذف طلب الزيارة نهائياً؟')) return;
    try {
      await api.delete(`/fablab-visits/${visit.visitId}`);
      toast.success('تم الحذف');
      setOpenVisit(null);
      await fetchAll();
    } catch (err) {
      toast.error('تعذر الحذف');
    }
  };

  const printVisit = (v) => {
    const win = window.open('', '_blank');
    if (!win) return;
    const mgr = managerBadge(v.approvalStatus);
    const vis = visitorBadge(v.visitorDecision);
    win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>طلب زيارة — ${v.entityName}</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .brand small { display: block; font-weight: 500; color: #64748b; font-size: 12px; margin-top: 4px; letter-spacing: 2px; text-transform: uppercase; }
  .doc { text-align: end; }
  .doc h1 { margin: 0 0 4px; font-size: 20px; }
  .doc .id { font-family: 'JetBrains Mono', monospace; color: #64748b; font-size: 11px; direction: ltr; text-align: end; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 20px; }
  .row { display: flex; padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
  .row b { min-width: 130px; color: #334155; }
  .row span { color: #0f172a; }
  .section { margin-bottom: 20px; }
  .section h3 { margin: 0 0 8px; font-size: 14px; color: #0369a1; text-transform: uppercase; letter-spacing: 1px; }
  .box { background: #f8fafc; border: 1px solid #e5e7eb; padding: 14px; border-radius: 8px; font-size: 13px; line-height: 1.75; white-space: pre-wrap; }
  .badges { display: flex; gap: 8px; margin-top: 10px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid; }
  .foot { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
</style></head><body>
  <div class="head">
    <div class="brand">فاب لاب الأحساء<small>FABLAB Al-Ahsa</small></div>
    <div class="doc"><h1>طلب زيارة</h1><div class="id" style="font-size:15px;font-weight:800;color:#0284c7">${fmtVisitNo(v.visitNumber)}</div></div>
  </div>
  <div class="grid">
    <div class="row"><b>الجهة:</b><span>${v.entityName || '—'}</span></div>
    <div class="row"><b>الشخص المسؤول:</b><span>${v.personInCharge || '—'}</span></div>
    <div class="row"><b>الجوال:</b><span dir="ltr">${v.phone || '—'}</span></div>
    <div class="row"><b>البريد:</b><span dir="ltr">${v.email || '—'}</span></div>
    ${v.nationalId ? `<div class="row"><b>رقم الهوية:</b><span dir="ltr">${v.nationalId}</span></div>` : ''}
    <div class="row"><b>عدد الزوار:</b><span>${v.visitorsCount || 1}</span></div>
    <div class="row"><b>تاريخ الزيارة:</b><span dir="ltr">${fmtDate(v.visitDate)}</span></div>
    <div class="row"><b>الوقت:</b><span dir="ltr">${fmtTime(v.visitStartTime)} → ${fmtTime(v.visitEndTime)}</span></div>
  </div>
  <div class="section">
    <h3>الغرض من الزيارة</h3>
    <div class="box">${(v.purpose || '').replace(/</g,'&lt;')}</div>
  </div>
  ${v.notes ? `<div class="section"><h3>ملاحظات</h3><div class="box">${v.notes.replace(/</g,'&lt;')}</div></div>` : ''}
  <div class="badges">
    <span class="badge" style="background:${mgr.bg};color:${mgr.fg};border-color:${mgr.border}">${mgr.text}</span>
    ${vis ? `<span class="badge" style="background:${vis.bg};color:${vis.fg};border-color:${vis.border}">${vis.text}</span>` : ''}
    ${v.managerName ? `<span class="badge" style="background:#f8fafc;color:#334155;border-color:#e5e7eb">المعتمد: ${v.managerName}</span>` : ''}
  </div>
  <div class="foot">
    <span>طُبع في ${new Date().toLocaleString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' })}</span>
    <span>fablabsahsa.com</span>
  </div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 260);
  };

  // -------------------- RENDER --------------------

  const StatusPill = ({ v }) => {
    const mgr = managerBadge(v.approvalStatus);
    const vis = visitorBadge(v.visitorDecision);
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: mgr.bg, color: mgr.fg, border: `1px solid ${mgr.border}`
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: mgr.fg }} />
          {mgr.text}
        </span>
        {vis && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: vis.bg, color: vis.fg, border: `1px solid ${vis.border}`
          }}>
            {vis.text}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '16px 4px' }}>
      {/* Header + summary tiles */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>
          طلبات زيارة فاب لاب
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
          مراجعة طلبات الزيارة المستلمة، إرسالها للمدير للاعتماد، ثم إشعار الجهة الزائرة بالقرار.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { key: 'total',    label: 'الإجمالي',      value: counts.total,    color: '#0f172a' },
          { key: 'draft',    label: 'مسودّة',        value: counts.draft,    color: '#64748b' },
          { key: 'pending',  label: 'بانتظار المدير', value: counts.pending,  color: '#d97706' },
          { key: 'approved', label: 'جاهز لإشعار الزائر', value: counts.approved, color: '#0ea5e9' },
          { key: 'done',     label: 'مغلقة',         value: counts.done,     color: '#16a34a' },
          { key: 'rejected', label: 'مرفوض من المدير', value: counts.rejected, color: '#b91c1c' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key === 'total' ? 'all' : t.key)}
            style={{
              cursor: 'pointer', textAlign: isRTL ? 'right' : 'left',
              background: (statusFilter === (t.key === 'total' ? 'all' : t.key)) ? '#f1f5f9' : '#fff',
              border: (statusFilter === (t.key === 'total' ? 'all' : t.key)) ? `2px solid ${t.color}` : '1px solid #e5e7eb',
              padding: '12px 14px', borderRadius: 12, transition: 'all 0.16s'
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: 1, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.color, lineHeight: 1 }}>{t.value}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم / البريد / الجوال..."
          style={{
            flex: 1, minWidth: 220,
            padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb',
            fontFamily: 'inherit', fontSize: 14
          }}
        />
        <button
          onClick={fetchAll}
          style={{
            padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb',
            background: '#fff', color: '#0f172a', cursor: 'pointer', fontWeight: 600, fontSize: 13
          }}
        >
          🔄 تحديث
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#64748b', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12 }}>
          لا توجد طلبات في هذا التصنيف
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(v => (
            <motion.div
              key={v.visitId}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
              onClick={() => setOpenVisit(v)}
              style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16,
                cursor: 'pointer', transition: 'all 0.16s'
              }}
              whileHover={{ y: -2, boxShadow: '0 12px 28px -14px rgba(15,23,42,0.15)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '3px 10px', borderRadius: 999, letterSpacing: 1 }}>{fmtVisitNo(v.visitNumber)}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{v.entityName}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>
                    مسؤول: {v.personInCharge} · {v.visitorsCount || 1} زائر
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
                    <span dir="ltr">📅 {fmtDate(v.visitDate)}  ·  {fmtTime(v.visitStartTime)} → {fmtTime(v.visitEndTime)}</span>
                    <span dir="ltr">✉️ {v.email}</span>
                    <span dir="ltr">📱 {v.phone}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <StatusPill v={v} />
                  <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>{fmtWhen(v.createdAt)}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ===================== DETAIL MODAL ===================== */}
      <AnimatePresence>
        {openVisit && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpenVisit(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 18, maxWidth: 720, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
            >
              <div style={{ padding: 24, borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#0ea5e9', textTransform: 'uppercase' }}>طلب زيارة</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '3px 10px', borderRadius: 999, letterSpacing: 1.5 }}>{fmtVisitNo(openVisit.visitNumber)}</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{openVisit.entityName}</h3>
                  <div style={{ marginTop: 10 }}><StatusPill v={openVisit} /></div>
                </div>
                <button
                  onClick={() => setOpenVisit(null)}
                  style={{ background: 'none', border: '1px solid #e5e7eb', width: 34, height: 34, borderRadius: 10, cursor: 'pointer', color: '#64748b' }}
                >✕</button>
              </div>

              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    ['الشخص المسؤول', openVisit.personInCharge],
                    ['الجوال', <span dir="ltr">{openVisit.phone}</span>],
                    ['البريد', <span dir="ltr">{openVisit.email}</span>],
                    ...(openVisit.nationalId ? [['رقم الهوية', <span dir="ltr">{openVisit.nationalId}</span>]] : []),
                    ['عدد الزوار', openVisit.visitorsCount || 1],
                    ['تاريخ الزيارة', <span dir="ltr">{fmtDate(openVisit.visitDate)}</span>],
                    ['الوقت', <span dir="ltr">{fmtTime(openVisit.visitStartTime)} → {fmtTime(openVisit.visitEndTime)}</span>]
                  ].map(([k, val], i) => (
                    <div key={i} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', padding: 12, borderRadius: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>الغرض من الزيارة</div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', padding: 14, borderRadius: 10, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13 }}>{openVisit.purpose}</div>
                </div>

                {openVisit.notes && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>ملاحظات</div>
                    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', padding: 14, borderRadius: 10, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13 }}>{openVisit.notes}</div>
                  </div>
                )}

                {/* Manager approval history */}
                {(openVisit.sentForApprovalAt || openVisit.managerNote || openVisit.managerName) && (
                  <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>سجل الاعتماد</div>
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                      {openVisit.sentForApprovalAt && <div>أُرسل للاعتماد: <b>{fmtWhen(openVisit.sentForApprovalAt)}</b> → {openVisit.managerEmail}</div>}
                      {openVisit.approvedAt && <div>اعتمد: <b>{fmtWhen(openVisit.approvedAt)}</b>{openVisit.managerName && ` — ${openVisit.managerName}`}</div>}
                      {openVisit.rejectedAt && <div>رُفض: <b>{fmtWhen(openVisit.rejectedAt)}</b>{openVisit.managerName && ` — ${openVisit.managerName}`}</div>}
                      {openVisit.managerNote && <div style={{ marginTop: 6 }}>ملاحظة المدير: {openVisit.managerNote}</div>}
                    </div>
                  </div>
                )}

                {/* Visitor decision log */}
                {openVisit.visitorDecision !== 'pending' && (
                  <div style={{ background: openVisit.visitorDecision === 'accepted' ? '#eff6ff' : '#fef2f2', border: `1px solid ${openVisit.visitorDecision === 'accepted' ? '#bfdbfe' : '#fecaca'}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: openVisit.visitorDecision === 'accepted' ? '#1d4ed8' : '#b91c1c', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>القرار النهائي</div>
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                      <div>{openVisit.visitorDecision === 'accepted' ? '✅ تم قبول الزيارة' : '❌ تم رفض الزيارة'}</div>
                      {openVisit.visitorDecisionAt && <div>في: <b>{fmtWhen(openVisit.visitorDecisionAt)}</b>{openVisit.visitorDecisionBy && ` — بواسطة ${openVisit.visitorDecisionBy}`}</div>}
                      {openVisit.visitorEmailSentAt && <div>البريد للزائر: <b>أُرسل</b></div>}
                      {openVisit.visitorMessage && <div style={{ marginTop: 6 }}>رسالة الإدارة: {openVisit.visitorMessage}</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ padding: 20, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => printVisit(openVisit)}
                  style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  🖨️ طباعة
                </button>
                <button
                  onClick={() => deleteVisit(openVisit)}
                  style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  🗑️ حذف
                </button>

                {/* Send for approval — hidden once the visitor has been notified */}
                {openVisit.visitorDecision === 'pending' && openVisit.approvalStatus !== 'approved' && (
                  <button
                    onClick={() => openApprovalModal(openVisit)}
                    style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#f59e0b', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                  >
                    📧 {openVisit.approvalStatus === 'pending' ? 'إعادة الإرسال للمدير' : 'إرسال للمدير للاعتماد'}
                  </button>
                )}

                {/* Notify visitor buttons — only after manager approves */}
                {openVisit.approvalStatus === 'approved' && openVisit.visitorDecision === 'pending' && (
                  <>
                    <button
                      onClick={() => openNotifyModal(openVisit, 'reject')}
                      style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                    >
                      ✕ رفض وإشعار الزائر
                    </button>
                    <button
                      onClick={() => openNotifyModal(openVisit, 'accept')}
                      style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                    >
                      ✓ قبول وإشعار الزائر
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== SEND FOR APPROVAL MODAL ===================== */}
      <AnimatePresence>
        {approveModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setApproveModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 18, padding: 26, maxWidth: 460, width: '100%' }}
            >
              <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>إرسال للمدير للاعتماد</h3>
              <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: 13 }}>
                اختر المدير أو أدخل بريد مخصص. سيتم إرسال رابط لاعتماد الطلب مباشرة من بريده.
              </p>

              <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                {APPROVER_EMAILS.filter(a => a.email).map(a => (
                  <label
                    key={a.email}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      border: `1.5px solid ${approverChoice === a.email ? '#0ea5e9' : '#e5e7eb'}`,
                      background: approverChoice === a.email ? '#f0f9ff' : '#fff',
                      borderRadius: 10, cursor: 'pointer', transition: 'all 0.16s'
                    }}
                  >
                    <input
                      type="radio"
                      name="approver"
                      checked={approverChoice === a.email}
                      onChange={() => { setApproverChoice(a.email); setCustomEmail(''); }}
                      style={{ margin: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', direction: 'ltr' }}>{a.email}</div>
                    </div>
                  </label>
                ))}
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    border: `1.5px solid ${approverChoice === '__custom__' ? '#0ea5e9' : '#e5e7eb'}`,
                    background: approverChoice === '__custom__' ? '#f0f9ff' : '#fff',
                    borderRadius: 10, cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="approver"
                    checked={approverChoice === '__custom__'}
                    onChange={() => setApproverChoice('__custom__')}
                    style={{ margin: 0 }}
                  />
                  <div style={{ fontWeight: 700, fontSize: 14 }}>بريد مخصص</div>
                </label>
                {approverChoice === '__custom__' && (
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="manager@fablabahsa.org"
                    dir="ltr"
                    style={{
                      padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1',
                      fontFamily: 'inherit', fontSize: 14
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setApproveModal(null)}
                  disabled={sendingApproval}
                  style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  إلغاء
                </button>
                <button
                  onClick={sendForApproval}
                  disabled={sendingApproval || !approverChoice}
                  style={{
                    padding: '10px 22px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff',
                    cursor: (sendingApproval || !approverChoice) ? 'not-allowed' : 'pointer',
                    opacity: (sendingApproval || !approverChoice) ? 0.5 : 1, fontWeight: 800
                  }}
                >
                  {sendingApproval ? 'جارٍ الإرسال...' : '📧 إرسال'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== NOTIFY VISITOR MODAL ===================== */}
      <AnimatePresence>
        {notifyModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setNotifyModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 18, padding: 26, maxWidth: 480, width: '100%' }}
            >
              <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: notifyModal.decision === 'accept' ? '#16a34a' : '#b91c1c' }}>
                {notifyModal.decision === 'accept' ? 'قبول الزيارة وإشعار الزائر' : 'رفض الزيارة وإشعار الزائر'}
              </h3>
              <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 13 }}>
                سيتم إرسال بريد إلكتروني للزائر <b dir="ltr">{notifyModal.visit.email}</b> بهذا القرار.
              </p>

              <label style={{ display: 'block', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  رسالة اختيارية {notifyModal.decision === 'reject' ? '(مطلوبة كسبب رفض)' : ''}
                </div>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  rows={4}
                  placeholder={notifyModal.decision === 'accept'
                    ? 'مثال: يرجى الحضور قبل الموعد بـ 10 دقائق...'
                    : 'مثال: نعتذر — الموعد المطلوب غير متاح...'}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setNotifyModal(null)}
                  disabled={notifying}
                  style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  إلغاء
                </button>
                <button
                  onClick={notifyVisitor}
                  disabled={notifying}
                  style={{
                    padding: '10px 22px', borderRadius: 10, border: 'none',
                    background: notifyModal.decision === 'accept' ? '#16a34a' : '#dc2626', color: '#fff',
                    cursor: notifying ? 'not-allowed' : 'pointer',
                    opacity: notifying ? 0.5 : 1, fontWeight: 800
                  }}
                >
                  {notifying ? 'جارٍ الإرسال...' : (notifyModal.decision === 'accept' ? '✓ قبول وإرسال' : '✕ رفض وإرسال')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FablabVisitsTab;
