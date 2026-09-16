const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Settings = sequelize.define('Settings', {
  key: {
    type: DataTypes.STRING(255),
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.JSON,
    allowNull: false
  }
}, {
  tableName: 'settings',
  timestamps: true
});

// Seed default working hours if they don't exist
Settings.seedDefaults = async () => {
  const defaults = [
    { key: 'working_hours_start', value: '11:00' },
    { key: 'working_hours_end', value: '19:00' },
    { key: 'working_days', value: [0, 1, 2, 3, 4] }, // Sunday=0 through Thursday=4
    // 3D printing service — per-gram material rates in SAR + fees.
    // Admin can edit these from the settings tab.
    { key: 'print3d_rate_pla',        value: 1.5 },
    { key: 'print3d_rate_petg',       value: 2.0 },
    { key: 'print3d_rate_tpu',        value: 3.0 },
    { key: 'print3d_setup_fee',       value: 15 },
    { key: 'print3d_multi_color_fee', value: 20 },
    { key: 'print3d_min_charge',      value: 25 }, // minimum charge per print
    { key: 'print3d_supported_files', value: ['stl', 'obj', '3mf', 'step', 'stp', 'ply', 'gcode', 'zip'] },
    // FabLab store category library — admin picks from this list when
    // adding a new item, or types a new one which gets appended here
    // for future use.
    { key: 'store_categories', value: [] },
    // Year Calendar preference — show the schedule overlay
    // (appointments + employee tasks) or keep it hidden. Universal
    // across all admin logins so any device honors the same choice.
    { key: 'calendar_show_schedule_overlay', value: true },
    // Bank account details for paid workshops (bank transfer channel).
    // Admin edits from Settings tab; customers see this on the
    // payment step and can copy per-line or all at once.
    { key: 'workshop_bank_account', value: {
      bankName:       'مصرف الراجحي',
      accountHolder:  'مؤسسة عبدالمنعم الراشد الإنسانية — فاب لاب الأحساء',
      iban:           'SA0000000000000000000000',
      additionalInfo: 'يرجى تحويل قيمة الورشة كاملة ثم رفع صورة إشعار التحويل.'
    }},
    // Mada in-store payment instructions (shown when customer picks
    // that method).
    { key: 'workshop_mada_info', value: {
      title:       'الدفع عبر مدى في مقر فاب لاب الأحساء',
      instructions: 'يمكنك الحضور إلى مقر فاب لاب الأحساء والدفع مباشرةً بواسطة بطاقة مدى، سيقوم فريق الإدارة بتفعيل تسجيلك فور الدفع.',
      address:     'فاب لاب الأحساء - مؤسسة عبدالمنعم الراشد الإنسانية'
    }},
    // Terms & conditions the customer must accept before payment.
    // Admin can edit this list from the Settings tab. Each entry is a
    // single Arabic string; the client renders them as a numbered
    // list.
    { key: 'workshop_terms', value: [
      // From the user (2026-09-16 kickoff)
      'لا يحق استرجاع المبلغ بعد الدفع والاشتراك في البرنامج إلا بموافقة المدير وتقديم الأسباب الواضحة للانسحاب واسترجاع المبلغ.',
      'إذا بدأ البرنامج فلا يحق للمستفيد استرجاع المبلغ أو جزء منه.',
      'لا يمكن التسجيل في نفس يوم بدء البرنامج إلا بموافقة المدير مع تقديم الأسباب الواضحة والكافية.',
      'من يقوم بالتسجيل وعمره لا يتناسب مع العمر المطلوب في إعلان البرنامج سيتم تنويه ولي الأمر واستبعاد المستفيد من البرنامج بسبب عدم تطابق الشروط واسترداد المبلغ له.',
      // Added to round out the policy
      'يشترط حضور ما لا يقل عن 80% من الجلسات لاستلام شهادة الحضور.',
      'يحق لفاب لاب الأحساء إعادة جدولة أو إلغاء البرنامج قبل بدايته، وفي هذه الحالة يتم إرجاع كامل المبلغ للمشترك.',
      'التأخر أكثر من 15 دقيقة عن موعد الجلسة قد يؤدي إلى عدم السماح بالحضور بناءً على تقدير المدرّب.',
      'يتحمل المشارك مسؤولية أي أضرار يتسبب بها للأجهزة أو المعدات خلال البرنامج.',
      'تُستخدم البيانات الشخصية المدخلة لأغراض تشغيل البرنامج فقط ولن يتم مشاركتها مع طرف ثالث.',
      'قد يتم التقاط صور أو مقاطع فيديو خلال الفعاليات لاستخدامها في نشرات فاب لاب الأحساء الإعلامية والدعائية.'
    ]},
    // Approver list used by both overtime and workshop-coupon flows.
    // Keeping it as a Setting makes it editable without a redeploy.
    { key: 'workshop_approvers', value: [
      'أ. زكي اللويم',
      'م. نوف البوعبيد',
      'أ. عبدالله الصفي',
      'أ. عبدالمحسن السلطان'
    ]}
  ];

  for (const setting of defaults) {
    await Settings.findOrCreate({
      where: { key: setting.key },
      defaults: { value: setting.value }
    });
  }
};

module.exports = Settings;
