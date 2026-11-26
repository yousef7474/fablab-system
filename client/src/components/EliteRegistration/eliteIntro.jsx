import React from 'react';

// The studio rail's intro for the Elite entry pages (login, registration).
export const ELITE_INTRO = (isRTL) => ({
  portal: isRTL ? 'برنامج النخبة' : 'Elite program',
  title: isRTL ? <>انضم إلى <em>النخبة</em><br />وطوّر مشروعك معنا</> : <>Join the <em>Elite</em><br />and grow your project with us</>,
  features: [
    { ar: 'دعم مالي وتقني وتعليمي', en: 'Financial, technical and educational support', d: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'] },
    { ar: 'عضوية لمدة سنة قابلة للتجديد', en: 'One-year membership, renewable', d: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'] },
    { ar: 'حساب خاص لمتابعة تقدمك', en: 'Your own account to follow your progress', d: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'] }
  ]
});
