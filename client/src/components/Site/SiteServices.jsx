import React from 'react';
import { Link } from 'react-router-dom';
import SiteLayout from './SiteLayout';
import { PageHero, Reveal } from './SiteParts';
import { useSiteLang } from './siteCore';
import './sitePages.css';

// Booking goes through the registration form; 3D printing has its own
// dedicated request flow.
const SERVICES = [
  {
    icon: 'fa-microchip', book: '/register',
    ar: ['الإلكترونيات والبرمجة', 'نوفر في هذا القسم مجموعة من الأدوات والمعدات لتصميم وبرمجة الدوائر الإلكترونية وتطوير المشاريع التقنية.',
      ['تصميم الدوائر الإلكترونية', 'برمجة المتحكمات الدقيقة', 'تطوير تطبيقات IoT', 'تدريب على استخدام الأدوات']],
    en: ['Electronics & Programming', 'We provide a range of tools and equipment for designing and programming electronic circuits and developing technical projects.',
      ['Electronic circuit design', 'Microcontroller programming', 'IoT application development', 'Training on using the tools']]
  },
  {
    icon: 'fa-print', book: '/print-service',
    ar: ['الطباعة ثلاثية الأبعاد', 'نقدم خدمات الطباعة ثلاثية الأبعاد بدقة عالية باستخدام أحدث الطابعات لتحويل أفكاركم إلى نماذج ملموسة.',
      ['طباعة النماذج الأولية', 'تصميم النماذج ثلاثية الأبعاد', 'استخدام مواد متنوعة', 'دعم فني متكامل']],
    en: ['3D Printing', 'We offer high-precision 3D printing services using the latest printers to turn your ideas into tangible models.',
      ['Prototype printing', '3D model design', 'A variety of materials', 'Full technical support']]
  },
  {
    icon: 'fa-cut', book: '/register',
    ar: ['النحت والقطع', 'نوفر أجهزة متطورة للنحت والقطع على المواد المختلفة مثل الخشب والأكريليك لتنفيذ التصاميم الدقيقة.',
      ['قطع ونحت الخشب', 'نحت الأكريليك والبلاستيك', 'تصميم القوالب والنماذج', 'إنتاج قطع دقيقة ومتنوعة']],
    en: ['Carving & Cutting', 'We provide advanced machines for carving and cutting materials such as wood and acrylic to produce precise designs.',
      ['Wood cutting and carving', 'Acrylic and plastic carving', 'Mould and model design', 'Precise, varied parts production']]
  },
  {
    icon: 'fa-burn', book: '/register',
    ar: ['الليزر للحرق والقص', 'نقدم خدمات الحرق والقص بالليزر على مختلف المواد بدقة وجودة عالية لتحقيق التصاميم المطلوبة.',
      ['قص وحرق الخشب', 'نقش على الجلود', 'قص الأكريليك والمواد البلاستيكية', 'تصميم شخصي للمنتجات']],
    en: ['Laser Engraving & Cutting', 'We offer laser engraving and cutting on a wide range of materials with high precision and quality to achieve the designs you need.',
      ['Wood cutting and engraving', 'Leather engraving', 'Acrylic and plastic cutting', 'Personalised product design']]
  },
  {
    icon: 'fa-sticky-note', book: '/register',
    ar: ['القطع بالفينيل', 'نوفر خدمات القطع بالفينيل لإنشاء التصاميم اللاصقة والديكورات باستخدام مواد فينيل عالية الجودة.',
      ['قص ملصقات الفينيل', 'تصميم شعارات وديكورات', 'فينيل حراري للملابس', 'خدمات تركيب الفينيل']],
    en: ['Vinyl Cutting', 'We provide vinyl cutting services to create stickers and decorations using high-quality vinyl materials.',
      ['Vinyl sticker cutting', 'Logo and decoration design', 'Heat-transfer vinyl for clothing', 'Vinyl installation services']]
  },
  {
    icon: 'fa-video', book: '/register',
    ar: ['الاستوديو', 'نوفر استوديو مجهز بأحدث تقنيات التصوير والإضاءة لتسجيل المحتوى المرئي بجودة احترافية.',
      ['تصوير فيديو احترافي', 'تسجيل البودكاست', 'إضاءة متكاملة وخلفيات', 'معدات صوت عالية الجودة']],
    en: ['Studio', 'We provide a studio equipped with the latest filming and lighting technology to record visual content at professional quality.',
      ['Professional video filming', 'Podcast recording', 'Complete lighting and backdrops', 'High-quality audio equipment']]
  },
  {
    icon: 'fa-lightbulb', book: '/register',
    ar: ['غرفة العصف الذهني', 'غرفة مخصصة للاجتماعات والعصف الذهني، مجهزة بتقنيات متطورة لدعم الإبداع وتبادل الأفكار.',
      ['بيئة محفزة للإبداع', 'شاشات تفاعلية وأدوات عرض', 'طاولات عمل مرنة', 'إمكانية عقد ورش عمل']],
    en: ['Brainstorming Room', 'A room dedicated to meetings and brainstorming, equipped with advanced technology to support creativity and the exchange of ideas.',
      ['A creativity-boosting environment', 'Interactive screens and presentation tools', 'Flexible work tables', 'Can host workshops']]
  }
];

const SiteServices = () => {
  const { lang } = useSiteLang();
  const ar = lang === 'ar';
  return (
    <SiteLayout className="site-services">
      <PageHero
        title={ar ? 'خدمات فاب لاب الأحساء' : 'FabLab Al-Ahsa Services'}
        intro={ar
          ? 'نقدم لكم مجموعة متكاملة من الخدمات التقنية المتطورة لدعم إبداعكم وتحويل أفكاركم إلى واقع ملموس'
          : 'We offer an integrated range of advanced technical services to support your creativity and turn your ideas into reality'}
      >
        <Link to="/register" className="site-btn site-btn--primary site-page-cta">
          <i className="fas fa-calendar-check" aria-hidden="true" /> {ar ? 'احجز خدمتك الآن' : 'Book Your Service Now'}
        </Link>
      </PageHero>

      <section className="site-section">
        <div className="site-container site-service-grid">
          {SERVICES.map((s, i) => {
            const [title, desc, feats] = s[lang];
            return (
              <Reveal key={s.icon} className="site-service-card" delay={(i % 3) * 90}>
                <span className="site-service-icon"><i className={`fas ${s.icon}`} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{desc}</p>
                <ul className="site-checklist">
                  {feats.map(f => <li key={f}><i className="fas fa-check" aria-hidden="true" /> {f}</li>)}
                </ul>
                <div className="site-service-actions">
                  <Link to={s.book} className="site-btn site-btn--primary site-btn--sm">
                    <i className="fas fa-calendar-plus" aria-hidden="true" /> {ar ? 'حجز خدمة' : 'Book Service'}
                  </Link>
                  <Link to="/register" className="site-btn site-btn--outline site-btn--sm">
                    <i className="fas fa-headset" aria-hidden="true" /> {ar ? 'استشارة' : 'Consultation'}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>
    </SiteLayout>
  );
};

export default SiteServices;
