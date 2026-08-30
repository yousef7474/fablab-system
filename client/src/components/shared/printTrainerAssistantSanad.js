// Printable "سند مدرب معاون" — one document per assignment (chance)
// summarizing the trainer's engagement + a per-day attendance/cost
// table at a fixed 75 SAR/day rate. Modeled on
// printVolunteerOpportunity.js so both printed docs feel like one
// family of forms.
//
// Page layout (revised):
//   Page 1                → header + trainer/chance info + summary tiles
//   Page 2 .. N           → days-attendance table, chunked so a long
//                           chance never gets its rows clipped
//   Last page (sig-page)  → clean signature area on an opaque white
//                           panel that MASKS the letterhead footer
//                           graphics, guaranteeing room to sign

const RATE_PER_DAY_SAR = 75;
// Max rows we let a single days-table page carry. Tuned so the table
// fits inside the letterhead's safe zone with the header + section
// heading present.
const ROWS_PER_PAGE = 16;

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
const fmtDay = (ymd) => {
  if (!ymd) return '';
  try {
    return new Date(ymd + 'T00:00:00').toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', {
      calendar: 'gregory', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch { return ymd; }
};
const pad2 = (n) => String(n).padStart(2, '0');
const fmtTime = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch { return '—'; }
};
const hoursFor = (rec) => {
  if (!rec?.checkInAt || !rec?.checkOutAt) return 0;
  const diff = new Date(rec.checkOutAt) - new Date(rec.checkInAt);
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.round((diff / 3600000) * 100) / 100;
};

const refFor = (assignment) => {
  const id = String(assignment?.assignmentId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  return id ? `TRN-${id}` : 'TRN-—';
};

// `attendance` is the trainer's TrainerAssistantAttendance rows (any
// range — filtered locally to the chance's [startAt, endAt] window).
// If `assignment.attendanceDays` is a populated array (the per-day log
// filled from the admin's AttendanceLog UI), it wins — those rows
// carry an explicit `attended` flag, per-day hours, and a task
// description, which give the sanad its truest picture.
const printTrainerAssistantSanad = ({ trainer, assignment, attendance = [] }) => {
  if (!trainer || !assignment) {
    alert('البيانات ناقصة لطباعة السند');
    return;
  }
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة السند');
    return;
  }

  const startYmd = assignment.startAt
    ? String(assignment.startAt).slice(0, 10)
    : (assignment.chanceDate ? String(assignment.chanceDate).slice(0, 10) : null);
  const endYmd = assignment.endAt
    ? String(assignment.endAt).slice(0, 10)
    : (assignment.chanceDate ? String(assignment.chanceDate).slice(0, 10) : null);

  const manualDays = Array.isArray(assignment.attendanceDays)
    ? assignment.attendanceDays.filter(d => d && d.date)
    : [];
  let unified;
  let usingManual = false;
  if (manualDays.length > 0) {
    usingManual = true;
    unified = manualDays
      .filter(d => !startYmd || d.date >= startYmd)
      .filter(d => !endYmd || d.date <= endYmd)
      .map(d => ({
        date: d.date,
        complete: !!d.attended,
        hours: Number(d.hours) || 0,
        task: String(d.task || '').trim(),
        checkInAt: null,
        checkOutAt: null
      }));
  } else {
    unified = (Array.isArray(attendance) ? attendance : [])
      .filter(r => {
        if (!r?.date) return false;
        if (!startYmd && !endYmd) return true;
        return (!startYmd || r.date >= startYmd) && (!endYmd || r.date <= endYmd);
      })
      .map(r => ({
        date: r.date,
        complete: !!(r.checkInAt && r.checkOutAt),
        hours: hoursFor(r),
        task: '',
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt
      }));
  }
  unified.sort((a, b) => (a.date < b.date ? -1 : 1));

  const countedDays = unified.filter(r => r.complete).length;
  const totalCost = countedDays * RATE_PER_DAY_SAR;
  const totalHours = unified.reduce((s, r) => s + r.hours, 0);

  const ref = refFor(assignment);
  const dateStr = fmtDate(new Date().toISOString());
  const rangeStr = (startYmd || endYmd)
    ? `${fmtDate(startYmd)} ← ${fmtDate(endYmd)}`
    : '—';

  // Chunk the rows across days pages so a long chance never clips.
  const rowChunks = [];
  for (let i = 0; i < unified.length; i += ROWS_PER_PAGE) {
    rowChunks.push(unified.slice(i, i + ROWS_PER_PAGE));
  }
  if (rowChunks.length === 0) rowChunks.push([]); // one empty page

  const buildRow = (r, absoluteIdx) => {
    const rowCost = r.complete ? RATE_PER_DAY_SAR : 0;
    if (usingManual) {
      return `
        <tr class="${r.complete ? 'row-ok' : 'row-partial'}">
          <td class="c-idx">${absoluteIdx + 1}</td>
          <td class="c-day">${esc(fmtDay(r.date))}</td>
          <td class="c-num">${r.hours ? r.hours.toFixed(2) : '—'}</td>
          <td class="c-num">${rowCost}</td>
          <td class="c-task">${esc(r.task) || '—'}</td>
          <td class="c-status">${r.complete ? '✓' : '—'}</td>
        </tr>`;
    }
    return `
      <tr class="${r.complete ? 'row-ok' : 'row-partial'}">
        <td class="c-idx">${absoluteIdx + 1}</td>
        <td class="c-day">${esc(fmtDay(r.date))}</td>
        <td class="c-t">${esc(fmtTime(r.checkInAt))}</td>
        <td class="c-t">${esc(fmtTime(r.checkOutAt))}</td>
        <td class="c-num">${r.hours ? r.hours.toFixed(2) : '—'}</td>
        <td class="c-num">${rowCost}</td>
        <td class="c-status">${r.complete ? '✓' : '—'}</td>
      </tr>`;
  };

  const headHtml = `
    <tr>
      <th style="width:8mm">#</th>
      <th>اليوم</th>
      ${usingManual ? '' : '<th>الدخول</th><th>الخروج</th>'}
      <th>الساعات</th>
      <th>الأجرة (ريال)</th>
      ${usingManual ? '<th>المهمة المنجزة</th>' : ''}
      <th>مكتمل</th>
    </tr>`;
  const tfootHtml = `
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:right">الإجماليات</td>
        <td>${totalHours.toFixed(2)}</td>
        <td>${totalCost}</td>
        ${usingManual ? '<td></td>' : '<td></td><td></td>'}
        <td>${countedDays}</td>
      </tr>
    </tfoot>`;

  const daysPages = rowChunks.map((chunk, pageIdx) => {
    const startAbs = pageIdx * ROWS_PER_PAGE;
    const chunkHtml = chunk.length
      ? chunk.map((r, i) => buildRow(r, startAbs + i)).join('')
      : `<tr><td colspan="${usingManual ? 6 : 7}" style="text-align:center; padding: 4mm; color: #94a3b8;">لا توجد سجلات حضور ضمن فترة الفرصة</td></tr>`;
    const isLast = pageIdx === rowChunks.length - 1;
    const pageLabel = rowChunks.length > 1
      ? ` — صفحة ${pageIdx + 1} / ${rowChunks.length}`
      : '';
    return `
      <div class="page">
        <div class="content">
          <div class="doc-title" style="font-size:16pt; margin-bottom:1mm">سند مدرب معاون · ${esc(ref)}</div>
          <div class="section-heading">📅 ${usingManual ? 'سجل الحضور والمهام المنجزة' : 'سجل الحضور والأيام'}${pageLabel}</div>
          <table class="days-table">
            <thead>${headHtml}</thead>
            <tbody>${chunkHtml}</tbody>
            ${isLast ? tfootHtml : ''}
          </table>
          ${isLast ? `
            <div class="summary-cards">
              <div class="summary-card">
                <div class="label">أيام معتمدة</div>
                <div class="value">${countedDays}</div>
              </div>
              <div class="summary-card">
                <div class="label">إجمالي الساعات</div>
                <div class="value">${totalHours.toFixed(2)}</div>
              </div>
              <div class="summary-card cost">
                <div class="label">الإجمالي (ريال)</div>
                <div class="value">${totalCost}</div>
              </div>
            </div>` : ''}
        </div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سند مدرب معاون · ${esc(ref)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; background: #f4f6fb; }
  .print-actions { max-width: 210mm; margin: 20px auto; padding: 0 12px; display: flex; gap: 10px; justify-content: end; flex-wrap: wrap; }
  .print-actions button { padding: 12px 22px; border-radius: 10px; border: none; background: linear-gradient(135deg, #6d28d9, #a855f7); color: #fff; font-family: inherit; font-weight: 800; font-size: 14px; cursor: pointer; }
  .print-actions .ghost { background: #fff; color: #0f172a; border: 1px solid #e5e7eb; }

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

  .content {
    position: absolute;
    top: 16%;
    bottom: 24%;
    left: 14mm;
    right: 14mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .page.sig-page .content { bottom: 26%; }

  .doc-title { text-align: center; font-size: 20pt; font-weight: 800; letter-spacing: 3px; margin: 0 0 2mm; color: #0f172a; }
  .doc-sub   { text-align: center; font-size: 11pt; color: #6d28d9; font-weight: 700; margin-bottom: 3mm; }
  .doc-no    {
    text-align: center; font-family: 'JetBrains Mono', monospace;
    font-size: 11pt; color: #5b21b6; letter-spacing: 2px;
    padding: 2mm 8mm; background: rgba(109, 40, 217, 0.08);
    border: 1px solid rgba(109, 40, 217, 0.28);
    border-radius: 6mm; align-self: center; margin-bottom: 4mm;
  }

  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 3mm; font-size: 9.5pt; }
  .info-table th, .info-table td { border: 1px solid #475569; padding: 1.4mm 3mm; vertical-align: middle; }
  .info-table th { background: rgba(241, 245, 249, 0.9); width: 38%; font-weight: 700; text-align: right; color: #0f172a; }
  .info-table td { background: rgba(255, 255, 255, 0.82); font-weight: 600; color: #111827; }

  .section-heading {
    margin: 3mm 0 1.5mm;
    background: rgba(109, 40, 217, 0.08);
    color: #5b21b6;
    padding: 1.6mm 4mm;
    font-size: 10.5pt; font-weight: 800; letter-spacing: 1px;
    border-inline-start: 4px solid #6d28d9;
    border-radius: 1.5mm;
  }

  .days-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .days-table th, .days-table td {
    border: 1px solid #475569; padding: 1.2mm 2mm; text-align: center;
    background: rgba(255,255,255,0.9);
  }
  .days-table th {
    background: rgba(241, 245, 249, 0.9);
    color: #0f172a; font-weight: 800;
  }
  .days-table .c-idx { width: 8mm; color: #64748b; font-weight: 700; }
  .days-table .c-day { text-align: right; font-weight: 700; color: #0f172a; white-space: nowrap; }
  .days-table .c-t { font-family: 'JetBrains Mono', monospace; color: #334155; }
  .days-table .c-num { font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #0f172a; }
  .days-table .c-task { text-align: right; color: #1f2937; font-weight: 600; font-size: 8.5pt; line-height: 1.35; }
  .days-table .c-status { font-size: 11pt; color: #16a34a; }
  .days-table .row-partial td { background: rgba(254, 243, 199, 0.7); color: #92400e; }
  .days-table .row-partial .c-status { color: #b45309; }
  .days-table tfoot td {
    font-weight: 900; color: #5b21b6;
    background: rgba(109, 40, 217, 0.08);
  }

  .summary-cards {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 3mm; margin-top: 4mm;
  }
  .summary-card {
    background: rgba(255,255,255,0.92);
    border: 1.5px solid #cbd5e1;
    border-radius: 3mm;
    padding: 2.5mm 3mm;
    text-align: center;
  }
  .summary-card .label {
    font-size: 8.5pt; color: #64748b; letter-spacing: 0.5px; font-weight: 700;
  }
  .summary-card .value {
    margin-top: 1mm;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14pt; font-weight: 900; color: #0f172a;
  }
  .summary-card.cost {
    background: linear-gradient(135deg, #faf5ff, #ede9fe);
    border-color: #a855f7;
  }
  .summary-card.cost .value { color: #6d28d9; }

  /* National-ID photo page — same treatment as the volunteer receipt
     so the sanad family stays visually consistent. Sits between the
     info page and the days pages so the ID appears early in the doc
     right after the trainer's info summary. */
  .page.idphoto .content { align-items: center; }
  .idphoto-heading {
    font-size: 18pt; font-weight: 800; letter-spacing: 2px;
    color: #0f172a; margin: 0 0 6mm; text-align: center;
  }
  .idphoto-sub {
    font-size: 10pt; color: #6d28d9; font-weight: 700; margin-bottom: 6mm;
  }
  .idphoto-frame {
    flex: 1; width: 100%;
    display: flex; align-items: center; justify-content: center;
    padding: 4mm;
  }
  .idphoto-frame img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    box-shadow: 0 3mm 18mm rgba(15, 23, 42, 0.20);
    border-radius: 3mm;
    background: #fff;
    padding: 4mm;
    border: 1px solid #cbd5e1;
  }
  .idphoto-nophoto {
    color: #94a3b8; font-size: 13pt; font-weight: 700;
    border: 2px dashed #cbd5e1; padding: 24mm;
    border-radius: 4mm; background: rgba(255,255,255,0.85);
    text-align: center;
  }
  .idphoto-caption {
    margin-top: 5mm; font-size: 10pt; color: #64748b;
    text-align: center;
  }
  .idphoto-caption b { color: #0f172a; }

  /* Signature page — the signatures live INSIDE a fully opaque white
     panel that MASKS whatever letterhead footer graphics happen to sit
     underneath, guaranteeing a clean band the manager can sign in ink.
     The panel has its own subtle purple border + drop shadow so it
     doesn't look like a bug — it looks intentional, like a signature
     card laid on top of the letterhead. */
  .sig-page { display: flex; align-items: flex-start; justify-content: center; }
  .sig-wrap { width: 100%; max-width: 175mm; }
  .sig-heading { text-align: center; font-size: 16pt; font-weight: 800; color: #0f172a; margin-bottom: 4mm; letter-spacing: 2px; }
  .sig-approved-badge {
    display: inline-block; padding: 2mm 8mm;
    background: rgba(109, 40, 217, 0.1);
    border: 2px solid #6d28d9;
    color: #5b21b6; font-weight: 800; font-size: 12pt;
    border-radius: 20mm; margin-bottom: 6mm;
  }
  .sig-heading-wrap { text-align: center; margin-bottom: 4mm; }
  .sig-info {
    margin: 0 auto 5mm; max-width: 160mm;
    padding: 3mm 6mm;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid #cbd5e1;
    border-radius: 3mm;
    font-size: 10pt; color: #334155; text-align: center; line-height: 1.6;
  }
  .sig-info b { color: #0f172a; }
  /* THE opaque panel. Fully white (no rgba) so the letterhead footer
     graphics below are completely hidden. */
  .sig-panel {
    background: #ffffff;
    border: 1.5px solid #c7b3f2;
    border-radius: 3mm;
    padding: 6mm 6mm 5mm;
    box-shadow: 0 3mm 10mm -2mm rgba(109, 40, 217, 0.20);
  }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
  .sig-cell { text-align: center; font-size: 10.5pt; padding: 2mm 2mm; }
  .sig-cell .sig-role { color: #475569; font-weight: 700; margin-bottom: 2mm; font-size: 10pt; }
  .sig-cell .sig-name { font-weight: 800; color: #0f172a; font-size: 12pt; margin-bottom: 6mm; }
  .sig-cell .sig-line { border-bottom: 2px solid #1f2937; height: 22mm; margin: 0 3mm 2mm; background: #fff; }
  .sig-cell .sig-hint { color: #64748b; font-size: 9pt; }
  .sig-cell.manager .sig-line { border-bottom-color: #6d28d9; border-bottom-width: 2.5px; }
  .sig-cell.manager .sig-role { color: #5b21b6; }
  .sig-cell.manager .sig-name { color: #5b21b6; }
  .sig-date-row {
    margin-top: 5mm; padding-top: 3mm;
    border-top: 1px dashed #94a3b8;
    display: flex; justify-content: space-around;
    font-size: 10pt; color: #475569;
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

  <!-- PAGE 1: trainer + chance details (no big table here) -->
  <div class="page">
    <div class="content">
      <div class="doc-title">سند مدرب معاون</div>
      <div class="doc-sub">Assistant Trainer Payment Sanad</div>
      <div class="doc-no">${esc(ref)}</div>

      <table class="info-table">
        <tbody>
          <tr><th>اسم المدرب المعاون</th><td>${esc(trainer.name) || '—'}</td></tr>
          <tr><th>رقم الهوية</th><td dir="ltr" style="text-align:right">${esc(trainer.nationalId) || '—'}</td></tr>
          <tr><th>الجوال</th><td dir="ltr" style="text-align:right">${esc(trainer.phone) || '—'}</td></tr>
          <tr><th>مسمى الفرصة</th><td>${esc(assignment.chanceName) || '—'}</td></tr>
          <tr><th>الجهة / المكان</th><td>${esc(assignment.destination) || '—'}</td></tr>
          <tr><th>الفترة</th><td>${esc(rangeStr)}</td></tr>
          <tr><th>الأجرة اليومية</th><td><b>${RATE_PER_DAY_SAR} ريال / يوم عمل مكتمل</b></td></tr>
          <tr><th>عدد الأيام المعتمدة</th><td><b>${countedDays} يوم</b></td></tr>
          <tr><th>الإجمالي</th><td><b style="color:#6d28d9">${totalCost} ريال</b></td></tr>
        </tbody>
      </table>

      <div class="summary-cards">
        <div class="summary-card">
          <div class="label">أيام معتمدة</div>
          <div class="value">${countedDays}</div>
        </div>
        <div class="summary-card">
          <div class="label">إجمالي الساعات</div>
          <div class="value">${totalHours.toFixed(2)}</div>
        </div>
        <div class="summary-card cost">
          <div class="label">الإجمالي (ريال)</div>
          <div class="value">${totalCost}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- PAGE 2: national ID photo — matches the volunteer sanad style -->
  <div class="page idphoto">
    <div class="content">
      <div class="idphoto-heading">صورة الهوية الوطنية</div>
      <div class="idphoto-sub">National ID · ${esc(ref)}</div>
      <div class="idphoto-frame">
        ${(trainer.nationalIdPhoto || trainer.profilePhoto)
          ? `<img src="${trainer.nationalIdPhoto || trainer.profilePhoto}" alt="National ID" />`
          : '<div class="idphoto-nophoto">لا توجد صورة هوية محفوظة لهذا المدرب</div>'}
      </div>
      <div class="idphoto-caption">
        <b>${esc(trainer.name || '')}</b>
        ${trainer.nationalId ? ` · رقم الهوية: <span dir="ltr">${esc(trainer.nationalId)}</span>` : ''}
      </div>
    </div>
  </div>

  <!-- PAGES 3..N: attendance table pages (chunked, ${rowChunks.length} page(s)) -->
  ${daysPages}

  <!-- LAST PAGE: signature page — opaque white panel masks the letterhead footer -->
  <div class="page sig-page">
    <div class="content sig-wrap">
      <div class="sig-heading-wrap">
        <div class="sig-heading">التوقيع والاعتماد</div>
        <div class="sig-approved-badge">✓ سند مدرب معاون</div>
      </div>

      <div class="sig-info">
        <b>${esc(ref)}</b> — <b>${esc(assignment.chanceName || '')}</b><br>
        المدرب: <b>${esc(trainer.name || '')}</b> · الإجمالي: <b>${totalCost} ريال</b>
      </div>

      <div class="sig-panel">
        <div class="sig-grid">
          <div class="sig-cell">
            <div class="sig-role">المدرب المعاون</div>
            <div class="sig-name">${esc(trainer.name) || '&nbsp;'}</div>
            <div class="sig-line"></div>
            <div class="sig-hint">الاسم والتوقيع (استلام)</div>
          </div>
          <div class="sig-cell manager">
            <div class="sig-role">✓ المسؤول التنفيذي</div>
            <div class="sig-name">أ. زكي اللويم</div>
            <div class="sig-line"></div>
            <div class="sig-hint">التوقيع والختم</div>
          </div>
        </div>

        <div class="sig-date-row">
          <div>تاريخ الإصدار: <b>${esc(dateStr)}</b></div>
          <div>مرجع السند: <b>${esc(ref)}</b></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const bg = new Image();
    bg.src = '${window.location.origin}/receipt-bg.png';
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
};

export default printTrainerAssistantSanad;
export { RATE_PER_DAY_SAR };
