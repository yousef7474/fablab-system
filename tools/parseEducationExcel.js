/**
 * One-off helper: read the education-workshops excel and print a JSON
 * summary of every scheduled visit, so we can compare with the DB.
 *
 * Run:  node tools/parseEducationExcel.js
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../client/node_modules/xlsx'));

const XLSX_PATH = 'C:/Users/yakhy/Desktop/جدول زيارات فصول الموهوبين للفاب لاب الفصل الاول للعام 1448ه.xlsx';

const wb = XLSX.readFile(XLSX_PATH);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

console.log('Sheet:', sheetName);
console.log('Total rows:', rows.length);
console.log('First 5 rows:');
for (let i = 0; i < Math.min(5, rows.length); i++) {
  console.log(i, JSON.stringify(rows[i]));
}

// Try to detect the header row (row with textual column names)
let headerRowIdx = -1;
for (let i = 0; i < Math.min(10, rows.length); i++) {
  const r = rows[i] || [];
  if (r.some(c => typeof c === 'string' && /مدرسة|المدرسة|قاعة/.test(c))) {
    headerRowIdx = i;
    break;
  }
}
console.log('\nDetected header row idx:', headerRowIdx);
if (headerRowIdx >= 0) console.log('Header:', JSON.stringify(rows[headerRowIdx]));

// Data rows follow the header.
const entries = [];
for (let i = headerRowIdx + 1; i < rows.length; i++) {
  const r = rows[i] || [];
  const [num, day, dateHijri, dateGregorian, school1, room1, school2, room2] = r;
  // Skip totally empty rows
  if (!school1 && !school2) continue;
  if (school1) entries.push({ num, day, dateHijri, dateGregorian, school: String(school1).trim(), room: room1 ? String(room1).trim() : null });
  if (school2) entries.push({ num, day, dateHijri, dateGregorian, school: String(school2).trim(), room: room2 ? String(room2).trim() : null });
}
console.log('\nExtracted entries:', entries.length);
console.log(JSON.stringify(entries, null, 2));
