import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import QRCode from 'react-qr-code';
import confetti from 'canvas-confetti';
import Lottie from 'lottie-react';
import successAnimation from '../../lottie/success.json';
import './SuccessPage.studio.css';

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

  // Celebratory confetti burst when the success page mounts
  useEffect(() => {
    const fire = (particleRatio, opts) => {
      confetti({
        origin: { y: 0.7 },
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
        colors: ['#EE2329', '#2A4F7C', '#28B070', '#f59e0b', '#8db4e6']
      });
    };
    // Layered burst for richer effect
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2,  { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1,  { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1,  { spread: 120, startVelocity: 45 });
  }, []);

  // Stroke icons (24-unit grid) for the four-stage tracker.
  const steps = [
    { d: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 15l2 2 4-4'], labelAr: 'تم إرسال الطلب', labelEn: 'Request Submitted', done: true },
    { d: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'], labelAr: 'قيد مراجعة المهندس', labelEn: 'Engineer Review', done: false, active: true },
    { d: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6l-10 7L2 6'], labelAr: 'رسالة تأكيد بالبريد', labelEn: 'Confirmation Email', done: false },
    { d: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'], labelAr: 'الحضور لفاب لاب', labelEn: 'Visit FabLab', done: false },
  ];
  const Icon = ({ d }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map(p => <path key={p} d={p} />)}
    </svg>
  );

  return (
    <div className="success-page rgx-ok">
      {/* Under-review banner */}
      <motion.div
        className="rgx-ok-banner"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className="rgx-ok-lottie"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {/* frames 45-56 shrink the tick away — stop on the full tick */}
          <Lottie animationData={successAnimation} loop={false} autoplay initialSegment={[0, 45]} style={{ width: '100%', height: '100%' }} />
        </motion.div>

        <motion.h2
          className="rgx-ok-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isRTL ? 'تم استلام طلبك — قيد المراجعة' : 'Request Received — Under Review'}
        </motion.h2>

        <motion.p
          className="rgx-ok-warn"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Icon d={['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01']} />
          <span>
            {isRTL
              ? 'لا تحضر إلى فاب لاب حتى تستلم رسالة تأكيد عبر البريد الإلكتروني من المهندس المسؤول'
              : 'Do NOT come to FabLab until you receive a confirmation email from the responsible engineer'}
          </span>
        </motion.p>
      </motion.div>

      {/* Stage tracker */}
      <motion.ol
        className="rgx-ok-track"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        {steps.map((s, i) => (
          <li key={i} className={s.done ? 'is-done' : s.active ? 'is-now' : ''}>
            <span className="rgx-ok-dot">
              <Icon d={s.done ? ['M20 6 9 17l-5-5'] : s.d} />
            </span>
            <span className="rgx-ok-label">{isRTL ? s.labelAr : s.labelEn}</span>
          </li>
        ))}
      </motion.ol>

      {/* Registration details card */}
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
            <span className="rgx-ok-status">
              <i aria-hidden="true" />
              {isRTL ? 'قيد المراجعة' : 'UNDER REVIEW'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* What to expect */}
      <motion.div
        className="rgx-ok-next"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="rgx-ok-next-title">{isRTL ? 'ماذا بعد؟' : 'What happens next?'}</p>
        <ul>
          <li>{isRTL ? 'سيراجع المهندس المسؤول طلبك' : 'The responsible engineer will review your request'}</li>
          <li>{isRTL ? 'ستستلم رسالة تأكيد أو رفض عبر البريد الإلكتروني' : 'You will receive an acceptance or rejection email'}</li>
          <li>{isRTL ? 'في حالة القبول، يمكنك الحضور في الموعد المحدد' : 'If accepted, you can come at the scheduled time'}</li>
          <li className="is-alert">{isRTL ? 'لا تحضر بدون رسالة تأكيد!' : 'Do NOT come without a confirmation email!'}</li>
        </ul>
        <p className="rgx-ok-next-foot">
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
          <Icon d={['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z']} />
          {t('print')}
        </button>
        <button className="btn btn-secondary" onClick={handleNewRegistration}>
          <Icon d={['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5']} />
          {isRTL ? 'تسجيل جديد' : 'New Registration'}
        </button>
      </motion.div>
    </div>
  );
};

export default SuccessPage;
