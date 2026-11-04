// A filled example of «نموذج الخطة التنفيذية» — a quarter of a FabLab
// Al-Ahsa section (3D printing) with four targets: a training program
// (linked to the employee's training kit when there is one), a community
// open day, preventive maintenance, and an external exhibition. Each of
// the four «ملفات المستهدف» is shown on its own path: a linked kit, a
// financial request (created with the example), media design requests
// (created from the example's media forms) and a filled volunteer form.
// Lets employees see a complete plan and try the review flow.
import { uid, sectionAr, analyze, fmtMediaNo } from './planModel';
import { NA, MAKE_F, normalizeBlocks, mediaStarted } from './planFiles';
import { fmtKitNo } from '../TrainingKits/kitModel';

const phase = (task, start, end, criterion) => ({ id: uid(), task, start, end, criterion });
const na = () => ({ status: NA });
const axis = (title, desc) => ({ id: uid(), title, desc });
const role = (o) => ({ ...MAKE_F.role(), ...o });

// Ad images for the example's media forms (generated SVG posters).
const poster = (name, title, sub, hue) => new File([`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,22%)"/><stop offset="1" stop-color="hsl(${hue + 30},80%,45%)"/></linearGradient></defs>
  <rect width="800" height="560" fill="url(#g)"/>
  <g fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2">${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${640 - i * 18}" cy="${150 + i * 12}" r="${60 + i * 26}"/>`).join('')}</g>
  <rect x="60" y="360" width="680" height="4" fill="#EE2329"/>
  <text x="740" y="300" text-anchor="end" font-family="Tahoma, Arial" font-size="46" font-weight="700" fill="#fff">${title}</text>
  <text x="740" y="420" text-anchor="end" font-family="Tahoma, Arial" font-size="26" fill="rgba(255,255,255,.85)">${sub}</text>
  <text x="60" y="510" font-family="Arial" font-size="22" font-weight="700" fill="#fff">FABLAB Al-Ahsa</text>
</svg>`], name, { type: 'image/svg+xml' });

// [targetIndex, File, caption] — uploaded by the example's creator.
export const exampleMediaImages = (kitTitle) => [
  [0, poster('ad-1.svg', kitTitle || 'تعلّم الحركة الميكانيكية', 'برنامج تدريبي — 4 أيام', 350), 'غلاف الإعلان'],
  [0, poster('ad-2.svg', 'صمّم ترسك واطبعه', 'التروس ونِسَب النقل والطباعة ثلاثية الأبعاد', 210), 'صورة المخرج'],
  [0, poster('ad-3.svg', 'من الفكرة إلى نموذج يعمل', 'تجميع نموذج قنديل البحر الميكانيكي', 25), 'صورة من التطبيق'],
  [1, poster('openday-1.svg', 'يوم مفتوح للطباعة ثلاثية الأبعاد', 'للأسر والأطفال — الدخول مجاني', 190), 'غلاف الإعلان'],
  [1, poster('openday-2.svg', 'عروض حية', 'شاهد الطابعة وهي تصنع المجسّم', 260), 'العروض الحية'],
  [1, poster('openday-3.svg', 'ركن التلوين', 'لوّن مجسّمك المطبوع وخذه معك', 300), 'ركن التلوين']
];

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
  const head = employee?.name || '';
  const p1 = [ymd(year, m2, 10), ymd(year, m2, 13)];
  const openDay = ymd(year, m3, 14);
  const targets = [
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
        content: kit ? { kitId: kit.id || kit.kitId, kitNo, kitTitle: kit.title || '' } : {},
        // the financial request is created and linked with the example
        finance: {},
        media: {
          form: {
            activity: `برنامج «${kit?.title || 'تعلّم الحركة الميكانيكية'}» (قسم الطباعة ثلاثية الأبعاد)`,
            implementer: head,
            ageMin: 12, ageMax: 15, timeFrom: '16:00', timeTo: '19:00', dayPart: 'مساءً',
            dateFrom: p1[0], dateTo: p1[1],
            beneficiaries: 20, seatsNote: '5 مقاعد من قائمة الاحتضان، و15 مقعدًا للتسجيل الخارجي',
            days: 'أربعة أيام', gender: 'أولاد',
            axes: [
              axis('أنواع الحركة الميكانيكية', 'الحركة الدورانية والخطية والترددية والاهتزازية، وأمثلتها في الآلات من حولنا.'),
              axis('التروس ونِسَب النقل', 'حساب نسبة النقل واتجاه الدوران وأثرهما على السرعة والعزم.'),
              axis('تجميع نموذج ميكانيكي يعمل', 'تجميع نموذج قنديل البحر وتتبّع انتقال الحركة فيه وتشخيص أعطاله.'),
              axis('تصميم ترس وطباعته', 'تصميم قطعة في Shapr3D وتجهيزها للطباعة ثلاثية الأبعاد وتركيبها على النموذج.')
            ],
            dueDate: ymd(year, m1, 10), urgency: 'غير مستعجل', cost: '150 ر.س',
            notes: 'إبراز صورة النموذج المتحرك، وذكر أن المشارك يأخذ قطعته المطبوعة معه.'
          }
        },
        volunteer: na(),
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
        content: na(),
        finance: na(),
        media: {
          form: {
            activity: 'يوم مفتوح للطباعة ثلاثية الأبعاد للأسر',
            implementer: head,
            ageMin: 7, ageMax: 14, timeFrom: '10:00', timeTo: '14:00', dayPart: 'صباحًا',
            dateFrom: openDay, dateTo: openDay,
            beneficiaries: 60, seatsNote: 'التسجيل المسبق للأسر، ويُقبل الحضور المباشر حسب السعة',
            days: 'يوم واحد', gender: 'مختلط',
            axes: [
              axis('عروض حية للطباعة', 'طابعتان تعملان أمام الزوار مع شرح مبسّط لكل مرحلة.'),
              axis('ركن التلوين', 'يلوّن الأطفال مجسّمات مطبوعة مسبقًا ويأخذونها معهم.'),
              axis('ركن التصميم السريع', 'تجربة تصميم مجسّم بسيط على الجهاز اللوحي مع أحد أعضاء الفريق.')
            ],
            dueDate: ymd(year, m3, 1), urgency: 'مستعجل', cost: 'مجاني',
            notes: 'تصميم مناسب للعائلات بألوان مبهجة، مع رمز QR للتسجيل.'
          }
        },
        volunteer: {
          form: {
            coordinatorName: head, coordinatorPhone: '0551234567', location: 'فاب لاب الأحساء — البهو الرئيسي', mode: 'حضوري',
            roles: [
              role({ title: 'منظّم ركن العروض الحية', field: 'الطباعة ثلاثية الأبعاد', count: 2, tasks: 'تشغيل العروض مع الفريق، والإجابة عن أسئلة الزوار، وتنظيم الدور أمام الطابعات.',
                skills: 'معرفة أساسية بالطباعة ثلاثية الأبعاد، ومهارة التواصل مع الأطفال', education: 'طالب جامعي أو خريج', gender: 'الجميع', ageMin: 18, ageMax: 30,
                dateFrom: openDay, dateTo: openDay, timeFrom: '09:30', timeTo: '14:30' }),
              role({ title: 'مستقبل الزوار ومنظّم التسجيل', field: 'التنظيم وخدمة الزوار', count: 2, tasks: 'استقبال الأسر، والتحقق من التسجيل، وتوزيع الزوار على الأركان، وتوزيع المجسّمات.',
                skills: 'التنظيم وحسن التعامل', education: '', gender: 'الجميع', ageMin: 18, ageMax: 35,
                dateFrom: openDay, dateTo: openDay, timeFrom: '09:30', timeTo: '14:30' })
            ],
            support: 'شهادة تطوع موثقة بالساعات، وتدريب قصير قبل الفعالية، ووجبة خفيفة.',
            risks: 'ازدحام الأركان في ذروة الحضور — يُوزَّع الزوار على فترات كل 30 دقيقة.'
          }
        },
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
        content: na(),
        finance: na(),
        media: na(),
        volunteer: na(),
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
        content: na(),
        finance: na(),
        media: na(),
        volunteer: na(),
        notes: 'التنسيق العام للمعرض والإعلان عنه لدى قسم الشراكات والجهة المنظِّمة.'
      }
  ];
  return {
    v: 1,
    example: true,
    header: {
      periodType: 'quarter',
      quarter,
      month: '',
      year,
      section: sectionAr(employee?.section) || 'الطباعة ثلاثية الأبعاد',
      head
    },
    // fill each block's missing structure (empty forms, files, links)
    targets: targets.map(t => ({ ...t, ...normalizeBlocks(t) }))
  };
};

// The example's media forms become design requests, each on its own path
// (employee → design team → employee's design check → project manager →
// manager): POST /media-requests/mine/from-plan moves a target's form and
// its images into a new request, and the target links it. The plan is
// saved first so the server reads the filled forms; the plan's own copies
// of the images are then removed. A target whose request can't be created
// keeps its form.
export const exampleMediaToRequests = async (api, planId, data, R) => {
  await api.put(R.kit(planId), { data, completion: analyze(data).pct });
  for (const t of data.targets) {
    if (t.media.status === NA || !mediaStarted(t.media.form)) continue;
    try {
      const { data: r } = await api.post('/media-requests/mine/from-plan', { planId, targetId: t.id });
      const images = t.media.form.images;
      Object.assign(t.media, {
        requestId: r.id || r.requestId,
        requestNo: fmtMediaNo(r.number != null ? r.number : r.requestNumber),
        requestTitle: r.title || '',
        form: MAKE_F.media()
      });
      images.forEach(f => { api.delete(R.dropFile(planId, f.fileId)).catch(() => {}); });
    } catch { /* the target keeps its form */ }
  }
};
