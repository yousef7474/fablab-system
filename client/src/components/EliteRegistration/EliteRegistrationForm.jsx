import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './EliteRegistration.css';

const EliteRegistrationForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [language, setLanguage] = useState('ar');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const isRTL = language === 'ar';

  // Translations
  const t = {
    ar: {
      elite: 'النخبة',
      newAccount: 'تسجيل حساب جديد',
      step1: 'المعلومات الأساسية',
      step2: 'البيانات الشخصية',
      step3: 'كلمة المرور',
      step4: 'الشروط والأحكام',
      firstName: 'الاسم الأول',
      lastName: 'الاسم الأخير',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      nationalId: 'رقم الهوية',
      nationality: 'الجنسية',
      gender: 'الجنس',
      male: 'ذكر',
      female: 'أنثى',
      select: 'اختر',
      dateOfBirth: 'تاريخ الميلاد',
      city: 'المدينة',
      organization: 'جهة العمل / الدراسة',
      specialization: 'التخصص',
      bio: 'نبذة تعريفية',
      password: 'كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      createPassword: 'إنشاء كلمة المرور',
      passwordInfo: 'أنشئ كلمة مرور قوية لحماية حسابك',
      passwordRequirements: 'متطلبات كلمة المرور:',
      minChars: '6 أحرف على الأقل',
      passwordMatch: 'تطابق كلمتي المرور',
      next: 'التالي',
      previous: 'السابق',
      createAccount: 'إنشاء الحساب',
      backHome: 'العودة للرئيسية',
      goToLogin: 'تسجيل الدخول',
      alreadyHaveAccount: 'لديك حساب بالفعل؟',
      loginHere: 'سجل دخولك هنا',
      uploadPhoto: 'اضغط لرفع صورة شخصية',
      welcomeElite: 'مرحباً بك في النخبة!',
      accountCreated: 'تم إنشاء حسابك بنجاح',
      memberId: 'رقم العضوية:',
      name: 'الاسم:',
      enterFirstName: 'أدخل الاسم الأول',
      enterLastName: 'أدخل الاسم الأخير',
      enterNationalId: 'رقم الهوية الوطنية',
      enterCity: 'المدينة',
      enterOrg: 'اسم الجهة',
      enterSpec: 'تخصصك أو مجال اهتمامك',
      enterBio: 'اكتب نبذة قصيرة عنك...',
      enterPassword: 'أدخل كلمة المرور',
      reenterPassword: 'أعد إدخال كلمة المرور',
      fillRequired: 'يرجى ملء جميع الحقول المطلوبة',
      invalidEmail: 'البريد الإلكتروني غير صالح',
      enterPasswordError: 'يرجى إدخال كلمة المرور',
      minPassword: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
      passwordMismatch: 'كلمتا المرور غير متطابقتين',
      imageTooLarge: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت',
      successMessage: 'تم إنشاء حسابك بنجاح!',
      termsTitle: 'الشروط والأحكام',
      termsSubtitle: 'يرجى قراءة الشروط والأحكام بعناية قبل الموافقة',
      readTerms: 'قراءة الشروط والأحكام كاملة',
      acceptTerms: 'أوافق على جميع الشروط والأحكام',
      mustAcceptTerms: 'يجب الموافقة على الشروط والأحكام للمتابعة',
      termsModalTitle: 'الشروط والأحكام - برنامج النخبة',
      close: 'إغلاق'
    },
    en: {
      elite: 'Elite',
      newAccount: 'Create New Account',
      step1: 'Basic Information',
      step2: 'Personal Data',
      step3: 'Password',
      step4: 'Terms & Conditions',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone Number',
      nationalId: 'National ID',
      nationality: 'Nationality',
      gender: 'Gender',
      male: 'Male',
      female: 'Female',
      select: 'Select',
      dateOfBirth: 'Date of Birth',
      city: 'City',
      organization: 'Organization',
      specialization: 'Specialization',
      bio: 'Bio',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      createPassword: 'Create Password',
      passwordInfo: 'Create a strong password to protect your account',
      passwordRequirements: 'Password requirements:',
      minChars: 'At least 6 characters',
      passwordMatch: 'Passwords match',
      next: 'Next',
      previous: 'Previous',
      createAccount: 'Create Account',
      backHome: 'Back to Home',
      goToLogin: 'Login',
      alreadyHaveAccount: 'Already have an account?',
      loginHere: 'Login here',
      uploadPhoto: 'Click to upload photo',
      welcomeElite: 'Welcome to Elite!',
      accountCreated: 'Your account has been created successfully',
      memberId: 'Member ID:',
      name: 'Name:',
      enterFirstName: 'Enter first name',
      enterLastName: 'Enter last name',
      enterNationalId: 'National ID number',
      enterCity: 'City',
      enterOrg: 'Organization name',
      enterSpec: 'Your specialization or field of interest',
      enterBio: 'Write a short bio about yourself...',
      enterPassword: 'Enter password',
      reenterPassword: 'Re-enter password',
      fillRequired: 'Please fill all required fields',
      invalidEmail: 'Invalid email address',
      enterPasswordError: 'Please enter password',
      minPassword: 'Password must be at least 6 characters',
      passwordMismatch: 'Passwords do not match',
      imageTooLarge: 'Image size must be less than 5MB',
      successMessage: 'Your account has been created successfully!',
      termsTitle: 'Terms & Conditions',
      termsSubtitle: 'Please read the terms and conditions carefully before agreeing',
      readTerms: 'Read Full Terms & Conditions',
      acceptTerms: 'I agree to all Terms and Conditions',
      mustAcceptTerms: 'You must accept the terms and conditions to continue',
      termsModalTitle: 'Terms & Conditions - Elite Program',
      close: 'Close'
    }
  };

  // Terms and Conditions Content
  const termsContent = {
    ar: {
      intro: 'مرحباً بك في برنامج النخبة المقدم من مؤسسة عبدالمنعم الراشد الإنسانية وفاب لاب الأحساء',
      sections: [
        {
          title: '1. نظرة عامة على البرنامج',
          content: `برنامج النخبة هو برنامج دعم متكامل يهدف إلى رعاية المواهب والطلاب المتميزين من خلال توفير الدعم المالي والتقني والتعليمي. يتم تقديم هذا البرنامج بالشراكة بين مؤسسة عبدالمنعم الراشد الإنسانية وفاب لاب الأحساء.`
        },
        {
          title: '2. أنواع الدعم المقدم',
          content: `يشمل الدعم المقدم لأعضاء النخبة:
• الدعم المالي: منح مالية لتغطية تكاليف المشاريع والمواد
• دعم المعدات: استخدام جميع معدات وأجهزة فاب لاب بجميع أقسامه
• الدعم التعليمي: دورات تدريبية وورش عمل متخصصة
• المسابقات: دعم المشاركة في المسابقات المحلية والدولية
• الإرشاد: جلسات إرشادية مع مهندسين ومتخصصين في جميع الأقسام
• جدول خاص: جدول زمني مخصص لكل عضو نخبة للاستفادة من خدمات المختبر`
        },
        {
          title: '3. أقسام فاب لاب المتاحة',
          content: `يحق لأعضاء النخبة الوصول إلى جميع أقسام فاب لاب:
• قسم الإلكترونيات والبرمجة
• قسم CNC الليزر
• قسم CNC الخشب
• قسم الطباعة ثلاثية الأبعاد (3D)
• قسم الروبوتات والذكاء الاصطناعي
• نادي الأطفال
• قسم قص الفينيل`
        },
        {
          title: '4. نظام التصنيف والفئات',
          content: `يتم تصنيف أعضاء النخبة إلى أربع فئات بناءً على الأداء:

الفئة A (90% - 100%): دعم كامل في جميع المجالات
الفئة B (80% - 89%): دعم عالي مع بعض القيود
الفئة C (70% - 79%): دعم متوسط
الفئة D (60% - 69%): دعم أساسي

يتم تحديد نسبة الدعم بناءً على فئة العضو.`
        },
        {
          title: '5. معايير التقييم',
          content: `يتم تقييم أعضاء النخبة بناءً على المعايير التالية:
• الحضور والالتزام: الالتزام بالمواعيد وجدول التدريب (20%)
• جودة المشاريع: مستوى الإبداع والإتقان في المشاريع المنفذة (25%)
• التطور والتعلم: مدى التحسن واكتساب مهارات جديدة (20%)
• المشاركة الفعالة: المشاركة في الفعاليات والمسابقات (15%)
• العمل الجماعي: التعاون والعمل مع الآخرين (10%)
• السلوك والأخلاق: الالتزام بقواعد السلوك والآداب (10%)`
        },
        {
          title: '6. مدة العضوية والتجديد',
          content: `• مدة العضوية في برنامج النخبة سنة واحدة من تاريخ القبول
• يتم تجديد العضوية سنوياً بناءً على تقييم الأداء
• يجب الحفاظ على نسبة 60% كحد أدنى للبقاء في البرنامج
• يتم إجراء تقييم شامل في نهاية كل فصل دراسي`
        },
        {
          title: '7. شروط الاستبعاد',
          content: `يحق للمؤسسة استبعاد العضو من برنامج النخبة في الحالات التالية:
• انخفاض نسبة التقييم عن 60%
• مخالفة الشروط والأحكام
• سوء السلوك أو الإخلال بآداب التعامل
• الغياب المتكرر بدون عذر مقبول
• إساءة استخدام المعدات أو المرافق`
        },
        {
          title: '8. في حالة الاستبعاد',
          content: `عند استبعاد العضو من برنامج النخبة:
• يتم إصدار تقرير مفصل يوضح أداء العضو مع البيانات والنسب
• يمكن للعضو الاستمرار في الاستفادة من خدمات فاب لاب كمستخدم عادي
• يمكن للعضو التقدم مرة أخرى لبرنامج النخبة بعد تحسين أدائه
• يجب إثبات تحسن ملموس للقبول مرة أخرى في البرنامج`
        },
        {
          title: '9. حقوق المؤسسة',
          content: `تحتفظ مؤسسة عبدالمنعم الراشد الإنسانية وفاب لاب الأحساء بالحقوق التالية:
• تعديل الشروط والأحكام في أي وقت مع إشعار الأعضاء
• تغيير نظام التصنيف أو معايير التقييم
• إيقاف أو تعديل برنامج الدعم
• استخدام مشاريع الأعضاء للأغراض الترويجية (مع ذكر المصدر)`
        },
        {
          title: '10. التزامات العضو',
          content: `يلتزم عضو النخبة بما يلي:
• احترام جميع الشروط والأحكام
• الالتزام بالجدول الزمني المحدد
• المحافظة على المعدات والمرافق
• التعامل باحترام مع جميع المنتسبين والموظفين
• عدم إفشاء أي معلومات سرية
• المشاركة في الفعاليات والمسابقات عند الطلب`
        }
      ],
      footer: 'بالموافقة على هذه الشروط والأحكام، أقر بأنني قرأت وفهمت جميع البنود وأوافق على الالتزام بها.'
    },
    en: {
      intro: 'Welcome to the Elite Program provided by Abdulmonem Alrashed Humanitarian Foundation and FABLAB Al-Ahsa',
      sections: [
        {
          title: '1. Program Overview',
          content: `The Elite Program is a comprehensive support initiative aimed at nurturing talented students through financial, technical, and educational support. This program is offered in partnership between Abdulmonem Alrashed Humanitarian Foundation and FABLAB Al-Ahsa.`
        },
        {
          title: '2. Types of Support Provided',
          content: `Support provided to Elite members includes:
• Financial Support: Grants to cover project and material costs
• Equipment Support: Access to all FABLAB equipment across all sections
• Educational Support: Specialized training courses and workshops
• Competitions: Support for participation in local and international competitions
• Mentorship: Advisory sessions with engineers and specialists across all sections
• Personal Schedule: Dedicated time slots for each Elite member to utilize lab services`
        },
        {
          title: '3. Available FABLAB Sections',
          content: `Elite members have access to all FABLAB sections:
• Electronics and Programming
• CNC Laser
• CNC Wood
• 3D Printing
• Robotics and AI
• Kids Club
• Vinyl Cutting`
        },
        {
          title: '4. Classification System and Categories',
          content: `Elite members are classified into four categories based on performance:

Category A (90% - 100%): Full support in all areas
Category B (80% - 89%): High support with some limitations
Category C (70% - 79%): Medium support
Category D (60% - 69%): Basic support

Support percentage is determined based on the member's category.`
        },
        {
          title: '5. Evaluation Criteria',
          content: `Elite members are evaluated based on the following criteria:
• Attendance & Commitment: Adherence to schedules and training sessions (20%)
• Project Quality: Level of creativity and excellence in executed projects (25%)
• Growth & Learning: Progress and acquisition of new skills (20%)
• Active Participation: Involvement in events and competitions (15%)
• Teamwork: Collaboration and working with others (10%)
• Behavior & Ethics: Adherence to conduct rules and etiquette (10%)`
        },
        {
          title: '6. Membership Duration and Renewal',
          content: `• Elite Program membership is valid for one year from acceptance date
• Membership is renewed annually based on performance evaluation
• A minimum of 60% must be maintained to remain in the program
• Comprehensive evaluation is conducted at the end of each semester`
        },
        {
          title: '7. Exclusion Conditions',
          content: `The Foundation reserves the right to exclude members from the Elite Program in the following cases:
• Evaluation score dropping below 60%
• Violation of terms and conditions
• Misconduct or breach of behavioral standards
• Repeated absence without acceptable excuse
• Misuse of equipment or facilities`
        },
        {
          title: '8. In Case of Exclusion',
          content: `When a member is excluded from the Elite Program:
• A detailed report is issued showing the member's performance with data and percentages
• The member may continue to use FABLAB services as a regular user
• The member may reapply to the Elite Program after improving their performance
• Demonstrable improvement must be shown for re-acceptance into the program`
        },
        {
          title: '9. Foundation Rights',
          content: `Abdulmonem Alrashed Humanitarian Foundation and FABLAB Al-Ahsa reserve the following rights:
• Modify terms and conditions at any time with member notification
• Change the classification system or evaluation criteria
• Suspend or modify the support program
• Use member projects for promotional purposes (with attribution)`
        },
        {
          title: '10. Member Obligations',
          content: `Elite members are obligated to:
• Respect all terms and conditions
• Adhere to the designated schedule
• Maintain equipment and facilities
• Treat all staff and members with respect
• Not disclose any confidential information
• Participate in events and competitions when requested`
        }
      ],
      footer: 'By agreeing to these terms and conditions, I acknowledge that I have read and understood all clauses and agree to abide by them.'
    }
  };

  const text = t[language];

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    nationalId: '',
    nationality: 'Saudi',
    sex: '',
    dateOfBirth: '',
    city: '',
    organization: '',
    specialization: '',
    bio: '',
    password: '',
    confirmPassword: '',
    profilePicture: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(text.imageTooLarge);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, profilePicture: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const validateStep1 = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phoneNumber) {
      toast.error(text.fillRequired);
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error(text.invalidEmail);
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.nationalId || !formData.sex || !formData.city) {
      toast.error(text.fillRequired);
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.password || !formData.confirmPassword) {
      toast.error(text.enterPasswordError);
      return false;
    }
    if (formData.password.length < 6) {
      toast.error(text.minPassword);
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error(text.passwordMismatch);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      setStep(4);
    }
  };

  const validateStep4 = () => {
    if (!termsAccepted) {
      toast.error(text.mustAcceptTerms);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep4()) return;

    setLoading(true);
    try {
      const response = await api.post('/elite/register', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        nationalId: formData.nationalId,
        nationality: formData.nationality,
        sex: formData.sex,
        dateOfBirth: formData.dateOfBirth,
        city: formData.city,
        organization: formData.organization,
        specialization: formData.specialization,
        bio: formData.bio,
        password: formData.password,
        profilePicture: formData.profilePicture
      });

      setCreatedUser(response.data.user);
      setShowSuccess(true);
      toast.success(text.successMessage);
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(error.response?.data?.message || (isRTL ? 'حدث خطأ أثناء التسجيل' : 'Registration error'));
    } finally {
      setLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="elite-page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="elite-bg-pattern"></div>
        {/* Animated Background Orbs */}
        <div className="elite-floating-orbs">
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
          <div className="elite-orb"></div>
        </div>
        <div className="elite-container">
          <motion.div
            className="elite-success-card"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="success-icon">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2>{text.welcomeElite}</h2>
            <p>{text.accountCreated}</p>
            {createdUser && (
              <div className="user-info-display">
                <div className="info-item">
                  <span className="info-label">{text.memberId}</span>
                  <span className="info-value">{createdUser.uniqueId}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">{text.name}</span>
                  <span className="info-value">{createdUser.firstName} {createdUser.lastName}</span>
                </div>
              </div>
            )}
            <div className="success-buttons">
              <button
                className="elite-btn primary"
                onClick={() => navigate('/elite/login')}
              >
                {text.goToLogin}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
              </button>
              <button
                className="elite-btn secondary"
                onClick={() => navigate('/')}
              >
                {text.backHome}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="elite-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="elite-bg-pattern"></div>

      {/* Animated Background Orbs */}
      <div className="elite-floating-orbs">
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
        <div className="elite-orb"></div>
      </div>

      {/* Animated Stars */}
      <div className="elite-stars">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="elite-star" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`
          }}></div>
        ))}
      </div>

      {/* Language Switch */}
      <motion.div
        className="elite-language-switch"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button
          className={`lang-btn ${language === 'ar' ? 'active' : ''}`}
          onClick={() => setLanguage('ar')}
        >
          عربي
        </button>
        <button
          className={`lang-btn ${language === 'en' ? 'active' : ''}`}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
      </motion.div>

      <div className="elite-container">
        {/* Header */}
        <motion.div
          className="elite-header"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="elite-logo">
            <motion.svg
              width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </motion.svg>
          </div>
          <h1 className="elite-title">{text.elite}</h1>
          <p className="elite-subtitle">{text.newAccount}</p>
        </motion.div>

        {/* Progress Steps */}
        <div className="elite-progress elite-progress-4">
          <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-number">{step > 1 ? '✓' : '1'}</div>
            <span>{text.step1}</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-number">{step > 2 ? '✓' : '2'}</div>
            <span>{text.step2}</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
            <div className="step-number">{step > 3 ? '✓' : '3'}</div>
            <span>{text.step3}</span>
          </div>
          <div className="progress-line"></div>
          <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>
            <div className="step-number">4</div>
            <span>{text.step4}</span>
          </div>
        </div>

        {/* Form Card */}
        <motion.div
          className="elite-form-card"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                className="form-step"
                initial={{ x: isRTL ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 50 : -50, opacity: 0 }}
              >
                <h3 className="step-title">{text.step1}</h3>

                {/* Profile Picture Upload */}
                <div className="profile-upload-section">
                  <div
                    className="profile-upload-circle"
                    onClick={() => document.getElementById('profilePicInput').click()}
                  >
                    {formData.profilePicture ? (
                      <img src={formData.profilePicture} alt="Profile" />
                    ) : (
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    )}
                    <div className="upload-overlay">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                  </div>
                  <input
                    type="file"
                    id="profilePicInput"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <span className="upload-hint">{text.uploadPhoto}</span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{text.firstName} <span className="required">*</span></label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder={text.enterFirstName}
                    />
                  </div>
                  <div className="form-group">
                    <label>{text.lastName} <span className="required">*</span></label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder={text.enterLastName}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{text.email} <span className="required">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                </div>

                <div className="form-group">
                  <label>{text.phone} <span className="required">*</span></label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    placeholder="05XXXXXXXX"
                    dir="ltr"
                  />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                className="form-step"
                initial={{ x: isRTL ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 50 : -50, opacity: 0 }}
              >
                <h3 className="step-title">{text.step2}</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>{text.nationalId} <span className="required">*</span></label>
                    <input
                      type="text"
                      name="nationalId"
                      value={formData.nationalId}
                      onChange={handleChange}
                      placeholder={text.enterNationalId}
                      dir="ltr"
                    />
                  </div>
                  <div className="form-group">
                    <label>{text.nationality}</label>
                    <input
                      type="text"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      placeholder={text.nationality}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>{text.gender} <span className="required">*</span></label>
                    <select name="sex" value={formData.sex} onChange={handleChange}>
                      <option value="">{text.select}</option>
                      <option value="male">{text.male}</option>
                      <option value="female">{text.female}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{text.dateOfBirth}</label>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{text.city} <span className="required">*</span></label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder={text.enterCity}
                  />
                </div>

                <div className="form-group">
                  <label>{text.organization}</label>
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    placeholder={text.enterOrg}
                  />
                </div>

                <div className="form-group">
                  <label>{text.specialization}</label>
                  <input
                    type="text"
                    name="specialization"
                    value={formData.specialization}
                    onChange={handleChange}
                    placeholder={text.enterSpec}
                  />
                </div>

                <div className="form-group">
                  <label>{text.bio}</label>
                  <textarea
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    placeholder={text.enterBio}
                    rows="3"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                className="form-step"
                initial={{ x: isRTL ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 50 : -50, opacity: 0 }}
              >
                <h3 className="step-title">{text.createPassword}</h3>

                <div className="password-info">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <p>{text.passwordInfo}</p>
                </div>

                <div className="form-group">
                  <label>{text.password} <span className="required">*</span></label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={text.enterPassword}
                  />
                </div>

                <div className="form-group">
                  <label>{text.confirmPassword} <span className="required">*</span></label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder={text.reenterPassword}
                  />
                </div>

                <div className="password-requirements">
                  <p>{text.passwordRequirements}</p>
                  <ul>
                    <li className={formData.password.length >= 6 ? 'met' : ''}>
                      {text.minChars}
                    </li>
                    <li className={formData.password === formData.confirmPassword && formData.password ? 'met' : ''}>
                      {text.passwordMatch}
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                className="form-step"
                initial={{ x: isRTL ? -50 : 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 50 : -50, opacity: 0 }}
              >
                <h3 className="step-title">{text.termsTitle}</h3>

                <div className="terms-info">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  <p>{text.termsSubtitle}</p>
                </div>

                {/* Terms Summary */}
                <div className="terms-summary">
                  <div className="terms-summary-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span>{termsContent[language].intro}</span>
                  </div>

                  <div className="terms-highlights">
                    <div className="terms-highlight-item">
                      <div className="highlight-icon support">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                          <line x1="9" y1="9" x2="9.01" y2="9"/>
                          <line x1="15" y1="9" x2="15.01" y2="9"/>
                        </svg>
                      </div>
                      <span>{isRTL ? 'دعم مالي وتقني وتعليمي' : 'Financial, Technical & Educational Support'}</span>
                    </div>
                    <div className="terms-highlight-item">
                      <div className="highlight-icon categories">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20V10"/>
                          <path d="M18 20V4"/>
                          <path d="M6 20v-4"/>
                        </svg>
                      </div>
                      <span>{isRTL ? '4 فئات: A (90-100%) B (80-89%) C (70-79%) D (60-69%)' : '4 Categories: A (90-100%) B (80-89%) C (70-79%) D (60-69%)'}</span>
                    </div>
                    <div className="terms-highlight-item">
                      <div className="highlight-icon duration">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <span>{isRTL ? 'العضوية سنة واحدة قابلة للتجديد' : 'One Year Membership, Renewable'}</span>
                    </div>
                    <div className="terms-highlight-item">
                      <div className="highlight-icon minimum">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                          <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                      </div>
                      <span>{isRTL ? 'الحد الأدنى للبقاء 60%' : 'Minimum 60% to Stay in Program'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="read-terms-btn"
                    onClick={() => setShowTermsModal(true)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    {text.readTerms}
                  </button>
                </div>

                {/* Accept Checkbox */}
                <div className="terms-accept">
                  <label className="terms-checkbox">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    <span className="checkbox-label">{text.acceptTerms}</span>
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="form-navigation">
            {step > 1 && (
              <button
                className="elite-btn secondary"
                onClick={() => setStep(step - 1)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points={isRTL ? "9 18 15 12 9 6" : "15 18 9 12 15 6"}/>
                </svg>
                {text.previous}
              </button>
            )}

            {step < 4 ? (
              <button
                className="elite-btn primary"
                onClick={handleNext}
              >
                {text.next}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points={isRTL ? "15 18 9 12 15 6" : "9 18 15 12 9 6"}/>
                </svg>
              </button>
            ) : (
              <button
                className="elite-btn primary"
                onClick={handleSubmit}
                disabled={loading || !termsAccepted}
              >
                {loading ? (
                  <span className="loading-spinner"></span>
                ) : (
                  <>
                    {text.createAccount}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Already have account - Login Link */}
        <motion.div
          className="elite-login-prompt"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <span>{text.alreadyHaveAccount}</span>
          <button
            className="elite-login-link-btn"
            onClick={() => navigate('/elite/login')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            {text.loginHere}
          </button>
        </motion.div>

        {/* Back to Home */}
        <motion.button
          className="back-home-btn"
          onClick={() => navigate('/')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          {text.backHome}
        </motion.button>
      </div>

      {/* Terms and Conditions Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <motion.div
            className="terms-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTermsModal(false)}
          >
            <motion.div
              className="terms-modal"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="terms-modal-header">
                <h2>{text.termsModalTitle}</h2>
                <button
                  className="terms-modal-close"
                  onClick={() => setShowTermsModal(false)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="terms-modal-content">
                <p className="terms-intro">{termsContent[language].intro}</p>

                {termsContent[language].sections.map((section, index) => (
                  <div key={index} className="terms-section">
                    <h3>{section.title}</h3>
                    <p>{section.content}</p>
                  </div>
                ))}

                <p className="terms-footer">{termsContent[language].footer}</p>
              </div>

              <div className="terms-modal-footer">
                <button
                  className="elite-btn primary"
                  onClick={() => {
                    setTermsAccepted(true);
                    setShowTermsModal(false);
                  }}
                >
                  {text.acceptTerms}
                </button>
                <button
                  className="elite-btn secondary"
                  onClick={() => setShowTermsModal(false)}
                >
                  {text.close}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EliteRegistrationForm;
