import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Reusable form-file library — mirrors the QuickMessages tab but each
// entry carries a downloadable file (Word / PDF / Excel / etc.)
// instead of a text body. Persisted in the Settings table under
// `quick_forms`; employees browse the list and hit Download to grab
// a fresh copy of the file they need.

const MAX_FORM_MB = 10;
const COLOR_CHOICES = ['#8b5cf6', '#EE2329', '#2563eb', '#16a34a', '#f59e0b', '#0ea5e9', '#ec4899', '#64748b'];

const emptyTemplate = () => ({
  id: `form-${Date.now()}`,
  title: '',
  description: '',
  tag: '',
  color: '#8b5cf6',
  fileName: '',
  fileType: '',
  fileSize: 0,
  fileData: '', // base64 (empty until admin picks a file)
  updatedAt: new Date().toISOString()
});

// Nice file-type icon per extension.
const iconFor = (ext) => {
  const e = String(ext || '').toLowerCase();
  if (['doc', 'docx'].includes(e)) return '📄';
  if (['xls', 'xlsx', 'csv'].includes(e)) return '📊';
  if (['ppt', 'pptx'].includes(e)) return '📽️';
  if (['pdf'].includes(e)) return '📕';
  if (['zip', 'rar', '7z'].includes(e)) return '📦';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(e)) return '🖼️';
  return '📎';
};
const humanBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

// Read a File → { fileData (base64), fileName, fileType, fileSize }.
const readAsFilePayload = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    // stripped to raw base64 (dataURL prefix removed)
    const raw = String(reader.result || '');
    const i = raw.indexOf(',');
    const b64 = i >= 0 ? raw.slice(i + 1) : raw;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    resolve({
      fileData: b64,
      fileName: file.name,
      fileType: ext,
      fileSize: file.size
    });
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Trigger a browser download for a base64 payload.
const triggerDownload = (b64, fileName, fileType) => {
  try {
    const byteChars = atob(b64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const mimeGuess = ({
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      zip: 'application/zip',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg'
    }[String(fileType).toLowerCase()]) || 'application/octet-stream';
    const blob = new Blob([bytes], { type: mimeGuess });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `download.${fileType || 'bin'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    return true;
  } catch (err) {
    console.error('download failed:', err);
    return false;
  }
};

const QuickForms = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState({});      // { [id]: draft }
  const [savingId, setSavingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const fileInputRef = useRef(null);
  const [pendingFileTarget, setPendingFileTarget] = useState(null); // which draft's file input triggered

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings/quick-forms');
      setForms(Array.isArray(data.forms) ? data.forms : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذّر تحميل الفورمات' : 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter(f =>
      (f.title || '').toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q) ||
      (f.tag || '').toLowerCase().includes(q) ||
      (f.fileName || '').toLowerCase().includes(q)
    );
  }, [search, forms]);

  const startEdit = (f) => setDrafts(d => ({ ...d, [f.id]: { ...f } }));
  const cancelEdit = (id) => setDrafts(d => {
    const n = { ...d }; delete n[id]; return n;
  });
  const patchDraft = (id, key, value) => setDrafts(d => ({
    ...d, [id]: { ...d[id], [key]: value }
  }));

  const persist = async (nextList) => {
    // Ship the full list back; server returns without fileData so we
    // merge in-place to preserve existing base64 in local state.
    const { data } = await api.put('/settings/quick-forms', { forms: nextList });
    const stripped = Array.isArray(data.forms) ? data.forms : [];
    setForms(prev => {
      const byId = Object.fromEntries(prev.map(x => [x.id, x]));
      return stripped.map(s => ({
        ...byId[s.id],   // keep local fileData if we had it
        ...s,
        fileData: (nextList.find(n => n.id === s.id)?.fileData) || byId[s.id]?.fileData || ''
      }));
    });
  };

  const saveDraft = async (id) => {
    const draft = drafts[id];
    if (!draft) return;
    if (!draft.title.trim() && !draft.fileData) {
      return toast.error(isRTL ? 'العنوان أو الملف مطلوب' : 'Title or file required');
    }
    setSavingId(id);
    try {
      const next = forms.map(f => f.id === id ? {
        ...draft,
        title: draft.title.trim(),
        description: draft.description.trim(),
        tag: draft.tag.trim(),
        updatedAt: new Date().toISOString()
      } : f);
      await persist(next);
      cancelEdit(id);
      toast.success(isRTL ? '✅ تم الحفظ' : '✅ Saved');
    } catch (err) {
      toast.error(err?.response?.data?.messageAr || err?.response?.data?.message || (isRTL ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSavingId(null);
    }
  };

  const addNew = () => {
    const t = emptyTemplate();
    setForms(prev => [...prev, t]);
    startEdit(t);
  };

  const deleteForm = async (id) => {
    if (!window.confirm(isRTL ? 'حذف هذا الفورم نهائياً؟' : 'Delete this form permanently?')) return;
    setSavingId(id);
    try {
      const next = forms.filter(f => f.id !== id);
      await persist(next);
      cancelEdit(id);
      toast.success(isRTL ? '🗑️ تم الحذف' : '🗑️ Deleted');
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    } finally {
      setSavingId(null);
    }
  };

  const pickFileFor = (id) => {
    setPendingFileTarget(id);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };
  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    const targetId = pendingFileTarget;
    setPendingFileTarget(null);
    if (!file || !targetId) return;
    if (file.size > MAX_FORM_MB * 1024 * 1024) {
      return toast.error(isRTL
        ? `الملف كبير جداً (الحد ${MAX_FORM_MB} MB)`
        : `File too large (max ${MAX_FORM_MB} MB)`);
    }
    try {
      const payload = await readAsFilePayload(file);
      patchDraft(targetId, 'fileData', payload.fileData);
      patchDraft(targetId, 'fileName', payload.fileName);
      patchDraft(targetId, 'fileType', payload.fileType);
      patchDraft(targetId, 'fileSize', payload.fileSize);
      // Nice default title if empty
      const draft = drafts[targetId];
      if (draft && !draft.title.trim()) {
        patchDraft(targetId, 'title', payload.fileName.replace(/\.[^.]+$/, ''));
      }
      toast.success(isRTL ? '📎 تم اختيار الملف — احفظ للتأكيد' : '📎 File selected — save to confirm');
    } catch {
      toast.error(isRTL ? 'تعذّرت قراءة الملف' : 'Failed to read file');
    }
  };

  const downloadForm = async (form) => {
    if (!form?.id) return;
    setDownloadingId(form.id);
    try {
      let payload = form;
      // Server strips fileData on list; fetch the full payload now.
      if (!payload.fileData) {
        const { data } = await api.get(`/settings/quick-forms/${form.id}/download`);
        payload = data;
      }
      const ok = triggerDownload(payload.fileData, payload.fileName, payload.fileType);
      if (ok) toast.success(isRTL ? '⬇️ جاري التنزيل' : '⬇️ Downloading');
      else toast.error(isRTL ? 'تعذّر التنزيل' : 'Download failed');
    } catch (err) {
      toast.error(err?.response?.data?.message || (isRTL ? 'تعذّر التنزيل' : 'Download failed'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div style={{ padding: '4px 2px' }}>
      {/* Hidden file input reused across all cards */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChosen}
      />

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{
            margin: '0 0 6px', fontSize: 24, fontWeight: 800,
            color: 'var(--text-primary, #0f172a)'
          }}>
            📁 {isRTL ? 'الفورم الجاهز' : 'Ready Forms'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)', fontSize: 13 }}>
            {isRTL
              ? 'مكتبة فورمات جاهزة (Word / PDF / Excel...) يمكن للموظفين تنزيلها والاستفادة منها عند الحاجة.'
              : 'Library of ready-to-use form files (Word / PDF / Excel...) employees can download when needed.'}
          </p>
        </div>
        <button
          onClick={addNew}
          style={{
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', boxShadow: '0 6px 16px -6px rgba(139, 92, 246, 0.5)',
            display: 'inline-flex', alignItems: 'center', gap: 6
          }}
        >
          + {isRTL ? 'فورم جديد' : 'New form'}
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={isRTL ? 'بحث بالعنوان أو الوصف أو التصنيف أو اسم الملف...' : 'Search by title, description, tag, filename...'}
        style={{
          width: '100%', maxWidth: 480,
          padding: '10px 14px', borderRadius: 10,
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--card-bg, #fff)',
          color: 'var(--text-primary, #0f172a)',
          fontFamily: 'inherit', fontSize: 14,
          marginBottom: 20
        }}
      />

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
          {isRTL ? 'جارٍ التحميل...' : 'Loading...'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16
        }}>
          {filtered.map(f => {
            const isEditing = !!drafts[f.id];
            const draft = drafts[f.id] || f;
            const c = draft.color || '#8b5cf6';
            const hasFile = !!(draft.fileData || (f.hasFile || f.fileName));
            return (
              <div
                key={f.id}
                style={{
                  background: 'var(--card-bg, #fff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  borderInlineStart: `4px solid ${c}`
                }}
              >
                {/* Header */}
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: 10, flexWrap: 'wrap'
                }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 220 }}>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => patchDraft(f.id, 'title', e.target.value)}
                        placeholder={isRTL ? 'عنوان الفورم' : 'Form title'}
                        style={{
                          padding: '9px 12px', borderRadius: 8,
                          border: '1px solid var(--border-color, #cbd5e1)',
                          background: 'var(--card-bg, #fff)',
                          color: 'var(--text-primary, #0f172a)',
                          fontFamily: 'inherit', fontSize: 15, fontWeight: 700
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={draft.tag}
                          onChange={(e) => patchDraft(f.id, 'tag', e.target.value)}
                          placeholder={isRTL ? 'التصنيف (اختياري)' : 'Tag'}
                          style={{
                            flex: '1 1 100px', padding: '8px 12px', borderRadius: 8,
                            border: '1px solid var(--border-color, #cbd5e1)',
                            background: 'var(--card-bg, #fff)',
                            color: 'var(--text-primary, #0f172a)',
                            fontFamily: 'inherit', fontSize: 12
                          }}
                        />
                        <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                          {COLOR_CHOICES.map(col => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => patchDraft(f.id, 'color', col)}
                              title={col}
                              style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: col, cursor: 'pointer',
                                border: draft.color === col ? '3px solid #0f172a' : '1px solid #e5e7eb',
                                padding: 0
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: c,
                        letterSpacing: 0.5, textTransform: 'uppercase'
                      }}>
                        {f.tag || (isRTL ? 'فورم' : 'Form')}
                      </div>
                      <div style={{
                        marginTop: 2, fontSize: 16, fontWeight: 700,
                        color: 'var(--text-primary, #0f172a)'
                      }}>
                        {f.title || (isRTL ? '(بدون عنوان)' : '(untitled)')}
                      </div>
                    </div>
                  )}
                  {hasFile && !isEditing && (
                    <span
                      title={f.fileName}
                      style={{
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                        fontSize: 11, color: c, background: c + '11',
                        border: `1px solid ${c}33`,
                        padding: '3px 9px', borderRadius: 999,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}
                    >
                      {iconFor(f.fileType)} {(f.fileType || 'file').toUpperCase()} · {humanBytes(f.fileSize)}
                    </span>
                  )}
                </div>

                {/* Description / edit area */}
                {isEditing ? (
                  <>
                    <textarea
                      value={draft.description}
                      onChange={(e) => patchDraft(f.id, 'description', e.target.value)}
                      placeholder={isRTL ? 'وصف قصير: متى يُستخدم هذا الفورم؟' : 'Short description: when is this form used?'}
                      rows={3}
                      style={{
                        padding: '12px 18px',
                        background: 'var(--bg-secondary, #f8fafc)',
                        color: 'var(--text-primary, #0f172a)',
                        fontSize: 13, lineHeight: 1.7,
                        fontFamily: 'inherit',
                        border: 'none',
                        resize: 'vertical',
                        outline: 'none',
                        borderBottom: '1px solid var(--border-color, #e2e8f0)'
                      }}
                    />
                    {/* File picker area */}
                    <div style={{
                      padding: '14px 18px',
                      background: 'var(--bg-secondary, #f8fafc)',
                      borderBottom: '1px solid var(--border-color, #e2e8f0)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => pickFileFor(f.id)}
                          style={{
                            padding: '10px 16px', borderRadius: 8,
                            border: `2px dashed ${c}`,
                            background: c + '11', color: c,
                            fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 6
                          }}
                        >
                          📎 {draft.fileName ? (isRTL ? 'استبدال الملف' : 'Replace file') : (isRTL ? 'اختيار ملف' : 'Choose file')}
                        </button>
                        {draft.fileName && (
                          <div style={{ fontSize: 12, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>
                            {iconFor(draft.fileType)} {draft.fileName} · <b>{humanBytes(draft.fileSize)}</b>
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>
                        {isRTL
                          ? `الحد الأقصى ${MAX_FORM_MB} MB — الصيغ المدعومة: Word / PDF / Excel / PowerPoint / صور / ZIP`
                          : `Max ${MAX_FORM_MB} MB — Word / PDF / Excel / PowerPoint / images / ZIP`}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{
                    padding: '14px 18px',
                    flex: 1,
                    background: 'var(--bg-secondary, #f8fafc)',
                    fontSize: 13, lineHeight: 1.7,
                    color: 'var(--text-secondary, #475569)',
                    whiteSpace: 'pre-wrap',
                    minHeight: 60
                  }}>
                    {f.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{isRTL ? '(لا يوجد وصف)' : '(no description)'}</span>}
                    {hasFile && (
                      <div style={{ marginTop: 10, fontSize: 12, color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                        {iconFor(f.fileType)} <b>{f.fileName || (isRTL ? '(بدون اسم ملف)' : '(no filename)')}</b>
                        {f.fileSize ? ` · ${humanBytes(f.fileSize)}` : ''}
                        {f.updatedAt && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8', fontFamily: 'inherit' }}>
                            {isRTL ? 'آخر تحديث: ' : 'Updated: '}
                            {new Date(f.updatedAt).toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-CA')}
                          </div>
                        )}
                      </div>
                    )}
                    {!hasFile && (
                      <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                        ⚠️ {isRTL ? 'لم يتم إرفاق ملف بعد — اضغط "تعديل" لإرفاقه.' : 'No file attached yet — click "Edit" to attach.'}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{
                  padding: 12,
                  display: 'flex', gap: 8, flexWrap: 'wrap',
                  borderTop: '1px solid var(--border-color, #e2e8f0)',
                  background: 'var(--card-bg, #fff)'
                }}>
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveDraft(f.id)}
                        disabled={savingId === f.id}
                        style={{
                          flex: '1 1 140px', padding: '10px 14px',
                          borderRadius: 8, border: 'none',
                          background: 'linear-gradient(135deg, #16a34a, #15803d)',
                          color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer',
                          opacity: savingId === f.id ? 0.6 : 1
                        }}
                      >
                        {savingId === f.id ? '…' : (isRTL ? '💾 حفظ' : '💾 Save')}
                      </button>
                      <button
                        onClick={() => cancelEdit(f.id)}
                        style={{
                          padding: '10px 14px', borderRadius: 8,
                          border: '1px solid var(--border-color, #cbd5e1)',
                          background: 'var(--card-bg, #fff)', color: 'var(--text-secondary, #334155)',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        onClick={() => deleteForm(f.id)}
                        disabled={savingId === f.id}
                        style={{
                          marginInlineStart: 'auto',
                          padding: '10px 14px', borderRadius: 8,
                          border: '1px solid #fecaca',
                          background: '#fff', color: '#dc2626',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ {isRTL ? 'حذف' : 'Delete'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => downloadForm(f)}
                        disabled={!hasFile || downloadingId === f.id}
                        style={{
                          flex: '1 1 140px', padding: '10px 14px',
                          borderRadius: 8, border: 'none',
                          background: hasFile ? c : '#e5e7eb',
                          color: hasFile ? '#fff' : '#94a3b8',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                          cursor: hasFile ? 'pointer' : 'not-allowed',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        {downloadingId === f.id ? '…' : (isRTL ? '⬇️ تنزيل الفورم' : '⬇️ Download form')}
                      </button>
                      <button
                        onClick={() => startEdit(f)}
                        style={{
                          padding: '10px 14px', borderRadius: 8,
                          border: '1px solid var(--border-color, #cbd5e1)',
                          background: 'transparent', color: 'var(--text-primary, #334155)',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ {isRTL ? 'تعديل' : 'Edit'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center',
          color: 'var(--text-secondary, #94a3b8)',
          background: 'var(--card-bg, #fff)',
          border: '1px dashed var(--border-color, #e2e8f0)',
          borderRadius: 12
        }}>
          {forms.length === 0
            ? (isRTL ? 'لا توجد فورمات بعد. اضغط "فورم جديد" للإضافة.' : 'No forms yet. Click "New form" to add one.')
            : (isRTL ? 'لا توجد نتائج مطابقة.' : 'No matching forms.')}
        </div>
      )}
    </div>
  );
};

export default QuickForms;
