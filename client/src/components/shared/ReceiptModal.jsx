import React, { useState, useEffect } from 'react';
import api from '../../config/api';

// Receipt voucher (سند استلام) modal.
//
// Used by both VolunteerManagement and WorkerManagement: when the admin
// clicks "سند استلام" on a person, this modal collects the 6 fields,
// pre-fills name/ID/phone from the record, then opens a print window
// with the official letterhead (receipt-bg.png) as the page-1 background
// with the values overlaid in their slots, and the recipient's National
// ID photo as page 2. The user prints to PDF from the browser.
//
// Positions of the value overlays are stored as percentages of the page
// so the layout survives a print-scale resize. If a value lands in the
// wrong spot just tweak the corresponding `top: 'XX%'` below.

// `personType` ('volunteer' | 'worker') decides which archive endpoint
// receives the receipt snapshot on print, so the same person's receipts
// can be listed back later from the detail view.
const ReceiptModal = ({ open, onClose, recipient, personType = 'volunteer', onSaved }) => {
  const [form, setForm] = useState({
    recipientName: '',
    nationalId: '',
    amount: '',
    purpose: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    recipientPhone: ''
  });

  // Pre-fill from the record whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setForm({
      recipientName: recipient?.name || '',
      nationalId: recipient?.nationalId || '',
      amount: '',
      purpose: '',
      receiptDate: new Date().toISOString().slice(0, 10),
      recipientPhone: recipient?.phone || ''
    });
  }, [open, recipient]);

  if (!open) return null;

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handlePrint = async () => {
    if (!form.recipientName.trim() || !form.amount.trim()) {
      alert('يرجى تعبئة اسم المستلم والمبلغ');
      return;
    }

    // Archive the receipt snapshot under the person before printing.
    // The print itself doesn't depend on the network call succeeding, so
    // we just surface a non-blocking message if the save fails.
    const personId = recipient?.volunteerId || recipient?.workerId;
    if (personId) {
      try {
        await api.post(`/${personType === 'worker' ? 'workers' : 'volunteers'}/${personId}/receipts`, {
          recipientName: form.recipientName,
          nationalId: form.nationalId,
          amount: form.amount,
          purpose: form.purpose,
          receiptDate: form.receiptDate,
          recipientPhone: form.recipientPhone
        });
        if (typeof onSaved === 'function') onSaved();
      } catch (err) {
        console.warn('Failed to archive receipt (printing anyway):', err);
      }
    }

    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة السند');
      return;
    }
    const photo = recipient?.nationalIdPhoto || '';
    const safe = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dateStr = (() => {
      try {
        const d = new Date(form.receiptDate);
        if (isNaN(d.getTime())) return safe(form.receiptDate);
        return d.toLocaleDateString('ar-SA-u-nu-latn');
      } catch { return safe(form.receiptDate); }
    })();

    // Page 1 layout: the PNG carries only the official letterhead frame
    // (logo/header/footer decoration) — the docx had the labels and the
    // signature block as real text, so we re-render that structured
    // content on top of the background image. Layout is a 2-column
    // label/value table for the 6 fields, then a notes box, then a
    // 3-column signature row at the bottom matching the template.
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سند استلام</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; }

  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  /* Page 1 — letterhead background; structured content sits in the
     middle band so it doesn't overlap the printed header/footer. */
  .page.receipt {
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .receipt-content {
    position: absolute;
    top: 18%;
    bottom: 12%;
    left: 14mm;
    right: 14mm;
    display: flex;
    flex-direction: column;
  }
  .receipt-title {
    text-align: center;
    font-size: 26pt;
    font-weight: 800;
    letter-spacing: 4px;
    margin: 0 0 8mm 0;
    color: #0f172a;
  }
  .receipt-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6mm;
  }
  .receipt-table th, .receipt-table td {
    border: 1.5px solid #475569;
    padding: 3.5mm 4mm;
    font-size: 13pt;
    vertical-align: middle;
  }
  .receipt-table th {
    background: rgba(241, 245, 249, 0.85);
    width: 38%;
    font-weight: 700;
    text-align: right;
    color: #0f172a;
  }
  .receipt-table td {
    background: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    color: #111827;
  }
  .receipt-table td.amount-cell {
    font-size: 14pt;
    letter-spacing: 1px;
  }
  .signature-box {
    border: 1.5px solid #475569;
    padding: 4mm;
    margin-bottom: 6mm;
    background: rgba(255, 255, 255, 0.7);
  }
  .signature-box h4 {
    margin: 0 0 3mm 0;
    font-size: 13pt;
    color: #0f172a;
    font-weight: 700;
  }
  .signature-box .sig-row {
    display: flex;
    gap: 8mm;
    font-size: 12pt;
  }
  .signature-box .sig-row > div { flex: 1; }
  .signature-box .sig-line {
    border-bottom: 1px solid #1f2937;
    height: 7mm;
    margin-top: 2mm;
  }
  .notes-box {
    border: 1.5px solid #475569;
    padding: 4mm;
    margin-bottom: 8mm;
    background: rgba(255, 255, 255, 0.7);
    min-height: 22mm;
  }
  .notes-box h4 {
    margin: 0 0 3mm 0;
    font-size: 13pt;
    color: #0f172a;
    font-weight: 700;
  }
  .signers-row {
    margin-top: auto;
    display: flex;
    gap: 4mm;
    justify-content: space-between;
    padding-top: 4mm;
    border-top: 1.5px dashed #475569;
  }
  .signer {
    flex: 1;
    text-align: center;
    font-size: 11pt;
    display: flex;
    flex-direction: column;
  }
  .signer .signer-title {
    color: #475569;
    font-weight: 600;
    margin-bottom: 2mm;
  }
  /* Empty space the user can sign in by hand, then the printed name
     sits directly below the line. */
  .signer .signature-space {
    height: 18mm;
    border-bottom: 1.5px solid #1f2937;
    margin: 0 6mm 2mm 6mm;
  }
  .signer .signer-name {
    font-weight: 700;
    color: #0f172a;
    font-size: 12pt;
  }

  /* Page 2 — same letterhead background as page 1 for visual consistency. */
  .page.idphoto {
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .idphoto-content {
    position: absolute;
    top: 18%;
    bottom: 12%;
    left: 14mm;
    right: 14mm;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .idphoto-content h2 {
    font-size: 22pt;
    margin: 0 0 10mm 0;
    color: #0f172a;
    font-weight: 800;
    letter-spacing: 2px;
  }
  .idphoto-content .photo-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .idphoto-content img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    box-shadow: 0 2px 18px rgba(0,0,0,0.18);
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.9);
    padding: 6mm;
  }
  .idphoto-content .nophoto {
    color: #888;
    font-size: 14pt;
    border: 2px dashed #d4d4d8;
    padding: 30mm;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.85);
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="page receipt">
    <div class="receipt-content">
      <div class="receipt-title">سند استلام</div>

      <table class="receipt-table">
        <tr><th>المستلم</th><td>${safe(form.recipientName) || '&nbsp;'}</td></tr>
        <tr><th>رقم الهوية</th><td dir="ltr" style="text-align:right">${safe(form.nationalId) || '&nbsp;'}</td></tr>
        <tr><th>المبلغ</th><td class="amount-cell">${safe(form.amount) ? safe(form.amount) + ' ريال' : '&nbsp;'}</td></tr>
        <tr><th>وذلك عن</th><td>${safe(form.purpose) || '&nbsp;'}</td></tr>
        <tr><th>تاريخ الاستلام</th><td>${dateStr || '&nbsp;'}</td></tr>
        <tr><th>جوال المستلم</th><td dir="ltr" style="text-align:right">${safe(form.recipientPhone) || '&nbsp;'}</td></tr>
      </table>

      <div class="signature-box">
        <h4>التوقيع بالاستلام</h4>
        <div class="sig-row">
          <div>الاسم<div class="sig-line"></div></div>
          <div>التوقيع<div class="sig-line"></div></div>
        </div>
      </div>

      <div class="notes-box">
        <h4>ملاحظات</h4>
      </div>

      <div class="signers-row">
        <div class="signer">
          <div class="signer-title">المسؤول التنفيذي للفاب لاب</div>
          <div class="signature-space"></div>
          <div class="signer-name">أ. زكي اللويم</div>
        </div>
        <div class="signer">
          <div class="signer-title">الشؤون المالية والإدارية</div>
          <div class="signature-space"></div>
          <div class="signer-name">بيان سلطان السميح</div>
        </div>
        <div class="signer">
          <div class="signer-title">&nbsp;</div>
          <div class="signature-space"></div>
          <div class="signer-name">إبراهيم صالح الرميح</div>
        </div>
      </div>
    </div>
  </div>

  <div class="page idphoto">
    <div class="idphoto-content">
      <h2>صورة الهوية</h2>
      <div class="photo-wrap">
        ${photo
          ? `<img src="${photo}" alt="National ID" />`
          : '<div class="nophoto">لا توجد صورة هوية محفوظة لهذا الشخص</div>'}
      </div>
    </div>
  </div>
  <script>
    // Wait for the background image to load before printing so it
    // doesn't print blank on first paint.
    const bg = new Image();
    bg.src = '${window.location.origin}/receipt-bg.png';
    bg.onload = bg.onerror = () => { setTimeout(() => window.print(), 250); };
  </script>
</body>
</html>`;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, padding: '1.5rem',
          width: 'min(520px, 92vw)', maxHeight: '92vh', overflow: 'auto',
          fontFamily: 'inherit', direction: 'rtl', textAlign: 'right'
        }}
      >
        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>سند استلام</h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#64748b' }}>
          املأ البيانات ثم اطبع. الصفحة الثانية ستحوي صورة الهوية المحفوظة.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>المستلم *</label>
            <input
              value={form.recipientName}
              onChange={(e) => handleChange('recipientName', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>رقم الهوية</label>
            <input
              dir="ltr"
              value={form.nationalId}
              onChange={(e) => handleChange('nationalId', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>المبلغ (ريال) *</label>
            <input
              dir="ltr"
              value={form.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              placeholder="مثال: 500"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>تاريخ الاستلام</label>
            <input
              type="date"
              value={form.receiptDate}
              onChange={(e) => handleChange('receiptDate', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>وذلك عن</label>
            <input
              value={form.purpose}
              onChange={(e) => handleChange('purpose', e.target.value)}
              placeholder="سبب الصرف"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 4 }}>جوال المستلم</label>
            <input
              dir="ltr"
              value={form.recipientPhone}
              onChange={(e) => handleChange('recipientPhone', e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {!recipient?.nationalIdPhoto && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#b45309', background: '#fef3c7', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
            ⚠ لا توجد صورة هوية محفوظة لهذا الشخص. الصفحة الثانية ستكون فارغة.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.6rem 1.3rem', borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
          >
            إلغاء
          </button>
          <button
            onClick={handlePrint}
            style={{ padding: '0.6rem 1.3rem', borderRadius: 8, border: 'none', background: '#a78bfa', color: 'white', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
          >
            طباعة / تحميل PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
