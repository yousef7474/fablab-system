import React from 'react';
import { has, num, ar, fmt, fmtDay, isTech, uid, DAYS, HOURS, humanSize } from './kitModel';
import {
  MAKE_F, Q_TYPES, LIKERT, SURVEY_METHODS, RUBRIC_LEVELS, techOutputs, testTotal, rubricTotal, rubricFor, objCode, outCode
} from './kitForms';
import { Field, Panel, SecHead, Linked, RmBtn, AddBtn, RowTable, Cell } from './KitFormControls';
import { AuthedImage } from './KitParts';
import { KIT_ROUTES } from './kitApi';

// The bodies of the seven attachment form screens. Each gets `ctx`:
//   fkey, s (whole normalized kit), form (= s.forms[fkey]), C (field
//   builders), setF(path, v), updF(fn(form, kitData)), locked, api, kit,
//   addImages(files, onEach), dropFile(fileId), busy.

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];
const cut = (t, n = 70) => { const x = String(t || '').trim(); return x.length > n ? `${x.slice(0, n)}…` : x; };
const objOptions = (s) => s.card.objectives.map((o, i) => (has(o.text) ? { v: o.id, l: `ه${i + 1} — ${cut(o.text.replace(/^أن\s+/, ''), 60)}` } : null)).filter(Boolean);
const outOptions = (s) => s.outputs.map((o, i) => ({ v: o.id, l: `م${i + 1} — ${cut(o.name || 'مخرج بلا اسم', 50)}` }));
const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); };
const PrefillBtn = ({ locked, onClick, children, title }) => (locked ? null : <button type="button" className="tk-btn sm" onClick={onClick} title={title}>⤵ {children}</button>);

// ═════════════════════ Tests (pre / post) ═════════════════════

const cloneQuestion = (q) => {
  const options = q.options.map(o => ({ ...o, id: uid() }));
  const ci = q.options.findIndex(o => o.id === q.correct);
  return { ...q, id: uid(), options, correct: q.type === 'mcq' ? (ci >= 0 ? options[ci].id : '') : q.correct };
};

export const TestForm = ({ ctx }) => {
  const { fkey, s, form: t, C, setF, updF, locked } = ctx;
  const total = testTotal(t);
  const objs = objOptions(s);
  const isPost = fkey === 'postTest';
  const preCount = s.forms.preTest.questions.filter(q => has(q.text)).length;
  const setType = (i, type) => updF(f => {
    const q = f.questions[i];
    q.type = type;
    q.correct = '';
    if (type === 'mcq' && q.options.length < 2) q.options = [MAKE_F.option(), MAKE_F.option(), MAKE_F.option(), MAKE_F.option()];
  });
  const copyPre = () => updF((f, n) => {
    const copies = n.forms.preTest.questions.filter(q => has(q.text)).map(cloneQuestion);
    f.questions = [...f.questions.filter(q => has(q.text)), ...copies];
  });
  return (
    <>
      <section className="tk-sec" id="tkf-sec-1">
        <SecHead n="1" title="بيانات الاختبار" desc={isPost ? 'يُطبَّق في نهاية البرنامج لقياس ما تحقق من أهدافه، ويُقارن بنتيجة الاختبار القبلي.' : 'يُطبَّق في بداية البرنامج لمعرفة نقطة انطلاق المشاركين — لا يدخل في تقييمهم.'} />
        <Panel>
          <div className="tk-grid">
            <Field label="زمن الاختبار" req htmlFor={C.id('duration')}>{C.numIn('duration', { sfx: 'دقيقة', sfxW: 46, min: 1, ph: 'مثال: 15' })}</Field>
            <Field label="درجة النجاح (اختياري)" htmlFor={C.id('passMark')} hint="اتركها فارغة إن لم يكن للاختبار حد نجاح.">{C.numIn('passMark', { sfx: 'درجة', ph: '—' })}</Field>
            <Field label="تعليمات الاختبار" req wide htmlFor={C.id('instructions')} hint="تُطبع في أعلى ورقة الاختبار.">{C.area('instructions', { rows: 2 })}</Field>
          </div>
          <div className="tkf-stats">
            <span><b className="mono">{t.questions.length}</b> سؤال</span>
            <span><b className="mono">{fmt(total)}</b> مجموع الدرجات</span>
            {has(t.duration) && <span><b className="mono">{t.duration}</b> دقيقة</span>}
          </div>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-2">
        <SecHead n="2" title="الأسئلة ومفتاح الإجابة" desc="لكل سؤال: درجته، والهدف الذي يقيسه، والإجابة الصحيحة. تُطبع نسخة للمشارك بلا إجابات ونسخة للمدرب بمفتاح الإجابة." />
        {isPost && !locked && (
          <div className="tk-note cyan">
            <span className="tk-note-ico">⤵</span>
            <div style={{ flex: 1 }}><b>الاختبار البعدي غالبًا يعيد أسئلة القبلي</b>لقياس التقدّم بدقة. انسخ أسئلة الاختبار القبلي ثم عدّل أو أضف ما يلزم.</div>
            <button type="button" className="tk-btn sm" disabled={!preCount} onClick={copyPre}>انسخ أسئلة القبلي ({preCount})</button>
          </div>
        )}
        <div className="tkf-cover" aria-label="تغطية الأهداف">
          <span className="tk-muted-s">تغطية الأهداف:</span>
          {objs.length ? objs.map(o => {
            const n = t.questions.filter(q => q.objectiveId === o.v).length;
            return <span key={o.v} className={`tk-pill ${n ? 'mint' : 'amber'}`} title={o.l}>{o.l.split(' — ')[0]} · {n}</span>;
          }) : <span className="tk-muted-s">أضف أهداف البرنامج في بطاقة الحقيبة أولًا.</span>}
        </div>
        <div className="tkf-qs" id={`tkf-${fkey}-questions`}>
          {!t.questions.length && <p className="tk-empty">لا توجد أسئلة بعد.</p>}
          {t.questions.map((q, i) => {
            const p = `questions.${i}.`;
            return (
              <article className="tkf-q" key={q.id}>
                <header className="tkf-q-head">
                  <span className="tk-code">س{i + 1}</span>
                  <div className="tkf-q-meta">
                    <label className="tkf-mini"><span>النوع</span>
                      <select className="tk-in" id={C.id(`${p}type`)} value={q.type} disabled={locked} onChange={(e) => setType(i, e.target.value)}>
                        {Q_TYPES.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                      </select>
                    </label>
                    <label className="tkf-mini narrow"><span>الدرجة</span>{C.numIn(`${p}marks`, { min: 0, step: '0.5', label: `درجة السؤال ${i + 1}` })}</label>
                    <label className="tkf-mini grow"><span>الهدف المرتبط</span>{C.select(`${p}objectiveId`, objs, { ph: 'اختر الهدف…', label: 'الهدف المرتبط' })}</label>
                  </div>
                  {!locked && (
                    <div className="tkf-q-tools">
                      <button type="button" className="tk-ibtn" disabled={i === 0} onClick={() => updF(f => move(f.questions, i, -1))} aria-label="تحريك السؤال لأعلى" title="لأعلى">↑</button>
                      <button type="button" className="tk-ibtn" disabled={i === t.questions.length - 1} onClick={() => updF(f => move(f.questions, i, 1))} aria-label="تحريك السؤال لأسفل" title="لأسفل">↓</button>
                      <RmBtn locked={locked} label={`حذف السؤال ${i + 1}`} onClick={() => updF(f => { f.questions.splice(i, 1); })} />
                    </div>
                  )}
                </header>
                <div className="tkf-q-body">
                  <Field label="نص السؤال" req htmlFor={C.id(`${p}text`)}>{C.area(`${p}text`, { rows: 2, ph: q.type === 'practical' ? 'صف المهمة التي سينفذها المشارك' : q.type === 'tf' ? 'اكتب العبارة التي يحكم المشارك بصحتها' : 'اكتب السؤال' })}</Field>
                  {q.type === 'mcq' && (
                    <Field label="الخيارات — اضغط حرف الإجابة الصحيحة" req labelId={`tkfl-${fkey}-${q.id}`}>
                      <div className="tkf-opts" id={C.id(`${p}options`)} role="radiogroup" aria-labelledby={`tkfl-${fkey}-${q.id}`}>
                        {q.options.map((o, j) => (
                          <div className={`tkf-opt ${q.correct === o.id ? 'ok' : ''}`} key={o.id}>
                            <button type="button" role="radio" aria-checked={q.correct === o.id} className="tkf-radio" disabled={locked}
                              onClick={() => setF(`${p}correct`, o.id)} title="الإجابة الصحيحة">{LETTERS[j] || j + 1}</button>
                            {C.text(`${p}options.${j}.text`, { ph: `الخيار ${LETTERS[j] || j + 1}`, label: `الخيار ${LETTERS[j] || j + 1}` })}
                            {q.options.length > 2 && <RmBtn locked={locked} label="حذف الخيار" onClick={() => updF(f => { const x = f.questions[i]; if (x.correct === o.id) x.correct = ''; x.options.splice(j, 1); })} />}
                          </div>
                        ))}
                        {q.options.length < 8 && <div><AddBtn locked={locked} onClick={() => updF(f => { f.questions[i].options.push(MAKE_F.option()); })}>خيار</AddBtn></div>}
                      </div>
                    </Field>
                  )}
                  {q.type === 'tf' && (
                    <Field label="الإجابة الصحيحة" req labelId={`tkfl-${fkey}-${q.id}`}>
                      <div className="tk-seg" id={C.id(`${p}correct`)} role="radiogroup" aria-labelledby={`tkfl-${fkey}-${q.id}`}>
                        {[['true', 'صح'], ['false', 'خطأ']].map(([v, l]) => (
                          <button key={v} type="button" role="radio" aria-checked={q.correct === v} disabled={locked} onClick={() => setF(`${p}correct`, v)}>{l}</button>
                        ))}
                      </div>
                    </Field>
                  )}
                  {(q.type === 'short' || q.type === 'practical') && (
                    <Field label={q.type === 'practical' ? 'معيار التصحيح (ما يجب أن يحققه المشارك)' : 'الإجابة النموذجية'} req htmlFor={C.id(`${p}answer`)}>
                      {C.area(`${p}answer`, { rows: 2, ph: q.type === 'practical' ? 'مثال: يجمّع الترسين بحيث يدور الثاني عكس الأول دون احتكاك' : 'الإجابة التي يُقبل بها السؤال' })}
                    </Field>
                  )}
                  <Field label="ما الذي يقيسه السؤال؟" req htmlFor={C.id(`${p}measures`)}>{C.text(`${p}measures`, { ph: 'مثال: التمييز بين الحركة الدورانية والخطية' })}</Field>
                </div>
              </article>
            );
          })}
        </div>
        <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.questions.push(MAKE_F.question()); })}>إضافة سؤال</AddBtn></div>
      </section>
    </>
  );
};

// ═════════════════════ Scientific content (Excel) ═════════════════════

const KitImages = ({ api, images }) => (images.length ? (
  <div className="tkf-thumbs">{images.map(im => <figure key={im.fileId}><AuthedImage api={api} url={KIT_ROUTES.mine.file(im.fileId)} alt={im.caption || ''} />{im.caption && <figcaption>{im.caption}</figcaption>}</figure>)}</div>
) : null);

export const ContentForm = ({ ctx }) => {
  const { s, form: c, C, setF, updF, locked, api, addImages, dropFile, busy } = ctx;
  const card = s.card;
  const techs = techOutputs(s);
  const techFiles = (s.attachments.find(a => a.label === 'ملفات المخرجات التقنية') || { files: [] }).files;
  const outNames = (ids) => ids.map(id => { const i = s.outputs.findIndex(o => o.id === id); return i < 0 ? null : `م${i + 1} — ${s.outputs[i].name || 'مخرج بلا اسم'}`; }).filter(Boolean);
  return (
    <>
      <section className="tk-sec" id="tkf-sec-1">
        <SecHead n="1" title="بيانات المحتوى" desc="تُعرض من بطاقة البرنامج كما هي — عدّلها في الحقيبة نفسها إن لزم." />
        <Panel>
          <div className="tkf-linked-grid">
            <Linked label="اسم البرنامج التدريبي" from="بطاقة البرنامج">{card.name}</Linked>
            <Linked label="المستوى">{has(card.level) ? `${card.level}${has(card.sublevel) ? ` ${card.sublevel}` : ''}` : ''}</Linked>
            <Linked label="الفئة العمرية">{has(card.ageMin) || has(card.ageMax) ? `من ${card.ageMin || '—'} إلى ${card.ageMax || '—'} سنة` : ''}</Linked>
            <Linked label="مدة البرنامج">{num(card.days) && num(card.hours) ? `${ar(card.days, DAYS)} × ${ar(card.hours, HOURS)} = ${ar(card.days * card.hours, HOURS)}` : ''}</Linked>
            <Linked label="إعداد المحتوى العلمي">{card.author}</Linked>
            <Linked label="رقم الإصدار وتاريخه">{has(card.version) ? `${card.version}${card.versionDate ? ` — ${fmtDay(card.versionDate)}` : ''}` : ''}</Linked>
          </div>
        </Panel>
        <Panel title="أهداف التعلم" note="أهداف البرنامج المعتمدة كما هي، مرقّمة لربط محتوى كل يوم بها.">
          <ol className="tkf-objs">
            {card.objectives.filter(o => has(o.text)).length
              ? card.objectives.map((o, i) => (has(o.text) ? <li key={o.id}><b className="mono">ه{i + 1}</b>{o.text}</li> : null))
              : <li className="tk-muted-s">لم تُكتب أهداف في بطاقة البرنامج بعد.</li>}
          </ol>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-2">
        <SecHead n="2" title="المحتوى العلمي حسب الأيام" desc="يوم لكل يوم في خطة التنفيذ. ما يأتي من الخطة يظهر للاطلاع، وتكتب هنا المحتوى العلمي نفسه." />
        {!s.plan.length && <p className="tk-empty">أضف أيام البرنامج في «خطة التنفيذ» أولًا.</p>}
        {s.plan.map((d, i) => {
          const day = c.days[d.id] || MAKE_F.contentDay();
          const p = `days.${d.id}.`;
          const key = `img-${d.id}`;
          return (
            <article className="tk-day" key={d.id}>
              <header className="tk-day-head"><h3 className="tk-day-n">اليوم التدريبي<b>{i + 1}</b></h3></header>
              <div className="tk-day-body">
                <div className="tkf-linked-grid">
                  <Linked label="ماذا سنتعلم اليوم؟" from="خطة التنفيذ">{d.learn}</Linked>
                  <Linked label="الأهداف المرتبطة">{d.objectives.map(id => objCode(s, id)).filter(Boolean).join('، ')}</Linked>
                  <Linked label="نوع التنفيذ والزمن">{d.execution}</Linked>
                  <Linked label="المخرج المتوقع">{outNames(d.outputs).join(' · ')}</Linked>
                  <Linked label="طريقة التحقق ومعيار القبول">{d.verify}</Linked>
                </div>
                <div className="tk-grid" style={{ marginTop: 16 }}>
                  <Field label="مدة اليوم" htmlFor={C.id(`${p}duration`)} hint={num(card.hours) ? `فارغ = ${ar(card.hours, HOURS)} كما في بطاقة البرنامج.` : ''}>{C.text(`${p}duration`, { ph: num(card.hours) ? ar(card.hours, HOURS) : 'مثال: ساعتان ونصف' })}</Field>
                  <Field label="المفاهيم والمصطلحات" req htmlFor={C.id(`${p}concepts`)}>{C.area(`${p}concepts`, { ph: 'المصطلحات التي يتعرّف عليها المشارك اليوم' })}</Field>
                  <Field label="الشرح العلمي والتقني" req wide htmlFor={C.id(`${p}explanation`)} hint="الشرح الذي يقدمه المدرب: الفكرة العلمية وكيف تعمل، بلغة واضحة يمكن لمدرب آخر تقديمها.">{C.area(`${p}explanation`, { rows: 4 })}</Field>
                  <Field label="الأجهزة والبرامج والقطع المستخدمة" req htmlFor={C.id(`${p}tools`)}>{C.area(`${p}tools`)}</Field>
                  <Field label="التطبيق العملي أو التحدي" req htmlFor={C.id(`${p}challenge`)}>{C.area(`${p}challenge`)}</Field>
                  <Field label="خطوات التطبيق" req wide htmlFor={C.id(`${p}steps`)} hint="خطوة في كل سطر.">{C.area(`${p}steps`, { rows: 3, ph: '1. …\n2. …' })}</Field>
                  <Field label="السلامة والأخطاء الشائعة" req wide htmlFor={C.id(`${p}safety`)}>{C.area(`${p}safety`, { rows: 2 })}</Field>
                  <Field label="الصور أو الرسومات التوضيحية" wide labelId={`tkfl-img-${d.id}`}>
                    <div className="tkf-imgs" role="group" aria-labelledby={`tkfl-img-${d.id}`}>
                      {day.images.map((im, j) => (
                        <figure className="tk-itile" key={im.fileId}>
                          <div className="ph"><AuthedImage api={api} url={KIT_ROUTES.mine.file(im.fileId)} alt={im.caption || 'صورة توضيحية'} /></div>
                          <figcaption className="meta">{C.text(`${p}images.${j}.caption`, { ph: 'وصف الصورة', label: 'وصف الصورة' })}</figcaption>
                          {!locked && <button type="button" className="tk-ibtn danger over" aria-label="حذف الصورة" title="حذف الصورة" onClick={() => { dropFile(im.fileId); updF(f => { f.days[d.id].images.splice(j, 1); }); }}>🗑</button>}
                        </figure>
                      ))}
                      {(busy[key] || []).map(n => <div key={n} className="tk-drop small" aria-busy="true"><span className="big">⏳</span><span>{n}</span></div>)}
                      {!locked && (
                        <label className="tk-drop small">
                          <span className="big">🖼</span><b>إضافة صورة</b><span>PNG أو JPG أو SVG</span>
                          <input type="file" accept="image/*" multiple hidden onChange={(e) => {
                            addImages(e.target.files, key, (ref) => updF(f => { f.days[d.id] = { ...MAKE_F.contentDay(), ...(f.days[d.id] || {}) }; f.days[d.id].images.push(ref); }));
                            e.target.value = '';
                          }} />
                        </label>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="tk-sec" id="tkf-sec-3">
        <SecHead n="3" title="المخرج التقني المرجعي" desc="لكل مخرج تقني: وصفه وصورته المرجعية من الحقيبة، ومعايير قبوله. ملفات التصميم والأكواد تُرفع في مرفق «ملفات المخرجات التقنية»." />
        {!techs.length && <p className="tk-empty">لا توجد مخرجات تقنية في الحقيبة (منتج مصنّع، دائرة إلكترونية، برنامج أو كود، تصميم رقمي).</p>}
        {techs.map(o => {
          const measure = s.measures.find(m => m.outputId === o.id && has(m.result));
          const imgs = s.images.filter(im => im.outputId === o.id);
          return (
            <Panel key={o.id} title={<><span className="tk-code out tkf-inline-code">{o.code}</span> {o.name || 'مخرج بلا اسم'}</>}>
              <div className="tkf-linked-grid">
                <Linked label="وصف المخرج" from="المخرجات">{o.desc}</Linked>
                <Linked label="ملفات المخرج" from="مرفق ملفات المخرجات التقنية">{techFiles.length ? techFiles.map(f => `${f.name}${f.size ? ` (${humanSize(f.size)})` : ''}`).join(' · ') : ''}</Linked>
              </div>
              <KitImages api={api} images={imgs} />
              <div className="tk-grid" style={{ marginTop: 14 }}>
                <Field label="معايير القبول" req wide htmlFor={C.id(`outputs.${o.id}.criteria`)} hint="معايير اكتماله وجودته وعمله وسلامته.">
                  {C.area(`outputs.${o.id}.criteria`, { rows: 2 })}
                  {measure && !has((c.outputs[o.id] || {}).criteria) && (
                    <div><PrefillBtn locked={locked} onClick={() => setF(`outputs.${o.id}.criteria`, measure.result)} title="من «قياس تحقق المخرجات» في الحقيبة">استخدم النتيجة المطلوبة من معيار القياس</PrefillBtn></div>
                  )}
                </Field>
              </div>
            </Panel>
          );
        })}
      </section>

      <section className="tk-sec" id="tkf-sec-4">
        <SecHead n="4" title="المراجع والاعتماد" />
        <Panel title="المراجع والمصادر">
          <RowTable cols="minmax(0,1fr) minmax(0,1.6fr) 150px 36px" heads={['المصدر', 'الرابط أو بيانات المرجع', 'تاريخ الاطلاع', '']} id="tkf-content-refs">
            {c.refs.map((r, i) => (
              <div className="tk-rt-row" key={r.id}>
                <Cell label="المصدر">{C.text(`refs.${i}.source`, { ph: 'اسم الكتاب أو الموقع أو الجهة', label: 'المصدر' })}</Cell>
                <Cell label="الرابط أو بيانات المرجع">{C.text(`refs.${i}.ref`, { ph: 'https://… أو المؤلف، السنة، الصفحة', label: 'الرابط أو بيانات المرجع' })}</Cell>
                <Cell label="تاريخ الاطلاع" half>{C.date(`refs.${i}.date`, 'تاريخ الاطلاع')}</Cell>
                <Cell act><RmBtn locked={locked} label="حذف المرجع" onClick={() => updF(f => { f.refs.splice(i, 1); })} /></Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.refs.push(MAKE_F.ref()); })}>إضافة مرجع</AddBtn></div>
        </Panel>
        <Panel title="مراجعة المحتوى واعتماده" note="تُعتمد إلكترونيًا بالاسم والتاريخ مع اعتماد الحقيبة.">
          <div className="tkf-linked-grid">
            <Linked label="إعداد المحتوى" from="بطاقة البرنامج">{card.author}</Linked>
            <Linked label="المراجعة العلمية والتقنية">مسؤول إدارة المشاريع — عند اعتمادها للحقيبة</Linked>
            <Linked label="اعتماد الحقيبة">المدير — عند الاعتماد النهائي</Linked>
          </div>
        </Panel>
      </section>
    </>
  );
};

// ═════════════════════ Student guide (Excel) ═════════════════════

export const GuideForm = ({ ctx }) => {
  const { s, form: g, C, setF, updF, locked, api } = ctx;
  const card = s.card;
  const goalsText = () => card.objectives.filter(o => has(o.text)).map(o => `• ${o.text.replace(/^أن\s+/, 'أن ')}`).join('\n');
  const fillJourney = () => updF(f => {
    s.plan.forEach(d => {
      const j = { ...MAKE_F.journeyDay(), ...(f.journey[d.id] || {}) };
      if (!has(j.learn)) j.learn = d.learn || '';
      if (!has(j.output)) j.output = d.outputs.map(id => (s.outputs.find(o => o.id === id) || {}).name).filter(Boolean).join('، ');
      f.journey[d.id] = j;
    });
  });
  const fillLearnMake = () => updF(f => {
    const learn = card.objectives.filter(o => has(o.text)).map(o => o.text.replace(/^أن\s+/, ''));
    const make = s.outputs.filter(o => has(o.name)).map(o => o.name);
    const n = Math.max(learn.length, make.length);
    f.learnMake = Array.from({ length: n }, (_, i) => ({ ...MAKE_F.learnMake(), learn: learn[i] || '', make: make[i] || '' }));
  });
  const fillSchedule = () => updF(f => {
    f.schedule = s.plan.map((d, i) => ({ ...MAKE_F.slot(), day: `اليوم ${i + 1}`, activities: d.topics || d.learn || '' }));
  });
  const lmEmpty = !g.learnMake.some(r => has(r.learn) || has(r.make));
  const scEmpty = !g.schedule.some(r => has(r.day) || has(r.activities));
  const finalOut = s.outputs.find(o => isTech(o.type)) || s.outputs[0];
  return (
    <>
      <section className="tk-sec" id="tkf-sec-1">
        <SecHead n="1" title="بيانات التنفيذ" desc="ما يحتاجه المشارك ليصل إلى البرنامج ويتواصل مع منظميه." />
        <Panel>
          <div className="tk-grid">
            <Field label="اسم البرنامج التدريبي" wide labelId="tkfl-g-name"><Linked label="" from="بطاقة البرنامج">{card.name}</Linked></Field>
            <Field label="تاريخ البرنامج" req htmlFor={C.id('dateFrom')} hint="تاريخ البداية والنهاية.">
              <div className="tk-pair">{C.date('dateFrom', 'تاريخ البداية')}<span className="sep">إلى</span>{C.date('dateTo', 'تاريخ النهاية')}</div>
            </Field>
            <Field label="أيام وساعات الحضور" req htmlFor={C.id('attendance')} hint="الأيام ووقت الحضور والانصراف.">{C.text('attendance', { ph: 'مثال: الأحد – الأربعاء · 4:00 – 6:30 م' })}</Field>
            <Field label="موقع التنفيذ والقاعة" req htmlFor={C.id('location')}>{C.text('location', { ph: 'مثال: فاب لاب الأحساء — قاعة التصنيع الرقمي' })}</Field>
            <Field label="رقم التواصل" req htmlFor={C.id('phone')} hint="رقم التواصل المعتمد للبرنامج.">{C.text('phone', { ph: '05xxxxxxxx', dir: 'ltr', cls: 'num', type: 'tel' })}</Field>
            <Field label="رابط الموقع أو رمز الوصول" wide htmlFor={C.id('link')} hint="عند الحاجة فقط.">{C.text('link', { ph: 'https://maps.app.goo.gl/…', dir: 'ltr' })}</Field>
          </div>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-2">
        <SecHead n="2" title="أهلًا بك والتعريف بالبرنامج" />
        <Panel>
          <div className="tk-grid">
            <Field label="أهلًا بك" req wide htmlFor={C.id('welcome')} hint="رسالة ترحيبية قصيرة توضح للمشارك طبيعة التجربة وما الذي ينتظره خلال البرنامج.">{C.area('welcome', { rows: 3 })}</Field>
            <Field label="نبذة عن فاب لاب الأحساء" req wide htmlFor={C.id('aboutLab')} hint="تعريف مختصر بالمعمل ودوره في التصنيع الرقمي والابتكار — نص موحّد يمكنك تعديله.">{C.area('aboutLab', { rows: 2 })}</Field>
            <Field label="نبذة عن البرنامج" req wide htmlFor={C.id('aboutProgram')} hint="فكرة البرنامج ومدته ومجاله بأسلوب مناسب للمشارك.">
              {C.area('aboutProgram', { rows: 2 })}
              {!has(g.aboutProgram) && has(card.description) && <div><PrefillBtn locked={locked} onClick={() => setF('aboutProgram', card.description)}>انسخ وصف البرنامج من البطاقة</PrefillBtn></div>}
            </Field>
            <Field label="أهداف البرنامج" req wide htmlFor={C.id('goals')} hint="ما الذي سيضيفه البرنامج إلى معرفة المشارك ومهاراته؟ بصياغة موجهة للمشارك.">
              {C.area('goals', { rows: 3 })}
              {!has(g.goals) && card.objectives.some(o => has(o.text)) && <div><PrefillBtn locked={locked} onClick={() => setF('goals', goalsText())}>انسخ الأهداف من البطاقة</PrefillBtn></div>}
            </Field>
          </div>
        </Panel>
        <Panel title="ماذا ستتعلم وتصنع؟" actions={lmEmpty && <PrefillBtn locked={locked} onClick={fillLearnMake}>تعبئة من الأهداف والمخرجات</PrefillBtn>}>
          <RowTable cols="minmax(0,1fr) minmax(0,1fr) 36px" heads={['سأتعلم', 'سأنفذ أو أصنع', '']}>
            {g.learnMake.map((r, i) => (
              <div className="tk-rt-row" key={r.id}>
                <Cell label="سأتعلم">{C.area(`learnMake.${i}.learn`, { label: 'سأتعلم' })}</Cell>
                <Cell label="سأنفذ أو أصنع">{C.area(`learnMake.${i}.make`, { label: 'سأنفذ أو أصنع' })}</Cell>
                <Cell act><RmBtn locked={locked} label="حذف الصف" onClick={() => updF(f => { f.learnMake.splice(i, 1); })} /></Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.learnMake.push(MAKE_F.learnMake()); })}>إضافة صف</AddBtn></div>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-3">
        <SecHead n="3" title="رحلتي في البرنامج" desc="توضح للمشارك من أين يبدأ، وما الذي سيعمل عليه كل يوم، وإلى أي مخرج سيصل." />
        <Panel actions={<PrefillBtn locked={locked} onClick={fillJourney} title="يملأ الخانات الفارغة فقط">تعبئة من خطة التنفيذ</PrefillBtn>}>
          {!s.plan.length && <p className="tk-empty">أضف أيام البرنامج في «خطة التنفيذ» أولًا.</p>}
          <RowTable cols="70px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)" heads={['اليوم', 'ماذا سأتعلم؟', 'ماذا سأطبق؟', 'مخرج اليوم']}>
            {s.plan.map((d, i) => (
              <div className="tk-rt-row" key={d.id}>
                <Cell><span className="tk-role mono">{i + 1}</span></Cell>
                <Cell label="ماذا سأتعلم؟">{C.area(`journey.${d.id}.learn`, { label: `اليوم ${i + 1}: ماذا سأتعلم؟` })}</Cell>
                <Cell label="ماذا سأطبق؟">{C.area(`journey.${d.id}.apply`, { label: `اليوم ${i + 1}: ماذا سأطبق؟` })}</Cell>
                <Cell label="مخرج اليوم">{C.area(`journey.${d.id}.output`, { label: `اليوم ${i + 1}: مخرج اليوم` })}</Cell>
              </div>
            ))}
          </RowTable>
        </Panel>
        <Panel title="المخرج النهائي" actions={finalOut && !has(g.finalOutput.name) && <PrefillBtn locked={locked} onClick={() => updF(f => { f.finalOutput.name = finalOut.name || ''; f.finalOutput.desc = finalOut.desc || ''; const im = s.images.find(x => x.outputId === finalOut.id); if (im) f.finalOutput.imageFileId = im.fileId; })}>انسخ من المخرج {outCode(s, finalOut.id)}</PrefillBtn>}>
          <div className="tk-grid">
            <Field label="اسم المخرج" req htmlFor={C.id('finalOutput.name')} hint="اسم المنتج أو التطبيق النهائي.">{C.text('finalOutput.name')}</Field>
            <Field label="وصفه" req htmlFor={C.id('finalOutput.desc')} hint="ماذا يفعل؟ وما الذي سينفذه المشارك بنفسه؟">{C.area('finalOutput.desc', { rows: 2 })}</Field>
            <Field label="صورته" wide labelId="tkfl-g-img" hint={s.images.length ? 'اختر الصورة المرجعية من صور مخرجات الحقيبة.' : 'أضف صورًا مرجعية للمخرجات في القسم 2 من الحقيبة لتختار منها.'}>
              {s.images.length > 0 && (
                <div className="tkf-pick" role="radiogroup" aria-labelledby="tkfl-g-img" id={C.id('finalOutput.imageFileId')}>
                  {s.images.map(im => (
                    <button type="button" key={im.fileId} role="radio" aria-checked={g.finalOutput.imageFileId === im.fileId} disabled={locked}
                      onClick={() => setF('finalOutput.imageFileId', g.finalOutput.imageFileId === im.fileId ? '' : im.fileId)}>
                      <AuthedImage api={api} url={KIT_ROUTES.mine.file(im.fileId)} alt={im.caption || ''} />
                      <span>{outCode(s, im.outputId)} {cut(im.caption, 30)}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </div>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-4">
        <SecHead n="4" title="الجدول والتقييم" />
        <Panel title="الجدول" actions={scEmpty && s.plan.length > 0 && <PrefillBtn locked={locked} onClick={fillSchedule}>صف لكل يوم من الخطة</PrefillBtn>}>
          <RowTable cols="minmax(0,1fr) 120px 120px minmax(0,1.8fr) 36px" heads={['اليوم والتاريخ', 'وقت الحضور', 'وقت الانصراف', 'الجلسات والأنشطة', '']}>
            {g.schedule.map((r, i) => (
              <div className="tk-rt-row" key={r.id}>
                <Cell label="اليوم والتاريخ">{C.text(`schedule.${i}.day`, { ph: 'الأحد 12 يناير', label: 'اليوم والتاريخ' })}</Cell>
                <Cell label="وقت الحضور" half>{C.time(`schedule.${i}.from`, 'وقت الحضور')}</Cell>
                <Cell label="وقت الانصراف" half>{C.time(`schedule.${i}.to`, 'وقت الانصراف')}</Cell>
                <Cell label="الجلسات والأنشطة">{C.area(`schedule.${i}.activities`, { label: 'الجلسات والأنشطة' })}</Cell>
                <Cell act><RmBtn locked={locked} label="حذف الصف" onClick={() => updF(f => { f.schedule.splice(i, 1); })} /></Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.schedule.push(MAKE_F.slot()); })}>إضافة صف</AddBtn></div>
        </Panel>
        <Panel title="كيف يتم تقييم مشاركتي؟">
          <div className="tk-grid">
            <Field label="الاختبار القبلي والبعدي" req htmlFor={C.id('assessment.tests')} hint="الهدف منهما وموعدهما وطريقة تنفيذهما.">{C.area('assessment.tests', { rows: 2 })}</Field>
            <Field label="التطبيقات العملية" req htmlFor={C.id('assessment.practice')} hint="كيف تتم متابعة إنجاز التطبيقات اليومية.">{C.area('assessment.practice', { rows: 2 })}</Field>
            <Field label="المخرج النهائي" req htmlFor={C.id('assessment.final')} hint="معايير قبول المخرج العملي.">{C.area('assessment.final', { rows: 2 })}</Field>
            <Field label="الحضور والشهادة" req htmlFor={C.id('assessment.attendance')} hint="نسبة الحضور ومتطلبات الحصول على الشهادة.">
              {C.area('assessment.attendance', { rows: 2 })}
              {!has(g.assessment.attendance) && has(s.cert.criteria) && <div><PrefillBtn locked={locked} onClick={() => setF('assessment.attendance', `${s.cert.type ? `${s.cert.type}: ` : ''}${s.cert.criteria}`)}>انسخ معايير الشهادة من الحقيبة</PrefillBtn></div>}
            </Field>
          </div>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-5">
        <SecHead n="5" title="ما الذي أحتاج إلى إحضاره؟" />
        <Panel>
          <RowTable cols="minmax(0,1fr) minmax(0,1.4fr) 36px" heads={['المتطلب', 'ملاحظة', '']}>
            {g.bring.map((r, i) => (
              <div className="tk-rt-row" key={r.id}>
                <Cell label="المتطلب">{C.text(`bring.${i}.item`, { ph: 'مثال: حاسب محمول عليه حساب Shapr3D', label: 'المتطلب' })}</Cell>
                <Cell label="ملاحظة">{C.text(`bring.${i}.note`, { label: 'ملاحظة' })}</Cell>
                <Cell act><RmBtn locked={locked} label="حذف المتطلب" onClick={() => updF(f => { f.bring.splice(i, 1); })} /></Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.bring.push(MAKE_F.bring()); })}>إضافة متطلب</AddBtn><span className="tk-muted-s">إن لم يكن هناك ما يُحضَر اكتب: لا يلزم إحضار شيء.</span></div>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-6">
        <SecHead n="6" title="تعليمات المشاركة والسلامة" desc="نصوص موحّدة جاهزة — عدّلها بما يناسب برنامجك." />
        <Panel>
          <RowTable cols="minmax(0,.7fr) minmax(0,2.3fr)" heads={['المجال', 'التعليمات']}>
            {g.rules.map((r, i) => (
              <div className="tk-rt-row" key={r.domain}>
                <Cell><span className="tk-role">{r.domain}</span></Cell>
                <Cell label="التعليمات">{C.area(`rules.${i}.text`, { label: `تعليمات ${r.domain}` })}</Cell>
              </div>
            ))}
          </RowTable>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-7">
        <SecHead n="7" title="فريق البرنامج والتواصل" />
        <Panel>
          <RowTable cols="minmax(0,.8fr) minmax(0,1.2fr) minmax(0,1.2fr)" heads={['الدور', 'الاسم', 'وسيلة التواصل عند الحاجة']}>
            {g.team.map((t, i) => (
              <div className="tk-rt-row" key={t.role}>
                <Cell><span className="tk-role">{t.role}{(i === 0 || i === 2) && <span className="tk-req" aria-hidden="true">*</span>}</span></Cell>
                <Cell label="الاسم">{C.text(`team.${i}.name`, { label: `اسم ${t.role}` })}</Cell>
                <Cell label="وسيلة التواصل">{C.text(`team.${i}.contact`, { ph: 'جوال أو بريد', label: `وسيلة التواصل: ${t.role}` })}</Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-note amber" style={{ marginTop: 14 }}><span className="tk-note-ico">🔒</span><div>لا تُدرج أسماء المشاركين في دليل الطالب. تُحفظ قوائمهم في كشف مستقل وفق ضوابط الخصوصية.</div></div>
        </Panel>
      </section>
    </>
  );
};

// ═════════════════════ Reference guide (designed) ═════════════════════

export const ReferenceForm = ({ ctx }) => {
  const { s, form: r, C, updF, locked } = ctx;
  const outs = outOptions(s);
  const stepsEmpty = !r.steps.some(x => has(x.title) || has(x.steps));
  return (
    <>
      <section className="tk-sec" id="tkf-sec-1">
        <SecHead n="1" title="المفاهيم والأوامر" desc="مرجع مختصر يأخذه المشارك معه: أهم ما يحتاجه ليعيد التطبيق وحده بعد البرنامج." />
        <Panel title="مقدمة (اختياري)">
          {C.area('intro', { rows: 2, ph: 'سطران يوضحان كيف يستخدم المشارك هذا الدليل' })}
        </Panel>
        <Panel title="المفاهيم الأساسية" note="مفهوم واحد على الأقل.">
          <RowTable cols="minmax(0,.8fr) minmax(0,2fr) 36px" heads={['المفهوم أو المصطلح', 'الشرح المختصر', '']}>
            {r.concepts.map((x, i) => (
              <div className="tk-rt-row" key={x.id}>
                <Cell label="المفهوم">{C.text(`concepts.${i}.term`, { label: 'المفهوم' })}</Cell>
                <Cell label="الشرح المختصر">{C.area(`concepts.${i}.meaning`, { label: 'الشرح المختصر' })}</Cell>
                <Cell act><RmBtn locked={locked} label="حذف المفهوم" onClick={() => updF(f => { f.concepts.splice(i, 1); })} /></Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.concepts.push(MAKE_F.concept()); })}>إضافة مفهوم</AddBtn></div>
        </Panel>
        <Panel title="الأوامر والأكواد والاختصارات" note="إن وُجدت في البرنامج — اتركها فارغة إن لم تلزم.">
          <RowTable cols="minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.3fr) 36px" heads={['الأمر أو الكود', 'الاستخدام', 'مثال', '']} empty="لا توجد أوامر — أضف إن احتاجها البرنامج.">
            {r.commands.map((x, i) => (
              <div className="tk-rt-row" key={x.id}>
                <Cell label="الأمر أو الكود">{C.text(`commands.${i}.cmd`, { dir: 'ltr', cls: 'num', label: 'الأمر أو الكود' })}</Cell>
                <Cell label="الاستخدام">{C.area(`commands.${i}.use`, { label: 'الاستخدام' })}</Cell>
                <Cell label="مثال">{C.area(`commands.${i}.example`, { label: 'مثال' })}</Cell>
                <Cell act><RmBtn locked={locked} label="حذف الأمر" onClick={() => updF(f => { f.commands.splice(i, 1); })} /></Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.commands.push(MAKE_F.command()); })}>إضافة أمر</AddBtn></div>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-2">
        <SecHead n="2" title="القطع والأدوات" />
        <Panel note="قطعة أو أداة واحدة على الأقل.">
          <RowTable cols="minmax(0,1fr) minmax(0,1.5fr) minmax(0,1.3fr) 36px" heads={['القطعة أو الأداة', 'وظيفتها', 'ملاحظات الاستخدام', '']}>
            {r.parts.map((x, i) => (
              <div className="tk-rt-row" key={x.id}>
                <Cell label="القطعة أو الأداة">{C.text(`parts.${i}.name`, { label: 'القطعة أو الأداة' })}</Cell>
                <Cell label="وظيفتها">{C.area(`parts.${i}.function`, { label: 'وظيفتها' })}</Cell>
                <Cell label="ملاحظات الاستخدام">{C.area(`parts.${i}.note`, { label: 'ملاحظات الاستخدام' })}</Cell>
                <Cell act><RmBtn locked={locked} label="حذف القطعة" onClick={() => updF(f => { f.parts.splice(i, 1); })} /></Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.parts.push(MAKE_F.part()); })}>إضافة قطعة أو أداة</AddBtn></div>
        </Panel>
      </section>

      <section className="tk-sec" id="tkf-sec-3">
        <SecHead n="3" title="خطوات إعادة التطبيق" desc="لكل تطبيق أو مخرج: خطوات يعيد بها المشارك العمل وحده، مع النصائح والأخطاء الشائعة." />
        {stepsEmpty && s.outputs.length > 0 && !locked && (
          <div><PrefillBtn locked={locked} onClick={() => updF(f => { f.steps = s.outputs.map(o => ({ ...MAKE_F.steps(), outputId: o.id, title: o.name || '' })); })}>بطاقة لكل مخرج من مخرجات الحقيبة</PrefillBtn></div>
        )}
        <div className="tk-items" id="tkf-reference-steps">
          {r.steps.map((x, i) => (
            <div className="tk-item" key={x.id}>
              <div className="tk-code-col"><span className="tk-code">{i + 1}</span></div>
              <div className="tk-grid">
                <Field label="المخرج المرتبط" htmlFor={C.id(`steps.${i}.outputId`)}>{C.select(`steps.${i}.outputId`, outs, { ph: 'تطبيق عام (غير مرتبط بمخرج)' })}</Field>
                <Field label="عنوان التطبيق" req htmlFor={C.id(`steps.${i}.title`)}>{C.text(`steps.${i}.title`, { ph: 'مثال: تركيب ترسين متعاشقين' })}</Field>
                <Field label="الخطوات" req wide htmlFor={C.id(`steps.${i}.steps`)} hint="خطوة في كل سطر.">{C.area(`steps.${i}.steps`, { rows: 3, ph: '1. …\n2. …' })}</Field>
                <Field label="نصائح وأخطاء شائعة" wide htmlFor={C.id(`steps.${i}.tips`)}>{C.area(`steps.${i}.tips`, { rows: 2 })}</Field>
              </div>
              <RmBtn locked={locked} label={`حذف التطبيق ${i + 1}`} onClick={() => updF(f => { f.steps.splice(i, 1); })} />
            </div>
          ))}
        </div>
        <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.steps.push(MAKE_F.steps()); })}>إضافة تطبيق</AddBtn></div>
      </section>

      <section className="tk-sec" id="tkf-sec-4">
        <SecHead n="4" title="مصادر للاستزادة" />
        <Panel note="اختياري — مواقع أو فيديوهات أو كتب يرجع إليها المشارك.">
          <RowTable cols="minmax(0,1fr) minmax(0,1.6fr) 36px" heads={['المصدر', 'الرابط', '']} empty="لا توجد مصادر بعد.">
            {r.sources.map((x, i) => (
              <div className="tk-rt-row" key={x.id}>
                <Cell label="المصدر">{C.text(`sources.${i}.title`, { label: 'المصدر' })}</Cell>
                <Cell label="الرابط">{C.text(`sources.${i}.link`, { dir: 'ltr', ph: 'https://…', label: 'الرابط' })}</Cell>
                <Cell act><RmBtn locked={locked} label="حذف المصدر" onClick={() => updF(f => { f.sources.splice(i, 1); })} /></Cell>
              </div>
            ))}
          </RowTable>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.sources.push(MAKE_F.source()); })}>إضافة مصدر</AddBtn></div>
        </Panel>
      </section>
    </>
  );
};

// ═════════════════════ Rubric (designed) ═════════════════════

export const RubricForm = ({ ctx }) => {
  const { s, form: r, C, setF, updF, locked } = ctx;
  const total = rubricTotal(r);
  const missing = s.outputs.filter(o => !r.items.some(x => x.outputId === o.id));
  const generate = () => updF(f => { missing.forEach(o => { f.items.push(...rubricFor(o)); }); });
  const groups = [...s.outputs.map(o => ({ key: o.id, title: `${outCode(s, o.id)} — ${o.name || 'مخرج بلا اسم'}`, items: r.items.map((x, i) => ({ x, i })).filter(({ x }) => x.outputId === o.id) })),
    { key: '', title: 'تطبيقات أخرى', items: r.items.map((x, i) => ({ x, i })).filter(({ x }) => !x.outputId) }].filter(gr => gr.items.length);
  return (
    <>
      <section className="tk-sec" id="tkf-sec-1">
        <SecHead n="1" title="معايير التقييم" desc="معايير تقييم التطبيقات وعمل المخرج وجودته وسلامته ومطابقته، مع وصف كل مستوى أداء ليصحح أي مدرب بالطريقة نفسها." />
        <Panel>
          <div className="tk-grid">
            <Field label="درجة النجاح" req htmlFor={C.id('passMark')}>{C.numIn('passMark', { sfx: `من ${fmt(total)}`, sfxW: 60, ph: '0' })}</Field>
            <Field label="مجموع الدرجات" labelId="tkfl-rb-total"><output className="tk-total">{fmt(total)}<small>درجة</small></output></Field>
          </div>
          {missing.length > 0 && !locked && (
            <div className="tk-note cyan" style={{ marginTop: 14 }}>
              <span className="tk-note-ico">⚡</span>
              <div style={{ flex: 1 }}><b>{missing.length === s.outputs.length ? 'ابدأ بمعايير جاهزة' : `${missing.length} من المخرجات بلا معايير`}</b>تُنشأ معايير مقترحة لكل مخرج (عمل المخرج، الجودة، السلامة، المطابقة للمرجع للمخرجات التقنية) — عدّلها بعد ذلك.</div>
              <button type="button" className="tk-btn sm" onClick={generate}>إنشاء من مخرجات الحقيبة</button>
            </div>
          )}
        </Panel>
        <div className="tkf-rubric" id="tkf-rubric-items">
          {!r.items.length && <p className="tk-empty">لا توجد معايير بعد.</p>}
          {groups.map(gr => (
            <div className="tkf-rgroup" key={gr.key || 'other'}>
              <h3 className="tkf-rgroup-t">{gr.title}</h3>
              {gr.items.map(({ x, i }) => {
                const p = `items.${i}.`;
                return (
                  <article className="tkf-rb" key={x.id}>
                    <div className="tkf-rb-head">
                      <label className="tkf-mini grow"><span>المخرج أو التطبيق</span>
                        <select className="tk-in" id={C.id(`${p}outputId`)} value={x.outputId} disabled={locked} onChange={(e) => setF(`${p}outputId`, e.target.value)}>
                          {outOptions(s).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                          <option value="">تطبيق آخر…</option>
                        </select>
                      </label>
                      {!x.outputId && <label className="tkf-mini grow"><span>اسم التطبيق</span>{C.text(`${p}target`, { ph: 'مثال: ورقة العمل 1', label: 'اسم التطبيق' })}</label>}
                      <label className="tkf-mini grow"><span>المعيار</span>{C.text(`${p}criterion`, { label: 'المعيار' })}</label>
                      <label className="tkf-mini narrow"><span>الدرجة</span>{C.numIn(`${p}marks`, { min: 0, step: '0.5', label: 'الدرجة' })}</label>
                      <RmBtn locked={locked} label="حذف المعيار" onClick={() => updF(f => { f.items.splice(i, 1); })} />
                    </div>
                    <div className="tkf-rb-levels">
                      {RUBRIC_LEVELS.map(l => (
                        <label key={l.k} className={`tkf-level ${l.k}`}><span>{l.l}</span>{C.area(`${p}${l.k}`, { label: `${x.criterion || 'المعيار'}: ${l.l}` })}</label>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
        <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.items.push({ ...MAKE_F.criterion(), outputId: (s.outputs[0] || {}).id || '' }); })}>إضافة معيار</AddBtn></div>
        <Panel title="ملاحظات للمقيِّم (اختياري)">{C.area('notes', { rows: 2, ph: 'مثال: يُقيَّم المخرج م1 تشغيليًا أمام المدرب في نهاية اليوم الثالث' })}</Panel>
      </section>
    </>
  );
};

// ═════════════════════ Satisfaction survey (designed) ═════════════════════

export const SurveyForm = ({ ctx }) => {
  const { form: v, C, updF, locked } = ctx;
  return (
    <>
      <section className="tk-sec" id="tkf-sec-1">
        <SecHead n="1" title="تطبيق الاستبانة" desc="تقيس رضا المشاركين عن المحتوى والمدرب والتنظيم والتجربة. العبارات جاهزة ويمكنك تعديلها." />
        <Panel>
          <div className="tk-grid">
            <Field label="طريقة التطبيق" req labelId="tkfl-sv-method">{C.seg('method', SURVEY_METHODS, 'tkfl-sv-method')}</Field>
            <Field label="موعد التطبيق" req htmlFor={C.id('timing')}>{C.text('timing', { ph: 'مثال: نهاية اليوم الأخير بعد العروض الختامية' })}</Field>
            <Field label="نسبة الرضا المستهدفة (اختياري)" htmlFor={C.id('target')}>{C.text('target', { ph: 'مثال: 85٪ موافق أو موافق بشدة' })}</Field>
            <Field label="مقياس الإجابة" labelId="tkfl-sv-scale"><div className="tkf-likert" aria-labelledby="tkfl-sv-scale">{LIKERT.map((l, i) => <span key={l}><b className="mono">{5 - i}</b>{l}</span>)}</div></Field>
          </div>
        </Panel>
      </section>
      <section className="tk-sec" id="tkf-sec-2">
        <SecHead n="2" title="محاور الاستبانة" desc="عبارتان على الأقل في كل محور، يجيب عنها المشارك بالمقياس الخماسي." />
        {v.axes.map((a, ai) => (
          <Panel key={a.title} title={a.title} id={C.id(`axes.${ai}.items`)}>
            <ol className="tkf-statements">
              {a.items.map((x, i) => (
                <li key={x.id}>
                  <span className="mono">{i + 1}</span>
                  {C.text(`axes.${ai}.items.${i}.text`, { label: `${a.title}: العبارة ${i + 1}` })}
                  <RmBtn locked={locked} label="حذف العبارة" onClick={() => updF(f => { f.axes[ai].items.splice(i, 1); })} />
                </li>
              ))}
            </ol>
            <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.axes[ai].items.push(MAKE_F.statement()); })}>إضافة عبارة</AddBtn></div>
          </Panel>
        ))}
        <Panel title="أسئلة مفتوحة">
          <ol className="tkf-statements">
            {v.open.map((x, i) => (
              <li key={x.id}>
                <span className="mono">{i + 1}</span>
                {C.text(`open.${i}.text`, { label: `سؤال مفتوح ${i + 1}` })}
                <RmBtn locked={locked} label="حذف السؤال" onClick={() => updF(f => { f.open.splice(i, 1); })} />
              </li>
            ))}
          </ol>
          <div className="tk-list-foot"><AddBtn locked={locked} onClick={() => updF(f => { f.open.push(MAKE_F.openQ()); })}>إضافة سؤال مفتوح</AddBtn></div>
        </Panel>
      </section>
    </>
  );
};

export const BODIES = { preTest: TestForm, postTest: TestForm, content: ContentForm, guide: GuideForm, reference: ReferenceForm, rubric: RubricForm, survey: SurveyForm };

// Section list per form (the screen's side navigation).
export const FORM_SECTIONS = {
  preTest: ['بيانات الاختبار', 'الأسئلة ومفتاح الإجابة'],
  postTest: ['بيانات الاختبار', 'الأسئلة ومفتاح الإجابة'],
  content: ['بيانات المحتوى', 'المحتوى حسب الأيام', 'المخرج التقني المرجعي', 'المراجع والاعتماد'],
  guide: ['بيانات التنفيذ', 'التعريف بالبرنامج', 'رحلتي في البرنامج', 'الجدول والتقييم', 'ما أحتاج إلى إحضاره', 'التعليمات والسلامة', 'الفريق والتواصل'],
  reference: ['المفاهيم والأوامر', 'القطع والأدوات', 'خطوات إعادة التطبيق', 'مصادر للاستزادة'],
  rubric: ['معايير التقييم'],
  survey: ['تطبيق الاستبانة', 'محاور الاستبانة']
};

