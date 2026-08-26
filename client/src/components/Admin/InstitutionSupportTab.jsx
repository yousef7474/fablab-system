import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './InstitutionSupportTab.css';

const API_URL = process.env.NODE_ENV === 'production'
  ? '/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

const APPROVERS = [
  'م. نوف البوعبيد',
  'أ. زكي اللويم',
  'أ. عبدالله الصفي',
  'أ. عبدالمحسن السلطان'
];

const MAX_IMAGES = 50;
const fmtProjectNo = (n) => n == null ? '—' : `ISP-${String(n).padStart(4, '0')}`;

// Turn a browser File into { fileName, fileType, fileSize, fileData }
// with the base64 payload stripped of its data-URI prefix.
const readAsFilePayload = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const raw = String(e.target.result || '');
    const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    resolve({
      fileName: file.name,
      fileType: ext,
      fileSize: file.size,
      fileData: b64
    });
  };
  reader.onerror = () => reject(new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

const InstitutionSupportTab = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modal, setModal] = useState(null); // 'create' | 'edit' | null
  const [selected, setSelected] = useState(null); // selected project (with details)
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------- Load ----------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/institution-support');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر تحميل المشاريع' : 'Failed to load projects');
    } finally { setLoading(false); }
  }, [isRTL]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.projectName || '').toLowerCase().includes(q) ||
      (r.supervisorName || '').toLowerCase().includes(q) ||
      String(r.projectNumber || '').includes(q) ||
      (Array.isArray(r.studentNames) && r.studentNames.some(s => (s || '').toLowerCase().includes(q)))
    );
  }, [rows, search]);

  // ---------- Open / close ----------
  const openCreate = () => {
    setSelected({
      projectName: '', supervisorName: '', studentNames: [],
      evaluation: '', startDate: '', approvedBy: '', notes: ''
    });
    setModal('create');
  };

  const openEdit = async (row) => {
    setSelected(row); // show something immediately
    setModal('edit');
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/institution-support/${row.projectId}`);
      setSelected(data);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر تحميل تفاصيل المشروع' : 'Failed to load project');
    } finally { setDetailLoading(false); }
  };

  const close = () => { setModal(null); setSelected(null); };

  // ---------- Save (create or update meta) ----------
  const saveMeta = async () => {
    if (!selected?.projectName?.trim()) {
      return toast.error(isRTL ? 'اسم المشروع مطلوب' : 'Project name required');
    }
    setSaving(true);
    try {
      if (modal === 'create') {
        const { data } = await api.post('/institution-support', {
          projectName: selected.projectName,
          supervisorName: selected.supervisorName,
          studentNames: selected.studentNames,
          evaluation: selected.evaluation,
          startDate: selected.startDate || null,
          approvedBy: selected.approvedBy,
          notes: selected.notes
        });
        setSelected(data);
        setRows(prev => [{ ...data, imageCount: 0, invoiceCount: 0 }, ...prev]);
        setModal('edit'); // move into edit mode so user can attach files immediately
        toast.success(isRTL ? '✅ تم إنشاء المشروع' : '✅ Project created');
      } else {
        const { data } = await api.put(`/institution-support/${selected.projectId}`, {
          projectName: selected.projectName,
          supervisorName: selected.supervisorName,
          studentNames: selected.studentNames,
          evaluation: selected.evaluation,
          startDate: selected.startDate || null,
          approvedBy: selected.approvedBy,
          notes: selected.notes
        });
        setSelected(data);
        setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data } : r));
        toast.success(isRTL ? '💾 تم الحفظ' : '💾 Saved');
      }
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || (isRTL ? 'تعذّر الحفظ' : 'Save failed'));
    } finally { setSaving(false); }
  };

  // ---------- Delete ----------
  const deleteProject = async (row) => {
    if (!window.confirm(isRTL ? `حذف المشروع "${row.projectName}"؟` : `Delete "${row.projectName}"?`)) return;
    try {
      await api.delete(`/institution-support/${row.projectId}`);
      setRows(prev => prev.filter(r => r.projectId !== row.projectId));
      if (selected?.projectId === row.projectId) close();
      toast.success(isRTL ? '🗑️ تم الحذف' : '🗑️ Deleted');
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  // ---------- Reports (ar/en/patent) ----------
  const uploadReport = async (kind, file) => {
    try {
      const payload = await readAsFilePayload(file);
      const { data } = await api.put(`/institution-support/${selected.projectId}/report/${kind}`, { file: payload });
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data } : r));
      toast.success(isRTL ? '📄 تم رفع الملف' : '📄 File uploaded');
    } catch (err) {
      toast.error(isRTL ? 'تعذّر رفع الملف' : 'Upload failed');
    }
  };
  const clearReport = async (kind) => {
    if (!window.confirm(isRTL ? 'حذف هذا الملف؟' : 'Delete this file?')) return;
    try {
      const { data } = await api.delete(`/institution-support/${selected.projectId}/report/${kind}`);
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data } : r));
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  // ---------- Images ----------
  const uploadImages = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    const existing = Array.isArray(selected.images) ? selected.images.length : 0;
    const slots = MAX_IMAGES - existing;
    if (slots <= 0) {
      return toast.warning(isRTL ? `تم بلوغ الحد الأقصى (${MAX_IMAGES} صورة)` : `Reached max (${MAX_IMAGES} images)`);
    }
    const toSend = list.slice(0, slots);
    try {
      const payloads = await Promise.all(toSend.map(readAsFilePayload));
      const { data } = await api.post(`/institution-support/${selected.projectId}/images`, { images: payloads });
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data, imageCount: data.images?.length ?? r.imageCount } : r));
      toast.success(isRTL ? `📸 تمت إضافة ${toSend.length} صورة` : `📸 Added ${toSend.length} image(s)`);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر رفع الصور' : 'Upload failed');
    }
  };
  const removeImage = async (index) => {
    if (!window.confirm(isRTL ? 'حذف هذه الصورة؟' : 'Delete this image?')) return;
    try {
      const { data } = await api.delete(`/institution-support/${selected.projectId}/images/${index}`);
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data, imageCount: data.images?.length ?? r.imageCount } : r));
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  // ---------- Registration files ----------
  const uploadRegistrationFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    try {
      const payloads = await Promise.all(list.map(readAsFilePayload));
      const { data } = await api.post(`/institution-support/${selected.projectId}/registration-files`, { files: payloads });
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data, registrationFileCount: data.registrationFiles?.length ?? r.registrationFileCount } : r));
      toast.success(isRTL ? `📎 تمت إضافة ${list.length} ملف` : `📎 Added ${list.length} file(s)`);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر رفع الملفات' : 'Upload failed');
    }
  };
  const removeRegistrationFile = async (index) => {
    if (!window.confirm(isRTL ? 'حذف هذا الملف؟' : 'Delete this file?')) return;
    try {
      const { data } = await api.delete(`/institution-support/${selected.projectId}/registration-files/${index}`);
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data, registrationFileCount: data.registrationFiles?.length ?? r.registrationFileCount } : r));
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  // ---------- Chat screenshots ----------
  const uploadChatScreenshots = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    try {
      const payloads = await Promise.all(list.map(readAsFilePayload));
      const { data } = await api.post(`/institution-support/${selected.projectId}/chat-screenshots`, { files: payloads });
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data, chatScreenshotCount: data.chatScreenshots?.length ?? r.chatScreenshotCount } : r));
      toast.success(isRTL ? `💬 تمت إضافة ${list.length} لقطة` : `💬 Added ${list.length} screenshot(s)`);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر رفع اللقطات' : 'Upload failed');
    }
  };
  const removeChatScreenshot = async (index) => {
    if (!window.confirm(isRTL ? 'حذف هذه اللقطة؟' : 'Delete this screenshot?')) return;
    try {
      const { data } = await api.delete(`/institution-support/${selected.projectId}/chat-screenshots/${index}`);
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data, chatScreenshotCount: data.chatScreenshots?.length ?? r.chatScreenshotCount } : r));
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  // ---------- Invoices ----------
  const [newInvoice, setNewInvoice] = useState({ file: null, reason: '', amount: '', invoiceDate: '' });
  const addInvoice = async () => {
    if (!newInvoice.file) return toast.error(isRTL ? 'يرجى اختيار ملف الفاتورة' : 'Pick an invoice file');
    if (!newInvoice.reason.trim()) return toast.error(isRTL ? 'سبب الفاتورة مطلوب' : 'Invoice reason required');
    try {
      const payload = await readAsFilePayload(newInvoice.file);
      const { data } = await api.post(`/institution-support/${selected.projectId}/invoices`, {
        file: payload,
        reason: newInvoice.reason,
        amount: newInvoice.amount || null,
        invoiceDate: newInvoice.invoiceDate || null
      });
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data, invoiceCount: data.invoices?.length ?? r.invoiceCount } : r));
      setNewInvoice({ file: null, reason: '', amount: '', invoiceDate: '' });
      toast.success(isRTL ? '🧾 تمت إضافة الفاتورة' : '🧾 Invoice added');
    } catch (err) {
      toast.error(isRTL ? 'تعذّر إضافة الفاتورة' : 'Failed to add invoice');
    }
  };
  const removeInvoice = async (index) => {
    if (!window.confirm(isRTL ? 'حذف هذه الفاتورة؟' : 'Delete this invoice?')) return;
    try {
      const { data } = await api.delete(`/institution-support/${selected.projectId}/invoices/${index}`);
      setSelected(data);
      setRows(prev => prev.map(r => r.projectId === data.projectId ? { ...r, ...data, invoiceCount: data.invoices?.length ?? r.invoiceCount } : r));
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    }
  };

  // ---------- Download ----------
  // Auth'd fetch → blob → trigger download. Works for all
  // report / patent / image / invoice files.
  const downloadFile = async (kind, index, fileName) => {
    try {
      const path = index != null
        ? `${API_URL}/institution-support/${selected.projectId}/download/${kind}/${index}`
        : `${API_URL}/institution-support/${selected.projectId}/download/${kind}`;
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` }
      });
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'file';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(isRTL ? 'تعذّر تحميل الملف' : 'Download failed');
    }
  };

  const openPrint = () => {
    // window.open() can't send an Authorization header, so pass the
    // token via the query-string fallback the auth middleware accepts.
    const token = localStorage.getItem('adminToken') || '';
    const url = `${API_URL}/institution-support/${selected.projectId}/print?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank');
  };

  // Download the full merged PDF (cover pages + all uploaded PDFs
  // merged in verbatim via pdf-lib). May take a few seconds — big
  // requests can be slow because puppeteer renders the cover.
  const [exportingPdf, setExportingPdf] = useState(false);
  const downloadMergedPdf = async () => {
    setExportingPdf(true);
    try {
      const token = localStorage.getItem('adminToken') || '';
      const url = `${API_URL}/institution-support/${selected.projectId}/pdf?token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${fmtProjectNo(selected.projectNumber)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success(isRTL ? '✅ تم تحميل التقرير الكامل' : '✅ Full report downloaded');
    } catch (err) {
      console.error('mergedPdf:', err);
      toast.error(isRTL ? 'تعذّر تصدير PDF — راجع سجل الخادم' : 'PDF export failed — check server logs');
    } finally {
      setExportingPdf(false);
    }
  };

  // ---------- Student editor ----------
  // Each student is { name, phone, nationalId }. Old rows that carry
  // plain strings are normalized to that shape on render.
  const [studentDraft, setStudentDraft] = useState({ name: '', phone: '', nationalId: '' });
  const normalizeStudent = (s) => typeof s === 'string'
    ? { name: s, phone: '', nationalId: '' }
    : { name: s?.name || '', phone: s?.phone || '', nationalId: s?.nationalId || '' };
  const students = (selected?.studentNames || []).map(normalizeStudent);
  const addStudent = () => {
    const name = studentDraft.name.trim();
    if (!name) {
      return toast.error(isRTL ? 'اسم الطالبة مطلوب' : 'Student name required');
    }
    setSelected(s => ({
      ...s,
      studentNames: [
        ...students,
        { name, phone: studentDraft.phone.trim(), nationalId: studentDraft.nationalId.trim() }
      ]
    }));
    setStudentDraft({ name: '', phone: '', nationalId: '' });
  };
  const removeStudent = (i) => setSelected(s => ({
    ...s,
    studentNames: students.filter((_, idx) => idx !== i)
  }));

  // ---------- Render ----------
  const patch = (key, value) => setSelected(s => ({ ...s, [key]: value }));

  return (
    <div className="isp" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="isp-head">
        <div>
          <h2>🏛️ {isRTL ? 'دعم مؤسسة' : 'Institution Support'}</h2>
          <p>{isRTL
            ? 'ملفات المشاريع المدعومة من مؤسسة عبدالمنعم الراشد الإنسانية — تقارير، صور، فواتير، وطباعة تقرير كامل.'
            : 'Files for projects supported by AbdulMoneim Al-Rashed Foundation — reports, images, invoices, and printable full report.'}
          </p>
        </div>
        <button className="isp-btn isp-btn--primary" onClick={openCreate}>
          + {isRTL ? 'مشروع جديد' : 'New project'}
        </button>
      </div>

      <input
        type="text"
        className="isp-search"
        placeholder={isRTL ? 'بحث بالاسم أو الرقم أو المشرف أو الطالب...' : 'Search by name / number / supervisor / student...'}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="isp-empty">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="isp-empty">
          <div style={{ fontSize: 44, opacity: 0.4 }}>🏛️</div>
          <p>{isRTL ? 'لا توجد مشاريع بعد. اضغط "مشروع جديد" للإضافة.' : 'No projects yet. Click "New project" to add one.'}</p>
        </div>
      ) : (
        <div className="isp-grid">
          {filtered.map(r => (
            <motion.div
              key={r.projectId}
              className="isp-card"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              onClick={() => openEdit(r)}
            >
              <div className="isp-card-top">
                <span className="isp-card-no">{fmtProjectNo(r.projectNumber)}</span>
                <span className="isp-card-date">{r.startDate || '—'}</span>
              </div>
              <h3 className="isp-card-title">{r.projectName}</h3>
              <div className="isp-card-sub">
                {r.supervisorName && <><b>{r.supervisorName}</b> · </>}
                {Array.isArray(r.studentNames) && r.studentNames.length > 0
                  ? `${r.studentNames.length} ${isRTL ? 'طالبة/طالب' : 'students'}`
                  : (isRTL ? 'لا يوجد طلاب' : 'No students')}
              </div>
              <div className="isp-card-badges">
                <span className={`isp-badge ${r.hasReportAr ? 'ok' : ''}`} title={isRTL ? 'تقرير عربي' : 'Arabic report'}>AR</span>
                <span className={`isp-badge ${r.hasReportEn ? 'ok' : ''}`} title={isRTL ? 'تقرير إنجليزي' : 'English report'}>EN</span>
                <span className={`isp-badge ${r.hasPatentFile ? 'ok' : ''}`} title={isRTL ? 'براءة اختراع' : 'Patent'}>©</span>
                <span className="isp-badge count">📸 {r.imageCount || 0}</span>
                <span className="isp-badge count">🧾 {r.invoiceCount || 0}</span>
              </div>
              {r.approvedBy && (
                <div className="isp-card-approved">✓ {isRTL ? 'معتمد من' : 'Approved by'} <b>{r.approvedBy}</b></div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* --------------- Modal --------------- */}
      <AnimatePresence>
        {modal && selected && (
          <motion.div
            className="isp-modal-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              className="isp-modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="isp-modal-head">
                <div className="isp-modal-head-lead">
                  <div className="isp-modal-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18"/>
                      <path d="M5 21V9l7-5 7 5v12"/>
                      <rect x="9" y="12" width="6" height="9"/>
                      <path d="M9 9h6"/>
                    </svg>
                  </div>
                  <div>
                    <div className="isp-modal-kicker">
                      {modal === 'create'
                        ? (isRTL ? '✨ إنشاء مشروع دعم جديد' : '✨ Create a new support project')
                        : (isRTL ? 'ملف مشروع الدعم' : 'Support project file')}
                    </div>
                    <h3>{selected.projectName || (isRTL ? '(بدون اسم)' : '(untitled)')}</h3>
                    {selected.projectNumber != null && (
                      <div className="isp-modal-no">{fmtProjectNo(selected.projectNumber)}</div>
                    )}
                  </div>
                </div>
                <div className="isp-modal-head-actions">
                  {modal === 'edit' && (
                    <>
                      <button
                        className="isp-btn isp-btn--print"
                        onClick={downloadMergedPdf}
                        disabled={exportingPdf}
                        title={isRTL ? 'تنزيل PDF كامل ومدمج (يشمل جميع الملفات)' : 'Download merged PDF with all uploaded files'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        {exportingPdf
                          ? (isRTL ? 'جاري التصدير...' : 'Exporting...')
                          : (isRTL ? 'PDF كامل' : 'Full PDF')}
                      </button>
                      <button
                        className="isp-btn isp-btn--print"
                        onClick={openPrint}
                        title={isRTL ? 'معاينة التقرير في المتصفح' : 'Browser preview'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        {isRTL ? 'معاينة' : 'Preview'}
                      </button>
                    </>
                  )}
                  <button className="isp-modal-close" onClick={close} title={isRTL ? 'إغلاق' : 'Close'}>✕</button>
                </div>
              </div>

              {/* Completeness strip (edit mode only) */}
              {modal === 'edit' && !detailLoading && (
                <div className="isp-progress-strip">
                  {[
                    { label: isRTL ? 'المعلومات' : 'Info',   done: !!selected.projectName, icon: '📋' },
                    { label: isRTL ? 'تقرير عربي' : 'AR report',    done: !!selected.reportAr, icon: '📄' },
                    { label: isRTL ? 'تقرير إنجليزي' : 'EN report', done: !!selected.reportEn, icon: '📄' },
                    { label: isRTL ? 'براءة اختراع' : 'Patent',     done: !!selected.patentFile, icon: '©' },
                    { label: isRTL ? `صور (${selected.images?.length || 0}/${MAX_IMAGES})` : `Images (${selected.images?.length || 0}/${MAX_IMAGES})`, done: (selected.images?.length || 0) > 0, icon: '📸' },
                    { label: isRTL ? `فواتير (${selected.invoices?.length || 0})` : `Invoices (${selected.invoices?.length || 0})`, done: (selected.invoices?.length || 0) > 0, icon: '🧾' },
                    { label: isRTL ? `ملفات تسجيل (${selected.registrationFiles?.length || 0})` : `Registration (${selected.registrationFiles?.length || 0})`, done: (selected.registrationFiles?.length || 0) > 0, icon: '📎' },
                    { label: isRTL ? `محادثات (${selected.chatScreenshots?.length || 0})` : `Chats (${selected.chatScreenshots?.length || 0})`, done: (selected.chatScreenshots?.length || 0) > 0, icon: '💬' }
                  ].map((s, i) => (
                    <div key={i} className={`isp-progress-item ${s.done ? 'is-done' : ''}`}>
                      <span className="isp-progress-icon">{s.done ? '✓' : s.icon}</span>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {detailLoading ? (
                <div className="isp-modal-body">
                  <div className="isp-empty">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
                </div>
              ) : (
                <div className="isp-modal-body">
                  {/* -------- Create-mode welcome banner -------- */}
                  {modal === 'create' && (
                    <div className="isp-welcome">
                      <div className="isp-welcome-icon">✨</div>
                      <div>
                        <b>{isRTL ? 'ابدأ بالمعلومات الأساسية' : 'Start with the basics'}</b>
                        <p>{isRTL
                          ? 'أدخل معلومات المشروع الأساسية أولاً — بعد الإنشاء سيمكنك رفع التقارير والصور والفواتير.'
                          : 'Enter the core project info first — after creating you can upload reports, images, and invoices.'}</p>
                      </div>
                    </div>
                  )}

                  {/* -------- Meta -------- */}
                  <section className="isp-section">
                    <div className="isp-section-head">
                      <span className="isp-step">1</span>
                      <div>
                        <h4>{isRTL ? 'معلومات المشروع' : 'Project info'}</h4>
                        <p>{isRTL ? 'البيانات الأساسية للمشروع، فريق العمل، والاعتماد' : 'Core details, team, and approval'}</p>
                      </div>
                    </div>
                    <div className="isp-grid-2">
                      <label>
                        <span>{isRTL ? 'اسم المشروع *' : 'Project name *'}</span>
                        <input type="text" value={selected.projectName || ''} onChange={e => patch('projectName', e.target.value)} />
                      </label>
                      <label>
                        <span>{isRTL ? 'اسم المشرف' : 'Supervisor'}</span>
                        <input type="text" value={selected.supervisorName || ''} onChange={e => patch('supervisorName', e.target.value)} />
                      </label>
                      <label>
                        <span>{isRTL ? 'تاريخ البداية' : 'Start date'}</span>
                        <input type="date" value={(selected.startDate || '').slice(0, 10)} onChange={e => patch('startDate', e.target.value)} />
                      </label>
                      <label>
                        <span>{isRTL ? 'معتمد من' : 'Approved by'}</span>
                        <select value={selected.approvedBy || ''} onChange={e => patch('approvedBy', e.target.value)}>
                          <option value="">— {isRTL ? 'اختر المعتمد' : 'Select approver'} —</option>
                          {APPROVERS.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>
                    </div>

                    <div className="isp-students" style={{ marginTop: 12 }}>
                      <div className="isp-students-title">
                        <span>{isRTL ? '👥 الطلاب / الطالبات' : '👥 Students'}</span>
                        <b>{students.length}</b>
                      </div>
                      <div className="isp-students-add">
                        <div className="isp-students-add-grid">
                          <input
                            type="text"
                            value={studentDraft.name}
                            onChange={e => setStudentDraft(d => ({ ...d, name: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStudent(); } }}
                            placeholder={isRTL ? 'الاسم الكامل *' : 'Full name *'}
                          />
                          <input
                            type="tel"
                            dir="ltr"
                            value={studentDraft.phone}
                            onChange={e => setStudentDraft(d => ({ ...d, phone: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStudent(); } }}
                            placeholder={isRTL ? 'رقم الجوال' : 'Phone'}
                          />
                          <input
                            type="text"
                            dir="ltr"
                            value={studentDraft.nationalId}
                            onChange={e => setStudentDraft(d => ({ ...d, nationalId: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStudent(); } }}
                            placeholder={isRTL ? 'رقم الهوية' : 'National ID'}
                          />
                          <button type="button" className="isp-students-add-btn" onClick={addStudent}>
                            + {isRTL ? 'إضافة' : 'Add'}
                          </button>
                        </div>
                      </div>
                      {students.length > 0 && (
                        <div className="isp-students-list">
                          {students.map((st, i) => (
                            <div key={i} className="isp-student-card">
                              <div className="isp-student-avatar">
                                {(st.name || '?').trim().charAt(0).toUpperCase()}
                              </div>
                              <div className="isp-student-body">
                                <b>{st.name || (isRTL ? '(بدون اسم)' : '(no name)')}</b>
                                <div className="isp-student-meta">
                                  {st.phone && <span dir="ltr">📞 {st.phone}</span>}
                                  {st.nationalId && <span dir="ltr">🆔 {st.nationalId}</span>}
                                  {!st.phone && !st.nationalId && (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                      {isRTL ? 'لا توجد بيانات اتصال' : 'No contact info'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="isp-student-del"
                                onClick={() => removeStudent(i)}
                                title={isRTL ? 'حذف' : 'Remove'}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <label style={{ marginTop: 10, display: 'block' }}>
                      <span>{isRTL ? 'تقييم المشروع (نسبة الدعم / كمية الدعم / ملاحظات)' : 'Evaluation (support % / amount / notes)'}</span>
                      <textarea rows={3} value={selected.evaluation || ''} onChange={e => patch('evaluation', e.target.value)} />
                    </label>

                    <label style={{ marginTop: 10, display: 'block' }}>
                      <span>{isRTL ? 'ملاحظات إضافية' : 'Additional notes'}</span>
                      <textarea rows={2} value={selected.notes || ''} onChange={e => patch('notes', e.target.value)} />
                    </label>

                    <div className="isp-save-bar">
                      <button className="isp-btn isp-btn--primary isp-btn--lg" onClick={saveMeta} disabled={saving}>
                        {saving
                          ? (isRTL ? 'جاري الحفظ...' : 'Saving...')
                          : modal === 'create'
                            ? <>✨ {isRTL ? 'إنشاء المشروع والمتابعة' : 'Create project & continue'}</>
                            : <>💾 {isRTL ? 'حفظ التعديلات' : 'Save changes'}</>}
                      </button>
                    </div>
                  </section>

                  {/* -------- Files (only after creation) -------- */}
                  {modal === 'edit' && (
                    <>
                      <section className="isp-section">
                        <div className="isp-section-head">
                          <span className="isp-step isp-step--2">2</span>
                          <div>
                            <h4>{isRTL ? 'الملفات والتقارير' : 'Documents & reports'}</h4>
                            <p>{isRTL ? 'ارفع التقرير العربي، التقرير الإنجليزي، وملف براءة الاختراع' : 'Upload the Arabic report, English report, and patent file'}</p>
                          </div>
                        </div>
                        <div className="isp-reports-grid">
                          <ReportSlot
                            label={isRTL ? 'تقرير المشروع (عربي)' : 'Project report (Arabic)'}
                            accent="#EE2329"
                            badge="AR"
                            file={selected.reportAr}
                            onUpload={(f) => uploadReport('ar', f)}
                            onClear={() => clearReport('ar')}
                            onDownload={() => downloadFile('report-ar', null, selected.reportAr?.fileName)}
                            isRTL={isRTL}
                          />
                          <ReportSlot
                            label={isRTL ? 'تقرير المشروع (إنجليزي)' : 'Project report (English)'}
                            accent="#2563eb"
                            badge="EN"
                            file={selected.reportEn}
                            onUpload={(f) => uploadReport('en', f)}
                            onClear={() => clearReport('en')}
                            onDownload={() => downloadFile('report-en', null, selected.reportEn?.fileName)}
                            isRTL={isRTL}
                          />
                          <ReportSlot
                            label={isRTL ? 'ملف براءة الاختراع' : 'Patent file'}
                            accent="#8b5cf6"
                            badge="©"
                            optional
                            file={selected.patentFile}
                            onUpload={(f) => uploadReport('patent', f)}
                            onClear={() => clearReport('patent')}
                            onDownload={() => downloadFile('patent', null, selected.patentFile?.fileName)}
                            isRTL={isRTL}
                          />
                        </div>
                      </section>

                      {/* -------- Images -------- */}
                      <section className="isp-section">
                        <div className="isp-section-head">
                          <span className="isp-step isp-step--3">3</span>
                          <div>
                            <h4>{isRTL ? 'صور المشروع' : 'Project images'}</h4>
                            <p>{isRTL ? `يمكنك رفع حتى ${MAX_IMAGES} صورة توثق المشروع` : `Upload up to ${MAX_IMAGES} images documenting the project`}</p>
                          </div>
                          <span className="isp-count-pill">{(selected.images?.length || 0)}<span>/{MAX_IMAGES}</span></span>
                        </div>
                        {(selected.images?.length || 0) < MAX_IMAGES && (
                          <label className="isp-dropzone">
                            <input
                              type="file"
                              multiple
                              accept="image/*,*/*"
                              onChange={e => { uploadImages(e.target.files); e.target.value = ''; }}
                            />
                            <span>+ {isRTL ? 'رفع صور' : 'Upload images'}</span>
                            <small>{isRTL ? 'يمكنك اختيار عدة صور دفعة واحدة' : 'Multiple selection supported'}</small>
                          </label>
                        )}
                        {selected.images?.length > 0 && (
                          <div className="isp-image-grid">
                            {selected.images.map((img, i) => (
                              <div key={i} className="isp-image-cell">
                                <div className="isp-image-thumb">
                                  {img.fileType && ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(String(img.fileType).toLowerCase()) ? (
                                    <span>🖼️</span>
                                  ) : (
                                    <span>📄</span>
                                  )}
                                </div>
                                <div className="isp-image-meta">
                                  <b title={img.fileName}>{img.fileName}</b>
                                  <span>{((img.fileSize || 0) / 1024).toFixed(1)} KB · .{img.fileType}</span>
                                </div>
                                <div className="isp-image-actions">
                                  <button onClick={() => downloadFile('image', i, img.fileName)} title={isRTL ? 'تحميل' : 'Download'}>⬇</button>
                                  <button className="danger" onClick={() => removeImage(i)} title={isRTL ? 'حذف' : 'Delete'}>🗑</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* -------- Invoices -------- */}
                      <section className="isp-section">
                        <div className="isp-section-head">
                          <span className="isp-step isp-step--4">4</span>
                          <div>
                            <h4>{isRTL ? 'الفواتير والمصروفات' : 'Invoices & expenses'}</h4>
                            <p>{isRTL ? 'ارفع كل فاتورة على حدة مع سبب الشراء والمبلغ' : 'Upload each invoice with its reason and amount'}</p>
                          </div>
                          <span className="isp-count-pill">{selected.invoices?.length || 0}</span>
                        </div>
                        <div className="isp-invoice-add">
                          <div className="isp-invoice-add-title">
                            <span>+ {isRTL ? 'إضافة فاتورة جديدة' : 'Add new invoice'}</span>
                          </div>
                          <div className="isp-grid-2">
                            <label>
                              <span>{isRTL ? 'ملف الفاتورة (صورة أو PDF)' : 'Invoice file (image or PDF)'}</span>
                              <input
                                type="file"
                                accept="image/*,application/pdf,*/*"
                                onChange={e => setNewInvoice(v => ({ ...v, file: e.target.files?.[0] || null }))}
                              />
                            </label>
                            <label>
                              <span>{isRTL ? 'السبب / الوصف *' : 'Reason / description *'}</span>
                              <input
                                type="text"
                                value={newInvoice.reason}
                                onChange={e => setNewInvoice(v => ({ ...v, reason: e.target.value }))}
                                placeholder={isRTL ? 'مثال: قطع غيار للمشروع' : 'e.g., Project spare parts'}
                              />
                            </label>
                            <label>
                              <span>{isRTL ? 'المبلغ (اختياري)' : 'Amount (optional)'}</span>
                              <input
                                type="number" step="0.01" min="0"
                                value={newInvoice.amount}
                                onChange={e => setNewInvoice(v => ({ ...v, amount: e.target.value }))}
                              />
                            </label>
                            <label>
                              <span>{isRTL ? 'تاريخ الفاتورة (اختياري)' : 'Invoice date (optional)'}</span>
                              <input
                                type="date"
                                value={newInvoice.invoiceDate}
                                onChange={e => setNewInvoice(v => ({ ...v, invoiceDate: e.target.value }))}
                              />
                            </label>
                          </div>
                          <div style={{ textAlign: 'end', marginTop: 8 }}>
                            <button className="isp-btn isp-btn--primary" onClick={addInvoice}>
                              + {isRTL ? 'إضافة الفاتورة' : 'Add invoice'}
                            </button>
                          </div>
                        </div>

                        {selected.invoices?.length > 0 && (
                          <div className="isp-invoice-list">
                            {selected.invoices.map((inv, i) => (
                              <div key={i} className="isp-invoice-row">
                                <div className="isp-invoice-icon">🧾</div>
                                <div className="isp-invoice-body">
                                  <b>{inv.reason || (isRTL ? '(بدون سبب)' : '(no reason)')}</b>
                                  <div className="isp-invoice-meta">
                                    {inv.amount != null && <span>💰 {Number(inv.amount).toFixed(2)} ر.س</span>}
                                    {inv.invoiceDate && <span>📅 {inv.invoiceDate}</span>}
                                    <span title={inv.fileName}>📎 {inv.fileName} .{inv.fileType}</span>
                                  </div>
                                </div>
                                <div className="isp-invoice-actions">
                                  <button onClick={() => downloadFile('invoice', i, inv.fileName)}>⬇ {isRTL ? 'تحميل' : 'Download'}</button>
                                  <button className="danger" onClick={() => removeInvoice(i)}>🗑</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* -------- Registration files -------- */}
                      <section className="isp-section">
                        <div className="isp-section-head">
                          <span className="isp-step isp-step--5">5</span>
                          <div>
                            <h4>{isRTL ? 'ملفات التسجيل في فاب لاب' : 'FabLab registration files'}</h4>
                            <p>{isRTL
                              ? 'ارفع نماذج التسجيل والاستمارات التي تم استيفاؤها من الطلاب عند انضمامهم للفاب لاب'
                              : 'Upload registration forms and paperwork filled by students when they joined the lab'}</p>
                          </div>
                          <span className="isp-count-pill">{selected.registrationFiles?.length || 0}</span>
                        </div>
                        <FileListSection
                          files={selected.registrationFiles || []}
                          onUpload={uploadRegistrationFiles}
                          onDownload={(i, name) => downloadFile('registration', i, name)}
                          onRemove={removeRegistrationFile}
                          uploadHint={isRTL ? 'ملفات PDF أو صور — يمكنك اختيار عدة ملفات دفعة واحدة' : 'PDFs or images — multi-select supported'}
                          accent="#2563eb"
                          uploadLabel={isRTL ? '+ رفع ملفات التسجيل' : '+ Upload registration files'}
                          isRTL={isRTL}
                        />
                      </section>

                      {/* -------- Chat screenshots -------- */}
                      <section className="isp-section">
                        <div className="isp-section-head">
                          <span className="isp-step isp-step--6">6</span>
                          <div>
                            <h4>{isRTL ? 'لقطات المحادثات (واتساب / بريد إلكتروني)' : 'Chat screenshots (WhatsApp / email)'}</h4>
                            <p>{isRTL
                              ? 'اختياري — أضف صور المحادثات المتعلقة بالمشروع لتوثيق التواصل مع الطلاب'
                              : 'Optional — attach chat screenshots to document communication with students'}</p>
                          </div>
                          <span className="isp-count-pill">{selected.chatScreenshots?.length || 0}</span>
                        </div>
                        <FileListSection
                          files={selected.chatScreenshots || []}
                          onUpload={uploadChatScreenshots}
                          onDownload={(i, name) => downloadFile('chat', i, name)}
                          onRemove={removeChatScreenshot}
                          uploadHint={isRTL ? 'صور فقط عادةً — لكن أي ملف مقبول' : 'Usually images — but any file works'}
                          accent="#8b5cf6"
                          uploadLabel={isRTL ? '+ رفع لقطات محادثة' : '+ Upload screenshots'}
                          isRTL={isRTL}
                        />
                      </section>

                      <div className="isp-modal-foot">
                        <button className="isp-btn isp-btn--danger" onClick={() => deleteProject(selected)}>
                          🗑️ {isRTL ? 'حذف المشروع' : 'Delete project'}
                        </button>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button className="isp-btn isp-btn--print-solid" onClick={openPrint}>
                            👁️ {isRTL ? 'معاينة في المتصفح' : 'Preview in browser'}
                          </button>
                          <button
                            className="isp-btn isp-btn--primary"
                            onClick={downloadMergedPdf}
                            disabled={exportingPdf}
                          >
                            {exportingPdf
                              ? (isRTL ? '⏳ جاري تصدير PDF...' : '⏳ Exporting PDF...')
                              : (isRTL ? '⬇️ تحميل PDF كامل مدمج' : '⬇️ Download merged PDF')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---------- Small subcomponent: report slot ----------
const ReportSlot = ({ label, accent = '#0ea5e9', badge, optional, file, onUpload, onClear, onDownload, isRTL }) => {
  const inputRef = useRef(null);
  const filled = !!file;
  return (
    <div
      className={`isp-report-card ${filled ? 'is-filled' : 'is-empty'}`}
      style={{ '--accent': accent }}
    >
      <div className="isp-report-card-head">
        {badge && <span className="isp-report-badge" style={{ background: accent }}>{badge}</span>}
        <div>
          <div className="isp-report-card-title">
            {label}
            {optional && <span className="isp-report-optional">{isRTL ? 'اختياري' : 'optional'}</span>}
          </div>
          <div className="isp-report-card-status">
            {filled
              ? (isRTL ? '✓ تم الرفع' : '✓ Uploaded')
              : (isRTL ? 'لا يوجد ملف بعد' : 'No file yet')}
          </div>
        </div>
      </div>

      {filled ? (
        <>
          <div className="isp-report-card-file">
            <span className="isp-report-ext" style={{ background: accent }}>.{file.fileType}</span>
            <div className="isp-report-info">
              <b title={file.fileName}>{file.fileName}</b>
              <span>{((file.fileSize || 0) / 1024).toFixed(1)} KB</span>
            </div>
          </div>
          <div className="isp-report-card-actions">
            <button onClick={onDownload} title={isRTL ? 'تحميل' : 'Download'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {isRTL ? 'تحميل' : 'Download'}
            </button>
            <button onClick={() => inputRef.current?.click()} title={isRTL ? 'استبدال' : 'Replace'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              {isRTL ? 'استبدال' : 'Replace'}
            </button>
            <button className="danger" onClick={onClear} title={isRTL ? 'حذف' : 'Delete'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </>
      ) : (
        <button className="isp-report-upload" onClick={() => inputRef.current?.click()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {isRTL ? 'اضغط لرفع الملف' : 'Click to upload'}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="*/*"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) { onUpload(e.target.files[0]); e.target.value = ''; } }}
      />
    </div>
  );
};

// ---------- Small subcomponent: file list section ----------
// Used by both registration-files and chat-screenshots sections.
const FileListSection = ({ files, onUpload, onDownload, onRemove, uploadLabel, uploadHint, accent = '#0ea5e9', isRTL }) => {
  const inputRef = useRef(null);
  return (
    <>
      <label className="isp-file-dropzone" style={{ '--fx-accent': accent }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="*/*"
          onChange={(e) => { onUpload(e.target.files); e.target.value = ''; }}
        />
        <span>{uploadLabel}</span>
        {uploadHint && <small>{uploadHint}</small>}
      </label>
      {files.length > 0 && (
        <div className="isp-file-list">
          {files.map((f, i) => {
            const ext = String(f.fileType || '').toLowerCase();
            const isImg = ['jpg','jpeg','png','gif','webp','bmp','svg','avif','heic'].includes(ext);
            const isPdf = ext === 'pdf';
            const icon = isImg ? '🖼️' : isPdf ? '📕' : '📄';
            return (
              <div key={i} className="isp-file-item" style={{ '--fx-accent': accent }}>
                <div className="isp-file-item-icon">{icon}</div>
                <div className="isp-file-item-body">
                  <b title={f.fileName}>{f.fileName}</b>
                  <span>{((f.fileSize || 0) / 1024).toFixed(1)} KB · .{ext}</span>
                </div>
                <div className="isp-file-item-actions">
                  <button onClick={() => onDownload(i, f.fileName)}>
                    ⬇ {isRTL ? 'تحميل' : 'Download'}
                  </button>
                  <button className="danger" onClick={() => onRemove(i)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default InstitutionSupportTab;
