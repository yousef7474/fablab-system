const sgMail = require('@sendgrid/mail');
const { Employee } = require('../models');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Translation maps for sections
const sectionTranslations = {
  'Electronics and Programming': 'الإلكترونيات والبرمجة',
  'CNC Laser': 'الليزر CNC',
  'CNC Wood': 'الخشب CNC',
  '3D': 'الطباعة ثلاثية الأبعاد',
  'Robotic and AI': 'الروبوتات والذكاء الاصطناعي',
  "Kid's Club": 'نادي الأطفال',
  'Vinyl Cutting': 'قطع الفينيل'
};

// Translation maps for services
const serviceTranslations = {
  'In-person consultation': 'استشارة حضورية',
  'Online consultation': 'استشارة عن بعد',
  'Machine/Device reservation': 'حجز جهاز / آلة',
  'Personal workspace': 'مساحة عمل شخصية',
  'Support in project implementation': 'دعم في تنفيذ المشروع',
  'FABLAB Visit': 'زيارة فاب لاب',
  'Other': 'أخرى',
  'PCB Design': 'تصميم الدوائر المطبوعة',
  'PCB Fabrication': 'تصنيع الدوائر المطبوعة',
  'Arduino Programming': 'برمجة الأردوينو',
  'Raspberry Pi': 'راسبيري باي',
  'IoT Projects': 'مشاريع إنترنت الأشياء',
  'Laser Cutting': 'القطع بالليزر',
  'Laser Engraving': 'النقش بالليزر',
  'Wood Cutting': 'قطع الخشب',
  'Wood Carving': 'نحت الخشب',
  'CNC Milling': 'التفريز CNC',
  '3D Printing': 'الطباعة ثلاثية الأبعاد',
  '3D Modeling': 'النمذجة ثلاثية الأبعاد',
  '3D Scanning': 'المسح ثلاثي الأبعاد',
  'Robot Design': 'تصميم الروبوت',
  'Robot Programming': 'برمجة الروبوت',
  'AI Projects': 'مشاريع الذكاء الاصطناعي',
  'Machine Learning': 'تعلم الآلة',
  'Vinyl Cutting': 'قطع الفينيل',
  'Sticker Making': 'صناعة الملصقات',
  'Heat Transfer': 'النقل الحراري',
  'Kids Workshop': 'ورشة الأطفال',
  'Educational Activities': 'الأنشطة التعليمية',
  'STEM Activities': 'أنشطة STEM',
  'Consultation': 'استشارة',
  'Training': 'تدريب',
  'Project Development': 'تطوير المشاريع',
  'Prototyping': 'النماذج الأولية'
};

// Helper to translate section to Arabic
const translateSection = (section) => {
  return sectionTranslations[section] || section;
};

// Helper to translate services array to Arabic
const translateServicesAr = (services) => {
  if (!services) return 'غير محدد';
  if (typeof services === 'string') {
    return serviceTranslations[services] || services;
  }
  if (Array.isArray(services)) {
    return services.map(s => serviceTranslations[s] || s).join('، ');
  }
  return 'غير محدد';
};

// Helper to format services for English
const translateServicesEn = (services) => {
  if (!services) return 'N/A';
  if (typeof services === 'string') return services;
  if (Array.isArray(services)) return services.join(', ');
  return 'N/A';
};

// Get employee email by section from database ONLY (no fallback to env variables)
const getEmployeeEmailBySection = async (section) => {
  try {
    console.log(`🔍 Looking for employee in section: "${section}"`);

    // Get all employees for debugging
    const allEmployees = await Employee.findAll({
      attributes: ['name', 'email', 'section', 'isActive']
    });
    console.log(`📋 All employees in database:`, JSON.stringify(allEmployees.map(e => ({
      name: e.name,
      email: e.email,
      section: e.section,
      isActive: e.isActive
    })), null, 2));

    // Find employee for this section
    const employee = await Employee.findOne({
      where: {
        section: section,
        isActive: true
      }
    });

    if (employee && employee.email) {
      console.log(`✅ Found employee: ${employee.name} (${employee.email}) for section: ${section}`);
      return { email: employee.email, name: employee.name };
    }

    console.log(`⚠️ No active employee found in database for section: "${section}"`);
    console.log(`   Make sure an employee is added in Admin Dashboard -> Schedule tab`);
    return null;
  } catch (error) {
    console.error('❌ Error fetching employee email:', error);
    return null;
  }
};

// Send registration confirmation to user
const sendRegistrationConfirmation = async (userEmail, userName, registrationId) => {
  const msg = {
    to: userEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: 'تم استلام طلب التسجيل - Registration Received',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; direction: rtl;">
        <h2>مرحباً ${userName}</h2>
        <p>تم استلام طلب التسجيل الخاص بك بنجاح.</p>
        <p>رقم التسجيل: <strong>${registrationId}</strong></p>
        <p>سيتم مراجعة طلبك من قبل المهندس المسؤول وسيتم إرسال رسالة تأكيد إليك قريباً.</p>
        <br>
        <div dir="ltr">
          <h2>Hello ${userName}</h2>
          <p>Your registration request has been received successfully.</p>
          <p>Registration ID: <strong>${registrationId}</strong></p>
          <p>Your request will be reviewed by the responsible engineer and a confirmation message will be sent to you soon.</p>
        </div>
        <br>
        <p style="color: #666;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Registration confirmation email sent to ${userEmail}`);
  } catch (error) {
    console.error('❌ Error sending registration confirmation email:', error);
    throw error;
  }
};

// Send notification to section engineer
const sendEngineerNotification = async (section, registrationData) => {
  const engineerData = await getEmployeeEmailBySection(section);

  if (!engineerData || !engineerData.email) {
    console.warn(`⚠️ No email configured for section: ${section}`);
    return;
  }

  const { userName, userEmail, registrationId, appointmentDate, appointmentTime, requiredServices, serviceDetails } = registrationData;
  const servicesTextAr = translateServicesAr(requiredServices);
  const servicesTextEn = translateServicesEn(requiredServices);
  const sectionAr = translateSection(section);

  const msg = {
    to: engineerData.email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: `طلب تسجيل جديد في قسم ${sectionAr} - New Registration Request`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb; border-radius: 10px;">
        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #EE2329;">
          <h2 style="color: #EE2329; margin-top: 0;">مرحباً ${engineerData.name}،</h2>
          <h3>طلب تسجيل جديد</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>القسم:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${sectionAr}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>رقم التسجيل:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${registrationId}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>اسم المستخدم:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${userName}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>البريد الإلكتروني:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${userEmail}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>التاريخ:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${appointmentDate || 'غير محدد'}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>الوقت:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${appointmentTime || 'غير محدد'}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>الخدمات المطلوبة:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${servicesTextAr}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>تفاصيل الخدمة:</strong></td><td style="padding: 8px 0;">${serviceDetails || 'غير محدد'}</td></tr>
          </table>
          <br>
          <p style="background: #fff3cd; padding: 10px; border-radius: 5px;">⚠️ يرجى الدخول إلى لوحة التحكم لمراجعة الطلب والموافقة عليه أو رفضه.</p>
        </div>
        <br>
        <div dir="ltr" style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #EE2329;">
          <h2 style="color: #EE2329; margin-top: 0;">Hello ${engineerData.name},</h2>
          <h3>New Registration Request</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Section:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${section}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Registration ID:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${registrationId}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>User Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${userName}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${userEmail}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Date:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${appointmentDate || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Time:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${appointmentTime || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Required Services:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${servicesTextEn}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Service Details:</strong></td><td style="padding: 8px 0;">${serviceDetails || 'N/A'}</td></tr>
          </table>
          <br>
          <p style="background: #fff3cd; padding: 10px; border-radius: 5px;">⚠️ Please log in to the admin dashboard to review and approve or reject this request.</p>
        </div>
        <br>
        <p style="color: #666; text-align: center;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Engineer notification email sent to ${engineerData.email} (${engineerData.name}) for section ${section}`);
  } catch (error) {
    console.error('❌ Error sending engineer notification email:', error);
    throw error;
  }
};

// Send approval/rejection email to user
const sendStatusUpdateEmail = async (userEmail, userName, registrationId, status, options = {}) => {
  const {
    rejectionReason = null,
    adminMessage = null,
    appointmentDate = null,
    appointmentTime = null,
    appointmentDuration = null,
    fablabSection = null,
    sendMessage = false,
    statusChangeReason = null,
    isStatusChange = false,
    previousStatus = null
  } = options;

  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  // Translate previous status for display
  const getPreviousStatusAr = (prevStatus) => {
    const statusMap = {
      'pending': 'قيد الانتظار',
      'approved': 'مقبول',
      'rejected': 'مرفوض',
      'on-hold': 'معلق'
    };
    return statusMap[prevStatus] || prevStatus;
  };

  // Format date for display
  const formatDateStr = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateStrAr = (dateStr) => {
    if (!dateStr) return 'غير محدد';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Translate section name for emails
  const sectionAr = fablabSection ? translateSection(fablabSection) : null;

  const appointmentInfo = appointmentDate ? `
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #EE2329;">
      <h4 style="margin: 0 0 10px 0; color: #333;">تفاصيل الموعد:</h4>
      <table style="width: 100%;">
        <tr><td style="padding: 5px 0;"><strong>التاريخ:</strong></td><td>${formatDateStrAr(appointmentDate)}</td></tr>
        <tr><td style="padding: 5px 0;"><strong>الوقت:</strong></td><td>${appointmentTime || 'غير محدد'}</td></tr>
        ${appointmentDuration ? `<tr><td style="padding: 5px 0;"><strong>المدة:</strong></td><td>${appointmentDuration} دقيقة</td></tr>` : ''}
        ${sectionAr ? `<tr><td style="padding: 5px 0;"><strong>القسم:</strong></td><td>${sectionAr}</td></tr>` : ''}
      </table>
    </div>
  ` : '';

  const appointmentInfoEn = appointmentDate ? `
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #EE2329;">
      <h4 style="margin: 0 0 10px 0; color: #333;">Appointment Details:</h4>
      <table style="width: 100%;">
        <tr><td style="padding: 5px 0;"><strong>Date:</strong></td><td>${formatDateStr(appointmentDate)}</td></tr>
        <tr><td style="padding: 5px 0;"><strong>Time:</strong></td><td>${appointmentTime || 'Not specified'}</td></tr>
        ${appointmentDuration ? `<tr><td style="padding: 5px 0;"><strong>Duration:</strong></td><td>${appointmentDuration} minutes</td></tr>` : ''}
        ${fablabSection ? `<tr><td style="padding: 5px 0;"><strong>Section:</strong></td><td>${fablabSection}</td></tr>` : ''}
      </table>
    </div>
  ` : '';

  const adminMessageBlock = (sendMessage && adminMessage) ? `
    <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #3b82f6;">
      <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">رسالة من الإدارة:</h4>
      <p style="margin: 0; color: #333;">${adminMessage}</p>
    </div>
  ` : '';

  const adminMessageBlockEn = (sendMessage && adminMessage) ? `
    <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #3b82f6;">
      <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">Message from Admin:</h4>
      <p style="margin: 0; color: #333;">${adminMessage}</p>
    </div>
  ` : '';

  const rejectionBlock = (isRejected && rejectionReason) ? `
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #ef4444;">
      <h4 style="margin: 0 0 10px 0; color: #dc2626;">سبب الرفض:</h4>
      <p style="margin: 0; color: #333;">${rejectionReason}</p>
    </div>
  ` : '';

  const rejectionBlockEn = (isRejected && rejectionReason) ? `
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;">
      <h4 style="margin: 0 0 10px 0; color: #dc2626;">Reason for Rejection:</h4>
      <p style="margin: 0; color: #333;">${rejectionReason}</p>
    </div>
  ` : '';

  // Status change notice (when changing from approved to rejected or vice versa)
  const statusChangeNotice = isStatusChange ? `
    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #f59e0b;">
      <h4 style="margin: 0 0 10px 0; color: #92400e;">⚠️ إشعار تغيير الحالة:</h4>
      <p style="margin: 0; color: #333;">تم تغيير حالة طلبك من <strong>${getPreviousStatusAr(previousStatus)}</strong> إلى <strong>${isApproved ? 'مقبول' : 'مرفوض'}</strong></p>
    </div>
  ` : '';

  const statusChangeNoticeEn = isStatusChange ? `
    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
      <h4 style="margin: 0 0 10px 0; color: #92400e;">⚠️ Status Change Notice:</h4>
      <p style="margin: 0; color: #333;">Your registration status has been changed from <strong>${previousStatus}</strong> to <strong>${status}</strong></p>
    </div>
  ` : '';

  // Status change reason (optional)
  const statusChangeReasonBlock = (isStatusChange && statusChangeReason) ? `
    <div style="background: #fff7ed; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #ea580c;">
      <h4 style="margin: 0 0 10px 0; color: #c2410c;">سبب تغيير الحالة:</h4>
      <p style="margin: 0; color: #333;">${statusChangeReason}</p>
    </div>
  ` : '';

  const statusChangeReasonBlockEn = (isStatusChange && statusChangeReason) ? `
    <div style="background: #fff7ed; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ea580c;">
      <h4 style="margin: 0 0 10px 0; color: #c2410c;">Reason for Status Change:</h4>
      <p style="margin: 0; color: #333;">${statusChangeReason}</p>
    </div>
  ` : '';

  const msg = {
    to: userEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: isStatusChange
      ? (isApproved
          ? 'تغيير حالة التسجيل: مقبول - Status Changed: Approved ✅'
          : 'تغيير حالة التسجيل: مرفوض - Status Changed: Rejected ❌')
      : (isApproved
          ? 'تم الموافقة على طلب التسجيل - Registration Approved ✅'
          : isRejected
            ? 'تم رفض طلب التسجيل - Registration Rejected ❌'
            : 'حالة طلب التسجيل - Registration Status Update'),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #EE2329, #c41e24); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">فاب لاب الأحساء</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">FABLAB Al-Ahsa</p>
        </div>

        <!-- Arabic Content -->
        <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
          <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>

          ${statusChangeNotice}

          ${isApproved
            ? `<div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
                 <p style="color: #155724; font-size: 20px; margin: 0; font-weight: bold;">✅ ${isStatusChange ? 'تم تغيير حالة طلبك إلى مقبول!' : 'تم الموافقة على طلب التسجيل الخاص بك!'}</p>
               </div>
               <p style="margin-top: 15px;">رقم التسجيل: <strong style="color: #EE2329;">${registrationId}</strong></p>
               ${statusChangeReasonBlock}
               ${appointmentInfo}
               ${adminMessageBlock}
               <p>نتطلع لرؤيتك في الموعد المحدد. يرجى الحضور في الوقت المحدد.</p>`
            : isRejected
              ? `<div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
                   <p style="color: #721c24; font-size: 20px; margin: 0; font-weight: bold;">❌ ${isStatusChange ? 'تم تغيير حالة طلبك إلى مرفوض' : 'تم رفض طلب التسجيل'}</p>
                 </div>
                 <p style="margin-top: 15px;">رقم التسجيل: <strong style="color: #EE2329;">${registrationId}</strong></p>
                 ${statusChangeReasonBlock}
                 ${rejectionBlock}
                 ${adminMessageBlock}
                 <p>يمكنك التقديم مرة أخرى أو التواصل معنا للمزيد من المعلومات.</p>`
              : `<p style="color: #856404; font-size: 18px;">⏳ طلبك قيد المراجعة</p>
                 <p>رقم التسجيل: <strong>${registrationId}</strong></p>`
          }
        </div>

        <!-- Divider -->
        <div style="border-top: 2px solid #EE2329; margin: 0;"></div>

        <!-- English Content -->
        <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
          <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>

          ${statusChangeNoticeEn}

          ${isApproved
            ? `<div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
                 <p style="color: #155724; font-size: 20px; margin: 0; font-weight: bold;">✅ ${isStatusChange ? 'Your registration status has been changed to Approved!' : 'Your registration has been approved!'}</p>
               </div>
               <p style="margin-top: 15px;">Registration ID: <strong style="color: #EE2329;">${registrationId}</strong></p>
               ${statusChangeReasonBlockEn}
               ${appointmentInfoEn}
               ${adminMessageBlockEn}
               <p>We look forward to seeing you at your scheduled appointment. Please arrive on time.</p>`
            : isRejected
              ? `<div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
                   <p style="color: #721c24; font-size: 20px; margin: 0; font-weight: bold;">❌ ${isStatusChange ? 'Your registration status has been changed to Rejected' : 'Registration Rejected'}</p>
                 </div>
                 <p style="margin-top: 15px;">Registration ID: <strong style="color: #EE2329;">${registrationId}</strong></p>
                 ${statusChangeReasonBlockEn}
                 ${rejectionBlockEn}
                 ${adminMessageBlockEn}
                 <p>You may submit a new application or contact us for more information.</p>`
              : `<p style="color: #856404; font-size: 18px;">⏳ Your request is under review</p>
                 <p>Registration ID: <strong>${registrationId}</strong></p>`
          }
        </div>

        <!-- Footer -->
        <div style="background: #1a1a2e; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #fff; margin: 0;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
          <p style="color: rgba(255,255,255,0.6); margin: 10px 0 0 0; font-size: 12px;">مختبر التصنيع الرقمي | Digital Fabrication Laboratory</p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Status update email sent to ${userEmail}`);
  } catch (error) {
    console.error('❌ Error sending status update email:', error);
    throw error;
  }
};

// Send custom email from admin to user
const sendCustomEmail = async (userEmail, userName, subject, messageBody) => {
  const htmlBody = messageBody.replace(/\n/g, '<br>');

  const msg = {
    to: userEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #EE2329, #c41e24); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">فاب لاب الأحساء</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">FABLAB Al-Ahsa</p>
        </div>

        <!-- Arabic Content -->
        <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
          <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
          <div style="color: #333; line-height: 1.8; font-size: 15px;">
            ${htmlBody}
          </div>
        </div>

        <!-- Divider -->
        <div style="border-top: 2px solid #EE2329; margin: 0;"></div>

        <!-- English Content -->
        <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
          <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
          <div style="color: #333; line-height: 1.8; font-size: 15px;">
            ${htmlBody}
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #1a1a2e; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #fff; margin: 0;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
          <p style="color: rgba(255,255,255,0.6); margin: 10px 0 0 0; font-size: 12px;">مختبر التصنيع الرقمي | Digital Fabrication Laboratory</p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Custom email sent to ${userEmail}`);
  } catch (error) {
    console.error('❌ Error sending custom email:', error);
    throw error;
  }
};

/**
 * Send email notification to employee when they gain or lose a mark
 * @param {string} employeeEmail - Employee email address
 * @param {string} employeeName - Employee name
 * @param {string} taskTitle - Title of the task
 * @param {string} type - 'award' or 'deduction'
 */
const sendTaskRatingEmail = async (employeeEmail, employeeName, taskTitle, type, taskDescription) => {
  const isAward = type === 'award';
  const headerColor = isAward ? '#22c55e' : '#ef4444';
  const headerGradient = isAward ? '#16a34a' : '#dc2626';
  const icon = isAward ? '🎉' : '⚠️';
  const subjectAr = isAward ? 'حصلت على نقطة جديدة' : 'تم خصم نقطة';
  const subjectEn = isAward ? 'You earned a new point' : 'A point has been deducted';

  const msg = {
    to: employeeEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: `${subjectAr} - ${subjectEn}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${headerColor}, ${headerGradient}); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <div style="font-size: 48px; margin-bottom: 10px;">${icon}</div>
          <h1 style="color: white; margin: 0; font-size: 24px;">${subjectAr}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">${subjectEn}</p>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0;">
          <p style="text-align: right; font-size: 16px; color: #334155; direction: rtl;">
            مرحباً <strong>${employeeName}</strong>،
          </p>
          <p style="text-align: right; font-size: 15px; color: #475569; direction: rtl; line-height: 1.8;">
            ${isAward
              ? `نود إبلاغك بأنه تم <strong style="color: #22c55e;">منحك نقطة واحدة (+1)</strong> وذلك لإكمالك المهمة التالية:`
              : `نود إبلاغك بأنه تم <strong style="color: #ef4444;">خصم نقطة واحدة (-1)</strong> منك وذلك لعدم إكمال المهمة التالية:`
            }
          </p>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; border-right: 4px solid ${headerColor};">
            <p style="text-align: right; margin: 0; font-size: 15px; font-weight: 600; color: #1e293b; direction: rtl;">
              📋 ${taskTitle}
            </p>
            ${taskDescription ? `<p style="text-align: right; margin: 8px 0 0; font-size: 13px; color: #64748b; direction: rtl; line-height: 1.6;">${taskDescription}</p>` : ''}
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

          <p style="text-align: left; font-size: 15px; color: #475569; line-height: 1.8;">
            Hello <strong>${employeeName}</strong>,
          </p>
          <p style="text-align: left; font-size: 14px; color: #64748b; line-height: 1.8;">
            ${isAward
              ? `You have been <strong style="color: #22c55e;">awarded 1 point (+1)</strong> for completing the following task:`
              : `<strong style="color: #ef4444;">1 point has been deducted (-1)</strong> from your score for not completing the following task:`
            }
          </p>

          <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid ${headerColor};">
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">
              📋 ${taskTitle}
            </p>
            ${taskDescription ? `<p style="margin: 8px 0 0; font-size: 13px; color: #64748b; line-height: 1.6;">${taskDescription}</p>` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #1a1a2e; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #fff; margin: 0;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
          <p style="color: rgba(255,255,255,0.6); margin: 10px 0 0 0; font-size: 12px;">مختبر التصنيع الرقمي | Digital Fabrication Laboratory</p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Task rating email (${type}) sent to ${employeeEmail}`);
  } catch (error) {
    console.error(`❌ Error sending task rating email to ${employeeEmail}:`, error);
    throw error;
  }
};

/**
 * Send reminder email to employee before task deadline
 */
const sendTaskReminderEmail = async (employeeEmail, employeeName, taskTitle, taskDescription, endDate, assignedBy) => {
  const msg = {
    to: employeeEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: `تذكير: موعد تسليم المهمة غداً - Task Deadline Reminder`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
          <h1 style="color: white; margin: 0; font-size: 24px;">تذكير بموعد التسليم</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">Task Deadline Reminder</p>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0;">
          <p style="text-align: right; font-size: 16px; color: #334155; direction: rtl;">
            مرحباً <strong>${employeeName}</strong>،
          </p>
          <p style="text-align: right; font-size: 15px; color: #475569; direction: rtl; line-height: 1.8;">
            نود تذكيرك بأن موعد تسليم المهمة التالية ينتهي <strong style="color: #d97706;">غداً (${endDate})</strong>:
          </p>

          <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin: 16px 0; border-right: 4px solid #f59e0b;">
            <p style="text-align: right; margin: 0; font-size: 15px; font-weight: 600; color: #1e293b; direction: rtl;">
              📋 ${taskTitle}
            </p>
            ${taskDescription ? `<p style="text-align: right; margin: 8px 0 0; font-size: 13px; color: #64748b; direction: rtl; line-height: 1.6;">${taskDescription}</p>` : ''}
            ${assignedBy ? `<p style="text-align: right; margin: 8px 0 0; font-size: 12px; color: #94a3b8; direction: rtl;">تم التكليف بواسطة: ${assignedBy}</p>` : ''}
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">

          <p style="text-align: left; font-size: 15px; color: #475569; line-height: 1.8;">
            Hello <strong>${employeeName}</strong>,
          </p>
          <p style="text-align: left; font-size: 14px; color: #64748b; line-height: 1.8;">
            This is a reminder that the following task is due <strong style="color: #d97706;">tomorrow (${endDate})</strong>:
          </p>

          <div style="background: #fffbeb; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">
              📋 ${taskTitle}
            </p>
            ${taskDescription ? `<p style="margin: 8px 0 0; font-size: 13px; color: #64748b; line-height: 1.6;">${taskDescription}</p>` : ''}
            ${assignedBy ? `<p style="margin: 8px 0 0; font-size: 12px; color: #94a3b8;">Assigned by: ${assignedBy}</p>` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #1a1a2e; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #fff; margin: 0;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
          <p style="color: rgba(255,255,255,0.6); margin: 10px 0 0 0; font-size: 12px;">مختبر التصنيع الرقمي | Digital Fabrication Laboratory</p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Task reminder email sent to ${employeeEmail}`);
  } catch (error) {
    console.error(`❌ Error sending task reminder email to ${employeeEmail}:`, error);
    throw error;
  }
};

const sendCourseInactivityWarning = async (userEmail, userName, courseTitle, inactivityDays, progressPercent) => {
  const msg = {
    to: userEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || 'noreply@fablab.com',
      name: 'FABLAB Al-Ahsa'
    },
    subject: `تنبيه: لم يتم الدخول للدورة - ${courseTitle}`,
    html: `
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: linear-gradient(135deg, #064e3b, #059669); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">FABLAB Al-Ahsa</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">تنبيه عدم نشاط في الدورة</p>
        </div>
        <div style="padding: 28px;">
          <p style="font-size: 16px; color: #111;">مرحباً ${userName}،</p>
          <p style="font-size: 14px; color: #444; line-height: 1.7;">
            نلاحظ أنك لم تدخل إلى الدورة <strong style="color: #059669;">"${courseTitle}"</strong> منذ أكثر من <strong>${inactivityDays} أيام</strong>.
          </p>
          <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 14px; margin: 16px 0;">
            <p style="margin: 0; font-size: 13px; color: #92400e;">
              ⚠️ تقدمك الحالي: <strong>${progressPercent}%</strong> — يرجى متابعة الدورة لإكمالها في الوقت المحدد.
            </p>
          </div>
          <p style="font-size: 14px; color: #444;">نتمنى لك التوفيق في استكمال الدورة.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">FABLAB Al-Ahsa — برنامج النخبة</p>
        </div>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Course inactivity warning sent to ${userEmail}`);
  } catch (error) {
    console.error(`❌ Error sending course warning to ${userEmail}:`, error);
    throw error;
  }
};

// Send workshop registration confirmation
const sendWorkshopRegistrationEmail = async (studentEmail, studentName, workshop, invoiceNumber) => {
  if (!studentEmail) return;

  const startDate = workshop.startDate || '';
  const endDate = workshop.endDate && workshop.endDate !== workshop.startDate ? ` → ${workshop.endDate}` : '';

  const msg = {
    to: studentEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME || 'FABLAB Al-Ahsa'
    },
    subject: `تأكيد التسجيل: ${workshop.title} | Registration Confirmed`,
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:550px;margin:0 auto;background:#fff;">
<div style="background:#1a56db;padding:20px;text-align:center;border-radius:10px 10px 0 0;">
<h2 style="color:#fff;margin:0;font-size:18px;">فاب لاب الأحساء | FABLAB Al-Ahsa</h2>
</div>
<div style="padding:24px;">
<p style="color:#1e293b;font-size:15px;margin:0 0 16px;"><b>مرحباً ${studentName}</b> — تم تسجيلك بنجاح</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;">
<h3 style="color:#1a56db;margin:0 0 10px;font-size:17px;">${workshop.title}</h3>
${workshop.presenter ? `<p style="color:#3b82f6;margin:0 0 10px;font-size:13px;">المقدم: <b>${workshop.presenter}</b></p>` : ''}
<table style="width:100%;font-size:13px;border-collapse:collapse;">
${startDate ? `<tr><td style="padding:5px 0;color:#64748b;">التاريخ</td><td style="padding:5px 0;color:#1e293b;font-weight:700;">${startDate}${endDate}</td></tr>` : ''}
${workshop.totalHours ? `<tr><td style="padding:5px 0;color:#64748b;">المدة</td><td style="padding:5px 0;color:#1e293b;font-weight:700;">${workshop.totalHours} ساعة</td></tr>` : ''}
${workshop.price ? `<tr><td style="padding:5px 0;color:#64748b;">السعر</td><td style="padding:5px 0;color:#1a56db;font-weight:700;">${workshop.price} ر.س</td></tr>` : ''}
<tr><td style="padding:5px 0;color:#64748b;">الفاتورة</td><td style="padding:5px 0;color:#1e293b;font-weight:700;">${invoiceNumber}</td></tr>
</table>
${workshop.objectives ? `<p style="margin:10px 0 0;padding:8px;background:#eff6ff;border-radius:6px;color:#1d4ed8;font-size:12px;line-height:1.5;"><b>الأهداف:</b> ${workshop.objectives}</p>` : ''}
</div>
<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:12px;text-align:center;margin-bottom:16px;">
<p style="margin:0;color:#92400e;font-weight:700;font-size:14px;">⏳ قيد مراجعة الفاتورة — سيتم التواصل معك للتأكيد</p>
</div>
<div dir="ltr" style="border-top:1px solid #e2e8f0;padding-top:14px;font-size:13px;color:#475569;">
<p style="margin:0 0 6px;"><b>Hello ${studentName}</b> — You are registered for <b>"${workshop.title}"</b></p>
<p style="margin:0;">Date: <b>${startDate}${endDate}</b>${workshop.totalHours ? ` | ${workshop.totalHours}h` : ''} | Invoice: <b>${invoiceNumber}</b> | Status: <b style="color:#92400e;">Under Review</b></p>
</div>
</div>
<div style="background:#1e293b;padding:12px;text-align:center;border-radius:0 0 10px 10px;">
<p style="color:rgba(255,255,255,0.6);margin:0;font-size:11px;">فاب لاب الأحساء — مختبر التصنيع الرقمي</p>
</div>
</div>`
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Workshop registration email sent to ${studentEmail}`);
  } catch (error) {
    console.error('❌ Error sending workshop registration email:', error);
  }
};

module.exports = {
  sendRegistrationConfirmation,
  sendEngineerNotification,
  sendStatusUpdateEmail,
  sendCustomEmail,
  sendTaskRatingEmail,
  sendTaskReminderEmail,
  sendCourseInactivityWarning,
  sendWorkshopRegistrationEmail
};
