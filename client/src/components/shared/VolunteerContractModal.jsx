import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Volunteer contract ("عقد تطوع") printer. Prints on the same
// receipt-bg.png letterhead as the سند, with a rotated red rubber-stamp
// badge in the top corner so a printed contract is instantly
// distinguishable from a receipt at a glance. All contract fields are
// admin-entered from the modal (no opportunity dropdown) so the printed
// document reflects exactly what the admin fills in.
const DEFAULT_COST_PER_DAY = 50;
const DEFAULT_DAILY_HOURS = 8;

const DEFAULT_TRANSFER_NOTE_AR =
  'يحق لإدارة فاب لاب نقل المتطوع من مكان إلى آخر، ومن طبيعة عمل إلى أخرى، حسب حاجة العمل ومتطلبات الفعاليات.';

const DEFAULT_TERMS_AR = [
  'يلتزم المتطوع بالحضور في المواعيد المتفق عليها وعدم التغيب دون إذن مسبق.',
  'يلتزم المتطوع بالضبط والانضباط وحسن السلوك مع الزملاء والمستفيدين.',
  'يلتزم المتطوع بتنفيذ المهام الموكلة إليه على أكمل وجه وبالجودة المطلوبة.',
  'يلتزم المتطوع بالحفاظ على ممتلكات فاب لاب والأجهزة والمعدات المستخدمة.',
  'يلتزم المتطوع بارتداء الزي المخصص واتباع الأنظمة الداخلية للمكان.',
  'يلتزم المتطوع برفع صور وتوثيق أعماله (بحد أدنى 5 صور لكل فرصة) إلى مجلد Google Drive المخصص لفرصته التطوعية.',
  'يحق لإدارة فاب لاب إنهاء هذا العقد في حال الإخلال بأي من الشروط أعلاه.'
];

// Standalone, extra-emphasized clause printed as its own red-bordered
// block right above the signature row so it can't be missed.
const PHOTO_UPLOAD_CONSEQUENCE_AR =
  'في حال عدم الالتزام بالأنظمة والتعليمات، وعدم رفع الصور والوثائق المطلوبة إلى مجلد Google Drive المخصص للفرصة التطوعية (بحد أدنى 5 صور)، لن يستحق المتطوع أياً من حقوقه، سواء الشهادة أو المكافأة المالية أو أي دعم آخر من فاب لاب الأحساء.';

const daysBetween = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(0, Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1);
};

// Working days between two dates (inclusive) excluding Friday and
// Saturday, the standard weekend in Saudi Arabia. The cost of a
// volunteer is billed on working days only.
const workingDaysBetween = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay(); // 0=Sun ... 5=Fri, 6=Sat
    if (dow !== 5 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const fmtDate = (d) => {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn');
  } catch { return String(d); }
};

const emptyForm = (recipient) => ({
  name: recipient?.name || '',
  nationalId: recipient?.nationalId || '',
  phone: recipient?.phone || '',
  email: recipient?.email || '',
  title: '',
  description: '',
  location: '',
  startDate: '',
  endDate: '',
  dailyHours: DEFAULT_DAILY_HOURS,
  costPerDay: DEFAULT_COST_PER_DAY,
  transferNote: DEFAULT_TRANSFER_NOTE_AR
});

const VolunteerContractModal = ({ open, onClose, recipient }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [form, setForm] = useState(emptyForm(recipient));

  useEffect(() => {
    if (open) setForm(emptyForm(recipient));
  }, [open, recipient]);

  if (!open) return null;

  const totalDays = daysBetween(form.startDate, form.endDate);
  const workingDays = workingDaysBetween(form.startDate, form.endDate);
  const totalCost = workingDays * Number(form.costPerDay || 0);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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

    // Content region reserves 22% at the bottom so the signature block
    // always sits above the letterhead's footer decoration on
    // receipt-bg.png. Top starts at 17% to keep the header letterhead
    // strip visible and un-covered.
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
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .page:last-child { page-break-after: auto; }

  .contract-stamp {
    position: absolute;
    top: 22mm;
    left: 16mm;
    transform: rotate(-12deg);
    padding: 3mm 7mm;
    border: 3px double #b91c1c;
    color: #b91c1c;
    font-size: 14pt;
    font-weight: 900;
    letter-spacing: 4px;
    background: rgba(255, 255, 255, 0.35);
    border-radius: 3mm;
    text-shadow: 0 1px 0 rgba(185, 28, 28, 0.15);
    z-index: 5;
    text-align: center;
  }
  .contract-stamp .stamp-sub {
    display: block;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 2px;
    margin-top: 0.5mm;
    color: #7f1d1d;
  }

  .contract-content {
    position: absolute;
    top: 17%;
    /* Bottom safe zone widened (was 22%) so the signature panel below
       lands inside the letterhead's clean white band, not on top of
       the footer graphics on receipt-bg.png. */
    bottom: 26%;
    left: 14mm;
    right: 14mm;
    display: flex;
    flex-direction: column;
  }
  .contract-title {
    text-align: center;
    font-size: 22pt;
    font-weight: 800;
    letter-spacing: 4px;
    margin: 0 0 1.5mm 0;
    color: #0f172a;
  }
  .parties {
    text-align: center;
    font-size: 10pt;
    color: #334155;
    margin-bottom: 4mm;
    padding-bottom: 3mm;
    line-height: 1.5;
    /* Thick, solid red line under the parties statement — the visual
       marker separating the opening clause from the body of the
       contract. */
    border-bottom: 2.5mm solid #b91c1c;
  }
  .parties strong { color: #0f172a; }
  .parties .contract-date {
    display: inline-block;
    padding: 0.3mm 2mm;
    background: rgba(241, 245, 249, 0.75);
    border-radius: 2mm;
    font-weight: 700;
    color: #0f172a;
  }

  .section-heading {
    background: rgba(15, 23, 42, 0.06);
    color: #0f172a;
    padding: 1.4mm 4mm;
    font-size: 10.5pt;
    font-weight: 800;
    border-right: 4px solid #475569;
    margin-top: 2mm;
    letter-spacing: 1px;
  }
  .section-heading:first-of-type { margin-top: 0; }

  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
  }
  .info-table th, .info-table td {
    border: 1px solid #475569;
    padding: 1.3mm 3mm;
    font-size: 9.5pt;
    vertical-align: middle;
  }
  .info-table th {
    background: rgba(241, 245, 249, 0.8);
    width: 22%;
    font-weight: 700;
    text-align: right;
    color: #0f172a;
  }
  .info-table td {
    background: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    color: #111827;
  }
  .info-table td.strong {
    color: #0f172a;
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .info-table td .sub-note {
    display: block;
    font-size: 8pt;
    font-weight: 600;
    color: #b91c1c;
    margin-top: 0.5mm;
  }


  .terms-box {
    border: 1px solid #475569;
    border-top: none;
    padding: 1.5mm 4mm;
    background: rgba(255, 255, 255, 0.7);
  }
  .terms-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .terms-list li {
    font-size: 9pt;
    line-height: 1.4;
    color: #1f2937;
    padding: 0.8mm 0;
    border-bottom: 1px dashed rgba(71, 85, 105, 0.4);
  }
  .terms-list li:last-child { border-bottom: none; }
  .terms-list .term-idx {
    color: #0f172a;
    font-weight: 800;
    margin-left: 2mm;
  }

  .note-box {
    border: 1.2px solid #475569;
    background: rgba(255, 255, 255, 0.75);
    padding: 1.8mm 4mm;
    margin-top: 2mm;
    font-size: 9.5pt;
    line-height: 1.5;
    color: #1f2937;
    border-radius: 2mm;
  }
  .note-box .note-label {
    display: inline-block;
    font-size: 9pt;
    font-weight: 800;
    color: #0f172a;
    margin-left: 3mm;
    letter-spacing: 1px;
  }

  /* Extra-emphasized consequence clause — sits above the signature row
     so the volunteer sees it right before signing. Red-double border
     and warning icon make it visually distinct from the ordinary
     transfer-note box above. */
  .consequence-box {
    margin-top: 2mm;
    padding: 2mm 4mm;
    background: rgba(254, 226, 226, 0.75);
    border: 2px double #b91c1c;
    border-radius: 2mm;
    font-size: 9pt;
    line-height: 1.45;
    color: #7f1d1d;
    font-weight: 600;
  }
  .consequence-box .warn-label {
    display: inline-block;
    font-size: 9pt;
    font-weight: 900;
    color: #b91c1c;
    margin-left: 3mm;
    letter-spacing: 1px;
  }

  /* Fully-opaque signature panel — masks the letterhead footer
     graphics on receipt-bg.png so the volunteer + manager always have
     a clean, unobstructed white band to sign in ink. The subtle red
     border + drop shadow makes it read as an intentional signature
     card, not a rendering glitch. */
  .sig-panel {
    background: #ffffff;
    border: 1.5px solid #fecaca;
    border-radius: 3mm;
    padding: 5mm 5mm 4mm;
    margin-top: auto;
    box-shadow: 0 3mm 10mm -2mm rgba(185, 28, 28, 0.18);
  }
  .signers-row {
    display: flex;
    gap: 6mm;
    justify-content: space-between;
  }
  .signer {
    flex: 1;
    text-align: center;
    font-size: 9.5pt;
    display: flex;
    flex-direction: column;
  }
  .signer .signer-title {
    color: #475569;
    font-weight: 700;
    margin-bottom: 2mm;
    min-height: 7mm;
    line-height: 1.35;
  }
  .signer .signature-space {
    height: 20mm;
    border-bottom: 1.5px solid #1f2937;
    margin: 0 4mm 2mm 4mm;
    background: #fff;
  }
  .signer .signer-name {
    font-weight: 800;
    color: #0f172a;
    font-size: 10pt;
  }
  .signer .signer-sub {
    color: #64748b;
    font-size: 8.5pt;
    margin-top: 0.5mm;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="contract-stamp">
      عقد تطوع
      <span class="stamp-sub">VOLUNTEER CONTRACT</span>
    </div>

    <div class="contract-content">
      <div class="contract-title">عقد تطوع</div>
      <div class="parties">
        حرر هذا العقد بتاريخ <span class="contract-date">${safe(contractDate)}</span>
        بين <strong>فاب لاب الأحساء</strong> (الطرف الأول) و
        <strong>${safe(form.name)}</strong> (الطرف الثاني — المتطوع).
      </div>

      <div class="section-heading">البيانات الشخصية للمتطوع</div>
      <table class="info-table">
        <tr>
          <th>الاسم الكامل</th><td>${safe(form.name) || '&nbsp;'}</td>
          <th>رقم الهوية</th><td dir="ltr" style="text-align:right">${safe(form.nationalId) || '&nbsp;'}</td>
        </tr>
        <tr>
          <th>الجوال</th><td dir="ltr" style="text-align:right">${safe(form.phone) || '&nbsp;'}</td>
          <th>البريد الإلكتروني</th><td dir="ltr" style="text-align:right">${safe(form.email) || '&nbsp;'}</td>
        </tr>
      </table>

      <div class="section-heading">تفاصيل التطوع</div>
      <table class="info-table">
        <tr>
          <th>نوع/عنوان التطوع</th><td colspan="3">${safe(form.title) || '&nbsp;'}</td>
        </tr>
        <tr>
          <th>وصف المهام</th><td colspan="3">${safe(form.description) || '—'}</td>
        </tr>
        <tr>
          <th>مكان التطوع</th><td colspan="3">${safe(form.location) || 'فاب لاب — حسب توجيه الإدارة'}</td>
        </tr>
        <tr>
          <th>تاريخ البداية</th><td>${safe(fmtDate(form.startDate)) || '&nbsp;'}</td>
          <th>تاريخ النهاية</th><td>${safe(fmtDate(form.endDate)) || '&nbsp;'}</td>
        </tr>
        <tr>
          <th>إجمالي الأيام</th><td>${totalDays ? totalDays + ' يوم' : '—'}</td>
          <th>أيام العمل الفعلية</th><td class="strong">${workingDays ? workingDays + ' يوم' : '—'}<span class="sub-note">باستثناء الجمعة والسبت</span></td>
        </tr>
        <tr>
          <th>ساعات العمل اليومية</th><td>${Number(form.dailyHours) || DEFAULT_DAILY_HOURS} ساعة</td>
          <th>التكلفة اليومية</th><td class="strong">${Number(form.costPerDay) || 0} ريال / يوم</td>
        </tr>
      </table>

      <div class="note-box">
        <span class="note-label">ملاحظة هامة:</span>${safe(form.transferNote)}
      </div>

      <div class="section-heading">الشروط والالتزامات</div>
      <div class="terms-box">
        <ol class="terms-list">${termsHtml}</ol>
      </div>

      <div class="consequence-box">
        <span class="warn-label">⚠ تنبيه هام:</span>${safe(PHOTO_UPLOAD_CONSEQUENCE_AR)}
      </div>

      <div class="sig-panel">
        <div class="signers-row">
          <div class="signer">
            <div class="signer-title">الطرف الثاني — المتطوع</div>
            <div class="signature-space"></div>
            <div class="signer-name">${safe(form.name)}</div>
            <div class="signer-sub">التوقيع</div>
          </div>
          <div class="signer">
            <div class="signer-title">المسؤول التنفيذي لفاب لاب الأحساء</div>
            <div class="signature-space"></div>
            <div class="signer-name">أ. زكي اللويم</div>
            <div class="signer-sub">التوقيع والختم</div>
          </div>
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

  // ── Form UI ──────────────────────────────────────────────────────────
  const fieldStyle = {
    width: '100%', padding: '8px 11px', borderRadius: 6,
    border: '1.5px solid #cbd5e1', fontSize: 13.5, fontFamily: 'inherit'
  };
  const labelStyle = { display: 'block', fontWeight: 700, marginBottom: 5, color: '#334155', fontSize: 13 };
  const sectionTitle = {
    fontSize: 12, fontWeight: 800, color: '#991b1b', letterSpacing: 1,
    margin: '8px 0 10px', paddingBottom: 6, borderBottom: '1.5px solid #fecaca'
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modern-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header" style={{ borderBottom: '2px solid #b91c1c', padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#991b1b', margin: 0, fontSize: 18 }}>
            {isRTL ? 'طباعة عقد تطوع' : 'Print Volunteer Contract'}
          </h2>
          <button className="modal-close" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
          <div style={sectionTitle}>{isRTL ? 'البيانات الشخصية' : 'Personal Info'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'الاسم الكامل' : 'Full name'}</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'رقم الهوية' : 'National ID'}</label>
              <input type="text" value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الجوال' : 'Phone'}</label>
              <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div style={sectionTitle}>{isRTL ? 'تفاصيل التطوع' : 'Volunteering Details'}</div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>{isRTL ? 'نوع / عنوان التطوع' : 'Title'}</label>
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} style={fieldStyle}
              placeholder={isRTL ? 'مثال: تنظيم فعالية اليوم المفتوح' : 'e.g. Open day organizer'} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>{isRTL ? 'وصف المهام' : 'Task description'}</label>
            <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} style={{ ...fieldStyle, resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>{isRTL ? 'مكان التطوع' : 'Location'}</label>
            <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)} style={fieldStyle}
              placeholder={isRTL ? 'مثال: مقر فاب لاب — الأحساء' : 'e.g. FabLab HQ'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'تاريخ البداية' : 'Start date'}</label>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'تاريخ النهاية' : 'End date'}</label>
              <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'ساعات/يوم' : 'Hours/day'}</label>
              <input type="number" min="0" value={form.dailyHours} onChange={(e) => set('dailyHours', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'إجمالي الأيام' : 'Total days'}</label>
              <input type="text" readOnly value={totalDays || '—'}
                style={{ ...fieldStyle, background: '#f8fafc', color: '#475569' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'التكلفة اليومية (ريال)' : 'Cost / day (SAR)'}</label>
              <input type="number" min="0" value={form.costPerDay} onChange={(e) => set('costPerDay', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle} title={isRTL ? 'باستثناء الجمعة والسبت' : 'Excludes Fri/Sat'}>
                {isRTL ? 'أيام العمل الفعلية' : 'Working days'}
              </label>
              <input type="text" readOnly value={workingDays || '—'}
                style={{ ...fieldStyle, background: '#fef2f2', color: '#991b1b', fontWeight: 800 }} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الإجمالي (تلقائي)' : 'Total (auto)'}</label>
              <input type="text" readOnly value={totalCost ? `${totalCost} ريال` : '—'}
                style={{ ...fieldStyle, background: '#fef2f2', color: '#991b1b', fontWeight: 800 }} />
            </div>
          </div>

          <div style={sectionTitle}>{isRTL ? 'ملاحظة التنقل' : 'Transfer note'}</div>
          <textarea rows={3} value={form.transferNote} onChange={(e) => set('transferNote', e.target.value)}
            style={{ ...fieldStyle, resize: 'vertical' }} />
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
            disabled={!form.name || !form.title}
            style={{
              padding: '9px 22px', borderRadius: 6, border: 'none',
              background: (form.name && form.title) ? 'linear-gradient(90deg, #991b1b, #dc2626)' : '#cbd5e1',
              color: '#fff', fontWeight: 800, cursor: (form.name && form.title) ? 'pointer' : 'not-allowed',
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
