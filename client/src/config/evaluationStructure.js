// Evaluation categories and criteria structure
// Categories 1-7: scored (total max = 100 points)
// Categories 8-9: qualitative (checkboxes, no points)

export const EVALUATION_CATEGORIES = [
  {
    key: 'cat1',
    nameAr: 'الكفاءة المهنية',
    nameEn: 'Professional Competency',
    scored: true,
    criteria: [
      { key: 'c1', nameAr: 'القدرة على تطوير أساليب العمل', nameEn: 'Ability to develop work methods', max: 4 },
      { key: 'c2', nameAr: 'المعرفة بالأسس والمفاهيم الفنية المتعلقة بمهمته', nameEn: 'Knowledge of technical foundations related to duties', max: 3 },
      { key: 'c3', nameAr: 'التطوير المهني المستمر من خلال المتابعة للمستجدات في مجال العمل', nameEn: 'Continuous professional development through following field updates', max: 5 },
      { key: 'c4', nameAr: 'المعرفة بنظم العمل وإجراءاته وآلياته في المؤسسة', nameEn: 'Knowledge of work systems, procedures and mechanisms', max: 3 },
    ]
  },
  {
    key: 'cat2',
    nameAr: 'الإنتاجية وجودة العمل',
    nameEn: 'Productivity & Work Quality',
    scored: true,
    criteria: [
      { key: 'c1', nameAr: 'القدرة على إنجاز الأعمال بكفاءة عالية', nameEn: 'Ability to accomplish tasks with high efficiency', max: 8 },
      { key: 'c2', nameAr: 'القدرة على تحديد خطوات العمل والبرنامج الزمني', nameEn: 'Ability to define work steps and timeline', max: 5 },
      { key: 'c3', nameAr: 'المهارة في التنفيذ', nameEn: 'Skill in execution', max: 5 },
      { key: 'c4', nameAr: 'إنجاز العمل في الوقت المحدد', nameEn: 'Completing work on time', max: 5 },
    ]
  },
  {
    key: 'cat3',
    nameAr: 'العمل الجماعي والمشاركة',
    nameEn: 'Teamwork & Participation',
    scored: true,
    criteria: [
      { key: 'c1', nameAr: 'المرونة والاستجابة السريعة لمتطلبات العمل', nameEn: 'Flexibility and quick response to work requirements', max: 5 },
      { key: 'c2', nameAr: 'المشاركة الفاعلة في الاجتماعات', nameEn: 'Active participation in meetings', max: 3 },
      { key: 'c3', nameAr: 'التعامل بروح الفريق والعمل بما يخدم الصالح العام للمؤسسة', nameEn: 'Team spirit and serving the organization\'s interests', max: 3 },
      { key: 'c4', nameAr: 'المشاركة الإيجابية في المبادرات والأنشطة التي تدعم أهداف المؤسسة', nameEn: 'Positive participation in initiatives supporting org goals', max: 3 },
    ]
  },
  {
    key: 'cat4',
    nameAr: 'الالتزام والانضباط',
    nameEn: 'Commitment & Discipline',
    scored: true,
    criteria: [
      { key: 'c1', nameAr: 'المحافظة على أوقات العمل', nameEn: 'Maintaining work schedule', max: 8 },
      { key: 'c2', nameAr: 'انضباطية عالية في الالتزام بالتعليمات وتقبل التوجيهات، مع استعداد دائم لتنفيذها بدقة', nameEn: 'High discipline in following instructions with readiness to execute accurately', max: 8 },
    ]
  },
  {
    key: 'cat5',
    nameAr: 'الولاء المؤسسي',
    nameEn: 'Institutional Loyalty',
    scored: true,
    criteria: [
      { key: 'c1', nameAr: 'الالتزام برسالة المؤسسة وقيمها في جميع التعاملات الداخلية والخارجية والمحافظة على سمعتها', nameEn: 'Commitment to organization\'s mission and values in all dealings and protecting its reputation', max: 4 },
    ]
  },
  {
    key: 'cat6',
    nameAr: 'الصفات الشخصية',
    nameEn: 'Personal Traits',
    scored: true,
    criteria: [
      { key: 'c1', nameAr: 'القدرة على الحوار وعرض الرأي', nameEn: 'Ability to discuss and present opinions', max: 4 },
      { key: 'c2', nameAr: 'تقدير المسؤولية', nameEn: 'Sense of responsibility', max: 4 },
      { key: 'c3', nameAr: 'الاهتمام بالمظهر', nameEn: 'Attention to appearance', max: 4 },
      { key: 'c4', nameAr: 'حسن التصرف', nameEn: 'Good conduct', max: 4 },
    ]
  },
  {
    key: 'cat7',
    nameAr: 'العلاقات',
    nameEn: 'Relationships',
    scored: true,
    criteria: [
      { key: 'c1', nameAr: 'العلاقة مع الرؤساء', nameEn: 'Relationship with superiors', max: 3 },
      { key: 'c2', nameAr: 'العلاقة مع الزملاء', nameEn: 'Relationship with colleagues', max: 3 },
      { key: 'c3', nameAr: 'العلاقة مع المرؤوسين', nameEn: 'Relationship with subordinates', max: 3 },
      { key: 'c4', nameAr: 'العلاقة مع المستفيدين', nameEn: 'Relationship with beneficiaries', max: 3 },
    ]
  },
  {
    key: 'cat8',
    nameAr: 'التصنيع',
    nameEn: 'Manufacturing',
    scored: false,
    criteria: [
      { key: 'c1', nameAr: 'القدرة على إنتاج وتصنيع منتجات', nameEn: 'Ability to produce and manufacture products' },
      { key: 'c2', nameAr: 'القدرة على تحويل المنتجات إلى حقائب تدريبية', nameEn: 'Ability to convert products into training kits' },
      { key: 'c3', nameAr: 'القدرة على تشغيل الأجهزة والآلات في عملية التصنيع والإنتاج', nameEn: 'Ability to operate devices and machines in manufacturing' },
      { key: 'c4', nameAr: 'القدرة على تجهيز حقيبة أو منتج في أي وقت خلال الطلب', nameEn: 'Ability to prepare a kit or product on demand at any time' },
    ]
  },
  {
    key: 'cat9',
    nameAr: 'متابعة الأعمال',
    nameEn: 'Work Follow-up',
    scored: false,
    criteria: [
      { key: 'c1', nameAr: 'متابعة المنصة والجدول اليومي', nameEn: 'Following up on the platform and daily schedule' },
      { key: 'c2', nameAr: 'تعبئة الجدول بالمهام المطلوبة وتوثيقها', nameEn: 'Filling the schedule with required tasks and documenting them' },
      { key: 'c3', nameAr: 'إتمام المهام اليومية في الجدول في الوقت المحدد', nameEn: 'Completing daily scheduled tasks on time' },
      { key: 'c4', nameAr: 'متابعة طلبات التسجيل على المنصة للمستفيدين', nameEn: 'Following up on registration requests on the platform' },
    ]
  },
];

export const TOTAL_MAX = 100;
