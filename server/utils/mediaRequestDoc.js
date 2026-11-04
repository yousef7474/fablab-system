// Printable media design request (طلب تصميم إعلان): the paper form
// «نموذج اعتماد طلب تصميم إعلان ( لقسم ، ورشة ، برامج )» filled from the
// request, the approved (or latest) design, the electronic sign-offs taken
// from the request's line, the remaining wet-signature lines, and the whole
// line as an appendix. Used by every role's «طباعة / PDF».
const {
  esc, has, multiline, fmtDate, fmtDateTime, humanSize, logo,
  MEDIA_MIN_IMAGES, MEDIA_SIGNERS, MEDIA_EXEC, normalizeMediaForm, mediaBody
} = require('./mediaFormDoc');

const fmtMediaNo = (n) => (n == null ? 'MR-—' : `MR-${String(n).padStart(3, '0')}`);

const STATUS_AR = {
  draft: 'مسودة',
  design: 'لدى فريق التصميم',
  employee_check: 'بانتظار مراجعة منفذ الطلب',
  pm_review: 'لدى مسؤول إدارة المشاريع',
  manager_review: 'لدى المدير للاعتماد',
  returned_employee: 'معاد لمنفذ الطلب للتعديل',
  approved: 'معتمد'
};

const ROLE_AR = { employee: 'منفذ الطلب', designer: 'فريق التصميم', pm: 'مسؤول إدارة المشاريع', manager: 'المدير' };

// What happened at each step (noun phrases, so they read for anyone).
const eventLabel = (e) => {
  switch (e.type) {
    case 'submitted': return 'إرسال الطلب لفريق التصميم';
    case 'resubmitted': return 'تعديل الطلب وإعادة إرساله لفريق التصميم';
    case 'design_delivered': return `تسليم التصميم — الإصدار ${e.designVersion}`;
    case 'employee_approved': return `اعتماد التصميم (الإصدار ${e.designVersion}) وإرساله لمسؤول إدارة المشاريع`;
    case 'employee_rejected': return `رفض التصميم (الإصدار ${e.designVersion}) وإعادته للمصمم`;
    case 'pm_approved': return 'اعتماد الطلب وإرساله للمدير';
    case 'manager_approved': return 'الاعتماد النهائي';
    case 'pm_returned':
    case 'manager_returned': return e.returnTo === 'employee' ? 'إعادة الطلب لمنفذ الطلب لتعديل بياناته' : 'إعادة الطلب للمصمم لتعديل التصميم';
    default: return e.type;
  }
};

const CSS = `
  *{box-sizing:border-box}
  body{margin:0;background:#eef1f5;color:#0f172a;font-family:'IBM Plex Sans Arabic','Segoe UI',Tahoma,sans-serif;font-size:13.5px;line-height:1.75}
  .page{max-width:860px;margin:0 auto;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.08);padding:0 0 26px}
  .head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 26px;border-bottom:3px solid #EE2329}
  .head img{height:44px}.head .meta{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#64748b;text-align:left;line-height:1.6}
  h1{margin:18px 26px 4px;font-size:21px;text-align:center}
  .sub{margin:0 26px 6px;text-align:center;color:#64748b;font-size:12.5px}
  .stamp{display:block;width:max-content;margin:6px auto 14px;padding:3px 14px;border-radius:999px;background:#fef2f2;color:#991b1b;font-weight:700;font-size:12px;border:1px solid #fecaca}
  .stamp.ok{background:#f0fdf4;color:#166534;border-color:#bbf7d0}
  .body{padding:0 26px}
  h2{display:flex;align-items:center;gap:10px;font-size:16.5px;margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid #EE2329}
  h2 .n{display:inline-grid;place-items:center;min-width:28px;height:28px;border-radius:8px;background:#EE2329;color:#fff;font-family:'JetBrains Mono',monospace;font-size:13px}
  h4{font-size:14px;margin:16px 0 6px;color:#7f1d1d}
  h4 small{font-weight:400;color:#64748b}
  table{width:100%;border-collapse:collapse;margin:0 0 6px}
  table.kv th{width:190px;text-align:start;vertical-align:top;background:#fdf2f2;color:#7f1d1d;font-weight:600;padding:7px 10px;border:1px solid #f1d5d5}
  table.kv td{padding:7px 10px;border:1px solid #eceff3;vertical-align:top}
  table.grid th{background:#1e293b;color:#fff;font-weight:600;font-size:12px;padding:6px 8px;text-align:start;border:1px solid #1e293b}
  table.grid td{padding:6px 8px;border:1px solid #e5e9f0;vertical-align:top;font-size:12.5px}
  table.grid tbody tr:nth-child(even) td{background:#f8fafc}
  td.code{font-family:'JetBrains Mono',monospace;font-weight:700;color:#b91c1c;white-space:nowrap}
  td.dt{white-space:nowrap;font-size:12px}
  small{color:#64748b}.nil{color:#94a3b8}
  ol.axes{margin:0;padding-inline-start:22px;display:grid;gap:6px}
  .imgs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
  .imgs figure{margin:0;border:1px solid #e5e9f0;border-radius:10px;overflow:hidden;break-inside:avoid}
  .imgs img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#f8fafc}
  .imgs figcaption{padding:5px 9px;font-size:12px}
  .noimg{aspect-ratio:4/3;display:grid;place-items:center;color:#94a3b8;background:#f8fafc}
  .design{display:grid;gap:12px}
  .design figure{margin:0;border:1px solid #e5e9f0;border-radius:12px;overflow:hidden;break-inside:avoid}
  .design img{display:block;width:100%;max-height:820px;object-fit:contain;background:#f8fafc}
  .design figcaption{padding:6px 12px;font-size:12px;color:#475569}
  .dmeta{padding:8px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e5e9f0;font-size:12.5px;margin-bottom:10px}
  .file{font-size:12.5px}
  .note{margin:14px 0 0;padding:9px 12px;border-radius:8px;background:#fff7ed;border-right:4px solid #f59e0b;color:#7c2d12;font-size:12.5px}
  .sigs{margin-top:10px;display:grid;gap:12px}
  .sig{border:1px solid #e5e9f0;border-radius:10px;padding:10px 14px;break-inside:avoid}
  .sig .row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:baseline}
  .sig .line{display:inline-block;min-width:170px;border-bottom:1px dotted #94a3b8;height:22px;vertical-align:bottom}
  .sig .e{color:#15803d;font-weight:700}
  .sig .w{color:#94a3b8}
  .sig .notes{margin-top:8px;color:#64748b}
  .sig .notes span{display:block;border-bottom:1px dotted #cbd5e1;height:24px}
  .sig .said{margin-top:6px;color:#334155;white-space:pre-wrap}
  .foot{margin:22px 26px 0;padding-top:10px;border-top:1px solid #e5e9f0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11.5px;color:#64748b}
  @media print{body{background:#fff}.page{box-shadow:none;max-width:none}table.grid th,table.kv th,.head,h2 .n,.stamp{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr,figure,.sig{break-inside:avoid}}
  @page{size:A4;margin:12mm}`;

/**
 * @param {object} o
 *   request — MediaRequest row (requestNumber, status, designVersion, …)
 *   data    — its data ({ form, source })
 *   author  — { name }
 *   events  — MediaRequestEvent rows, in order
 *   images  — { [fileId]: dataUrl } (form images + shown design images)
 *   files   — { [fileId]: { name, size, mime } }
 */
const renderMediaRequestDocument = ({ request, data, author, events = [], images = {}, files = {} }) => {
  const f = normalizeMediaForm(data?.form);
  const src = data?.source || {};
  const no = fmtMediaNo(request?.requestNumber);
  const status = request?.status || 'draft';
  const approved = status === 'approved';

  // The design shown: the current version (approved or latest delivered).
  const delivery = [...events].reverse().find(e => e.type === 'design_delivered' && e.designVersion === request?.designVersion);
  const designFiles = delivery?.files || [];
  const designImgs = designFiles.filter(x => images[x.fileId]);
  const designOther = designFiles.filter(x => !images[x.fileId]);
  const design = delivery ? `
    <div class="dmeta">الإصدار <b>${esc(delivery.designVersion)}</b> — سلّمه <b>${esc(delivery.actorName || 'فريق التصميم')}</b> · ${esc(fmtDateTime(delivery.createdAt))}${approved ? ' · <b style="color:#15803d">✓ التصميم المعتمد</b>' : ''}${has(delivery.note) ? `<div>${multiline(delivery.note)}</div>` : ''}</div>
    ${designImgs.length ? `<div class="design">${designImgs.map(x => `<figure><img src="${images[x.fileId]}" alt=""><figcaption>${esc(x.name)}</figcaption></figure>`).join('')}</div>` : ''}
    ${designOther.length ? `<h4>ملفات التصميم</h4>${designOther.map(x => `<div class="file">📎 ${esc(x.name)} <small>${(files[x.fileId] || x).size ? humanSize((files[x.fileId] || x).size) : ''}</small></div>`).join('')}` : ''}`
    : '<p class="nil">لم يُسلَّم تصميم بعد.</p>';

  // Electronic sign-offs from the line (latest of each after the current design).
  const after = (type) => [...events].reverse().find(e => e.type === type && e.designVersion === request?.designVersion);
  const empOk = after('employee_approved');
  const pmOk = after('pm_approved');
  const mgrOk = approved ? [...events].reverse().find(e => e.type === 'manager_approved') : null;
  const eSign = (e, what) => (e
    ? `<span class="e">✓ ${esc(what)} إلكترونيًا — ${esc(e.actorName || '')} · ${esc(fmtDate(e.createdAt))}</span>`
    : '<span class="w">بانتظار الاعتماد</span>');
  const sigBox = (role, name, electronic, said) => `<div class="sig"><div class="row"><span><b>${esc(role)}:</b> ${esc(name || '')}</span>${electronic != null ? electronic : 'التوقيع: <span class="line"></span>'}</div>${said ? `<div class="said">${multiline(said)}</div>` : ''}${electronic == null ? '<div class="notes">ملاحظة:<span></span><span></span></div>' : ''}</div>`;
  const [sPm, sMedia, sProjects] = MEDIA_SIGNERS;
  const signs = `
    ${sigBox(sPm.role, sPm.name, eSign(pmOk, 'اعتُمد'), pmOk?.note)}
    ${sigBox(sMedia.role, sMedia.name, delivery ? `<span class="e">✓ سُلّم التصميم (الإصدار ${esc(delivery.designVersion)}) — ${esc(delivery.actorName || '')} · ${esc(fmtDate(delivery.createdAt))}</span>` : '<span class="w">لم يُسلَّم التصميم بعد</span>')}
    ${sigBox(sProjects.role, sProjects.name, null)}
    ${sigBox('اعتماد المدير', '', eSign(mgrOk, 'اعتُمد'), mgrOk?.note)}
    <div class="sig"><div class="row"><span><b>توقيع منفذ الطلب:</b> ${esc(f.implementer || author?.name || '')} ${empOk ? eSign(empOk, 'اعتُمد التصميم') : '<span class="line"></span>'}</span><span><b>${esc(MEDIA_EXEC.role)}:</b> ${esc(MEDIA_EXEC.name)} <span class="line"></span></span></div></div>`;

  const timeline = events.length
    ? `<table class="grid"><thead><tr><th>#</th><th>التاريخ</th><th>الجهة</th><th>الإجراء</th><th>الملاحظة</th></tr></thead><tbody>${events.map(e => `<tr>
        <td class="code">${esc(e.seq)}</td>
        <td class="dt">${esc(fmtDateTime(e.createdAt))}</td>
        <td><b>${esc(ROLE_AR[e.actorRole] || e.actorRole)}</b><br><small>${esc(e.actorName || '')}</small></td>
        <td>${esc(eventLabel(e))}${(e.files || []).length ? `<br><small>${(e.files || []).map(x => `📎 ${esc(x.name)}`).join('، ')}</small>` : ''}</td>
        <td>${has(e.note) ? multiline(e.note) : '<span class="nil">—</span>'}</td></tr>`).join('')}</tbody></table>`
    : '<p class="nil">لم يُرسل الطلب بعد.</p>';

  const linked = [
    src.planId ? `الخطة التنفيذية ${esc(src.planNo || '')}${has(src.targetName) ? ` — المستهدف «${esc(src.targetName)}»` : ''}` : '',
    src.kitId ? `الحقيبة التدريبية ${esc(src.kitNo || '')}` : ''
  ].filter(Boolean).join(' · ');
  const fablab = logo('fablab.png'); const found = logo('found.png');
  const title = 'نموذج اعتماد طلب تصميم إعلان ( لقسم ، ورشة ، برامج )';

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(f.activity || 'طلب تصميم إعلان')} — ${no}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>${CSS}</style></head>
<body><div class="page">
  <header class="head"><div>${fablab ? `<img src="${fablab}" alt="FabLab">` : ''}${found ? ` <img src="${found}" alt="">` : ''}</div><div class="meta">${no}${request?.designVersion ? `<br>التصميم — الإصدار ${esc(request.designVersion)}` : ''}</div></header>
  <h1>${esc(title)}</h1>
  <p class="sub">${esc(f.activity || '')}${author?.name ? ` · منفذ الطلب: ${esc(author.name)}` : ''}${linked ? ` · ${linked}` : ''}</p>
  <span class="stamp ${approved ? 'ok' : ''}">${esc(STATUS_AR[status] || status)}</span>
  <div class="body">
    <h2><span class="n">1</span>بيانات الطلب</h2>
    ${mediaBody(f, images)}
    <p class="note">يُرجى إرفاق ${MEDIA_MIN_IMAGES} صور مناسبة للحقيبة التدريبية على الأقل، وإرسال الصور نفسها بشكل منفصل للاطلاع عليها واعتمادها قبل النشر.<br>ملحوظة: الرجاء إرسال التصميم للفريق التقني قبل النشر للمراجعة.</p>
    <h2><span class="n">2</span>${approved ? 'التصميم المعتمد' : 'التصميم الحالي'}</h2>
    ${design}
    <h2><span class="n">3</span>المراجعة والاعتماد</h2>
    <div class="sigs">${signs}</div>
    <h2><span class="n">4</span>مسار الطلب كاملًا</h2>
    ${timeline}
  </div>
  <div class="foot"><span>فاب لاب الأحساء — مؤسسة عبدالمنعم الراشد الإنسانية</span><span>${no}${request?.submittedAt ? ` · آخر إرسال ${esc(fmtDate(request.submittedAt))}` : ''}</span></div>
</div></body></html>`;
};

module.exports = { renderMediaRequestDocument, fmtMediaNo, STATUS_AR, eventLabel };
