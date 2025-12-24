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
const sendStatusUpdateEmail = async (userEmail, userName, registrationId, status, rejectionReason = null) => {
  const isApproved = status === 'approved';

  const msg = {
    to: userEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: isApproved
      ? 'تم الموافقة على طلب التسجيل - Registration Approved'
      : 'حالة طلب التسجيل - Registration Status Update',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>مرحباً ${userName}</h2>
        ${isApproved
          ? `<p style="color: #48BF85; font-size: 18px;">✅ تم الموافقة على طلب التسجيل الخاص بك!</p>
             <p>رقم التسجيل: <strong>${registrationId}</strong></p>
             <p>نتطلع لرؤيتك في الموعد المحدد.</p>`
          : `<p style="color: #EE2329; font-size: 18px;">❌ ${status === 'rejected' ? 'تم رفض طلب التسجيل' : 'طلبك قيد المراجعة'}</p>
             <p>رقم التسجيل: <strong>${registrationId}</strong></p>
             ${rejectionReason ? `<p><strong>السبب:</strong> ${rejectionReason}</p>` : ''}`
        }
        <br>
        <div dir="ltr">
          <h2>Hello ${userName}</h2>
          ${isApproved
            ? `<p style="color: #48BF85; font-size: 18px;">✅ Your registration request has been approved!</p>
               <p>Registration ID: <strong>${registrationId}</strong></p>
               <p>We look forward to seeing you at your scheduled appointment.</p>`
            : `<p style="color: #EE2329; font-size: 18px;">❌ ${status === 'rejected' ? 'Registration Rejected' : 'Your request is under review'}</p>
               <p>Registration ID: <strong>${registrationId}</strong></p>
               ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}`
          }
        </div>
        <br>
        <p style="color: #666;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
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
