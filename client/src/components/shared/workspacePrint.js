// Printable sheets for an accepted workspace booking (admin / manager
// boards): the A4 banner put on the workspace, and the members' ID cards
// (QR FL:WSM:<national ID>, scanned at «محطة الحضور»). Each opens a print
// window with its own HTML.
import { RULES } from '../WorkspaceRegistration/workspaceTerms';

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const origin = () => window.location.origin;
const fmtDate = (ymd) => {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y) return '';
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const fmt12 = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (Number.isNaN(h)) return hhmm || '';
  const ap = h >= 12 ? 'م' : 'ص';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
};
const unitNo = (code) => String(code || '').replace('WS', '');

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">';

// `win`: a window opened earlier by the click itself (popup blockers stop
// windows opened after an await).
const openPrint = (title, html, win = null) => {
  const w = win || window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title>${FONTS}${html}</html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) { /* the page has its own button */ } }, 700);
  return true;
};

// ---------- A4 banner ----------
export function printWorkspaceBanner(req) {
  const members = Array.isArray(req.members) ? req.members : [];
  const team = members.map((m, i) => `
    <li><span class="n">${i + 1}</span><b>${esc(m.name)}</b>${i === 0 ? '<em>قائد الفريق</em>' : ''}${m.phoneNumber ? `<small dir="ltr">${esc(m.phoneNumber)}</small>` : ''}</li>`).join('');
  const rules = RULES.map((r, i) => `<li><span>${i + 1}</span>${esc(r.ar)}</li>`).join('');
  const css = `<style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Readex Pro', Tahoma, sans-serif; color: #0f1b2d; background: #e9edf4; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; display: flex; flex-direction: column; }
    .top { position: relative; padding: 14mm 16mm 12mm; color: #fff; background: linear-gradient(150deg, #0b1729, #132846 55%, #1f3d63); overflow: hidden; }
    .top::before { content: ''; position: absolute; width: 90mm; height: 90mm; border-radius: 50%; background: rgba(238,35,41,.35); filter: blur(30mm); top: -40mm; left: -30mm; }
    .brand { position: relative; display: flex; align-items: center; justify-content: space-between; }
    .brand .logos { display: flex; gap: 4mm; }
    .brand .logos span { display: grid; place-items: center; width: 17mm; height: 17mm; border-radius: 5mm; background: #fff; }
    .brand .logos img { max-width: 13mm; max-height: 13mm; }
    .brand p { margin: 0; text-align: left; font-size: 10pt; opacity: .8; line-height: 1.6; }
    .hero { position: relative; display: flex; align-items: center; gap: 8mm; margin-top: 10mm; }
    .unit { display: grid; place-items: center; width: 42mm; height: 42mm; border-radius: 12mm; background: linear-gradient(135deg, #b3121a, #e0262c); box-shadow: 0 6mm 12mm -6mm rgba(238,35,41,.8); }
    .unit small { font-size: 11pt; opacity: .85; margin-top: 4mm; }
    .unit b { font-size: 50pt; line-height: 1; margin-top: -6mm; }
    .hero h1 { margin: 0; font-size: 24pt; }
    .hero p { margin: 2mm 0 0; font-size: 12pt; opacity: .85; }
    .hero .ref { display: inline-block; margin-top: 4mm; padding: 1.5mm 4mm; border-radius: 99px; background: rgba(255,255,255,.12); font-size: 10pt; letter-spacing: .5px; }
    .body { padding: 10mm 16mm 6mm; display: grid; gap: 6mm; flex: 1; }
    .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
    .fact { padding: 4mm 5mm; border-radius: 5mm; background: #f3f5fa; border: 1px solid #e5e9f1; }
    .fact small { display: block; color: #5f6c82; font-size: 9.5pt; }
    .fact b { display: block; margin-top: 1mm; font-size: 12.5pt; }
    h2 { margin: 0 0 3mm; font-size: 13pt; color: #1f3d63; display: flex; align-items: center; gap: 2mm; }
    h2::before { content: ''; width: 2mm; height: 6mm; border-radius: 2mm; background: #EE2329; }
    .team { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; }
    .team li { display: flex; align-items: center; gap: 3mm; padding: 3mm 4mm; border-radius: 4mm; border: 1px solid #e5e9f1; }
    .team .n { display: grid; place-items: center; width: 8mm; height: 8mm; border-radius: 2.5mm; background: #1f3d63; color: #fff; font-size: 10pt; }
    .team b { font-size: 12pt; }
    .team em { font-style: normal; font-size: 9pt; color: #c8161d; background: #fde8e9; padding: .5mm 2.5mm; border-radius: 99px; }
    .team small { margin-inline-start: auto; color: #5f6c82; font-size: 10pt; }
    .rules { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5mm 5mm; }
    .rules li { display: flex; gap: 2.5mm; font-size: 10.5pt; line-height: 1.6; }
    .rules span { display: grid; place-items: center; flex: none; width: 6mm; height: 6mm; border-radius: 2mm; background: #fde8e9; color: #c8161d; font-size: 9pt; font-weight: 700; }
    .foot { padding: 5mm 16mm; background: #f3f5fa; color: #5f6c82; font-size: 9.5pt; display: flex; justify-content: space-between; }
    .bar { position: fixed; top: 10px; left: 10px; } .bar button { padding: 10px 18px; border: 0; border-radius: 10px; background: #EE2329; color: #fff; font: 600 14px 'Readex Pro'; cursor: pointer; }
    @media print { body { background: #fff; } .bar { display: none; } .page { margin: 0; } }
  </style>`;
  const html = `${css}</head><body>
    <div class="bar"><button onclick="window.print()">طباعة اللوحة</button></div>
    <div class="page">
      <div class="top">
        <div class="brand">
          <div class="logos"><span><img src="${origin()}/fablab.png"></span><span><img src="${origin()}/found.png"></span></div>
          <p>فاب لاب الأحساء<br>مؤسسة عبدالمنعم الراشد الإنسانية</p>
        </div>
        <div class="hero">
          <div class="unit"><small>مساحة العمل</small><b>${esc(unitNo(req.unitCode))}</b></div>
          <div>
            <h1>${esc(req.projectName || 'مساحة عمل')}</h1>
            <p>${esc(req.organization || '')}</p>
            <span class="ref">${esc(req.requestNumber)}</span>
          </div>
        </div>
      </div>
      <div class="body">
        <div class="facts">
          <div class="fact"><small>من</small><b>${esc(fmtDate(req.startDate))}</b></div>
          <div class="fact"><small>إلى</small><b>${esc(fmtDate(req.endDate))}</b></div>
          <div class="fact"><small>الوقت اليومي</small><b>${esc(fmt12(req.startTime))} – ${esc(fmt12(req.endTime))}</b></div>
          <div class="fact"><small>أيام العمل</small><b>الأحد – الخميس</b></div>
          <div class="fact"><small>قائد الفريق</small><b>${esc(members[0]?.name || req.fullName)}</b></div>
          <div class="fact"><small>عدد الأفراد</small><b>${members.length || req.peopleCount}</b></div>
        </div>
        <section><h2>أعضاء الفريق</h2><ul class="team">${team}</ul></section>
        <section><h2>شروط وأحكام استخدام مساحة العمل</h2><ol class="rules">${rules}</ol></section>
      </div>
      <div class="foot"><span>فاب لاب الأحساء — نصنع المستقبل</span><span>${esc(req.requestNumber)}</span></div>
    </div>
  </body>`;
  return openPrint(`لوحة ${req.requestNumber}`, html);
}

// ---------- members' ID cards (4 per A4) ----------
export function printWorkspaceCards(request, cards, win = null) {
  const card = ({ member: m, qrDataUrl }, i) => `
    <div class="card">
      <div class="hd"><b>بطاقة عضو مساحة عمل</b><small>فاب لاب الأحساء</small></div>
      <div class="bd">
        <div class="av">${esc((m.name || '؟').trim().charAt(0))}</div>
        <h3>${esc(m.name)}</h3>
        <div class="tags"><span class="t1">${i === 0 ? 'قائد الفريق' : 'عضو الفريق'}</span><span class="t2">مساحة العمل ${esc(unitNo(request.unitCode))}</span></div>
        <div class="rows">
          ${m.nationalId ? `<div><small>رقم الهوية</small><b dir="ltr">${esc(m.nationalId)}</b></div>` : ''}
          <div><small>الفترة</small><b>${esc(request.startDate)} ← ${esc(request.endDate)}</b></div>
          <div><small>الوقت</small><b dir="ltr">${esc(request.startTime)}–${esc(request.endTime)}</b></div>
        </div>
        ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR">` : '<p class="noqr">لا يوجد رقم هوية</p>'}
      </div>
      <div class="ft"><img src="${origin()}/found.png"><span>رمز الحضور · ${esc(request.requestNumber)}</span><img src="${origin()}/fablab.png"></div>
    </div>`;
  const pages = [];
  for (let i = 0; i < cards.length; i += 4) pages.push(`<div class="page">${cards.slice(i, i + 4).map((c, k) => card(c, i + k)).join('')}</div>`);
  const css = `<style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Readex Pro', Tahoma, sans-serif; color: #0f1b2d; }
    .page { display: grid; grid-template-columns: repeat(2, 72mm); gap: 8mm 12mm; justify-content: center; padding-top: 4mm; }
    .page + .page { page-break-before: always; }
    .card { width: 72mm; height: 102mm; border: 1px dashed #b8c2d3; border-radius: 4mm; overflow: hidden; display: flex; flex-direction: column; }
    .hd { padding: 3mm 4mm; color: #fff; background: linear-gradient(150deg, #0b1729, #1f3d63); text-align: center; }
    .hd b { display: block; font-size: 10.5pt; } .hd small { font-size: 8pt; opacity: .8; }
    .bd { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 2.5mm 4mm 0; gap: 1.2mm; }
    .av { display: grid; place-items: center; width: 13mm; height: 13mm; border-radius: 4mm; background: linear-gradient(135deg, #b3121a, #e0262c); color: #fff; font-size: 15pt; font-weight: 700; }
    h3 { margin: 0; font-size: 11.5pt; text-align: center; line-height: 1.3; }
    .tags { display: flex; gap: 1.5mm; }
    .tags span { font-size: 7.5pt; padding: .4mm 2.2mm; border-radius: 99px; }
    .t1 { background: #fde8e9; color: #c8161d; } .t2 { background: #e5edf7; color: #1f3d63; }
    .rows { width: 100%; display: grid; gap: .6mm; margin-top: .5mm; }
    .rows div { display: flex; justify-content: space-between; font-size: 8pt; border-bottom: 1px solid #eef1f6; padding-bottom: .4mm; }
    .rows small { color: #5f6c82; }
    .qr { width: 24mm; height: 24mm; margin-top: 1mm; }
    .noqr { font-size: 8pt; color: #c8161d; }
    .ft { display: flex; align-items: center; justify-content: space-between; padding: 1.5mm 3mm; border-top: 1px solid #eef1f6; font-size: 7pt; color: #5f6c82; }
    .ft img { height: 6mm; }
    .bar { position: fixed; top: 10px; left: 10px; } .bar button { padding: 10px 18px; border: 0; border-radius: 10px; background: #EE2329; color: #fff; font: 600 14px 'Readex Pro'; cursor: pointer; }
    @media print { .bar { display: none; } }
  </style>`;
  return openPrint(`بطاقات ${request.requestNumber}`, `${css}</head><body><div class="bar"><button onclick="window.print()">طباعة البطاقات</button></div>${pages.join('')}</body>`, win);
}
