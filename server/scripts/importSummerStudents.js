/*
 * One-shot importer for Summer FabLab 2026 student enrollments.
 *
 * Reads server/data/summerStudents2026.json (7 groups, one per Excel
 * sheet), matches each group to a SummerProgram by name, and inserts
 * the students under that program.
 *
 * Idempotent: skips any student whose nationalId is already enrolled
 * in the same program, so re-running is safe.
 *
 * Usage on the droplet:
 *   cd /var/www/fablab && node server/scripts/importSummerStudents.js
 *
 * If a sheet can't be auto-matched to a program, the script prints the
 * unmatched sheet + all available program names — add an entry to
 * SHEET_TO_PROGRAM_OVERRIDE below (or rename the program in the admin
 * UI) and re-run.
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { sequelize, SummerProgram, SummerStudent } = require('../models');

// Explicit sheet-name → DB program-name map for this specific roster
// (DB names include a "برنامج" prefix, and two of them have typos —
// "فنرة" for "فترة" and "الواقه" for "الواقع" — that we match exactly).
const SHEET_TO_PROGRAM_OVERRIDE = {
  'صناع المستقبل - صباحية':      'برنامج صناع المستقبل - الفترة الصباحية',
  'صناع المستقبل - مسائية':      'برنامج صناع المستقبل - فنرة مسائية',
  'الروبوتات الذكية صباح':       'برنامج الروبوتات الذكية - فترة صباحية',
  'الروبوتات الذكية مساء':       'برنامج الروبوتات الذكية - فترة مسائية',
  'معسكر روبوتات VEX IQ العالمية': 'برنامج روبوتات VEX العالمية',
  'صناع الواقع - مسائية':        'برنامج صناع الواقع (Make it Real) - الفترة المسائية',
  'صناع الواقع - صباحية':        'برنامج صناع الواقه (Make it Real) - الفترة الصباحية'
};

const arabicNorm = (s) => String(s || '')
  .trim()
  .replace(/[ً-ٰٟ]/g, '') // strip diacritics
  .replace(/[إأآا]/g, 'ا')                // normalize alef
  .replace(/ى/g, 'ي')                     // normalize ya
  .replace(/ؤ/g, 'و')                     // normalize waw variants
  .replace(/ئ/g, 'ي')
  .replace(/ة/g, 'ه')                     // ta-marbuta → ha
  .replace(/[\-–—_()،,.]/g, ' ')          // punctuation → space
  .replace(/\s+/g, ' ')
  .toLowerCase();

// Find the SummerProgram row that matches this sheet. Tries the manual
// override first, then exact match, then normalized-contains fuzzy
// match in either direction. Returns the program or null.
const findProgramForSheet = (sheet, programs) => {
  if (SHEET_TO_PROGRAM_OVERRIDE[sheet.sheetName]) {
    const target = SHEET_TO_PROGRAM_OVERRIDE[sheet.sheetName];
    return programs.find(p => p.name === target) || null;
  }
  const exact = programs.find(p =>
    p.name === sheet.sheetName || p.name === sheet.titleInSheet
  );
  if (exact) return exact;

  const nsheet = arabicNorm(sheet.sheetName);
  const ntitle = arabicNorm(sheet.titleInSheet);

  // Try normalized equality first
  for (const p of programs) {
    const np = arabicNorm(p.name);
    if (np === nsheet || np === ntitle) return p;
  }
  // Then substring match in either direction
  for (const p of programs) {
    const np = arabicNorm(p.name);
    if (np.includes(nsheet) || nsheet.includes(np)) return p;
    if (np.includes(ntitle) || ntitle.includes(np)) return p;
  }
  return null;
};

const isValidSaudiId = (s) => /^\d{9,12}$/.test(String(s || '').trim());
const normPhone = (s) => {
  const t = String(s || '').replace(/\D/g, '');
  if (!t) return null;
  // 5XXXXXXXX → 9665XXXXXXXX for consistency
  if (t.length === 9 && t.startsWith('5')) return '966' + t;
  return t;
};

async function main() {
  const jsonPath = path.join(__dirname, '..', 'data', 'summerStudents2026.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Seed file not found:', jsonPath);
    process.exit(1);
  }
  const groups = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  await sequelize.authenticate();
  console.log('✅ DB connection ok');

  const programs = await SummerProgram.findAll({ where: { isActive: true } });
  console.log(`Found ${programs.length} active programs in DB:`);
  programs.forEach(p => console.log(`  · ${p.name}`));
  console.log('');

  const summary = { totalInserted: 0, totalSkipped: 0, unmatchedSheets: [], groups: [] };

  for (const group of groups) {
    const program = findProgramForSheet(group, programs);
    if (!program) {
      summary.unmatchedSheets.push(group.sheetName);
      console.log(`⚠️  No program match for sheet "${group.sheetName}" (${group.students.length} students skipped)`);
      continue;
    }

    // Load existing students in this program for dedupe
    const existing = await SummerStudent.findAll({
      where: { programId: program.programId },
      attributes: ['nationalId', 'name']
    });
    const existingIds = new Set(existing.map(s => (s.nationalId || '').trim()).filter(Boolean));
    const existingNames = new Set(existing.map(s => (s.name || '').trim()));

    let inserted = 0, skipped = 0;
    for (const s of group.students) {
      const name = (s.name || '').trim();
      if (!name) { skipped++; continue; }
      const nid = (s.nationalId || '').trim();
      // Dedupe: nationalId if present, else name
      if (nid && existingIds.has(nid)) { skipped++; continue; }
      if (!nid && existingNames.has(name)) { skipped++; continue; }

      const ageNum = /^\d+$/.test(s.age) ? Number(s.age) : null;
      try {
        await SummerStudent.create({
          programId: program.programId,
          name,
          nationalId: nid || null,
          phone: normPhone(s.phone),
          email: null,
          age: ageNum,
          gender: null,
          notes: s.notes || null,
          createdById: null
        });
        if (nid) existingIds.add(nid); else existingNames.add(name);
        inserted++;
      } catch (err) {
        console.log(`  ✖ ${name}: ${err.message}`);
        skipped++;
      }
    }

    summary.groups.push({
      sheet: group.sheetName,
      program: program.name,
      inserted, skipped
    });
    summary.totalInserted += inserted;
    summary.totalSkipped += skipped;
    console.log(`✓ "${group.sheetName}" → "${program.name}": inserted ${inserted}, skipped ${skipped}`);
  }

  console.log('');
  console.log('====== SUMMARY ======');
  console.log(`Inserted: ${summary.totalInserted}`);
  console.log(`Skipped:  ${summary.totalSkipped}`);
  if (summary.unmatchedSheets.length) {
    console.log(`Unmatched sheets: ${summary.unmatchedSheets.length}`);
    summary.unmatchedSheets.forEach(s => console.log(`  ✖ ${s}`));
    console.log('');
    console.log('→ Fix by adding an entry to SHEET_TO_PROGRAM_OVERRIDE in this file, or renaming the program in the admin UI, then re-run.');
  }
  await sequelize.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
