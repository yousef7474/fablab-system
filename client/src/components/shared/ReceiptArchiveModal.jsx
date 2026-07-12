import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Lists every سند استلام previously saved for a given volunteer or
// worker. Admin can re-print any past receipt (the print window
// re-renders from the stored data) or delete it. Open it from the
// volunteer/worker card via the "السجل" button.
const ReceiptArchiveModal = ({ open, onClose, recipient, personType = 'volunteer' }) => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);

  const basePath = personType === 'worker' ? 'workers' : 'volunteers';
  const personId = recipient?.volunteerId || recipient?.workerId;

  const fetchReceipts = useCallback(async () => {
    if (!personId) return;
    setLoading(true);
    try {
      const res = await api.get(`/${basePath}/${personId}/receipts`);
      setReceipts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading receipts:', err);
      toast.error('خطأ في تحميل السجل');
    } finally {
      setLoading(false);
    }
  }, [basePath, personId]);

  useEffect(() => {
    if (open) fetchReceipts();
  }, [open, fetchReceipts]);

  const handleDelete = async (id) => {
    if (!window.confirm('حذف هذا السند نهائياً؟')) return;
    try {
      await api.delete(`/${basePath}/receipts/${id}`);
      setReceipts(prev => prev.filter(r => r.receiptId !== id));
      toast.success('تم الحذف');
    } catch (err) {
      console.error('Error deleting receipt:', err);
      toast.error('خطأ في الحذف');
    }
  };

  // Re-render a saved receipt in a new window. Same HTML/CSS as the
  // print-on-create flow lives in ReceiptModal; here we duplicate it
  // for the archive view so the visual stays identical.
  const handleReprint = (r) => {
    const photo = recipient?.nationalIdPhoto || '';
    const safe = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const dateStr = (() => {
      try {
        const d = new Date(r.receiptDate);
        if (isNaN(d.getTime())) return safe(r.receiptDate);
        return d.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn');
      } catch { return safe(r.receiptDate); }
    })();

    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) {
      alert('يرجى السماح بالنوافذ المنبثقة');
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سند استلام</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; }
  .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .page.receipt, .page.idphoto {
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%; background-repeat: no-repeat;
  }
  .receipt-content, .idphoto-content {
    position: absolute; top: 18%; bottom: 12%; left: 14mm; right: 14mm;
    display: flex; flex-direction: column;
  }
  .idphoto-content { align-items: center; }
  .receipt-title { text-align: center; font-size: 26pt; font-weight: 800; letter-spacing: 4px; margin: 0 0 8mm 0; color: #0f172a; }
  .receipt-table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  .receipt-table th, .receipt-table td { border: 1.5px solid #475569; padding: 2.6mm 4mm; font-size: 12.5pt; vertical-align: middle; }
  .receipt-table th { background: rgba(241, 245, 249, 0.85); width: 38%; font-weight: 700; text-align: right; color: #0f172a; }
  .receipt-table td { background: rgba(255, 255, 255, 0.7); font-weight: 600; color: #111827; }
  .signature-box, .notes-box { border: 1.5px solid #475569; padding: 3.5mm; margin-bottom: 4mm; background: rgba(255, 255, 255, 0.7); }
  .signature-box h4, .notes-box h4 { margin: 0 0 2.5mm 0; font-size: 13pt; color: #0f172a; font-weight: 700; }
  .signature-box .sig-row { display: flex; gap: 8mm; font-size: 12pt; }
  .signature-box .sig-row > div { flex: 1; }
  .signature-box .sig-line { border-bottom: 1px solid #1f2937; height: 5.5mm; margin-top: 1.5mm; }
  .notes-box { min-height: 12mm; margin-bottom: 5mm; }
  .signers-row { margin-top: auto; display: flex; gap: 4mm; justify-content: space-between; padding-top: 4mm; border-top: 1.5px dashed #475569; }
  .signer { flex: 1; text-align: center; font-size: 11pt; display: flex; flex-direction: column; }
  .signer .signer-title { color: #475569; font-weight: 600; margin-bottom: 2mm; }
  .signer .signature-space { height: 18mm; border-bottom: 1.5px solid #1f2937; margin: 0 6mm 2mm 6mm; }
  .signer .signer-name { font-weight: 700; color: #0f172a; font-size: 12pt; }
  .idphoto-content h2 { font-size: 22pt; margin: 0 0 10mm 0; color: #0f172a; font-weight: 800; letter-spacing: 2px; }
  .idphoto-content .photo-wrap { flex: 1; width: 100%; display: flex; align-items: center; justify-content: center; }
  .idphoto-content img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 2px 18px rgba(0,0,0,0.18); border-radius: 6px; background: rgba(255,255,255,0.9); padding: 6mm; }
  .idphoto-content .nophoto { color: #888; font-size: 14pt; border: 2px dashed #d4d4d8; padding: 30mm; border-radius: 12px; background: rgba(255,255,255,0.85); }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="page receipt">
    <div class="receipt-content">
      <div class="receipt-title">سند استلام</div>
      <table class="receipt-table">
        <tr><th>المستلم</th><td>${safe(r.recipientName) || '&nbsp;'}</td></tr>
        <tr><th>رقم الهوية</th><td dir="ltr" style="text-align:right">${safe(r.nationalId) || '&nbsp;'}</td></tr>
        <tr><th>المبلغ</th><td>${safe(r.amount) ? safe(r.amount) + ' ريال' : '&nbsp;'}</td></tr>
        <tr><th>وذلك عن</th><td>${safe(r.purpose) || '&nbsp;'}</td></tr>
        <tr><th>ملاحظة</th><td>${safe(r.note) || '&nbsp;'}</td></tr>
        <tr><th>تاريخ الاستلام</th><td>${dateStr || '&nbsp;'}</td></tr>
        <tr><th>جوال المستلم</th><td dir="ltr" style="text-align:right">${safe(r.recipientPhone) || '&nbsp;'}</td></tr>
      </table>
      <div class="signature-box"><h4>التوقيع بالاستلام</h4>
        <div class="sig-row"><div>الاسم<div class="sig-line"></div></div><div>التوقيع<div class="sig-line"></div></div></div>
      </div>
      <div class="notes-box"><h4>ملاحظات</h4></div>
      <div class="signers-row">
        <div class="signer"><div class="signer-title">المسؤول التنفيذي للفاب لاب</div><div class="signature-space"></div><div class="signer-name">أ. زكي اللويم</div></div>
        <div class="signer"><div class="signer-title">الشؤون المالية والإدارية</div><div class="signature-space"></div><div class="signer-name">بيان سلطان السميح</div></div>
        <div class="signer"><div class="signer-title">&nbsp;</div><div class="signature-space"></div><div class="signer-name">إبراهيم صالح الرميح</div></div>
      </div>
    </div>
  </div>
  <div class="page idphoto"><div class="idphoto-content">
    <h2>صورة الهوية</h2>
    <div class="photo-wrap">
      ${photo ? `<img src="${photo}" alt="National ID" />` : '<div class="nophoto">لا توجد صورة هوية محفوظة لهذا الشخص</div>'}
    </div>
  </div></div>
  <script>
    const bg = new Image();
    bg.src = '${window.location.origin}/receipt-bg.png';
    bg.onload = bg.onerror = () => { setTimeout(() => window.print(), 250); };
  </script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  };

  if (!open) return null;

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
          width: 'min(720px, 95vw)', maxHeight: '90vh', overflow: 'auto',
          fontFamily: 'inherit', direction: 'rtl', textAlign: 'right'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
            سجل سندات الاستلام — {recipient?.name || ''}
          </h3>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {receipts.length} {receipts.length === 1 ? 'سند' : 'سندات'}
          </span>
        </div>

        {loading ? (
          <p style={{ color: '#64748b' }}>جاري التحميل...</p>
        ) : receipts.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>لا توجد سندات محفوظة بعد. سيتم حفظ كل سند يتم طباعته هنا.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
            {receipts.map(r => (
              <div key={r.receiptId} style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', background: '#f8fafc',
                borderRadius: 10, border: '1px solid #e2e8f0'
              }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {r.recipientName} — {r.amount} ريال
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                    {String(r.receiptDate).slice(0, 10)}
                    {r.purpose ? ` • ${r.purpose}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => handleReprint(r)}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', background: '#a78bfa', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'inherit' }}
                >
                  طباعة
                </button>
                <button
                  onClick={() => handleDelete(r.receiptId)}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', background: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', fontFamily: 'inherit' }}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.6rem 1.3rem', borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptArchiveModal;
