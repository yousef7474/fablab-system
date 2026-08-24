import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Pre-composed messages the admin pastes into WhatsApp / SMS / email
// dozens of times a week. Persisted in the Settings table under
// `quick_messages` so admins can edit the copy without a redeploy.

const emptyTemplate = () => ({
  id: `msg-${Date.now()}`,
  title: '',
  tag: '',
  color: '#0ea5e9',
  url: '',
  body: ''
});

const COLOR_CHOICES = ['#EE2329', '#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b'];

const copyToClipboard = async (text, successMsg, isRTL) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMsg);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast.success(successMsg);
    } catch {
      window.prompt(isRTL ? 'انسخ يدوياً:' : 'Copy manually:', text);
    }
    ta.remove();
  }
};

const QuickMessages = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  // Per-card editing state — { [id]: draft } while the user is
  // modifying that card; committing saves the whole list back.
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/settings/quick-messages');
      setTemplates(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذّر تحميل الرسائل' : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.tag || '').toLowerCase().includes(q) ||
      (t.body || '').toLowerCase().includes(q)
    );
  }, [search, templates]);

  const toggleExpanded = (id) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const startEdit = (t) => {
    setDrafts(d => ({ ...d, [t.id]: { ...t } }));
    setExpanded(prev => new Set(prev).add(t.id));
  };
  const cancelEdit = (id) => setDrafts(d => {
    const n = { ...d }; delete n[id]; return n;
  });
  const patchDraft = (id, key, value) => setDrafts(d => ({
    ...d,
    [id]: { ...d[id], [key]: value }
  }));

  const persist = async (nextList) => {
    const { data } = await api.put('/settings/quick-messages', { messages: nextList });
    setTemplates(Array.isArray(data.messages) ? data.messages : nextList);
  };

  const saveDraft = async (id) => {
    const draft = drafts[id];
    if (!draft) return;
    if (!draft.title.trim() && !draft.body.trim()) {
      return toast.error(isRTL ? 'العنوان أو النص مطلوب' : 'Title or body required');
    }
    setSavingId(id);
    try {
      const next = templates.map(t => t.id === id ? { ...draft, title: draft.title.trim(), tag: draft.tag.trim(), url: draft.url.trim() } : t);
      await persist(next);
      cancelEdit(id);
      toast.success(isRTL ? '✅ تم الحفظ' : '✅ Saved');
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحفظ' : 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  const addNew = async () => {
    const t = emptyTemplate();
    const next = [...templates, t];
    setTemplates(next);
    startEdit(t);
    // Don't persist yet — user needs to fill it in first. When they
    // hit Save on the draft, persist() will commit the whole list.
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm(isRTL ? 'حذف هذه الرسالة نهائياً؟' : 'Delete this message permanently?')) return;
    setSavingId(id);
    try {
      const next = templates.filter(t => t.id !== id);
      await persist(next);
      cancelEdit(id);
      toast.success(isRTL ? '🗑️ تم الحذف' : '🗑️ Deleted');
    } catch (err) {
      toast.error(isRTL ? 'تعذّر الحذف' : 'Delete failed');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{
            margin: '0 0 6px', fontSize: 24, fontWeight: 800,
            color: 'var(--text-primary, #0f172a)'
          }}>
            💬 {isRTL ? 'رسائل جاهزة' : 'Quick Messages'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)', fontSize: 13 }}>
            {isRTL
              ? 'رسائل قابلة للتعديل — انسخ للاستخدام السريع، أو اضغط "تعديل" لتحديث النص واللون والرابط.'
              : 'Editable templates — copy for quick use, or hit "Edit" to update the text, color, or link.'}
          </p>
        </div>
        <button
          onClick={addNew}
          style={{
            padding: '10px 18px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
            color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', boxShadow: '0 6px 16px -6px rgba(14,165,233,0.5)',
            display: 'inline-flex', alignItems: 'center', gap: 6
          }}
        >
          + {isRTL ? 'رسالة جديدة' : 'New message'}
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={isRTL ? 'بحث في الرسائل...' : 'Search messages...'}
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 16
        }}>
          {filtered.map(t => {
            const isEditing = !!drafts[t.id];
            const draft = drafts[t.id] || t;
            const isExpanded = expanded.has(t.id);
            const c = draft.color || '#0ea5e9';
            return (
              <div
                key={t.id}
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
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, flexWrap: 'wrap'
                }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 220 }}>
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => patchDraft(t.id, 'title', e.target.value)}
                        placeholder={isRTL ? 'عنوان الرسالة' : 'Title'}
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
                          onChange={(e) => patchDraft(t.id, 'tag', e.target.value)}
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
                              onClick={() => patchDraft(t.id, 'color', col)}
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
                        {t.tag || (isRTL ? 'رسالة' : 'Message')}
                      </div>
                      <div style={{
                        marginTop: 2, fontSize: 16, fontWeight: 700,
                        color: 'var(--text-primary, #0f172a)'
                      }}>
                        {t.title || (isRTL ? '(بدون عنوان)' : '(untitled)')}
                      </div>
                    </div>
                  )}
                  {!isEditing && t.url && (
                    <span
                      title={t.url}
                      style={{
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                        fontSize: 11, color: c, background: c + '11',
                        border: `1px solid ${c}33`,
                        padding: '3px 8px', borderRadius: 999,
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        direction: 'ltr'
                      }}
                    >
                      🔗 {t.url.replace(/^https?:\/\//, '')}
                    </span>
                  )}
                </div>

                {isEditing && (
                  <div style={{
                    padding: '10px 18px',
                    background: 'var(--bg-secondary, #f8fafc)',
                    borderBottom: '1px solid var(--border-color, #e2e8f0)'
                  }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                      {isRTL ? 'رابط الزر (اختياري)' : 'Button URL (optional)'}
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={draft.url}
                      onChange={(e) => patchDraft(t.id, 'url', e.target.value)}
                      placeholder="https://..."
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: '1px solid var(--border-color, #cbd5e1)',
                        background: 'var(--card-bg, #fff)',
                        color: 'var(--text-primary, #0f172a)',
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13
                      }}
                    />
                  </div>
                )}

                {/* Preview / edit */}
                {isEditing ? (
                  <textarea
                    value={draft.body}
                    onChange={(e) => patchDraft(t.id, 'body', e.target.value)}
                    placeholder={isRTL ? 'نص الرسالة الكامل...' : 'Full message body...'}
                    rows={12}
                    style={{
                      padding: '14px 18px',
                      flex: 1,
                      minHeight: 240,
                      background: 'var(--bg-secondary, #f8fafc)',
                      color: 'var(--text-primary, #0f172a)',
                      fontSize: 13, lineHeight: 1.7,
                      fontFamily: 'inherit',
                      border: 'none',
                      resize: 'vertical',
                      whiteSpace: 'pre-wrap',
                      outline: 'none',
                      borderBottom: '1px solid var(--border-color, #e2e8f0)'
                    }}
                  />
                ) : (
                  <div style={{
                    padding: '14px 18px',
                    flex: 1,
                    background: 'var(--bg-secondary, #f8fafc)',
                    fontSize: 13, lineHeight: 1.7,
                    color: 'var(--text-secondary, #475569)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: isExpanded ? 'none' : 140,
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {t.body || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{isRTL ? '(بدون محتوى)' : '(no content)'}</span>}
                    {!isExpanded && t.body && t.body.length > 220 && (
                      <div style={{
                        position: 'absolute', inset: 'auto 0 0 0',
                        height: 50,
                        background: 'linear-gradient(180deg, transparent, var(--bg-secondary, #f8fafc))'
                      }} />
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
                        onClick={() => saveDraft(t.id)}
                        disabled={savingId === t.id}
                        style={{
                          flex: '1 1 140px', padding: '10px 14px',
                          borderRadius: 8, border: 'none',
                          background: 'linear-gradient(135deg, #16a34a, #15803d)',
                          color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer',
                          opacity: savingId === t.id ? 0.6 : 1
                        }}
                      >
                        {savingId === t.id ? '…' : (isRTL ? '💾 حفظ' : '💾 Save')}
                      </button>
                      <button
                        onClick={() => cancelEdit(t.id)}
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
                        onClick={() => deleteTemplate(t.id)}
                        disabled={savingId === t.id}
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
                        onClick={() => copyToClipboard(t.body, isRTL ? '✅ تم نسخ الرسالة' : '✅ Message copied', isRTL)}
                        style={{
                          flex: '1 1 140px', padding: '10px 14px',
                          borderRadius: 8, border: 'none',
                          background: c, color: '#fff',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6
                        }}
                      >
                        📋 {isRTL ? 'نسخ الرسالة' : 'Copy message'}
                      </button>
                      {t.url && (
                        <button
                          onClick={() => copyToClipboard(t.url, isRTL ? '🔗 تم نسخ الرابط' : '🔗 Link copied', isRTL)}
                          style={{
                            padding: '10px 14px', borderRadius: 8,
                            border: `1px solid ${c}55`,
                            background: c + '11', color: c,
                            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                            cursor: 'pointer'
                          }}
                        >
                          🔗 {isRTL ? 'نسخ الرابط' : 'Copy link'}
                        </button>
                      )}
                      {t.url && (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '10px 14px', borderRadius: 8,
                            border: '1px solid var(--border-color, #cbd5e1)',
                            background: 'var(--card-bg, #fff)', color: 'var(--text-primary, #334155)',
                            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                            textDecoration: 'none',
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}
                        >
                          ↗ {isRTL ? 'فتح' : 'Open'}
                        </a>
                      )}
                      <button
                        onClick={() => startEdit(t)}
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
                      <button
                        onClick={() => toggleExpanded(t.id)}
                        style={{
                          padding: '10px 14px', borderRadius: 8,
                          border: '1px solid var(--border-color, #cbd5e1)',
                          background: 'transparent', color: 'var(--text-secondary, #64748b)',
                          fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                          cursor: 'pointer'
                        }}
                      >
                        {isExpanded ? (isRTL ? 'إخفاء' : 'Collapse') : (isRTL ? 'عرض كامل' : 'Expand')}
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
          {templates.length === 0
            ? (isRTL ? 'لا توجد رسائل بعد. اضغط "رسالة جديدة" للإضافة.' : 'No messages yet. Click "New message" to add one.')
            : (isRTL ? 'لا توجد نتائج مطابقة.' : 'No matching messages.')}
        </div>
      )}
    </div>
  );
};

export default QuickMessages;
