import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';

const SuccessPage = ({ registration }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const handlePrint = () => {
    window.print();
  };

  const handleNewRegistration = () => {
    window.location.reload();
  };

  return (
    <div className="success-page">
      <motion.div
        className="success-icon"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </motion.div>

      <motion.h2
        className="success-title"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {isRTL ? 'تم التسجيل بنجاح!' : 'Registration Successful!'}
      </motion.h2>

      <motion.p
        className="success-message"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {isRTL
          ? 'تم إرسال طلب التسجيل الخاص بك بنجاح. ستتلقى بريدًا إلكترونيًا للتأكيد قريبًا.'
          : 'Your registration has been submitted successfully. You will receive a confirmation email soon.'}
      </motion.p>

      <motion.div
        className="success-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="qr-container">
          <QRCode value={registration.registrationId} size={150} />
        </div>

        <div className="registration-details">
          <div className="detail-row">
            <span className="detail-label">
              {isRTL ? 'رقم التسجيل' : 'Registration ID'}
            </span>
            <span className="detail-value">{registration.registrationId}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">
              {isRTL ? 'رقم المستخدم' : 'User ID'}
            </span>
            <span className="detail-value">{registration.userId}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">
              {isRTL ? 'الاسم' : 'Name'}
            </span>
            <span className="detail-value">{registration.userName}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">
              {isRTL ? 'القسم' : 'Section'}
            </span>
            <span className="detail-value">{registration.fablabSection}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">
              {isRTL ? 'التاريخ' : 'Date'}
            </span>
            <span className="detail-value">{registration.appointmentDate || 'N/A'}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">
              {isRTL ? 'الوقت' : 'Time'}
            </span>
            <span className="detail-value">{registration.appointmentTime || 'N/A'}</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">
              {isRTL ? 'الحالة' : 'Status'}
            </span>
            <span className={`status-badge status-${registration.status}`}>
              {registration.status === 'pending' && (isRTL ? 'قيد المراجعة' : 'PENDING')}
              {registration.status === 'approved' && (isRTL ? 'مقبول' : 'APPROVED')}
              {registration.status === 'rejected' && (isRTL ? 'مرفوض' : 'REJECTED')}
            </span>
          </div>
        </div>
      </motion.div>

      <motion.p
        className="success-note"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {isRTL
          ? 'سيتم مراجعة طلبك من قبل المهندس المسؤول وسيتم إرسال رسالة تأكيد إليك.'
          : 'Your request will be reviewed by the responsible engineer and a confirmation message will be sent to you.'}
      </motion.p>

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
