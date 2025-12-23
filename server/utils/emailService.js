const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Get employee email by section
const getEmployeeEmailBySection = (section) => {
  const sectionMapping = {
    'Electronics and Programming': process.env.EMPLOYEE_ELECTRONICS_EMAIL,
    'CNC Laser': process.env.EMPLOYEE_CNC_LASER_EMAIL,
    'CNC Wood': process.env.EMPLOYEE_CNC_WOOD_EMAIL,
    '3D': process.env.EMPLOYEE_3D_EMAIL,
    'Robotic and AI': process.env.EMPLOYEE_ROBOTIC_AI_EMAIL,
    "Kid's Club": process.env.EMPLOYEE_KIDS_CLUB_EMAIL,
    'Vinyl Cutting': process.env.EMPLOYEE_VINYL_CUTTING_EMAIL
  };
  return sectionMapping[section];
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
  const engineerEmail = getEmployeeEmailBySection(section);

  if (!engineerEmail) {
    console.warn(`⚠️ No email configured for section: ${section}`);
    return;
  }

  const { userName, userEmail, registrationId, appointmentDate, appointmentTime, requiredServices, serviceDetails } = registrationData;

  const msg = {
    to: engineerEmail,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME
    },
    subject: `طلب تسجيل جديد في قسم ${section} - New Registration Request`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>طلب تسجيل جديد</h2>
        <p><strong>القسم:</strong> ${section}</p>
        <p><strong>رقم التسجيل:</strong> ${registrationId}</p>
        <p><strong>اسم المستخدم:</strong> ${userName}</p>
        <p><strong>البريد الإلكتروني:</strong> ${userEmail}</p>
        <p><strong>التاريخ:</strong> ${appointmentDate || 'N/A'}</p>
        <p><strong>الوقت:</strong> ${appointmentTime || 'N/A'}</p>
        <p><strong>الخدمات المطلوبة:</strong> ${requiredServices.join(', ')}</p>
        <p><strong>تفاصيل الخدمة:</strong> ${serviceDetails}</p>
        <br>
        <p>يرجى الدخول إلى لوحة التحكم لمراجعة الطلب والموافقة عليه أو رفضه.</p>
        <br>
        <div dir="ltr">
          <h2>New Registration Request</h2>
          <p><strong>Section:</strong> ${section}</p>
          <p><strong>Registration ID:</strong> ${registrationId}</p>
          <p><strong>User Name:</strong> ${userName}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>Date:</strong> ${appointmentDate || 'N/A'}</p>
          <p><strong>Time:</strong> ${appointmentTime || 'N/A'}</p>
          <p><strong>Required Services:</strong> ${requiredServices.join(', ')}</p>
          <p><strong>Service Details:</strong> ${serviceDetails}</p>
          <br>
          <p>Please log in to the admin dashboard to review and approve or reject this request.</p>
        </div>
        <br>
        <p style="color: #666;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Engineer notification email sent to ${engineerEmail} for section ${section}`);
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
