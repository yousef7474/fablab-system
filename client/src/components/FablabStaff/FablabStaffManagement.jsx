import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import UnifiedAttendancePage from '../shared/UnifiedAttendancePage';

const EMPTY_STAFF = {
  name: '', nationalId: '', phone: '', email: '',
  position: '', nationalIdPhoto: ''
};

// Purple accent for FabLab staff — matches the ID card + attendance category
const PURPLE = '#7c3aed';
const PURPLE_DARK = '#5b21b6';
const PURPLE_GRADIENT = `linear-gradient(135deg, ${PURPLE} 0%, ${PURPLE_DARK} 100%)`;

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

  const handleSave = async () => {
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

  // ─── ID card print (72×102mm, 4 per A4, purple) ─────────────────
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

  const handlePrintBulk = async () => {
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

  const filteredStaff = staff; // server-side search already applied

  return (
    <>
      <div className="volunteers-content">
        <div className="volunteers-header">
          <h2>{isRTL ? 'موظفو فاب لاب' : 'FabLab Staff'}</h2>
          <div className="volunteers-actions">
            <button
              className="add-volunteer-btn"
              style={{ background: PURPLE_GRADIENT }}
              onClick={openAdd}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              {isRTL ? 'إضافة موظف' : 'Add Staff'}
            </button>
            {staff.length > 0 && (
              <button
                className="add-opportunity-btn"
                style={{ background: PURPLE }}
                onClick={handlePrintBulk}
                title={isRTL ? 'طباعة البطاقات (4 لكل A4)' : 'Print ID cards (4 per A4)'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                {selected.size > 0
                  ? (isRTL ? `طباعة ${selected.size} بطاقة` : `Print ${selected.size} card(s)`)
                  : (isRTL ? 'طباعة جميع البطاقات' : 'Print All Cards')}
              </button>
            )}
            <button
              className="add-opportunity-btn"
              style={{ background: '#0ea5e9' }}
              onClick={() => setAttendanceMode(true)}
              title={isRTL ? 'صفحة تسجيل الحضور بالماسح' : 'Open scanner attendance page'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
              {isRTL ? 'صفحة الحضور' : 'Attendance Page'}
            </button>
          </div>
        </div>

        {/* Search + Select-all bar */}
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
          padding: '12px 20px', background: 'white',
          border: '1px solid #e2e8f0', borderRadius: 12,
          margin: '0 0 16px'
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
              style={{ position: 'absolute', [isRTL ? 'right' : 'left']: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? 'بحث بالاسم أو رقم الهوية أو المسمى الوظيفي' : 'Search by name / national ID / position'}
              style={{
                width: '100%',
                padding: isRTL ? '10px 40px 10px 12px' : '10px 12px 10px 40px',
                border: '1.5px solid #e2e8f0', borderRadius: 10,
                fontFamily: 'inherit', fontSize: 14
              }}
            />
          </div>
          {staff.length > 0 && (
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', background: selected.size === staff.length ? '#ede9fe' : '#f8fafc',
              border: `1.5px solid ${selected.size === staff.length ? PURPLE : '#e2e8f0'}`,
              borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: selected.size === staff.length ? PURPLE_DARK : '#475569'
            }}>
              <input
                type="checkbox"
                checked={selected.size === staff.length && staff.length > 0}
                onChange={toggleAll}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              {isRTL ? 'تحديد الكل' : 'Select all'}
              {selected.size > 0 && (
                <span style={{ background: PURPLE, color: 'white', padding: '1px 8px', borderRadius: 999, fontSize: 12 }}>
                  {selected.size}
                </span>
              )}
            </label>
          )}
        </div>

        <div className="volunteers-grid">
          {loading ? (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#64748b' }}>
              {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#64748b' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: 12 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <p style={{ marginBottom: 4, fontWeight: 600, color: '#334155' }}>
                {isRTL ? 'لا يوجد موظفين بعد' : 'No staff yet'}
              </p>
              <p style={{ fontSize: 13 }}>
                {isRTL ? 'أضف أول موظف من زر "إضافة موظف" أعلاه' : 'Add the first staff member with "Add Staff" above'}
              </p>
            </div>
          ) : (
            filteredStaff.map(row => {
              const isSelected = selected.has(row.staffId);
              return (
                <div
                  key={row.staffId}
                  className="volunteer-card"
                  style={{
                    border: isSelected ? `2px solid ${PURPLE}` : undefined,
                    boxShadow: isSelected ? `0 0 0 3px rgba(124, 58, 237, 0.14)` : undefined
                  }}
                >
                  {/* Select checkbox in top corner */}
                  <div style={{
                    position: 'absolute', top: 12, [isRTL ? 'left' : 'right']: 12,
                    zIndex: 2
                  }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(row.staffId)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: PURPLE }}
                      title={isRTL ? 'اختيار' : 'Select'}
                    />
                  </div>

                  <div className="volunteer-header">
                    <div
                      className="volunteer-avatar"
                      style={{ background: PURPLE_GRADIENT, color: 'white' }}
                    >
                      {row.nationalIdPhoto ? (
                        <img
                          src={row.nationalIdPhoto}
                          alt={row.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                        />
                      ) : (
                        row.name?.charAt(0)?.toUpperCase() || 'S'
                      )}
                    </div>
                    <div className="volunteer-info">
                      <h3>{row.name}</h3>
                      <p style={{ color: PURPLE_DARK, fontWeight: 600 }}>
                        {row.position || (isRTL ? 'موظف فاب لاب' : 'FabLab Staff')}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    padding: '10px 14px', background: '#faf5ff',
                    border: '1px solid #ede9fe', borderRadius: 10,
                    margin: '12px 0', fontSize: 13, color: '#334155',
                    display: 'flex', flexDirection: 'column', gap: 6
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>{isRTL ? 'رقم الهوية' : 'National ID'}</span>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{row.nationalId || '—'}</span>
                    </div>
                    {row.phone && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>{isRTL ? 'الهاتف' : 'Phone'}</span>
                        <span dir="ltr" style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{row.phone}</span>
                      </div>
                    )}
                    {row.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>{isRTL ? 'البريد' : 'Email'}</span>
                        <span dir="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{row.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="volunteer-card-actions">
                    <button
                      className="export-volunteer-btn"
                      onClick={() => handlePrintOne(row)}
                      title={isRTL ? 'طباعة البطاقة' : 'Print ID card'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      {isRTL ? 'بطاقة' : 'Card'}
                    </button>
                    <button
                      className="rate-volunteer-btn"
                      onClick={() => openEdit(row)}
                      title={isRTL ? 'تعديل البيانات' : 'Edit info'}
                      style={{ background: '#eef2ff', color: '#4338ca' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                      </svg>
                      {isRTL ? 'تعديل' : 'Edit'}
                    </button>
                    <button
                      className="delete-volunteer-btn"
                      onClick={() => handleDelete(row)}
                      title={isRTL ? 'حذف الموظف' : 'Delete staff'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                      {isRTL ? 'حذف' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <motion.div
            className="modal-content modern-modal volunteer-modal"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="modern-modal-header" style={{ background: PURPLE_GRADIENT }}>
              <div className="modal-header-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="modal-header-text">
                <h2>
                  {editingId
                    ? (isRTL ? 'تعديل بيانات موظف' : 'Edit Staff')
                    : (isRTL ? 'موظف جديد' : 'New Staff')}
                </h2>
                <p>
                  {editingId
                    ? (isRTL ? 'تحديث معلومات الموظف وصورة الهوية' : 'Update staff info and ID photo')
                    : (isRTL ? 'تسجيل موظف جديد في النظام' : 'Register a new staff member')}
                </p>
              </div>
              <button className="modal-close-modern" onClick={closeModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="modern-modal-body">
              <div className="form-section">
                <div className="section-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <span>{isRTL ? 'المعلومات الشخصية' : 'Personal Information'}</span>
                </div>

                <div className="form-group modern-input">
                  <label>
                    {isRTL ? 'الاسم' : 'Name'} <span className="required">*</span>
                  </label>
                  <div className="input-with-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
                      className="modern-input-field"
                    />
                  </div>
                </div>

                <div className="form-group modern-input">
                  <label>
                    {isRTL ? 'رقم الهوية' : 'National ID'} <span className="required">*</span>
                  </label>
                  <div className="input-with-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="16" rx="2"/>
                      <line x1="7" y1="8" x2="17" y2="8"/>
                      <line x1="7" y1="12" x2="13" y2="12"/>
                    </svg>
                    <input
                      type="text"
                      value={form.nationalId}
                      onChange={(e) => setForm(prev => ({ ...prev, nationalId: e.target.value }))}
                      placeholder={isRTL ? 'رقم الهوية الوطنية' : 'National ID number'}
                      className="modern-input-field"
                    />
                  </div>
                </div>

                <div className="form-group modern-input">
                  <label>{isRTL ? 'المسمى الوظيفي' : 'Position'}</label>
                  <div className="input-with-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    <input
                      type="text"
                      value={form.position}
                      onChange={(e) => setForm(prev => ({ ...prev, position: e.target.value }))}
                      placeholder={isRTL ? 'مثال: مدرب، مدير، فني' : 'e.g. Trainer, Manager, Technician'}
                      className="modern-input-field"
                    />
                  </div>
                </div>

                <div className="form-group modern-input">
                  <label>{isRTL ? 'رقم الجوال' : 'Phone'}</label>
                  <div className="input-with-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="05xxxxxxxx"
                      className="modern-input-field"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="form-group modern-input">
                  <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                  <div className="input-with-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                      className="modern-input-field"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="section-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>{isRTL ? 'صورة الهوية' : 'ID Photo'}</span>
                </div>
                <div className="photo-upload-area modern-upload">
                  {form.nationalIdPhoto ? (
                    <div className="photo-preview">
                      <img src={form.nationalIdPhoto} alt="ID" />
                      <button
                        className="remove-photo-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm(prev => ({ ...prev, nationalIdPhoto: '' }));
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label className="photo-upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        style={{ display: 'none' }}
                      />
                      <div className="upload-content">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="upload-text">
                          {isRTL ? 'انقر لرفع صورة الهوية' : 'Click to upload ID photo'}
                        </span>
                        <span className="upload-hint">
                          {isRTL ? 'PNG, JPG حتى 5MB' : 'PNG, JPG up to 5MB'}
                        </span>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="modern-modal-footer">
              <button className="btn-cancel" onClick={closeModal}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="btn-submit volunteer-submit"
                style={{ background: PURPLE_GRADIENT }}
                onClick={handleSave}
                disabled={saving || !form.name || !form.nationalId}
              >
                {saving ? (
                  <>
                    <span className="spinner"></span>
                    {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {editingId
                      ? (isRTL ? 'حفظ التعديلات' : 'Save Changes')
                      : (isRTL ? 'إضافة موظف' : 'Add Staff')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <UnifiedAttendancePage
        open={attendanceMode}
        onClose={() => setAttendanceMode(false)}
        isRTL={isRTL}
      />
    </>
  );
};

export default FablabStaffManagement;
