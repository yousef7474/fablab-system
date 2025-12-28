// WhatsApp Helper - Generate WhatsApp URLs with pre-filled messages

// Format phone number for WhatsApp
export const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return null;

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // Handle Saudi Arabian numbers
  if (cleaned.startsWith('966')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    // Remove leading 0 and add Saudi country code
    return '966' + cleaned.substring(1);
  }
  if (cleaned.startsWith('5') && cleaned.length === 9) {
    // Saudi mobile number without country code
    return '966' + cleaned;
  }

  return cleaned;
};

// Generate WhatsApp URL
export const generateWhatsAppUrl = (phone, message) => {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

// Message templates
export const getRegistrationConfirmationMessage = (userName, registrationId, isArabic = true) => {
  if (isArabic) {
    return `مرحباً ${userName} 👋

تم استلام طلب التسجيل الخاص بك بنجاح ✅

رقم التسجيل: *${registrationId}*

سيتم مراجعة طلبك من قبل المهندس المسؤول وسنرسل لك رسالة تأكيد قريباً.

_فاب لاب الأحساء | FABLAB Al-Ahsa_`;
  }

  return `Hello ${userName} 👋

Your registration request has been received successfully ✅

Registration ID: *${registrationId}*

Your request will be reviewed and a confirmation will be sent to you soon.

_FABLAB Al-Ahsa_`;
};

export const getApprovalMessage = (userName, registrationId, appointmentDate, appointmentTime, section, adminMessage = null, isArabic = true) => {
  const sectionTranslations = {
    'Electronics and Programming': 'الإلكترونيات والبرمجة',
    'CNC Laser': 'الليزر CNC',
    'CNC Wood': 'الخشب CNC',
    '3D': 'الطباعة ثلاثية الأبعاد',
    'Robotic and AI': 'الروبوتات والذكاء الاصطناعي',
    "Kid's Club": 'نادي الأطفال',
    'Vinyl Cutting': 'قطع الفينيل'
  };

  const sectionAr = sectionTranslations[section] || section;

  if (isArabic) {
    let message = `مرحباً ${userName} 👋

✅ *تم الموافقة على طلب التسجيل الخاص بك!*

رقم التسجيل: *${registrationId}*

📅 *تفاصيل الموعد:*
• التاريخ: ${appointmentDate || 'غير محدد'}
• الوقت: ${appointmentTime || 'غير محدد'}
• القسم: ${sectionAr}`;

    if (adminMessage) {
      message += `

💬 *رسالة من الإدارة:*
${adminMessage}`;
    }

    message += `

نتطلع لرؤيتك! 🎉

_فاب لاب الأحساء | FABLAB Al-Ahsa_`;

    return message;
  }

  let message = `Hello ${userName} 👋

✅ *Your registration has been approved!*

Registration ID: *${registrationId}*

📅 *Appointment Details:*
• Date: ${appointmentDate || 'N/A'}
• Time: ${appointmentTime || 'N/A'}
• Section: ${section}`;

  if (adminMessage) {
    message += `

💬 *Message from Admin:*
${adminMessage}`;
  }

  message += `

We look forward to seeing you! 🎉

_FABLAB Al-Ahsa_`;

  return message;
};

export const getRejectionMessage = (userName, registrationId, rejectionReason = null, adminMessage = null, isArabic = true) => {
  if (isArabic) {
    let message = `مرحباً ${userName} 👋

❌ *للأسف، تم رفض طلب التسجيل الخاص بك*

رقم التسجيل: *${registrationId}*`;

    if (rejectionReason) {
      message += `

📝 *سبب الرفض:*
${rejectionReason}`;
    }

    if (adminMessage) {
      message += `

💬 *رسالة من الإدارة:*
${adminMessage}`;
    }

    message += `

يمكنك التقديم مرة أخرى أو التواصل معنا للمزيد من المعلومات.

_فاب لاب الأحساء | FABLAB Al-Ahsa_`;

    return message;
  }

  let message = `Hello ${userName} 👋

❌ *Unfortunately, your registration has been rejected*

Registration ID: *${registrationId}*`;

  if (rejectionReason) {
    message += `

📝 *Reason for Rejection:*
${rejectionReason}`;
  }

  if (adminMessage) {
    message += `

💬 *Message from Admin:*
${adminMessage}`;
  }

  message += `

You may submit a new application or contact us for more information.

_FABLAB Al-Ahsa_`;

  return message;
};

// Open WhatsApp with message
export const openWhatsApp = (phone, message) => {
  const url = generateWhatsAppUrl(phone, message);
  if (url) {
    window.open(url, '_blank');
    return true;
  }
  return false;
};
