import React from 'react';
import SiteLayout from './SiteLayout';
import { Reveal, SectionHeader } from './SiteParts';
import { useSiteLang, scrollToId } from './siteCore';
import './sitePages.css';

const C = {
  ar: {
    heroTitle: 'عن فاب لاب الأحساء',
    heroText: 'أول معمل تصنيع رقمي متكامل في الأحساء يتيح للمجتمع فرصة نمذجة مشاريعهم عبر أحدث آلات التصنيع الرقمي وبإشراف فريق تقني من الخبراء والمهندسين كما يقدم المعمل العديد من البرامج التدريبية التقنية',
    chips: [['fa-lightbulb', 'الابتكار'], ['fa-cogs', 'التصنيع'], ['fa-users', 'المجتمع']],
    discover: 'اكتشف رؤيتنا',
    valuesTitle: 'رسالتنا، رؤيتنا، وأهدافنا',
    valuesSub: 'أساسيات نجاحنا ومسيرتنا نحو التميز',
    mission: 'الرسالة',
    missionText: 'نشر ثقافة الإبداع والاختراع ومساعدة المجتمع في تحويل أفكارهم إلى منتجات عبر أحدث تقنيات التصنيع الرقمي المتواجدة في الفاب لاب',
    vision: 'الرؤية',
    visionText: 'أن يكون فاب لاب الأحساء وجهة التمكين الأولى للمبدعين والمبتكرين',
    goals: 'الأهداف',
    goalsList: [
      'نشر ثقافة التصنيع الرقمي والإبداع والاختراع',
      'تنفيذ مشاريع تسهم في حل بعض مشاكل المجتمع عبر تقنيات التصنيع الرقمي الحديثة',
      'عقد شراكات مع الجهات المهتمة بمجال الإبداع والاختراع',
      'توفير بيئة عمل آمنة بالفاب لاب',
      'تقديم برامج تدريبية نوعية في مجال التصنيع الرقمي'
    ],
    teamWord: 'كلمة فريق فاب لاب الأحساء',
    teamQuote: 'نسعى في فاب لاب الأحساء لنشر ثقافة التصنيع الرقمي في المجتمع وذلك عبر تدريب المهتمين على أحدث المعدات والآلات من خلال البرامج والمشاريع وورش العمل والمعسكرات التدريبية النوعية التي نقدمها بالتعاون مع فريقنا التطوعي',
    specializedTeam: 'فريق عمل متخصص',
    imgAlt: 'صورة فاب لاب الأحساء',
    teamAlt: 'فريق فاب لاب الأحساء'
  },
  en: {
    heroTitle: 'About FabLab Al-Ahsa',
    heroText: 'The first integrated digital manufacturing lab in Al-Ahsa that enables the community to prototype their projects using the latest digital manufacturing machines under the supervision of a technical team of experts and engineers. The lab also offers various technical training programs',
    chips: [['fa-lightbulb', 'Innovation'], ['fa-cogs', 'Manufacturing'], ['fa-users', 'Community']],
    discover: 'Discover Our Vision',
    valuesTitle: 'Our Mission, Vision, and Goals',
    valuesSub: 'The fundamentals of our success and our journey towards excellence',
    mission: 'Mission',
    missionText: 'Spreading the culture of creativity and invention and helping the community transform their ideas into products using the latest digital manufacturing technologies available in the FabLab',
    vision: 'Vision',
    visionText: 'To make FabLab Al-Ahsa the primary empowerment destination for creators and innovators',
    goals: 'Goals',
    goalsList: [
      'Spread the culture of digital manufacturing, creativity, and invention',
      'Implement projects that contribute to solving some community problems through modern digital manufacturing technologies',
      'Establish partnerships with entities interested in creativity and invention',
      'Provide a safe working environment in the FabLab',
      'Offer quality training programs in digital manufacturing'
    ],
    teamWord: 'A Word from the FabLab Al-Ahsa Team',
    teamQuote: 'We strive at FabLab Al-Ahsa to spread the culture of digital manufacturing in society by training interested individuals on the latest equipment and machines through programs, projects, workshops, and quality training camps that we offer in cooperation with our volunteer team',
    specializedTeam: 'A specialized team',
    imgAlt: 'FabLab Al-Ahsa',
    teamAlt: 'FabLab Al-Ahsa team'
  }
};

const SiteAbout = () => {
  const { lang, isRTL } = useSiteLang();
  const c = C[lang];
  return (
    <SiteLayout className="site-about">
      <section className="site-about-hero">
        <div className="site-container site-about-hero-grid">
          <Reveal className="site-about-hero-text">
            <h1>{c.heroTitle}</h1>
            <p>{c.heroText}</p>
            <div className="site-chips">
              {c.chips.map(([icon, label]) => (
                <span key={label} className="site-chip"><i className={`fas ${icon}`} aria-hidden="true" /> {label}</span>
              ))}
            </div>
            <button type="button" className="site-btn site-btn--primary" onClick={() => scrollToId('vision')}>
              {c.discover} <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'}`} aria-hidden="true" />
            </button>
          </Reveal>
          <Reveal className="site-about-hero-img" delay={150}>
            <img src="/site/fal.png" alt={c.imgAlt} width="520" height="420" loading="eager" />
          </Reveal>
        </div>
      </section>

      <section className="site-section" id="vision">
        <div className="site-container">
          <SectionHeader title={c.valuesTitle} subtitle={c.valuesSub} />
          <div className="site-values">
            <Reveal className="site-value-card">
              <span className="site-value-icon"><i className="fas fa-bullseye" aria-hidden="true" /></span>
              <h3>{c.mission}</h3>
              <p>{c.missionText}</p>
            </Reveal>
            <Reveal className="site-value-card" delay={100}>
              <span className="site-value-icon"><i className="fas fa-eye" aria-hidden="true" /></span>
              <h3>{c.vision}</h3>
              <p>{c.visionText}</p>
            </Reveal>
            <Reveal className="site-value-card" delay={200}>
              <span className="site-value-icon"><i className="fas fa-tasks" aria-hidden="true" /></span>
              <h3>{c.goals}</h3>
              <ul className="site-checklist">
                {c.goalsList.map(g => <li key={g}><i className="fas fa-check" aria-hidden="true" /> {g}</li>)}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <Reveal className="site-panel site-team">
            <img src="/site/fal2.png" alt={c.teamAlt} width="420" height="320" loading="lazy" />
            <div>
              <span className="site-kicker"><i className="fas fa-users" aria-hidden="true" /> {c.specializedTeam}</span>
              <h2>{c.teamWord}</h2>
              <blockquote>“{c.teamQuote}”</blockquote>
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
};

export default SiteAbout;
