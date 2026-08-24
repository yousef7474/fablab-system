const { Settings } = require('../models');
const { findActiveOverrideForDate } = require('./workingHoursOverrideController');

// GET /api/settings/working-hours (public)
const getWorkingHours = async (req, res) => {
  try {
    const { date } = req.query;

    // If a date is provided, check for an active override
    if (date) {
      const override = await findActiveOverrideForDate(date);
      if (override) {
        return res.json({
          startTime: override.startTime,
          endTime: override.endTime,
          workingDays: override.workingDays,
          isOverride: true,
          override: {
            overrideId: override.overrideId,
            labelEn: override.labelEn,
            labelAr: override.labelAr,
            startDate: override.startDate,
            endDate: override.endDate
          }
        });
      }
    }

    // Default working hours
    const startTime = await Settings.findByPk('working_hours_start');
    const endTime = await Settings.findByPk('working_hours_end');
    const workingDays = await Settings.findByPk('working_days');

    res.json({
      startTime: startTime ? startTime.value : '11:00',
      endTime: endTime ? endTime.value : '19:00',
      workingDays: workingDays ? workingDays.value : [0, 1, 2, 3, 4]
    });
  } catch (error) {
    console.error('Error fetching working hours:', error);
    res.status(500).json({ message: 'Error fetching working hours' });
  }
};

// PUT /api/settings/working-hours (admin-protected)
const updateWorkingHours = async (req, res) => {
  try {
    const { startTime, endTime, workingDays } = req.body;

    // Validate startTime and endTime format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ message: 'Invalid time format. Use HH:mm.' });
    }

    // Validate startTime < endTime
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'Start time must be before end time.' });
    }

    // Validate workingDays is an array of numbers 0-6
    if (!Array.isArray(workingDays) || workingDays.length === 0 ||
        !workingDays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return res.status(400).json({ message: 'Working days must be an array of integers 0-6.' });
    }

    await Settings.upsert({ key: 'working_hours_start', value: startTime });
    await Settings.upsert({ key: 'working_hours_end', value: endTime });
    await Settings.upsert({ key: 'working_days', value: workingDays });

    res.json({
      message: 'Working hours updated successfully',
      startTime,
      endTime,
      workingDays
    });
  } catch (error) {
    console.error('Error updating working hours:', error);
    res.status(500).json({ message: 'Error updating working hours' });
  }
};

// GET /api/settings/registration-status (public)
const getRegistrationStatus = async (req, res) => {
  try {
    const disabled = await Settings.findByPk('registration_disabled');
    const reason = await Settings.findByPk('registration_disabled_reason');

    res.json({
      disabled: disabled ? disabled.value : false,
      reason: reason ? reason.value : ''
    });
  } catch (error) {
    console.error('Error fetching registration status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/settings/registration-status (admin-protected)
const updateRegistrationStatus = async (req, res) => {
  try {
    const { disabled, reason } = req.body;

    await Settings.upsert({ key: 'registration_disabled', value: !!disabled });
    await Settings.upsert({ key: 'registration_disabled_reason', value: reason || '' });

    res.json({
      message: disabled ? 'Registration disabled' : 'Registration enabled',
      disabled: !!disabled,
      reason: reason || ''
    });
  } catch (error) {
    console.error('Error updating registration status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/settings/store-status (public — used by StorePage to disable checkout)
const getStoreStatus = async (req, res) => {
  try {
    const disabled = await Settings.findByPk('store_disabled');
    const reason = await Settings.findByPk('store_disabled_reason');
    res.json({
      disabled: disabled ? !!disabled.value : false,
      reason: reason ? reason.value : ''
    });
  } catch (error) {
    console.error('Error fetching store status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/settings/store-status (admin-protected)
const updateStoreStatus = async (req, res) => {
  try {
    const { disabled, reason } = req.body;
    await Settings.upsert({ key: 'store_disabled', value: !!disabled });
    await Settings.upsert({ key: 'store_disabled_reason', value: reason || '' });
    res.json({
      message: disabled ? 'Store disabled' : 'Store enabled',
      disabled: !!disabled,
      reason: reason || ''
    });
  } catch (error) {
    console.error('Error updating store status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/settings/calendar-prefs (admin-protected)
// Universal admin preference for the Year Calendar. When
// showScheduleOverlay is false the calendar hides the auto-generated
// appointment + employee-task overlay so it doesn't feel over-filled.
const getCalendarPrefs = async (req, res) => {
  try {
    const overlay = await Settings.findByPk('calendar_show_schedule_overlay');
    res.json({
      showScheduleOverlay: overlay ? !!overlay.value : true
    });
  } catch (error) {
    console.error('Error fetching calendar prefs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/settings/calendar-prefs (admin-protected)
const updateCalendarPrefs = async (req, res) => {
  try {
    const { showScheduleOverlay } = req.body || {};
    if (showScheduleOverlay !== undefined) {
      await Settings.upsert({
        key: 'calendar_show_schedule_overlay',
        value: !!showScheduleOverlay
      });
    }
    res.json({ showScheduleOverlay: !!showScheduleOverlay });
  } catch (error) {
    console.error('Error updating calendar prefs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/settings/quick-messages (admin-protected)
// Returns the editable Quick Messages template library. Falls back
// to the hardcoded seed defaults when the row hasn't been set yet.
const QUICK_MESSAGES_DEFAULTS = [
  {
    id: 'project-feedback',
    title: 'استلام وتقييم المشروع',
    tag: 'مشاريع',
    color: '#EE2329',
    url: 'https://forms.gle/N4aNMLkcdHQ25Cm97',
    body: `السلام عليكم ورحمة الله وبركاته\n\nحيّاكم الله،\n\nيسرّنا في *فاب لاب الأحساء* — مؤسسة عبدالمنعم الراشد الإنسانية، أن نهنئكم على إتمام مشروعكم بنجاح، ونشكر لكم ثقتكم واختياركم لنا شريكًا في رحلة تنفيذه.\n\nوحرصًا منّا على توثيق المشروع وتطوير خدماتنا، نأمل منكم تعبئة *نموذج استلام وإتمام وتقييم المشروع* عبر الرابط التالي:\n\nhttps://forms.gle/N4aNMLkcdHQ25Cm97\n\n📌 لا تستغرق التعبئة أكثر من 5 دقائق.\n📸 يُرجى إرفاق صور واضحة للمشروع لاعتماد التوثيق.\n💬 آراؤكم وملاحظاتكم محل تقدير، وتُسهم في تحسين خدماتنا مستقبلًا.\n\nنتمنى لكم دوام التوفيق والنجاح، وسعدنا بخدمتكم.\nفاب لاب الأحساء | مؤسسة عبدالمنعم الراشد الإنسانية`
  },
  {
    id: 'appointment-booking',
    title: 'حجز موعد',
    tag: 'حجوزات',
    color: '#2563eb',
    url: 'https://fablabsahsa.com/',
    body: `تحية طيبة وبعد،\n\nنود إفادتكم بأنه في حال حاجتكم إلى أي مساعدة أو استشارة داخل فاب لاب، يُرجى حجز موعد مسبق عبر منصتنا الإلكترونية ليتم جدولة الموعد وتخصيص الفريق المناسب لخدمتكم.\n\nيرجى التسجيل/تسجيل الدخول ثم اختيار خدمة حجز موعد وتحديد نوع الطلب والوقت المناسب عبر الرابط التالي:\nhttps://fablabsahsa.com/\n\nسيتم إرسال تأكيد الموعد وتفاصيله إلى بريدكم الإلكتروني بعد إتمام عملية الحجز.\n\nنثمّن تعاونكم، ونسعد بخدمتكم.\n\nوتفضلوا بقبول فائق الاحترام،\nفاب لاب — فريق خدمة المستفيدين`
  },
  {
    id: 'service-feedback',
    title: 'تقييم الخدمة',
    tag: 'تقييم',
    color: '#16a34a',
    url: 'https://forms.gle/cxtnJjtZbwRyYvC48',
    body: `تحية طيبة وبعد،\n\nانطلاقًا من حرص فاب لاب على تحسين جودة الخدمات وتطويرها باستمرار، نأمل منكم التكرّم بتعبئة نموذج تقييم الخدمة التي قُدِّمت لكم مؤخرًا. يسهم تقييمكم في قياس رضاكم وتحديد مجالات التحسين.\n\nيرجى الدخول إلى نموذج التقييم عبر الرابط التالي:\nhttps://forms.gle/cxtnJjtZbwRyYvC48\n\nنؤكّد أن جميع البيانات ستُعامل بسرية تامة، وتستخدم لأغراض التطوير والتحسين فقط.\nشاكرين لكم وقتكم وتعاونكم.\n\nوتفضلوا بقبول فائق الاحترام،\nفاب لاب — فريق خدمة المستفيدين`
  }
];

const getQuickMessages = async (req, res) => {
  try {
    const row = await Settings.findByPk('quick_messages');
    const messages = row && Array.isArray(row.value) ? row.value : QUICK_MESSAGES_DEFAULTS;
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching quick messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateQuickMessages = async (req, res) => {
  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ message: 'messages must be an array' });
    }
    // Sanitize each entry — coerce strings, trim, keep only known fields.
    const cleaned = messages.map((m, i) => ({
      id: (m && String(m.id || '').trim()) || `msg-${Date.now()}-${i}`,
      title: String(m?.title || '').trim(),
      tag: String(m?.tag || '').trim(),
      color: String(m?.color || '#0ea5e9').trim(),
      url: String(m?.url || '').trim(),
      body: String(m?.body || '')
    })).filter(m => m.title || m.body); // drop empty rows

    await Settings.upsert({ key: 'quick_messages', value: cleaned });
    res.json({ messages: cleaned });
  } catch (error) {
    console.error('Error updating quick messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getWorkingHours,
  updateWorkingHours,
  getRegistrationStatus,
  updateRegistrationStatus,
  getStoreStatus,
  updateStoreStatus,
  getCalendarPrefs,
  updateCalendarPrefs,
  getQuickMessages,
  updateQuickMessages
};
