import React from 'react';
import SiteLayout from './SiteLayout';
import { PageHero, Reveal } from './SiteParts';
import { useSiteLang } from './siteCore';
import './sitePages.css';

const PATHS = [
  {
    icon: 'fa-book-open', color: '#9C27B0',
    ar: ['مسار الإثراء', 'يركز هذا المسار على إثراء المحتوى العربي فيما يتعلق بالتصنيع الرقمي وذلك من خلال البرامج التي يقدمها فاب لاب الأحساء على سبيل المثال: الورش التدريبية التي يتم تسجيلها ونشرها في الإنترنت وبرنامج المحتوى الصوتي الخاص فاب كاست والذي من خلاله يتم نشر محتوى صوتي ذا صلة بالتصنيع الرقمي وغيرها من البرامج الإثرائية'],
    en: ['Enrichment Path', 'This path focuses on enriching Arabic content related to digital manufacturing through programs offered by FabLab Al-Ahsa, for example: training workshops that are recorded and published online, and the FabCast audio content program through which audio content related to digital manufacturing and other enrichment programs are published']
  },
  {
    icon: 'fa-user-graduate', color: '#03A9F4',
    ar: ['مسار التمكين', 'يشمل هذا المسار على كل ما يتعلق بتدريب الأفراد والمجموعات على آلات التصنيع الرقمي المتواجدة في المعمل من خلال البرامج وورش العمل والمعسكرات التدريبية والمسابقات الابتكارية ورعاية الموهوبين والمساعدة على حصول براءات اختراع'],
    en: ['Empowerment Path', 'This path includes everything related to training individuals and groups on the digital manufacturing machines available in the lab through programs, workshops, training camps, innovation competitions, talent sponsorship, and assistance in obtaining patents']
  },
  {
    icon: 'fa-project-diagram', color: '#FFC107',
    ar: ['مسار المشاريع', 'يختص هذا المسار بالمشاريع التي يتم تنفيذها من قبل المستفيدين والمشاريع التي ينفذها فريق فاب لاب داخل المعمل وخارجه كمشاريع مجتمعية'],
    en: ['Projects Path', 'This path specializes in projects implemented by beneficiaries and projects implemented by the FabLab team inside and outside the lab as community projects']
  },
  {
    icon: 'fa-flask', color: '#4CAF50',
    ar: ['مسار البحث و التطوير', 'يعنى هذا المسار على العمل في مجال البحث والتطوير عن طريق التعاون مع الخبراء والباحثين لنشر أوراق علمية من شأنها أن تضيف للمجتمع أو تطوره'],
    en: ['Research & Development Path', 'This path focuses on working in the field of research and development through cooperation with experts and researchers to publish scientific papers that would add value to society or develop it']
  },
  {
    icon: 'fa-handshake', color: '#E91E63',
    ar: ['مسار الشراكات', 'نركز في فاب لاب الأحساء على إيجاد الشراكات النوعية التي تمكننا من تحقيق أهدافنا بالتعاون معهم في توعية المجتمع بأهمية التصنيع الرقمي وتمكين الأفراد في عدة مجالات تقنية رقمية'],
    en: ['Partnerships Path', 'At FabLab Al-Ahsa, we focus on finding quality partnerships that enable us to achieve our goals in cooperation with them to raise community awareness about the importance of digital manufacturing and empower individuals in various digital technical fields']
  },
  {
    icon: 'fa-leaf', color: '#00BCD4',
    ar: ['مسار الاستدامة', 'تعتبر استدامة معامل التصنيع الرقمية هدف عالمي تسعى له كل المعامل وذلك لأن هذه المعامل تحتاج إلى دعم مستمر لكي تقدم الخدمات للمجتمع ولأننا معمل غير ربحي نعمل جاهدين على إيجاد مشاريع تابعة لفاب لاب الأحساء تساهم في استدامة المعمل وإفادة المجتمع'],
    en: ['Sustainability Path', 'The sustainability of digital manufacturing labs is a global goal pursued by all labs because these labs need continuous support to provide services to the community. As a non-profit lab, we work hard to find projects affiliated with FabLab Al-Ahsa that contribute to the sustainability of the lab and benefit the community']
  }
];

const SitePaths = () => {
  const { lang } = useSiteLang();
  return (
    <SiteLayout className="site-paths">
      <PageHero
        title={lang === 'ar' ? 'مسارات فاب لاب الأحساء' : 'FabLab Al-Ahsa Paths'}
        intro={lang === 'ar'
          ? 'لتقديم الخدمات بأفضل جودة ممكنة وبأفضل صورة تنظيمية ممكنة، يعمل فريق فاب لاب الأحساء في تنفيذ برامجه وتقديم خدماته من خلال مسارات واضحة تقوم على أهداف محددة كالتالي:'
          : 'To provide services with the highest possible quality and the best organizational structure, the FabLab Al-Ahsa team implements its programs and offers its services through clear paths based on specific objectives as follows:'}
      />
      <section className="site-section">
        <div className="site-container site-paths-grid">
          {PATHS.map((p, i) => {
            const [title, desc] = p[lang];
            return (
              <Reveal key={p.icon} className="site-path-card" delay={(i % 3) * 90} style={{ '--pc': p.color }}>
                <span className="site-path-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="site-path-icon"><i className={`fas ${p.icon}`} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </Reveal>
            );
          })}
        </div>
      </section>
    </SiteLayout>
  );
};

export default SitePaths;
