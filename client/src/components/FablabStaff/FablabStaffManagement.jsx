import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import '../Mawhba/Mawhba.css';
import UnifiedAttendancePage from '../shared/UnifiedAttendancePage';

const EMPTY_STAFF = {
  name: '', nationalId: '', phone: '', email: '',
  position: '', nationalIdPhoto: ''
};

const FablabStaffManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_STAFF);
  const [saving, setSaving] = useState(false);

  const [attendanceMode, setAttendanceMode] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const { data } = await api.get(`/fablab-staff?${params.toString()}`);
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل قائمة الموظفين' : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [search, isRTL]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_STAFF);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingId(row.staffId);
    setForm({
      name: row.name || '', nationalId: row.nationalId || '',
      phone: row.phone || '', email: row.email || '',
      position: row.position || '', nationalIdPhoto: row.nationalIdPhoto || ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_STAFF);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'الصورة يجب أن تكون أقل من 5MB' : 'Image must be < 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(prev => ({ ...prev, nationalIdPhoto: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) { toast.error(isRTL ? 'الاسم مطلوب' : 'Name required'); return; }
    if (!form.nationalId.trim()) { toast.error(isRTL ? 'رقم الهوية مطلوب' : 'National ID required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/fablab-staff/${editingId}`, form);
        toast.success(isRTL ? 'تم تحديث بيانات الموظف' : 'Staff updated');
      } else {
        await api.post('/fablab-staff', form);
        toast.success(isRTL ? 'تمت إضافة الموظف' : 'Staff added');
      }
      closeModal();
      fetchStaff();
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 409) {
        toast.error(isRTL ? 'يوجد موظف بنفس رقم الهوية' : 'Staff with this national ID already exists');
      } else {
        toast.error(err?.response?.data?.message || (isRTL ? 'فشل الحفظ' : 'Save failed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(isRTL ? `حذف الموظف "${row.name}"؟` : `Delete "${row.name}"?`)) return;
    try {
      await api.delete(`/fablab-staff/${row.staffId}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      setSelected(prev => { const n = new Set(prev); n.delete(row.staffId); return n; });
      fetchStaff();
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    }
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === staff.length) setSelected(new Set());
    else setSelected(new Set(staff.map(s => s.staffId)));
  };

  // ─── ID card print ──────────────────────────────────────
  const buildStaffCardStyles = () => `
    @page { size: A4 portrait; margin: 10mm 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f1f5f9; }
    body { padding: 6mm 0; }
    .print-note {
      font-size: 12px; color: #475569; background: white;
      border: 1px dashed #cbd5e1; border-radius: 8px;
      padding: 8px 14px; margin: 0 auto 8mm; text-align: center; max-width: 120mm;
    }
    .page {
      display: grid; grid-template-columns: 72mm 72mm;
      grid-auto-rows: 102mm; column-gap: 6mm; row-gap: 6mm;
      justify-content: center; align-content: start; width: 100%;
    }
    .page + .page { page-break-before: always; }

    .id-card {
      width: 72mm; height: 102mm;
      background: linear-gradient(180deg, #ffffff 0%, #f5f3ff 100%);
      border: 0.45mm dashed #475569;
      overflow: hidden; position: relative;
      display: flex; flex-direction: column;
      color: #1a1a2e; box-sizing: border-box;
    }
    .card-header {
      background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
      padding: 2.5mm 3.5mm; text-align: center;
    }
    .card-title { color: white; font-size: 9pt; font-weight: 700; line-height: 1.15; }
    .card-subtitle { color: rgba(255,255,255,0.88); font-size: 6.5pt; margin-top: 0.6mm; }

    .card-body {
      flex: 1; padding: 2.5mm 3mm 0;
      display: flex; flex-direction: column; align-items: center; gap: 1.4mm;
    }
    .user-photo {
      width: 22mm; height: 26mm;
      background: linear-gradient(135deg, #ddd6fe, #c4b5fd);
      border-radius: 2mm; display: flex; align-items: center; justify-content: center;
      color: #5b21b6; font-weight: bold;
      border: 0.6mm solid #7c3aed;
      overflow: hidden; flex-shrink: 0;
    }
    .user-photo img { width: 100%; height: 100%; object-fit: cover; }
    .user-photo .initials { font-size: 18pt; font-weight: bold; color: #5b21b6; }

    .user-name {
      font-size: 10.5pt; font-weight: 800; color: #1a1a2e;
      text-align: center; line-height: 1.15; max-height: 10mm; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .user-type-badge {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #5b21b6);
      color: white; font-size: 7.5pt; padding: 0.6mm 3.5mm;
      border-radius: 999px; font-weight: 700;
    }

    .info-section { width: 100%; display: flex; flex-direction: column; gap: 0.6mm; margin-top: 1mm; }
    .info-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 7.2pt; padding: 0.6mm 0; border-bottom: 0.2mm dotted #d4d4d8;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: 700; color: #555; }
    .info-value {
      color: #1a1a2e; font-weight: 600; text-align: ${isRTL ? 'left' : 'right'};
      max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .card-qr { display: flex; align-items: center; justify-content: center; margin-top: 1mm; }
    .card-qr img { width: 26mm; height: 26mm; background: white; padding: 0.8mm; border-radius: 1mm; box-shadow: 0 0 0 0.3mm #7c3aed inset; }

    .card-footer {
      background: #ffffff; padding: 1.5mm 3mm;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 0.3mm solid #e0e0e0;
    }
    .card-footer .logo { height: 7mm; width: auto; flex-shrink: 0; }
    .card-footer .qr-label { font-size: 6pt; color: #7c3aed; font-weight: 700; }

    .decorative-stripe {
      position: absolute; top: 40%; ${isRTL ? 'right' : 'left'}: 0;
      width: 1mm; height: 25%;
      background: linear-gradient(to bottom, transparent, #7c3aed, transparent);
    }

    @media print {
      html, body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding: 0; }
      .print-note { display: none; }
      .id-card { box-shadow: none; break-inside: avoid; }
    }
  `;

  const buildStaffCardHTML = (row, qrDataUrl) => {
    const na = isRTL ? 'غير محدد' : 'N/A';
    const nm = row.name || (isRTL ? 'غير متوفر' : 'N/A');
    const qrImg = qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : '';
    return `
      <div class="id-card">
        <div class="card-header">
          <div class="card-title">${isRTL ? 'بطاقة موظف فاب لاب الأحساء' : 'FABLAB Al-Ahsa Staff Card'}</div>
          <div class="card-subtitle">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</div>
        </div>
        <div class="card-body">
          <div class="user-photo">
            ${row.nationalIdPhoto
              ? `<img src="${row.nationalIdPhoto}" alt="${nm}" />`
              : `<span class="initials">${nm.charAt(0).toUpperCase()}</span>`}
          </div>
          <div class="user-name">${nm}</div>
          <div class="user-type-badge">${row.position || (isRTL ? 'موظف' : 'Staff')}</div>
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">${isRTL ? 'رقم الهوية' : 'National ID'}</span>
              <span class="info-value">${row.nationalId || na}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isRTL ? 'الهاتف' : 'Phone'}</span>
              <span class="info-value">${row.phone || na}</span>
            </div>
          </div>
          <div class="card-qr">${qrImg}</div>
        </div>
        <div class="decorative-stripe"></div>
        <div class="card-footer">
          <img src="/found.png" alt="Foundation" class="logo">
          <span class="qr-label">${isRTL ? 'رمز الحضور' : 'Attendance QR'}</span>
          <img src="/fablab.png" alt="FABLAB" class="logo">
        </div>
      </div>
    `;
  };

  const openStaffPrintWindow = (cardsHtml) => {
    const w = window.open('', '_blank');
    if (!w) { toast.error(isRTL ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow popups'); return; }
    w.document.write(`<!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head><meta charset="UTF-8"><title>${isRTL ? 'بطاقات الموظفين' : 'Staff ID Cards'}</title>
      <style>${buildStaffCardStyles()}</style></head>
      <body>
        <div class="print-note">${isRTL ? 'حجم البطاقة 72×102 ملم — اقطع حسب الخط المتقطع' : 'Card size 72×102 mm — cut along the dashed line'}</div>
        ${cardsHtml}
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const chunkCards = (cards, size = 4) => {
    const pages = [];
    for (let i = 0; i < cards.length; i += size) pages.push(cards.slice(i, i + size));
    return pages;
  };

  const handlePrintOne = async (row) => {
    try {
      const { data } = await api.get(`/fablab-staff/${row.staffId}/card`);
      const html = `<div class="page">${buildStaffCardHTML(data.staff, data.qrDataUrl)}</div>`;
      openStaffPrintWindow(html);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الطباعة' : 'Print failed');
    }
  };

  const handlePrintSelected = async () => {
    const ids = selected.size > 0 ? [...selected] : staff.map(s => s.staffId);
    if (ids.length === 0) {
      toast.warning(isRTL ? 'لا يوجد موظفين' : 'No staff to print');
      return;
    }
    try {
      toast.info(isRTL ? 'جارٍ توليد البطاقات...' : 'Generating cards...');
      const { data } = await api.post('/fablab-staff/cards', { staffIds: ids });
      const cardHtmls = (data.cards || []).map(c => buildStaffCardHTML(c.staff, c.qrDataUrl));
      const pages = chunkCards(cardHtmls, 4)
        .map(p => `<div class="page">${p.join('')}</div>`)
        .join('');
      openStaffPrintWindow(pages);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الطباعة' : 'Print failed');
    }
  };

  return (
    <div className="mawhba-container" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mawhba-header">
        <h2>👥 {isRTL ? 'موظفو فاب لاب' : 'FabLab Staff'}</h2>
        <div className="mawhba-toolbar">
          <input
            className="mawhba-search"
            placeholder={isRTL ? 'بحث بالاسم أو رقم الهوية' : 'Search by name or ID'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="mawhba-btn mawhba-btn-primary" style={{ background: '#7c3aed' }} onClick={openAdd}>
            + {isRTL ? 'إضافة موظف' : 'Add Staff'}
          </button>
          <button
            className="mawhba-btn"
            style={{ background: '#7c3aed', color: 'white' }}
            onClick={handlePrintSelected}
            disabled={staff.length === 0}
            title={isRTL ? 'طباعة بطاقات (4 لكل A4)' : 'Print ID cards (4 per A4)'}
          >
            🖨 {selected.size > 0
              ? (isRTL ? `طباعة ${selected.size} بطاقة` : `Print ${selected.size} card(s)`)
              : (isRTL ? 'طباعة جميع البطاقات' : 'Print All Cards')}
          </button>
          <button
            className="mawhba-btn"
            style={{ background: '#0ea5e9', color: 'white' }}
            onClick={() => setAttendanceMode(true)}
          >
            📅 {isRTL ? 'صفحة الحضور' : 'Attendance Page'}
          </button>
        </div>
      </div>

      <div className="mawhba-table-wrap">
        {loading ? (
          <div className="mawhba-empty">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
        ) : staff.length === 0 ? (
          <div className="mawhba-empty">{isRTL ? 'لا يوجد موظفين — أضف الأول' : 'No staff yet — add one'}</div>
        ) : (
          <table className="mawhba-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === staff.length && staff.length > 0}
                    onChange={toggleAll}
                    title={isRTL ? 'تحديد الكل' : 'Select all'}
                  />
                </th>
                <th>{isRTL ? 'الاسم' : 'Name'}</th>
                <th>{isRTL ? 'المسمى الوظيفي' : 'Position'}</th>
                <th>{isRTL ? 'رقم الهوية' : 'National ID'}</th>
                <th>{isRTL ? 'الهاتف' : 'Phone'}</th>
                <th>{isRTL ? 'البريد' : 'Email'}</th>
                <th style={{ width: 220 }}>{isRTL ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(row => (
                <tr key={row.staffId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(row.staffId)}
                      onChange={() => toggleOne(row.staffId)}
                    />
                  </td>
                  <td>{row.name}</td>
                  <td style={{ color: '#7c3aed', fontWeight: 600 }}>{row.position || '—'}</td>
                  <td className="mono">{row.nationalId}</td>
                  <td className="mono">{row.phone || '—'}</td>
                  <td>{row.email || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="mawhba-btn-small mawhba-btn-card" onClick={() => handlePrintOne(row)} title={isRTL ? 'طباعة البطاقة' : 'Print card'}>🎫</button>
                      <button className="mawhba-btn-small" style={{ background: '#eef2ff', color: '#4338ca' }} onClick={() => openEdit(row)} title={isRTL ? 'تعديل' : 'Edit'}>✎</button>
                      <button className="mawhba-btn-small mawhba-btn-del" onClick={() => handleDelete(row)} title={isRTL ? 'حذف' : 'Delete'}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="mawhba-modal-overlay" onClick={closeModal}>
          <div className="mawhba-modal" onClick={(e) => e.stopPropagation()}>
            <h3>👥 {editingId ? (isRTL ? 'تعديل بيانات موظف' : 'Edit Staff') : (isRTL ? 'إضافة موظف' : 'Add Staff')}</h3>
            <form onSubmit={handleSave}>
              <div className="mawhba-form-grid">
                <label>
                  <span>{isRTL ? 'الاسم' : 'Name'} *</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </label>
                <label>
                  <span>{isRTL ? 'رقم الهوية' : 'National ID'} *</span>
                  <input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} required />
                </label>
                <label>
                  <span>{isRTL ? 'المسمى الوظيفي' : 'Position'}</span>
                  <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder={isRTL ? 'مثال: مدرب، مدير، فني' : 'e.g. Trainer, Manager, Technician'} />
                </label>
                <label>
                  <span>{isRTL ? 'الهاتف' : 'Phone'}</span>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span>{isRTL ? 'البريد الإلكتروني' : 'Email'}</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  <span>{isRTL ? 'صورة الهوية' : 'National ID photo'}</span>
                  {form.nationalIdPhoto ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <img src={form.nationalIdPhoto} alt="ID" style={{ height: 80, borderRadius: 6, border: '1px solid #ddd' }} />
                      <button type="button" onClick={() => setForm({ ...form, nationalIdPhoto: '' })}>× {isRTL ? 'إزالة' : 'Remove'}</button>
                    </div>
                  ) : (
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} />
                  )}
                </label>
              </div>
              <div className="mawhba-modal-actions">
                <button type="button" className="mawhba-btn-secondary" onClick={closeModal}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
                <button type="submit" className="mawhba-btn mawhba-btn-primary" style={{ background: '#7c3aed' }} disabled={saving}>
                  {saving ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...') : (editingId ? (isRTL ? 'حفظ التعديلات' : 'Save Changes') : (isRTL ? 'إضافة' : 'Add'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UnifiedAttendancePage
        open={attendanceMode}
        onClose={() => setAttendanceMode(false)}
        isRTL={isRTL}
      />
    </div>
  );
};

export default FablabStaffManagement;
