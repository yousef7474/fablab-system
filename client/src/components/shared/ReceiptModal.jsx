import React, { useState, useEffect } from 'react';

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

const ReceiptModal = ({ open, onClose, recipient }) => {
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

  const handlePrint = () => {
    if (!form.recipientName.trim() || !form.amount.trim()) {
      alert('يرجى تعبئة اسم المستلم والمبلغ');
      return;
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

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سند استلام</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; }

  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  /* Page 1 — the official letterhead with the form values overlaid */
  .page.receipt {
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .field {
    position: absolute;
    font-size: 14pt;
    font-weight: 600;
    color: #111;
    line-height: 1.4;
    white-space: nowrap;
  }
  /* Coordinates expressed as % of the A4 page so the layout survives
     print-scale changes. Tune these if a value lands off the line. */
  .field.recipient   { top: 28.5%; right: 38%; }
  .field.nationalId  { top: 33.2%; right: 38%; }
  .field.amount      { top: 38.0%; right: 38%; }
  .field.purpose     { top: 42.8%; right: 38%; max-width: 50%; white-space: normal; }
  .field.date        { top: 47.6%; right: 38%; direction: ltr; }
  .field.phone       { top: 52.3%; right: 38%; direction: ltr; }

  /* Page 2 — the National ID photo on its own page */
  .page.idphoto {
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 20mm;
  }
  .page.idphoto h2 {
    font-size: 22pt;
    margin: 0 0 12mm 0;
    color: #111;
  }
  .page.idphoto .photo-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .page.idphoto img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    box-shadow: 0 2px 18px rgba(0,0,0,0.18);
    border-radius: 6px;
  }
  .page.idphoto .nophoto {
    color: #888;
    font-size: 14pt;
    border: 2px dashed #d4d4d8;
    padding: 30mm;
    border-radius: 12px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="page receipt">
    <div class="field recipient">${safe(form.recipientName)}</div>
    <div class="field nationalId">${safe(form.nationalId)}</div>
    <div class="field amount">${safe(form.amount)}</div>
    <div class="field purpose">${safe(form.purpose)}</div>
    <div class="field date">${dateStr}</div>
    <div class="field phone">${safe(form.recipientPhone)}</div>
  </div>
  <div class="page idphoto">
    <h2>صورة الهوية</h2>
    <div class="photo-wrap">
      ${photo
        ? `<img src="${photo}" alt="National ID" />`
        : '<div class="nophoto">لا توجد صورة هوية محفوظة لهذا الشخص</div>'}
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
