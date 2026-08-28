// Opens a print-ready window with a formatted "Volunteer Opportunity
// Approval" document — used by both the manager approvals card (right
// after they hit Approve) and the admin's past-requests list.
//
// The document includes every field the admin filled + an approval
// footer with a blank signature line the manager signs by hand after
// printing. Same visual language as the FabLab visit / overtime سند
// files: A4 page with the receipt-bg letterhead, a data table, and
// a signers row at the bottom.

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtDate = (v) => {
  if (!v) return '';
  try {
    return new Date(v).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', {
      calendar: 'gregory', year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return String(v).slice(0, 10); }
};

const fmtRequestNo = (n) => n == null ? '—' : `VOR-${String(n).padStart(3, '0')}`;
const modeAr = (m) => m === 'remote' ? 'عن بُعد' : m === 'hybrid' ? 'هجين' : 'حضوري';
const genderAr = (g) => g === 'male' ? 'ذكور فقط' : g === 'female' ? 'إناث فقط' : 'الجميع';

const row = (label, val) => val
  ? `<tr>
      <th>${esc(label)}</th>
      <td>${esc(val)}</td>
    </tr>`
  : '';

const rowMultiline = (label, val) => val
  ? `<tr>
      <th style="vertical-align:top">${esc(label)}</th>
      <td style="white-space:pre-wrap;line-height:1.75">${esc(val)}</td>
    </tr>`
  : '';

const printVolunteerOpportunity = (r) => {
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة الوثيقة');
    return;
  }

  const reqNo = fmtRequestNo(r.requestNumber);
  const dateStr = fmtDate(new Date().toISOString());
  const approvedStr = fmtDate(r.approvedAt || new Date().toISOString());
  const rangeStr = r.startDate || r.endDate
    ? `${fmtDate(r.startDate)} ← ${fmtDate(r.endDate)}`
    : '';
  const ageStr = (r.minAge || r.maxAge)
    ? `${r.minAge || '—'} - ${r.maxAge || '—'} سنة`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سند اعتماد فرصة تطوعية · ${reqNo}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; background: #f4f6fb; }
  .print-actions { max-width: 210mm; margin: 20px auto; padding: 0 12px; display: flex; gap: 10px; justify-content: end; flex-wrap: wrap; }
  .print-actions button { padding: 12px 22px; border-radius: 10px; border: none; background: linear-gradient(135deg, #16a34a, #15803d); color: #fff; font-family: inherit; font-weight: 800; font-size: 14px; cursor: pointer; }
  .print-actions .ghost { background: #fff; color: #0f172a; border: 1px solid #e5e7eb; }

  .page {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #fff;
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    overflow: hidden;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }

  /* Content sits inside the letterhead's usable area. */
  .content {
    position: absolute;
    top: 16%;
    bottom: 12%;
    left: 14mm;
    right: 14mm;
    display: flex;
    flex-direction: column;
  }
  .doc-title {
    text-align: center;
    font-size: 22pt;
    font-weight: 800;
    letter-spacing: 3px;
    margin: 0 0 3mm;
    color: #0f172a;
  }
  .doc-sub {
    text-align: center;
    font-size: 12pt;
    color: #16a34a;
    font-weight: 700;
    margin-bottom: 5mm;
  }
  .doc-no {
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12pt;
    color: #15803d;
    letter-spacing: 2px;
    padding: 3mm 8mm;
    background: rgba(22, 163, 74, 0.08);
    border: 1px solid rgba(22, 163, 74, 0.28);
    border-radius: 6mm;
    align-self: center;
    margin-bottom: 5mm;
  }
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4mm;
    font-size: 10.5pt;
  }
  .info-table th, .info-table td {
    border: 1px solid #475569;
    padding: 1.8mm 3.5mm;
    vertical-align: middle;
  }
  .info-table th {
    background: rgba(241, 245, 249, 0.85);
    width: 40%;
    font-weight: 700;
    text-align: right;
    color: #0f172a;
  }
  .info-table td {
    background: rgba(255, 255, 255, 0.72);
    font-weight: 600;
    color: #111827;
  }
  .decision-box {
    margin: 4mm 0;
    padding: 3mm 4mm;
    background: rgba(22, 163, 74, 0.08);
    border: 1.5px solid #16a34a;
    border-radius: 3mm;
  }
  .decision-box h4 {
    margin: 0 0 2mm;
    color: #15803d;
    font-size: 11.5pt;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 2mm;
  }
  .decision-note {
    font-size: 10.5pt;
    color: #334155;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .signature-block {
    margin-top: auto;
    padding-top: 5mm;
    border-top: 1.5px dashed #475569;
  }
  .signature-title {
    font-size: 11pt;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 3mm;
    text-align: center;
    letter-spacing: 1px;
  }
  .signature-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6mm;
  }
  .sig-cell {
    text-align: center;
    font-size: 10.5pt;
  }
  .sig-cell .sig-role {
    color: #475569;
    font-weight: 600;
    margin-bottom: 2mm;
    font-size: 9.5pt;
  }
  .sig-cell .sig-name {
    font-weight: 800;
    color: #0f172a;
    font-size: 11pt;
    margin-bottom: 4mm;
  }
  .sig-cell .sig-line {
    border-bottom: 1.5px solid #1f2937;
    height: 15mm;
    margin: 0 6mm 2mm;
  }
  .sig-cell .sig-hint {
    color: #64748b;
    font-size: 8.5pt;
    letter-spacing: 0.5px;
  }
  .sig-cell.manager .sig-line {
    border-bottom-color: #16a34a;
    border-bottom-width: 2px;
    background: linear-gradient(180deg, transparent 0%, transparent 96%, rgba(22, 163, 74, 0.15) 100%);
  }
  .sig-cell.manager .sig-role { color: #15803d; }

  .footer-row {
    margin-top: 4mm;
    padding-top: 3mm;
    border-top: 1px solid #cbd5e1;
    display: flex;
    justify-content: space-between;
    font-size: 8.5pt;
    color: #64748b;
  }

  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-actions { display: none; }
    .page { margin: 0; }
  }
</style>
</head>
<body>
  <div class="print-actions">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="ghost" onclick="window.close()">إغلاق</button>
  </div>

  <div class="page">
    <div class="content">
      <div class="doc-title">سند اعتماد فرصة تطوعية</div>
      <div class="doc-sub">✓ تمت الموافقة</div>
      <div class="doc-no">${esc(reqNo)}</div>

      <table class="info-table">
        <tbody>
          ${row('اسم منسق الفرصة', r.coordinatorName)}
          ${row('رقم جوال منسق الفرصة', r.coordinatorPhone)}
          ${row('مسمى الفرصة التطوعية', r.title)}
          ${row('مكان الفرصة', r.location)}
          ${row('طبيعة الفرصة', modeAr(r.mode))}
          ${row('عدد المتطوعين المطلوب', r.volunteersNeeded)}
          ${row('الجنس', genderAr(r.genderPreference))}
          ${row('العمر المناسب', ageStr)}
          ${row('وقت البرنامج', r.programStartTime && r.programEndTime ? `${r.programStartTime} — ${r.programEndTime}` : '')}
          ${row('الفترة', rangeStr)}
          ${row('المؤهل العلمي', r.educationLevel)}
          ${rowMultiline('المهارات المطلوبة', r.requiredSkills)}
          ${rowMultiline('وصف الفرصة', r.description)}
          ${rowMultiline('مهام ومسؤوليات المتطوع', r.responsibilities)}
          ${rowMultiline('الدعم المقدم للمتطوع', r.supportProvided)}
          ${rowMultiline('المخاطر والتحديات', r.risksAndChallenges)}
          ${row('تاريخ الإصدار', dateStr)}
          ${row('تاريخ الاعتماد', approvedStr)}
        </tbody>
      </table>

      ${r.managerNote ? `
        <div class="decision-box">
          <h4>📝 ملاحظة المدير</h4>
          <div class="decision-note">${esc(r.managerNote)}</div>
        </div>` : ''}

      <div class="signature-block">
        <div class="signature-title">التوقيع والاعتماد</div>
        <div class="signature-grid">
          <div class="sig-cell">
            <div class="sig-role">منسق الفرصة</div>
            <div class="sig-name">${esc(r.coordinatorName) || '&nbsp;'}</div>
            <div class="sig-line"></div>
            <div class="sig-hint">الاسم والتوقيع</div>
          </div>
          <div class="sig-cell manager">
            <div class="sig-role">✓ المدير المعتمد</div>
            <div class="sig-name">${esc(r.managerName || 'أ. زكي اللويم')}</div>
            <div class="sig-line"></div>
            <div class="sig-hint">التوقيع اليدوي</div>
          </div>
        </div>
      </div>

      <div class="footer-row">
        <div><b>فاب لاب الأحساء</b> · مؤسسة عبدالمنعم الراشد الإنسانية</div>
        <div>fablabsahsa.com</div>
      </div>
    </div>
  </div>

  <script>
    // Wait for the letterhead background image to load before showing
    // print controls — printing before it loads would produce a blank
    // background page.
    const bg = new Image();
    bg.src = '${window.location.origin}/receipt-bg.png';
    bg.onload = () => { /* nothing; user prints manually */ };
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
};

export default printVolunteerOpportunity;
