import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import './RegistrationGuide.css';

// Main points of «سياسة استخدام مساحة العمل والدعم الفني» (FabLab
// Al-Ahsa, Abdulmonem Al-Rashed Humanitarian Foundation), shown from
// the "!" next to the Personal workspace service.
const POINTS = [
  {
    ar: ['خدمة تمكينية', 'نوفّر لك بيئة عمل آمنة والأدوات والأجهزة والإرشاد الفني لتنفّذ مشروعك بنفسك؛ مساحة العمل ليست خدمة لتنفيذ المشروع نيابةً عنك.'],
    en: ['An enabling service', 'We provide a safe space, tools, equipment and technical guidance so you can build your project yourself — the workspace is not a service that builds it for you.']
  },
  {
    ar: ['مسؤولياتك', 'تخطيط المشروع وتنفيذه واستكمال مراحله، وتوفير مكوناته وموادّه، وحفظ ملفاتك وأكوادك وتصاميمك.'],
    en: ['Your responsibilities', 'Planning, building and finishing your project, providing its components and materials, and keeping your own files, code and designs.']
  },
  {
    ar: ['دور المهندس', 'يوجّهك لاستخدام الأدوات والأجهزة بأمان، ويقدّم الإرشاد ويساعد في تشخيص المشكلات، ولا يلتزم بتنفيذ المشروع أو كتابة كل أكواده أو تركيب كل مكوناته.'],
    en: ['The engineer\'s role', 'Guides you to use tools and machines safely, advises and helps diagnose problems — but is not committed to building the project, writing all its code or assembling all its parts.']
  },
  {
    ar: ['المساعدة الإضافية', 'أي مساعدة عملية إضافية (برمجة، توصيل، اختبار) تكون حسب الوقت والإمكانات المتاحة، ولا تنقل مسؤولية المشروع إلى المهندس.'],
    en: ['Extra help', 'Any extra hands-on help (coding, wiring, testing) depends on the time and resources available and does not move responsibility for the project to the engineer.']
  },
  {
    ar: ['حسب التخصص', 'يُوجَّه كل جزء من المشروع إلى القسم المختص به (الإلكترونيات، التصميم، الطباعة ثلاثية الأبعاد…) وفق المواعيد المتاحة.'],
    en: ['By specialty', 'Each part of the project goes to the section that handles it (electronics, design, 3D printing…) according to available appointments.']
  },
  {
    ar: ['الحجز والمواعيد', 'التزم بموعد الحجز ومدته وبالقسم المحدد فيه؛ لا يُسمح بإشغال مساحة العمل دون حجز أو موافقة، ولا يلتزم المهندس باستقبالك دون موعد.'],
    en: ['Bookings', 'Keep to your booked time, duration and section. The workspace can\'t be used without a booking or approval, and walk-ins are not guaranteed to be received.']
  },
  {
    ar: ['التواصل الرسمي', 'الاستشارات عبر القنوات والمواعيد المعتمدة فقط؛ أرقام المهندسين الشخصية ليست وسيلة دعم رسمية، ولا يُطلب منهم الرد خارج أوقات العمل.'],
    en: ['Official channels', 'Consultations go through official channels and appointments only. Engineers\' personal numbers are not a support channel and they are not expected to reply after hours.']
  },
  {
    ar: ['اكتمال الخدمة', 'تُعد الخدمة مقدَّمة بإتاحة البيئة والأدوات والتوجيه خلال موعدك، ولا يُشترط لذلك اكتمال مشروعك.'],
    en: ['Service delivered', 'The service counts as delivered once the space, tools and guidance were provided during your appointment — your project does not have to be finished.']
  },
  {
    ar: ['التكاليف', 'سداد قيمة القطع والمواد يغطّي القطع والمواد فقط، ولا يشمل تنفيذ المشروع أو تركيبه أو برمجته.'],
    en: ['Costs', 'Paying for parts and materials covers the parts and materials only — not building, assembling or programming the project.']
  },
  {
    ar: ['السلوك المهني', 'الاحترام المتبادل أساس العمل؛ يُمنع الإساءة أو التهكم أو الضغط على الموظفين، وتُقدَّم الملاحظات والشكاوى عبر القنوات الرسمية.'],
    en: ['Professional conduct', 'Mutual respect comes first: no insults, mockery or pressure on staff. Feedback and complaints go through the official channels.']
  }
];

const WorkspacePolicyDialog = ({ theme, isRTL, onClose }) => {
  const closeRef = useRef(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="rg-overlay" data-theme={theme === 'light' ? 'light' : 'dark'} dir={isRTL ? 'rtl' : 'ltr'} onClick={onClose}>
      <motion.div
        className="wsp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wsp-title"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <div className="wsp-head">
          <div className="wsp-icon" aria-hidden="true">!</div>
          <div>
            <h3 id="wsp-title" className="wsp-title">
              {isRTL ? 'سياسة استخدام مساحة العمل والدعم الفني' : 'Workspace & Technical Support Policy'}
            </h3>
            <p className="wsp-sub">{isRTL ? 'أبرز النقاط — فاب لاب الأحساء' : 'Key points — FabLab Al-Ahsa'}</p>
          </div>
        </div>
        <ol className="wsp-list">
          {POINTS.map((p, i) => {
            const [title, text] = isRTL ? p.ar : p.en;
            return (
              <li key={i} className="wsp-item">
                <span className="wsp-num">{i + 1}</span>
                <div>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="wsp-foot">
          <button ref={closeRef} type="button" className="ent-btn primary" onClick={onClose}>
            {isRTL ? 'فهمت' : 'Got it'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default WorkspacePolicyDialog;
