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

// Values that were previously auto-filled by the server as a generic
// admin label (e.g. "FABLAB Manager") should NOT be printed as the
// actual signing manager — treat those as empty so the default name
// fallback applies.
const GENERIC_MANAGER_LABELS = new Set(['fablab manager', 'admin', 'system', 'manager', '']);
const resolveManagerName = (v) => {
  const t = String(v || '').trim();
  if (!t || GENERIC_MANAGER_LABELS.has(t.toLowerCase())) return 'أ. زكي اللويم';
  return t;
};

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
  const managerNameStr = resolveManagerName(r.managerName);

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

  /* Each printed page — the letterhead image stretches the full A4
     but we only USE the middle band. Everything above 15% and below
     18% is where the letterhead's own header + footer live, so
     content must not encroach there. */
  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    margin: 0 auto;
    background: #fff;
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
    overflow: hidden;
    page-break-after: always;
  }
  .page + .page { margin-top: 8mm; }
  .page:last-child { page-break-after: auto; }

  /* Content is a flex column that fits WITHIN the letterhead safe
     area — top 16% for the letterhead header, bottom 18% for its
     footer. That leaves 66% of A4 (~196mm) for our content. */
  .content {
    position: absolute;
    top: 16%;
    /* Widened bottom safe zone (was 18%) — the letterhead's footer
       decoration on receipt-bg.png crowded the signature lines when
       printed. 24% leaves a clean white band for the manager's ink. */
    bottom: 24%;
    left: 14mm;
    right: 14mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* Signatures page gets even more clearance so the manager has a
     full unencumbered area to sign. */
  .page.sig-page .content { bottom: 28%; }

  .doc-title { text-align: center; font-size: 20pt; font-weight: 800; letter-spacing: 3px; margin: 0 0 2mm; color: #0f172a; }
  .doc-sub { text-align: center; font-size: 11pt; color: #16a34a; font-weight: 700; margin-bottom: 3mm; }
  .doc-no {
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11pt;
    color: #15803d;
    letter-spacing: 2px;
    padding: 2mm 8mm;
    background: rgba(22, 163, 74, 0.08);
    border: 1px solid rgba(22, 163, 74, 0.28);
    border-radius: 6mm;
    align-self: center;
    margin-bottom: 4mm;
  }

  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; font-size: 9.5pt; }
  .info-table th, .info-table td { border: 1px solid #475569; padding: 1.4mm 3mm; vertical-align: middle; }
  .info-table th { background: rgba(241, 245, 249, 0.9); width: 38%; font-weight: 700; text-align: right; color: #0f172a; }
  .info-table td { background: rgba(255, 255, 255, 0.82); font-weight: 600; color: #111827; }

  .decision-box { margin: 3mm 0; padding: 2.5mm 3.5mm; background: rgba(22, 163, 74, 0.08); border: 1.5px solid #16a34a; border-radius: 3mm; }
  .decision-box h4 { margin: 0 0 1.5mm; color: #15803d; font-size: 10.5pt; font-weight: 800; }
  .decision-note { font-size: 9.5pt; color: #334155; line-height: 1.6; white-space: pre-wrap; }

  /* Signature block always ends up on the LAST page. On the sanad
     it's the second page (which is empty of table content — the
     letterhead only carries the branding). This gives the manager
     a full, unobstructed area to sign inside the safe zone. */
  .sig-page { display: flex; align-items: flex-start; justify-content: center; }
  .sig-wrap { width: 100%; max-width: 165mm; }
  .sig-heading { text-align: center; font-size: 16pt; font-weight: 800; color: #0f172a; margin-bottom: 5mm; letter-spacing: 2px; }
  .sig-approved-badge {
    display: inline-block;
    padding: 2mm 8mm;
    background: rgba(22, 163, 74, 0.1);
    border: 2px solid #16a34a;
    color: #15803d;
    font-weight: 800;
    font-size: 12pt;
    border-radius: 20mm;
    margin-bottom: 8mm;
  }
  .sig-heading-wrap { text-align: center; margin-bottom: 6mm; }
  .sig-request-info {
    margin: 0 auto 8mm;
    max-width: 150mm;
    padding: 4mm 6mm;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid #cbd5e1;
    border-radius: 3mm;
    font-size: 10pt;
    color: #334155;
    text-align: center;
    line-height: 1.8;
  }
  .sig-request-info b { color: #0f172a; }
  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10mm;
    margin-top: 4mm;
  }
  .sig-cell { text-align: center; font-size: 10.5pt; padding: 2mm 2mm; }
  .sig-cell .sig-role { color: #475569; font-weight: 700; margin-bottom: 2mm; font-size: 10pt; letter-spacing: 0.5px; }
  .sig-cell .sig-name { font-weight: 800; color: #0f172a; font-size: 12pt; margin-bottom: 6mm; }
  .sig-cell .sig-line { border-bottom: 2px solid #1f2937; height: 20mm; margin: 0 3mm 2mm; }
  .sig-cell .sig-hint { color: #64748b; font-size: 9pt; letter-spacing: 0.5px; }
  .sig-cell.manager .sig-line { border-bottom-color: #16a34a; border-bottom-width: 2.5px; }
  .sig-cell.manager .sig-role { color: #15803d; }
  .sig-cell.manager .sig-name { color: #15803d; }

  .sig-date-row {
    margin-top: 6mm;
    padding-top: 3mm;
    border-top: 1px dashed #94a3b8;
    display: flex;
    justify-content: space-around;
    font-size: 10pt;
    color: #475569;
  }
  .sig-date-row b { color: #0f172a; font-weight: 700; }

  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-actions { display: none; }
    .page + .page { margin-top: 0; }
  }
</style>
</head>
<body>
  <div class="print-actions">
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
    <button class="ghost" onclick="window.close()">إغلاق</button>
  </div>

  <!-- PAGE 1: the request data -->
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
    </div>
  </div>

  <!-- PAGE 2: dedicated signature page — signature lines sit inside
       the safe zone with plenty of room, never over the letterhead
       footer. -->
  <div class="page sig-page">
    <div class="content sig-wrap">
      <div class="sig-heading-wrap">
        <div class="sig-heading">التوقيع والاعتماد</div>
        <div class="sig-approved-badge">✓ فرصة تطوعية معتمدة</div>
      </div>

      <div class="sig-request-info">
        <b>${esc(reqNo)}</b> — <b>${esc(r.title || '')}</b><br>
        ${r.coordinatorName ? `منسق الفرصة: <b>${esc(r.coordinatorName)}</b>` : ''}
      </div>

      <div class="sig-grid">
        <div class="sig-cell">
          <div class="sig-role">منسق الفرصة</div>
          <div class="sig-name">${esc(r.coordinatorName) || '&nbsp;'}</div>
          <div class="sig-line"></div>
          <div class="sig-hint">الاسم والتوقيع</div>
        </div>
        <div class="sig-cell manager">
          <div class="sig-role">✓ المدير المعتمد</div>
          <div class="sig-name">${esc(managerNameStr)}</div>
          <div class="sig-line"></div>
          <div class="sig-hint">التوقيع اليدوي</div>
        </div>
      </div>

      <div class="sig-date-row">
        <div>تاريخ الإصدار: <b>${esc(dateStr)}</b></div>
        <div>تاريخ الاعتماد: <b>${esc(approvedStr)}</b></div>
      </div>
    </div>
  </div>

  <script>
    // Preload the letterhead background so it's ready before the
    // user hits Print.
    const bg = new Image();
    bg.src = '${window.location.origin}/receipt-bg.png';
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
};

export default printVolunteerOpportunity;
