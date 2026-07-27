import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TechnicalTrainerContractModal from './TechnicalTrainerContractModal';

// Contracts tab — an admin-visible library of printable contract
// templates. Every template opens its own form modal that gathers the
// admin-supplied fields and prints a signature-ready document on the
// shared receipt-bg.png letterhead. First entry: عقد مدرب تقني.
// Adding a new template is a matter of adding another card + modal.

const ContractsManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [openTemplate, setOpenTemplate] = useState(null);

  const templates = [
    {
      id: 'technical-trainer',
      titleAr: 'عقد تعاوني — مدرب تقني',
      titleEn: 'Cooperation Contract — Technical Trainer',
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

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '4px 2px' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: '#0f172a', letterSpacing: 1 }}>
          {isRTL ? 'العقود' : 'Contracts'}
        </h2>
        <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
          {isRTL
            ? 'مكتبة نماذج العقود القابلة للطباعة. اختر النموذج، عبّئ الحقول، ثم اطبع مباشرة على قالب فاب لاب.'
            : 'A library of printable contract templates. Pick one, fill the fields, and print directly on the FabLab letterhead.'}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16
      }}>
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => setOpenTemplate(t.id)}
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
                {isRTL ? 'فتح النموذج' : 'Open template'}
                <span style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }}>→</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <TechnicalTrainerContractModal
        open={openTemplate === 'technical-trainer'}
        onClose={() => setOpenTemplate(null)}
      />
    </div>
  );
};

export default ContractsManagement;
