// A filled example of «نموذج الخطة التنفيذية» — a quarter of a FabLab
// Al-Ahsa section (3D printing) with four targets: a training program
// (linked to the employee's approved training kit when there is one), a
// community open day, preventive maintenance, and an external exhibition.
// Lets employees see a complete plan and try the review flow.
import { uid, sectionAr } from './planModel';
import { fmtKitNo } from '../TrainingKits/kitModel';

const phase = (task, start, end, criterion) => ({ id: uid(), task, start, end, criterion });
const block = (status, link = '') => ({ status, link, files: [] });

// Next quarter from today (Jan–Mar → the 2nd quarter, …) so the example
// dates are in the future.
const nextQuarter = () => {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return q === 4 ? { quarter: 1, year: now.getFullYear() + 1 } : { quarter: q + 1, year: now.getFullYear() };
};
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const examplePlanData = (employee, kit) => {
  const { quarter, year } = nextQuarter();
  const m1 = 3 * quarter - 2; const m2 = m1 + 1; const m3 = m1 + 2;
  const kitNo = kit ? fmtKitNo(kit.number != null ? kit.number : kit.kitNumber) : '';
  return {
    v: 1,
    example: true,
    header: {
      periodType: 'quarter',
      quarter,
      month: '',
      year,
      section: sectionAr(employee?.section) || 'الطباعة ثلاثية الأبعاد',
      head: employee?.name || ''
    },
    targets: [
      {
        id: uid(),
        name: `تنفيذ البرنامج التدريبي «${kit?.title || 'تعلّم الحركة الميكانيكية'}»`,
        kpi: 'عدد المستفيدين من البرامج التدريبية',
        desc: 'برنامج تطبيقي من 4 أيام يتعرف فيه المشاركون على أنواع الحركة الميكانيكية ويصممون نموذج تروس ويطبعونه بالطابعة ثلاثية الأبعاد، وفق الحقيبة التدريبية المعتمدة.',
        output: '20 متدربًا · 20 نموذج تروس مطبوع ومجمّع · عرض ختامي واحد',
        audience: 'طلاب المرحلة المتوسطة (12–15 سنة)',
        month: m2,
        place: 'فاب لاب الأحساء — قاعة التدريب',
        time: 'الأحد–الأربعاء، 4:00–7:00 م (4 أيام)',
        phases: [
          phase('الإعلان وفتح التسجيل', ymd(year, m1, 15), ymd(year, m1, 28), '20 مسجلًا مؤكدًا وقائمة انتظار'),
          phase('تجهيز المواد وطباعة النماذج المرجعية وتجربتها', ymd(year, m2, 1), ymd(year, m2, 7), 'نماذج مرجعية مطبوعة ومجربة وخامات تكفي 20 مشاركًا'),
          phase('تنفيذ البرنامج', ymd(year, m2, 10), ymd(year, m2, 13), 'حضور 75% فأكثر وتسليم المخرجات'),
          phase('التقييم وإعداد التقرير الختامي', ymd(year, m2, 16), ymd(year, m2, 20), 'تقرير ختامي يتضمن نتائج الاختبارين والاستبانة')
        ],
        sectionRole: 'إعداد المحتوى وتنفيذ التدريب، وتوفير الطابعات والخامات، وتقييم المخرجات.',
        headRole: 'أساسي',
        content: kit
          ? { status: 'مرفق ومعتمد', link: '', files: [], kitId: kit.id || kit.kitId, kitNo, kitTitle: kit.title || '' }
          : { status: 'بانتظار الاعتماد', link: '', files: [], kitId: '', kitNo: '', kitTitle: '' },
        finance: block('قيد الإعداد'),
        media: block('مرفقة', 'https://drive.google.com/drive/folders/example-media-brief'),
        volunteer: { link: '', files: [] },
        notes: 'يحتاج البرنامج مدربًا مساعدًا واحدًا من فريق القسم.'
      },
      {
        id: uid(),
        name: 'يوم مفتوح للطباعة ثلاثية الأبعاد للأسر',
        kpi: 'عدد الزوار والمستفيدين من الفعاليات',
        desc: 'فعالية مجتمعية يتعرف فيها الزوار على الطباعة ثلاثية الأبعاد من خلال عروض حية وركن لتلوين المجسمات المطبوعة.',
        output: 'فعالية واحدة · 60 زائرًا · 100 مجسم مطبوع للتوزيع',
        audience: 'الأسر والأطفال (7–14 سنة)',
        month: m3,
        place: 'فاب لاب الأحساء — البهو الرئيسي',
        time: 'السبت، 10:00 ص – 2:00 م',
        phases: [
          phase('تصميم الفعالية واختيار المجسمات', ymd(year, m2, 22), ymd(year, m2, 28), 'مخطط الفعالية وقائمة 5 مجسمات معتمدة'),
          phase('طباعة المجسمات وتجهيز الأركان', ymd(year, m3, 1), ymd(year, m3, 10), '100 مجسم مطبوع وثلاثة أركان جاهزة'),
          phase('الإعلان واستقبال التسجيل', ymd(year, m3, 3), ymd(year, m3, 12), 'نشر الإعلان و60 تسجيلًا'),
          phase('تنفيذ الفعالية وتوثيقها', ymd(year, m3, 14), ymd(year, m3, 14), 'تقرير مصوّر وعدد الحضور الفعلي')
        ],
        sectionRole: 'تشغيل العروض الحية وطباعة المجسمات وإدارة ركن الطباعة.',
        headRole: 'أساسي',
        content: { status: 'لا يتطلب', link: '', files: [], kitId: '', kitNo: '', kitTitle: '' },
        finance: block('قيد الإعداد'),
        media: block('قيد الإعداد'),
        volunteer: { link: 'https://drive.google.com/drive/folders/example-volunteer-designs', files: [] },
        notes: 'تحتاج الفعالية 4 متطوعين لتنظيم الأركان واستقبال الزوار.'
      },
      {
        id: uid(),
        name: 'صيانة وقائية لطابعات القسم وجرد الخامات',
        kpi: 'نسبة جاهزية الأجهزة والمعدات',
        desc: 'فحص ومعايرة جميع الطابعات ثلاثية الأبعاد وتنظيف الرؤوس، وجرد الخامات وتحديث طلب الشراء.',
        output: 'جاهزية 100% لجميع الطابعات · تقرير صيانة وجرد واحد',
        audience: 'فريق فاب لاب الداخلي',
        month: m1,
        place: 'معمل الطباعة ثلاثية الأبعاد',
        time: 'الأحد والاثنين، 8:00–12:00 ص',
        phases: [
          phase('فحص الطابعات ومعايرتها', ymd(year, m1, 4), ymd(year, m1, 5), 'سجل فحص لكل طابعة'),
          phase('جرد الخامات وتحديث طلب الشراء', ymd(year, m1, 6), ymd(year, m1, 8), 'قائمة جرد محدثة وطلب شراء مرفوع')
        ],
        sectionRole: 'تنفيذ الصيانة والجرد بالكامل.',
        headRole: 'أساسي',
        content: { status: 'لا يتطلب', link: '', files: [], kitId: '', kitNo: '', kitTitle: '' },
        finance: block('لا يتطلب'),
        media: block('لا يتطلب'),
        volunteer: { link: '', files: [] },
        notes: ''
      },
      {
        id: uid(),
        name: 'المشاركة في معرض مدرسي للابتكار بالتعاون مع إدارة التعليم',
        kpi: 'عدد الشراكات والمبادرات المجتمعية',
        desc: 'جناح يعرض نماذج مطبوعة من برامج فاب لاب مع طابعة تعمل مباشرة أمام الطلاب.',
        output: 'جناح عرض واحد · 10 نماذج مطبوعة',
        audience: 'طلاب المدارس وزوار المعرض',
        month: m3,
        place: 'موقع المعرض (يحدده المنظِّم)',
        time: 'حسب جدول المعرض (يومان)',
        phases: [
          phase('اختيار النماذج وطباعتها', ymd(year, m3, 1), ymd(year, m3, 12), '10 نماذج جاهزة للعرض'),
          phase('تجهيز الجناح والمشاركة', ymd(year, m3, 20), ymd(year, m3, 21), 'تشغيل الجناح طوال أيام المعرض')
        ],
        sectionRole: 'تجهيز نماذج العرض وتشغيل طابعة حية في الجناح.',
        headRole: 'مشارك',
        content: { status: 'لا يتطلب', link: '', files: [], kitId: '', kitNo: '', kitTitle: '' },
        finance: block('لا يتطلب'),
        media: block('قيد الإعداد'),
        volunteer: { link: '', files: [] },
        notes: 'التنسيق العام للمعرض لدى قسم الشراكات.'
      }
    ]
  };
};
