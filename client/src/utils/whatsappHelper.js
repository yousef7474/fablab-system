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

// Section translations
const sectionTranslations = {
  'Electronics and Programming': 'الإلكترونيات والبرمجة',
  'CNC Laser': 'الليزر CNC',
  'CNC Wood': 'الخشب CNC',
  '3D': 'الطباعة ثلاثية الأبعاد',
  'Robotic and AI': 'الروبوتات والذكاء الاصطناعي',
  "Kid's Club": 'نادي الأطفال',
  'Vinyl Cutting': 'قطع الفينيل'
};

// Application type translations
const applicationTypeTranslations = {
  'Beneficiary': { ar: 'مستفيد', en: 'Beneficiary' },
  'Visitor': { ar: 'زائر', en: 'Visitor' },
  'Entrepreneur': { ar: 'رائد أعمال', en: 'Entrepreneur' },
  'Student': { ar: 'طالب', en: 'Student' },
  'FABLAB Visit': { ar: 'زيارة فاب لاب', en: 'FABLAB Visit' }
};

// Service translations
const serviceTranslations = {
  'In-person consultation': { ar: 'استشارة حضورية', en: 'In-person consultation' },
  'Online consultation': { ar: 'استشارة عن بعد', en: 'Online consultation' },
  'Machine/Device reservation': { ar: 'حجز جهاز / آلة', en: 'Machine/Device reservation' },
  'Personal workspace': { ar: 'مساحة عمل شخصية', en: 'Personal workspace' },
  'Support in project implementation': { ar: 'دعم في تنفيذ المشروع', en: 'Support in project implementation' },
  'FABLAB Visit': { ar: 'زيارة فاب لاب', en: 'FABLAB Visit' },
  'Other': { ar: 'أخرى', en: 'Other' }
};

// Format time to remove seconds
const formatTime = (time) => {
  if (!time) return null;
  // If time has seconds (HH:MM:SS), remove them
  if (time.includes(':')) {
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
  }
  return time;
};

// Translate application type
const translateApplicationType = (type, isArabic) => {
  const translation = applicationTypeTranslations[type];
  if (translation) {
    return isArabic ? translation.ar : translation.en;
  }
  return type || (isArabic ? 'غير محدد' : 'N/A');
};

// Translate services array
const translateServices = (services, isArabic) => {
  if (!services) return isArabic ? 'غير محدد' : 'N/A';

  if (typeof services === 'string') {
    const translation = serviceTranslations[services];
    return translation ? (isArabic ? translation.ar : translation.en) : services;
  }

  if (Array.isArray(services) && services.length > 0) {
    return services.map(s => {
      const translation = serviceTranslations[s];
      return translation ? (isArabic ? translation.ar : translation.en) : s;
    }).join(isArabic ? '، ' : ', ');
  }

  return isArabic ? 'غير محدد' : 'N/A';
};

// Message templates - Professional Arabic/English

export const getRegistrationConfirmationMessage = (userName, registrationId, userId, applicationType, services, isArabic = true) => {
  const translatedType = translateApplicationType(applicationType, isArabic);
  const translatedServices = translateServices(services, isArabic);

  if (isArabic) {
    return `السلام عليكم ${userName}،

تم استلام طلب التسجيل الخاص بكم بنجاح.

رقم التسجيل: ${registrationId}
رقم المستفيد: ${userId || 'غير متوفر'}
نوع الطلب: ${translatedType}
الخدمات المطلوبة: ${translatedServices}

سيتم مراجعة طلبكم من قبل الفريق المختص وسيتم التواصل معكم قريباً.

مع تحيات،
فاب لاب الأحساء
FABLAB Al-Ahsa`;
  }

  return `Dear ${userName},

Your registration request has been received successfully.

Registration ID: ${registrationId}
User ID: ${userId || 'N/A'}
Application Type: ${translatedType}
Requested Services: ${translatedServices}

Your request will be reviewed by our team and we will contact you soon.

Best regards,
FABLAB Al-Ahsa`;
};

export const getApprovalMessage = (userName, registrationId, userId, appointmentDate, appointmentTime, section, applicationType, services, adminMessage = null, isArabic = true) => {
  const sectionAr = sectionTranslations[section] || section;
  const formattedTime = formatTime(appointmentTime);
  const translatedType = translateApplicationType(applicationType, isArabic);
  const translatedServices = translateServices(services, isArabic);

  if (isArabic) {
    let message = `السلام عليكم ${userName}،

يسرنا إبلاغكم بأنه تمت الموافقة على طلب التسجيل الخاص بكم.

رقم التسجيل: ${registrationId}
رقم المستفيد: ${userId || 'غير متوفر'}
نوع الطلب: ${translatedType}
الخدمات: ${translatedServices}

تفاصيل الموعد:
- التاريخ: ${appointmentDate || 'سيتم تحديده'}
- الوقت: ${formattedTime || 'سيتم تحديده'}
- القسم: ${sectionAr}`;

    if (adminMessage) {
      message += `

ملاحظة من الإدارة:
${adminMessage}`;
    }

    message += `

نتطلع لاستقبالكم. يرجى الحضور في الموعد المحدد.

مع تحيات،
فاب لاب الأحساء
FABLAB Al-Ahsa`;

    return message;
  }

  let message = `Dear ${userName},

We are pleased to inform you that your registration has been approved.

Registration ID: ${registrationId}
User ID: ${userId || 'N/A'}
Application Type: ${translatedType}
Services: ${translatedServices}

Appointment Details:
- Date: ${appointmentDate || 'To be determined'}
- Time: ${formattedTime || 'To be determined'}
- Section: ${section}`;

  if (adminMessage) {
    message += `

Note from Admin:
${adminMessage}`;
  }

  message += `

We look forward to welcoming you. Please arrive on time.

Best regards,
FABLAB Al-Ahsa`;

  return message;
};

export const getRejectionMessage = (userName, registrationId, userId, applicationType, services, rejectionReason = null, adminMessage = null, isArabic = true) => {
  const translatedType = translateApplicationType(applicationType, isArabic);
  const translatedServices = translateServices(services, isArabic);

  if (isArabic) {
    let message = `السلام عليكم ${userName}،

نأسف لإبلاغكم بأنه لم تتم الموافقة على طلب التسجيل الخاص بكم.

رقم التسجيل: ${registrationId}
رقم المستفيد: ${userId || 'غير متوفر'}
نوع الطلب: ${translatedType}
الخدمات: ${translatedServices}`;

    if (rejectionReason) {
      message += `

سبب عدم الموافقة:
${rejectionReason}`;
    }

    if (adminMessage) {
      message += `

ملاحظة من الإدارة:
${adminMessage}`;
    }

    message += `

يمكنكم التقديم مرة أخرى أو التواصل معنا للمزيد من المعلومات.

مع تحيات،
فاب لاب الأحساء
FABLAB Al-Ahsa`;

    return message;
  }

  let message = `Dear ${userName},

We regret to inform you that your registration request has not been approved.

Registration ID: ${registrationId}
User ID: ${userId || 'N/A'}
Application Type: ${translatedType}
Services: ${translatedServices}`;

  if (rejectionReason) {
    message += `

Reason:
${rejectionReason}`;
  }

  if (adminMessage) {
    message += `

Note from Admin:
${adminMessage}`;
  }

  message += `

You may submit a new application or contact us for more information.

Best regards,
FABLAB Al-Ahsa`;

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
