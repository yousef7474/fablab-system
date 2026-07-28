import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Cooperation / Technical-Trainer contract ("عقد تعاوني — مدرب تقني").
// Renders on the same receipt-bg.png letterhead used by the سند so
// printed docs look like they came from the same office. Everything
// the admin needs to fill lives in this modal; the print output is
// signature-ready (only handwritten signatures + date remain).

const DEFAULT_TERMS = [
  'الالتزام بالحضور والانصراف طوال فترة البرنامج.',
  'أداء كافة المهام الموكلة بالشكل المتفق عليه.',
  'المشاركة في أعمال الإقفال والترتيب بعد البرنامج ضمن المدة المحددة.',
  'عدم الانقطاع أو الانسحاب قبل انتهاء كامل الفترة.'
];

const DEFAULT_PROVISIONS = [
  'هذا العقد لا يُعد عقد توظيف دائم ولا يترتب عليه أي التزامات وظيفية مستقبلية.',
  'في حال حدوث أي خلاف، يسعى الطرفان لحله وديًا، وفي حال تعذر ذلك يتم اللجوء للجهات المختصة.',
  'يعتبر هذا العقد مُلزِمًا للطرفين بمجرد التوقيع عليه.'
];

const emptyForm = () => {
  const today = new Date();
  return {
    programName: '',
    contractDay: String(today.getDate()).padStart(2, '0'),
    contractMonth: String(today.getMonth() + 1).padStart(2, '0'),
    contractYear: String(today.getFullYear()),
    party1Entity: 'فاب لاب الأحساء',
    party1Representative: 'أ. زكي اللويم',
    trainerName: '',
    trainerNationality: 'سعودي',
    trainerNationalId: '',
    trainerIban: '',
    trainerRole: '',
    benefits: ['', '', '', ''],
    startDate: '',
    endDate: '',
    closingDays: '3',
    tasks: ['', '', '', '', ''],
    compensationAmount: ''
  };
};

const fmtDate = (d) => {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn');
  } catch { return String(d); }
};

const TechnicalTrainerContractModal = ({ open, onClose }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (open) setForm(emptyForm());
  }, [open]);

  if (!open) return null;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setArrItem = (k, i, v) => setForm(f => {
    const next = [...f[k]];
    next[i] = v;
    return { ...f, [k]: next };
  });
  const addArrItem = (k) => setForm(f => ({ ...f, [k]: [...f[k], ''] }));
  const removeArrItem = (k, i) => setForm(f => ({ ...f, [k]: f[k].filter((_, idx) => idx !== i) }));

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة العقد');
      return;
    }
    const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

    const cleanBenefits = form.benefits.map(b => b.trim()).filter(Boolean);
    const cleanTasks = form.tasks.map(t => t.trim()).filter(Boolean);

    const benefitsHtml = cleanBenefits.length
      ? cleanBenefits.map(b => `<li>${safe(b)}</li>`).join('')
      : '<li class="empty">—</li>';
    const tasksHtml = cleanTasks.length
      ? cleanTasks.map((t, i) => `<li><span class="num">${i + 1}.</span> ${safe(t)}</li>`).join('')
      : '<li class="empty">—</li>';
    const termsHtml = DEFAULT_TERMS.map(t => `<li>${safe(t)}</li>`).join('');
    const provisionsHtml = DEFAULT_PROVISIONS
      .map((t, i) => `<li><span class="num">${i + 1}.</span> ${safe(t)}</li>`).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>عقد تعاوني — مدرب تقني</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; }

  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    page-break-after: always;
    background-image: url('${window.location.origin}/receipt-bg.png');
    background-size: 100% 100%;
    background-repeat: no-repeat;
  }
  .page:last-child { page-break-after: auto; }

  /* Content is bounded on all four sides so it never lands on the
     letterhead's printed header or footer artwork. bottom:16% reserves
     ~47mm above the footer decoration — enough clearance even when a
     page's final section is a table or long list. */
  .content {
    position: absolute;
    top: 16%;
    bottom: 16%;
    left: 14mm;
    right: 14mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .doc-title {
    text-align: center;
    font-size: 20pt;
    font-weight: 800;
    letter-spacing: 3px;
    color: #0f172a;
    margin: 0 0 1.5mm 0;
  }
  .doc-sub {
    text-align: center;
    font-size: 11pt;
    color: #475569;
    margin: 0 0 4mm 0;
    font-weight: 600;
    letter-spacing: 1px;
  }

  .section-heading {
    background: rgba(15, 23, 42, 0.06);
    color: #0f172a;
    padding: 1.2mm 4mm;
    font-size: 10.5pt;
    font-weight: 800;
    border-right: 3px solid #475569;
    margin: 2mm 0 1.5mm 0;
    letter-spacing: 1px;
  }
  .section-heading:first-of-type { margin-top: 0; }

  .info-table {
    width: 100%;
    border-collapse: collapse;
  }
  .info-table th, .info-table td {
    border: 1px solid #475569;
    padding: 1.2mm 3mm;
    font-size: 9.5pt;
    vertical-align: middle;
  }
  .info-table th {
    background: rgba(241, 245, 249, 0.8);
    width: 30%;
    font-weight: 700;
    text-align: right;
    color: #0f172a;
  }
  .info-table td {
    background: rgba(255, 255, 255, 0.72);
    font-weight: 600;
    color: #111827;
  }

  .prose {
    font-size: 9.5pt;
    line-height: 1.55;
    color: #1f2937;
    margin: 1.5mm 0 0 0;
    text-align: justify;
  }

  .caption {
    text-align: center;
    font-style: italic;
    color: #475569;
    font-size: 9pt;
    margin-top: 1mm;
  }

  .list {
    margin: 1.5mm 0 0 0;
    padding: 0 3mm;
    list-style: none;
  }
  .list li {
    font-size: 9.5pt;
    line-height: 1.45;
    color: #1f2937;
    padding: 0.8mm 0;
    border-bottom: 1px dashed rgba(71, 85, 105, 0.3);
    position: relative;
    padding-right: 5mm;
  }
  .list li:last-child { border-bottom: none; }
  .list li::before {
    content: '•';
    position: absolute;
    right: 0;
    color: #0f172a;
    font-weight: 900;
  }
  .list li .num {
    color: #0f172a;
    font-weight: 800;
    margin-left: 2mm;
  }
  .list li.empty {
    color: #94a3b8;
    font-style: italic;
  }
  .list.numbered li::before { content: none; padding-right: 0; }

  .amount-highlight {
    display: inline-block;
    margin-right: 3mm;
    padding: 1.2mm 5mm;
    background: rgba(15, 23, 42, 0.06);
    border: 1.5px solid #475569;
    border-radius: 2mm;
    font-size: 12pt;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: 1px;
  }

  .signers-row {
    margin-top: auto;
    display: flex;
    gap: 6mm;
    justify-content: space-between;
    padding-top: 3mm;
    border-top: 1.5px dashed #475569;
  }
  .signer {
    flex: 1;
    text-align: center;
    font-size: 10pt;
  }
  .signer .signer-title {
    color: #475569;
    font-weight: 700;
    margin-bottom: 1.5mm;
    letter-spacing: 1px;
  }
  .signer .line-row {
    display: flex; align-items: center; gap: 3mm;
    margin: 1.5mm 0;
    justify-content: center;
    font-weight: 700;
    color: #0f172a;
  }
  .signer .line-row .label { min-width: 18mm; text-align: right; }
  .signer .line-row .line {
    flex: 1; border-bottom: 1.5px solid #1f2937;
    min-height: 4mm; max-width: 48mm;
  }
  .signer .name-inline {
    padding: 0 3mm;
    font-weight: 800;
    color: #0f172a;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <!-- Page 1: title + program + date + parties -->
  <div class="page">
    <div class="content">
      <div class="doc-title">عقد تعاوني</div>
      <div class="doc-sub">مدرب تقني — برنامج تدريبي</div>

      <div class="section-heading">اسم البرنامج التدريبي</div>
      <table class="info-table">
        <tr><td colspan="2" style="font-size:11pt; font-weight:800; text-align:center; color:#0f172a">
          ${safe(form.programName) || '—'}
        </td></tr>
      </table>

      <div class="prose">
        تم بعون الله تعالى في هذا اليوم الموافق
        <strong>${safe(form.contractDay)}/${safe(form.contractMonth)}/${safe(form.contractYear)} م</strong>،
        إبرام هذا العقد بين كل من:
      </div>

      <div class="section-heading">الطرف الأول</div>
      <table class="info-table">
        <tr>
          <th>الجهة / الشخص المشرف على البرنامج التدريبي</th>
          <td>${safe(form.party1Entity) || '—'}</td>
        </tr>
        <tr>
          <th>يمثله / تمثله</th>
          <td>${safe(form.party1Representative) || '—'}</td>
        </tr>
      </table>
      <div class="caption">(ويُشار إليه فيما بعد بـ"الطرف الأول")</div>

      <div class="section-heading">الطرف الثاني</div>
      <table class="info-table">
        <tr>
          <th>الاسم</th>
          <td>${safe(form.trainerName) || '—'}</td>
        </tr>
        <tr>
          <th>الجنسية</th>
          <td>${safe(form.trainerNationality) || '—'}</td>
        </tr>
        <tr>
          <th>رقم الهوية / الإقامة</th>
          <td dir="ltr" style="text-align:right">${safe(form.trainerNationalId) || '—'}</td>
        </tr>
        <tr>
          <th>رقم الآيبان للحساب البنكي</th>
          <td dir="ltr" style="text-align:right">${safe(form.trainerIban) || '—'}</td>
        </tr>
      </table>
      <div class="caption">(ويُشار إليه فيما بعد بـ"الطرف الثاني")</div>
    </div>
  </div>

  <!-- Page 2: subject + benefits + duration -->
  <div class="page">
    <div class="content">
      <div class="section-heading">أولاً: موضوع العقد</div>
      <div class="prose">
        يقر الطرف الثاني بالعمل ضمن فريق التدريب، بوظيفة
        <strong>(${safe(form.trainerRole) || '—'})</strong>،
        وذلك خلال البرنامج التدريبي المشار إليه أعلاه، والمنفذ من قبل الطرف الأول.
      </div>

      <div class="section-heading">المزايا</div>
      <ul class="list">${benefitsHtml}</ul>

      <div class="section-heading">ثانيًا: مدة العقد</div>
      <table class="info-table">
        <tr>
          <th>تبدأ مدة هذا العقد من تاريخ</th>
          <td>${safe(fmtDate(form.startDate)) || '—'}</td>
        </tr>
        <tr>
          <th>وتنتهي في تاريخ</th>
          <td>${safe(fmtDate(form.endDate)) || '—'}</td>
        </tr>
      </table>
      <div class="prose">
        وتشمل هذه المدة فترة تنفيذ البرنامج، بالإضافة إلى
        <strong>(${safe(form.closingDays || '—')})</strong> أيام بعد ختام البرنامج،
        مخصصة لأعمال الإقفال والترتيب والتوثيق.
        وتُعد هذه الفترة غير قابلة للتمديد إلا باتفاق كتابي جديد بين الطرفين.
      </div>
    </div>
  </div>

  <!-- Page 3: tasks + general conditions + compensation -->
  <div class="page">
    <div class="content">
      <div class="section-heading">ثالثًا: المهام والمسؤوليات — مهام المدرب التقني</div>
      <ol class="list numbered">${tasksHtml}</ol>

      <div class="section-heading">رابعًا: الشروط العامة</div>
      <div class="prose">يشترط لاستحقاق الطرف الثاني للمكافأة ما يلي:</div>
      <ul class="list">${termsHtml}</ul>
      <div class="prose">
        وفي حال الإخلال بأي من الشروط المذكورة، للطرف الأول الحق في إلغاء أو تخفيض المكافأة.
      </div>

      <div class="section-heading">خامسًا: المميزات والمكافأة</div>
      <div class="prose">
        قيمة المكافأة المالية الإجمالية:
        <span class="amount-highlight">${safe(form.compensationAmount || '—')} ريال سعودي</span>
      </div>
      <div class="prose">
        تُصرف المكافأة المالية بعد انتهاء فترة التعاقد واستكمال المهام،
        خلال مدة لا تتجاوز <strong>(30)</strong> يوم عمل من تاريخ الانتهاء،
        وذلك وفق الإجراءات المالية والإدارية المتبعة لدى الطرف الأول.
      </div>
    </div>
  </div>

  <!-- Page 4: entitlement + provisions + acknowledgment + signatures -->
  <div class="page">
    <div class="content">
      <div class="section-heading">سادسًا: شرط الاستحقاق</div>
      <div class="prose">يشترط لاستحقاق الطرف الثاني للمكافأة ما يلي:</div>
      <ul class="list">${termsHtml}</ul>
      <div class="prose">
        وفي حال الإخلال بأي من الشروط المذكورة، للطرف الأول الحق في إلغاء أو تخفيض المكافأة.
      </div>

      <div class="section-heading">سابعًا: أحكام عامة</div>
      <ol class="list numbered">${provisionsHtml}</ol>

      <div class="section-heading">ثامنًا: الإقرار والتوقيع</div>
      <div class="prose">
        يقر الطرفان بكامل أهليتهما، وبأنهما قرآ ووافقا على جميع البنود، وتم التوقيع عليه طوعًا.
      </div>

      <div class="signers-row">
        <div class="signer">
          <div class="signer-title">توقيع الطرف الثاني</div>
          <div class="line-row"><span class="label">الاسم</span><span class="name-inline">${safe(form.trainerName)}</span><span class="line"></span></div>
          <div class="line-row"><span class="label">التوقيع</span><span class="line"></span></div>
        </div>
        <div class="signer">
          <div class="signer-title">توقيع الطرف الأول</div>
          <div class="line-row"><span class="label">الاسم</span><span class="name-inline">${safe(form.party1Representative)}</span><span class="line"></span></div>
          <div class="line-row"><span class="label">التوقيع</span><span class="line"></span></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const bg = new Image();
    bg.src = '${window.location.origin}/receipt-bg.png';
    bg.onload = bg.onerror = () => { setTimeout(() => window.print(), 300); };
  </script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // ── Form UI ──────────────────────────────────────────────────────────
  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 6,
    border: '1.5px solid #cbd5e1', fontSize: 13.5, fontFamily: 'inherit'
  };
  const labelStyle = { display: 'block', fontWeight: 700, marginBottom: 5, color: '#334155', fontSize: 13 };
  const sectionTitle = {
    fontSize: 12, fontWeight: 800, color: '#0f172a', letterSpacing: 1,
    margin: '10px 0 12px', paddingBottom: 6, borderBottom: '2px solid #cbd5e1', textTransform: 'uppercase'
  };
  const arrItemStyle = {
    display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 8, alignItems: 'center', marginBottom: 6
  };
  const smallBtn = {
    padding: '5px 10px', borderRadius: 5, border: '1.5px solid #cbd5e1',
    background: '#fff', color: '#334155', fontWeight: 700, fontSize: 12, cursor: 'pointer'
  };
  const addBtnStyle = {
    marginTop: 4, padding: '7px 14px', borderRadius: 6,
    border: '1.5px dashed #0ea5e9', background: 'rgba(14,165,233,0.06)',
    color: '#0284c7', fontWeight: 700, cursor: 'pointer', fontSize: 12.5
  };

  const renderArray = (key, labelAr, labelEn) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{isRTL ? labelAr : labelEn}</label>
      {form[key].map((v, i) => (
        <div key={i} style={arrItemStyle}>
          <div style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>{i + 1}</div>
          <input
            type="text"
            value={v}
            onChange={(e) => setArrItem(key, i, e.target.value)}
            style={fieldStyle}
          />
          <button
            onClick={() => removeArrItem(key, i)}
            style={smallBtn}
            title={isRTL ? 'حذف' : 'Remove'}
            disabled={form[key].length <= 1}
          >
            ×
          </button>
        </div>
      ))}
      <button onClick={() => addArrItem(key)} style={addBtnStyle}>
        + {isRTL ? 'إضافة بند' : 'Add item'}
      </button>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modern-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header" style={{ borderBottom: '2px solid #0f172a', padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: 18 }}>
            {isRTL ? 'عقد تعاوني — مدرب تقني' : 'Cooperation Contract — Technical Trainer'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div className="modal-body" style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>

          <div style={sectionTitle}>{isRTL ? 'اسم البرنامج والتاريخ' : 'Program & Date'}</div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{isRTL ? 'اسم البرنامج التدريبي' : 'Program name'}</label>
            <input type="text" value={form.programName} onChange={(e) => set('programName', e.target.value)} style={fieldStyle}
              placeholder={isRTL ? 'مثال: صيف فاب لاب 2026' : 'e.g. Summer FabLab 2026'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'اليوم' : 'Day'}</label>
              <input type="text" value={form.contractDay} onChange={(e) => set('contractDay', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الشهر' : 'Month'}</label>
              <input type="text" value={form.contractMonth} onChange={(e) => set('contractMonth', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'السنة' : 'Year'}</label>
              <input type="text" value={form.contractYear} onChange={(e) => set('contractYear', e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div style={sectionTitle}>{isRTL ? 'الطرف الأول' : 'First Party'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'الجهة / الشخص المشرف' : 'Entity / Supervisor'}</label>
              <input type="text" value={form.party1Entity} onChange={(e) => set('party1Entity', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'يمثله / تمثله' : 'Represented by'}</label>
              <input type="text" value={form.party1Representative} onChange={(e) => set('party1Representative', e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div style={sectionTitle}>{isRTL ? 'الطرف الثاني (المدرب التقني)' : 'Second Party (Trainer)'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'الاسم' : 'Name'}</label>
              <input type="text" value={form.trainerName} onChange={(e) => set('trainerName', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'الجنسية' : 'Nationality'}</label>
              <input type="text" value={form.trainerNationality} onChange={(e) => set('trainerNationality', e.target.value)} style={fieldStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'رقم الهوية / الإقامة' : 'National ID / Iqama'}</label>
              <input type="text" value={form.trainerNationalId} onChange={(e) => set('trainerNationalId', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'رقم الآيبان' : 'IBAN'}</label>
              <input type="text" value={form.trainerIban} onChange={(e) => set('trainerIban', e.target.value)} style={fieldStyle}
                placeholder="SA00 0000 0000 0000 0000 0000" />
            </div>
          </div>

          <div style={sectionTitle}>{isRTL ? 'موضوع العقد' : 'Subject'}</div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{isRTL ? 'الوظيفة / الدور' : 'Role'}</label>
            <input type="text" value={form.trainerRole} onChange={(e) => set('trainerRole', e.target.value)} style={fieldStyle}
              placeholder={isRTL ? 'مثال: مدرب أول للفصل الصيفي' : 'e.g. Lead trainer'} />
          </div>

          {renderArray('benefits', 'المزايا', 'Benefits')}

          <div style={sectionTitle}>{isRTL ? 'مدة العقد' : 'Duration'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>{isRTL ? 'تاريخ البداية' : 'Start date'}</label>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'تاريخ النهاية' : 'End date'}</label>
              <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isRTL ? 'أيام الإقفال بعد الختام' : 'Wrap-up days'}</label>
              <input type="number" min="0" value={form.closingDays} onChange={(e) => set('closingDays', e.target.value)} style={fieldStyle} />
            </div>
          </div>

          {renderArray('tasks', 'مهام المدرب التقني', 'Trainer tasks')}

          <div style={sectionTitle}>{isRTL ? 'المكافأة' : 'Compensation'}</div>
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>{isRTL ? 'المبلغ الإجمالي (ريال سعودي)' : 'Total (SAR)'}</label>
            <input type="text" value={form.compensationAmount} onChange={(e) => set('compensationAmount', e.target.value)} style={fieldStyle} />
          </div>

          <div style={{
            marginTop: 16, padding: '10px 14px',
            background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 8,
            fontSize: 12.5, color: '#075985'
          }}>
            {isRTL
              ? '💡 الشروط والأحكام الثابتة (الحضور، الأداء، الاستحقاق، الأحكام العامة) تُطبع تلقائياً في العقد ولا تحتاج تعبئة.'
              : 'Standard clauses (attendance, performance, entitlement, general provisions) print automatically — no need to fill them.'}
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 6, border: '1.5px solid #cbd5e1',
              background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handlePrint}
            disabled={!form.trainerName || !form.programName}
            style={{
              padding: '9px 22px', borderRadius: 6, border: 'none',
              background: (form.trainerName && form.programName)
                ? 'linear-gradient(90deg, #0f172a, #334155)' : '#cbd5e1',
              color: '#fff', fontWeight: 800,
              cursor: (form.trainerName && form.programName) ? 'pointer' : 'not-allowed',
              letterSpacing: 0.5
            }}
          >
            {isRTL ? 'طباعة العقد' : 'Print Contract'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TechnicalTrainerContractModal;
