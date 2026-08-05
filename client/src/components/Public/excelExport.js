// UTF-16 LE + BOM TSV — same format the server uses for attendance
// exports. Excel opens this natively with proper Arabic rendering, and
// pasting into Google Sheets / Word also works cleanly.

const toUtf16LeBom = (text) => {
  const buffer = new ArrayBuffer(2 + text.length * 2);
  const view = new DataView(buffer);
  // Little-endian BOM (FF FE)
  view.setUint8(0, 0xFF);
  view.setUint8(1, 0xFE);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(2 + i * 2, text.charCodeAt(i), true);
  }
  return buffer;
};

// Sanitize a single cell so tabs/newlines don't break the row layout
const cell = (v) => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ');

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(d);
};

const dayOfWeek = (isoDate) => {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  return AR_DAYS[d.getDay()];
};

const downloadTsv = (text, filename) => {
  const buf = toUtf16LeBom(text);
  const blob = new Blob([buf], { type: 'text/csv;charset=utf-16le' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

/**
 * Export a single volunteer's profile + attendance history.
 * Two "sections" in one file: header key-values, then attendance table.
 */
export const exportVolunteerReport = (volunteer, attendance) => {
  const lines = [];

  // --- Info block ---
  lines.push(['بيانات المتطوع'].join('\t'));
  lines.push(['الاسم', cell(volunteer.name)].join('\t'));
  lines.push(['رقم الهوية', cell(volunteer.nationalId)].join('\t'));
  lines.push(['رقم الجوال', cell(volunteer.phone)].join('\t'));
  if (volunteer.email) lines.push(['البريد الإلكتروني', cell(volunteer.email)].join('\t'));
  if (volunteer.summerProgram?.name) {
    lines.push(['البرنامج', cell(volunteer.summerProgram.name)].join('\t'));
  }
  if (volunteer.driveUrl) {
    lines.push(['مجلد Google Drive', cell(volunteer.driveUrl)].join('\t'));
  }
  lines.push('');

  // --- Attendance summary ---
  const totalDays = attendance.filter(a => a.checkInAt).length;
  const totalMinutes = attendance.reduce((s, r) => s + (r.minutes || 0), 0);
  lines.push(['ملخص الحضور'].join('\t'));
  lines.push(['إجمالي الأيام', totalDays].join('\t'));
  lines.push(['إجمالي الساعات', (totalMinutes / 60).toFixed(2)].join('\t'));
  lines.push('');

  // --- Attendance table ---
  lines.push(['سجل الحضور'].join('\t'));
  lines.push([
    'اليوم', 'التاريخ', 'وقت الدخول', 'وقت الخروج', 'المدة (دقيقة)', 'المدة (ساعة)'
  ].join('\t'));
  for (const r of attendance) {
    lines.push([
      dayOfWeek(r.date),
      cell(r.date),
      fmtTime(r.checkInAt),
      fmtTime(r.checkOutAt),
      r.minutes != null ? r.minutes : '',
      r.minutes != null ? (r.minutes / 60).toFixed(2) : ''
    ].join('\t'));
  }

  const text = lines.join('\r\n');
  const safeName = (volunteer.name || 'volunteer').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40);
  const today = new Date().toISOString().slice(0, 10);
  downloadTsv(text, `volunteer-${safeName}-${today}.csv`);
};

/**
 * Export the master report: one row per attendance record, joined with
 * the volunteer's info — so the reviewer can pivot / filter freely.
 */
export const exportMasterReport = (volunteers) => {
  const lines = [];
  lines.push([
    'اسم المتطوع',
    'رقم الهوية',
    'رقم الجوال',
    'البرنامج',
    'مجلد Drive',
    'التاريخ',
    'اليوم',
    'وقت الدخول',
    'وقت الخروج',
    'المدة (دقيقة)',
    'المدة (ساعة)'
  ].join('\t'));

  for (const v of volunteers) {
    const att = v.attendance || [];
    if (att.length === 0) {
      lines.push([
        cell(v.name), cell(v.nationalId), cell(v.phone),
        cell(v.summerProgram?.name || ''), cell(v.driveUrl || ''),
        '', '', '', '', '', ''
      ].join('\t'));
      continue;
    }
    for (const r of att) {
      lines.push([
        cell(v.name),
        cell(v.nationalId),
        cell(v.phone),
        cell(v.summerProgram?.name || ''),
        cell(v.driveUrl || ''),
        cell(r.date),
        dayOfWeek(r.date),
        fmtTime(r.checkInAt),
        fmtTime(r.checkOutAt),
        r.minutes != null ? r.minutes : '',
        r.minutes != null ? (r.minutes / 60).toFixed(2) : ''
      ].join('\t'));
    }
  }

  const text = lines.join('\r\n');
  const today = new Date().toISOString().slice(0, 10);
  downloadTsv(text, `volunteers-master-report-${today}.csv`);
};
