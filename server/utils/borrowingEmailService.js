const sgMail = require('@sendgrid/mail');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sectionTranslations = {
  'Electronics and Programming': 'الإلكترونيات والبرمجة',
  'CNC Laser': 'الليزر CNC',
  'CNC Wood': 'الخشب CNC',
  '3D': 'الطباعة ثلاثية الأبعاد',
  'Robotic and AI': 'الروبوتات والذكاء الاصطناعي',
  "Kid's Club": 'نادي الأطفال',
  'Vinyl Cutting': 'قطع الفينيل'
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
    <div style="background: linear-gradient(135deg, #1a56db, #2563eb); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 24px;">فاب لاب الأحساء</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">FABLAB Al-Ahsa - Component Borrowing</p>
    </div>
    ${content}
    <div style="background: #1a1a2e; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
      <p style="color: #fff; margin: 0;">فاب لاب الأحساء | FABLAB Al-Ahsa</p>
      <p style="color: rgba(255,255,255,0.6); margin: 10px 0 0 0; font-size: 12px;">نظام استعارة المكونات | Component Borrowing System</p>
    </div>
  </div>
`;

// Send borrowing confirmation to user
const sendBorrowingConfirmation = async (borrowing, user) => {
  const userName = getUserName(user);
  const sectionAr = translateSection(borrowing.section);

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: 'تم استلام طلب الاستعارة - Borrowing Request Received',
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        <p>تم استلام طلب استعارة المكونات الخاص بك بنجاح.</p>
        <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #2563eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>رقم الاستعارة:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>القسم:</strong></td><td>${sectionAr}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ الاستعارة:</strong></td><td>${formatDateAr(borrowing.borrowDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ الإرجاع المتوقع:</strong></td><td>${formatDateAr(borrowing.expectedReturnDate)}</td></tr>
          </table>
        </div>
        <p>سيتم مراجعة طلبك من قبل الإدارة وسيتم إرسال رسالة تأكيد إليك قريباً.</p>
      </div>
      <div style="border-top: 2px solid #2563eb; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        <p>Your component borrowing request has been received successfully.</p>
        <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2563eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>Borrowing ID:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Section:</strong></td><td>${borrowing.section}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Borrow Date:</strong></td><td>${formatDate(borrowing.borrowDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Expected Return:</strong></td><td>${formatDate(borrowing.expectedReturnDate)}</td></tr>
          </table>
        </div>
        <p>Your request will be reviewed by the administration and a confirmation will be sent to you soon.</p>
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Borrowing confirmation email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending borrowing confirmation email:', error);
  }
};

// Send status update (approval/rejection)
const sendBorrowingStatusUpdate = async (borrowing, user, status) => {
  const userName = getUserName(user);
  const isApproved = status === 'approved';
  const sectionAr = translateSection(borrowing.section);

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: isApproved
      ? 'تمت الموافقة على طلب الاستعارة - Borrowing Approved'
      : 'تم رفض طلب الاستعارة - Borrowing Rejected',
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        ${isApproved ? `
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="color: #155724; font-size: 18px; margin: 0; font-weight: bold;">تمت الموافقة على طلب الاستعارة</p>
          </div>
          <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #2563eb;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 5px 0;"><strong>رقم الاستعارة:</strong></td><td>${borrowing.borrowingId}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>القسم:</strong></td><td>${sectionAr}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>تاريخ الإرجاع المتوقع:</strong></td><td>${formatDateAr(borrowing.expectedReturnDate)}</td></tr>
            </table>
          </div>
          <p>يرجى الحضور لاستلام المكونات. تذكر إرجاعها في الموعد المحدد.</p>
        ` : `
          <div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="color: #721c24; font-size: 18px; margin: 0; font-weight: bold;">تم رفض طلب الاستعارة</p>
          </div>
          ${borrowing.adminNotes ? `
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #ef4444;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626;">ملاحظات:</h4>
              <p style="margin: 0;">${borrowing.adminNotes}</p>
            </div>
          ` : ''}
          <p>يمكنك التقديم مرة أخرى أو التواصل معنا للمزيد من المعلومات.</p>
        `}
      </div>
      <div style="border-top: 2px solid #2563eb; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        ${isApproved ? `
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="color: #155724; font-size: 18px; margin: 0; font-weight: bold;">Your Borrowing Request Has Been Approved</p>
          </div>
          <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2563eb;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 5px 0;"><strong>Borrowing ID:</strong></td><td>${borrowing.borrowingId}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Section:</strong></td><td>${borrowing.section}</td></tr>
              <tr><td style="padding: 5px 0;"><strong>Expected Return:</strong></td><td>${formatDate(borrowing.expectedReturnDate)}</td></tr>
            </table>
          </div>
          <p>Please come to collect the components. Remember to return them by the specified date.</p>
        ` : `
          <div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="color: #721c24; font-size: 18px; margin: 0; font-weight: bold;">Your Borrowing Request Has Been Rejected</p>
          </div>
          ${borrowing.adminNotes ? `
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ef4444;">
              <h4 style="margin: 0 0 10px 0; color: #dc2626;">Notes:</h4>
              <p style="margin: 0;">${borrowing.adminNotes}</p>
            </div>
          ` : ''}
          <p>You may submit a new request or contact us for more information.</p>
        `}
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Borrowing status update email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending borrowing status update email:', error);
  }
};

// Send return reminder (2 days before due)
const sendReturnReminder = async (borrowing, user) => {
  const userName = getUserName(user);

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: 'تذكير بإرجاع المكونات - Return Reminder',
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center; border-right: 4px solid #f59e0b;">
          <p style="color: #856404; font-size: 18px; margin: 0; font-weight: bold;">تذكير: موعد إرجاع المكونات قريب</p>
        </div>
        <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>رقم الاستعارة:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ الإرجاع:</strong></td><td>${formatDateAr(borrowing.expectedReturnDate)}</td></tr>
          </table>
        </div>
        <p>يرجى إرجاع المكونات المستعارة في الموعد المحدد لتجنب أي تأخير.</p>
      </div>
      <div style="border-top: 2px solid #2563eb; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #f59e0b;">
          <p style="color: #856404; font-size: 18px; margin: 0; font-weight: bold;">Reminder: Component Return Date Approaching</p>
        </div>
        <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>Borrowing ID:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Return Date:</strong></td><td>${formatDate(borrowing.expectedReturnDate)}</td></tr>
          </table>
        </div>
        <p>Please return the borrowed components by the specified date to avoid any delays.</p>
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Return reminder email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending return reminder email:', error);
  }
};

// Send overdue warning to borrower
const sendOverdueWarning = async (borrowing, user, warningNumber) => {
  const userName = getUserName(user);
  const daysOverdue = warningNumber;

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: `تحذير تأخير الإرجاع (${warningNumber}) - Overdue Warning #${warningNumber}`,
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center; border-right: 4px solid #ef4444;">
          <p style="color: #721c24; font-size: 18px; margin: 0; font-weight: bold;">تحذير #${warningNumber}: تأخر في إرجاع المكونات</p>
        </div>
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>رقم الاستعارة:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ الإرجاع المحدد:</strong></td><td>${formatDateAr(borrowing.expectedReturnDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>أيام التأخير:</strong></td><td>${daysOverdue} يوم</td></tr>
          </table>
        </div>
        <p style="color: #dc2626; font-weight: bold;">يرجى إرجاع المكونات في أقرب وقت ممكن. التأخير المتكرر قد يؤدي إلى تعليق صلاحيات الاستعارة.</p>
      </div>
      <div style="border-top: 2px solid #ef4444; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #ef4444;">
          <p style="color: #721c24; font-size: 18px; margin: 0; font-weight: bold;">Warning #${warningNumber}: Overdue Component Return</p>
        </div>
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>Borrowing ID:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Due Date:</strong></td><td>${formatDate(borrowing.expectedReturnDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Days Overdue:</strong></td><td>${daysOverdue} day(s)</td></tr>
          </table>
        </div>
        <p style="color: #dc2626; font-weight: bold;">Please return the components as soon as possible. Repeated late returns may result in suspension of borrowing privileges.</p>
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Overdue warning #${warningNumber} email sent to ${user.email}`);
  } catch (error) {
    console.error(`Error sending overdue warning #${warningNumber} email:`, error);
  }
};

// Send return confirmation to borrower (proof of return)
const sendReturnConfirmation = async (borrowing, user) => {
  const userName = getUserName(user);
  const sectionAr = translateSection(borrowing.section);
  const borrowDays = borrowing.borrowDate && borrowing.actualReturnDate
    ? Math.ceil((new Date(borrowing.actualReturnDate) - new Date(borrowing.borrowDate)) / (1000 * 60 * 60 * 24))
    : 'N/A';

  const msg = {
    to: user.email,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: 'تأكيد إرجاع المكونات - Return Confirmation',
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">مرحباً ${userName}</h2>
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center; border-right: 4px solid #22c55e;">
          <p style="color: #155724; font-size: 18px; margin: 0; font-weight: bold;">✓ تم تأكيد إرجاع المكونات بنجاح</p>
        </div>
        <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-right: 4px solid #2563eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>رقم الاستعارة:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>القسم:</strong></td><td>${sectionAr}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>وصف المكونات:</strong></td><td>${borrowing.componentDescription}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ الاستعارة:</strong></td><td>${formatDateAr(borrowing.borrowDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ الإرجاع:</strong></td><td>${formatDateAr(borrowing.actualReturnDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>مدة الاستعارة:</strong></td><td>${borrowDays} يوم</td></tr>
          </table>
        </div>
        <p>هذا البريد الإلكتروني يعد إثباتاً على إرجاع المكونات المستعارة بنجاح. يرجى الاحتفاظ بهذه الرسالة كمرجع.</p>
        <p style="color: #16a34a; font-weight: bold;">شكراً لالتزامك بالإرجاع. نتطلع لخدمتك مرة أخرى!</p>
      </div>
      <div style="border-top: 2px solid #22c55e; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #333; margin-top: 0;">Hello ${userName}</h2>
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #22c55e;">
          <p style="color: #155724; font-size: 18px; margin: 0; font-weight: bold;">✓ Component Return Confirmed Successfully</p>
        </div>
        <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2563eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 5px 0;"><strong>Borrowing ID:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Section:</strong></td><td>${borrowing.section}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Components:</strong></td><td>${borrowing.componentDescription}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Borrow Date:</strong></td><td>${formatDate(borrowing.borrowDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Return Date:</strong></td><td>${formatDate(borrowing.actualReturnDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Borrowing Duration:</strong></td><td>${borrowDays} day(s)</td></tr>
          </table>
        </div>
        <p>This email serves as proof that the borrowed components have been returned successfully. Please keep this message for your records.</p>
        <p style="color: #16a34a; font-weight: bold;">Thank you for returning the items. We look forward to serving you again!</p>
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Return confirmation email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending return confirmation email:', error);
  }
};

// Send admin alert for 3rd overdue warning
const sendAdminOverdueAlert = async (borrowing, user) => {
  const userName = getUserName(user);
  const adminEmail = process.env.SENDGRID_FROM_EMAIL;

  const msg = {
    to: adminEmail,
    from: { email: process.env.SENDGRID_FROM_EMAIL, name: process.env.SENDGRID_FROM_NAME },
    subject: `تنبيه: مكونات متأخرة تحتاج تواصل شخصي - Overdue Alert: Personal Contact Needed`,
    html: emailWrapper(`
      <div dir="rtl" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #dc2626; margin-top: 0;">تنبيه: مكونات متأخرة</h2>
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border-right: 4px solid #ef4444;">
          <p>المستعير <strong>${userName}</strong> لم يرجع المكونات بعد 3 تحذيرات.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 5px 0;"><strong>رقم الاستعارة:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>الهاتف:</strong></td><td>${user.phoneNumber || 'N/A'}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>البريد:</strong></td><td>${user.email}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>تاريخ الإرجاع:</strong></td><td>${formatDateAr(borrowing.expectedReturnDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>المكونات:</strong></td><td>${borrowing.componentDescription}</td></tr>
          </table>
        </div>
        <p style="margin-top: 15px; font-weight: bold;">يرجى التواصل المباشر مع المستعير.</p>
      </div>
      <div style="border-top: 2px solid #ef4444; margin: 0;"></div>
      <div dir="ltr" style="padding: 25px; background: #ffffff; border: 1px solid #e5e5e5;">
        <h2 style="color: #dc2626; margin-top: 0;">Alert: Overdue Components</h2>
        <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
          <p>Borrower <strong>${userName}</strong> has not returned components after 3 warnings.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 5px 0;"><strong>Borrowing ID:</strong></td><td>${borrowing.borrowingId}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Phone:</strong></td><td>${user.phoneNumber || 'N/A'}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Email:</strong></td><td>${user.email}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Due Date:</strong></td><td>${formatDate(borrowing.expectedReturnDate)}</td></tr>
            <tr><td style="padding: 5px 0;"><strong>Components:</strong></td><td>${borrowing.componentDescription}</td></tr>
          </table>
        </div>
        <p style="margin-top: 15px; font-weight: bold;">Please contact the borrower directly.</p>
      </div>
    `)
  };

  try {
    await sgMail.send(msg);
    console.log(`Admin overdue alert sent for borrowing ${borrowing.borrowingId}`);
  } catch (error) {
    console.error('Error sending admin overdue alert email:', error);
  }
};

module.exports = {
  sendBorrowingConfirmation,
  sendBorrowingStatusUpdate,
  sendReturnConfirmation,
  sendReturnReminder,
  sendOverdueWarning,
  sendAdminOverdueAlert
};
