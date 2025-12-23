import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      "home": "Home",
      "admin": "Admin Dashboard",
      "register": "Register",

      // Registration Form Sections
      "section1": "Application Type",
      "section2": "Application Data",
      "section3": "FABLAB Sections",
      "section4": "Required Service",
      "section5": "Select Date and Time",
      "section6": "Details of what is required",
      "section7": "Type of Service",
      "section8": "Beneficiary's Commitment",

      // Application Types
      "beneficiary": "Beneficiary",
      "visitor": "Visitor",
      "volunteer": "Volunteer",
      "talented": "Talented",
      "entity": "Entity",
      "fablabVisit": "FABLAB Visit",

      // Form Fields
      "firstName": "First Name",
      "lastName": "Last Name",
      "sex": "Sex",
      "male": "Male",
      "female": "Female",
      "nationality": "Nationality",
      "nationalId": "National ID",
      "phoneNumber": "Phone Number",
      "email": "Email Address",
      "currentJob": "Current Job",
      "nationalAddress": "National Address",
      "name": "Name",
      "personInCharge": "Person in Charge",
      "visitingEntity": "Visiting Entity",

      // FABLAB Sections
      "electronicsAndProgramming": "Electronics and Programming",
      "cncLaser": "CNC Laser",
      "cncWood": "CNC Wood",
      "3d": "3D",
      "roboticAndAI": "Robotic and AI",
      "kidsClub": "Kid's Club",
      "vinylCutting": "Vinyl Cutting",

      // Services
      "inPersonConsultation": "In-person consultation",
      "onlineConsultation": "Online consultation",
      "machineReservation": "Machine/Device reservation",
      "personalWorkspace": "Personal workspace",
      "projectSupport": "Support in project implementation",
      "other": "Other",

      // Service Types
      "officialPartners": "From official partners",
      "free": "Free",
      "partialCompensation": "Partial Financial compensation",
      "fullCompensation": "Full Financial compensation",

      // Date/Time Fields
      "date": "Date",
      "time": "Time",
      "duration": "Duration (minutes)",
      "startDate": "Start Date",
      "endDate": "End Date",
      "startTime": "Start Time",
      "endTime": "End Time",
      "visitDate": "Visit Date",
      "visitStartTime": "Visit Start Time",
      "visitEndTime": "Visit End Time",

      // Buttons
      "next": "Next",
      "previous": "Previous",
      "submit": "Submit",
      "cancel": "Cancel",
      "login": "Login",
      "logout": "Logout",
      "save": "Save",
      "delete": "Delete",
      "edit": "Edit",
      "approve": "Approve",
      "reject": "Reject",
      "search": "Search",
      "filter": "Filter",
      "export": "Export",
      "print": "Print",

      // Messages
      "registrationSuccess": "Registration Successful!",
      "registrationError": "Registration Failed",
      "pleaseWait": "Please wait...",
      "loading": "Loading...",
      "noDataAvailable": "No data available",

      // Commitment Text
      "commitmentText": "I commit [name] I will abide by all the terms and conditions stated in the document and contribute to spreading the culture of the Fab Lab and its importance to the local and global community. If I do anything contrary to that, the party has the right to take whatever action it deems appropriate to protect its rights.",

      // Admin Dashboard
      "dashboard": "Dashboard",
      "registrations": "Registrations",
      "users": "Users",
      "analytics": "Analytics",
      "settings": "Settings",
      "totalRegistrations": "Total Registrations",
      "pending": "Pending",
      "approved": "Approved",
      "rejected": "Rejected",
      "onHold": "On Hold",
      "status": "Status",
      "actions": "Actions",
      "details": "Details",
      "userProfile": "User Profile",
      "registrationHistory": "Registration History",

      // Filters
      "filterBySection": "Filter by Section",
      "filterByType": "Filter by Type",
      "filterByStatus": "Filter by Status",
      "filterByDate": "Filter by Date",
      "day": "Day",
      "week": "Week",
      "month": "Month",
      "3months": "3 Months",
      "6months": "6 Months",
      "9months": "9 Months",
      "year": "Year",

      // Entities
      "fablabAlAhsa": "FABLAB AL-Ahsa",
      "nouraHouse": "Noura Al-Mousa House for Culture and Arts",
      "ahsaAcademy": "Al-Ahsa Academy for Crafts",
      "innovationCenter": "Creativity and Innovation Training Center",
      "rashedFoundation": "Abdulmonem Al-Rashed Foundation",

      // Schedule & Calendar
      "schedule": "Schedule",
      "employees": "Employees",
      "addEmployee": "Add Employee",
      "editEmployee": "Edit Employee",
      "employeeName": "Employee Name",
      "employeeSection": "Section",
      "employeeColor": "Color",
      "todaysAppointments": "Today's Appointments",
      "noAppointments": "No appointments for this day",
      "noEmployees": "No employees added yet",

      // Calendar Booking
      "selectDate": "Select Date",
      "selectTime": "Select Time",
      "selectDuration": "Select Duration",
      "availableSlots": "Available Time Slots",
      "noAvailableSlots": "No available slots for this date",
      "slotAvailable": "Available",
      "slotBooked": "Booked",
      "minutes": "minutes",
      "hour": "hour",
      "hours": "hours",
      "30min": "30 minutes",
      "1hour": "1 hour",
      "2hours": "2 hours",

      // User Profile
      "viewProfile": "View Profile",
      "userRegistrations": "User Registrations",
      "noRegistrations": "No registrations found",
      "totalUserRegistrations": "Total Registrations",
      "registeredOn": "Registered on",
      "lastActivity": "Last Activity",

      // Analytics
      "registrationsBySection": "Registrations by Section",
      "registrationsByType": "Registrations by Type",
      "registrationsByStatus": "Registrations by Status",
      "registrationTrends": "Registration Trends",
      "monthlyOverview": "Monthly Overview",
      "weeklyOverview": "Weekly Overview",
      "averagePerDay": "Average per Day",
      "peakDay": "Peak Day",
      "conversionRate": "Conversion Rate",

      // Additional
      "all": "All",
      "today": "Today",
      "thisWeek": "This Week",
      "thisMonth": "This Month",
      "exportCSV": "Export CSV",
      "downloadPDF": "Download PDF",
      "printRegistration": "Print Registration",
      "registrationDetails": "Registration Details",
      "applicantInfo": "Applicant Information",
      "serviceDetails": "Service Details",
      "appointmentDetails": "Appointment Details",
      "createdAt": "Created At",
      "updatedAt": "Updated At",
      "viewAll": "View All",
      "quickActions": "Quick Actions",
      "recentActivity": "Recent Activity"
    }
  },
  ar: {
    translation: {
      // Navigation
      "home": "الرئيسية",
      "admin": "لوحة التحكم",
      "register": "تسجيل",

      // Registration Form Sections
      "section1": "نوع الطلب",
      "section2": "بيانات الطلب",
      "section3": "أقسام فاب لاب",
      "section4": "الخدمة المطلوبة",
      "section5": "اختيار التاريخ والوقت",
      "section6": "تفاصيل ما هو مطلوب",
      "section7": "نوع الخدمة",
      "section8": "التزام المستفيد",

      // Application Types
      "beneficiary": "مستفيد",
      "visitor": "زائر",
      "volunteer": "متطوع",
      "talented": "موهوب",
      "entity": "جهة",
      "fablabVisit": "زيارة فاب لاب",

      // Form Fields
      "firstName": "الاسم الأول",
      "lastName": "اسم العائلة",
      "sex": "الجنس",
      "male": "ذكر",
      "female": "أنثى",
      "nationality": "الجنسية",
      "nationalId": "رقم الهوية/الإقامة",
      "phoneNumber": "رقم الهاتف",
      "email": "البريد الإلكتروني",
      "currentJob": "العمل الحالي/الدراسة",
      "nationalAddress": "العنوان الوطني",
      "name": "الاسم",
      "personInCharge": "الشخص المسؤول",
      "visitingEntity": "الجهة الزائرة",

      // FABLAB Sections
      "electronicsAndProgramming": "الإلكترونيات والبرمجة",
      "cncLaser": "CNC الليزر",
      "cncWood": "CNC الخشب",
      "3d": "الطباعة ثلاثية الأبعاد",
      "roboticAndAI": "الروبوت والذكاء الاصطناعي",
      "kidsClub": "نادي الأطفال",
      "vinylCutting": "القطع بالفينيل",

      // Services
      "inPersonConsultation": "استشارة حضورياً",
      "onlineConsultation": "استشارة أونلاين",
      "machineReservation": "حجز آلة/جهاز",
      "personalWorkspace": "مساحة عمل شخصية",
      "projectSupport": "المساندة في تنفيذ مشروع",
      "other": "أخرى",

      // Service Types
      "officialPartners": "من الشركاء الرسميين",
      "free": "مجاناً",
      "partialCompensation": "مقابل مادي جزئي",
      "fullCompensation": "مقابل مادي كامل",

      // Date/Time Fields
      "date": "التاريخ",
      "time": "الوقت",
      "duration": "المدة (بالدقائق)",
      "startDate": "تاريخ البداية",
      "endDate": "تاريخ النهاية",
      "startTime": "وقت البداية",
      "endTime": "وقت النهاية",
      "visitDate": "تاريخ الزيارة",
      "visitStartTime": "وقت بداية الزيارة",
      "visitEndTime": "وقت نهاية الزيارة",

      // Buttons
      "next": "التالي",
      "previous": "السابق",
      "submit": "إرسال",
      "cancel": "إلغاء",
      "login": "تسجيل الدخول",
      "logout": "تسجيل الخروج",
      "save": "حفظ",
      "delete": "حذف",
      "edit": "تعديل",
      "approve": "قبول",
      "reject": "رفض",
      "search": "بحث",
      "filter": "تصفية",
      "export": "تصدير",
      "print": "طباعة",

      // Messages
      "registrationSuccess": "تم التسجيل بنجاح!",
      "registrationError": "فشل التسجيل",
      "pleaseWait": "يرجى الانتظار...",
      "loading": "جاري التحميل...",
      "noDataAvailable": "لا توجد بيانات متاحة",

      // Commitment Text
      "commitmentText": "التزم انا [الاسم] بكل ماجاء بالوثيقة من شروط والتزامات وسأسهم في نشر ثقافة الفاب لاب وأهميته للمجتمع المحلي والعالمي، وإذا بدر مني مايخالف ذلك فللجهة الحق بأتخاذ ماتراه مناسباً لحفظ حقوقها",

      // Admin Dashboard
      "dashboard": "لوحة التحكم",
      "registrations": "التسجيلات",
      "users": "المستخدمون",
      "analytics": "الإحصائيات",
      "settings": "الإعدادات",
      "totalRegistrations": "إجمالي التسجيلات",
      "pending": "قيد المراجعة",
      "approved": "مقبول",
      "rejected": "مرفوض",
      "onHold": "معلق",
      "status": "الحالة",
      "actions": "الإجراءات",
      "details": "التفاصيل",
      "userProfile": "ملف المستخدم",
      "registrationHistory": "سجل التسجيلات",

      // Filters
      "filterBySection": "تصفية حسب القسم",
      "filterByType": "تصفية حسب النوع",
      "filterByStatus": "تصفية حسب الحالة",
      "filterByDate": "تصفية حسب التاريخ",
      "day": "يوم",
      "week": "أسبوع",
      "month": "شهر",
      "3months": "3 أشهر",
      "6months": "6 أشهر",
      "9months": "9 أشهر",
      "year": "سنة",

      // Entities
      "fablabAlAhsa": "فاب لاب الأحساء",
      "nouraHouse": "بيت نورة الموسى للثقافة والفنون",
      "ahsaAcademy": "أكاديمية الأحساء للحرف",
      "innovationCenter": "مركز التدريب للإبداع والابتكار",
      "rashedFoundation": "مؤسسة عبدالمنعم الراشد الإنسانية",

      // Schedule & Calendar
      "schedule": "الجدول",
      "employees": "الموظفون",
      "addEmployee": "إضافة موظف",
      "editEmployee": "تعديل موظف",
      "employeeName": "اسم الموظف",
      "employeeSection": "القسم",
      "employeeColor": "اللون",
      "todaysAppointments": "مواعيد اليوم",
      "noAppointments": "لا توجد مواعيد لهذا اليوم",
      "noEmployees": "لم يتم إضافة موظفين بعد",

      // Calendar Booking
      "selectDate": "اختر التاريخ",
      "selectTime": "اختر الوقت",
      "selectDuration": "اختر المدة",
      "availableSlots": "الأوقات المتاحة",
      "noAvailableSlots": "لا توجد أوقات متاحة لهذا التاريخ",
      "slotAvailable": "متاح",
      "slotBooked": "محجوز",
      "minutes": "دقيقة",
      "hour": "ساعة",
      "hours": "ساعات",
      "30min": "30 دقيقة",
      "1hour": "ساعة واحدة",
      "2hours": "ساعتان",

      // User Profile
      "viewProfile": "عرض الملف",
      "userRegistrations": "تسجيلات المستخدم",
      "noRegistrations": "لا توجد تسجيلات",
      "totalUserRegistrations": "إجمالي التسجيلات",
      "registeredOn": "تاريخ التسجيل",
      "lastActivity": "آخر نشاط",

      // Analytics
      "registrationsBySection": "التسجيلات حسب القسم",
      "registrationsByType": "التسجيلات حسب النوع",
      "registrationsByStatus": "التسجيلات حسب الحالة",
      "registrationTrends": "اتجاهات التسجيل",
      "monthlyOverview": "نظرة شهرية",
      "weeklyOverview": "نظرة أسبوعية",
      "averagePerDay": "المعدل اليومي",
      "peakDay": "يوم الذروة",
      "conversionRate": "معدل التحويل",

      // Additional
      "all": "الكل",
      "today": "اليوم",
      "thisWeek": "هذا الأسبوع",
      "thisMonth": "هذا الشهر",
      "exportCSV": "تصدير CSV",
      "downloadPDF": "تحميل PDF",
      "printRegistration": "طباعة التسجيل",
      "registrationDetails": "تفاصيل التسجيل",
      "applicantInfo": "معلومات المتقدم",
      "serviceDetails": "تفاصيل الخدمة",
      "appointmentDetails": "تفاصيل الموعد",
      "createdAt": "تاريخ الإنشاء",
      "updatedAt": "تاريخ التحديث",
      "viewAll": "عرض الكل",
      "quickActions": "إجراءات سريعة",
      "recentActivity": "النشاط الأخير"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'ar', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
