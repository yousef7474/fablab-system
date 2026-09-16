import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Admin's review tab for public project-support requests. Mirrors
// FablabVisitsTab but simpler: no override-code, no visitor-notify
// stage (the manager decision auto-emails the user with their
// written response). Prints as A4 with logos + signature block.

const fmtWhen = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
};
const fmtReqNo = (n) => n == null ? '—' : `PSR-${String(n).padStart(3, '0')}`;
const humanBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};
const iconFor = (ext) => {
  const e = String(ext || '').toLowerCase();
  if (['doc', 'docx'].includes(e)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📊';
  if (['ppt', 'pptx'].includes(e)) return '📽️';
  if (['pdf'].includes(e)) return '📕';
  if (['zip'].includes(e)) return '📦';
  if (['png', 'jpg', 'jpeg'].includes(e)) return '🖼️';
  return '📎';
};
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SUPPORT_TYPE_LABELS = {
  funding:    '💰 دعم مالي',
  tech:       '🛠 دعم فني',
  materials:  '📦 مواد وأدوات',
  mentorship: '👨‍🏫 إرشاد وتوجيه',
  other:      '🎯 أخرى'
};
const labelSupportType = (v) => SUPPORT_TYPE_LABELS[v] || v;
// Coalesce new JSON array + legacy string.
const supportTypeList = (r) => {
  if (Array.isArray(r?.supportTypes)) return r.supportTypes;
  if (r?.supportType) return [r.supportType];
  return [];
};

// Suggested approver emails — same convention as fablab visits.
// Free-text override always available.
const APPROVER_EMAILS = [
  { label: 'أ. زكي اللويم — المسؤول التنفيذي', email: 'zaki@fablabahsa.org' },
  { label: 'بريد آخر (كتابة يدوية)', email: '__custom__' }
];

const STATUS_META = {
  draft:     { ar: 'مسودة',       en: 'Draft',     bg: '#f1f5f9', color: '#475569' },
  pending:   { ar: 'بانتظار المدير', en: 'Pending',  bg: '#fef3c7', color: '#92400e' },
  approved:  { ar: 'معتمد',        en: 'Approved',  bg: '#dcfce7', color: '#166534' },
  rejected:  { ar: 'مرفوض',        en: 'Rejected',  bg: '#fee2e2', color: '#991b1b' }
};

const ProjectSupportTab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [openReq, setOpenReq] = useState(null); // full row incl. files (loaded on click)
  const [approveModal, setApproveModal] = useState(null); // { request }
  // Direct admin response — approve or reject without forwarding to
  // the manager. { request, decision: 'approved'|'rejected', response }.
  const [adminRespondModal, setAdminRespondModal] = useState(null);
  const [adminResponding, setAdminResponding] = useState(false);
  const [approverChoice, setApproverChoice] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [sendingApproval, setSendingApproval] = useState(false);
  const [downloadingIdx, setDownloadingIdx] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/project-support');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(isRTL ? 'تعذر تحميل الطلبات' : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isRTL]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== 'all') list = list.filter(r => r.approvalStatus === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.firstName || '').toLowerCase().includes(q) ||
        (r.lastName || '').toLowerCase().includes(q) ||
        (r.projectTitle || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.phoneNumber || '').includes(q) ||
        (r.nationalId || '').includes(q) ||
        String(r.requestNumber || '').includes(q)
      );
    }
    return list;
  }, [rows, statusFilter, search]);

  const counts = useMemo(() => {
    const c = { all: rows.length, draft: 0, pending: 0, approved: 0, rejected: 0 };
    rows.forEach(r => { c[r.approvalStatus] = (c[r.approvalStatus] || 0) + 1; });
    return c;
  }, [rows]);

  const openDetail = async (row) => {
    // Fetch the full record (with files) so admin can browse
    // attachments right in the modal without another click.
    try {
      const { data } = await api.get(`/project-support/${row.requestId}`);
      setOpenReq(data);
    } catch (err) {
      toast.error(isRTL ? 'تعذر تحميل التفاصيل' : 'Failed to load details');
    }
  };

  const openApprovalModal = (request) => {
    setApproveModal({ request });
    setApproverChoice('');
    setCustomEmail('');
  };

  const sendForApproval = async () => {
    if (!approveModal) return;
    const email = approverChoice === '__custom__'
      ? customEmail.trim()
      : approverChoice.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(isRTL ? 'اختر مدير أو أدخل بريد صحيح' : 'Pick a manager or enter a valid email');
      return;
    }
    setSendingApproval(true);
    try {
      const { data } = await api.post(`/project-support/${approveModal.request.requestId}/send-for-approval`, {
        managerEmail: email
      });
      toast.success(data?.emailFailed
        ? (isRTL ? 'تم تسجيل الطلب — فشل إرسال البريد. حاول مجدداً' : 'Saved — email failed, retry')
        : (isRTL ? 'تم إرسال الطلب للمدير للاعتماد' : 'Sent to manager for approval'));
      setApproveModal(null);
      setOpenReq(null);
      await fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || (isRTL ? 'تعذر الإرسال' : 'Failed to send'));
    } finally {
      setSendingApproval(false);
    }
  };

  const openAdminRespondModal = (request, decision) => {
    setAdminRespondModal({ request, decision, response: '' });
  };
  const submitAdminResponse = async () => {
    if (!adminRespondModal) return;
    const { request, decision, response } = adminRespondModal;
    if (!response.trim()) {
      toast.error(isRTL ? 'اكتب الرد الذي سيصل للمستفيد' : 'Write the response that will be emailed to the user');
      return;
    }
    setAdminResponding(true);
    try {
      await api.post(`/project-support/${request.requestId}/admin-respond`, {
        decision,
        response: response.trim()
      });
      toast.success(decision === 'approved'
        ? (isRTL ? '✅ تم الاعتماد وإرسال الرد للمستفيد' : '✅ Approved & user notified')
        : (isRTL ? '✕ تم الرفض وإرسال الرد للمستفيد' : '✕ Rejected & user notified'));
      setAdminRespondModal(null);
      setOpenReq(null);
      await fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || (isRTL ? 'تعذّر الحفظ' : 'Failed to save'));
    } finally {
      setAdminResponding(false);
    }
  };

  const deleteRequest = async (row) => {
    if (!window.confirm(isRTL ? 'حذف الطلب نهائياً؟' : 'Delete this request permanently?')) return;
    try {
      await api.delete(`/project-support/${row.requestId}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      setOpenReq(null);
      await fetchAll();
    } catch (err) {
      toast.error(isRTL ? 'تعذر الحذف' : 'Delete failed');
    }
  };

  const downloadFile = async (requestId, index, f) => {
    setDownloadingIdx(index);
    try {
      const { data } = await api.get(`/project-support/${requestId}/files/${index}`);
      const byteChars = atob(data.fileData);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName || `download.${data.fileType || 'bin'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch {
      toast.error(isRTL ? 'تعذر تنزيل الملف' : 'Download failed');
    } finally {
      setDownloadingIdx(null);
    }
  };

  const printRequest = (r) => {
    const win = window.open('', '_blank');
    if (!win) return toast.error(isRTL ? 'فشل فتح نافذة الطباعة' : 'Popup blocked');
    const reqNoStr = fmtReqNo(r.requestNumber);
    const status = STATUS_META[r.approvalStatus] || STATUS_META.draft;
    const submittedOn = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric' }) : '—';

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>طلب دعم مشروع ${reqNoStr}</title>
<style>
  @page { size: A4; margin: 15mm 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Tajawal','Segoe UI',Tahoma,sans-serif; color: #0f172a; background: #fff; font-size: 10.5pt; }
  .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 10px 20px; display: flex; gap: 8px; justify-content: end; z-index: 100; }
  .toolbar button { padding: 10px 20px; border-radius: 8px; border: none; background: linear-gradient(135deg,#8b5cf6,#6d28d9); color: #fff; font-weight: 800; cursor: pointer; font-family: inherit; }
  .toolbar button.ghost { background: #fff; color: #0f172a; border: 1px solid #e2e8f0; }
  .page { max-width: 190mm; margin: 8mm auto; padding: 4mm; }
  .doc-header { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; gap: 10mm; padding-bottom: 6mm; border-bottom: 3px solid #8b5cf6; }
  .doc-header img { max-height: 22mm; max-width: 100%; object-fit: contain; }
  .doc-header .title-block { text-align: center; }
  .doc-header h1 { margin: 0 0 2mm; font-size: 20pt; font-weight: 800; color: #6d28d9; letter-spacing: 2px; }
  .doc-header .subtitle { font-size: 10pt; color: #8b5cf6; font-weight: 700; }
  .doc-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 6mm; }
  .meta-card { background: #faf5ff; border: 1px solid #ede9fe; border-radius: 3mm; padding: 3mm 4mm; border-inline-start: 3px solid #8b5cf6; }
  .meta-card .lbl { font-size: 8.5pt; color: #6d28d9; letter-spacing: 0.4px; font-weight: 800; text-transform: uppercase; }
  .meta-card .val { font-size: 11pt; color: #0f172a; font-weight: 800; margin-top: 1mm; }
  .section-title { margin: 6mm 0 3mm; padding: 2mm 4mm; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: #fff; font-size: 11pt; font-weight: 800; letter-spacing: 1px; border-radius: 2mm; }
  .info-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .info-table th, .info-table td { border: 1px solid #cbd5e1; padding: 2mm 3mm; vertical-align: middle; }
  .info-table th { background: #f8fafc; text-align: right; width: 32%; font-weight: 700; color: #334155; }
  .desc-box { background: #faf5ff; border: 1px solid #ede9fe; border-radius: 3mm; padding: 4mm 5mm; font-size: 10.5pt; line-height: 1.9; white-space: pre-wrap; color: #0f172a; }
  .files-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2mm; }
  .files-list li { padding: 2mm 4mm; background: #fff; border: 1px solid #e2e8f0; border-radius: 2mm; font-size: 10pt; display: flex; justify-content: space-between; }
  .files-list li b { color: #6d28d9; }
  .response-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 3mm; padding: 4mm 5mm; font-size: 10.5pt; line-height: 1.85; white-space: pre-wrap; color: #14532d; margin-top: 3mm; }
  .response-box.reject { background: #fef2f2; border-color: #dc2626; color: #7f1d1d; }
  .response-box .lbl { font-size: 9pt; font-weight: 800; margin-bottom: 2mm; }
  .signer-panel { margin-top: 8mm; padding: 5mm 6mm; background: #fff; border: 1.5px solid #cbd5e1; border-radius: 3mm; box-shadow: 0 3mm 10mm -2mm rgba(15,23,42,0.10); }
  .signers-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .signer { text-align: center; font-size: 10pt; }
  .signer .role { color: #475569; font-weight: 700; font-size: 9.5pt; margin-bottom: 2mm; min-height: 8mm; }
  .signer .name { font-weight: 800; color: #0f172a; font-size: 10.5pt; margin-bottom: 6mm; }
  .signer .line { border-bottom: 2px solid #1f2937; height: 18mm; margin: 0 3mm 2mm; }
  .signer .hint { color: #64748b; font-size: 8.5pt; }
  .footer-strip { margin-top: 6mm; padding-top: 3mm; border-top: 1px dashed #94a3b8; display: flex; justify-content: space-between; font-size: 8.5pt; color: #64748b; }
  @media print {
    .toolbar { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { margin: 0 auto; }
    tr, td, th, li { page-break-inside: avoid; }
    .signer-panel { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="ghost" onclick="window.close()">إغلاق</button>
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  </div>
  <div class="page">
    <div class="doc-header">
      <img src="/fablab.png" alt="FABLAB">
      <div class="title-block">
        <h1>طلب دعم مشروع</h1>
        <div class="subtitle">Project Support Request</div>
      </div>
      <img src="/found.png" alt="Foundation">
    </div>

    <div class="doc-meta">
      <div class="meta-card">
        <div class="lbl">الرقم المتسلسل</div>
        <div class="val" style="color:#6d28d9;font-family:monospace">${esc(reqNoStr)}</div>
      </div>
      <div class="meta-card">
        <div class="lbl">تاريخ التقديم</div>
        <div class="val">${esc(submittedOn)}</div>
      </div>
      <div class="meta-card">
        <div class="lbl">الحالة</div>
        <div class="val">${esc(isRTL ? status.ar : status.en)}</div>
      </div>
    </div>

    <div class="section-title">👤 بيانات مقدم الطلب</div>
    <table class="info-table">
      <tr><th>الاسم الكامل</th><td>${esc(r.firstName)} ${esc(r.lastName || '')}</td></tr>
      <tr><th>رقم الهوية</th><td dir="ltr" style="text-align:right">${esc(r.nationalId)}</td></tr>
      <tr><th>الجوال</th><td dir="ltr" style="text-align:right">${esc(r.phoneNumber)}</td></tr>
      <tr><th>البريد الإلكتروني</th><td dir="ltr" style="text-align:right">${esc(r.email)}</td></tr>
      ${r.age ? `<tr><th>العمر</th><td>${esc(r.age)}</td></tr>` : ''}
      ${r.nationality ? `<tr><th>الجنسية</th><td>${esc(r.nationality)}</td></tr>` : ''}
      ${r.city ? `<tr><th>المدينة</th><td>${esc(r.city)}</td></tr>` : ''}
      ${r.sex ? `<tr><th>الجنس</th><td>${esc(r.sex === 'Male' ? 'ذكر' : 'أنثى')}</td></tr>` : ''}
    </table>

    <div class="section-title">📋 تفاصيل المشروع</div>
    <table class="info-table" style="margin-bottom:3mm">
      ${r.projectTitle ? `<tr><th>اسم المشروع</th><td>${esc(r.projectTitle)}</td></tr>` : ''}
      ${supportTypeList(r).length > 0 ? `<tr><th>نوع الدعم المطلوب</th><td>${esc(supportTypeList(r).map(labelSupportType).join('، '))}</td></tr>` : ''}
      <tr><th>عدد المرفقات</th><td><b>${Array.isArray(r.files) ? r.files.length : 0}</b> ملف</td></tr>
    </table>
    <div class="desc-box"><b style="color:#6d28d9">وصف الطلب:</b><br>${esc(r.description)}</div>

    ${Array.isArray(r.files) && r.files.length > 0 ? `
      <div class="section-title">📎 قائمة الملفات المرفقة</div>
      <ul class="files-list">
        ${r.files.map((f, i) => `
          <li>
            <span>${i + 1}. <b>${esc(f.fileName)}</b> (${(f.fileType || '').toUpperCase()})</span>
            <span style="font-family:monospace;color:#64748b">${humanBytes(f.fileSize)}</span>
          </li>
        `).join('')}
      </ul>` : ''}

    ${r.managerResponse ? `
      <div class="section-title">💬 رد الإدارة</div>
      <div class="response-box ${r.approvalStatus === 'rejected' ? 'reject' : ''}">
        <div class="lbl">${r.approvalStatus === 'approved' ? '✓ تمت الموافقة' : '✕ اعتذار'}${r.managerName ? ' — ' + esc(r.managerName) : ''}</div>
        ${esc(r.managerResponse)}
      </div>` : ''}

    <div class="signer-panel">
      <div class="signers-row">
        <div class="signer">
          <div class="role">مقدم الطلب</div>
          <div class="name">${esc(r.firstName)} ${esc(r.lastName || '')}</div>
          <div class="line"></div>
          <div class="hint">الاسم والتوقيع</div>
        </div>
        <div class="signer">
          <div class="role">المسؤول التنفيذي</div>
          <div class="name">${esc(r.managerName || 'أ. زكي اللويم')}</div>
          <div class="line"></div>
          <div class="hint">التوقيع والختم</div>
        </div>
      </div>
    </div>

    <div class="footer-strip">
      <div>فاب لاب الأحساء · مؤسسة عبدالمنعم الراشد الإنسانية</div>
      <div>${esc(reqNoStr)} · طُبع في ${new Date().toLocaleString('ar-SA-u-ca-gregory-nu-latn')}</div>
    </div>
  </div>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div style={{ padding: '4px 2px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
            💜 {isRTL ? 'طلبات دعم المشاريع' : 'Project Support Requests'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)', fontSize: 13 }}>
            {isRTL
              ? 'مراجعة الطلبات المستلمة من الجمهور — إرسالها للمدير، طباعتها، أو حذفها. سيتم إشعار المستفيد تلقائياً بقرار المدير.'
              : 'Review public support requests — send to manager, print, or delete. Users are auto-notified once the manager decides.'}
          </p>
        </div>
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          { key: 'all', ar: 'الكل', en: 'All', color: '#64748b' },
          { key: 'draft', ar: 'مسودة', en: 'Draft', color: '#94a3b8' },
          { key: 'pending', ar: 'بانتظار المدير', en: 'Pending', color: '#f59e0b' },
          { key: 'approved', ar: 'معتمد', en: 'Approved', color: '#16a34a' },
          { key: 'rejected', ar: 'مرفوض', en: 'Rejected', color: '#dc2626' }
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '8px 16px', borderRadius: 999,
              background: statusFilter === f.key ? f.color : 'var(--card-bg, #fff)',
              color: statusFilter === f.key ? '#fff' : 'var(--text-primary, #334155)',
              border: statusFilter === f.key ? 'none' : '1px solid var(--border-color, #e2e8f0)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            {isRTL ? f.ar : f.en} · {counts[f.key] || 0}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={isRTL ? 'بحث بالاسم، البريد، رقم الهوية، الرقم المتسلسل...' : 'Search name / email / national ID / #...'}
        style={{
          width: '100%', maxWidth: 480,
          padding: '10px 14px', borderRadius: 10,
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--card-bg, #fff)', color: 'var(--text-primary, #0f172a)',
          fontFamily: 'inherit', fontSize: 14, marginBottom: 20
        }}
      />

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary, #94a3b8)', background: 'var(--card-bg, #fff)', border: '1px dashed var(--border-color, #e2e8f0)', borderRadius: 12 }}>
          {isRTL ? 'لا توجد طلبات مطابقة.' : 'No matching requests.'}
        </div>
      ) : (
        <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary, #f8fafc)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'start', fontSize: 12, fontWeight: 700, color: '#334155', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>#</th>
                <th style={{ padding: '12px 14px', textAlign: 'start', fontSize: 12, fontWeight: 700, color: '#334155', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>{isRTL ? 'مقدم الطلب' : 'Requester'}</th>
                <th style={{ padding: '12px 14px', textAlign: 'start', fontSize: 12, fontWeight: 700, color: '#334155', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>{isRTL ? 'المشروع' : 'Project'}</th>
                <th style={{ padding: '12px 14px', textAlign: 'start', fontSize: 12, fontWeight: 700, color: '#334155', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>{isRTL ? 'الحالة' : 'Status'}</th>
                <th style={{ padding: '12px 14px', textAlign: 'start', fontSize: 12, fontWeight: 700, color: '#334155', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>{isRTL ? 'ملفات' : 'Files'}</th>
                <th style={{ padding: '12px 14px', textAlign: 'start', fontSize: 12, fontWeight: 700, color: '#334155', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>{isRTL ? 'الاستلام' : 'Received'}</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#334155', borderBottom: '1px solid var(--border-color, #e2e8f0)', width: 80 }}>{isRTL ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const st = STATUS_META[r.approvalStatus] || STATUS_META.draft;
                return (
                  <tr
                    key={r.requestId}
                    onClick={() => openDetail(r)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-color, #f1f5f9)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #faf5ff)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#6d28d9', fontSize: 13 }}>{fmtReqNo(r.requestNumber)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13.5 }}>
                      <div style={{ fontWeight: 700 }}>{r.firstName} {r.lastName || ''}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }} dir="ltr">{r.email}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#334155' }}>
                      {r.projectTitle || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}
                      {supportTypeList(r).length > 0 && (
                        <div style={{ fontSize: 11, color: '#6d28d9', marginTop: 2 }}>
                          {supportTypeList(r).map(labelSupportType).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: st.bg, color: st.color, fontSize: 11.5, fontWeight: 700 }}>
                        {isRTL ? st.ar : st.en}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 13 }}>
                      {r.fileCount || 0}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: '#64748b' }}>{fmtWhen(r.createdAt)}</td>
                    <td
                      style={{ padding: '12px 14px', textAlign: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => deleteRequest(r)}
                        title={isRTL ? 'حذف الطلب نهائياً' : 'Delete permanently'}
                        style={{
                          background: '#fff',
                          border: '1px solid #fecaca',
                          color: '#b91c1c',
                          padding: '5px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          cursor: 'pointer'
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {openReq && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpenReq(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 16, maxWidth: 780, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, letterSpacing: 1.2, opacity: 0.9 }}>طلب دعم مشروع · {fmtReqNo(openReq.requestNumber)}</div>
                    <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>
                      {openReq.projectTitle || `${openReq.firstName} ${openReq.lastName || ''}`.trim()}
                    </h2>
                  </div>
                  <button onClick={() => setOpenReq(null)} style={{ background: 'rgba(255,255,255,0.16)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              </div>

              <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
                {/* Personal info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>مقدم الطلب</div><div style={{ fontSize: 14, fontWeight: 700 }}>{openReq.firstName} {openReq.lastName || ''}</div></div>
                  <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>رقم الهوية</div><div style={{ fontSize: 14, fontWeight: 700 }} dir="ltr">{openReq.nationalId}</div></div>
                  <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>الجوال</div><div style={{ fontSize: 14, fontWeight: 700 }} dir="ltr">{openReq.phoneNumber}</div></div>
                  <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>البريد</div><div style={{ fontSize: 14, fontWeight: 700 }} dir="ltr">{openReq.email}</div></div>
                  {openReq.age && <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>العمر</div><div style={{ fontSize: 14, fontWeight: 700 }}>{openReq.age}</div></div>}
                  {openReq.city && <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>المدينة</div><div style={{ fontSize: 14, fontWeight: 700 }}>{openReq.city}</div></div>}
                  {supportTypeList(openReq).length > 0 && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>نوع الدعم المطلوب</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {supportTypeList(openReq).map(v => (
                          <span key={v} style={{
                            fontSize: 12, fontWeight: 700, color: '#6d28d9',
                            background: '#f5f3ff', border: '1px solid #ede9fe',
                            padding: '4px 10px', borderRadius: 999
                          }}>
                            {labelSupportType(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>وصف الطلب</div>
                  <div style={{ background: '#faf5ff', border: '1px solid #ede9fe', padding: 14, borderRadius: 10, whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13.5 }}>
                    {openReq.description}
                  </div>
                </div>

                {/* Files */}
                {Array.isArray(openReq.files) && openReq.files.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
                      الملفات المرفقة ({openReq.files.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {openReq.files.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                          <span style={{ fontSize: 18 }}>{iconFor(f.fileType)}</span>
                          <span style={{ flex: 1, fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#64748b', padding: '2px 8px', background: '#f1f5f9', borderRadius: 4 }}>{humanBytes(f.fileSize)}</span>
                          <button
                            onClick={() => downloadFile(openReq.requestId, i, f)}
                            disabled={downloadingIdx === i}
                            style={{ padding: '6px 12px', border: 'none', borderRadius: 6, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
                          >
                            {downloadingIdx === i ? '...' : (isRTL ? '⬇️ تنزيل' : '⬇️ Download')}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manager decision log if any */}
                {openReq.managerResponse && (
                  <div style={{
                    padding: 14, borderRadius: 10, marginBottom: 12,
                    background: openReq.approvalStatus === 'approved' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${openReq.approvalStatus === 'approved' ? '#86efac' : '#fecaca'}`
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: openReq.approvalStatus === 'approved' ? '#166534' : '#991b1b', marginBottom: 6 }}>
                      💬 رد الإدارة {openReq.managerName ? `— ${openReq.managerName}` : ''}
                    </div>
                    <div style={{ fontSize: 13.5, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#0f172a' }}>{openReq.managerResponse}</div>
                    {openReq.userEmailSentAt && <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>✉️ أُرسل للمستفيد: {fmtWhen(openReq.userEmailSentAt)}</div>}
                  </div>
                )}
              </div>

              <div style={{ padding: 16, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => printRequest(openReq)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  🖨️ طباعة
                </button>
                <button onClick={() => deleteRequest(openReq)} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  🗑️ حذف
                </button>
                {openReq.approvalStatus !== 'approved' && openReq.approvalStatus !== 'rejected' && (
                  <>
                    <button
                      onClick={() => openAdminRespondModal(openReq, 'rejected')}
                      title={isRTL ? 'رفض الطلب مباشرة وإرسال الرد للمستفيد دون الرجوع للمدير' : 'Reject directly and email the user without escalating to the manager'}
                      style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                    >
                      ✕ رفض مباشر
                    </button>
                    <button
                      onClick={() => openAdminRespondModal(openReq, 'approved')}
                      title={isRTL ? 'اعتماد الطلب مباشرة وإرسال الرد للمستفيد دون الرجوع للمدير' : 'Approve directly and email the user without escalating to the manager'}
                      style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #16a34a, #065f46)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}
                    >
                      ✓ اعتماد مباشر
                    </button>
                    <button onClick={() => openApprovalModal(openReq)} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                      📧 {openReq.approvalStatus === 'pending' ? 'إعادة الإرسال للمدير' : 'إرسال للمدير للاعتماد'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin direct-response modal (approve/reject without escalating) */}
      <AnimatePresence>
        {adminRespondModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAdminRespondModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 16, padding: 22, maxWidth: 520, width: '100%' }}
            >
              <h3 style={{ margin: '0 0 6px', color: adminRespondModal.decision === 'approved' ? '#16a34a' : '#b91c1c', fontSize: 18 }}>
                {adminRespondModal.decision === 'approved' ? '✓ اعتماد الطلب مباشرةً' : '✕ رفض الطلب مباشرةً'}
              </h3>
              <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 13, lineHeight: 1.7 }}>
                سيتم إرسال الرد مباشرة للمستفيد على بريده دون الرجوع للمدير.
                &nbsp;<b>{adminRespondModal.request?.firstName} {adminRespondModal.request?.lastName || ''}</b>
                {adminRespondModal.request?.email && <> · <span dir="ltr">{adminRespondModal.request.email}</span></>}
              </p>
              <label style={{ display: 'block', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>الرد المرسل للمستفيد *</div>
                <textarea
                  value={adminRespondModal.response}
                  onChange={(e) => setAdminRespondModal(m => ({ ...m, response: e.target.value }))}
                  rows={5}
                  placeholder={adminRespondModal.decision === 'approved'
                    ? 'اذكر تفاصيل الموافقة والخطوات التالية للمستفيد...'
                    : 'اذكر سبب الرفض واقتراحات بديلة إن أمكن...'}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #cbd5e1', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
                  autoFocus
                />
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setAdminRespondModal(null)}
                  disabled={adminResponding}
                  style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                >
                  إلغاء
                </button>
                <button
                  onClick={submitAdminResponse}
                  disabled={adminResponding}
                  style={{
                    padding: '10px 22px', borderRadius: 10, border: 'none',
                    background: adminRespondModal.decision === 'approved'
                      ? 'linear-gradient(135deg, #16a34a, #065f46)'
                      : 'linear-gradient(135deg, #dc2626, #991b1b)',
                    color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13
                  }}
                >
                  {adminResponding ? '…' : (adminRespondModal.decision === 'approved' ? '✓ اعتماد وإرسال' : '✕ رفض وإرسال')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send-for-approval modal */}
      <AnimatePresence>
        {approveModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setApproveModal(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 460, width: '100%' }}
            >
              <h3 style={{ margin: '0 0 8px', color: '#6d28d9', fontSize: 18 }}>📧 إرسال الطلب للمدير</h3>
              <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 13 }}>
                سيصل للمدير بريد يحتوي على تفاصيل الطلب مع رابط للاعتماد أو الرفض مع كتابة الرد للمستفيد.
              </p>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>اختيار المدير</div>
                <select value={approverChoice} onChange={(e) => setApproverChoice(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #cbd5e1', fontFamily: 'inherit', fontSize: 14 }}>
                  <option value="">— اختر —</option>
                  {APPROVER_EMAILS.map(a => (
                    <option key={a.email} value={a.email}>{a.label}</option>
                  ))}
                </select>
              </label>
              {approverChoice === '__custom__' && (
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>البريد الإلكتروني</div>
                  <input type="email" value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} dir="ltr"
                    placeholder="manager@example.com"
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #cbd5e1', fontFamily: 'inherit', fontSize: 14 }} />
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setApproveModal(null)} disabled={sendingApproval}
                  style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>إلغاء</button>
                <button onClick={sendForApproval} disabled={sendingApproval}
                  style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', cursor: sendingApproval ? 'not-allowed' : 'pointer', fontWeight: 800, opacity: sendingApproval ? 0.6 : 1 }}>
                  {sendingApproval ? 'جارٍ الإرسال...' : '📧 إرسال'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectSupportTab;
