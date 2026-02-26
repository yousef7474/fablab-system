const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sectionTranslations = {
  'Electronics and Programming': 'الإلكترونيات والبرمجة',
  'CNC Laser': 'القطع بالليزر',
  'CNC Wood': 'القطع الخشبي',
  '3D': 'الطباعة ثلاثية الأبعاد',
  'Robotic and AI': 'الروبوتات والذكاء الاصطناعي',
  "Kid's Club": 'نادي الأطفال',
  'Vinyl Cutting': 'قص الفينيل',
  'Other': 'أخرى'
};

const translateSection = (section) => sectionTranslations[section] || section;

const getUserName = (user) => {
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  return user.name || 'User';
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
};

const formatDateAr = (dateStr) => {
  if (!dateStr) return 'غير محدد';
  try {
    return new Date(dateStr).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
};

const emailWrapper = (content) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #1e7a9a, #2596be); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 24px;">فاب لاب الأحساء</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">FABLAB Al-Ahsa - Education System</p>
    </div>
    ${content}
    <div style="background: #1a1a2e; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="color: #fff; margin: 0;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
      <p style="color: rgba(255,255,255,0.6); margin: 10px 0 0 0; font-size: 12px;">نظام التعليم | Education System</p>
    </div>
  </div>
`;

// Send education request confirmation to teacher
const sendEducationConfirmation = async (education, user) => {
  const userName = getUserName(user);
  const sectionAr = translateSection(education.section);

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: 'تم استلام طلب التعليم - Education Request Received',
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        <p>تم استلام طلب التعليم الخاص بك بنجاح.</p>
        <div style="background: #e8f6fb; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #2596be;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>رقم الطلب:</strong></td><td>${education.educationId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>القسم:</strong></td><td>${sectionAr}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>عدد الطلاب:</strong></td><td>${education.numberOfStudents}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ البدء:</strong></td><td>${formatDateAr(education.periodStartDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ الانتهاء:</strong></td><td>${formatDateAr(education.periodEndDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>الوقت:</strong></td><td>${education.periodStartTime} - ${education.periodEndTime}</td></tr>
          </table>
        </div>
        <p>سيتم مراجعة طلبك من قبل الإدارة وسيتم إرسال رسالة تأكيد إليك قريباً.</p>
      </div>
      <div style="border-top: 2px solid #2596be; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        <p>Your education request has been received successfully.</p>
        <div style="background: #e8f6fb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2596be;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>Education ID:</strong></td><td>${education.educationId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Section:</strong></td><td>${education.section}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Students:</strong></td><td>${education.numberOfStudents}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Start Date:</strong></td><td>${formatDate(education.periodStartDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>End Date:</strong></td><td>${formatDate(education.periodEndDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Time:</strong></td><td>${education.periodStartTime} - ${education.periodEndTime}</td></tr>
          </table>
        </div>
        <p>Your request will be reviewed by the administration and a confirmation will be sent to you soon.</p>
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Education confirmation email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending education confirmation email:', error);
  }
};

// Send status update (approval/rejection)
const sendEducationStatusUpdate = async (education, user, status) => {
  const userName = getUserName(user);
  const isApproved = status === 'approved';
  const sectionAr = translateSection(education.section);

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: isApproved
      ? 'تمت الموافقة على طلب التعليم - Education Request Approved'
      : 'تم رفض طلب التعليم - Education Request Rejected',
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        ${isApproved ? `
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="color: #155724; font-size: 18px; margin: 0; font-weight: bold;">تمت الموافقة على طلب التعليم</p>
          </div>
          <div style="background: #e8f6fb; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #2596be;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 5px 0;"><strong>رقم الطلب:</strong></td><td>${education.educationId}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>القسم:</strong></td><td>${sectionAr}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>الفترة:</strong></td><td>${formatDateAr(education.periodStartDate)} - ${formatDateAr(education.periodEndDate)}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>الوقت:</strong></td><td>${education.periodStartTime} - ${education.periodEndTime}</td></tr>
            </table>
          </div>
          <p>يرجى الحضور في الموعد المحدد. تذكر الالتزام بالشروط والأحكام.</p>
        ` : `
          <div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="color: #721c24; font-size: 18px; margin: 0; font-weight: bold;">تم رفض طلب التعليم</p>
          </div>
          ${education.adminNotes ? `
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #ef4444;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626;">ملاحظات:</h4>
              <p style="margin: 0;">${education.adminNotes}</p>
            </div>
          ` : ''}
          <p>يمكنك التقديم مرة أخرى أو التواصل معنا للمزيد من المعلومات.</p>
        `}
      </div>
      <div style="border-top: 2px solid #2596be; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        ${isApproved ? `
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="color: #155724; font-size: 18px; margin: 0; font-weight: bold;">Your Education Request Has Been Approved</p>
          </div>
          <div style="background: #e8f6fb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2596be;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 5px 0;"><strong>Education ID:</strong></td><td>${education.educationId}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Section:</strong></td><td>${education.section}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Period:</strong></td><td>${formatDate(education.periodStartDate)} - ${formatDate(education.periodEndDate)}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Time:</strong></td><td>${education.periodStartTime} - ${education.periodEndTime}</td></tr>
            </table>
          </div>
          <p>Please attend at the scheduled time. Remember to comply with the terms and conditions.</p>
        ` : `
          <div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="color: #721c24; font-size: 18px; margin: 0; font-weight: bold;">Your Education Request Has Been Rejected</p>
          </div>
          ${education.adminNotes ? `
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626;">Notes:</h4>
              <p style="margin: 0;">${education.adminNotes}</p>
            </div>
          ` : ''}
          <p>You may submit a new request or contact us for more information.</p>
        `}
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Education status update email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending education status update email:', error);
  }
};

// Send period end notification
const sendEducationPeriodEnd = async (education, user) => {
  const userName = getUserName(user);
  const sectionAr = translateSection(education.section);

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: 'انتهاء فترة التعليم - Education Period Ended',
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        <div style="background: #e8f6fb; padding: 15px; border-radius: 8px; text-align: center; border-right: 4px solid #2596be;">
          <p style="color: #1e7a9a; font-size: 18px; margin: 0; font-weight: bold;">انتهت فترة التعليم الخاصة بك</p>
        </div>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>رقم الطلب:</strong></td><td>${education.educationId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>القسم:</strong></td><td>${sectionAr}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>الفترة:</strong></td><td>${formatDateAr(education.periodStartDate)} - ${formatDateAr(education.periodEndDate)}</td></tr>
          </table>
        </div>
        <p>شكراً لاستخدامك مرافق فاب لاب الأحساء. نتمنى أن تكون التجربة مفيدة لك ولطلابك.</p>
        <p>يمكنك التقديم لفترة جديدة في أي وقت.</p>
      </div>
      <div style="border-top: 2px solid #2596be; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        <div style="background: #e8f6fb; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #2596be;">
          <p style="color: #1e7a9a; font-size: 18px; margin: 0; font-weight: bold;">Your Education Period Has Ended</p>
        </div>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>Education ID:</strong></td><td>${education.educationId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Section:</strong></td><td>${education.section}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Period:</strong></td><td>${formatDate(education.periodStartDate)} - ${formatDate(education.periodEndDate)}</td></tr>
          </table>
        </div>
        <p>Thank you for using FABLAB Al-Ahsa facilities. We hope the experience was beneficial for you and your students.</p>
        <p>You can apply for a new period at any time.</p>
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Education period end email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending education period end email:', error);
  }
};

// Send custom message to teacher
const sendCustomEducationEmail = async (education, user, subject, messageText) => {
  const userName = getUserName(user);

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: subject || 'رسالة من فاب لاب - Message from FABLAB',
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        <div style="background: #e8f6fb; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #2596be;">
          <p style="padding: 5px 0;"><strong>رقم الطلب:</strong> ${education.educationId}</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 15px 0; white-space: pre-wrap; line-height: 1.8;">
          ${messageText}
        </div>
      </div>
      <div style="border-top: 2px solid #2596be; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        <div style="background: #e8f6fb; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2596be;">
          <p style="padding: 5px 0;"><strong>Education ID:</strong> ${education.educationId}</p>
        </div>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 15px 0; white-space: pre-wrap; line-height: 1.8;">
          ${messageText}
        </div>
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Custom education email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending custom education email:', error);
  }
};

module.exports = {
  sendEducationConfirmation,
  sendEducationStatusUpdate,
  sendEducationPeriodEnd,
  sendCustomEducationEmail
};
