import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api from '../../config/api';
import TechnicalTrainerContractModal from './TechnicalTrainerContractModal';

// Contracts tab — admin-visible library of printable contract templates
// PLUS a persistent archive of every filled contract. Templates open a
// form modal that saves to /api/contracts; the archive at the bottom
// lists saved contracts and lets the admin re-open (edit + reprint) or
// delete each one. Adding a new template = add another card + modal
// case in `openArchive` / `templateMeta` below.

const TEMPLATE_META = {
  'technical-trainer': {
    titleAr: 'عقد تعاوني — مدرب تقني',
    titleEn: 'Cooperation Contract — Technical Trainer',
    accent: '#0f172a'
  }
};

const fmtWhen = (iso, isRTL) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      year: 'numeric', month: 'short', day: '2-digit'
    });
    const timeStr = d.toLocaleTimeString(isRTL ? 'ar-SA-u-nu-latn' : 'en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    return `${dateStr} · ${timeStr}`;
  } catch { return String(iso); }
};

const ContractsManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Which template's create-form is currently open. null when closed.
  const [openTemplate, setOpenTemplate] = useState(null);
  // Existing archived contract being edited/reprinted. When set, the
  // matching template modal opens pre-filled with its data.
  const [editingContract, setEditingContract] = useState(null);

  const [archive, setArchive] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [search, setSearch] = useState('');

  const fetchArchive = useCallback(async () => {
    setLoadingArchive(true);
    try {
      const res = await api.get('/contracts');
      setArchive(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading contracts archive:', err);
      toast.error(isRTL ? 'تعذر تحميل الأرشيف' : 'Failed to load archive');
    } finally {
      setLoadingArchive(false);
    }
  }, [isRTL]);

  useEffect(() => { fetchArchive(); }, [fetchArchive]);

  const templates = [
    {
      id: 'technical-trainer',
      titleAr: TEMPLATE_META['technical-trainer'].titleAr,
      titleEn: TEMPLATE_META['technical-trainer'].titleEn,
      descAr: 'عقد تعاون لمدرب تقني ضمن برنامج تدريبي، يشمل مدة العقد، المهام، شروط الاستحقاق، والمكافأة.',
      descEn: 'Cooperation contract for a technical trainer inside a training program, covering duration, tasks, entitlement conditions and compensation.',
      accent: '#0f172a',
      accentSoft: 'rgba(15, 23, 42, 0.06)',
      icon: (
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="15" y2="17"/>
        </svg>
      )
    }
  ];

  const openEdit = (contract) => {
    setEditingContract(contract);
    setOpenTemplate(contract.templateId);
  };

  const closeAllModals = () => {
    setOpenTemplate(null);
    setEditingContract(null);
  };

  const handleSaved = (saved) => {
    // Refresh the archive list after a successful save/update so the
    // new/edited row appears immediately.
    setArchive(prev => {
      const existing = prev.findIndex(c => c.contractId === saved.contractId);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleDelete = async (contract) => {
    const label = contract.title || (isRTL ? 'هذا العقد' : 'this contract');
    if (!window.confirm(isRTL ? `حذف "${label}" نهائياً؟` : `Delete "${label}" permanently?`)) return;
    try {
      await api.delete(`/contracts/${contract.contractId}`);
      setArchive(prev => prev.filter(c => c.contractId !== contract.contractId));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      console.error('Error deleting contract:', err);
      toast.error(isRTL ? 'تعذر الحذف' : 'Delete failed');
    }
  };

  // Reprint straight from the archive without opening the edit form.
  // Opens the same template modal in "auto-print" mode by pre-filling
  // and immediately triggering the modal's print flow via a hidden
  // helper — implemented by first setting editingContract then
  // programmatically dispatching print. For simplicity we just open
  // the modal in edit mode so the admin can hit "Print only".
  const handleReprint = (contract) => openEdit(contract);

  const filteredArchive = archive.filter(c => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const inTitle = (c.title || '').toLowerCase().includes(q);
    const inTemplate = (TEMPLATE_META[c.templateId]?.titleAr || '').toLowerCase().includes(q)
                    || (TEMPLATE_META[c.templateId]?.titleEn || '').toLowerCase().includes(q);
    return inTitle || inTemplate;
  });

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '4px 2px' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: '#0f172a', letterSpacing: 1 }}>
          {isRTL ? 'العقود' : 'Contracts'}
        </h2>
        <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
          {isRTL
            ? 'مكتبة نماذج العقود القابلة للطباعة. عبّئ النموذج، احفظه في الأرشيف، وأعِد فتحه لاحقاً للتعديل أو إعادة الطباعة.'
            : 'A library of printable contract templates. Fill the form, save it to the archive, and reopen anytime to edit or reprint.'}
        </p>
      </div>

      {/* Templates grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16,
        marginBottom: 28
      }}>
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => { setEditingContract(null); setOpenTemplate(t.id); }}
            style={{
              textAlign: isRTL ? 'right' : 'left',
              background: '#ffffff',
              border: `2px solid ${t.accent}`,
              borderRadius: 12,
              padding: '18px 20px',
              cursor: 'pointer',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
              boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(15, 23, 42, 0.14)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(15, 23, 42, 0.06)';
            }}
          >
            <div style={{
              flexShrink: 0,
              width: 52, height: 52,
              borderRadius: 12,
              background: t.accentSoft,
              color: t.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {t.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                {isRTL ? t.titleAr : t.titleEn}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                {isRTL ? t.descAr : t.descEn}
              </div>
              <div style={{
                marginTop: 12,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: t.accent, fontSize: 12.5, fontWeight: 800, letterSpacing: 0.5
              }}>
                {isRTL ? 'إنشاء عقد جديد' : 'Create new contract'}
                <span style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }}>→</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Archive */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'rgba(241, 245, 249, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2">
              <polyline points="21 8 21 21 3 21 3 8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
            <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a', letterSpacing: 0.5 }}>
              {isRTL ? `أرشيف العقود (${archive.length})` : `Contracts Archive (${archive.length})`}
            </h3>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRTL ? 'بحث بالاسم أو النموذج…' : 'Search by name or template…'}
            style={{
              padding: '8px 12px', borderRadius: 8,
              border: '1.5px solid #cbd5e1', fontSize: 13,
              minWidth: 220, fontFamily: 'inherit'
            }}
          />
        </div>

        {loadingArchive ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            {isRTL ? 'جارٍ التحميل…' : 'Loading…'}
          </div>
        ) : filteredArchive.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            {archive.length === 0
              ? (isRTL ? 'لا توجد عقود محفوظة بعد. عبّئ نموذجاً أعلاه واحفظه لأرشفته.' : 'No saved contracts yet. Fill a template above and save it to archive.')
              : (isRTL ? 'لا نتائج للبحث.' : 'No results for your search.')}
          </div>
        ) : (
          <div>
            {filteredArchive.map(c => {
              const meta = TEMPLATE_META[c.templateId] || { titleAr: c.templateId, titleEn: c.templateId, accent: '#64748b' };
              return (
                <div
                  key={c.contractId}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap'
                  }}
                >
                  <div style={{
                    width: 4, height: 40, borderRadius: 2, background: meta.accent, flexShrink: 0
                  }} />
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 800, color: '#0f172a',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {c.title || (isRTL ? 'عقد بدون عنوان' : 'Untitled contract')}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>{isRTL ? meta.titleAr : meta.titleEn}</span>
                      <span>•</span>
                      <span>{fmtWhen(c.updatedAt || c.createdAt, isRTL)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => openEdit(c)}
                      title={isRTL ? 'تعديل' : 'Edit'}
                      style={{
                        padding: '7px 12px', borderRadius: 6, border: '1.5px solid #cbd5e1',
                        background: '#fff', color: '#334155', fontWeight: 700, fontSize: 12.5,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      {isRTL ? 'تعديل' : 'Edit'}
                    </button>
                    <button
                      onClick={() => handleReprint(c)}
                      title={isRTL ? 'إعادة الطباعة' : 'Reprint'}
                      style={{
                        padding: '7px 12px', borderRadius: 6, border: 'none',
                        background: 'linear-gradient(90deg, #0f172a, #334155)',
                        color: '#fff', fontWeight: 700, fontSize: 12.5,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      {isRTL ? 'طباعة' : 'Print'}
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      title={isRTL ? 'حذف' : 'Delete'}
                      style={{
                        padding: '7px 10px', borderRadius: 6,
                        border: '1.5px solid rgba(239, 68, 68, 0.35)',
                        background: '#fff', color: '#ef4444', fontWeight: 700,
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TechnicalTrainerContractModal
        open={openTemplate === 'technical-trainer'}
        onClose={closeAllModals}
        initialData={editingContract?.templateId === 'technical-trainer' ? editingContract.data : null}
        contractId={editingContract?.templateId === 'technical-trainer' ? editingContract.contractId : null}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default ContractsManagement;
