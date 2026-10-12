import React from 'react';
import { Link } from 'react-router-dom';
import SiteLayout from './SiteLayout';
import { PageHero, Reveal } from './SiteParts';
import { useSiteLang } from './siteCore';
import './sitePages.css';

const FACILITIES = [
  {
    id: 'kids-lab', icon: 'fa-child', grad: ['#FF9800', '#F57C00'],
    fIcons: ['fa-puzzle-piece', 'fa-palette', 'fa-robot', 'fa-shield-alt'],
    ar: ['معمل الأطفال', 'مساحة تعليمية تفاعلية مصممة خصيصًا للأطفال من عمر 6 إلى 12 سنة. بيئة آمنة ومحفزة لاكتشاف عالم التكنولوجيا والابتكار من خلال أنشطة تعليمية مناسبة لأعمارهم.',
      ['أنشطة تعليمية تفاعلية', 'ورش عمل إبداعية', 'برمجة مبسطة للأطفال', 'بيئة آمنة ومشرفة']],
    en: ['Kids Lab', 'An interactive educational space designed specifically for children aged 6 to 12. A safe and motivating environment to explore the world of technology and innovation through age-appropriate educational activities.',
      ['Interactive educational activities', 'Creative workshops', 'Simplified programming for children', 'Safe and supervised environment']]
  },
  {
    id: 'robotics-club', icon: 'fa-robot', grad: ['#2196F3', '#1976D2'],
    fIcons: ['fa-microchip', 'fa-code', 'fa-trophy', 'fa-users'],
    ar: ['نادي الروبوتات', 'مركز متخصص في تعلم وتطوير مهارات البرمجة والروبوتات. نقدم أحدث التقنيات في مجال الذكاء الاصطناعي والروبوتات للمبتدئين والمتقدمين والمحترفين على حد سواء.',
      ['روبوتات متطورة', 'برمجة متقدمة', 'مسابقات محلية ودولية', 'فرق عمل متخصصة']],
    en: ['Robotics Club', 'A specialized center for learning and developing programming and robotics skills. We offer the latest technologies in artificial intelligence and robotics for beginners, intermediate, and professional learners alike.',
      ['Advanced robots', 'Advanced programming', 'Local and international competitions', 'Specialized work teams']]
  },
  {
    id: 'training-halls', icon: 'fa-chalkboard-teacher', grad: ['#4CAF50', '#388E3C'],
    fIcons: ['fa-desktop', 'fa-video', 'fa-wifi', 'fa-user-friends'],
    ar: ['قاعات التدريب', 'مساحات تدريبية مجهزة بأحدث التقنيات لتقديم دورات وورش عمل متخصصة في مختلف مجالات التصنيع الرقمي والتكنولوجيا. بيئة محفزة للتعلم وتبادل المعرفة.',
      ['أجهزة متطورة', 'أنظمة عرض متكاملة', 'اتصال إنترنت فائق السرعة', 'سعة استيعابية كبيرة']],
    en: ['Training Halls', 'Training spaces equipped with the latest technologies to deliver specialized courses and workshops in various fields of digital manufacturing and technology. A motivating environment for learning and knowledge exchange.',
      ['Advanced equipment', 'Integrated display systems', 'High-speed internet connection', 'Large seating capacity']]
  },
  {
    id: 'entertainment-hall', icon: 'fa-gamepad', grad: ['#E91E63', '#C2185B'],
    fIcons: ['fa-vr-cardboard', 'fa-desktop', 'fa-chess', 'fa-couch'],
    ar: ['قاعة الترفيه', 'مساحة ترفيهية متكاملة مجهزة بأحدث أجهزة الألعاب وتقنيات الواقع الافتراضي. بيئة مثالية للاسترخاء والترفيه مع مجموعة متنوعة من الأنشطة الترفيهية المناسبة لجميع الأعمار.',
      ['أجهزة الواقع الافتراضي', 'ألعاب إلكترونية متطورة', 'ألعاب ذهنية وتفاعلية', 'مساحات استرخاء مريحة']],
    en: ['Entertainment Hall', 'A fully integrated entertainment space equipped with the latest gaming devices and virtual reality technologies. An ideal environment for relaxation and entertainment with a variety of activities suitable for all ages.',
      ['Virtual reality devices', 'Advanced electronic games', 'Mind and interactive games', 'Comfortable relaxation spaces']]
  },
  {
    id: 'digitalization-hall', icon: 'fa-digital-tachograph', grad: ['#9C27B0', '#7B1FA2'],
    fIcons: ['fa-brain', 'fa-cloud', 'fa-database', 'fa-shield-alt'],
    ar: ['قاعة الرقمنة', 'مركز متخصص في التحول الرقمي وتقنيات المستقبل. تجهيزات متكاملة لدعم المشاريع الرقمية والذكاء الاصطناعي، مع بيئة محفزة للإبداع التقني والابتكار في عالم الرقمنة.',
      ['أنظمة الذكاء الاصطناعي', 'حلول الحوسبة السحابية', 'مراكز بيانات متطورة', 'أنظمة أمن سيبراني']],
    en: ['Digitalization Hall', 'A specialized center in digital transformation and future technologies. Integrated equipment to support digital projects and artificial intelligence, with an environment that encourages technical creativity and innovation in the world of digitalization.',
      ['Artificial intelligence systems', 'Cloud computing solutions', 'Advanced data centers', 'Cybersecurity systems']]
  }
];

const INFO = {
  ar: [
    ['fa-users', 'الفئات المستفيدة', ['طلاب المدارس والجامعات', 'المهتمين بالتكنولوجيا', 'رواد الأعمال والمخترعين']],
    ['fa-calendar-check', 'الحجز المسبق', ['يجب الحجز المسبق لجميع المرافق', 'خصومات للمجموعات', 'برامج خاصة للجهات التعليمية']]
  ],
  en: [
    ['fa-users', 'Beneficiary Groups', ['School and university students', 'Technology enthusiasts', 'Entrepreneurs and inventors']],
    ['fa-calendar-check', 'Prior Reservation', ['Prior reservation required for all facilities', 'Group discounts available', 'Special programs for educational institutions']]
  ]
};

const SiteFacilities = () => {
  const { lang } = useSiteLang();
  return (
    <SiteLayout className="site-facilities">
      <PageHero
        title={lang === 'ar' ? 'مرافق فاب لاب الأحساء' : 'FabLab Al-Ahsa Facilities'}
        intro={lang === 'ar'
          ? 'اكتشف مرافقنا المتطورة المصممة لدعم الابتكار والتعلم في بيئة محفزة وإبداعية. نقدم مساحات متخصصة تلبي احتياجات جميع الفئات العمرية والمستويات.'
          : 'Discover our state-of-the-art facilities designed to support innovation and learning in a motivating and creative environment. We offer specialized spaces that meet the needs of all age groups and levels.'}
      />
      <section className="site-section">
        <div className="site-container">
          <div className="site-facility-grid">
            {FACILITIES.map((f, i) => {
              const [title, desc, feats] = f[lang];
              return (
                <Reveal key={f.id} className="site-facility-card" delay={(i % 3) * 90}>
                  <div className="site-facility-art" style={{ background: `linear-gradient(135deg, ${f.grad[0]}, ${f.grad[1]})` }}>
                    <i className={`fas ${f.icon}`} aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  <ul className="site-facility-feats">
                    {feats.map((ft, k) => (
                      <li key={ft}><i className={`fas ${f.fIcons[k]}`} aria-hidden="true" /> {ft}</li>
                    ))}
                  </ul>
                </Reveal>
              );
            })}
          </div>

          <div className="site-info-cards">
            {INFO[lang].map(([icon, title, lines], i) => (
              <Reveal key={icon} className="site-info-card" delay={i * 100}>
                <span className="site-info-icon"><i className={`fas ${icon}`} aria-hidden="true" /></span>
                <h4>{title}</h4>
                {lines.map(l => <p key={l}>{l}</p>)}
              </Reveal>
            ))}
          </div>

          <Reveal className="site-cta-band">
            <div>
              <h3>{lang === 'ar' ? 'هل ترغب بزيارة مرافقنا؟' : 'Would you like to visit our facilities?'}</h3>
              <p>{lang === 'ar' ? 'احجز زيارتك لفاب لاب الأحساء لك أو لجهتك التعليمية.' : 'Book a visit to FabLab Al-Ahsa for yourself or your educational institution.'}</p>
            </div>
            <Link to="/fablab-visit" className="site-btn site-btn--primary">
              <i className="fas fa-building" aria-hidden="true" /> {lang === 'ar' ? 'احجز زيارة' : 'Book a Visit'}
            </Link>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
};

export default SiteFacilities;
