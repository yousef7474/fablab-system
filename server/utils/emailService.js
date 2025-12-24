const sgMail = require('@sendgrid/mail');
const { Employee } = require('../models');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
  const servicesText = Array.isArray(requiredServices) ? requiredServices.join(', ') : (requiredServices || 'N/A');

  const msg = {
    to: engineerData.email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: `طلب تسجيل جديد في قسم ${section} - New Registration Request`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background: #f9fafb; border-radius: 10px;">
        <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #EE2329;">
          <h2 style="color: #EE2329; margin-top: 0;">مرحباً ${engineerData.name}،</h2>
          <h3>طلب تسجيل جديد</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>القسم:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${section}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>رقم التسجيل:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${registrationId}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>اسم المستخدم:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${userName}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>البريد الإلكتروني:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${userEmail}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>التاريخ:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${appointmentDate || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>الوقت:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${appointmentTime || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>الخدمات المطلوبة:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${servicesText}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>تفاصيل الخدمة:</strong></td><td style="padding: 8px 0;">${serviceDetails || 'N/A'}</td></tr>
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
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Required Services:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">${servicesText}</td></tr>
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
    sendMessage = false
  } = options;

  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

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

  const appointmentInfo = appointmentDate ? `
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #EE2329;">
      <h4 style="margin: 0 0 10px 0; color: #333;">تفاصيل الموعد:</h4>
      <table style="width: 100%;">
        <tr><td style="padding: 5px 0;"><strong>التاريخ:</strong></td><td>${formatDateStrAr(appointmentDate)}</td></tr>
        <tr><td style="padding: 5px 0;"><strong>الوقت:</strong></td><td>${appointmentTime || 'غير محدد'}</td></tr>
        ${appointmentDuration ? `<tr><td style="padding: 5px 0;"><strong>المدة:</strong></td><td>${appointmentDuration} دقيقة</td></tr>` : ''}
        ${fablabSection ? `<tr><td style="padding: 5px 0;"><strong>القسم:</strong></td><td>${fablabSection}</td></tr>` : ''}
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

  const msg = {
    to: userEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: isApproved
      ? 'تم الموافقة على طلب التسجيل - Registration Approved ✅'
      : isRejected
        ? 'تم رفض طلب التسجيل - Registration Rejected ❌'
        : 'حالة طلب التسجيل - Registration Status Update',
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

          ${isApproved
            ? `<div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
                 <p style="color: #155724; font-size: 20px; margin: 0; font-weight: bold;">✅ تم الموافقة على طلب التسجيل الخاص بك!</p>
               </div>
               <p style="margin-top: 15px;">رقم التسجيل: <strong style="color: #EE2329;">${registrationId}</strong></p>
               ${appointmentInfo}
               ${adminMessageBlock}
               <p>نتطلع لرؤيتك في الموعد المحدد. يرجى الحضور في الوقت المحدد.</p>`
            : isRejected
              ? `<div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
                   <p style="color: #721c24; font-size: 20px; margin: 0; font-weight: bold;">❌ تم رفض طلب التسجيل</p>
                 </div>
                 <p style="margin-top: 15px;">رقم التسجيل: <strong style="color: #EE2329;">${registrationId}</strong></p>
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

          ${isApproved
            ? `<div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
                 <p style="color: #155724; font-size: 20px; margin: 0; font-weight: bold;">✅ Your registration has been approved!</p>
               </div>
               <p style="margin-top: 15px;">Registration ID: <strong style="color: #EE2329;">${registrationId}</strong></p>
               ${appointmentInfoEn}
               ${adminMessageBlockEn}
               <p>We look forward to seeing you at your scheduled appointment. Please arrive on time.</p>`
            : isRejected
              ? `<div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
                   <p style="color: #721c24; font-size: 20px; margin: 0; font-weight: bold;">❌ Registration Rejected</p>
                 </div>
                 <p style="margin-top: 15px;">Registration ID: <strong style="color: #EE2329;">${registrationId}</strong></p>
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

module.exports = {
  sendRegistrationConfirmation,
  sendEngineerNotification,
  sendStatusUpdateEmail
};
