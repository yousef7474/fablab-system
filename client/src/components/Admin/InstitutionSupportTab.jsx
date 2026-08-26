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

  // ---------- Student names editor ----------
  const [studentInput, setStudentInput] = useState('');
  const addStudent = () => {
    const name = studentInput.trim();
    if (!name) return;
    setSelected(s => ({ ...s, studentNames: [...(s.studentNames || []), name] }));
    setStudentInput('');
  };
  const removeStudent = (i) => setSelected(s => ({
    ...s,
    studentNames: (s.studentNames || []).filter((_, idx) => idx !== i)
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
                <div>
                  <div className="isp-modal-kicker">
                    {modal === 'create'
                      ? (isRTL ? 'مشروع جديد' : 'New project')
                      : (isRTL ? 'تفاصيل المشروع' : 'Project details')}
                  </div>
                  <h3>{selected.projectName || (isRTL ? '(بدون اسم)' : '(untitled)')}</h3>
                  {selected.projectNumber != null && (
                    <div className="isp-modal-no">{fmtProjectNo(selected.projectNumber)}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {modal === 'edit' && (
                    <button className="isp-btn isp-btn--print" onClick={openPrint}>
                      🖨️ {isRTL ? 'طباعة كاملة' : 'Print full'}
                    </button>
                  )}
                  <button className="isp-modal-close" onClick={close}>✕</button>
                </div>
              </div>

              {detailLoading ? (
                <div className="isp-modal-body">
                  <div className="isp-empty">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
                </div>
              ) : (
                <div className="isp-modal-body">
                  {/* -------- Meta -------- */}
                  <section className="isp-section">
                    <h4>📋 {isRTL ? 'معلومات المشروع' : 'Project info'}</h4>
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

                    <label style={{ marginTop: 10, display: 'block' }}>
                      <span>{isRTL ? 'الطلاب / الطالبات' : 'Students'}</span>
                      <div className="isp-chip-input">
                        <input
                          type="text"
                          value={studentInput}
                          onChange={e => setStudentInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStudent(); } }}
                          placeholder={isRTL ? 'اكتب اسماً واضغط Enter' : 'Type a name and press Enter'}
                        />
                        <button type="button" onClick={addStudent}>+ {isRTL ? 'إضافة' : 'Add'}</button>
                      </div>
                      <div className="isp-chips">
                        {(selected.studentNames || []).map((n, i) => (
                          <span key={i} className="isp-chip">
                            {n}
                            <button type="button" onClick={() => removeStudent(i)}>✕</button>
                          </span>
                        ))}
                      </div>
                    </label>

                    <label style={{ marginTop: 10, display: 'block' }}>
                      <span>{isRTL ? 'تقييم المشروع (نسبة الدعم / كمية الدعم / ملاحظات)' : 'Evaluation (support % / amount / notes)'}</span>
                      <textarea rows={3} value={selected.evaluation || ''} onChange={e => patch('evaluation', e.target.value)} />
                    </label>

                    <label style={{ marginTop: 10, display: 'block' }}>
                      <span>{isRTL ? 'ملاحظات إضافية' : 'Additional notes'}</span>
                      <textarea rows={2} value={selected.notes || ''} onChange={e => patch('notes', e.target.value)} />
                    </label>

                    <div style={{ marginTop: 12, textAlign: 'end' }}>
                      <button className="isp-btn isp-btn--primary" onClick={saveMeta} disabled={saving}>
                        {saving ? '…' : (modal === 'create' ? (isRTL ? '💾 إنشاء' : '💾 Create') : (isRTL ? '💾 حفظ التعديلات' : '💾 Save changes'))}
                      </button>
                    </div>
                  </section>

                  {/* -------- Files (only after creation) -------- */}
                  {modal === 'edit' && (
                    <>
                      <section className="isp-section">
                        <h4>📄 {isRTL ? 'الملفات' : 'Documents'}</h4>
                        <ReportSlot
                          label={isRTL ? 'تقرير المشروع (عربي)' : 'Project report (Arabic)'}
                          file={selected.reportAr}
                          onUpload={(f) => uploadReport('ar', f)}
                          onClear={() => clearReport('ar')}
                          onDownload={() => downloadFile('report-ar', null, selected.reportAr?.fileName)}
                          isRTL={isRTL}
                        />
                        <ReportSlot
                          label={isRTL ? 'تقرير المشروع (إنجليزي)' : 'Project report (English)'}
                          file={selected.reportEn}
                          onUpload={(f) => uploadReport('en', f)}
                          onClear={() => clearReport('en')}
                          onDownload={() => downloadFile('report-en', null, selected.reportEn?.fileName)}
                          isRTL={isRTL}
                        />
                        <ReportSlot
                          label={isRTL ? 'ملف براءة الاختراع (إن وجد)' : 'Patent file (if any)'}
                          file={selected.patentFile}
                          onUpload={(f) => uploadReport('patent', f)}
                          onClear={() => clearReport('patent')}
                          onDownload={() => downloadFile('patent', null, selected.patentFile?.fileName)}
                          isRTL={isRTL}
                        />
                      </section>

                      {/* -------- Images -------- */}
                      <section className="isp-section">
                        <h4>
                          📸 {isRTL ? 'صور المشروع' : 'Project images'}
                          <span className="isp-hint">
                            {(selected.images?.length || 0)}/{MAX_IMAGES}
                          </span>
                        </h4>
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
                        <h4>🧾 {isRTL ? 'الفواتير والمصروفات' : 'Invoices & expenses'}</h4>
                        <div className="isp-invoice-add">
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

                      <div className="isp-modal-foot">
                        <button className="isp-btn isp-btn--danger" onClick={() => deleteProject(selected)}>
                          🗑️ {isRTL ? 'حذف المشروع' : 'Delete project'}
                        </button>
                        <button className="isp-btn isp-btn--print" onClick={openPrint}>
                          🖨️ {isRTL ? 'طباعة تقرير كامل' : 'Print full report'}
                        </button>
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
const ReportSlot = ({ label, file, onUpload, onClear, onDownload, isRTL }) => {
  const inputRef = useRef(null);
  return (
    <div className="isp-report">
      <div className="isp-report-label">{label}</div>
      {file ? (
        <div className="isp-report-file">
          <span className="isp-report-ext">.{file.fileType}</span>
          <div className="isp-report-info">
            <b>{file.fileName}</b>
            <span>{((file.fileSize || 0) / 1024).toFixed(1)} KB</span>
          </div>
          <button onClick={onDownload}>⬇ {isRTL ? 'تحميل' : 'Download'}</button>
          <button onClick={() => inputRef.current?.click()}>🔄 {isRTL ? 'استبدال' : 'Replace'}</button>
          <button className="danger" onClick={onClear}>🗑</button>
        </div>
      ) : (
        <button className="isp-report-upload" onClick={() => inputRef.current?.click()}>
          + {isRTL ? 'رفع ملف' : 'Upload file'}
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

export default InstitutionSupportTab;
