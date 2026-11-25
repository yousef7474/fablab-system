// The workspace terms shown on /workspace before a request can be sent.
// RULES: «شروط وأحكام استخدام مساحة العمل» (the printed workspace banner in
// the admin / manager boards — keep them in step). POLICY: «سياسة استخدام
// مساحة العمل والدعم الفني» (moved here from the registration form).

export const RULES = [
  { ar: 'يجب الحفاظ على نظافة وترتيب مساحة العمل في جميع الأوقات', en: 'Keep the workspace clean and organized at all times' },
  { ar: 'يجب وضع كيس بلاستيكي على الطاولة قبل البدء بالعمل', en: 'Place a plastic cover on the table before starting work' },
  { ar: 'يمنع إتلاف أو إلحاق الضرر بالأدوات والمعدات', en: 'Do not damage or misuse tools and equipment' },
  { ar: 'يجب إعادة جميع الأدوات إلى أماكنها بعد الاستخدام وعدم فقدانها', en: 'Return all tools to their places after use — do not lose them' },
  { ar: 'الالتزام بالفترة الزمنية المحددة للحجز فقط', en: 'You may only use the workspace during your reserved period' },
  { ar: 'في حال الحاجة لوقت إضافي، يجب عمل حجز جديد', en: 'If you need more time, you must make a new reservation' },
  { ar: 'يجب ارتداء معدات السلامة عند استخدام الآلات', en: 'Wear safety gear when operating machinery' },
  { ar: 'يمنع إدخال الطعام والمشروبات إلى منطقة العمل', en: 'No food or drinks allowed in the work area' }
];

export const POLICY = [
  {
    ar: ['خدمة تمكينية', 'نوفّر لك بيئة عمل آمنة والأدوات والأجهزة والإرشاد الفني لتنفّذ مشروعك بنفسك؛ مساحة العمل ليست خدمة لتنفيذ المشروع نيابةً عنك.'],
    en: ['An enabling service', 'We provide a safe space, tools, equipment and technical guidance so you can build your project yourself — the workspace is not a service that builds it for you.']
  },
  {
    ar: ['مسؤولياتك', 'تخطيط المشروع وتنفيذه واستكمال مراحله، وتوفير مكوناته وموادّه، وحفظ ملفاتك وأكوادك وتصاميمك.'],
    en: ['Your responsibilities', 'Planning, building and finishing your project, providing its components and materials, and keeping your own files, code and designs.']
  },
  {
    ar: ['دور المهندس', 'يوجّهك لاستخدام الأدوات والأجهزة بأمان، ويقدّم الإرشاد ويساعد في تشخيص المشكلات، ولا يلتزم بتنفيذ المشروع أو كتابة كل أكواده أو تركيب كل مكوناته.'],
    en: ['The engineer\'s role', 'Guides you to use tools and machines safely, advises and helps diagnose problems — but is not committed to building the project, writing all its code or assembling all its parts.']
  },
  {
    ar: ['المساعدة الإضافية', 'أي مساعدة عملية إضافية (برمجة، توصيل، اختبار) تكون حسب الوقت والإمكانات المتاحة، ولا تنقل مسؤولية المشروع إلى المهندس.'],
    en: ['Extra help', 'Any extra hands-on help (coding, wiring, testing) depends on the time and resources available and does not move responsibility for the project to the engineer.']
  },
  {
    ar: ['حسب التخصص', 'يُوجَّه كل جزء من المشروع إلى القسم المختص به (الإلكترونيات، التصميم، الطباعة ثلاثية الأبعاد…) وفق المواعيد المتاحة.'],
    en: ['By specialty', 'Each part of the project goes to the section that handles it (electronics, design, 3D printing…) according to available appointments.']
  },
  {
    ar: ['الحجز والمواعيد', 'التزم بموعد الحجز ومدته وبالقسم المحدد فيه؛ لا يُسمح بإشغال مساحة العمل دون حجز أو موافقة، ولا يلتزم المهندس باستقبالك دون موعد.'],
    en: ['Bookings', 'Keep to your booked time, duration and section. The workspace can\'t be used without a booking or approval, and walk-ins are not guaranteed to be received.']
  },
  {
    ar: ['التواصل الرسمي', 'الاستشارات عبر القنوات والمواعيد المعتمدة فقط؛ أرقام المهندسين الشخصية ليست وسيلة دعم رسمية، ولا يُطلب منهم الرد خارج أوقات العمل.'],
    en: ['Official channels', 'Consultations go through official channels and appointments only. Engineers\' personal numbers are not a support channel and they are not expected to reply after hours.']
  },
  {
    ar: ['اكتمال الخدمة', 'تُعد الخدمة مقدَّمة بإتاحة البيئة والأدوات والتوجيه خلال موعدك، ولا يُشترط لذلك اكتمال مشروعك.'],
    en: ['Service delivered', 'The service counts as delivered once the space, tools and guidance were provided during your appointment — your project does not have to be finished.']
  },
  {
    ar: ['التكاليف', 'سداد قيمة القطع والمواد يغطّي القطع والمواد فقط، ولا يشمل تنفيذ المشروع أو تركيبه أو برمجته.'],
    en: ['Costs', 'Paying for parts and materials covers the parts and materials only — not building, assembling or programming the project.']
  },
  {
    ar: ['السلوك المهني', 'الاحترام المتبادل أساس العمل؛ يُمنع الإساءة أو التهكم أو الضغط على الموظفين، وتُقدَّم الملاحظات والشكاوى عبر القنوات الرسمية.'],
    en: ['Professional conduct', 'Mutual respect comes first: no insults, mockery or pressure on staff. Feedback and complaints go through the official channels.']
  }
];
