import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './FabyBot.css';

const WELCOME_SHOWN_KEY = 'faby_welcome_shown';

const FabyBot = ({ currentStep, formData }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const messagesEndRef = useRef(null);

  // FABY's personality and character
  const fabyCharacter = {
    name: isRTL ? 'فابي' : 'FABY',
    greeting: isRTL
      ? 'مرحباً! أنا فابي، مساعدك الآلي في فاب لاب الأحساء! 🤖✨ كيف يمكنني مساعدتك اليوم؟'
      : "Hi there! I'm FABY, your robot assistant at FABLAB Al-Ahsa! 🤖✨ How can I help you today?",
    avatar: '🤖'
  };

  // FAQ Data - Bilingual
  const faqData = {
    services: {
      keywords: ['services', 'خدمات', 'service', 'خدمة', 'what do you offer', 'ماذا تقدمون'],
      response: {
        ar: `نقدم في فاب لاب الأحساء خدمات متنوعة تشمل:

🔧 **الإلكترونيات والبرمجة** - تصميم الدوائر، أردوينو، راسبيري باي
🔴 **القطع بالليزر** - قص ونقش بالليزر
🪵 **CNC الخشب** - قص ونحت الخشب
🎨 **الطباعة ثلاثية الأبعاد** - نمذجة وطباعة 3D
🤖 **الروبوتات والذكاء الاصطناعي** - تصميم وبرمجة الروبوتات
👶 **نادي الأطفال** - ورش تعليمية للصغار
✂️ **قطع الفينيل** - ملصقات وطباعة حرارية

هل تريد معرفة المزيد عن خدمة معينة؟`,
        en: `At FABLAB Al-Ahsa, we offer various services including:

🔧 **Electronics & Programming** - PCB design, Arduino, Raspberry Pi
🔴 **Laser Cutting** - Cutting and engraving
🪵 **CNC Wood** - Wood cutting and carving
🎨 **3D Printing** - Modeling and printing
🤖 **Robotics & AI** - Robot design and programming
👶 **Kid's Club** - Educational workshops for children
✂️ **Vinyl Cutting** - Stickers and heat transfer

Would you like to know more about a specific service?`
      }
    },
    hours: {
      keywords: ['hours', 'ساعات', 'time', 'وقت', 'working', 'عمل', 'open', 'مفتوح', 'متى'],
      response: {
        ar: `⏰ **أوقات العمل:**

📅 الأحد - الخميس
🕗 من 8:00 صباحاً حتى 3:00 مساءً

❌ مغلق يومي الجمعة والسبت

💡 نصيحة: احجز موعدك مسبقاً لضمان توفر الخدمة!`,
        en: `⏰ **Working Hours:**

📅 Sunday - Thursday
🕗 8:00 AM to 3:00 PM

❌ Closed on Friday and Saturday

💡 Tip: Book your appointment in advance to ensure service availability!`
      }
    },
    registration: {
      keywords: ['register', 'تسجيل', 'how to', 'كيف', 'sign up', 'account', 'حساب', 'new'],
      response: {
        ar: `📝 **خطوات التسجيل:**

1️⃣ **البحث عن حساب** - أدخل رقم الهوية أو الهاتف للتحقق
2️⃣ **نوع الطلب** - اختر: مستفيد، زائر، متطوع، موهوب، كيان، أو زيارة
3️⃣ **البيانات الشخصية** - أدخل معلوماتك الأساسية
4️⃣ **القسم** - اختر القسم المناسب لاحتياجاتك
5️⃣ **الخدمة** - حدد الخدمات المطلوبة
6️⃣ **الموعد** - اختر التاريخ والوقت المناسب
7️⃣ **التفاصيل** - أضف أي تفاصيل إضافية
8️⃣ **التعهد** - وافق على الشروط وأرسل الطلب

✅ ستتلقى تأكيداً على بريدك الإلكتروني!`,
        en: `📝 **Registration Steps:**

1️⃣ **Account Lookup** - Enter your ID or phone to check
2️⃣ **Application Type** - Choose: Beneficiary, Visitor, Volunteer, Talented, Entity, or Visit
3️⃣ **Personal Info** - Enter your basic information
4️⃣ **Section** - Select the section that fits your needs
5️⃣ **Service** - Choose required services
6️⃣ **Appointment** - Pick date and time
7️⃣ **Details** - Add any additional details
8️⃣ **Commitment** - Agree to terms and submit

✅ You'll receive a confirmation email!`
      }
    },
    appointment: {
      keywords: ['appointment', 'موعد', 'book', 'حجز', 'date', 'تاريخ', 'schedule'],
      response: {
        ar: `📅 **حجز المواعيد:**

🟢 الأيام الخضراء في التقويم متاحة للحجز
🔴 أيام الجمعة والسبت غير متاحة
⏰ المواعيد المتاحة من 8:00 ص - 3:00 م

**المدد المتاحة:**
• 30 دقيقة
• ساعة واحدة
• ساعتان

💡 اختر التاريخ أولاً، ثم ستظهر الأوقات المتاحة!`,
        en: `📅 **Booking Appointments:**

🟢 Green days on the calendar are available
🔴 Friday and Saturday are unavailable
⏰ Available times: 8:00 AM - 3:00 PM

**Available Durations:**
• 30 minutes
• 1 hour
• 2 hours

💡 Select a date first, then available times will appear!`
      }
    },
    sections: {
      keywords: ['section', 'قسم', 'department', 'أقسام', 'which section'],
      response: {
        ar: `🏭 **أقسام فاب لاب:**

🔌 **الإلكترونيات والبرمجة**
لمشاريع الدوائر الإلكترونية والبرمجة

🔴 **الليزر CNC**
للقص والنقش بالليزر على مواد مختلفة

🪵 **الخشب CNC**
لأعمال النجارة الدقيقة والنحت

🎨 **الطباعة ثلاثية الأبعاد**
لطباعة النماذج والقطع البلاستيكية

🤖 **الروبوتات والذكاء الاصطناعي**
لمشاريع الروبوتات والأتمتة

👶 **نادي الأطفال**
ورش تعليمية ممتعة للأطفال

✂️ **قطع الفينيل**
للملصقات والطباعة الحرارية`,
        en: `🏭 **FABLAB Sections:**

🔌 **Electronics & Programming**
For circuit and programming projects

🔴 **CNC Laser**
For cutting and engraving on various materials

🪵 **CNC Wood**
For precise woodworking and carving

🎨 **3D Printing**
For printing models and plastic parts

🤖 **Robotics & AI**
For robotics and automation projects

👶 **Kid's Club**
Fun educational workshops for children

✂️ **Vinyl Cutting**
For stickers and heat transfer printing`
      }
    },
    cost: {
      keywords: ['cost', 'تكلفة', 'price', 'سعر', 'free', 'مجاني', 'pay', 'دفع', 'fees', 'رسوم'],
      response: {
        ar: `💰 **معلومات التكلفة:**

تختلف التكاليف حسب:
• نوع الخدمة المطلوبة
• المواد المستخدمة
• مدة الاستخدام

📞 للحصول على تفاصيل الأسعار، يرجى:
• التواصل مع الإدارة
• أو تحديد موعد استشارة

💡 بعض الورش التعليمية مجانية!`,
        en: `💰 **Cost Information:**

Costs vary based on:
• Type of service requested
• Materials used
• Duration of use

📞 For pricing details, please:
• Contact the administration
• Or schedule a consultation

💡 Some educational workshops are free!`
      }
    },
    contact: {
      keywords: ['contact', 'تواصل', 'phone', 'هاتف', 'email', 'بريد', 'reach', 'اتصال'],
      response: {
        ar: `📞 **معلومات التواصل:**

🏢 فاب لاب الأحساء
🏛️ مؤسسة عبدالمنعم الراشد الإنسانية

📍 الموقع: الأحساء، المملكة العربية السعودية

💡 يمكنك أيضاً إرسال استفساراتك من خلال نموذج التسجيل!`,
        en: `📞 **Contact Information:**

🏢 FABLAB Al-Ahsa
🏛️ Abdulmonem Al-Rashed Foundation

📍 Location: Al-Ahsa, Saudi Arabia

💡 You can also send inquiries through the registration form!`
      }
    },
    requirements: {
      keywords: ['requirements', 'متطلبات', 'need', 'احتاج', 'bring', 'احضر', 'documents', 'وثائق'],
      response: {
        ar: `📋 **المتطلبات:**

**للتسجيل تحتاج:**
• رقم الهوية الوطنية
• رقم الهاتف
• البريد الإلكتروني
• معلوماتك الشخصية الأساسية

**للموعد أحضر:**
• إثبات الهوية
• ملفات المشروع (إن وجدت)
• المواد الخام (حسب الخدمة)

💡 سيتم إرسال تأكيد الموعد على بريدك!`,
        en: `📋 **Requirements:**

**For registration you need:**
• National ID number
• Phone number
• Email address
• Basic personal information

**For your appointment bring:**
• ID proof
• Project files (if any)
• Raw materials (depending on service)

💡 Appointment confirmation will be sent to your email!`
      }
    }
  };

  // Quick action buttons
  const quickActions = [
    { id: 'services', label: isRTL ? '🔧 الخدمات' : '🔧 Services' },
    { id: 'hours', label: isRTL ? '⏰ أوقات العمل' : '⏰ Working Hours' },
    { id: 'registration', label: isRTL ? '📝 كيف أسجل؟' : '📝 How to register?' },
    { id: 'sections', label: isRTL ? '🏭 الأقسام' : '🏭 Sections' }
  ];

  // Initialize with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 1,
        type: 'bot',
        text: fabyCharacter.greeting,
        timestamp: new Date()
      }]);
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show welcome popup on first visit
  useEffect(() => {
    const hasSeenWelcome = sessionStorage.getItem(WELCOME_SHOWN_KEY);
    if (!hasSeenWelcome && !isOpen) {
      const timer = setTimeout(() => {
        setShowWelcome(true);
        sessionStorage.setItem(WELCOME_SHOWN_KEY, 'true');
      }, 2000); // Show after 2 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  // Hide welcome when chat opens
  useEffect(() => {
    if (isOpen) {
      setShowWelcome(false);
    }
  }, [isOpen]);

  // Context-aware help based on current step
  const getContextHelp = () => {
    const stepHelp = {
      '-1': isRTL
        ? 'أنت الآن في صفحة البحث. أدخل رقم الهوية أو الهاتف للتحقق من تسجيلك السابق، أو اختر "تسجيل جديد".'
        : "You're on the lookup page. Enter your ID or phone to check previous registration, or choose 'New Registration'.",
      '0': isRTL
        ? 'اختر نوع الطلب المناسب لك. إذا كنت فرداً، اختر مستفيد أو زائر. للمتطوعين اختر متطوع.'
        : "Choose your application type. If you're an individual, select Beneficiary or Visitor. For volunteering, choose Volunteer.",
      '1': isRTL
        ? 'أدخل بياناتك الشخصية. جميع الحقول المميزة بنجمة (*) إلزامية.'
        : "Enter your personal information. All fields marked with (*) are required.",
      '2': isRTL
        ? 'اختر القسم الذي يناسب مشروعك أو احتياجاتك.'
        : "Select the section that fits your project or needs.",
      '3': isRTL
        ? 'حدد الخدمات المطلوبة. يمكنك اختيار خدمتين كحد أقصى.'
        : "Select required services. You can choose up to 2 services.",
      '4': isRTL
        ? 'اختر التاريخ والوقت المناسب. الأيام الخضراء متاحة للحجز.'
        : "Choose your preferred date and time. Green days are available for booking.",
      '5': isRTL
        ? 'أضف تفاصيل إضافية عن مشروعك أو احتياجاتك.'
        : "Add additional details about your project or needs.",
      '6': isRTL
        ? 'اختر نوع الخدمة المناسب لطلبك.'
        : "Select the service type appropriate for your request.",
      '7': isRTL
        ? 'راجع بياناتك ووافق على الشروط لإتمام التسجيل.'
        : "Review your information and agree to terms to complete registration."
    };
    return stepHelp[currentStep?.toString()] || (isRTL ? 'كيف يمكنني مساعدتك؟' : 'How can I help you?');
  };

  // Find matching FAQ response
  const findResponse = (input) => {
    const lowerInput = input.toLowerCase();

    for (const [key, faq] of Object.entries(faqData)) {
      for (const keyword of faq.keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          return faq.response[isRTL ? 'ar' : 'en'];
        }
      }
    }

    // Default response if no match
    return isRTL
      ? `🤔 عذراً، لم أفهم سؤالك تماماً. يمكنك:\n\n• اختيار أحد الأسئلة السريعة أدناه\n• أو السؤال عن: الخدمات، المواعيد، الأقسام، التسجيل\n\n💡 **نصيحة للخطوة الحالية:**\n${getContextHelp()}`
      : `🤔 Sorry, I didn't quite understand. You can:\n\n• Choose one of the quick questions below\n• Or ask about: services, appointments, sections, registration\n\n💡 **Tip for current step:**\n${getContextHelp()}`;
  };

  // Handle sending message
  const handleSend = (text = inputValue) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: text.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    setShowQuickActions(false);

    // Simulate typing delay
    setTimeout(() => {
      const response = findResponse(text);
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
      setShowQuickActions(true);
    }, 1000 + Math.random() * 500);
  };

  // Handle quick action click
  const handleQuickAction = (actionId) => {
    const faq = faqData[actionId];
    if (faq) {
      handleSend(faq.keywords[0]);
    }
  };

  // Handle context help
  const handleContextHelp = () => {
    const helpMessage = {
      id: Date.now(),
      type: 'bot',
      text: `💡 **${isRTL ? 'مساعدة للخطوة الحالية' : 'Help for current step'}:**\n\n${getContextHelp()}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, helpMessage]);
  };

  return (
    <>
      {/* Floating Bot Button */}
      <motion.button
        className={`faby-float-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring' }}
      >
        <div className="faby-avatar">
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <div className="faby-robot-face">
              <div className="faby-eyes">
                <span className="faby-eye"></span>
                <span className="faby-eye"></span>
              </div>
              <div className="faby-mouth"></div>
            </div>
          )}
        </div>
        {!isOpen && (
          <motion.span
            className="faby-badge"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            ?
          </motion.span>
        )}
      </motion.button>

      {/* Welcome Popup */}
      <AnimatePresence>
        {showWelcome && !isOpen && (
          <motion.div
            className="faby-welcome-popup"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25 }}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <button
              className="faby-welcome-close"
              onClick={() => setShowWelcome(false)}
            >
              ×
            </button>
            <div className="faby-welcome-text">
              {isRTL ? (
                <>
                  مرحباً! أنا <strong>فابي</strong> 🤖<br />
                  مساعدك الآلي. هل تحتاج مساعدة في التسجيل؟
                </>
              ) : (
                <>
                  Hi there! I'm <strong>FABY</strong> 🤖<br />
                  Your robot assistant. Need help registering?
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="faby-chat-window"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25 }}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div className="faby-header">
              <div className="faby-header-info">
                <div className="faby-header-avatar">
                  <div className="faby-robot-face small">
                    <div className="faby-eyes">
                      <span className="faby-eye"></span>
                      <span className="faby-eye"></span>
                    </div>
                    <div className="faby-mouth"></div>
                  </div>
                </div>
                <div className="faby-header-text">
                  <h3>{fabyCharacter.name}</h3>
                  <span className="faby-status">
                    <span className="status-dot"></span>
                    {isRTL ? 'متصل الآن' : 'Online now'}
                  </span>
                </div>
              </div>
              <button className="faby-help-btn" onClick={handleContextHelp} title={isRTL ? 'مساعدة' : 'Help'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="faby-messages">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`faby-message ${msg.type}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {msg.type === 'bot' && (
                    <div className="faby-msg-avatar">
                      <div className="faby-robot-face tiny">
                        <div className="faby-eyes">
                          <span className="faby-eye"></span>
                          <span className="faby-eye"></span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="faby-msg-content">
                    <div className="faby-msg-text" dangerouslySetInnerHTML={{
                      __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
                    }} />
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  className="faby-message bot"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="faby-msg-avatar">
                    <div className="faby-robot-face tiny">
                      <div className="faby-eyes">
                        <span className="faby-eye"></span>
                        <span className="faby-eye"></span>
                      </div>
                    </div>
                  </div>
                  <div className="faby-typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            {showQuickActions && (
              <div className="faby-quick-actions">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    className="faby-quick-btn"
                    onClick={() => handleQuickAction(action.id)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="faby-input-area">
              <input
                type="text"
                className="faby-input"
                placeholder={isRTL ? 'اكتب سؤالك هنا...' : 'Type your question...'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              />
              <button
                className="faby-send-btn"
                onClick={() => handleSend()}
                disabled={!inputValue.trim()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>

            {/* Footer */}
            <div className="faby-footer">
              <span>{isRTL ? 'فابي - مساعد فاب لاب الأحساء' : 'FABY - FABLAB Al-Ahsa Assistant'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FabyBot;
