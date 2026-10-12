import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SiteLayout from './SiteLayout';
import { PageHero, Reveal } from './SiteParts';
import { useSiteLang, scrollToId } from './siteCore';
import './sitePages.css';

const SECTIONS = [
  {
    id: 'electronics', img: '/site/sections/a8.jpeg', icons: ['fa-microchip', 'fa-tools', 'fa-lightbulb'],
    ar: { tab: 'قسم الإلكترونيات والبرمجة', desc: 'في هذا القسم، تجد كل ما يتعلق بالإلكترونيات من قطع إلكترونية مثل الأردوينو، المتحكمات الدقيقة، أجهزة التلحيم، الراسبيري باي، الإضاءات، والقطع الأخرى. تعلم كيفية برمجتها وتطوير مشاريع إلكترونية متقدمة.', features: ['أدوات برمجة متقدمة', 'معدات تلحيم احترافية', 'دعم للمشاريع الإبداعية'] },
    en: { tab: 'Electronics and Programming Section', desc: "In this section, you'll find everything related to electronics, including components like Arduino, microcontrollers, soldering equipment, Raspberry Pi, lighting, and other parts. Learn how to program and develop advanced electronic projects.", features: ['Advanced programming tools', 'Professional soldering equipment', 'Support for creative projects'] }
  },
  {
    id: 'printing', img: '/site/sections/a9.jpeg', icons: ['fa-cube', 'fa-layer-group', 'fa-headset'],
    ar: { tab: 'قسم الطباعة ثلاثية الأبعاد', desc: 'يحتوي هذا القسم على طابعات متنوعة ثلاثية الأبعاد بأحجام مختلفة ومزايا متعددة. استخدمها لطباعة تصاميمك الإبداعية وتحويل أفكارك إلى واقع ملموس.', features: ['طابعات عالية الدقة', 'مواد طباعة متنوعة', 'دعم فني متخصص'] },
    en: { tab: '3D Printing Section', desc: 'This section contains various 3D printers of different sizes and multiple features. Use them to print your creative designs and transform your ideas into tangible reality.', features: ['High-resolution printers', 'Variety of printing materials', 'Specialized technical support'] }
  },
  {
    id: 'carving', img: '/site/sections/a3.jpeg', icons: ['fa-hammer', 'fa-drafting-compass'],
    ar: { tab: 'قسم النحت والقطع', desc: 'يحتوى هذا القسم على الات النحت والقطع القادرة على قطع اخشاب والمواد الاخرى مثل البلاستيك و النحت عليها.', features: ['آلات نحت متقدمة', 'دعم للتصاميم الإبداعية'] },
    en: { tab: 'Carving and Cutting Section', desc: 'This section contains carving and cutting machines capable of cutting wood and other materials like plastic and engraving on them.', features: ['Advanced carving machines', 'Support for creative designs'] }
  },
  {
    id: 'laser', img: '/site/sections/a2.jpeg', icons: ['fa-bolt', 'fa-cut', 'fa-shield-alt'],
    ar: { tab: 'قسم الليزر للحرق والقص', desc: 'في هذا القسم تجد آلات القطع بالليزر التي تمكنك من قطع مواد مثل الخشب والبلاستيك والنحت على المعادن المطلية والجلد وغيرها.', features: ['آلات ليزر عالية الدقة', 'قطع ونحت متنوع', 'مواد آمنة ومتنوعة'] },
    en: { tab: 'Laser Cutting and Engraving Section', desc: "In this section, you'll find laser cutting machines that enable you to cut materials like wood, plastic, and engrave on coated metals, leather, and more.", features: ['High-precision laser machines', 'Variety of cutting and engraving', 'Safe and diverse materials'] }
  },
  {
    id: 'vinyl', img: '/site/sections/a7.jpeg', icons: ['fa-paint-brush', 'fa-palette', 'fa-id-badge'],
    ar: { tab: 'قسم القطع بالفينيل', desc: 'باستخدام آلات قطع الفينيل بإمكانك اعمالك الفنية إضافة لمسة جمالية لهوية مشروعك.', features: ['آلات قطع فينيل احترافية', 'أعمال فنية مخصصة', 'تعزيز هوية المشروع'] },
    en: { tab: 'Vinyl Cutting Section', desc: "Using vinyl cutting machines, you can add an artistic touch to your project's identity through your artistic works.", features: ['Professional vinyl cutting machines', 'Custom artistic works', 'Enhancing project identity'] }
  },
  {
    id: 'studio', img: '/site/sections/a6.jpeg', icons: ['fa-microphone', 'fa-video'],
    ar: { tab: 'قسم الاستوديو', desc: 'يحتوي هذا القسم على المعدات التي تمكنك من تسجيل محتواك الصوتي الخاص بك بالإضافة إلى أجهزة حاسوب بإمكانيات عالية لعمليات المونتاج والهندسة الصوتية وجدارية الكروما الخضراء للعزل في التصوير وإضاءات تصوير عالية الجودة.', features: ['تسجيل صوتي احترافي', 'كروما وإضاءات تصوير'] },
    en: { tab: 'Studio Section', desc: 'This section contains equipment that enables you to record your audio content, in addition to high-performance computers for editing and audio engineering, a green chroma wall for isolation in photography, and high-quality photography lighting.', features: ['Professional audio recording', 'Chroma and photography lighting'] }
  },
  {
    id: 'brainstorming', img: '/site/sections/a1.jpeg', icons: ['fa-chalkboard', 'fa-table', 'fa-users'],
    ar: { tab: 'غرفة العصف الذهني', desc: 'تقع هذه الغرفة في قلب فاب لاب الأحساء في هذه الغرفة بإمكانك أن تستغل كل جزء من الحوائط الزجاجية أو الطاولة الذكية لتفعيل العصف الذهني مع فريقك وتتناقش حول مشروعك.', features: ['حوائط زجاجية للكتابة', 'طاولة ذكية', 'جلسات فريقية'] },
    en: { tab: 'Brainstorming Room', desc: 'This room is located in the heart of FabLab Al-Ahsa. In this room, you can utilize every part of the glass walls or the smart table to activate brainstorming with your team and discuss your project.', features: ['Glass writing walls', 'Smart table', 'Team sessions'] }
  }
];

const SiteSections = () => {
  const { lang } = useSiteLang();
  const [active, setActive] = useState(SECTIONS[0].id);
  const sec = SECTIONS.find(s => s.id === active) || SECTIONS[0];
  const c = sec[lang];
  return (
    <SiteLayout className="site-sections">
      <PageHero
        title={lang === 'ar' ? 'أقسام فاب لاب الأحساء' : 'FabLab Al-Ahsa Sections'}
        intro={lang === 'ar'
          ? 'استكشف أقسامنا المتنوعة التي توفر أحدث التقنيات لدعم الابتكار والإبداع. اختر قسماً لمعرفة المزيد.'
          : 'Explore our diverse sections that provide the latest technologies to support innovation and creativity. Choose a section to learn more.'}
      >
        <div className="site-tabs" role="tablist">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active === s.id}
              className={`site-tab ${active === s.id ? 'on' : ''}`}
              onClick={() => setActive(s.id)}
            >
              {s[lang].tab}
            </button>
          ))}
        </div>
      </PageHero>

      <section className="site-section">
        <div className="site-container">
          <div className="site-panel site-section-detail" key={sec.id} role="tabpanel">
            <div className="site-section-img">
              <img src={sec.img} alt={c.tab} width="640" height="420" loading="lazy" />
            </div>
            <div className="site-section-info">
              <h2>{c.tab}</h2>
              <p>{c.desc}</p>
              <ul className="site-feature-list">
                {c.features.map((f, i) => (
                  <li key={f}><i className={`fas ${sec.icons[i] || 'fa-check'}`} aria-hidden="true" /> {f}</li>
                ))}
              </ul>
              <div className="site-btn-row">
                <Link to="/register" className="site-btn site-btn--primary">
                  <i className="fas fa-calendar-check" aria-hidden="true" /> {lang === 'ar' ? 'احجز موعداً في القسم' : 'Book this section'}
                </Link>
                <button type="button" className="site-btn site-btn--outline" onClick={() => scrollToId('contact')}>
                  <i className="fas fa-question-circle" aria-hidden="true" /> {lang === 'ar' ? 'استفسر عن القسم' : 'Inquire About the Section'}
                </button>
              </div>
            </div>
          </div>

          <div className="site-section-thumbs">
            {SECTIONS.map((s, i) => (
              <Reveal key={s.id} delay={(i % 4) * 60}>
                <button type="button" className={`site-section-thumb ${active === s.id ? 'on' : ''}`} onClick={() => { setActive(s.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <img src={s.img} alt="" loading="lazy" width="320" height="200" />
                  <span>{s[lang].tab}</span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};

export default SiteSections;
