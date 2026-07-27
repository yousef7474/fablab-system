import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Volunteer contract ("عقد تطوع") printer. Mirrors the receipt/سند
// template — same receipt-bg.png letterhead, same signature block —
// but themed in red instead of the receipt's slate/blue palette and
// prints a full contract body (personal info, opportunity details,
// per-day cost, transferability note, terms & obligations) instead
// of a receipt line-item.
const DEFAULT_COST_PER_DAY = 50;

const DEFAULT_TRANSFER_NOTE_AR =
  'يحق لإدارة فاب لاب نقل المتطوع من مكان إلى آخر، ومن طبيعة عمل إلى أخرى، حسب حاجة العمل ومتطلبات الفعاليات.';

const DEFAULT_TERMS_AR = [
  'يلتزم المتطوع بالحضور في المواعيد المتفق عليها وعدم التغيب دون إذن مسبق.',
  'يلتزم المتطوع بالضبط والانضباط وحسن السلوك والتعامل باحترام مع الزملاء والمستفيدين.',
  'يلتزم المتطوع بتنفيذ المهام الموكلة إليه على أكمل وجه وبالجودة المطلوبة.',
  'يلتزم المتطوع بالحفاظ على ممتلكات فاب لاب والأجهزة والمعدات المستخدمة.',
  'يلتزم المتطوع بارتداء الزي المخصص واتباع الأنظمة الداخلية للمكان.',
  'يحق لإدارة فاب لاب إنهاء هذا العقد في أي وقت في حال الإخلال بأي من الشروط أعلاه.',
  'يقر المتطوع بأنه اطلع على جميع بنود هذا العقد ووافق عليها.'
];

const daysBetween = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1);
};

const fmtDate = (d) => {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn');
  } catch { return String(d); }
};

const VolunteerContractModal = ({ open, onClose, recipient }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const opportunities = useMemo(() => recipient?.opportunities || [], [recipient]);
  const [oppId, setOppId] = useState('');
  const [costPerDay, setCostPerDay] = useState(DEFAULT_COST_PER_DAY);
  const [transferNote, setTransferNote] = useState(DEFAULT_TRANSFER_NOTE_AR);
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!open) return;
    // Default to the most recent active opportunity, otherwise the first.
    const active = opportunities.find(o => o.status === 'active');
    setOppId((active || opportunities[0])?.opportunityId || '');
    setCostPerDay(DEFAULT_COST_PER_DAY);
    setTransferNote(DEFAULT_TRANSFER_NOTE_AR);
    setLocation('');
  }, [open, opportunities]);

  if (!open) return null;

  const opp = opportunities.find(o => o.opportunityId === oppId) || null;
  const totalDays = daysBetween(opp?.startDate, opp?.endDate);
  const totalCost = totalDays * Number(costPerDay || 0);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة العقد');
      return;
    }
    const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
    const contractDate = new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn');
    const termsHtml = DEFAULT_TERMS_AR
      .map((t, i) => `<li><span class="term-idx">${i + 1}.</span> ${safe(t)}</li>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>عقد تطوع</title>
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

  .page.contract {
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .contract-content {
    position: absolute;
    top: 16%;
    bottom: 11%;
    left: 14mm;
    right: 14mm;
    display: flex;
    flex-direction: column;
  }
  .contract-title {
    text-align: center;
    font-size: 24pt;
    font-weight: 800;
    letter-spacing: 4px;
    margin: 0 0 2mm 0;
    color: #991b1b;
  }
  .contract-subtitle {
    text-align: center;
    font-size: 11pt;
    color: #7f1d1d;
    margin-bottom: 6mm;
    font-weight: 600;
  }
  .contract-meta {
    text-align: center;
    font-size: 10.5pt;
    color: #64748b;
    margin-bottom: 4mm;
  }
  .contract-meta strong { color: #991b1b; }

  .section-heading {
    background: linear-gradient(90deg, #991b1b 0%, #dc2626 100%);
    color: #ffffff;
    padding: 2mm 4mm;
    font-size: 12pt;
    font-weight: 800;
    border-radius: 2mm 2mm 0 0;
    margin-top: 3mm;
    letter-spacing: 1px;
  }

  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1mm;
  }
  .info-table th, .info-table td {
    border: 1.2px solid #b91c1c;
    padding: 1.8mm 3mm;
    font-size: 10.5pt;
    vertical-align: middle;
  }
  .info-table th {
    background: rgba(254, 226, 226, 0.75);
    width: 30%;
    font-weight: 700;
    text-align: right;
    color: #7f1d1d;
  }
  .info-table td {
    background: rgba(255, 255, 255, 0.75);
    font-weight: 600;
    color: #111827;
  }
  .info-table td.strong {
    color: #991b1b;
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .terms-box {
    border: 1.2px solid #b91c1c;
    border-top: none;
    padding: 3mm 4mm 3mm 4mm;
    background: rgba(255, 255, 255, 0.75);
  }
  .terms-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .terms-list li {
    font-size: 10pt;
    line-height: 1.55;
    color: #1f2937;
    padding: 1.2mm 0;
    border-bottom: 1px dashed rgba(185, 28, 28, 0.25);
  }
  .terms-list li:last-child { border-bottom: none; }
  .terms-list .term-idx {
    color: #991b1b;
    font-weight: 800;
    margin-left: 2mm;
  }

  .note-box {
    border: 1.2px solid #b91c1c;
    background: rgba(254, 226, 226, 0.55);
    padding: 3mm 4mm;
    margin-top: 3mm;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #7f1d1d;
    font-weight: 600;
    border-radius: 2mm;
  }
  .note-box .note-label {
    display: block;
    font-size: 10pt;
    font-weight: 800;
    color: #991b1b;
    margin-bottom: 1.5mm;
    letter-spacing: 1px;
  }

  .signers-row {
    margin-top: auto;
    display: flex;
    gap: 6mm;
    justify-content: space-between;
    padding-top: 4mm;
    border-top: 1.5px dashed #b91c1c;
  }
  .signer {
    flex: 1;
    text-align: center;
    font-size: 10.5pt;
    display: flex;
    flex-direction: column;
  }
  .signer .signer-title {
    color: #7f1d1d;
    font-weight: 700;
    margin-bottom: 2mm;
  }
  .signer .signature-space {
    height: 14mm;
    border-bottom: 1.5px solid #7f1d1d;
    margin: 0 6mm 2mm 6mm;
  }
  .signer .signer-name {
    font-weight: 700;
    color: #991b1b;
    font-size: 11pt;
  }
  .signer .signer-sub {
    color: #64748b;
    font-size: 9.5pt;
    margin-top: 1mm;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="page contract">
    <div class="contract-content">
      <div class="contract-title">عقد تطوع</div>
      <div class="contract-subtitle">اتفاقية تنظيم عمل تطوعي مع فاب لاب</div>
      <div class="contract-meta">
        حرر هذا العقد بتاريخ <strong>${safe(contractDate)}</strong> بين
        <strong>فاب لاب</strong> (الطرف الأول) و
        <strong>${safe(recipient?.name || '')}</strong> (الطرف الثاني — المتطوع).
      </div>

      <div class="section-heading">البيانات الشخصية للمتطوع</div>
      <table class="info-table">
        <tr>
          <th>الاسم الكامل</th><td>${safe(recipient?.name) || '&nbsp;'}</td>
          <th>رقم الهوية</th><td dir="ltr" style="text-align:right">${safe(recipient?.nationalId) || '&nbsp;'}</td>
        </tr>
        <tr>
          <th>الجوال</th><td dir="ltr" style="text-align:right">${safe(recipient?.phone) || '&nbsp;'}</td>
          <th>البريد الإلكتروني</th><td dir="ltr" style="text-align:right">${safe(recipient?.email) || '&nbsp;'}</td>
        </tr>
      </table>

      <div class="section-heading">تفاصيل التطوع</div>
      <table class="info-table">
        <tr>
          <th>نوع/عنوان التطوع</th><td colspan="3">${safe(opp?.title) || '&nbsp;'}</td>
        </tr>
        <tr>
          <th>وصف المهام</th><td colspan="3">${safe(opp?.description) || '—'}</td>
        </tr>
        <tr>
          <th>مكان التطوع</th><td colspan="3">${safe(location) || 'فاب لاب — حسب توجيه الإدارة'}</td>
        </tr>
        <tr>
          <th>تاريخ البداية</th><td>${safe(fmtDate(opp?.startDate)) || '&nbsp;'}</td>
          <th>تاريخ النهاية</th><td>${safe(fmtDate(opp?.endDate)) || '&nbsp;'}</td>
        </tr>
        <tr>
          <th>عدد أيام التطوع</th><td>${totalDays ? totalDays + ' يوم' : '—'}</td>
          <th>ساعات العمل اليومية</th><td>${opp?.dailyHours ? opp.dailyHours + ' ساعة' : '—'}</td>
        </tr>
        <tr>
          <th>التكلفة اليومية</th><td class="strong">${Number(costPerDay) || 0} ريال / يوم</td>
          <th>إجمالي التكلفة</th><td class="strong">${totalCost ? totalCost + ' ريال' : '—'}</td>
        </tr>
      </table>

      <div class="note-box">
        <span class="note-label">ملاحظة هامة</span>
        ${safe(transferNote)}
      </div>

      <div class="section-heading">الشروط والالتزامات</div>
      <div class="terms-box">
        <ol class="terms-list">${termsHtml}</ol>
      </div>

      <div class="signers-row">
        <div class="signer">
          <div class="signer-title">الطرف الثاني — المتطوع</div>
          <div class="signature-space"></div>
          <div class="signer-name">${safe(recipient?.name || '')}</div>
          <div class="signer-sub">التوقيع</div>
        </div>
        <div class="signer">
          <div class="signer-title">الطرف الأول — إدارة فاب لاب</div>
          <div class="signature-space"></div>
          <div class="signer-name">أ. زكي اللويم</div>
          <div class="signer-sub">المسؤول التنفيذي</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const bg = new Image();
    bg.src = '${window.location.origin}/receipt-bg.png';
    bg.onload = bg.onerror = () => { setTimeout(() => window.print(), 250); };
  </script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modern-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620 }}
      >
        <div className="modal-header" style={{ borderBottom: '2px solid #b91c1c' }}>
          <h2 style={{ color: '#991b1b', margin: 0 }}>
            {isRTL ? 'طباعة عقد تطوع' : 'Print Volunteer Contract'}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '18px 22px' }}>
          <div style={{ marginBottom: 14, color: '#475569', fontSize: 13.5 }}>
            {isRTL
              ? `المتطوع: ${recipient?.name || ''} — هذه البيانات ستظهر في العقد المطبوع.`
              : `Volunteer: ${recipient?.name || ''}`}
          </div>

          {opportunities.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: '#334155' }}>
                {isRTL ? 'اختر فرصة التطوع' : 'Select Opportunity'}
              </label>
              <select
                value={oppId}
                onChange={(e) => setOppId(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 6,
                  border: '1.5px solid #cbd5e1', fontSize: 14
                }}
              >
                {opportunities.map(o => (
                  <option key={o.opportunityId} value={o.opportunityId}>
                    {o.title} — {fmtDate(o.startDate)} → {fmtDate(o.endDate)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {opportunities.length === 0 && (
            <div style={{
              padding: 12, background: '#fef2f2', border: '1.5px solid #fecaca',
              borderRadius: 6, color: '#991b1b', marginBottom: 14, fontSize: 13
            }}>
              {isRTL
                ? 'لا توجد فرص تطوع مسجلة لهذا المتطوع. أضف فرصة أولاً قبل طباعة العقد.'
                : 'No opportunities recorded for this volunteer. Add one before printing.'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: '#334155' }}>
                {isRTL ? 'التكلفة اليومية (ريال)' : 'Cost / day (SAR)'}
              </label>
              <input
                type="number"
                min="0"
                value={costPerDay}
                onChange={(e) => setCostPerDay(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 6,
                  border: '1.5px solid #cbd5e1', fontSize: 14
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: '#334155' }}>
                {isRTL ? 'عدد الأيام' : 'Days'}
              </label>
              <input
                type="text"
                readOnly
                value={totalDays ? `${totalDays} يوم` : '—'}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 6,
                  border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 14, color: '#475569'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: '#334155' }}>
              {isRTL ? 'مكان التطوع (اختياري)' : 'Location (optional)'}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={isRTL ? 'مثال: مقر فاب لاب — الرياض' : 'e.g. FabLab HQ'}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 6,
                border: '1.5px solid #cbd5e1', fontSize: 14
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: '#334155' }}>
              {isRTL ? 'ملاحظة التنقل بين المهام والمواقع' : 'Transfer note'}
            </label>
            <textarea
              rows={3}
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 6,
                border: '1.5px solid #cbd5e1', fontSize: 13.5, resize: 'vertical', fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{
            background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 6,
            padding: '10px 14px', fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.6
          }}>
            <strong>{isRTL ? 'الإجمالي المتوقع:' : 'Estimated total:'}</strong>{' '}
            {totalCost ? `${totalCost} ريال` : '—'}
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 6, border: '1.5px solid #cbd5e1',
              background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handlePrint}
            disabled={!opp}
            style={{
              padding: '9px 20px', borderRadius: 6, border: 'none',
              background: opp ? 'linear-gradient(90deg, #991b1b, #dc2626)' : '#cbd5e1',
              color: '#fff', fontWeight: 800, cursor: opp ? 'pointer' : 'not-allowed',
              letterSpacing: 0.5
            }}
          >
            {isRTL ? 'طباعة العقد' : 'Print Contract'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VolunteerContractModal;
