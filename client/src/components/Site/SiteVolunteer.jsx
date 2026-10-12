import React from 'react';
import { Link } from 'react-router-dom';
import SiteLayout from './SiteLayout';
import { PageHero, Reveal, SectionHeader } from './SiteParts';
import { useSiteLang } from './siteCore';
import './sitePages.css';

const REGISTER = '/register?type=Volunteer';

const C = {
  ar: {
    title: 'التطوع في فاب لاب الأحساء',
    intro: 'كن جزءاً من فريقنا التطوعي وساهم معنا في نشر ثقافة التصنيع الرقمي والإبداع والاختراع في مجتمع الأحساء، واكتسب خبرة عملية في بيئة تقنية ملهمة.',
    cta: 'سجّل كمتطوع',
    whyTitle: 'لماذا تتطوع معنا؟',
    whySub: 'تجربة تطوعية تجمع بين التعلم والعطاء',
    why: [
      ['fa-tools', 'خبرة عملية', 'تعرّف على آلات التصنيع الرقمي واكتسب خبرة عملية من خلال المشاركة في البرامج والمشاريع.'],
      ['fa-chart-line', 'تطوير المهارات', 'طوّر مهاراتك التقنية والقيادية ومهارات العمل ضمن فريق والتواصل مع الجمهور.'],
      ['fa-users', 'شبكة علاقات', 'تعرّف على مبدعين ومبتكرين ومهتمين بالتقنية من مختلف الخلفيات.'],
      ['fa-heart', 'أثر مجتمعي', 'ساهم في تمكين أفراد المجتمع وتحويل أفكارهم إلى منتجات حقيقية.'],
      ['fa-certificate', 'توثيق المشاركة', 'تُوثَّق مشاركتك التطوعية وتحصل على شهادة تقدير لجهودك.'],
      ['fa-lightbulb', 'بيئة ملهمة', 'اعمل في بيئة محفزة للإبداع داخل معامل فاب لاب الأحساء.']
    ],
    areasTitle: 'مجالات التطوع',
    areasSub: 'اختر المجال الذي يناسب اهتماماتك ومهاراتك',
    areas: [
      ['fa-calendar-alt', 'تنظيم الفعاليات والورش'],
      ['fa-cogs', 'الدعم الفني في المعامل'],
      ['fa-chalkboard-teacher', 'التدريب والإرشاد'],
      ['fa-camera', 'الإعلام والتصوير وصناعة المحتوى'],
      ['fa-pen-nib', 'التصميم والجرافيك'],
      ['fa-concierge-bell', 'الاستقبال وخدمة الزوار']
    ],
    stepsTitle: 'كيف تنضم إلينا؟',
    steps: [
      ['سجّل طلبك', 'عبّئ نموذج التسجيل واختر نوع الطلب «متطوع».'],
      ['مراجعة الطلب', 'يراجع فريق فاب لاب الأحساء طلبك.'],
      ['التواصل معك', 'نتواصل معك لتحديد مجال التطوع والأوقات المناسبة.'],
      ['ابدأ رحلتك', 'انطلق في تجربتك التطوعية مع فريقنا.']
    ],
    bandTitle: 'جاهز لتكون جزءاً من الفريق؟',
    bandText: 'سجّل الآن كمتطوع وسنتواصل معك قريباً.'
  },
  en: {
    title: 'Volunteering at FabLab Al-Ahsa',
    intro: 'Join our volunteer team and help us spread the culture of digital fabrication, creativity and invention in the Al-Ahsa community — while gaining hands-on experience in an inspiring technical environment.',
    cta: 'Register as a Volunteer',
    whyTitle: 'Why volunteer with us?',
    whySub: 'A volunteering experience that combines learning and giving',
    why: [
      ['fa-tools', 'Hands-on experience', 'Get to know digital fabrication machines and gain practical experience by taking part in programs and projects.'],
      ['fa-chart-line', 'Skill building', 'Develop your technical and leadership skills, teamwork and public communication.'],
      ['fa-users', 'Networking', 'Meet creators, innovators and tech enthusiasts from many backgrounds.'],
      ['fa-heart', 'Community impact', 'Help empower people in the community to turn their ideas into real products.'],
      ['fa-certificate', 'Recognition', 'Your volunteering is documented and you receive a certificate of appreciation.'],
      ['fa-lightbulb', 'Inspiring environment', 'Work in a creativity-boosting environment inside the FabLab Al-Ahsa labs.']
    ],
    areasTitle: 'Volunteering areas',
    areasSub: 'Choose the area that fits your interests and skills',
    areas: [
      ['fa-calendar-alt', 'Organizing events and workshops'],
      ['fa-cogs', 'Technical support in the labs'],
      ['fa-chalkboard-teacher', 'Training and mentoring'],
      ['fa-camera', 'Media, photography and content creation'],
      ['fa-pen-nib', 'Design and graphics'],
      ['fa-concierge-bell', 'Reception and visitor services']
    ],
    stepsTitle: 'How to join',
    steps: [
      ['Register', 'Fill in the registration form and choose the “Volunteer” application type.'],
      ['Review', 'The FabLab Al-Ahsa team reviews your application.'],
      ['We contact you', 'We get in touch to agree on your volunteering area and schedule.'],
      ['Start your journey', 'Begin your volunteering experience with our team.']
    ],
    bandTitle: 'Ready to join the team?',
    bandText: 'Register as a volunteer now and we will contact you soon.'
  }
};

const SiteVolunteer = () => {
  const { lang } = useSiteLang();
  const c = C[lang];
  return (
    <SiteLayout className="site-volunteer">
      <PageHero title={c.title} intro={c.intro}>
        <Link to={REGISTER} className="site-btn site-btn--primary site-page-cta">
          <i className="fas fa-hands-helping" aria-hidden="true" /> {c.cta}
        </Link>
      </PageHero>

      <section className="site-section">
        <div className="site-container">
          <SectionHeader title={c.whyTitle} subtitle={c.whySub} />
          <div className="site-feature-grid">
            {c.why.map(([icon, title, text], i) => (
              <Reveal key={icon} className="site-feature-card" delay={(i % 3) * 90}>
                <span className="site-feature-icon"><i className={`fas ${icon}`} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <Reveal className="site-panel">
            <SectionHeader title={c.areasTitle} subtitle={c.areasSub} tone="blue" />
            <div className="site-area-grid">
              {c.areas.map(([icon, label]) => (
                <div key={icon} className="site-area"><i className={`fas ${icon}`} aria-hidden="true" /> <span>{label}</span></div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <SectionHeader title={c.stepsTitle} tone="amber" />
          <ol className="site-steps">
            {c.steps.map(([title, text], i) => (
              <Reveal as="li" key={title} className="site-step" delay={i * 90}>
                <span className="site-step-num">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal className="site-cta-band">
            <div>
              <h3>{c.bandTitle}</h3>
              <p>{c.bandText}</p>
            </div>
            <Link to={REGISTER} className="site-btn site-btn--primary">
              <i className="fas fa-hands-helping" aria-hidden="true" /> {c.cta}
            </Link>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
};

export default SiteVolunteer;
