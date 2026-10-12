import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/api';
import {
  listOf, totalOf, errMsg, fmtDate, absUrl, StatusPill, SmModal, FieldGrid, ImagePicker, Pager, EmptyState
} from './SiteShared';

// ───────────── Generic list + edit for media items / archived workshops ─────────────
const ContentCrud = ({
  isRTL, endpoint, fields, defaults, kindFilter, searchable, titleAr, titleEn, newAr, newEn,
  emptyAr, emptyEn, badge, subline, validate
}) => {
  const LIMIT = 24;
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState(null); // { id?, form, image?, preview?, removeImage }
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => { const t = setTimeout(() => setQDebounced(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setOffset(0); }, [kind, qDebounced]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (kind) params.kind = kind;
      if (qDebounced) params.q = qDebounced;
      const { data } = await api.get(endpoint, { params });
      setRows(listOf(data));
      setTotal(totalOf(data));
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر تحميل البيانات', 'Could not load'));
    } finally {
      setLoading(false);
    }
  }, [endpoint, kind, qDebounced, offset, isRTL]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setErrors({}); setEditing({ form: { ...defaults, ...(kind ? { kind } : {}) }, removeImage: false }); };
  const openEdit = (row) => {
    setErrors({});
    const form = {};
    fields.forEach(f => { form[f.key] = row[f.key] ?? (f.type === 'checkbox' ? false : ''); });
    if (form.date) form.date = String(form.date).slice(0, 10);
    if (form.startDate) form.startDate = String(form.startDate).slice(0, 10);
    if (form.endDate) form.endDate = String(form.endDate).slice(0, 10);
    setEditing({ id: row.id, form, imageUrl: row.imageUrl, removeImage: false });
  };

  const save = async () => {
    const errs = validate ? validate(editing.form, isRTL) : {};
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const body = { ...editing.form };
      if (editing.image) body.image = editing.image;
      else if (editing.removeImage) body.removeImage = true;
      if (editing.id) await api.put(`${endpoint}/${editing.id}`, body);
      else await api.post(endpoint, body);
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر الحفظ', 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(isRTL ? `حذف «${row.title || ''}»؟ لا يمكن التراجع.` : `Delete “${row.titleEn || row.title || ''}”? This can't be undone.`)) return;
    try {
      await api.delete(`${endpoint}/${row.id}`);
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      load();
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر الحذف', 'Could not delete'));
    }
  };

  const togglePublish = async (row) => {
    try {
      await api.put(`${endpoint}/${row.id}`, { isPublished: !row.isPublished });
      setRows(list => list.map(r => (r.id === row.id ? { ...r, isPublished: !row.isPublished } : r)));
    } catch (err) {
      toast.error(errMsg(err, isRTL));
    }
  };

  return (
    <div className="sm-section">
      <div className="sm-toolbar">
        <h3>{isRTL ? titleAr : titleEn} <span className="sm-count">{total}</span></h3>
        <div className="sm-toolbar-actions">
          {kindFilter && (
            <div className="sm-chips" role="tablist">
              {[{ v: '', ar: 'الكل', en: 'All' }, ...kindFilter].map(k => (
                <button key={k.v || 'all'} type="button" className={`sm-chip ${kind === k.v ? 'on' : ''}`} onClick={() => setKind(k.v)}>
                  {isRTL ? k.ar : k.en}
                </button>
              ))}
            </div>
          )}
          {searchable && (
            <input className="sm-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={isRTL ? 'بحث بالعنوان…' : 'Search titles…'} />
          )}
          <button type="button" className="sm-btn primary" onClick={openNew}>＋ {isRTL ? newAr : newEn}</button>
        </div>
      </div>

      {loading ? (
        <div className="sm-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="🗂️" text={isRTL ? emptyAr : emptyEn} />
      ) : (
        <div className="sm-cards">
          {rows.map(row => (
            <div key={row.id} className={`sm-card ${row.isPublished === false ? 'is-hidden' : ''}`}>
              <div className="sm-card-thumb">
                {row.imageUrl ? <img src={absUrl(row.imageUrl)} alt="" loading="lazy" /> : <span>{row.mediaType === 'video' ? '🎬' : '🖼️'}</span>}
                {row.mediaType === 'video' && row.imageUrl && <span className="sm-play" aria-hidden="true">▶</span>}
              </div>
              <div className="sm-card-body">
                <div className="sm-card-meta">
                  {badge && badge(row, isRTL)}
                  <span className="sm-card-date">{fmtDate(row.date || row.startDate, isRTL)}</span>
                </div>
                <div className="sm-card-title" dir="auto" title={row.title}>{isRTL ? (row.title || row.titleEn) : (row.titleEn || row.title)}</div>
                {subline && <div className="sm-card-sub" dir="auto">{subline(row, isRTL)}</div>}
              </div>
              <div className="sm-card-actions">
                <label className="sm-switch" title={isRTL ? 'منشور على الموقع' : 'Published on the site'}>
                  <input type="checkbox" checked={row.isPublished !== false} onChange={() => togglePublish(row)} />
                  <span>{row.isPublished !== false ? (isRTL ? 'منشور' : 'Live') : (isRTL ? 'مخفي' : 'Hidden')}</span>
                </label>
                {(row.link || row.videoUrl) && (
                  <a className="sm-icon-btn" href={row.videoUrl || row.link} target="_blank" rel="noopener noreferrer" title={isRTL ? 'فتح الرابط' : 'Open link'}>↗</a>
                )}
                <button type="button" className="sm-icon-btn" onClick={() => openEdit(row)} title={isRTL ? 'تعديل' : 'Edit'}>✎</button>
                <button type="button" className="sm-icon-btn danger" onClick={() => remove(row)} title={isRTL ? 'حذف' : 'Delete'}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pager isRTL={isRTL} offset={offset} limit={LIMIT} total={total} onChange={setOffset} />

      {editing && (
        <SmModal
          wide
          busy={saving}
          kicker={isRTL ? titleAr : titleEn}
          title={editing.id ? (isRTL ? 'تعديل' : 'Edit') : (isRTL ? newAr : newEn)}
          onClose={() => setEditing(null)}
          footer={<>
            <button type="button" className="wsr-btn ghost" onClick={() => setEditing(null)} disabled={saving}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
            <button type="button" className="wsr-btn" onClick={save} disabled={saving}>{saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ' : 'Save')}</button>
          </>}
        >
          <ImagePicker
            isRTL={isRTL}
            currentUrl={editing.imageUrl}
            preview={editing.preview}
            removed={editing.removeImage}
            onPick={(r, err) => {
              if (err) { toast.error(err); return; }
              setEditing(ed => ({ ...ed, image: r.payload, preview: r.preview, removeImage: false }));
            }}
            onRemove={() => setEditing(ed => ({ ...ed, image: null, preview: '', removeImage: true }))}
          />
          <FieldGrid fields={fields} value={editing.form} isRTL={isRTL} errors={errors} onChange={form => setEditing(ed => ({ ...ed, form }))} />
        </SmModal>
      )}
    </div>
  );
};

// ───────────── المركز الإعلامي ─────────────
const KINDS = [
  { v: 'news', ar: 'الأخبار', en: 'News' },
  { v: 'coverage', ar: 'التغطيات الإعلامية', en: 'Media coverage' },
  { v: 'report', ar: 'التقارير', en: 'Reports' }
];
const MEDIA_TYPES = [
  { v: 'image', ar: 'صورة', en: 'Image' },
  { v: 'video', ar: 'فيديو', en: 'Video' },
  { v: 'text', ar: 'نص / تقرير', en: 'Text / report' }
];
const requireTitle = (form, isRTL) => (String(form.title || '').trim() || String(form.titleEn || '').trim()
  ? {} : { title: isRTL ? 'اكتب العنوان' : 'Enter a title' });

export const SiteMediaSection = ({ isRTL }) => (
  <ContentCrud
    isRTL={isRTL}
    endpoint="/site-admin/media"
    titleAr="المركز الإعلامي" titleEn="Media center"
    newAr="إضافة خبر / مادة" newEn="Add item"
    emptyAr="لا توجد مواد إعلامية بعد — أضف خبراً أو استورد المحتوى من الموقع القديم من «نظرة عامة»."
    emptyEn="No media yet — add an item or import from the old site under “Overview”."
    kindFilter={KINDS}
    searchable
    validate={requireTitle}
    defaults={{ kind: 'news', mediaType: 'image', title: '', titleEn: '', description: '', descriptionEn: '', date: new Date().toISOString().slice(0, 10), category: '', link: '', videoUrl: '', duration: '', isPublished: true }}
    badge={(row, rtl) => {
      const k = KINDS.find(x => x.v === row.kind);
      return <span className={`sm-tag kind-${row.kind}`}>{k ? (rtl ? k.ar : k.en) : row.kind}</span>;
    }}
    subline={(row, rtl) => [row.category, row.mediaType === 'video' ? (rtl ? 'فيديو' : 'Video') : null, row.views ? `👁 ${row.views}` : null].filter(Boolean).join(' · ')}
    fields={[
      { key: 'kind', ar: 'القسم', en: 'Section', type: 'select', options: KINDS },
      { key: 'mediaType', ar: 'نوع المادة', en: 'Type', type: 'select', options: MEDIA_TYPES },
      { key: 'title', ar: 'العنوان (عربي)', en: 'Title (Arabic)', required: true, full: true, dir: 'rtl' },
      { key: 'titleEn', ar: 'العنوان (إنجليزي)', en: 'Title (English)', full: true, dir: 'ltr' },
      { key: 'description', ar: 'الوصف (عربي)', en: 'Description (Arabic)', type: 'textarea', full: true, dir: 'rtl' },
      { key: 'descriptionEn', ar: 'الوصف (إنجليزي)', en: 'Description (English)', type: 'textarea', full: true, dir: 'ltr' },
      { key: 'date', ar: 'التاريخ', en: 'Date', type: 'date' },
      { key: 'category', ar: 'التصنيف', en: 'Category' },
      { key: 'link', ar: 'رابط المنشور', en: 'Post link', dir: 'ltr', full: true },
      { key: 'videoUrl', ar: 'رابط الفيديو (يوتيوب / X)', en: 'Video URL (YouTube / X)', dir: 'ltr', full: true },
      { key: 'duration', ar: 'مدة الفيديو', en: 'Video duration', dir: 'ltr' },
      { key: 'isPublished', ar: 'منشور', en: 'Published', type: 'checkbox', hintAr: 'منشور على الموقع', hintEn: 'Published on the site' }
    ]}
  />
);

// ───────────── أرشيف الورش ─────────────
export const SiteArchiveSection = ({ isRTL }) => (
  <ContentCrud
    isRTL={isRTL}
    endpoint="/site-admin/workshops-archive"
    titleAr="أرشيف الورش" titleEn="Workshops archive"
    newAr="إضافة ورشة سابقة" newEn="Add past workshop"
    emptyAr="لا توجد ورش في الأرشيف — الورش الحالية تظهر تلقائياً من تبويب «الورش التدريبية»."
    emptyEn="No archived workshops — current workshops come automatically from the Workshops tab."
    searchable
    validate={requireTitle}
    defaults={{ title: '', titleEn: '', description: '', descriptionEn: '', duration: '', startDate: '', endDate: '', link: '', isPublished: true }}
    subline={(row, rtl) => [
      row.endDate && row.endDate !== row.startDate ? `${fmtDate(row.startDate, rtl)} → ${fmtDate(row.endDate, rtl)}` : null,
      row.duration ? (rtl ? `${row.duration} أيام` : `${row.duration} days`) : null
    ].filter(Boolean).join(' · ')}
    fields={[
      { key: 'title', ar: 'اسم الورشة (عربي)', en: 'Title (Arabic)', required: true, full: true, dir: 'rtl' },
      { key: 'titleEn', ar: 'اسم الورشة (إنجليزي)', en: 'Title (English)', full: true, dir: 'ltr' },
      { key: 'description', ar: 'الوصف (عربي)', en: 'Description (Arabic)', type: 'textarea', full: true, dir: 'rtl', rows: 5 },
      { key: 'descriptionEn', ar: 'الوصف (إنجليزي)', en: 'Description (English)', type: 'textarea', full: true, dir: 'ltr' },
      { key: 'startDate', ar: 'تاريخ البداية', en: 'Start date', type: 'date' },
      { key: 'endDate', ar: 'تاريخ النهاية', en: 'End date', type: 'date' },
      { key: 'duration', ar: 'المدة (أيام)', en: 'Duration (days)' },
      { key: 'link', ar: 'رابط المنشور', en: 'Post link', dir: 'ltr' },
      { key: 'isPublished', ar: 'منشور', en: 'Published', type: 'checkbox', hintAr: 'يظهر في صفحة الورش', hintEn: 'Shown on the workshops page' }
    ]}
  />
);

// ───────────── قصص النجاح ─────────────
const STORY_FIELDS = [
  { key: 'name', ar: 'الاسم', en: 'Name', required: true },
  { key: 'status', ar: 'الحالة', en: 'Status', type: 'select', options: [
    { v: 'pending', ar: 'بانتظار المراجعة', en: 'Pending' },
    { v: 'approved', ar: 'منشورة', en: 'Approved' },
    { v: 'rejected', ar: 'مرفوضة', en: 'Rejected' }
  ] },
  { key: 'email', ar: 'البريد', en: 'Email', dir: 'ltr' },
  { key: 'phone', ar: 'الجوال', en: 'Phone', dir: 'ltr' },
  { key: 'title', ar: 'عنوان القصة (عربي)', en: 'Title (Arabic)', full: true, dir: 'rtl' },
  { key: 'titleEn', ar: 'عنوان القصة (إنجليزي)', en: 'Title (English)', full: true, dir: 'ltr' },
  { key: 'story', ar: 'القصة (عربي)', en: 'Story (Arabic)', type: 'textarea', rows: 7, full: true, dir: 'rtl' },
  { key: 'storyEn', ar: 'القصة (إنجليزي)', en: 'Story (English)', type: 'textarea', rows: 5, full: true, dir: 'ltr' }
];

export const SiteStoriesSection = ({ isRTL, onChanged }) => {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/site-admin/stories', { params: status ? { status } : {} });
      setRows(listOf(data));
    } catch (err) {
      toast.error(errMsg(err, isRTL, 'تعذّر تحميل القصص', 'Could not load stories'));
    } finally {
      setLoading(false);
    }
  }, [status, isRTL]);
  useEffect(() => { load(); }, [load]);

  const setStoryStatus = async (row, next) => {
    try {
      await api.put(`/site-admin/stories/${row.id}`, { status: next });
      toast.success(next === 'approved' ? (isRTL ? 'تم نشر القصة' : 'Story published') : (isRTL ? 'تم رفض القصة' : 'Story rejected'));
      load(); onChanged && onChanged();
    } catch (err) { toast.error(errMsg(err, isRTL)); }
  };

  const remove = async (row) => {
    if (!window.confirm(isRTL ? `حذف قصة «${row.name}»؟` : `Delete ${row.name}'s story?`)) return;
    try { await api.delete(`/site-admin/stories/${row.id}`); toast.success(isRTL ? 'تم الحذف' : 'Deleted'); load(); onChanged && onChanged(); }
    catch (err) { toast.error(errMsg(err, isRTL)); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...editing.form };
      if (editing.image) body.image = editing.image;
      else if (editing.removeImage) body.removeImage = true;
      await api.put(`/site-admin/stories/${editing.id}`, body);
      toast.success(isRTL ? 'تم الحفظ' : 'Saved');
      setEditing(null); load(); onChanged && onChanged();
    } catch (err) { toast.error(errMsg(err, isRTL, 'تعذّر الحفظ', 'Could not save')); }
    finally { setSaving(false); }
  };

  return (
    <div className="sm-section">
      <div className="sm-toolbar">
        <h3>{isRTL ? 'قصص النجاح' : 'Success stories'} <span className="sm-count">{rows.length}</span></h3>
        <div className="sm-chips">
          {[{ v: 'pending', ar: 'بانتظار المراجعة', en: 'Pending' }, { v: 'approved', ar: 'منشورة', en: 'Approved' }, { v: 'rejected', ar: 'مرفوضة', en: 'Rejected' }, { v: '', ar: 'الكل', en: 'All' }].map(s => (
            <button key={s.v || 'all'} type="button" className={`sm-chip ${status === s.v ? 'on' : ''}`} onClick={() => setStatus(s.v)}>{isRTL ? s.ar : s.en}</button>
          ))}
        </div>
      </div>
      {loading ? <div className="sm-loading">{isRTL ? 'جارٍ التحميل…' : 'Loading…'}</div>
        : rows.length === 0 ? <EmptyState icon="🌟" text={isRTL ? 'لا توجد قصص في هذا التصنيف. يرسل الزوار قصصهم من صفحة «قصص النجاح» على الموقع.' : 'No stories here. Visitors send stories from the “Success stories” page.'} />
        : (
          <div className="sm-story-list">
            {rows.map(row => (
              <article key={row.id} className="sm-story">
                {row.imageUrl && <img className="sm-story-img" src={absUrl(row.imageUrl)} alt="" loading="lazy" />}
                <div className="sm-story-body">
                  <div className="sm-card-meta">
                    <StatusPill status={row.status} isRTL={isRTL} />
                    <span className="sm-card-date">{fmtDate(row.date || row.createdAt, isRTL)}</span>
                  </div>
                  <div className="sm-story-name">{row.name}{row.email && <a href={`mailto:${row.email}`} dir="ltr">{row.email}</a>}{row.phone && <a href={`tel:${row.phone}`} dir="ltr">{row.phone}</a>}</div>
                  {(row.title || row.titleEn) && <div className="sm-card-title">{isRTL ? (row.title || row.titleEn) : (row.titleEn || row.title)}</div>}
                  <p className="sm-story-text">{isRTL ? (row.story || row.storyEn) : (row.storyEn || row.story)}</p>
                </div>
                <div className="sm-story-actions">
                  {row.status !== 'approved' && <button type="button" className="sm-btn ok" onClick={() => setStoryStatus(row, 'approved')}>✓ {isRTL ? 'نشر' : 'Approve'}</button>}
                  {row.status !== 'rejected' && <button type="button" className="sm-btn ghost danger" onClick={() => setStoryStatus(row, 'rejected')}>✕ {isRTL ? 'رفض' : 'Reject'}</button>}
                  <button type="button" className="sm-icon-btn" onClick={() => {
                    const form = {}; STORY_FIELDS.forEach(f => { form[f.key] = row[f.key] ?? ''; });
                    setEditing({ id: row.id, form, imageUrl: row.imageUrl, removeImage: false });
                  }} title={isRTL ? 'تعديل' : 'Edit'}>✎</button>
                  <button type="button" className="sm-icon-btn danger" onClick={() => remove(row)} title={isRTL ? 'حذف' : 'Delete'}>🗑</button>
                </div>
              </article>
            ))}
          </div>
        )}

      {editing && (
        <SmModal wide busy={saving} kicker={isRTL ? 'قصص النجاح' : 'Success stories'} title={isRTL ? 'تعديل القصة' : 'Edit story'}
          onClose={() => setEditing(null)}
          footer={<>
            <button type="button" className="wsr-btn ghost" onClick={() => setEditing(null)} disabled={saving}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
            <button type="button" className="wsr-btn" onClick={save} disabled={saving}>{saving ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ' : 'Save')}</button>
          </>}>
          <ImagePicker isRTL={isRTL} currentUrl={editing.imageUrl} preview={editing.preview} removed={editing.removeImage}
            onPick={(r, err) => { if (err) { toast.error(err); return; } setEditing(ed => ({ ...ed, image: r.payload, preview: r.preview, removeImage: false })); }}
            onRemove={() => setEditing(ed => ({ ...ed, image: null, preview: '', removeImage: true }))} />
          <FieldGrid fields={STORY_FIELDS} value={editing.form} isRTL={isRTL} onChange={form => setEditing(ed => ({ ...ed, form }))} />
        </SmModal>
      )}
    </div>
  );
};

