import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';

// Pre-composed messages that admins paste into WhatsApp / SMS / email
// dozens of times a week. Kept as an inline library so admin can Copy
// with one click. Each has a title (search key), a full message body,
// and the primary URL called out separately for the "copy URL only"
// shortcut.

const TEMPLATES = [
  {
    id: 'project-feedback',
    title: 'استلام وتقييم المشروع',
    tag: 'مشاريع',
    color: '#EE2329',
    url: 'https://forms.gle/N4aNMLkcdHQ25Cm97',
    body: `السلام عليكم ورحمة الله وبركاته

حيّاكم الله،

يسرّنا في *فاب لاب الأحساء* — مؤسسة عبدالمنعم الراشد الإنسانية، أن نهنئكم على إتمام مشروعكم بنجاح، ونشكر لكم ثقتكم واختياركم لنا شريكًا في رحلة تنفيذه.

وحرصًا منّا على توثيق المشروع وتطوير خدماتنا، نأمل منكم تعبئة *نموذج استلام وإتمام وتقييم المشروع* عبر الرابط التالي:

https://forms.gle/N4aNMLkcdHQ25Cm97

📌 لا تستغرق التعبئة أكثر من 5 دقائق.
📸 يُرجى إرفاق صور واضحة للمشروع لاعتماد التوثيق.
💬 آراؤكم وملاحظاتكم محل تقدير، وتُسهم في تحسين خدماتنا مستقبلًا.

نتمنى لكم دوام التوفيق والنجاح، وسعدنا بخدمتكم.
فاب لاب الأحساء | مؤسسة عبدالمنعم الراشد الإنسانية`
  },
  {
    id: 'appointment-booking',
    title: 'حجز موعد',
    tag: 'حجوزات',
    color: '#2563eb',
    url: 'https://fablabsahsa.com/',
    body: `تحية طيبة وبعد،

نود إفادتكم بأنه في حال حاجتكم إلى أي مساعدة أو استشارة داخل فاب لاب، يُرجى حجز موعد مسبق عبر منصتنا الإلكترونية ليتم جدولة الموعد وتخصيص الفريق المناسب لخدمتكم.

يرجى التسجيل/تسجيل الدخول ثم اختيار خدمة حجز موعد وتحديد نوع الطلب والوقت المناسب عبر الرابط التالي:
https://fablabsahsa.com/

سيتم إرسال تأكيد الموعد وتفاصيله إلى بريدكم الإلكتروني بعد إتمام عملية الحجز.

نثمّن تعاونكم، ونسعد بخدمتكم.

وتفضلوا بقبول فائق الاحترام،
فاب لاب — فريق خدمة المستفيدين`
  },
  {
    id: 'service-feedback',
    title: 'تقييم الخدمة',
    tag: 'تقييم',
    color: '#16a34a',
    url: 'https://forms.gle/cxtnJjtZbwRyYvC48',
    body: `تحية طيبة وبعد،

انطلاقًا من حرص فاب لاب على تحسين جودة الخدمات وتطويرها باستمرار، نأمل منكم التكرّم بتعبئة نموذج تقييم الخدمة التي قُدِّمت لكم مؤخرًا. يسهم تقييمكم في قياس رضاكم وتحديد مجالات التحسين.

يرجى الدخول إلى نموذج التقييم عبر الرابط التالي:
https://forms.gle/cxtnJjtZbwRyYvC48

نؤكّد أن جميع البيانات ستُعامل بسرية تامة، وتستخدم لأغراض التطوير والتحسين فقط.
شاكرين لكم وقتكم وتعاونكم.

وتفضلوا بقبول فائق الاحترام،
فاب لاب — فريق خدمة المستفيدين`
  }
];

const copyToClipboard = async (text, successMsg, isRTL) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMsg);
  } catch {
    // Fallback for browsers that block clipboard API on non-HTTPS
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast.success(successMsg);
    } catch {
      window.prompt(isRTL ? 'انسخ يدوياً:' : 'Copy manually:', text);
    }
    ta.remove();
  }
};

const QuickMessages = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TEMPLATES;
    return TEMPLATES.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.tag.toLowerCase().includes(q) ||
      t.body.toLowerCase().includes(q)
    );
  }, [search]);

  const toggleExpanded = (id) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          margin: '0 0 6px', fontSize: 24, fontWeight: 800,
          color: 'var(--text-primary, #0f172a)'
        }}>
          💬 {isRTL ? 'رسائل جاهزة' : 'Quick Messages'}
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)', fontSize: 13 }}>
          {isRTL
            ? 'رسائل ورسائل جاهزة للنسخ واللصق في واتساب أو البريد. اضغط "نسخ الرسالة" لأخذ النص كاملاً، أو "نسخ الرابط" للحصول على الرابط فقط.'
            : 'Ready-made messages to copy-paste into WhatsApp or email. Click "Copy message" for the full text, or "Copy link" for just the URL.'}
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={isRTL ? 'بحث في الرسائل...' : 'Search messages...'}
        style={{
          width: '100%', maxWidth: 480,
          padding: '10px 14px', borderRadius: 10,
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--card-bg, #fff)',
          color: 'var(--text-primary, #0f172a)',
          fontFamily: 'inherit', fontSize: 14,
          marginBottom: 20
        }}
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 16
      }}>
        {filtered.map(t => {
          const isExpanded = expanded.has(t.id);
          return (
            <div
              key={t.id}
              style={{
                background: 'var(--card-bg, #fff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: 14,
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                borderInlineStart: `4px solid ${t.color}`
              }}
            >
              {/* Header */}
              <div style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, flexWrap: 'wrap'
              }}>
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: t.color,
                    letterSpacing: 0.5, textTransform: 'uppercase'
                  }}>
                    {t.tag}
                  </div>
                  <div style={{
                    marginTop: 2, fontSize: 16, fontWeight: 700,
                    color: 'var(--text-primary, #0f172a)'
                  }}>
                    {t.title}
                  </div>
                </div>
                <span
                  title={t.url}
                  style={{
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    fontSize: 11, color: t.color,
                    background: t.color + '11',
                    border: `1px solid ${t.color}33`,
                    padding: '3px 8px', borderRadius: 999,
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    direction: 'ltr'
                  }}
                >
                  🔗 {t.url.replace(/^https?:\/\//, '')}
                </span>
              </div>

              {/* Preview / full */}
              <div style={{
                padding: '14px 18px',
                flex: 1,
                background: 'var(--bg-secondary, #f8fafc)',
                fontSize: 13, lineHeight: 1.7,
                color: 'var(--text-secondary, #475569)',
                whiteSpace: 'pre-wrap',
                maxHeight: isExpanded ? 'none' : 140,
                overflow: 'hidden',
                position: 'relative'
              }}>
                {t.body}
                {!isExpanded && (
                  <div style={{
                    position: 'absolute', inset: 'auto 0 0 0',
                    height: 50,
                    background: 'linear-gradient(180deg, transparent, var(--bg-secondary, #f8fafc))'
                  }} />
                )}
              </div>

              {/* Actions */}
              <div style={{
                padding: 12,
                display: 'flex', gap: 8, flexWrap: 'wrap',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                background: 'var(--card-bg, #fff)'
              }}>
                <button
                  onClick={() => copyToClipboard(
                    t.body,
                    isRTL ? '✅ تم نسخ الرسالة' : '✅ Message copied',
                    isRTL
                  )}
                  style={{
                    flex: '1 1 140px',
                    padding: '10px 14px',
                    borderRadius: 8, border: 'none',
                    background: t.color, color: '#fff',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  📋 {isRTL ? 'نسخ الرسالة' : 'Copy message'}
                </button>
                <button
                  onClick={() => copyToClipboard(
                    t.url,
                    isRTL ? '🔗 تم نسخ الرابط' : '🔗 Link copied',
                    isRTL
                  )}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8, border: `1px solid ${t.color}55`,
                    background: t.color + '11', color: t.color,
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  🔗 {isRTL ? 'نسخ الرابط' : 'Copy link'}
                </button>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8, border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'var(--card-bg, #fff)', color: 'var(--text-primary, #334155)',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                    textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}
                >
                  ↗ {isRTL ? 'فتح' : 'Open'}
                </a>
                <button
                  onClick={() => toggleExpanded(t.id)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8, border: '1px solid var(--border-color, #cbd5e1)',
                    background: 'transparent', color: 'var(--text-secondary, #64748b)',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  {isExpanded
                    ? (isRTL ? 'إخفاء' : 'Collapse')
                    : (isRTL ? 'عرض كامل' : 'Expand')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center',
          color: 'var(--text-secondary, #94a3b8)',
          background: 'var(--card-bg, #fff)',
          border: '1px dashed var(--border-color, #e2e8f0)',
          borderRadius: 12
        }}>
          {isRTL ? 'لا توجد نتائج مطابقة.' : 'No matching messages.'}
        </div>
      )}
    </div>
  );
};

export default QuickMessages;
