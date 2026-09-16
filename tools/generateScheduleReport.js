/**
 * Reads the 1448 term-1 excel and emits a human-readable report
 * of every scheduled visit — used as a checklist when creating
 * education workshops.
 *
 * Run:  node tools/generateScheduleReport.js > tools/education-schedule-report.txt
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../client/node_modules/xlsx'));

const XLSX_PATH = 'C:/Users/yakhy/Desktop/جدول زيارات فصول الموهوبين للفاب لاب الفصل الاول للعام 1448ه.xlsx';

const wb = XLSX.readFile(XLSX_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

const entries = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i] || [];
  const [num, day, dateHijri, dateGregorian, school1, room1, school2, room2] = r;
  if (!school1 && !school2) continue;
  if (school1) entries.push({ num, day, dateHijri, dateGregorian, school: String(school1).trim(), room: room1 ? String(room1).trim() : null });
  if (school2) entries.push({ num, day, dateHijri, dateGregorian, school: String(school2).trim(), room: room2 ? String(room2).trim() : null });
}

// Group by school to show visit counts.
const bySchool = new Map();
for (const e of entries) {
  const arr = bySchool.get(e.school) || [];
  arr.push(e);
  bySchool.set(e.school, arr);
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  جدول زيارات فصول الموهوبين — الفصل الأول 1448ه');
console.log('  Term-1 1448AH — Gifted-classes FabLab visit schedule');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('Total scheduled visits: ' + entries.length);
console.log('Unique schools:         ' + bySchool.size);
console.log('');
console.log('───── Full chronological schedule ─────');
entries
  .sort((a, b) => (a.dateGregorian || '').localeCompare(b.dateGregorian || ''))
  .forEach((e, i) => {
    console.log(`${String(i + 1).padStart(2, ' ')}. ${e.dateGregorian}  ${e.day.padEnd(8, ' ')}  ${(e.room || '—').padEnd(24, ' ')}  ${e.school}`);
  });

console.log('');
console.log('───── Schools with multiple visits ─────');
[...bySchool.entries()]
  .filter(([, arr]) => arr.length > 1)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([school, arr]) => {
    console.log(`  (${arr.length}×) ${school}`);
    arr.forEach(e => console.log(`         · ${e.dateGregorian}  ${e.room || '—'}`));
  });
