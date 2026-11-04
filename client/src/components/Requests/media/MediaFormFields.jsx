import React from 'react';
import { AuthedImage } from '../../TrainingKits/KitParts';
import { DAY_PARTS, GENDERS, URGENCY, MEDIA_MIN_IMAGES, makeAxis, weekdayOf } from './mediaForm';
import '../../ExecutionPlans/Plans.css';

/**
 * «نموذج اعتماد طلب تصميم إعلان (لقسم، ورشة، برامج)» — the fields of the
 * media design request. The editor passes its field builders in `c`
 * (field, text, area, num, date, time, seg, id, update, get) bound to
 * `base` (e.g. 'form'), and `images` = { api, url(fileId), add(files),
 * remove(index), busy: [names] }.
 */
const MediaFormFields = ({ f, base, c, locked, images }) => {
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
            {c.seg(p('dayPart'), DAY_PARTS, `mrl-dp-${base}`)}
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
        {c.field({ key: 'g', label: 'الفئة المستهدفة', req: 1, labelId: `mrl-g-${base}`, control: c.seg(p('gender'), GENDERS, `mrl-g-${base}`) })}
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
        {!locked && <div className="tk-list-foot"><button type="button" className="tk-add" onClick={() => c.update(n => { c.get(n, base).axes.push(makeAxis()); })}>＋ إضافة محور</button></div>}
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
        {c.field({ key: 'due', label: 'تاريخ انتهاء التصميم', req: 1, for: c.id(p('dueDate')), control: <div className="ep-inline">{c.date(p('dueDate'), 'تاريخ انتهاء التصميم')}{c.seg(p('urgency'), URGENCY, `mrl-u-${base}`)}</div> })}
        {c.field({ key: 'cost', label: 'تكلفة البرنامج', req: 1, for: c.id(p('cost')), hint: 'رسوم التسجيل للمشارك كما ستظهر في الإعلان، أو «مجاني».', control: c.text(p('cost'), { ph: 'مثال: 150 ر.س' }) })}
        {c.field({ key: 'nt', label: 'ملاحظات للتصميم', wide: 1, for: c.id(p('notes')), control: c.area(p('notes'), { rows: 2, ph: 'ألوان، عبارات، شعارات شركاء… (اختياري)' }) })}
      </div>
      <p className="tk-hint ep-foot-note">الرجاء إرسال التصميم للفريق التقني قبل النشر للمراجعة.</p>
    </div>
  );
};

export default MediaFormFields;
