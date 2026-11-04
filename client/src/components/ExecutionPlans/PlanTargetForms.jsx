import React from 'react';
import { AuthedImage } from '../TrainingKits/KitParts';
import {
  DAY_PARTS, GENDERS, URGENCY, V_MODES, V_GENDERS, WEEKDAYS, MEDIA_MIN_IMAGES, MAKE_F,
  weekdayOf, roleHours, roleDays, volunteerTotals
} from './planFiles';
import { has } from './planModel';
import { ar, HOURS, DAYS } from '../TrainingKits/kitModel';

const VOLS = ['متطوع واحد', 'متطوعان', 'متطوعين', 'متطوعًا'];
const fmtH = (n) => (n == null ? '—' : String(Math.round(n * 100) / 100));
// «4.5 ساعات» / «يوم واحد» — Arabic agreement, decimals kept.
const hrs = (n) => (n == null ? '—' : ar(Math.round(n * 100) / 100, HOURS));

/**
 * The two forms filled inside a plan target (the plan editor passes its
 * own field builders in `c`, bound to `base` — e.g. 'targets.2.media.form'):
 *   MediaForm     — «نموذج اعتماد طلب تصميم إعلان (لقسم، ورشة، برامج)»
 *   VolunteerForm — تصاميم الفرص التطوعية: the volunteer roles needed
 */
export const MediaForm = ({ f, base, c, locked, images }) => {
  const p = (k) => `${base}.${k}`;
  return (
    <div className="ep-form">
      <div className="tk-grid">
        {c.field({ key: 'act', label: 'اسم النشاط', req: 1, wide: 1, for: c.id(p('activity')), hint: 'كما سيظهر في الإعلان، مع الأقسام المشاركة إن وجدت.', control: c.text(p('activity'), { ph: 'مثال: اصنع مجسم اليوم الوطني (قسم الإلكترونيات والبرمجة وقسم الليزر)' }) })}
        {c.field({ key: 'imp', label: 'اسم المنفذ', req: 1, for: c.id(p('implementer')), control: c.text(p('implementer')) })}
        {c.field({ key: 'age', label: 'العمر المستهدف من النشاط', req: 1, for: c.id(p('ageMin')), control: <div className="tk-pair">{c.num(p('ageMin'), { sfx: 'سنة', ph: 'من' })}<span className="sep">إلى</span>{c.num(p('ageMax'), { sfx: 'سنة', ph: 'إلى', label: 'العمر إلى' })}</div> })}
        {c.field({ key: 'time', label: 'الفترة الزمنية', req: 1, for: c.id(p('timeFrom')), control: (
          <div className="ep-inline">
            <div className="tk-pair">{c.time(p('timeFrom'), 'من الساعة')}<span className="sep">إلى</span>{c.time(p('timeTo'), 'إلى الساعة')}</div>
            {c.seg(p('dayPart'), DAY_PARTS, `epl-dp-${base}`)}
          </div>
        ) })}
        {c.field({ key: 'date', label: 'التاريخ', req: 1, for: c.id(p('dateFrom')), control: (
          <div className="tk-pair">
            <span className="ep-dated">{c.date(p('dateFrom'), 'من تاريخ')}<small>{weekdayOf(f.dateFrom) || 'من يوم'}</small></span>
            <span className="sep">إلى</span>
            <span className="ep-dated">{c.date(p('dateTo'), 'إلى تاريخ')}<small>{weekdayOf(f.dateTo) || 'إلى يوم'}</small></span>
          </div>
        ) })}
        {c.field({ key: 'ben', label: 'عدد المستفيدين', req: 1, for: c.id(p('beneficiaries')), control: <>{c.num(p('beneficiaries'), { sfx: 'مستفيد', sfxW: 52, min: 1 })}{c.text(p('seatsNote'), { ph: 'توزيع المقاعد (اختياري) — مثال: 5 من قائمة الاحتضان، و10 مقاعد للتسجيل الخارجي', label: 'توزيع المقاعد' })}</> })}
        {c.field({ key: 'days', label: 'عدد الأيام الفعلية', req: 1, for: c.id(p('days')), control: c.text(p('days'), { ph: 'مثال: يوم واحد' }) })}
        {c.field({ key: 'g', label: 'الفئة المستهدفة', req: 1, labelId: `epl-g-${base}`, control: c.seg(p('gender'), GENDERS, `epl-g-${base}`) })}
      </div>

      <div className="ep-sub">
        <div className="ep-sub-head"><b>المحاور</b><span className="tk-req">*</span><small>عنوان كل محور ووصف مختصر لما يحدث فيه.</small></div>
        <div className="ep-axes" id={c.id(p('axes'))}>
          {f.axes.map((a, j) => (
            <div className="ep-axis" key={a.id}>
              <span className="ep-pn">{j + 1}</span>
              <div className="ep-axis-body">
                {c.text(p(`axes.${j}.title`), { ph: 'عنوان المحور — مثال: القص والحفر باستخدام آلة الليزر', label: `عنوان المحور ${j + 1}` })}
                {c.area(p(`axes.${j}.desc`), { ph: 'وصف مختصر', label: `وصف المحور ${j + 1}` })}
              </div>
              {!locked && <button type="button" className="tk-ibtn danger" onClick={() => c.update(n => { c.get(n, base).axes.splice(j, 1); })} aria-label={`حذف المحور ${j + 1}`} title="حذف المحور">🗑</button>}
            </div>
          ))}
        </div>
        {!locked && <div className="tk-list-foot"><button type="button" className="tk-add" onClick={() => c.update(n => { c.get(n, base).axes.push(MAKE_F.axis()); })}>＋ إضافة محور</button></div>}
      </div>

      <div className="ep-sub">
        <div className="ep-sub-head">
          <b>صور الإعلان</b><span className="tk-req">*</span>
          <small>{MEDIA_MIN_IMAGES} صور مناسبة على الأقل للحقيبة أو النشاط — تُعتمد قبل النشر.</small>
          <span className={`tk-pill ${f.images.length >= MEDIA_MIN_IMAGES ? 'mint' : 'amber'}`}>{f.images.length} / {MEDIA_MIN_IMAGES}</span>
        </div>
        <div className="tk-igrid" id={c.id(p('images'))}>
          {f.images.map((im, j) => (
            <figure className="tk-itile" key={im.fileId}>
              <div className="ph"><AuthedImage api={images.api} url={images.url(im.fileId)} alt={im.caption || 'صورة الإعلان'} /></div>
              <figcaption className="meta">{c.text(p(`images.${j}.caption`), { ph: 'وصف قصير للصورة', label: 'وصف الصورة' })}</figcaption>
              {!locked && <button type="button" className="tk-ibtn danger over" aria-label="حذف الصورة" title="حذف الصورة" onClick={() => images.remove(j)}>🗑</button>}
            </figure>
          ))}
          {images.busy.map(n => <div key={n} className="tk-drop" aria-busy="true"><span className="big">⏳</span><b>جارٍ رفع الصورة…</b><span>{n}</span></div>)}
          {!locked && (
            <label className="tk-drop"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('over'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('over')}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); images.add(e.dataTransfer.files); }}>
              <span className="big">🖼</span><b>أضف صورًا</b><span>اسحب الصور إلى هنا أو اضغط للاختيار.</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { images.add(e.target.files); e.target.value = ''; }} />
            </label>
          )}
        </div>
      </div>

      <div className="tk-grid" style={{ marginTop: 16 }}>
        {c.field({ key: 'due', label: 'تاريخ انتهاء التصميم', req: 1, for: c.id(p('dueDate')), control: <div className="ep-inline">{c.date(p('dueDate'), 'تاريخ انتهاء التصميم')}{c.seg(p('urgency'), URGENCY, `epl-u-${base}`)}</div> })}
        {c.field({ key: 'cost', label: 'تكلفة البرنامج', req: 1, for: c.id(p('cost')), hint: 'رسوم التسجيل للمشارك كما ستظهر في الإعلان، أو «مجاني».', control: c.text(p('cost'), { ph: 'مثال: 150 ر.س' }) })}
        {c.field({ key: 'nt', label: 'ملاحظات للتصميم', wide: 1, for: c.id(p('notes')), control: c.area(p('notes'), { rows: 2, ph: 'ألوان، عبارات، شعارات شركاء… (اختياري)' }) })}
      </div>
      <p className="tk-hint ep-foot-note">الرجاء إرسال التصميم للفريق التقني قبل النشر للمراجعة.</p>
    </div>
  );
};

export const VolunteerForm = ({ f, base, c, locked }) => {
  const p = (k) => `${base}.${k}`;
  const tot = volunteerTotals(f);
  return (
    <div className="ep-form">
      <div className="tk-grid">
        {c.field({ key: 'cn', label: 'منسق الفرص التطوعية', req: 1, for: c.id(p('coordinatorName')), control: c.text(p('coordinatorName')) })}
        {c.field({ key: 'cp', label: 'جوال المنسق', req: 1, for: c.id(p('coordinatorPhone')), control: c.text(p('coordinatorPhone'), { ph: '05xxxxxxxx', dir: 'ltr' }) })}
        {c.field({ key: 'loc', label: 'مكان التطوع', req: 1, for: c.id(p('location')), control: c.text(p('location'), { ph: 'مثال: فاب لاب الأحساء — البهو الرئيسي' }) })}
        {c.field({ key: 'mode', label: 'طريقة التطوع', req: 1, labelId: `epl-m-${base}`, control: c.seg(p('mode'), V_MODES, `epl-m-${base}`) })}
      </div>

      <div className="ep-sub">
        <div className="ep-sub-head"><b>الأدوار التطوعية</b><span className="tk-req">*</span><small>لكل دور: المجال، العدد، المهام، والأيام والساعات اليومية.</small></div>
        <div className="ep-roles" id={c.id(p('roles'))}>
          {f.roles.map((r, j) => {
            const q = (k) => p(`roles.${j}.${k}`);
            const calc = roleHours(r);
            const dated = has(r.dateFrom) && has(r.dateTo);
            return (
              <article className="ep-role" key={r.id}>
                <header className="ep-role-head">
                  <span className="ep-pn">{j + 1}</span>
                  <b>{r.title || 'دور تطوعي'}</b>
                  <span className="ep-role-calc">
                    {calc.perDay != null ? `${hrs(calc.perDay)} يوميًا` : 'الساعات —'} · {calc.days != null ? ar(calc.days, DAYS) : 'الأيام —'} · {calc.perVolunteer != null ? `${hrs(calc.perVolunteer)} لكل متطوع` : '—'}
                  </span>
                  {!locked && f.roles.length > 1 && <button type="button" className="tk-ibtn danger" onClick={() => c.update(n => { c.get(n, base).roles.splice(j, 1); })} aria-label={`حذف الدور ${j + 1}`} title="حذف الدور">🗑</button>}
                </header>
                <div className="tk-grid">
                  {c.field({ key: 't', label: 'المسمى / الدور', req: 1, for: c.id(q('title')), control: c.text(q('title'), { ph: 'مثال: منظم ركن الطباعة' }) })}
                  {c.field({ key: 'f', label: 'المجال أو التخصص', req: 1, for: c.id(q('field')), control: c.text(q('field'), { ph: 'مثال: الطباعة ثلاثية الأبعاد، التنظيم، التصوير' }) })}
                  {c.field({ key: 'n', label: 'عدد المتطوعين', req: 1, for: c.id(q('count')), control: c.num(q('count'), { sfx: 'متطوع', sfxW: 52, min: 1 }) })}
                  {c.field({ key: 'g', label: 'الجنس المفضل', req: 1, labelId: `epl-rg-${r.id}`, control: c.seg(q('gender'), V_GENDERS, `epl-rg-${r.id}`) })}
                  {c.field({ key: 'tk', label: 'المهام والمسؤوليات', req: 1, wide: 1, for: c.id(q('tasks')), control: c.area(q('tasks'), { rows: 2, ph: 'ما الذي سيقوم به المتطوع في هذا الدور؟' }) })}
                  {c.field({ key: 'sk', label: 'المهارات المطلوبة', for: c.id(q('skills')), control: c.area(q('skills'), { ph: 'اختياري' }) })}
                  {c.field({ key: 'ed', label: 'المؤهل العلمي', for: c.id(q('education')), control: c.text(q('education'), { ph: 'اختياري — مثال: طالب جامعي' }) })}
                  {c.field({ key: 'age', label: 'الفئة العمرية', for: c.id(q('ageMin')), control: <div className="tk-pair">{c.num(q('ageMin'), { sfx: 'سنة', ph: 'من' })}<span className="sep">إلى</span>{c.num(q('ageMax'), { sfx: 'سنة', ph: 'إلى', label: 'العمر إلى' })}</div> })}
                  {c.field({ key: 'd', label: 'الأيام المطلوبة', req: 1, wide: 1, for: c.id(q('dateFrom')), hint: 'من تاريخ إلى تاريخ، ثم أيام الأسبوع (بدون اختيار = كل الأيام). أو اكتب عدد الأيام إن لم تُحدد التواريخ بعد.', control: (
                    <div className="ep-days">
                      <div className="tk-pair">{c.date(q('dateFrom'), 'من تاريخ')}<span className="sep">إلى</span>{c.date(q('dateTo'), 'إلى تاريخ')}</div>
                      <div className="tk-picker" role="group" aria-label="أيام الأسبوع">
                        {WEEKDAYS.map(w => (
                          <button key={w} type="button" className="tk-pk out" aria-pressed={r.weekdays.includes(w)} disabled={locked}
                            onClick={() => c.update(n => { const x = c.get(n, base).roles[j]; const k = x.weekdays.indexOf(w); if (k > -1) x.weekdays.splice(k, 1); else x.weekdays.push(w); })}>{w}</button>
                        ))}
                      </div>
                      {!dated && <div className="ep-inline">{c.num(q('days'), { sfx: 'يومًا', min: 1, ph: 'عدد الأيام', label: 'عدد الأيام' })}</div>}
                      {dated && <small className="tk-muted-s">= {roleDays(r) != null ? ar(roleDays(r), DAYS) : '—'}</small>}
                    </div>
                  ) })}
                  {c.field({ key: 'h', label: 'الساعات في اليوم', req: 1, for: c.id(q('timeFrom')), control: <div className="tk-pair">{c.time(q('timeFrom'), 'من الساعة')}<span className="sep">إلى</span>{c.time(q('timeTo'), 'إلى الساعة')}</div> })}
                </div>
              </article>
            );
          })}
        </div>
        {!locked && <div className="tk-list-foot"><button type="button" className="tk-add" onClick={() => c.update(n => { c.get(n, base).roles.push(MAKE_F.role()); })}>＋ إضافة دور</button></div>}
        <p className="ep-total">الإجمالي: <b>{tot.volunteers ? ar(tot.volunteers, VOLS) : '—'}</b> · <b>{fmtH(tot.hours)}</b> ساعة تطوعية</p>
      </div>

      <div className="tk-grid" style={{ marginTop: 6 }}>
        {c.field({ key: 'sup', label: 'الدعم المقدم للمتطوع', for: c.id(p('support')), control: c.area(p('support'), { ph: 'مثال: شهادة تطوع، تدريب قبل الفعالية، وجبة خفيفة (اختياري)' }) })}
        {c.field({ key: 'risk', label: 'المخاطر والتحديات', for: c.id(p('risks')), control: c.area(p('risks'), { ph: 'اختياري' }) })}
      </div>
    </div>
  );
};
