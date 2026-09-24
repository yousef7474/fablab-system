import React from 'react';

// Single source of truth for the FabLab sections shown on the
// registration form (FablabSection step) and in the "help me choose"
// guide. `value` must match the Registration.fablabSection enum.
//
// `keywords` drive matchSections(): plain words people actually type
// when describing an idea ("روبوت يتبع الخط", "ملصقات لمحلي"). Keywords
// of 3 characters or fewer only match whole words, so "رف" (shelf)
// doesn't fire inside "معرفة".
export const SECTIONS = [
  {
    value: 'Electronics and Programming',
    labelEn: 'Electronics & Programming',
    labelAr: 'الإلكترونيات والبرمجة',
    descAr: 'دوائر كهربائية، أردوينو، حساسات، برمجة وتطبيقات، إنترنت الأشياء',
    descEn: 'Circuits, Arduino, sensors, coding & apps, IoT',
    keywords: ['الكترون', 'electronic', 'دائره', 'دوائر', 'circuit', 'اردوينو', 'arduino', 'حساس', 'سنسور', 'sensor',
      'برمج', 'programming', 'كود', 'code', 'esp32', 'esp', 'راسبيري', 'raspberry', 'انترنت الاشياء', 'iot', 'لحام',
      'pcb', 'بطاريه', 'ليد', 'led', 'تطبيق', 'app', 'بايثون', 'python', 'مايكرو', 'micro', 'كهرب'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
        <rect x="9" y="9" width="6" height="6"/>
        <line x1="9" y1="1" x2="9" y2="4"/>
        <line x1="15" y1="1" x2="15" y2="4"/>
        <line x1="9" y1="20" x2="9" y2="23"/>
        <line x1="15" y1="20" x2="15" y2="23"/>
        <line x1="20" y1="9" x2="23" y2="9"/>
        <line x1="20" y1="14" x2="23" y2="14"/>
        <line x1="1" y1="9" x2="4" y2="9"/>
        <line x1="1" y1="14" x2="4" y2="14"/>
      </svg>
    )
  },
  {
    value: 'Robotic and AI',
    labelEn: 'Robotics & AI',
    labelAr: 'الروبوتات والذكاء الاصطناعي',
    descAr: 'روبوتات، ذكاء اصطناعي، رؤية حاسوبية، محركات وأنظمة تحكم',
    descEn: 'Robots, AI, computer vision, motors & control',
    keywords: ['روبوت', 'robot', 'ذكاء اصطناعي', 'ذكاء', 'ai', 'تعلم اله', 'تعلم الي', 'machine learning', 'رؤيه حاسوبيه',
      'كاميرا', 'camera', 'درون', 'drone', 'طائره', 'سيرفو', 'servo', 'محرك', 'motor', 'تتبع', 'يتبع الخط', 'line follower',
      'ذراع', 'arm', 'سومو', 'sumo', 'شات بوت', 'chatbot'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <circle cx="12" cy="5" r="3"/>
        <line x1="12" y1="8" x2="12" y2="11"/>
        <line x1="8" y1="16" x2="8" y2="16"/>
        <line x1="16" y1="16" x2="16" y2="16"/>
      </svg>
    )
  },
  {
    value: '3D',
    labelEn: '3D Printing',
    labelAr: 'الطباعة ثلاثية الأبعاد',
    descAr: 'نماذج أولية، قطع ومجسمات بلاستيكية، تصميم ثلاثي الأبعاد',
    descEn: 'Prototypes, plastic parts & models, 3D design',
    keywords: ['ثلاثي', '3d', 'مجسم', 'نموذج اولي', 'بروتوتايب', 'prototype', 'stl', 'فيوجن', 'fusion', 'تينكركاد',
      'tinkercad', 'بلندر', 'blender', 'بلاستيك', 'plastic', 'فلامنت', 'filament'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    )
  },
  {
    value: 'CNC Laser',
    labelEn: 'CNC Laser',
    labelAr: 'الليزر CNC',
    descAr: 'قص وحفر ونقش على الأكريليك والخشب الرقيق والجلد والكرتون',
    descEn: 'Cutting & engraving acrylic, thin wood, leather, cardboard',
    keywords: ['ليزر', 'laser', 'قص', 'حفر', 'نقش', 'engrav', 'اكريليك', 'acrylic', 'جلد', 'leather', 'كرتون',
      'cardboard', 'mdf', 'ام دي اف', 'دروع', 'درع', 'ميداليه'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <line x1="12" y1="2" x2="12" y2="6"/>
        <line x1="12" y1="18" x2="12" y2="22"/>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
        <line x1="2" y1="12" x2="6" y2="12"/>
        <line x1="18" y1="12" x2="22" y2="12"/>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
      </svg>
    )
  },
  {
    value: 'CNC Wood',
    labelEn: 'CNC Wood',
    labelAr: 'الخشب CNC',
    descAr: 'أثاث وألواح خشبية كبيرة، نحت وتفريغ الخشب',
    descEn: 'Furniture, large wood panels, carving',
    keywords: ['خشب', 'wood', 'اثاث', 'furniture', 'نجاره', 'طاوله', 'table', 'كرسي', 'chair', 'رف', 'shelf',
      'دولاب', 'باب', 'نحت', 'راوتر', 'router', 'بلايوود', 'plywood'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22c4-4 8-7 8-12a8 8 0 1 0-16 0c0 5 4 8 8 12z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    )
  },
  {
    value: 'CNC Metal',
    labelEn: 'CNC Metal',
    labelAr: 'المعادن CNC',
    descAr: 'قطع ومكونات معدنية، ألمنيوم وحديد، تفريز وخراطة',
    descEn: 'Metal parts, aluminum & steel, milling',
    keywords: ['معدن', 'معادن', 'metal', 'حديد', 'iron', 'المنيوم', 'الومنيوم', 'aluminum', 'aluminium', 'ستيل',
      'steel', 'فولاذ', 'خراطه', 'تفريز', 'milling', 'نحاس', 'copper'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    )
  },
  {
    value: "Kid's Club",
    labelEn: "Kid's Club",
    labelAr: 'نادي الأطفال',
    descAr: 'أنشطة وتجارب تعليمية ممتعة للأطفال',
    descEn: 'Fun hands-on learning for kids',
    keywords: ['طفل', 'اطفال', 'ولدي', 'بنتي', 'ابني', 'kid', 'kids', 'child', 'children', 'صغار'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    )
  },
  {
    value: 'Vinyl Cutting',
    labelEn: 'Vinyl Cutting',
    labelAr: 'قص الفينيل',
    descAr: 'ملصقات مقصوصة، شعارات وكتابات، طباعة حرارية على الملابس',
    descEn: 'Cut stickers, logos & lettering, heat-press on clothes',
    keywords: ['فينيل', 'vinyl', 'ستيكر', 'استيكر', 'sticker', 'ملصق', 'تيشيرت', 'تي شيرت', 'shirt', 'ملابس',
      'حراري', 'heat', 'شعار', 'logo', 'لافته', 'واجهه'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <line x1="20" y1="4" x2="8.12" y2="15.88"/>
        <line x1="14.47" y1="14.48" x2="20" y2="20"/>
        <line x1="8.12" y1="8.12" x2="12" y2="12"/>
      </svg>
    )
  },
  {
    value: 'UV Printing and Sticker Making',
    labelEn: 'UV Printing & Stickers',
    labelAr: 'الطباعة بالأشعة فوق البنفسجية والملصقات',
    descAr: 'طباعة ملونة مباشرة على الأكواب والأغطية واللوحات والهدايا، وملصقات ملونة',
    descEn: 'Full-color printing on mugs, cases, signs & gifts; color stickers',
    keywords: ['uv', 'يو في', 'طباعه ملونه', 'طباعه على', 'كوب', 'اكواب', 'mug', 'كفر', 'جوال', 'phone case',
      'هدايا', 'هديه', 'gift', 'ملصق', 'sticker', 'ستيكر', 'بطاقه', 'كروت', 'card', 'لوحه', 'اقلام'],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="12" rx="2" ry="2"/>
        <path d="M7 16v4h10v-4"/>
        <line x1="7" y1="8" x2="17" y2="8"/>
        <line x1="7" y1="12" x2="13" y2="12"/>
      </svg>
    )
  }
];

export const SECTION_BY_VALUE = Object.fromEntries(SECTIONS.map(s => [s.value, s]));

// Service values — must match RequiredService.jsx / the server.
export const SERVICE_LABELS = {
  'In-person consultation': { ar: 'استشارة حضورية', en: 'In-person consultation' },
  'Online consultation': { ar: 'استشارة عن بعد', en: 'Online consultation' },
  'Machine/Device reservation': { ar: 'حجز جهاز / آلة', en: 'Machine/device reservation' }
};

// Fold Arabic spelling variants so "الأردوينو" matches "اردوينو".
export function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIXES = ['وال', 'بال', 'لل', 'ال', 'و', 'ب'];

function tokenSet(text) {
  const set = new Set();
  text.split(/[^0-9a-z؀-ۿ]+/).filter(Boolean).forEach(tok => {
    set.add(tok);
    PREFIXES.forEach(p => {
      if (tok.startsWith(p) && tok.length > p.length + 1) set.add(tok.slice(p.length));
    });
  });
  return set;
}

// Rank sections against free text. Returns [{ section, score }] with
// score > 0, best first. Longer keywords weigh more (more specific).
export function matchSections(text) {
  const norm = normalizeText(text);
  if (norm.length < 2) return [];
  const tokens = tokenSet(norm);
  const results = SECTIONS.map(section => {
    let score = 0;
    section.keywords.forEach(raw => {
      const kw = normalizeText(raw);
      const hit = kw.length <= 3 ? tokens.has(kw) : norm.includes(kw);
      if (hit) score += kw.length >= 5 ? 2 : 1;
    });
    return { section, score };
  }).filter(r => r.score > 0);
  results.sort((a, b) => b.score - a.score);
  return results;
}
