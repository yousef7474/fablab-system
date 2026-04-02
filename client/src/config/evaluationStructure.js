// Evaluation categories and criteria
// Each criterion has a WEIGHT. Manager gives 0-100 per criterion.
// Weighted score = (input/100) * weight
// Total = sum of all weighted scores (max = 100)

export const EVALUATION_CATEGORIES = [
  {
    key: 'cat1',
    nameAr: 'الكفاءة المهنية',
    nameEn: 'Professional Competency',
    criteria: [
      { key: 'c1', nameAr: 'القدرة على تطوير أساليب العمل', nameEn: 'Ability to develop work methods', weight: 2 },
      { key: 'c2', nameAr: 'المعرفة بالأسس والمفاهيم الفنية المتعلقة بمهمته', nameEn: 'Knowledge of technical foundations related to duties', weight: 2 },
      { key: 'c3', nameAr: 'التطوير المهني المستمر من خلال المتابعة للمستجدات في مجال العمل', nameEn: 'Continuous professional development', weight: 2 },
      { key: 'c4', nameAr: 'المعرفة بنظم العمل وإجراءاته وآلياته في المؤسسة', nameEn: 'Knowledge of work systems and procedures', weight: 2 },
    ]
  },
  {
    key: 'cat2',
    nameAr: 'الإنتاجية وجودة العمل',
    nameEn: 'Productivity & Work Quality',
    criteria: [
      { key: 'c1', nameAr: 'القدرة على إنجاز الأعمال بكفاءة عالية', nameEn: 'Ability to accomplish tasks with high efficiency', weight: 4 },
      { key: 'c2', nameAr: 'القدرة على تحديد خطوات العمل والبرنامج الزمني', nameEn: 'Ability to define work steps and timeline', weight: 4 },
      { key: 'c3', nameAr: 'المهارة في التنفيذ', nameEn: 'Skill in execution', weight: 4 },
      { key: 'c4', nameAr: 'إنجاز العمل في الوقت المحدد', nameEn: 'Completing work on time', weight: 4 },
    ]
  },
  {
    key: 'cat3',
    nameAr: 'العمل الجماعي والمشاركة',
    nameEn: 'Teamwork & Participation',
    criteria: [
      { key: 'c1', nameAr: 'المرونة والاستجابة السريعة لمتطلبات العمل', nameEn: 'Flexibility and quick response to work requirements', weight: 2 },
      { key: 'c2', nameAr: 'المشاركة الفاعلة في الاجتماعات', nameEn: 'Active participation in meetings', weight: 2 },
      { key: 'c3', nameAr: 'التعامل بروح الفريق والعمل بما يخدم الصالح العام للمؤسسة', nameEn: 'Team spirit and serving organization interests', weight: 2 },
      { key: 'c4', nameAr: 'المشاركة الإيجابية في المبادرات والأنشطة التي تدعم أهداف المؤسسة', nameEn: 'Positive participation in initiatives', weight: 2 },
    ]
  },
  {
    key: 'cat4',
    nameAr: 'الالتزام والانضباط',
    nameEn: 'Commitment & Discipline',
    criteria: [
      { key: 'c1', nameAr: 'المحافظة على أوقات العمل', nameEn: 'Maintaining work schedule', weight: 6 },
      { key: 'c2', nameAr: 'انضباطية عالية في الالتزام بالتعليمات وتقبل التوجيهات، مع استعداد دائم لتنفيذها بدقة', nameEn: 'High discipline in following instructions', weight: 6 },
    ]
  },
  {
    key: 'cat5',
    nameAr: 'الولاء المؤسسي',
    nameEn: 'Institutional Loyalty',
    criteria: [
      { key: 'c1', nameAr: 'الالتزام برسالة المؤسسة وقيمها في جميع التعاملات الداخلية والخارجية والمحافظة على سمعتها', nameEn: 'Commitment to organization mission and values', weight: 4 },
    ]
  },
  {
    key: 'cat6',
    nameAr: 'الصفات الشخصية',
    nameEn: 'Personal Traits',
    criteria: [
      { key: 'c1', nameAr: 'القدرة على الحوار وعرض الرأي', nameEn: 'Ability to discuss and present opinions', weight: 3 },
      { key: 'c2', nameAr: 'تقدير المسؤولية', nameEn: 'Sense of responsibility', weight: 3 },
      { key: 'c3', nameAr: 'الاهتمام بالمظهر', nameEn: 'Attention to appearance', weight: 3 },
      { key: 'c4', nameAr: 'حسن التصرف', nameEn: 'Good conduct', weight: 3 },
    ]
  },
  {
    key: 'cat7',
    nameAr: 'العلاقات',
    nameEn: 'Relationships',
    criteria: [
      { key: 'c1', nameAr: 'العلاقة مع الرؤساء', nameEn: 'Relationship with superiors', weight: 4 },
      { key: 'c2', nameAr: 'العلاقة مع الزملاء', nameEn: 'Relationship with colleagues', weight: 4 },
      { key: 'c3', nameAr: 'العلاقة مع المرؤوسين', nameEn: 'Relationship with subordinates', weight: 4 },
      { key: 'c4', nameAr: 'العلاقة مع المستفيدين', nameEn: 'Relationship with beneficiaries', weight: 4 },
    ]
  },
  {
    key: 'cat8',
    nameAr: 'التصنيع',
    nameEn: 'Manufacturing',
    criteria: [
      { key: 'c1', nameAr: 'القدرة على إنتاج وتصنيع منتجات', nameEn: 'Ability to produce and manufacture products', weight: 3 },
      { key: 'c2', nameAr: 'القدرة على تحويل المنتجات إلى حقائب تدريبية', nameEn: 'Ability to convert products into training kits', weight: 3 },
      { key: 'c3', nameAr: 'القدرة على تشغيل الأجهزة والآلات في عملية التصنيع والإنتاج', nameEn: 'Ability to operate manufacturing machines', weight: 3 },
      { key: 'c4', nameAr: 'القدرة على تجهيز حقيبة أو منتج في أي وقت خلال الطلب', nameEn: 'Ability to prepare a kit on demand', weight: 3 },
    ]
  },
  {
    key: 'cat9',
    nameAr: 'متابعة الأعمال',
    nameEn: 'Work Follow-up',
    criteria: [
      { key: 'c1', nameAr: 'متابعة المنصة والجدول اليومي', nameEn: 'Following up on platform and daily schedule', weight: 3 },
      { key: 'c2', nameAr: 'تعبئة الجدول بالمهام المطلوبة وتوثيقها', nameEn: 'Filling schedule with tasks and documenting', weight: 3 },
      { key: 'c3', nameAr: 'إتمام المهام اليومية في الجدول في الوقت المحدد', nameEn: 'Completing daily scheduled tasks on time', weight: 3 },
      { key: 'c4', nameAr: 'متابعة طلبات التسجيل على المنصة للمستفيدين', nameEn: 'Following up on registration requests', weight: 3 },
    ]
  },
];

// 8+16+8+12+4+12+16+12+12 = 100
export const TOTAL_WEIGHT = 100;

// Helper: calculate weighted total from raw scores object
export function calculateWeightedTotal(scores) {
  let total = 0;
  for (const cat of EVALUATION_CATEGORIES) {
    for (const cr of cat.criteria) {
      const raw = Math.min(Math.max(parseFloat(scores[`${cat.key}_${cr.key}`]) || 0, 0), 100);
      total += (raw / 100) * cr.weight;
    }
  }
  return parseFloat(total.toFixed(2));
}
