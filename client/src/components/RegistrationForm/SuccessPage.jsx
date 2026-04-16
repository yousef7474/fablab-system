import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';

const formatTimeAMPM = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

const SuccessPage = ({ registration }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const handlePrint = () => window.print();
  const handleNewRegistration = () => window.location.reload();

  const steps = [
    { icon: '📝', labelAr: 'تم إرسال الطلب', labelEn: 'Request Submitted', done: true },
    { icon: '🔍', labelAr: 'قيد مراجعة المهندس', labelEn: 'Engineer Review', done: false, active: true },
    { icon: '📧', labelAr: 'رسالة تأكيد بالبريد', labelEn: 'Confirmation Email', done: false },
    { icon: '🏢', labelAr: 'الحضور لفاب لاب', labelEn: 'Visit FabLab', done: false },
  ];

  return (
    <div className="success-page" style={{ padding: '2rem 1.5rem' }}>
      {/* Warning Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 16, padding: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          style={{ width: 70, height: 70, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ color: '#92400e', fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.5rem' }}
        >
          {isRTL ? 'تم استلام طلبك — قيد المراجعة' : 'Request Received — Under Review'}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ color: '#78350f', fontSize: '1rem', fontWeight: 600, lineHeight: 1.7, margin: 0 }}
        >
          {isRTL
            ? '⚠ لا تحضر إلى فاب لاب حتى تستلم رسالة تأكيد عبر البريد الإلكتروني من المهندس المسؤول'
            : '⚠ Do NOT come to FabLab until you receive a confirmation email from the responsible engineer'}
        </motion.p>
      </motion.div>

      {/* Steps Tracker */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 0, margin: '0 0 2rem', padding: '0 0.5rem' }}
      >
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: 90 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: s.done ? '#22c55e' : s.active ? '#f59e0b' : '#e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', color: s.done || s.active ? 'white' : '#94a3b8',
                boxShadow: s.active ? '0 0 0 4px rgba(245,158,11,0.25)' : 'none',
                transition: 'all 0.3s'
              }}>
                {s.done ? '✓' : s.icon}
              </div>
              <span style={{ fontSize: '0.68rem', color: s.done ? '#166534' : s.active ? '#92400e' : '#64748b', fontWeight: 600, marginTop: 6, textAlign: 'center', lineHeight: 1.3 }}>
                {isRTL ? s.labelAr : s.labelEn}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ height: 3, flex: '0 0 20px', background: s.done ? '#22c55e' : '#e2e8f0', borderRadius: 2, marginTop: 20, alignSelf: 'flex-start' }} />
            )}
          </React.Fragment>
        ))}
      </motion.div>

      {/* Registration Details Card */}
      <motion.div
        className="success-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="qr-container">
          <QRCode value={registration.registrationId} size={130} />
        </div>

        <div className="registration-details">
          <div className="detail-row">
            <span className="detail-label">{isRTL ? 'رقم التسجيل' : 'Registration ID'}</span>
            <span className="detail-value">{registration.registrationId}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{isRTL ? 'الاسم' : 'Name'}</span>
            <span className="detail-value">{registration.userName}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{isRTL ? 'القسم' : 'Section'}</span>
            <span className="detail-value">{registration.fablabSection}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{isRTL ? 'التاريخ' : 'Date'}</span>
            <span className="detail-value">{registration.appointmentDate || 'N/A'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{isRTL ? 'الوقت' : 'Time'}</span>
            <span className="detail-value">{formatTimeAMPM(registration.appointmentTime) || 'N/A'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{isRTL ? 'الحالة' : 'Status'}</span>
            <span style={{ padding: '4px 14px', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', background: '#fef3c7', color: '#92400e', border: '1.5px solid #f59e0b' }}>
              {isRTL ? '⏳ قيد المراجعة' : '⏳ UNDER REVIEW'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* What to Expect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        style={{ margin: '1.5rem 0', padding: '1rem 1.25rem', background: '#f0f9ff', borderRadius: 12, border: '1px solid #bae6fd' }}
      >
        <p style={{ fontWeight: 700, color: '#0c4a6e', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
          {isRTL ? 'ماذا بعد؟' : 'What happens next?'}
        </p>
        <ul style={{ margin: 0, paddingInlineStart: '1.25rem', color: '#0369a1', fontSize: '0.85rem', lineHeight: 2 }}>
          <li>{isRTL ? 'سيراجع المهندس المسؤول طلبك' : 'The responsible engineer will review your request'}</li>
          <li>{isRTL ? 'ستستلم رسالة تأكيد أو رفض عبر البريد الإلكتروني' : 'You will receive an acceptance or rejection email'}</li>
          <li>{isRTL ? 'في حالة القبول، يمكنك الحضور في الموعد المحدد' : 'If accepted, you can come at the scheduled time'}</li>
          <li style={{ color: '#dc2626', fontWeight: 700 }}>{isRTL ? 'لا تحضر بدون رسالة تأكيد!' : 'Do NOT come without a confirmation email!'}</li>
        </ul>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
          {isRTL ? 'في حال عدم استلام رد خلال 48 ساعة، تواصل معنا عبر البريد أو الهاتف.' : 'If you don\'t hear back within 48 hours, contact us via email or phone.'}
        </p>
      </motion.div>

      {/* Buttons */}
      <motion.div
        className="success-buttons"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <button className="btn btn-primary" onClick={handlePrint}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          {t('print')}
        </button>
        <button className="btn btn-secondary" onClick={handleNewRegistration}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          {isRTL ? 'تسجيل جديد' : 'New Registration'}
        </button>
      </motion.div>
    </div>
  );
};

export default SuccessPage;
