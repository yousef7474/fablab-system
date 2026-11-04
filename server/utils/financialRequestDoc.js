// Printable financial request (طلب صرف مالي — «الملف المالي التفصيلي»):
// the costed breakdown of a programme — materials per project and
// section, staff, hospitality — its pricing, how it is funded, the
// electronic approvals, and blank space for the manager's wet signature,
// the stamp and the finance office. Used for the reviewers' view,
// printing and the ZIP, so it embeds the logos. Portrait A4.
//
// computeFinance() mirrors the client (Requests/finance/frModel.js) and
// the Excel it replaces (نموذج طلب صرف مالي لمشروع مع تفاصيل الطلب):
//   line      = qty × unit cost (+ 15% VAT when ticked)
//   staff     = count × (hourly × hours/day) × days (days default = programme days)
//   per person         = beneficiaries × unit
//   per person per day = beneficiaries × unit × programme days
//   cost      = projects + staff + hospitality & other
//   income    = cost × income rate; grand = cost + income
//   fee       = grand ÷ beneficiaries (before discount)
const fs = require('fs');
const path = require('path');

const VAT_RATE = 0.15;

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? '' : v).trim() !== '');
const num = (v) => (v === '' || v == null || !isFinite(+v) ? null : +v);
const multiline = (v) => esc(v).replace(/\n/g, '<br>');
const dash = (v) => (has(v) ? multiline(v) : '<span class="nil">—</span>');
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const NF2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const money = (n) => (n == null ? '—' : `${NF2.format(round2(n))} <small>ر.س</small>`);
// Table cells: the currency is in the column header (… ر.س).
const amt = (n) => (n == null ? '—' : NF2.format(round2(n)));
const plain = (n) => (n == null ? '—' : NF.format(n));
const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(String(d).length <= 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(x.getTime())) return String(d);
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(x);
};
const humanSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

const fmtReqNo = (n) => (n == null ? 'FR-—' : `FR-${String(n).padStart(3, '0')}`);

const BASIS = { person: 'لكل مستفيد', personDay: 'لكل مستفيد يوميًا', unit: 'بالعدد' };

/** All the numbers of a request — the same rules as the editor. */
const computeFinance = (data) => {
  const d = data || {};
  const h = d.header || {};
  const days = num(h.days) || 0;
  const ben = num(h.beneficiaries) || 0;

  const projects = (Array.isArray(d.projects) ? d.projects : []).map(p => {
    const items = (Array.isArray(p.items) ? p.items : []).map(x => {
      const base = (num(x.qty) || 0) * (num(x.unit) || 0);
      const vat = x.vat ? base * VAT_RATE : 0;
      return { ...x, base, vat, total: base + vat };
    });
    const bySection = [];
    items.forEach(x => {
      if (!has(x.item) && !x.total) return;
      const key = has(x.section) ? x.section : 'عام / أخرى';
      let s = bySection.find(y => y.section === key);
      if (!s) { s = { section: key, items: [], total: 0 }; bySection.push(s); }
      s.items.push(x);
      s.total += x.total;
    });
    const base = items.reduce((a, x) => a + x.base, 0);
    const vat = items.reduce((a, x) => a + x.vat, 0);
    return { ...p, items, sections: bySection, base, vat, total: base + vat };
  });
  const projectsTotal = projects.reduce((a, p) => a + p.total, 0);

  const staff = (Array.isArray(d.staff) ? d.staff : []).map(s => {
    const perDay = (num(s.rate) || 0) * (num(s.hours) || 0);
    const usedDays = has(s.days) ? (num(s.days) || 0) : days;
    return { ...s, perDay, usedDays, total: (num(s.count) || 0) * perDay * usedDays };
  });
  const staffTotal = staff.reduce((a, s) => a + s.total, 0);

  const hospitality = (Array.isArray(d.hospitality) ? d.hospitality : []).map(x => {
    const unit = num(x.unit) || 0;
    let count; let usedDays;
    if (x.basis === 'person') { count = ben; usedDays = 1; }
    else if (x.basis === 'personDay') { count = ben; usedDays = days; }
    else { count = num(x.count) || 0; usedDays = has(x.days) ? (num(x.days) || 0) : 1; }
    return { ...x, usedCount: count, usedDays, total: count * unit * usedDays };
  });
  const hospTotal = hospitality.reduce((a, x) => a + x.total, 0);

  const cost = projectsTotal + staffTotal + hospTotal;
  const pr = d.pricing || {};
  const incomeRate = has(pr.incomeRate) ? (num(pr.incomeRate) || 0) : 30;
  const income = cost * (incomeRate / 100);
  const grand = cost + income;
  const perBen = ben ? grand / ben : null;
  const fee = has(pr.fee) ? num(pr.fee) : null;
  const discountPct = fee != null && perBen ? (1 - fee / perBen) * 100 : null;
  const revenue = fee != null ? fee * ben : null;
  const amount = has(d.funding?.amount) ? (num(d.funding.amount) || 0) : cost;
  return { days, ben, projects, projectsTotal, staff, staffTotal, hospitality, hospTotal, cost, incomeRate, income, grand, perBen, fee, discountPct, revenue, amount };
};

const _logoCache = {};
const logo = (name) => {
  if (_logoCache[name] === undefined) {
    try {
      _logoCache[name] = `data:image/png;base64,${fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'public', name)).toString('base64')}`;
    } catch {
      _logoCache[name] = null;
    }
  }
  return _logoCache[name];
};

const STATUS_AR = {
  draft: 'مسودة',
  pm_review: 'لدى مسؤول إدارة المشاريع',
  manager_review: 'لدى المدير للاعتماد',
  returned: 'معاد للتعديل',
  approved: 'معتمد'
};

/**
 * @param {object} o
 *   req      — FinancialRequest row (requestNumber, status, …)
 *   version  — FinancialRequestVersion row being shown (or null for the draft)
 *   data     — request data to render
 *   author   — { name, section }
 *   files    — { [fileId]: { name, size } }
 */
const renderFinanceDocument = ({ req, version, data, author, files = {} }) => {
  const d = data || {};
  const h = d.header || {};
  const f = d.funding || {};
  const C = computeFinance(d);
  const v = version || {};

  const row = (label, value) => `<tr><th>${label}</th><td>${value}</td></tr>`;
  const table = (heads, rows, cls = '', foot = '') => `<table class="grid ${cls}"><thead><tr>${heads.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${heads.length}" class="nil">—</td></tr>`}</tbody>${foot}</table>`;

  const dates = has(h.startDate) || has(h.endDate)
    ? `${has(h.startDate) ? esc(fmtDate(h.startDate)) : '—'}${has(h.endDate) && h.endDate !== h.startDate ? ` — ${esc(fmtDate(h.endDate))}` : ''}`
    : dash('');
  const links = [
    has(h.planId) || has(h.planNo) ? `🗓 الخطة التنفيذية ${esc(h.planNo || '')}${has(h.targetName) ? ` — المستهدف «${esc(h.targetName)}»` : ''}` : '',
    has(h.kitId) || has(h.kitNo) ? `🎒 الحقيبة التدريبية ${esc(h.kitNo || '')}${has(h.kitTitle) ? ` «${esc(h.kitTitle)}»` : ''}` : ''
  ].filter(Boolean);

  const info = `<table class="kv">
    ${row('اسم البرنامج / النشاط', `<b>${dash(h.title)}</b>`)}
    ${row('نوع النشاط', dash(h.kind))}
    ${row('القسم', dash(h.section))}
    ${row('مقدم الطلب', esc(h.requester || author?.name || '—'))}
    ${row('تاريخ التنفيذ', dates)}
    ${row('عدد الأيام', C.days ? plain(C.days) : dash(''))}
    ${row('عدد المستفيدين', C.ben ? plain(C.ben) : dash(''))}
    ${links.length ? row('مرتبط بـ', links.join('<br>')) : ''}
  </table>`;

  // Materials: one table per project, rows grouped by section with a
  // subtotal per section (التكلفة الكلية لقسم …) and the project total.
  const projects = C.projects.filter(p => has(p.name) || p.items.some(x => has(x.item)));
  const projectBlock = (p, i) => {
    let k = 0;
    const rows = p.sections.flatMap(s => [
      ...s.items.map((x, j) => {
        k++;
        return `<tr>${j === 0 ? `<td class="sec" rowspan="${s.items.length}">${esc(s.section)}</td>` : ''}<td class="code">${k}</td><td>${dash(x.item)}${has(x.specs) ? `<div class="spec">${multiline(x.specs)}</div>` : ''}</td><td class="n">${plain(num(x.qty))}</td><td class="n">${amt(num(x.unit))}</td><td class="n">${amt(x.base)}</td><td class="n">${x.vat ? amt(x.vat) : '<span class="nil">—</span>'}</td><td class="n"><b>${amt(x.total)}</b></td><td>${dash(x.notes)}</td></tr>`;
      }),
      `<tr class="sub"><td colspan="7">التكلفة الكلية لقسم ${esc(s.section)}</td><td class="n">${amt(s.total)}</td><td></td></tr>`
    ]);
    const head = `<h3><span class="n">${i + 1}</span>${esc(p.name || 'مشروع بلا اسم')}</h3>`;
    if (!rows.length) return `<div class="proj">${head}<p class="nil">لا توجد بنود لهذا المشروع — إجمالي 0.00 ر.س</p></div>`;
    const foot = `<tfoot><tr><td colspan="5">إجمالي ميزانية المشروع (ر.س)</td><td class="n">${amt(p.base)}</td><td class="n">${p.vat ? amt(p.vat) : '—'}</td><td class="n">${amt(p.total)}</td><td></td></tr></tfoot>`;
    return `<div class="proj">${head}${table(['القسم', 'م', 'بند الاحتياج', 'العدد', 'تكلفة المفرد (ر.س)', 'الإجمالي (ر.س)', 'ض.ق.م 15٪', 'إجمالي التكلفة (ر.س)', 'ملاحظات'], rows, 'items', foot)}</div>`;
  };
  const materials = projects.length ? projects.map(projectBlock).join('') : '<p class="nil">لا توجد بنود احتياجات.</p>';

  const staffRows = C.staff.filter(s => (num(s.count) || 0) > 0);
  const staff = table(['البند', 'العدد', 'أجر الساعة (ر.س)', 'الساعات يوميًا', 'تكلفة اليوم للفرد (ر.س)', 'الأيام', 'التكلفة الإجمالية (ر.س)', 'ملاحظات'],
    staffRows.map(s => `<tr><td><b>${dash(s.role)}</b></td><td class="n">${plain(num(s.count))}</td><td class="n">${amt(num(s.rate))}</td><td class="n">${plain(num(s.hours))}</td><td class="n">${amt(s.perDay)}</td><td class="n">${plain(s.usedDays)}</td><td class="n"><b>${amt(s.total)}</b></td><td>${dash(s.notes)}</td></tr>`),
    'staff', staffRows.length ? `<tfoot><tr><td colspan="6">إجمالي الموارد البشرية (ر.س)</td><td class="n">${amt(C.staffTotal)}</td><td></td></tr></tfoot>` : '');

  const hospRows = C.hospitality.filter(x => x.total > 0 || (has(x.item) && !x.fixed));
  const hosp = table(['البند', 'أساس الحساب', 'العدد', 'التكلفة للفرد / للوحدة (ر.س)', 'الأيام', 'التكلفة الإجمالية (ر.س)', 'ملاحظات'],
    hospRows.map(x => `<tr><td><b>${dash(x.item)}</b></td><td>${esc(BASIS[x.basis] || BASIS.unit)}</td><td class="n">${plain(x.usedCount)}</td><td class="n">${amt(num(x.unit))}</td><td class="n">${plain(x.usedDays)}</td><td class="n"><b>${amt(x.total)}</b></td><td>${dash(x.notes)}</td></tr>`),
    'hosp', hospRows.length ? `<tfoot><tr><td colspan="5">إجمالي الضيافة والبنود الأخرى (ر.س)</td><td class="n">${amt(C.hospTotal)}</td><td></td></tr></tfoot>` : '');

  const summary = `<table class="sum">
    <tr><th>المشاريع (المواد والاحتياجات)${projects.length ? ` <small>— ${projects.length} ${projects.length === 1 ? 'مشروع' : projects.length === 2 ? 'مشروعان' : 'مشاريع'}</small>` : ''}</th><td>${money(C.projectsTotal)}</td></tr>
    <tr><th>الموارد البشرية</th><td>${money(C.staffTotal)}</td></tr>
    <tr><th>الضيافة والبنود الأخرى</th><td>${money(C.hospTotal)}</td></tr>
    <tr class="tot"><th>المجموع — تكلفة البرنامج</th><td>${money(C.cost)}</td></tr>
    <tr><th>نسبة الدخل <small>(${plain(C.incomeRate)}٪)</small></th><td>${money(C.income)}</td></tr>
    <tr class="tot"><th>المجموع الكلي</th><td>${money(C.grand)}</td></tr>
    <tr><th>عدد المستفيدين</th><td>${C.ben ? plain(C.ben) : '—'}</td></tr>
    <tr><th>قيمة تسجيل المستفيد قبل الخصم</th><td>${C.perBen != null ? money(C.perBen) : '—'}</td></tr>
    <tr><th>قيمة تسجيل المستفيد بعد الخصم <small>(المقترحة)</small></th><td>${C.fee != null ? `${money(C.fee)}${C.discountPct != null && C.discountPct > 0.005 ? ` <small>— خصم ${NF.format(round2(C.discountPct))}٪</small>` : ''}` : '—'}</td></tr>
    <tr><th>الإيراد المتوقع من التسجيل</th><td>${C.revenue != null ? money(C.revenue) : '—'}</td></tr>
  </table>
  <div class="amount"><span>المبلغ المطلوب صرفه</span><b>${money(C.amount)}</b>${has(f.amount) && round2(C.amount) !== round2(C.cost) ? '<small>حدده مقدم الطلب — يختلف عن تكلفة البرنامج</small>' : ''}</div>`;

  const method = f.method === 'أخرى' && has(f.methodOther) ? `أخرى — ${esc(f.methodOther)}` : dash(f.method);
  const source = f.source === 'أخرى' && has(f.sourceOther) ? `أخرى — ${esc(f.sourceOther)}` : dash(f.source);
  const quotes = (d.quotes || []).map(q => {
    const meta = files[q.fileId] || q;
    return `<div class="file">📎 ${esc(meta.name || q.name)} <small>${meta.size ? humanSize(meta.size) : ''}</small></div>`;
  }).join('');
  const funding = `<table class="kv">
    ${row('مصدر التمويل', source)}
    ${row('بند الميزانية / مركز التكلفة', dash(f.budgetLine))}
    ${row('طريقة الصرف', method)}
    ${row('المستفيد من الصرف (المورد / المستلم)', dash(f.payee))}
    ${has(f.bank) || has(f.iban) ? row('البنك ورقم الآيبان', `${dash(f.bank)}${has(f.iban) ? ` — <span class="mono" dir="ltr">${esc(f.iban)}</span>` : ''}`) : ''}
    ${row('تاريخ الحاجة للصرف', has(f.neededBy) ? esc(fmtDate(f.neededBy)) : dash(''))}
    ${row('مبررات الطلب', dash(f.justification))}
    ${row('عروض الأسعار والمستندات', quotes || '<span class="nil">لا توجد مرفقات</span>')}
    ${has(d.notes) ? row('ملاحظات', multiline(d.notes)) : ''}
  </table>`;

  const sig = (name, at, decision) => (decision === 'approved'
    ? `<td>${esc(name || '—')}</td><td>${esc(fmtDate(at))}</td><td class="ok">✓ معتمد إلكترونيًا</td>`
    : `<td class="nil">—</td><td class="nil">—</td><td class="nil">${decision === 'returned' ? 'أُعيد للتعديل' : 'بانتظار المراجعة'}</td>`);
  const approvals = table(['الإجراء', 'الاسم', 'التاريخ', 'الاعتماد'], [
    `<tr><td><b>تقديم الطلب</b> <small>(مقدم الطلب)</small></td><td>${esc(h.requester || author?.name || '—')}</td><td>${version?.submittedAt ? esc(fmtDate(version.submittedAt)) : '<span class="nil">لم يُرسل بعد</span>'}</td><td>${version ? `الإصدار ${version.versionNumber}` : '<span class="nil">مسودة</span>'}</td></tr>`,
    `<tr><td><b>المراجعة</b> <small>(مسؤول إدارة المشاريع)</small></td>${sig(v.pmName, v.pmAt, v.pmDecision)}</tr>`,
    `<tr><td><b>الاعتماد النهائي</b> <small>(المدير)</small></td>${sig(v.managerName, v.managerAt, v.managerDecision)}</tr>`
  ]);

  const fablab = logo('fablab.png'); const found = logo('found.png');
  const statusText = version
    ? (v.managerDecision === 'approved' ? 'معتمد' : v.managerDecision === 'returned' || v.pmDecision === 'returned' ? 'أُعيد للتعديل' : v.pmDecision === 'approved' ? 'لدى المدير للاعتماد' : 'لدى مسؤول إدارة المشاريع')
    : (STATUS_AR[req?.status] || 'مسودة');
  const chips = [h.kind, h.section, C.days ? `${plain(C.days)} ${C.days === 1 ? 'يوم' : C.days === 2 ? 'يومان' : C.days <= 10 ? 'أيام' : 'يومًا'}` : '', C.ben ? `${plain(C.ben)} مستفيد` : ''].filter(Boolean);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>طلب صرف مالي${has(h.title) ? ` — ${esc(h.title)}` : ''} — ${fmtReqNo(req?.requestNumber)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#eef1f5;color:#0f172a;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;font-size:12.5px;line-height:1.6}
  .page{max-width:980px;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.08)}
  .band{background:linear-gradient(135deg,#1a0a0b,#3a0d10 60%,#EE2329);color:#fff;padding:20px 26px 22px;position:relative;overflow:hidden}
  .band::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:24px 24px;pointer-events:none}
  .band .top{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
  .band .logos{display:flex;gap:14px;align-items:center}.band .logos img{height:38px;filter:brightness(0) invert(1)}
  .band .meta{font-family:'JetBrains Mono',monospace;font-size:12px;text-align:left;opacity:.9;line-height:1.6}
  .band .kicker{position:relative;margin:14px 0 0;font-size:13px;opacity:.85;font-weight:600}
  .band h1{position:relative;margin:2px 0 6px;font-size:25px;line-height:1.3}
  .band ul{position:relative;list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
  .band li{font-size:12px;padding:2px 10px;border:1px solid rgba(255,255,255,.3);border-radius:6px;background:rgba(255,255,255,.06)}
  .band .total{position:absolute;inset-inline-start:auto;left:26px;bottom:20px;text-align:left}
  .band .total span{display:block;font-size:11.5px;opacity:.8}.band .total b{font-family:'JetBrains Mono',monospace;font-size:22px}.band .total small{color:#fff;opacity:.8}
  .stamp{position:relative;display:inline-block;margin-top:12px;padding:3px 12px;border-radius:999px;background:#fff;color:#b91c1c;font-weight:700;font-size:12px}
  .body{padding:6px 26px 24px}
  .sec{margin-top:18px}
  h2{display:flex;align-items:center;gap:10px;font-size:16.5px;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #EE2329;break-after:avoid}
  h2 .n{display:inline-grid;place-items:center;min-width:28px;height:28px;border-radius:8px;background:#EE2329;color:#fff;font-family:'JetBrains Mono',monospace;font-size:13px}
  .proj{margin-top:12px;break-inside:auto}
  .proj h3{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:14px;color:#7f1d1d;break-after:avoid}
  .proj h3 .n{display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:7px;background:#1e293b;color:#fff;font-family:'JetBrains Mono',monospace;font-size:12px}
  table{width:100%;border-collapse:collapse;margin:0 0 6px}
  table.kv th{width:210px;text-align:start;vertical-align:top;background:#fdf2f2;color:#7f1d1d;font-weight:600;padding:6px 10px;border:1px solid #f1d5d5}
  table.kv td{padding:6px 10px;border:1px solid #eceff3;vertical-align:top}
  table.grid th{background:#1e293b;color:#fff;font-weight:600;font-size:11.5px;padding:6px 7px;text-align:start;border:1px solid #1e293b}
  table.grid td{padding:5px 7px;border:1px solid #e5e9f0;vertical-align:top}
  table.grid tbody tr:nth-child(even) td{background:#f8fafc}
  table.grid td.sec{background:#fdf2f2 !important;color:#7f1d1d;font-weight:700;vertical-align:middle;width:92px}
  table.grid tr.sub td{background:#f1f5f9 !important;font-weight:700;color:#334155}
  table.grid tfoot td{background:#fee2e2;color:#7f1d1d;font-weight:800;padding:6px 7px;border:1px solid #fecaca}
  td.n{text-align:left;direction:ltr;white-space:nowrap;font-family:'JetBrains Mono',monospace;font-size:11.5px}
  td.n small,td small{font-family:'IBM Plex Sans Arabic',sans-serif}
  td.code{font-family:'JetBrains Mono',monospace;font-weight:700;color:#b91c1c;white-space:nowrap;width:28px}
  td.ok{color:#15803d;font-weight:700}
  .spec{color:#64748b;font-size:11.5px}
  small{color:#64748b}
  .nil{color:#94a3b8}
  .mono{font-family:'JetBrains Mono',monospace}
  table.sum{max-width:620px}
  table.sum th{text-align:start;font-weight:600;padding:6px 10px;border:1px solid #e5e9f0;background:#f8fafc;color:#334155}
  table.sum td{text-align:left;direction:ltr;padding:6px 10px;border:1px solid #e5e9f0;font-family:'JetBrains Mono',monospace;white-space:nowrap;width:220px}
  table.sum tr.tot th,table.sum tr.tot td{background:#fdf2f2;color:#7f1d1d;font-weight:800}
  .amount{display:flex;align-items:baseline;flex-wrap:wrap;gap:12px;max-width:620px;margin-top:8px;padding:10px 14px;border-radius:10px;border:2px solid #EE2329;background:#fff5f5}
  .amount span{font-weight:800;color:#7f1d1d}.amount b{font-family:'JetBrains Mono',monospace;font-size:19px;color:#b91c1c}.amount small{flex-basis:100%}
  .file{font-size:12px}
  .signs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px;break-inside:avoid}
  .box{border:1.5px solid #334155;border-radius:10px;padding:10px 12px;min-height:118px;display:flex;flex-direction:column}
  .box b{font-size:12.5px}.box small{display:block}
  .box .line{margin-top:auto;border-top:1px dashed #94a3b8;padding-top:4px;font-size:11px;color:#64748b}
  .fin{margin-top:12px;border:1.5px solid #334155;border-radius:10px;padding:10px 14px;break-inside:avoid}
  .fin h4{margin:0 0 8px;font-size:13.5px}
  .fin .grid4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 26px}
  .fin .fld{display:flex;align-items:flex-end;gap:8px;font-size:12px;color:#334155}
  .fin .fld span{white-space:nowrap;font-weight:600}.fin .fld i{flex:1;border-bottom:1px dotted #64748b;height:18px}
  .foot{margin-top:22px;padding-top:10px;border-top:1px solid #e5e9f0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11.5px;color:#64748b}
  @media (max-width:760px){.signs{grid-template-columns:minmax(0,1fr)}.band .total{position:relative;left:auto;bottom:auto;margin-top:10px;text-align:right}}
  @media print{body{background:#fff}.page{box-shadow:none;max-width:none}.band,table.grid th,table.grid tfoot td,table.grid td.sec,table.grid tr.sub td,h2 .n,.proj h3 .n,table.kv th,table.sum tr.tot th,table.sum tr.tot td,.amount{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}}
  @page{size:A4;margin:10mm}
</style></head>
<body><div class="page">
  <header class="band">
    <div class="top">
      <div class="logos">${fablab ? `<img src="${fablab}" alt="FabLab">` : ''}${found ? `<img src="${found}" alt="">` : ''}</div>
      <div class="meta">${fmtReqNo(req?.requestNumber)}<br>${version ? `الإصدار ${version.versionNumber}` : 'مسودة'}${version?.submittedAt ? ` · ${esc(fmtDate(version.submittedAt))}` : ''}</div>
    </div>
    <p class="kicker">طلب صرف مالي — الملف المالي التفصيلي</p>
    <h1>${esc(h.title || 'برنامج بلا اسم')}</h1>
    ${chips.length ? `<ul>${chips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <span class="stamp">${esc(statusText)}${author?.name ? ` · مقدم الطلب: ${esc(author.name)}` : ''}</span>
    <div class="total"><span>المبلغ المطلوب صرفه</span><b>${NF2.format(round2(C.amount))}</b> <small>ر.س</small></div>
  </header>
  <div class="body">
    <section class="sec"><h2><span class="n">1</span>بيانات الطلب</h2>${info}</section>
    <section class="sec"><h2><span class="n">2</span>الاحتياجات لكل مشروع</h2>${materials}</section>
    <section class="sec"><h2><span class="n">3</span>الموارد البشرية</h2>${staff}</section>
    <section class="sec"><h2><span class="n">4</span>الضيافة والبنود الأخرى</h2>${hosp}</section>
    <section class="sec"><h2><span class="n">5</span>التكلفة الإجمالية والتسعير</h2>${summary}</section>
    <section class="sec"><h2><span class="n">6</span>التمويل والصرف</h2>${funding}</section>
    <section class="sec"><h2><span class="n">7</span>الاعتماد</h2>${approvals}
      <div class="signs">
        <div class="box"><b>توقيع المدير</b><small>${v.managerDecision === 'approved' ? `${esc(v.managerName || '')} — اعتُمد إلكترونيًا ${esc(fmtDate(v.managerAt))}` : 'الاسم:'}</small><div class="line">التوقيع</div></div>
        <div class="box"><b>الختم</b><small>&nbsp;</small><div class="line">ختم الجهة</div></div>
        <div class="box"><b>التاريخ</b><small>&nbsp;</small><div class="line">/ / 20</div></div>
      </div>
      <div class="fin">
        <h4>للاستخدام المالي</h4>
        <div class="grid4">
          <div class="fld"><span>رقم سند الصرف:</span><i></i></div>
          <div class="fld"><span>تاريخ الصرف:</span><i></i></div>
          <div class="fld"><span>المبلغ المصروف:</span><i></i></div>
          <div class="fld"><span>توقيع المحاسب:</span><i></i></div>
        </div>
      </div>
    </section>
    <div class="foot"><span>فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية</span><span>${fmtReqNo(req?.requestNumber)} · طلب صرف مالي</span></div>
  </div>
</div></body></html>`;
};

module.exports = { renderFinanceDocument, computeFinance, fmtReqNo, VAT_RATE };
