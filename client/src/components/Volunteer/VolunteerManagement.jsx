import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import '../Mawhba/Mawhba.css';
import UnifiedAttendancePage from '../shared/UnifiedAttendancePage';
import ReceiptModal from '../shared/ReceiptModal';
import ReceiptArchiveModal from '../shared/ReceiptArchiveModal';
import VolunteerContractModal from '../shared/VolunteerContractModal';
// AttendanceLog (per-day manual editor) has been intentionally
// removed from this file. Volunteer attendance is now driven purely
// by the QR-scan log — admins edit hours through the standalone
// "سجل الحضور" modal, not inline per-opportunity. If you need the
// legacy component back, `import AttendanceLog from '../shared/AttendanceLog';`.
import VolunteerShareControls from '../shared/VolunteerShareControls';
import MasterShareBar from '../shared/MasterShareBar';
import VolunteerOpportunityRequestModal from './VolunteerOpportunityRequestModal';

const VolunteerManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Volunteer state
  const [volunteers, setVolunteers] = useState([]);
  const [showVolunteerModal, setShowVolunteerModal] = useState(false);
  const [showOpportunityRequestModal, setShowOpportunityRequestModal] = useState(false);
  const [editingVolunteerId, setEditingVolunteerId] = useState(null);
  // Attendance mode state
  const [volunteerAttendanceMode, setVolunteerAttendanceMode] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [volAttendanceList, setVolAttendanceList] = useState([]);
  // Per-volunteer attendance history modal + full CSV export
  const [showLogModal, setShowLogModal] = useState(false);
  const [logVolunteer, setLogVolunteer] = useState(null);
  const [logRecords, setLogRecords] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const _today = new Date().toISOString().slice(0, 10);
  const _monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [exportFrom, setExportFrom] = useState(_monthAgo);
  const [exportTo, setExportTo] = useState(_today);
  const [exporting, setExporting] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [volSessionStats, setVolSessionStats] = useState({ checkins: 0, checkouts: 0, errors: 0 });
  // eslint-disable-next-line no-unused-vars
  const [volRecentScans, setVolRecentScans] = useState([]);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [showVolunteerDetailModal, setShowVolunteerDetailModal] = useState(false);
  const [showVolunteerRatingModal, setShowVolunteerRatingModal] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [contractTarget, setContractTarget] = useState(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  // Multi-select for bulk ID-card printing. Set of volunteerIds.
  const [selectedIdsForPrint, setSelectedIdsForPrint] = useState(() => new Set());
  const [volunteerLoading, setVolunteerLoading] = useState(false);
  const [volunteerRatingForm, setVolunteerRatingForm] = useState({
    volunteerId: '',
    opportunityId: '',
    type: 'award',
    points: 1,
    criteria: '',
    notes: '',
    ratingDate: new Date().toISOString().split('T')[0]
  });
  const [volunteerForm, setVolunteerForm] = useState({
    name: '',
    nationalId: '',
    phone: '',
    email: '',
    nationalIdPhoto: '',
    profilePhoto: ''
  });
  const [opportunityForm, setOpportunityForm] = useState({
    volunteerId: '',
    volunteerIds: [],
    selectAllVolunteers: false,
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    dailyHours: 8,
    dailyStartTime: '',
    dailyEndTime: '',
    rating: 0,
    ratingCriteria: '',
    ratingNotes: ''
  });
  const [showHoursAdjustModal, setShowHoursAdjustModal] = useState(false);
  const [hoursAdjustForm, setHoursAdjustForm] = useState({
    opportunityId: '',
    adjustment: 0,
    reason: ''
  });

  const criteriaOptions = [
    { value: '', label: isRTL ? 'اختر المعيار' : 'Select Criteria' },
    { value: 'attendance', label: isRTL ? 'الحضور والانضباط' : 'Attendance & Punctuality' },
    { value: 'performance', label: isRTL ? 'جودة الأداء' : 'Work Performance' },
    { value: 'teamwork', label: isRTL ? 'العمل الجماعي' : 'Teamwork' },
    { value: 'initiative', label: isRTL ? 'المبادرة والإبداع' : 'Initiative & Creativity' },
    { value: 'communication', label: isRTL ? 'التواصل' : 'Communication' },
    { value: 'customer_service', label: isRTL ? 'خدمة العملاء' : 'Customer Service' },
    { value: 'technical_skills', label: isRTL ? 'المهارات التقنية' : 'Technical Skills' },
    { value: 'safety', label: isRTL ? 'الالتزام بالسلامة' : 'Safety Compliance' },
    { value: 'other', label: isRTL ? 'أخرى' : 'Other' }
  ];

  const fetchVolunteers = useCallback(async () => {
    try {
      const response = await api.get('/volunteers');
      setVolunteers(response.data || []);
    } catch (error) {
      console.error('Error fetching volunteers:', error);
    }
  }, []);

  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  const resetVolunteerForm = () => {
    setVolunteerForm({
      name: '',
      nationalId: '',
      phone: '',
      email: '',
      nationalIdPhoto: '',
      profilePhoto: ''
    });
  };

  const resetOpportunityForm = () => {
    setOpportunityForm({
      volunteerId: '',
      volunteerIds: [],
      selectAllVolunteers: false,
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      dailyHours: 8,
      dailyStartTime: '',
      dailyEndTime: '',
      rating: 0,
      ratingCriteria: '',
      ratingNotes: ''
    });
  };

  const openEditVolunteer = (volunteer) => {
    setEditingVolunteerId(volunteer.volunteerId);
    setVolunteerForm({
      name: volunteer.name || '',
      nationalId: volunteer.nationalId || '',
      phone: volunteer.phone || '',
      email: volunteer.email || '',
      nationalIdPhoto: volunteer.nationalIdPhoto || '',
      profilePhoto: volunteer.profilePhoto || ''
    });
    setShowVolunteerModal(true);
  };

  const closeVolunteerModal = () => {
    setShowVolunteerModal(false);
    setEditingVolunteerId(null);
    resetVolunteerForm();
  };

  // ─── Volunteer Attendance Mode ───────────────────────────────────
  const fmtTimeLong = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const hydrateVolAttendance = useCallback(async () => {
    try {
      const { data } = await api.get('/volunteers/attendance/today');
      setVolAttendanceList(Array.isArray(data?.volunteers) ? data.volunteers : []);
      setVolSessionStats(prev => ({
        checkins: data?.stats?.checkins || 0,
        checkouts: data?.stats?.checkouts || 0,
        errors: prev.errors
      }));
      const events = data?.events || [];
      setVolRecentScans(events.slice(0, 12).map(e => ({
        kind: e.kind, name: e.name, time: fmtTimeLong(e.at)
      })));
    } catch (err) {
      console.error('hydrateVolAttendance failed', err);
    }
  }, []);

  // ─── Per-volunteer attendance history ────────────────────────────
  const openVolunteerLog = async (volunteer) => {
    setLogVolunteer(volunteer);
    setLogRecords([]);
    setLogChanceFilter('all');
    setShowLogModal(true);
    setLogLoading(true);
    try {
      const { data } = await api.get(`/volunteers/${volunteer.volunteerId}/attendance`);
      setLogRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'تعذر تحميل سجل الحضور' : 'Failed to load attendance history');
    } finally {
      setLogLoading(false);
    }
  };

  const deleteVolAttendanceRecord = async (rec) => {
    if (!window.confirm(isRTL ? `حذف سجل ${rec.date}؟` : `Delete record for ${rec.date}?`)) return;
    try {
      await api.delete(`/volunteers/attendance/${rec.attendanceId}`);
      setLogRecords(prev => prev.filter(r => r.attendanceId !== rec.attendanceId));
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل الحذف' : 'Delete failed');
    }
  };

  // Inline editor state for the log-modal "manually enter check-out"
  // flow — used when a volunteer forgot to check out on a past day.
  const [editingCheckoutId, setEditingCheckoutId] = useState(null);
  const [editingCheckoutValue, setEditingCheckoutValue] = useState('');
  const [savingCheckout, setSavingCheckout] = useState(false);

  // Chance filter for the log modal — mirrors the public profile's
  // opportunity filter. Narrows the visible rows (and derived stats)
  // to a single chance's date range + daily time window, so admin
  // can review + edit that chance's history in isolation.
  const [logChanceFilter, setLogChanceFilter] = useState('all');
  const _hhmmToMin = (s) => {
    if (!s || typeof s !== 'string') return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  };
  const _tsToRiyadhMin = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh', hour12: false, hour: '2-digit', minute: '2-digit'
    }).formatToParts(d);
    return parseInt(parts.find(p => p.type === 'hour').value, 10) * 60
         + parseInt(parts.find(p => p.type === 'minute').value, 10);
  };
  // Normalize DATEONLY values that Sequelize sometimes returns as
  // strings and sometimes as Date objects, so we can compare them
  // consistently with plain string < / > without hitting NaN coercion
  // that silently kills the filter.
  const _isoDate = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return v.slice(0, 10);
    try { return new Date(v).toISOString().slice(0, 10); } catch { return null; }
  };
  // The picked opportunity (or null for "all"), used both by the row
  // filter and the per-row chance-overlap duration display.
  const logChanceOpp = React.useMemo(() => {
    if (logChanceFilter === 'all') return null;
    return (logVolunteer?.opportunities || []).find(o => o.opportunityId === logChanceFilter) || null;
  }, [logChanceFilter, logVolunteer]);

  const filteredLogRecords = React.useMemo(() => {
    if (!logChanceOpp) return logRecords;
    const oppStart = _isoDate(logChanceOpp.startDate);
    const oppEnd = _isoDate(logChanceOpp.endDate);
    const chFrom = _hhmmToMin(logChanceOpp.dailyStartTime);
    const chTo = _hhmmToMin(logChanceOpp.dailyEndTime);
    const timeWindowed = chFrom != null && chTo != null && chTo > chFrom;
    return logRecords.filter(r => {
      const rDate = _isoDate(r.date);
      if (!rDate) return false;
      if (oppStart && rDate < oppStart) return false;
      if (oppEnd && rDate > oppEnd) return false;
      // Chance has no daily window → date range is the whole rule.
      if (!timeWindowed) return true;
      // Partial records (missing check-in or check-out) stay visible
      // so admin can complete / fix them from within this filter.
      if (!r.checkInAt || !r.checkOutAt) return true;
      const inMin = _tsToRiyadhMin(r.checkInAt);
      const outMin = _tsToRiyadhMin(r.checkOutAt);
      if (inMin == null || outMin == null || outMin <= inMin) return true;
      return Math.min(outMin, chTo) - Math.max(inMin, chFrom) > 0;
    });
  }, [logChanceOpp, logRecords]);

  // How much of a specific attendance row falls inside the currently-
  // selected chance's daily time window. Null if no chance is picked
  // or the chance has no window (in which case the raw row duration
  // is the right thing to show).
  const chanceRelativeMin = (rec) => {
    if (!logChanceOpp) return null;
    const chFrom = _hhmmToMin(logChanceOpp.dailyStartTime);
    const chTo = _hhmmToMin(logChanceOpp.dailyEndTime);
    if (chFrom == null || chTo == null || chTo <= chFrom) return null;
    if (!rec.checkInAt || !rec.checkOutAt) return null;
    const inMin = _tsToRiyadhMin(rec.checkInAt);
    const outMin = _tsToRiyadhMin(rec.checkOutAt);
    if (inMin == null || outMin == null || outMin <= inMin) return null;
    return Math.max(0, Math.min(outMin, chTo) - Math.max(inMin, chFrom));
  };

  // Manual-add attendance state — for days the volunteer never scanned
  // at all. The panel toggles from an "add manual record" button at
  // the top of the log modal. `opportunityId` isn't stored on the
  // attendance row (the QR log is chance-agnostic — chances are
  // derived from date + time overlap), but picking a chance here
  // auto-fills the times so admin doesn't have to remember them.
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    opportunityId: '', date: '', checkInAt: '', checkOutAt: ''
  });
  const [savingManual, setSavingManual] = useState(false);

  const pickManualOpportunity = (opportunityId) => {
    if (!opportunityId) {
      setManualForm(f => ({ ...f, opportunityId: '' }));
      return;
    }
    const opp = (logVolunteer?.opportunities || []).find(o => o.opportunityId === opportunityId);
    if (!opp) return;
    setManualForm(f => ({
      opportunityId,
      // If today falls inside the chance, keep it; else snap to the chance's start.
      date: (f.date && f.date >= opp.startDate && f.date <= opp.endDate)
        ? f.date
        : opp.startDate,
      checkInAt: opp.dailyStartTime || f.checkInAt || '',
      checkOutAt: opp.dailyEndTime || f.checkOutAt || ''
    }));
  };

  const submitManualAttendance = async () => {
    if (!logVolunteer) return;
    if (!manualForm.date) {
      return toast.error(isRTL ? 'أدخل التاريخ' : 'Enter a date');
    }
    if (!manualForm.checkInAt && !manualForm.checkOutAt) {
      return toast.error(isRTL ? 'أدخل وقت الدخول أو الخروج على الأقل' : 'Enter at least check-in or check-out');
    }
    setSavingManual(true);
    try {
      const { data } = await api.post('/volunteers/attendance', {
        volunteerId: logVolunteer.volunteerId,
        date: manualForm.date,
        checkInAt: manualForm.checkInAt || undefined,
        checkOutAt: manualForm.checkOutAt || undefined
      });
      // Insert into logRecords keeping the DESC-by-date ordering.
      setLogRecords(prev => {
        const next = [data.record, ...prev];
        next.sort((a, b) => (a.date < b.date ? 1 : -1));
        return next;
      });
      toast.success(isRTL ? 'تمت إضافة السجل يدوياً' : 'Manual record added');
      setManualForm({ opportunityId: '', date: '', checkInAt: '', checkOutAt: '' });
      setShowAddManual(false);
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'فشل الإضافة' : 'Add failed'));
    } finally {
      setSavingManual(false);
    }
  };

  const beginEditCheckout = (rec) => {
    setEditingCheckoutId(rec.attendanceId);
    // Pre-fill with existing time if editing, else default to something
    // sensible (check-in + 1 hour, or 18:00 if there's no check-in).
    if (rec.checkOutAt) {
      const d = new Date(rec.checkOutAt);
      setEditingCheckoutValue(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else if (rec.checkInAt) {
      const d = new Date(new Date(rec.checkInAt).getTime() + 60 * 60 * 1000);
      setEditingCheckoutValue(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setEditingCheckoutValue('18:00');
    }
  };

  const cancelEditCheckout = () => {
    setEditingCheckoutId(null);
    setEditingCheckoutValue('');
  };

  const saveCheckoutTime = async (rec) => {
    if (!editingCheckoutValue) {
      return toast.error(isRTL ? 'أدخل وقت الخروج' : 'Enter a check-out time');
    }
    setSavingCheckout(true);
    try {
      const { data } = await api.patch(
        `/volunteers/attendance/${rec.attendanceId}/checkout`,
        { checkOutAt: editingCheckoutValue }
      );
      const updated = data?.record || { ...rec, checkOutAt: new Date().toISOString() };
      setLogRecords(prev => prev.map(r =>
        r.attendanceId === rec.attendanceId ? { ...r, checkOutAt: updated.checkOutAt } : r
      ));
      toast.success(isRTL ? 'تم تسجيل وقت الخروج' : 'Check-out saved');
      cancelEditCheckout();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message;
      toast.error(msg || (isRTL ? 'فشل حفظ وقت الخروج' : 'Failed to save check-out'));
    } finally {
      setSavingCheckout(false);
    }
  };

  const clearVolCheckoutRecord = async (rec) => {
    if (!window.confirm(
      isRTL
        ? `حذف تسجيل الخروج لتاريخ ${rec.date}؟ سيبقى تسجيل الدخول محفوظاً.`
        : `Clear check-out for ${rec.date}? Check-in will remain.`
    )) return;
    try {
      await api.patch(`/volunteers/attendance/${rec.attendanceId}/checkout`);
      setLogRecords(prev => prev.map(r =>
        r.attendanceId === rec.attendanceId ? { ...r, checkOutAt: null } : r
      ));
      toast.success(isRTL ? 'تم حذف تسجيل الخروج' : 'Check-out cleared');
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || (isRTL ? 'فشل الحذف' : 'Clear failed'));
    }
  };

  const downloadAllVolunteersAttendance = async () => {
    if (!exportFrom || !exportTo) {
      toast.error(isRTL ? 'حدد نطاق التواريخ' : 'Pick a date range');
      return;
    }
    setExporting(true);
    try {
      const res = await api.post(
        '/volunteers/attendance/export',
        { from: exportFrom, to: exportTo },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `volunteers-attendance-${exportFrom}_to_${exportTo}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(isRTL ? 'تم تنزيل الملف' : 'File downloaded');
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  // helper time formatters for the log modal
  const fmtHms = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const durationMin = (rec) => {
    if (!rec.checkInAt || !rec.checkOutAt) return null;
    return Math.max(0, Math.round((new Date(rec.checkOutAt) - new Date(rec.checkInAt)) / 60000));
  };

  const openVolunteerAttendanceMode = async () => {
    setVolunteerAttendanceMode(true);
    setVolSessionStats({ checkins: 0, checkouts: 0, errors: 0 });
    setVolRecentScans([]);
    setVolAttendanceList([]);
    await hydrateVolAttendance();
  };

  // The hardware scanner listener now lives inside UnifiedAttendancePage
  // (shared by Mawhba + Volunteer). We removed the volunteer-local
  // listener to avoid double scans.

  const handleCreateVolunteer = async () => {
    if (!volunteerForm.name || !volunteerForm.nationalId || !volunteerForm.phone) {
      toast.error(isRTL ? 'الاسم ورقم الهوية والجوال مطلوبة' : 'Name, national ID, and phone are required');
      return;
    }

    setVolunteerLoading(true);
    try {
      if (editingVolunteerId) {
        await api.put(`/volunteers/${editingVolunteerId}`, volunteerForm);
        toast.success(isRTL ? 'تم تحديث بيانات المتطوع' : 'Volunteer updated successfully');
      } else {
        await api.post('/volunteers', volunteerForm);
        toast.success(isRTL ? 'تم إضافة المتطوع بنجاح' : 'Volunteer added successfully');
      }
      setShowVolunteerModal(false);
      setEditingVolunteerId(null);
      resetVolunteerForm();
      fetchVolunteers();
    } catch (error) {
      console.error('Error saving volunteer:', error);
      if (error.response?.status === 409) {
        toast.error(isRTL ? 'يوجد متطوع بنفس رقم الهوية' : 'Volunteer with this national ID already exists');
      } else {
        toast.error(isRTL ? 'خطأ في إضافة المتطوع' : 'Error adding volunteer');
      }
    } finally {
      setVolunteerLoading(false);
    }
  };

  const handleCreateOpportunity = async () => {
    const hasValidVolunteer = opportunityForm.selectAllVolunteers || opportunityForm.volunteerIds.length > 0;
    if (!hasValidVolunteer || !opportunityForm.title || !opportunityForm.startDate || !opportunityForm.endDate) {
      toast.error(isRTL ? 'المتطوع والعنوان والتاريخ مطلوبة' : 'Volunteer, title, and dates are required');
      return;
    }

    setVolunteerLoading(true);
    try {
      // Get list of volunteers to assign
      const volunteerIds = opportunityForm.selectAllVolunteers
        ? volunteers.map(v => v.volunteerId)
        : opportunityForm.volunteerIds;

      // Create opportunity for each volunteer
      const promises = volunteerIds.map(volunteerId =>
        api.post('/volunteers/opportunities', {
          ...opportunityForm,
          volunteerId
        })
      );

      await Promise.all(promises);
      toast.success(isRTL
        ? `تم إضافة فرصة التطوع لـ ${volunteerIds.length} متطوع بنجاح`
        : `Opportunity added to ${volunteerIds.length} volunteer(s) successfully`);
      setShowOpportunityModal(false);
      resetOpportunityForm();
      fetchVolunteers();
    } catch (error) {
      console.error('Error creating opportunity:', error);
      toast.error(isRTL ? 'خطأ في إضافة فرصة التطوع' : 'Error adding opportunity');
    } finally {
      setVolunteerLoading(false);
    }
  };

  const handleOpenVolunteerRating = (volunteer, opportunity = null) => {
    setSelectedVolunteer(volunteer);
    setSelectedOpportunity(opportunity);
    setVolunteerRatingForm({
      volunteerId: volunteer.volunteerId,
      opportunityId: opportunity?.opportunityId || '',
      type: 'award',
      points: 1,
      criteria: '',
      notes: '',
      ratingDate: new Date().toISOString().split('T')[0]
    });
    setShowVolunteerRatingModal(true);
  };

  const handleCreateVolunteerRating = async () => {
    if (!volunteerRatingForm.volunteerId) return;

    setVolunteerLoading(true);
    try {
      await api.post('/volunteers/ratings', volunteerRatingForm);
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      setShowVolunteerRatingModal(false);
      setSelectedVolunteer(null);
      setSelectedOpportunity(null);
      fetchVolunteers();
    } catch (error) {
      console.error('Error creating volunteer rating:', error);
      toast.error(isRTL ? 'خطأ في إضافة التقييم' : 'Error adding rating');
    } finally {
      setVolunteerLoading(false);
    }
  };

  const handleDeleteVolunteerRating = async (ratingId) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذا التقييم؟' : 'Delete this rating?')) return;

    try {
      await api.delete(`/volunteers/ratings/${ratingId}`);
      toast.success(isRTL ? 'تم حذف التقييم' : 'Rating deleted');
      fetchVolunteers();
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error(isRTL ? 'خطأ في حذف التقييم' : 'Error deleting rating');
    }
  };

  const handleDeleteOpportunity = async (opportunityId) => {
    if (!window.confirm(isRTL ? 'حذف الفرصة التطوعية وسجل الحضور الخاص بها نهائياً؟' : 'Delete this opportunity and its attendance log permanently?')) {
      return;
    }
    try {
      await api.delete(`/volunteers/opportunities/${opportunityId}`);
      toast.success(isRTL ? 'تم حذف الفرصة' : 'Opportunity deleted');
      fetchVolunteers();
      if (selectedVolunteer) {
        const fresh = await api.get(`/volunteers/${selectedVolunteer.volunteerId}`);
        if (fresh.data) setSelectedVolunteer(fresh.data);
      }
    } catch (err) {
      console.error('Error deleting opportunity:', err);
      toast.error(isRTL ? 'خطأ في الحذف' : 'Error deleting');
    }
  };

  const handleDeleteVolunteer = async (volunteerId, forceDelete = false) => {
    const confirmMessage = forceDelete
      ? (isRTL ? 'هل أنت متأكد؟ سيتم حذف المتطوع وجميع سجلات التطوع الخاصة به نهائياً!' : 'Are you sure? This will permanently delete the volunteer and ALL their volunteer records!')
      : (isRTL ? 'هل أنت متأكد من حذف هذا المتطوع؟' : 'Are you sure you want to delete this volunteer?');

    if (!window.confirm(confirmMessage)) return;

    try {
      const url = forceDelete ? `/volunteers/${volunteerId}?force=true` : `/volunteers/${volunteerId}`;
      await api.delete(url);
      toast.success(isRTL ? 'تم حذف المتطوع بنجاح' : 'Volunteer deleted successfully');
      setShowVolunteerDetailModal(false);
      setSelectedVolunteer(null);
      fetchVolunteers();
    } catch (error) {
      console.error('Error deleting volunteer:', error);
      // Check if it's because of existing opportunities
      if (error.response?.data?.requiresForce) {
        const count = error.response.data.opportunityCount;
        const forceConfirm = window.confirm(
          isRTL
            ? `هذا المتطوع لديه ${count} سجل تطوع. هل تريد حذف المتطوع مع جميع سجلاته؟`
            : `This volunteer has ${count} volunteer record(s). Do you want to delete the volunteer along with all their records?`
        );
        if (forceConfirm) {
          handleDeleteVolunteer(volunteerId, true);
        }
      } else {
        toast.error(isRTL ? 'خطأ في حذف المتطوع' : 'Error deleting volunteer');
      }
    }
  };

  const handleOpenHoursAdjust = (opportunity) => {
    setHoursAdjustForm({
      opportunityId: opportunity.opportunityId,
      adjustment: 0,
      reason: ''
    });
    setShowHoursAdjustModal(true);
  };

  const handleAdjustHours = async () => {
    if (hoursAdjustForm.adjustment === 0) {
      toast.error(isRTL ? 'يرجى إدخال قيمة التعديل' : 'Please enter an adjustment value');
      return;
    }
    try {
      await api.patch(`/volunteers/opportunities/${hoursAdjustForm.opportunityId}/hours`, {
        adjustment: hoursAdjustForm.adjustment,
        reason: hoursAdjustForm.reason
      });
      toast.success(isRTL ? 'تم تعديل الساعات بنجاح' : 'Hours adjusted successfully');
      setShowHoursAdjustModal(false);
      fetchVolunteers();
      // Refresh selected volunteer data
      if (selectedVolunteer) {
        const updated = volunteers.find(v => v.volunteerId === selectedVolunteer.volunteerId);
        if (updated) setSelectedVolunteer(updated);
      }
    } catch (error) {
      console.error('Error adjusting hours:', error);
      toast.error(isRTL ? 'خطأ في تعديل الساعات' : 'Error adjusting hours');
    }
  };

  const handleVolunteerPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(isRTL ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجا)' : 'File too large (max 5MB)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setVolunteerForm(prev => ({ ...prev, nationalIdPhoto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // View volunteer details
  const handleViewVolunteer = (volunteer) => {
    setSelectedVolunteer(volunteer);
    setShowVolunteerDetailModal(true);
  };

  // Export single volunteer history as CSV
  const handleExportVolunteerHistory = (volunteer) => {
    // Opportunities section
    const oppHeaders = [
      'Volunteer Name', 'National ID', 'Phone', 'Email',
      'Opportunity Title', 'Description', 'Start Date', 'End Date',
      'Daily Hours', 'Total Hours', 'Status'
    ];

    const oppRows = (volunteer.opportunities || []).map(opp => [
      volunteer.name,
      volunteer.nationalId,
      volunteer.phone,
      volunteer.email || 'N/A',
      opp.title,
      opp.description || '',
      opp.startDate,
      opp.endDate,
      opp.dailyHours || 8,
      opp.totalHours || 0,
      opp.status || 'active'
    ]);

    // Calculate totals
    const totalHours = (volunteer.opportunities || []).reduce((sum, o) => sum + (o.totalHours || 0), 0);
    const awards = (volunteer.ratings || []).filter(r => r.type === 'award').reduce((sum, r) => sum + (r.points || 0), 0);
    const deductions = (volunteer.ratings || []).filter(r => r.type === 'deduction').reduce((sum, r) => sum + (r.points || 0), 0);
    const netPoints = awards - deductions;

    // Ratings section
    const ratingHeaders = ['Date', 'Type', 'Points', 'Criteria', 'Notes'];
    const ratingRows = (volunteer.ratings || []).map(r => [
      r.ratingDate,
      r.type,
      r.type === 'deduction' ? `-${r.points}` : `+${r.points}`,
      r.criteria || '',
      r.notes ? r.notes.replace(/"/g, '""') : ''
    ]);

    // Build CSV content
    const csvLines = [
      '--- VOLUNTEER INFO ---',
      `"Name","${volunteer.name}"`,
      `"National ID","${volunteer.nationalId}"`,
      `"Phone","${volunteer.phone}"`,
      `"Email","${volunteer.email || 'N/A'}"`,
      '',
      '--- OPPORTUNITIES ---',
      oppHeaders.join(','),
      ...oppRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      '--- RATINGS HISTORY ---',
      ratingHeaders.join(','),
      ...ratingRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      '--- SUMMARY ---',
      '"Total Hours","Total Awards","Total Deductions","Net Points"',
      `"${totalHours}","${awards}","${deductions}","${netPoints}"`
    ];

    const csvContent = csvLines.join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `volunteer_${volunteer.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(isRTL ? 'تم تصدير السجل بنجاح' : 'History exported successfully');
  };

  // Print volunteer profile with all info including national ID photo

  const handlePrintVolunteerProfile = (volunteer, opportunity = null) => {
    const printWindow = window.open('', '_blank');
    const totalHours = (volunteer.opportunities || []).reduce((sum, o) => sum + ((o.totalHours || 0) + (o.hoursAdjustment || 0)), 0);

    const printContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <title>${isRTL ? 'ملف المتطوع' : 'Volunteer Profile'} - ${volunteer.name}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            padding: 20px;
            background: #fff;
            font-size: 12px;
            line-height: 1.5;
            color: #333;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 15px;
            border-bottom: 3px solid #e02529;
            margin-bottom: 20px;
          }
          .logo { height: 60px; }
          .header-center { text-align: center; flex: 1; }
          .header-title { font-size: 20px; font-weight: 700; color: #e02529; }
          .header-subtitle { font-size: 12px; color: #666; margin-top: 5px; }
          .profile-section {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .profile-photo {
            width: 150px;
            height: 180px;
            border: 2px solid #e02529;
            border-radius: 8px;
            overflow: hidden;
          }
          .profile-photo img { width: 100%; height: 100%; object-fit: cover; }
          .profile-info { flex: 1; }
          .profile-name { font-size: 24px; font-weight: 700; color: #1a1a2e; margin-bottom: 15px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .info-item { background: white; padding: 10px; border-radius: 6px; border: 1px solid #eee; }
          .info-label { font-size: 10px; color: #888; text-transform: uppercase; }
          .info-value { font-size: 14px; font-weight: 600; color: #333; }
          .section { margin-bottom: 20px; }
          .section-title {
            font-size: 14px; font-weight: 700; color: #e02529;
            padding-bottom: 8px; margin-bottom: 12px;
            border-bottom: 2px solid #e02529;
          }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .stat-card {
            text-align: center; padding: 15px;
            background: linear-gradient(135deg, #e02529 0%, #c41e24 100%);
            color: white; border-radius: 8px;
          }
          .stat-value { font-size: 28px; font-weight: 700; }
          .stat-label { font-size: 11px; opacity: 0.9; }
          .opportunity-card {
            background: #f8f9fa; padding: 12px;
            border-radius: 8px; margin-bottom: 10px;
            border-${isRTL ? 'right' : 'left'}: 4px solid #e02529;
          }
          .opp-title { font-size: 14px; font-weight: 600; color: #1a1a2e; }
          .opp-meta { display: flex; gap: 20px; margin-top: 8px; font-size: 12px; color: #666; }
          .footer {
            margin-top: 30px; text-align: center;
            font-size: 10px; color: #888;
            padding-top: 15px; border-top: 1px solid #eee;
          }
          @media print {
            body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/found.png" alt="Foundation" class="logo" />
          <div class="header-center">
            <div class="header-title">${isRTL ? 'ملف المتطوع' : 'Volunteer Profile'}</div>
            <div class="header-subtitle">${isRTL ? 'فاب لاب الأحساء - مختبر التصنيع الرقمي' : 'FABLAB Al-Ahsa - Digital Fabrication Laboratory'}</div>
          </div>
          <img src="/fablab.png" alt="FABLAB" class="logo" />
        </div>

        <div class="profile-section">
          <div class="profile-photo">
            ${volunteer.nationalIdPhoto ? `<img src="${volunteer.nationalIdPhoto}" alt="ID Photo" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f0f0f0;font-size:48px;color:#999;">' + (volunteer.name?.charAt(0) || 'V') + '</div>'}
          </div>
          <div class="profile-info">
            <div class="profile-name">${volunteer.name}</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">${isRTL ? 'رقم الهوية' : 'National ID'}</div>
                <div class="info-value">${volunteer.nationalId}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${isRTL ? 'رقم الهاتف' : 'Phone'}</div>
                <div class="info-value">${volunteer.phone}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${isRTL ? 'البريد الإلكتروني' : 'Email'}</div>
                <div class="info-value">${volunteer.email || (isRTL ? 'غير متوفر' : 'N/A')}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${isRTL ? 'الحالة' : 'Status'}</div>
                <div class="info-value">${volunteer.isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${isRTL ? 'إحصائيات التطوع' : 'Volunteering Statistics'}</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${volunteer.totalOpportunities || 0}</div>
              <div class="stat-label">${isRTL ? 'فرص تطوعية' : 'Opportunities'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalHours}</div>
              <div class="stat-label">${isRTL ? 'ساعة تطوع' : 'Total Hours'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">+${volunteer.totalAwards || 0}</div>
              <div class="stat-label">${isRTL ? 'نقاط مكتسبة' : 'Awards'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${volunteer.totalPoints || 0}</div>
              <div class="stat-label">${isRTL ? 'صافي النقاط' : 'Net Points'}</div>
            </div>
          </div>
        </div>

        ${(volunteer.opportunities && volunteer.opportunities.length > 0) ? `
        <div class="section">
          <div class="section-title">${isRTL ? 'سجل التطوع' : 'Volunteering History'}</div>
          ${volunteer.opportunities.map(opp => `
            <div class="opportunity-card">
              <div class="opp-title">${opp.title}</div>
              ${opp.description ? `<p style="margin: 8px 0; color: #666; font-size: 12px;">${opp.description}</p>` : ''}
              <div class="opp-meta">
                <span>📅 ${opp.startDate} → ${opp.endDate}</span>
                <span>⏱️ ${(opp.totalHours || 0) + (opp.hoursAdjustment || 0)} ${isRTL ? 'ساعة' : 'hours'}</span>
                <span>📊 ${opp.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') : (isRTL ? 'نشط' : 'Active')}</span>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${volunteer.nationalIdPhoto ? `
        <div class="section" style="page-break-before: always; margin-top: 30px;">
          <div class="section-title">${isRTL ? 'صورة الهوية الوطنية' : 'National ID Photo'}</div>
          <div style="display: flex; justify-content: center; align-items: center; padding: 20px; background: #f8f9fa; border-radius: 12px; border: 2px solid #e02529;">
            <img src="${volunteer.nationalIdPhoto}" alt="National ID" style="max-width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
          </div>
          <div style="text-align: center; margin-top: 15px; padding: 10px; background: linear-gradient(135deg, #e02529 0%, #c41e24 100%); color: white; border-radius: 8px;">
            <div style="font-size: 16px; font-weight: 700;">${volunteer.name}</div>
            <div style="font-size: 14px; margin-top: 5px;">${isRTL ? 'رقم الهوية:' : 'National ID:'} ${volunteer.nationalId}</div>
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p>${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية - فاب لاب الأحساء' : 'Abdulmonem Alrashed Humanitarian Foundation - FABLAB Al-Ahsa'}</p>
          <p>${isRTL ? 'تم الطباعة في' : 'Printed on'}: ${new Date().toLocaleString(isRTL ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-US', { calendar: 'gregory' })}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  // Print volunteer certificate - modern colorful professional design

  const handlePrintVolunteerCertificate = (volunteer, opportunity) => {
    if (!opportunity) {
      toast.error(isRTL ? 'يرجى اختيار فرصة تطوعية لطباعة الشهادة' : 'Please select an opportunity to print certificate');
      return;
    }

    const printWindow = window.open('', '_blank');
    const totalHours = (opportunity.totalHours || 0) + (opportunity.hoursAdjustment || 0);
    const certId = 'VOL-' + (opportunity.opportunityId?.substring(0, 8).toUpperCase() || Date.now());

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>شهادة تطوع - ${volunteer.name}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 297mm;
            height: 210mm;
            overflow: hidden;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 10mm;
          }
          .certificate {
            width: 277mm;
            height: 190mm;
            background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
            border-radius: 16px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 30px 60px rgba(0,0,0,0.3);
          }

          /* Colorful border effect */
          .certificate::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border: 6px solid transparent;
            border-image: linear-gradient(135deg, #e02529, #ff6b6b, #feca57, #48dbfb, #e02529) 1;
            border-radius: 16px;
            pointer-events: none;
          }

          /* Decorative circles */
          .decor-circle {
            position: absolute;
            border-radius: 50%;
            opacity: 0.1;
          }
          .decor-circle.c1 {
            width: 200px; height: 200px;
            background: linear-gradient(135deg, #e02529, #ff6b6b);
            top: -50px; right: -50px;
          }
          .decor-circle.c2 {
            width: 150px; height: 150px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            bottom: -30px; left: -30px;
          }
          .decor-circle.c3 {
            width: 100px; height: 100px;
            background: linear-gradient(135deg, #feca57, #ff9f43);
            top: 50%; left: 20px;
            transform: translateY(-50%);
          }
          .decor-circle.c4 {
            width: 80px; height: 80px;
            background: linear-gradient(135deg, #48dbfb, #0abde3);
            bottom: 60px; right: 40px;
          }

          .certificate-inner {
            padding: 20mm 25mm;
            height: 100%;
            display: flex;
            flex-direction: column;
            position: relative;
            z-index: 1;
          }

          /* Header */
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12mm;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo {
            height: 85px;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
          }
          .header-center {
            text-align: center;
            flex: 1;
            padding: 0 20px;
          }
          .org-name {
            font-size: 11px;
            color: #64748b;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .cert-title {
            font-size: 44px;
            font-weight: 800;
            background: linear-gradient(135deg, #e02529, #ff6b6b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: none;
            margin-bottom: 4px;
          }
          .cert-subtitle {
            font-size: 16px;
            color: #475569;
            font-weight: 500;
            letter-spacing: 3px;
          }

          /* Divider */
          .divider {
            height: 4px;
            background: linear-gradient(90deg, #e02529, #ff6b6b, #feca57, #48dbfb, #667eea, #764ba2);
            border-radius: 2px;
            margin-bottom: 10mm;
          }

          /* Main Content */
          .main-content {
            text-align: center;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .presents-text {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .volunteer-name {
            font-size: 42px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
            position: relative;
            display: inline-block;
          }
          .volunteer-name::after {
            content: '';
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            height: 4px;
            background: linear-gradient(90deg, #e02529, #ff6b6b, #feca57);
            border-radius: 2px;
          }
          .appreciation-text {
            font-size: 15px;
            line-height: 1.8;
            color: #475569;
            max-width: 600px;
            margin: 15px auto;
          }
          .highlight {
            color: #e02529;
            font-weight: 700;
            font-size: 17px;
          }

          /* Stats Cards */
          .stats-container {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 12px 0;
          }
          .stat-card {
            background: linear-gradient(135deg, #e02529, #ff6b6b);
            color: white;
            padding: 12px 30px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 8px 20px rgba(224, 37, 41, 0.3);
            min-width: 140px;
          }
          .stat-card.alt {
            background: linear-gradient(135deg, #667eea, #764ba2);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
          }
          .stat-card.gold {
            background: linear-gradient(135deg, #f59e0b, #fbbf24);
            box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);
          }
          .stat-value {
            font-size: 22px;
            font-weight: 700;
          }
          .stat-label {
            font-size: 10px;
            opacity: 0.9;
            margin-top: 2px;
          }

          .thank-you {
            font-size: 13px;
            color: #64748b;
            margin-top: 10px;
            font-style: italic;
          }
          .hadith {
            color: #e02529;
            font-weight: 600;
          }

          /* Footer */
          .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: auto;
            padding-top: 10mm;
          }
          .signature-box {
            text-align: center;
            min-width: 200px;
          }
          .signature-line {
            width: 180px;
            height: 2px;
            background: linear-gradient(90deg, #e02529, #ff6b6b);
            margin: 0 auto 8px;
          }
          .signature-name {
            font-size: 16px;
            font-weight: 700;
            color: #1e293b;
          }
          .signature-role {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
          }

          .cert-info {
            text-align: left;
          }
          .cert-id {
            font-family: 'Courier New', monospace;
            font-size: 10px;
            color: #94a3b8;
            background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
            padding: 6px 14px;
            border-radius: 20px;
            display: inline-block;
          }
          .cert-date {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 5px;
          }

          .org-footer {
            text-align: center;
            flex: 1;
          }
          .org-footer-text {
            font-size: 10px;
            color: #94a3b8;
          }

          /* Ribbon decoration */
          .ribbon {
            position: absolute;
            top: 25px;
            left: -35px;
            width: 150px;
            height: 30px;
            background: linear-gradient(135deg, #e02529, #c41e24);
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: 600;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          }

          @media print {
            html, body {
              width: 297mm;
              height: 210mm;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body {
              padding: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%) !important;
            }
            .certificate {
              box-shadow: none;
              margin: auto;
            }
            .cert-title {
              -webkit-text-fill-color: #e02529;
              color: #e02529;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <!-- Decorative elements -->
          <div class="decor-circle c1"></div>
          <div class="decor-circle c2"></div>
          <div class="decor-circle c3"></div>
          <div class="decor-circle c4"></div>
          <div class="ribbon">متطوع متميز</div>

          <div class="certificate-inner">
            <!-- Header -->
            <div class="header">
              <div class="logo-container">
                <img src="/found.png" alt="Foundation" class="logo" />
              </div>
              <div class="header-center">
                <div class="org-name">مؤسسة عبدالمنعم الراشد الإنسانية</div>
                <div class="cert-title">شهادة تطوع</div>
                <div class="cert-subtitle">VOLUNTEERING CERTIFICATE</div>
              </div>
              <div class="logo-container">
                <img src="/fablab.png" alt="FABLAB" class="logo" />
              </div>
            </div>

            <div class="divider"></div>

            <!-- Main Content -->
            <div class="main-content">
              <div class="presents-text">تشهد إدارة فاب لاب الأحساء بأن</div>
              <div class="volunteer-name">${volunteer.name}</div>

              <div class="appreciation-text">
                قد شارك في العمل التطوعي من خلال
                <span class="highlight">"${opportunity.title}"</span>
                <br/>
                وأبدى تفانياً وإخلاصاً في خدمة المجتمع، ونثمّن جهوده المتميزة وروح المبادرة والتعاون
              </div>

              <div class="stats-container">
                <div class="stat-card">
                  <div class="stat-value">${totalHours}</div>
                  <div class="stat-label">ساعة تطوعية</div>
                </div>
                <div class="stat-card alt">
                  <div class="stat-value">${opportunity.startDate?.split('-').reverse().join('/')}</div>
                  <div class="stat-label">تاريخ البداية</div>
                </div>
                <div class="stat-card gold">
                  <div class="stat-value">${opportunity.endDate?.split('-').reverse().join('/')}</div>
                  <div class="stat-label">تاريخ النهاية</div>
                </div>
              </div>

              <div class="thank-you">
                <span class="hadith">"من لا يشكر الناس لا يشكر الله"</span>
                <br/>
                شكراً لعطائك وتفانيك في خدمة المجتمع
              </div>
            </div>

            <!-- Footer -->
            <div class="footer-section">
              <div class="cert-info">
                <div class="cert-id">${certId}</div>
                <div class="cert-date">${new Date().toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { calendar: 'gregory' })}</div>
              </div>

              <div class="org-footer">
                <div class="org-footer-text">
                  فاب لاب الأحساء - مختبر التصنيع الرقمي
                  <br/>
                  FABLAB Al-Ahsa - Digital Fabrication Laboratory
                </div>
              </div>

              <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-name">أ. زكي اللويم</div>
                <div class="signature-role">المسؤول التنفيذي لفاب لاب الأحساء</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  // Print intern profile

  // Builds the styles + a single card body. Used by both the single
  // print and the 4-per-A4 bulk print.
  const buildVolunteerCardStyles = () => `
    @page { size: A4 portrait; margin: 10mm 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f1f5f9; }
    body { padding: 6mm 0; }

    .print-note {
      font-size: 12px; color: #475569; background: white;
      border: 1px dashed #cbd5e1; border-radius: 8px;
      padding: 8px 14px; margin: 0 auto 8mm; text-align: center; max-width: 120mm;
    }

    /* 4-up A4 page: 2 columns × 2 rows */
    .page {
      display: grid;
      grid-template-columns: 72mm 72mm;
      grid-auto-rows: 102mm;
      column-gap: 6mm;
      row-gap: 6mm;
      justify-content: center;
      align-content: start;
      width: 100%;
    }
    .page + .page { page-break-before: always; }

    .id-card {
      width: 72mm; height: 102mm;
      background: linear-gradient(180deg, #ffffff 0%, #fff7ed 100%);
      border: 0.45mm dashed #475569;
      overflow: hidden; position: relative;
      display: flex; flex-direction: column;
      color: #1a1a2e; box-sizing: border-box;
    }
    .card-header {
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      padding: 2.5mm 3.5mm; text-align: center;
    }
    .card-title { color: white; font-size: 9pt; font-weight: 700; line-height: 1.15; }
    .card-subtitle { color: rgba(255,255,255,0.88); font-size: 6.5pt; margin-top: 0.6mm; }

    .card-body {
      flex: 1; padding: 2.5mm 3mm 0;
      display: flex; flex-direction: column; align-items: center; gap: 1.4mm;
    }
    .user-photo {
      width: 22mm; height: 26mm;
      background: linear-gradient(135deg, #fed7aa, #fdba74);
      border-radius: 2mm; display: flex; align-items: center; justify-content: center;
      color: #ea580c; font-weight: bold;
      border: 0.6mm solid #f97316;
      overflow: hidden; flex-shrink: 0;
    }
    .user-photo img { width: 100%; height: 100%; object-fit: cover; }
    .user-photo .initials { font-size: 18pt; font-weight: bold; color: #ea580c; }

    .user-name {
      font-size: 10.5pt; font-weight: 800; color: #1a1a2e;
      text-align: center; line-height: 1.15; max-height: 10mm; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .user-type-badge {
      display: inline-block;
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: white; font-size: 7.5pt; padding: 0.6mm 3.5mm;
      border-radius: 999px; font-weight: 700;
    }

    .info-section { width: 100%; display: flex; flex-direction: column; gap: 0.6mm; margin-top: 1mm; }
    .info-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 7.2pt; padding: 0.6mm 0; border-bottom: 0.2mm dotted #d4d4d8;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: 700; color: #555; }
    .info-value {
      color: #1a1a2e; font-weight: 600; text-align: ${isRTL ? 'left' : 'right'};
      max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .card-qr {
      display: flex; align-items: center; justify-content: center;
      margin-top: 1mm;
    }
    .card-qr img { width: 26mm; height: 26mm; background: white; padding: 0.8mm; border-radius: 1mm; box-shadow: 0 0 0 0.3mm #f97316 inset; }

    .card-footer {
      background: #ffffff; padding: 1.5mm 3mm;
      display: flex; align-items: center; justify-content: space-between;
      border-top: 0.3mm solid #e0e0e0;
    }
    .card-footer .logo { height: 7mm; width: auto; flex-shrink: 0; }
    .card-footer .qr-label { font-size: 6pt; color: #ea580c; font-weight: 700; }

    .decorative-stripe {
      position: absolute; top: 40%; ${isRTL ? 'right' : 'left'}: 0;
      width: 1mm; height: 25%;
      background: linear-gradient(to bottom, transparent, #f97316, transparent);
    }

    @media print {
      html, body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { padding: 0; }
      .print-note { display: none; }
      .id-card { box-shadow: none; break-inside: avoid; }
    }
  `;

  const buildVolunteerCardHTML = (volunteer, qrDataUrl) => {
    const na = isRTL ? 'غير محدد' : 'N/A';
    const volunteerName = volunteer.name || (isRTL ? 'غير متوفر' : 'N/A');
    const qrImg = qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" />` : '';
    // Prefer the dedicated profile photo; fall back to nationalIdPhoto
    // for volunteers who existed before the profilePhoto field shipped.
    const photoSrc = volunteer.profilePhoto || volunteer.nationalIdPhoto;
    return `
      <div class="id-card">
        <div class="card-header">
          <div class="card-title">${isRTL ? 'بطاقة متطوع فاب لاب الأحساء' : 'FABLAB Al-Ahsa Volunteer Card'}</div>
          <div class="card-subtitle">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</div>
        </div>
        <div class="card-body">
          <div class="user-photo">
            ${photoSrc
              ? `<img src="${photoSrc}" alt="${volunteerName}" />`
              : `<span class="initials">${volunteerName.charAt(0).toUpperCase()}</span>`
            }
          </div>
          <div class="user-name">${volunteerName}</div>
          <div class="user-type-badge">${isRTL ? 'متطوع' : 'Volunteer'}</div>
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">${isRTL ? 'رقم الهوية' : 'National ID'}</span>
              <span class="info-value">${volunteer.nationalId || na}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isRTL ? 'الهاتف' : 'Phone'}</span>
              <span class="info-value">${volunteer.phone || na}</span>
            </div>
          </div>
          <div class="card-qr">${qrImg}</div>
        </div>
        <div class="decorative-stripe"></div>
        <div class="card-footer">
          <img src="/found.png" alt="Foundation" class="logo">
          <span class="qr-label">${isRTL ? 'رمز الحضور' : 'Attendance QR'}</span>
          <img src="/fablab.png" alt="FABLAB" class="logo">
        </div>
      </div>
    `;
  };

  const openVolunteerPrintWindow = (cardsHtml) => {
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'بطاقات المتطوعين' : 'Volunteer ID Cards'}</title>
        <style>${buildVolunteerCardStyles()}</style>
      </head>
      <body>
        <div class="print-note">
          ${isRTL ? 'حجم البطاقة 72×102 ملم — اقطع حسب الخط المتقطع' : 'Card size 72×102 mm — cut along the dashed line'}
        </div>
        ${cardsHtml}
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  const chunkCards = (cards, size = 4) => {
    const pages = [];
    for (let i = 0; i < cards.length; i += size) pages.push(cards.slice(i, i + size));
    return pages;
  };

  const handlePrintVolunteerIDCard = async (volunteer) => {
    try {
      const { data } = await api.get(`/volunteers/${volunteer.volunteerId}/card`);
      const cardHtml = `<div class="page">${buildVolunteerCardHTML(data.volunteer, data.qrDataUrl)}</div>`;
      openVolunteerPrintWindow(cardHtml);
    } catch (err) {
      console.error('Error printing volunteer card:', err);
      toast.error(isRTL ? 'فشل توليد رمز الاستجابة السريعة' : 'Failed to generate QR');
    }
  };

  const handlePrintAllVolunteerIDCards = async () => {
    if (!volunteers.length) {
      toast.warning(isRTL ? 'لا يوجد متطوعين لطباعة بطاقاتهم' : 'No volunteers to print');
      return;
    }
    try {
      toast.info(isRTL ? 'جارٍ توليد البطاقات...' : 'Generating cards...');
      const { data } = await api.post('/volunteers/cards', {
        volunteerIds: volunteers.map(v => v.volunteerId)
      });
      const cardHtmls = (data.cards || []).map(c => buildVolunteerCardHTML(c.volunteer, c.qrDataUrl));
      const pages = chunkCards(cardHtmls, 4)
        .map(page => `<div class="page">${page.join('')}</div>`)
        .join('');
      openVolunteerPrintWindow(pages);
    } catch (err) {
      console.error('Error printing bulk volunteer cards:', err);
      toast.error(isRTL ? 'فشل طباعة البطاقات' : 'Failed to print cards');
    }
  };

  // Multi-select helpers for the "Print Selected" flow
  const toggleSelectVolunteerForPrint = (id) => {
    setSelectedIdsForPrint(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAllVolunteersForPrint = () => {
    setSelectedIdsForPrint(prev => {
      const ids = volunteers.map(v => v.volunteerId);
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else             ids.forEach(id => next.add(id));
      return next;
    });
  };
  const clearVolunteerPrintSelection = () => setSelectedIdsForPrint(new Set());

  const handlePrintSelectedVolunteerIDCards = async () => {
    const ids = [...selectedIdsForPrint];
    if (ids.length === 0) {
      toast.warning(isRTL ? 'اختر متطوعاً واحداً على الأقل' : 'Select at least one volunteer');
      return;
    }
    try {
      toast.info(isRTL ? 'جارٍ توليد البطاقات...' : 'Generating cards...');
      const { data } = await api.post('/volunteers/cards', { volunteerIds: ids });
      const cardHtmls = (data.cards || []).map(c => buildVolunteerCardHTML(c.volunteer, c.qrDataUrl));
      if (cardHtmls.length === 0) {
        toast.error(isRTL ? 'لا توجد بطاقات للطباعة' : 'No cards to print');
        return;
      }
      // 4 cards per A4 portrait; any extras spill to next pages
      // automatically via chunkCards + `.page + .page { page-break-before }`.
      const pages = chunkCards(cardHtmls, 4)
        .map(page => `<div class="page">${page.join('')}</div>`)
        .join('');
      openVolunteerPrintWindow(pages);
    } catch (err) {
      console.error('Error printing selected volunteer cards:', err);
      toast.error(isRTL ? 'فشل طباعة البطاقات' : 'Failed to print cards');
    }
  };


  // Local patch of a volunteer row after the share controls save,
  // so the toggle/copy button stays in sync without a full refetch.
  const handleShareUpdated = (volunteerId, patch) => {
    setVolunteers(prev => prev.map(v =>
      v.volunteerId === volunteerId ? { ...v, ...patch } : v
    ));
  };

  const handleExportAllVolunteers = () => {
    const headers = [
      'Volunteer Name', 'National ID', 'Phone', 'Email',
      'Total Opportunities', 'Total Hours', 'Awards', 'Deductions', 'Net Points', 'Status'
    ];

    const rows = volunteers.map(v => [
      v.name,
      v.nationalId,
      v.phone,
      v.email || 'N/A',
      v.totalOpportunities || 0,
      v.totalHours || 0,
      v.totalAwards || 0,
      v.totalDeductions || 0,
      v.totalPoints || 0,
      v.isActive ? 'Active' : 'Inactive'
    ]);

    // Add summary row
    const totalOpps = volunteers.reduce((sum, v) => sum + (v.totalOpportunities || 0), 0);
    const totalHours = volunteers.reduce((sum, v) => sum + (v.totalHours || 0), 0);
    const totalAwards = volunteers.reduce((sum, v) => sum + (v.totalAwards || 0), 0);
    const totalDeductions = volunteers.reduce((sum, v) => sum + (v.totalDeductions || 0), 0);
    const totalNetPoints = volunteers.reduce((sum, v) => sum + (v.totalPoints || 0), 0);

    const summaryRows = [
      [],
      ['--- SUMMARY ---'],
      ['Total Volunteers', 'Total Opportunities', 'Total Hours', 'Total Awards', 'Total Deductions', 'Total Net Points'],
      [volunteers.length, totalOpps, totalHours, totalAwards, totalDeductions, totalNetPoints]
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ...summaryRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `all_volunteers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(isRTL ? 'تم تصدير جميع المتطوعين' : 'All volunteers exported');
  };


  return (
    <>
          <div className="volunteers-content">
            <div className="volunteers-header">
              <h2>{isRTL ? 'إدارة المتطوعين' : 'Volunteer Management'}</h2>
              <div className="volunteers-actions">
                <button className="add-volunteer-btn" onClick={() => setShowVolunteerModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  {isRTL ? 'إضافة متطوع' : 'Add Volunteer'}
                </button>
                <button
                  className="add-volunteer-btn"
                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                  onClick={() => setShowOpportunityRequestModal(true)}
                  title={isRTL
                    ? 'إعداد طلب فرصة تطوعية جديدة وإرساله للمدير للاعتماد'
                    : 'Draft a new volunteer-opportunity request and send it to the manager'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  {isRTL ? 'طلب فرصة تطوعية' : 'Volunteer Opportunity Request'}
                </button>
                {volunteers.length > 0 && selectedIdsForPrint.size > 0 && (
                  <button
                    className="add-opportunity-btn"
                    style={{ background: '#7c3aed' }}
                    onClick={handlePrintSelectedVolunteerIDCards}
                    title={isRTL
                      ? `طباعة بطاقات المتطوعين المحددين (4 لكل A4)`
                      : `Print selected volunteer ID cards (4 per A4)`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    {isRTL
                      ? `طباعة المحددين (${selectedIdsForPrint.size})`
                      : `Print Selected (${selectedIdsForPrint.size})`}
                  </button>
                )}
                {volunteers.length > 0 && (
                  <button
                    className="add-opportunity-btn"
                    style={{ background: '#f97316' }}
                    onClick={handlePrintAllVolunteerIDCards}
                    title={isRTL ? 'طباعة بطاقات جميع المتطوعين (4 لكل A4)' : 'Print all volunteer ID cards (4 per A4)'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    {isRTL ? 'طباعة جميع البطاقات' : 'Print All Cards'}
                  </button>
                )}
                {volunteers.length > 0 && (
                  <button
                    className="add-opportunity-btn"
                    style={{ background: '#16a34a' }}
                    onClick={() => setShowExportModal(true)}
                    title={isRTL ? 'تصدير سجل الحضور لجميع المتطوعين' : 'Export attendance for all volunteers'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {isRTL ? 'تصدير الحضور' : 'Export Attendance'}
                  </button>
                )}
                {/* Attendance station moved to its own admin tab —
                    button removed intentionally from here. */}
                <button className="add-opportunity-btn" onClick={() => setShowOpportunityModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="18"/>
                    <line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                  {isRTL ? 'إضافة فرصة تطوع' : 'Add Opportunity'}
                </button>
                {volunteers.length > 0 && (
                  <button className="export-btn" onClick={handleExportAllVolunteers}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {isRTL ? 'تصدير الكل' : 'Export All'}
                  </button>
                )}
              </div>
            </div>

            {volunteers.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', margin: '0 0 12px 0',
                background: 'rgba(124, 58, 237, 0.06)',
                border: '1px solid rgba(124, 58, 237, 0.18)',
                borderRadius: 10, fontSize: 13, flexWrap: 'wrap'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700, color: '#4c1d95' }}>
                  <input
                    type="checkbox"
                    checked={volunteers.length > 0 && volunteers.every(v => selectedIdsForPrint.has(v.volunteerId))}
                    onChange={toggleSelectAllVolunteersForPrint}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span>{isRTL ? 'تحديد الكل للطباعة' : 'Select all for print'}</span>
                </label>
                <span style={{ color: '#6d28d9', fontSize: 12 }}>
                  {isRTL
                    ? `${selectedIdsForPrint.size} محدد · اضغط "طباعة المحددين" بالأعلى`
                    : `${selectedIdsForPrint.size} selected · click "Print Selected" above`}
                </span>
                {selectedIdsForPrint.size > 0 && (
                  <button
                    onClick={clearVolunteerPrintSelection}
                    style={{
                      marginInlineStart: 'auto',
                      padding: '4px 12px', borderRadius: 6,
                      border: '1px solid #c4b5fd', background: '#fff',
                      color: '#6d28d9', cursor: 'pointer', fontSize: 12,
                      fontWeight: 700, fontFamily: 'inherit'
                    }}
                  >
                    {isRTL ? 'إلغاء التحديد' : 'Clear selection'}
                  </button>
                )}
              </div>
            )}

            <MasterShareBar isRTL={isRTL} />

            <div className="volunteers-grid">
              {volunteers.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <p>{isRTL ? 'لا يوجد متطوعين' : 'No volunteers found'}</p>
                </div>
              ) : (
                volunteers.map(volunteer => (
                  <div
                    key={volunteer.volunteerId}
                    className="volunteer-card"
                    style={{
                      position: 'relative',
                      ...(selectedIdsForPrint.has(volunteer.volunteerId)
                        ? { outline: '2px solid #7c3aed', outlineOffset: -1 }
                        : {})
                    }}
                  >
                    <label
                      title={isRTL ? 'تحديد لطباعة البطاقة' : 'Select for card print'}
                      style={{
                        position: 'absolute', top: 10, insetInlineStart: 10,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', borderRadius: 8,
                        background: selectedIdsForPrint.has(volunteer.volunteerId) ? '#7c3aed' : 'rgba(255,255,255,0.95)',
                        border: '1px solid ' + (selectedIdsForPrint.has(volunteer.volunteerId) ? '#7c3aed' : '#e5e7eb'),
                        cursor: 'pointer', zIndex: 2,
                        color: selectedIdsForPrint.has(volunteer.volunteerId) ? '#fff' : '#475569',
                        fontSize: 11, fontWeight: 800, letterSpacing: 0.3
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIdsForPrint.has(volunteer.volunteerId)}
                        onChange={() => toggleSelectVolunteerForPrint(volunteer.volunteerId)}
                        style={{ width: 14, height: 14, cursor: 'pointer', margin: 0 }}
                      />
                      {selectedIdsForPrint.has(volunteer.volunteerId)
                        ? (isRTL ? '✓ محدد' : '✓ Selected')
                        : (isRTL ? 'تحديد' : 'Select')}
                    </label>
                    <div className="volunteer-header">
                      <div className="volunteer-avatar">
                        {volunteer.name?.charAt(0) || 'V'}
                      </div>
                      <div className="volunteer-info">
                        <h3>{volunteer.name}</h3>
                        <p>{volunteer.phone}</p>
                      </div>
                    </div>
                    <div className="volunteer-stats">
                      <div className="stat-item">
                        <div className="stat-value">{volunteer.totalOpportunities || 0}</div>
                        <div className="stat-label">{isRTL ? 'فرص' : 'Opportunities'}</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{volunteer.totalHours || 0}</div>
                        <div className="stat-label">{isRTL ? 'ساعة' : 'Hours'}</div>
                      </div>
                      <div className="stat-item">
                        <div className={`stat-value ${(volunteer.totalPoints || 0) > 0 ? 'positive' : (volunteer.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                          {(volunteer.totalPoints || 0) > 0 ? '+' : ''}{volunteer.totalPoints || 0}
                        </div>
                        <div className="stat-label">{isRTL ? 'نقاط' : 'Net Points'}</div>
                      </div>
                    </div>
                    {volunteer.opportunities && volunteer.opportunities.length > 0 && (
                      <div className="volunteer-opportunities">
                        <strong style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {isRTL ? 'آخر الفرص:' : 'Recent:'}
                        </strong>
                        {volunteer.opportunities.slice(0, 2).map(opp => (
                          <div key={opp.opportunityId} className="opportunity-item">
                            <span className="opportunity-title">
                              {opp.title}
                              {opp.dailyStartTime && opp.dailyEndTime && (
                                <span
                                  style={{
                                    marginInlineStart: 6,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#0369a1',
                                    background: '#e0f2fe',
                                    border: '1px solid #7dd3fc',
                                    padding: '1px 6px',
                                    borderRadius: 6,
                                    fontFamily: 'JetBrains Mono, ui-monospace, monospace'
                                  }}
                                  title={isRTL ? 'وقت يومي للتسجيل التلقائي' : 'Daily window for auto-marking'}
                                  dir="ltr"
                                >
                                  {opp.dailyStartTime}–{opp.dailyEndTime}
                                </span>
                              )}
                            </span>
                            <span className="opportunity-hours">{opp.totalHours}h</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="volunteer-card-actions">
                      <button
                        className="view-volunteer-btn"
                        onClick={() => handleViewVolunteer(volunteer)}
                        title={isRTL ? 'عرض التفاصيل — الملف الشخصي والتقييمات والفرص' : 'View details — profile, ratings, opportunities'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                        {isRTL ? 'عرض' : 'View'}
                      </button>
                      {/* Standalone attendance-log entry — QR-scanned rows
                          are the single source of truth for hours. The
                          "View" modal is intentionally read-only for
                          attendance; all manual editing happens here. */}
                      <button
                        className="rate-volunteer-btn"
                        onClick={() => openVolunteerLog(volunteer)}
                        title={isRTL ? 'سجل الحضور الكامل — تعديل والإضافة اليدوية' : 'Full attendance log — manual add / edit'}
                        style={{ background: '#dcfce7', color: '#166534' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
                        </svg>
                        {isRTL ? 'سجل الحضور' : 'History'}
                      </button>
                      <button
                        className="rate-volunteer-btn"
                        onClick={() => openEditVolunteer(volunteer)}
                        title={isRTL ? 'تعديل البيانات' : 'Edit info'}
                        style={{ background: '#eef2ff', color: '#4338ca' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9"/>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>
                        </svg>
                        {isRTL ? 'تعديل' : 'Edit'}
                      </button>
                      <button
                        className="export-volunteer-btn"
                        onClick={() => handlePrintVolunteerIDCard(volunteer)}
                        title={isRTL ? 'طباعة البطاقة' : 'Print ID Card'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="6 9 6 2 18 2 18 9"/>
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                          <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        {isRTL ? 'بطاقة' : 'Card'}
                      </button>
                      <button
                        className="export-volunteer-btn"
                        onClick={() => handleExportVolunteerHistory(volunteer)}
                        title={isRTL ? 'تصدير السجل' : 'Export History'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        {isRTL ? 'تصدير' : 'Export'}
                      </button>
                      <button
                        className="rate-volunteer-btn"
                        onClick={() => handleOpenVolunteerRating(volunteer)}
                        title={isRTL ? 'تقييم المتطوع' : 'Rate Volunteer'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                        </svg>
                        {isRTL ? 'تقييم' : 'Rate'}
                      </button>
                      <button
                        className="export-volunteer-btn"
                        onClick={() => setReceiptTarget(volunteer)}
                        title="سند استلام"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="16" rx="2"/>
                          <line x1="7" y1="9" x2="17" y2="9"/>
                          <line x1="7" y1="13" x2="17" y2="13"/>
                          <line x1="7" y1="17" x2="13" y2="17"/>
                        </svg>
                        {isRTL ? 'سند' : 'Receipt'}
                      </button>
                      <button
                        className="export-volunteer-btn"
                        onClick={() => setArchiveTarget(volunteer)}
                        title="سجل السندات"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 7l-9 9-5-5"/>
                          <path d="M4 4h16v4H4z"/>
                          <path d="M4 12h16v8H4z"/>
                        </svg>
                        {isRTL ? 'السجل' : 'Archive'}
                      </button>
                      <button
                        className="export-volunteer-btn contract-btn"
                        onClick={() => setContractTarget(volunteer)}
                        title="عقد تطوع"
                        style={{
                          background: 'linear-gradient(90deg, #991b1b, #dc2626)',
                          color: '#fff',
                          borderColor: '#991b1b'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="9" y1="13" x2="15" y2="13"/>
                          <line x1="9" y1="17" x2="15" y2="17"/>
                        </svg>
                        {isRTL ? 'عقد' : 'Contract'}
                      </button>
                      <button
                        className="delete-volunteer-btn"
                        onClick={() => handleDeleteVolunteer(volunteer.volunteerId)}
                        title={isRTL ? 'حذف المتطوع' : 'Delete Volunteer'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        {isRTL ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                    <VolunteerShareControls
                      volunteer={volunteer}
                      isRTL={isRTL}
                      onUpdated={handleShareUpdated}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

        {/* Volunteer-opportunity request modal */}
        {showOpportunityRequestModal && (
          <VolunteerOpportunityRequestModal onClose={() => setShowOpportunityRequestModal(false)} />
        )}

        {/* Volunteer Modal */}
        {showVolunteerModal && (
          <div className="modal-overlay" onClick={closeVolunteerModal}>
            <motion.div
              className="modal-content modern-modal volunteer-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="modern-modal-header volunteer-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{editingVolunteerId ? (isRTL ? 'تعديل بيانات المتطوع' : 'Edit Volunteer') : (isRTL ? 'متطوع جديد' : 'New Volunteer')}</h2>
                  <p>{editingVolunteerId ? (isRTL ? 'تحديث معلومات المتطوع وصورة الهوية' : 'Update volunteer info and ID photo') : (isRTL ? 'تسجيل متطوع جديد في النظام' : 'Register a new volunteer')}</p>
                </div>
                <button className="modal-close-modern" onClick={closeVolunteerModal}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                {/* Profile photo — separate from ID scan. Printed on the
                    QR ID card. Placed FIRST so it's the first thing
                    the admin sees on the form. */}
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="5"/>
                      <path d="M20 21v-2a7 7 0 0 0-14 0v2"/>
                    </svg>
                    <span>{isRTL ? 'الصورة الشخصية' : 'Profile Photo'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{
                      width: 100, height: 118,
                      borderRadius: 10,
                      border: `2px dashed ${volunteerForm.profilePhoto ? '#ea580c' : '#cbd5e1'}`,
                      background: volunteerForm.profilePhoto ? '#fff7ed' : '#f8fafc',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0
                    }}>
                      {volunteerForm.profilePhoto ? (
                        <img
                          src={volunteerForm.profilePhoto}
                          alt="profile"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: 36, color: '#94a3b8' }}>👤</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
                        {isRTL
                          ? 'تُطبع هذه الصورة على بطاقة QR الخاصة بالمتطوع. إن تُركت فارغة، تُستخدم صورة الهوية.'
                          : 'This photo prints on the volunteer\'s QR ID card. Falls back to ID photo if empty.'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <label style={{
                          padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                          background: '#ea580c', color: '#fff', fontWeight: 700, fontSize: 13
                        }}>
                          {volunteerForm.profilePhoto
                            ? (isRTL ? 'تغيير الصورة' : 'Change Photo')
                            : (isRTL ? 'رفع صورة شخصية' : 'Upload Profile Photo')}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 3 * 1024 * 1024) {
                                toast.error(isRTL ? 'الحد الأقصى 3MB' : 'Max 3MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => setVolunteerForm(prev => ({ ...prev, profilePhoto: reader.result }));
                              reader.readAsDataURL(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        {volunteerForm.profilePhoto && (
                          <button
                            type="button"
                            onClick={() => setVolunteerForm(prev => ({ ...prev, profilePhoto: '' }))}
                            style={{
                              padding: '9px 16px', borderRadius: 8, border: '1px solid #fecaca',
                              background: '#fee2e2', color: '#991b1b', cursor: 'pointer',
                              fontWeight: 700, fontSize: 13, fontFamily: 'inherit'
                            }}
                          >
                            {isRTL ? 'إزالة' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{isRTL ? 'المعلومات الشخصية' : 'Personal Information'}</span>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'الاسم' : 'Name'} <span className="required">*</span></label>
                    <div className="input-with-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        value={volunteerForm.name}
                        onChange={(e) => setVolunteerForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={isRTL ? 'الاسم الكامل' : 'Full name'}
                        className="modern-input-field"
                      />
                    </div>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'رقم الهوية' : 'National ID'} <span className="required">*</span></label>
                    <div className="input-with-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="16" rx="2"/>
                        <line x1="7" y1="8" x2="17" y2="8"/>
                        <line x1="7" y1="12" x2="13" y2="12"/>
                      </svg>
                      <input
                        type="text"
                        value={volunteerForm.nationalId}
                        onChange={(e) => setVolunteerForm(prev => ({ ...prev, nationalId: e.target.value }))}
                        placeholder={isRTL ? 'رقم الهوية الوطنية' : 'National ID number'}
                        className="modern-input-field"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'رقم الجوال' : 'Phone'} <span className="required">*</span></label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <input
                          type="tel"
                          value={volunteerForm.phone}
                          onChange={(e) => setVolunteerForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="05xxxxxxxx"
                          className="modern-input-field"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    <div className="form-group modern-input">
                      <label>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                      <div className="input-with-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <input
                          type="email"
                          value={volunteerForm.email}
                          onChange={(e) => setVolunteerForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="email@example.com"
                          className="modern-input-field"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>{isRTL ? 'صورة الهوية' : 'ID Photo'}</span>
                  </div>
                  <div className="photo-upload-area modern-upload">
                    {volunteerForm.nationalIdPhoto ? (
                      <div className="photo-preview">
                        <img src={volunteerForm.nationalIdPhoto} alt="ID" />
                        <button
                          className="remove-photo-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVolunteerForm(prev => ({ ...prev, nationalIdPhoto: '' }));
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <label className="photo-upload-label">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleVolunteerPhotoUpload}
                          style={{ display: 'none' }}
                        />
                        <div className="upload-content">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                          </svg>
                          <span className="upload-text">{isRTL ? 'انقر لرفع صورة الهوية' : 'Click to upload ID photo'}</span>
                          <span className="upload-hint">{isRTL ? 'PNG, JPG حتى 5MB' : 'PNG, JPG up to 5MB'}</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={closeVolunteerModal}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit volunteer-submit"
                  onClick={handleCreateVolunteer}
                  disabled={volunteerLoading || !volunteerForm.name || !volunteerForm.nationalId || !volunteerForm.phone}
                >
                  {volunteerLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {editingVolunteerId
                        ? (isRTL ? 'حفظ التعديلات' : 'Save Changes')
                        : (isRTL ? 'إضافة متطوع' : 'Add Volunteer')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Opportunity Modal */}
        {showOpportunityModal && (
          <div className="modal-overlay" onClick={() => setShowOpportunityModal(false)}>
            <motion.div
              className="modal-content modern-modal opportunity-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="modern-modal-header opportunity-header-gradient">
                <div className="modal-header-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="18"/>
                    <line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                </div>
                <div className="modal-header-text">
                  <h2>{isRTL ? 'فرصة تطوع جديدة' : 'New Opportunity'}</h2>
                  <p>{isRTL ? 'إنشاء فرصة تطوع للمتطوعين' : 'Create a volunteer opportunity'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowOpportunityModal(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="modern-modal-body">
                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span>{isRTL ? 'اختيار المتطوعين' : 'Select Volunteers'}</span>
                  </div>
                  <div className="select-all-toggle">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={opportunityForm.selectAllVolunteers}
                        onChange={(e) => {
                          const selectAll = e.target.checked;
                          setOpportunityForm(prev => ({
                            ...prev,
                            selectAllVolunteers: selectAll,
                            volunteerIds: selectAll ? volunteers.map(v => v.volunteerId) : []
                          }));
                        }}
                        className="toggle-checkbox"
                      />
                      <span className="toggle-switch"></span>
                      <span className="toggle-text">{isRTL ? 'تعيين لجميع المتطوعين' : 'Assign to all volunteers'}</span>
                    </label>
                  </div>
                  {!opportunityForm.selectAllVolunteers && (
                    <div className="volunteer-checkbox-list modern-list">
                      {volunteers.map(v => (
                        <label key={v.volunteerId} className={`volunteer-checkbox-item modern ${opportunityForm.volunteerIds.includes(v.volunteerId) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={opportunityForm.volunteerIds.includes(v.volunteerId)}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const newVolunteerIds = isChecked
                                ? [...opportunityForm.volunteerIds, v.volunteerId]
                                : opportunityForm.volunteerIds.filter(id => id !== v.volunteerId);
                              setOpportunityForm(prev => ({
                                ...prev,
                                volunteerIds: newVolunteerIds,
                                volunteerId: newVolunteerIds.length === 1 ? newVolunteerIds[0] : ''
                              }));
                            }}
                          />
                          <div className="volunteer-checkbox-avatar">
                            {v.name?.charAt(0) || 'V'}
                          </div>
                          <div className="volunteer-checkbox-info">
                            <span className="volunteer-checkbox-name">{v.name}</span>
                            <span className="volunteer-checkbox-id">{v.nationalId}</span>
                          </div>
                          <div className="checkbox-indicator">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {!opportunityForm.selectAllVolunteers && opportunityForm.volunteerIds.length > 0 && (
                    <div className="selected-count-badge">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                      </svg>
                      {isRTL
                        ? `تم تحديد ${opportunityForm.volunteerIds.length} متطوع`
                        : `${opportunityForm.volunteerIds.length} volunteer${opportunityForm.volunteerIds.length > 1 ? 's' : ''} selected`}
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <span>{isRTL ? 'تفاصيل الفرصة' : 'Opportunity Details'}</span>
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'عنوان الفرصة' : 'Opportunity Title'} <span className="required">*</span></label>
                    <input
                      type="text"
                      value={opportunityForm.title}
                      onChange={(e) => setOpportunityForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder={isRTL ? 'عنوان فرصة التطوع' : 'Opportunity title'}
                      className="modern-input-field"
                    />
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'الوصف' : 'Description'}</label>
                    <textarea
                      value={opportunityForm.description}
                      onChange={(e) => setOpportunityForm(prev => ({ ...prev, description: e.target.value }))}
                      rows="3"
                      placeholder={isRTL ? 'وصف فرصة التطوع...' : 'Opportunity description...'}
                      className="modern-textarea"
                    />
                  </div>
                </div>

                <div className="form-section">
                  <div className="section-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>{isRTL ? 'فترة التطوع' : 'Volunteer Period'}</span>
                  </div>
                  <div className="period-grid">
                    <div className="period-box start">
                      <span className="period-label">{isRTL ? 'البداية' : 'Start'}</span>
                      <input
                        type="date"
                        value={opportunityForm.startDate}
                        onChange={(e) => setOpportunityForm(prev => ({ ...prev, startDate: e.target.value }))}
                        className="modern-input-field"
                      />
                    </div>
                    <div className={`period-arrow ${isRTL ? 'rtl' : ''}`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points={isRTL ? "12 5 5 12 12 19" : "12 5 19 12 12 19"}/>
                      </svg>
                    </div>
                    <div className="period-box end">
                      <span className="period-label">{isRTL ? 'النهاية' : 'End'}</span>
                      <input
                        type="date"
                        value={opportunityForm.endDate}
                        onChange={(e) => setOpportunityForm(prev => ({ ...prev, endDate: e.target.value }))}
                        className="modern-input-field"
                      />
                    </div>
                  </div>
                  {/* Daily hours are no longer asked upfront — hours are
                      logged per day in the volunteer profile after the
                      opportunity is created. */}

                  {/* Optional daily time window. When both are set, the
                      QR check-out auto-marks the volunteer present in
                      this chance if their check-in/out overlaps this
                      window — enabling one volunteer × multiple chances
                      per day off a single scan. Left blank → chance
                      stays fully manual (old behaviour). */}
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center' }}>
                    <div className="period-box start">
                      <span className="period-label">
                        {isRTL ? 'وقت البداية (اختياري)' : 'Start Time (optional)'}
                      </span>
                      <input
                        type="time"
                        value={opportunityForm.dailyStartTime}
                        onChange={(e) => setOpportunityForm(prev => ({ ...prev, dailyStartTime: e.target.value }))}
                        className="modern-input-field"
                      />
                    </div>
                    <div style={{ color: '#94a3b8', fontWeight: 700 }}>→</div>
                    <div className="period-box end">
                      <span className="period-label">
                        {isRTL ? 'وقت النهاية (اختياري)' : 'End Time (optional)'}
                      </span>
                      <input
                        type="time"
                        value={opportunityForm.dailyEndTime}
                        onChange={(e) => setOpportunityForm(prev => ({ ...prev, dailyEndTime: e.target.value }))}
                        className="modern-input-field"
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '8px 0 0' }}>
                    {isRTL
                      ? 'إذا حُدد الوقت اليومي، سيتم تسجيل حضور المتطوع تلقائياً في هذه الفرصة عند مسح QR الخروج إذا تداخل وقت زيارته مع هذه الفترة.'
                      : 'When both times are set, QR check-out auto-marks the volunteer present in this chance if their visit overlaps the window.'}
                  </p>
                </div>

                <div className="info-note-modern">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <p>
                    {isRTL
                      ? 'ملاحظة: يمكنك تقييم المتطوع بعد انتهاء فرصة التطوع'
                      : 'Note: You can rate the volunteer after the opportunity is completed'}
                  </p>
                </div>
              </div>
              <div className="modern-modal-footer">
                <button className="btn-cancel" onClick={() => setShowOpportunityModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit opportunity-submit"
                  onClick={handleCreateOpportunity}
                  disabled={volunteerLoading || (!opportunityForm.selectAllVolunteers && opportunityForm.volunteerIds.length === 0) || !opportunityForm.title || !opportunityForm.startDate || !opportunityForm.endDate}
                >
                  {volunteerLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'إنشاء فرصة التطوع' : 'Create Opportunity'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Volunteer Detail Modal */}
        {showVolunteerDetailModal && selectedVolunteer && (
          <div className="modal-overlay" onClick={() => setShowVolunteerDetailModal(false)}>
            <motion.div
              className="modal-content volunteer-detail-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'معلومات المتطوع' : 'Volunteer Details'}</h2>
                <button className="close-btn" onClick={() => setShowVolunteerDetailModal(false)}>×</button>
              </div>
              <div className="modal-body volunteer-detail-body">
                {/* Volunteer Profile Section */}
                <div className="volunteer-detail-profile">
                  <div className="volunteer-detail-avatar">
                    {selectedVolunteer.nationalIdPhoto ? (
                      <img src={selectedVolunteer.nationalIdPhoto} alt="ID" className="volunteer-id-photo" />
                    ) : (
                      <div className="avatar-placeholder">
                        {selectedVolunteer.name?.charAt(0) || 'V'}
                      </div>
                    )}
                  </div>
                  <div className="volunteer-detail-info">
                    <h3>{selectedVolunteer.name}</h3>
                    <div className="info-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="9" cy="10" r="2"/>
                        <path d="M15 8h2"/>
                        <path d="M15 12h2"/>
                        <path d="M7 16h10"/>
                      </svg>
                      <span>{isRTL ? 'رقم الهوية: ' : 'National ID: '}{selectedVolunteer.nationalId}</span>
                    </div>
                    <div className="info-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>
                      </svg>
                      <span>{selectedVolunteer.phone}</span>
                    </div>
                    {selectedVolunteer.email && (
                      <div className="info-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <span>{selectedVolunteer.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Section */}
                <div className="volunteer-detail-stats">
                  <div className="detail-stat">
                    <div className="detail-stat-value">{selectedVolunteer.totalOpportunities || 0}</div>
                    <div className="detail-stat-label">{isRTL ? 'فرص تطوعية' : 'Opportunities'}</div>
                  </div>
                  <div className="detail-stat">
                    <div className="detail-stat-value">{selectedVolunteer.totalHours || 0}</div>
                    <div className="detail-stat-label">{isRTL ? 'ساعة تطوع' : 'Total Hours'}</div>
                  </div>
                  <div className="detail-stat">
                    <div className={`detail-stat-value ${(selectedVolunteer.totalPoints || 0) > 0 ? 'positive' : (selectedVolunteer.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                      {(selectedVolunteer.totalPoints || 0) > 0 ? '+' : ''}{selectedVolunteer.totalPoints || 0}
                    </div>
                    <div className="detail-stat-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</div>
                  </div>
                </div>

                {/* Points Breakdown */}
                {(selectedVolunteer.totalAwards > 0 || selectedVolunteer.totalDeductions > 0) && (
                  <div className="points-breakdown">
                    <span className="awards">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      +{selectedVolunteer.totalAwards || 0} {isRTL ? 'منح' : 'awards'}
                    </span>
                    <span className="deductions">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      -{selectedVolunteer.totalDeductions || 0} {isRTL ? 'خصم' : 'deductions'}
                    </span>
                  </div>
                )}

                {/* Ratings History */}
                {selectedVolunteer.ratings && selectedVolunteer.ratings.length > 0 && (
                  <div className="volunteer-history-section">
                    <h4>{isRTL ? 'سجل التقييمات' : 'Ratings History'}</h4>
                    <div className="ratings-history-list">
                      {selectedVolunteer.ratings.map(rating => (
                        <div key={rating.ratingId} className={`rating-history-item ${rating.type}`}>
                          <div className="rating-history-header">
                            <span className={`rating-points ${rating.type}`}>
                              {rating.type === 'deduction' ? `-${rating.points}` : `+${rating.points}`}
                            </span>
                            <span className="rating-date">{rating.ratingDate}</span>
                            <button
                              className="delete-rating-btn"
                              onClick={() => handleDeleteVolunteerRating(rating.ratingId)}
                              title={isRTL ? 'حذف' : 'Delete'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                              </svg>
                            </button>
                          </div>
                          {rating.criteria && (
                            <div className="rating-criteria">{rating.criteria}</div>
                          )}
                          {rating.notes && (
                            <div className="rating-notes">{rating.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ID Photo Full View */}
                {selectedVolunteer.nationalIdPhoto && (
                  <div className="volunteer-id-section">
                    <h4>{isRTL ? 'صورة الهوية' : 'National ID Photo'}</h4>
                    <img
                      src={selectedVolunteer.nationalIdPhoto}
                      alt="National ID"
                      className="volunteer-id-full"
                      onClick={() => window.open(selectedVolunteer.nationalIdPhoto, '_blank')}
                    />
                  </div>
                )}

                {/* Public share URL — one-click preview so admin can send
                    the same link the reviewer sees, without hunting for it.
                    The full chance history + attendance breakdown live on
                    that page, not in this modal. */}
                {selectedVolunteer.shareEnabled && selectedVolunteer.shareToken && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 12, padding: '12px 16px', margin: '16px 0',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                    border: '1.5px solid #93c5fd', borderRadius: 12
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: 14 }}>
                        🔗 {isRTL ? 'رابط المتطوع العام' : 'Public volunteer URL'}
                      </div>
                      <div style={{ fontSize: 12, color: '#1e40af', marginTop: 2 }}>
                        {isRTL
                          ? 'يعرض جميع الفرص التطوعية وسجل الحضور اليومي — استخدمه لمشاركة النشاط مع الجهات الداعمة.'
                          : 'Shows every chance + per-day attendance — share with sponsors / reviewers.'}
                      </div>
                    </div>
                    <a
                      href={`/public/volunteer/${selectedVolunteer.shareToken}`}
                      target="_blank" rel="noreferrer"
                      style={{
                        padding: '9px 20px', border: 'none',
                        background: 'linear-gradient(135deg, #2563eb, #1e40af)',
                        color: '#fff', borderRadius: 10, cursor: 'pointer',
                        fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap',
                        textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.30)'
                      }}
                    >
                      {isRTL ? 'فتح الرابط ←' : 'Open URL →'}
                    </a>
                  </div>
                )}

                {/* Opportunities History — READ-ONLY list. Inline per-day
                    attendance editor was removed because it duplicated
                    the QR log (which is now the single source of truth
                    for hours). Chance breakdown + attendance visualization
                    live on the volunteer's public URL. */}
                <div className="volunteer-history-section">
                  <h4>{isRTL ? 'سجل التطوع' : 'Volunteering History'}</h4>
                  {(!selectedVolunteer.opportunities || selectedVolunteer.opportunities.length === 0) ? (
                    <p className="no-history">{isRTL ? 'لا توجد فرص تطوعية مسجلة' : 'No volunteering history'}</p>
                  ) : (
                    <div className="history-list">
                      {selectedVolunteer.opportunities.map(opp => (
                        <div key={opp.opportunityId} className="history-item">
                          <div className="history-item-header">
                            <strong>{opp.title}</strong>
                            <span className={`status-badge ${opp.status || 'active'}`}>
                              {opp.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                               opp.status === 'cancelled' ? (isRTL ? 'ملغى' : 'Cancelled') :
                               (isRTL ? 'نشط' : 'Active')}
                            </span>
                          </div>
                          {opp.description && (
                            <p className="history-description">{opp.description}</p>
                          )}
                          <div className="history-meta">
                            <span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                              {opp.startDate} → {opp.endDate}
                            </span>
                          </div>
                          {/* Compact chance summary — total hours + status.
                              Full per-day breakdown is on the public URL. */}
                          <div style={{
                            display: 'flex', gap: 8, flexWrap: 'wrap',
                            margin: '10px 0', fontSize: 12
                          }}>
                            {opp.dailyStartTime && opp.dailyEndTime && (
                              <span style={{
                                padding: '3px 10px', borderRadius: 999,
                                background: '#eff6ff', color: '#1e40af',
                                fontWeight: 700, fontFamily: 'JetBrains Mono, monospace'
                              }}>
                                🕒 {opp.dailyStartTime} – {opp.dailyEndTime}
                              </span>
                            )}
                            <span style={{
                              padding: '3px 10px', borderRadius: 999,
                              background: '#f0fdf4', color: '#166534',
                              fontWeight: 700
                            }}>
                              ⏱ {Number(opp.totalHours || 0)} {isRTL ? 'ساعة' : 'h'} · {Number(opp.dailyHours || 0)} {isRTL ? 'س/يوم' : 'h/day'}
                            </span>
                            {opp.hoursAdjustment ? (
                              <span style={{
                                padding: '3px 10px', borderRadius: 999,
                                background: '#fef3c7', color: '#92400e', fontWeight: 700
                              }}>
                                ± {opp.hoursAdjustment}h
                              </span>
                            ) : null}
                          </div>
                          <div className="history-actions">
                            <button
                              className="adjust-hours-btn"
                              onClick={() => handleOpenHoursAdjust(opp)}
                              title={isRTL ? 'تعديل الساعات' : 'Adjust Hours'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="16"/>
                                <line x1="8" y1="12" x2="16" y2="12"/>
                              </svg>
                              {isRTL ? 'تعديل الساعات' : 'Adjust Hours'}
                            </button>
                            <button
                              className="rate-opportunity-btn"
                              onClick={() => handleOpenVolunteerRating(selectedVolunteer, opp)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                              </svg>
                              {isRTL ? 'تقييم' : 'Rate'}
                            </button>
                            <button
                              className="print-certificate-btn"
                              onClick={() => handlePrintVolunteerCertificate(selectedVolunteer, opp)}
                              title={isRTL ? 'طباعة شهادة' : 'Print Certificate'}
                              style={{
                                background: 'linear-gradient(135deg, #e02529, #c41e24)',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px'
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="8" r="7"/>
                                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                              </svg>
                              {isRTL ? 'شهادة' : 'Certificate'}
                            </button>
                            <button
                              onClick={() => handleDeleteOpportunity(opp.opportunityId)}
                              title={isRTL ? 'حذف الفرصة' : 'Delete Opportunity'}
                              style={{
                                background: '#fee2e2', color: '#991b1b', border: 'none',
                                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px',
                                fontSize: '12px', fontWeight: 700, fontFamily: 'inherit'
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                              </svg>
                              {isRTL ? 'حذف' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
                <button
                  className="modal-btn delete"
                  onClick={() => handleDeleteVolunteer(selectedVolunteer.volunteerId)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  {isRTL ? 'حذف' : 'Delete'}
                </button>
                <button
                  className="modal-btn export"
                  onClick={() => handleExportVolunteerHistory(selectedVolunteer)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {isRTL ? 'تصدير' : 'Export'}
                </button>
                <button
                  className="modal-btn"
                  onClick={() => handlePrintVolunteerProfile(selectedVolunteer)}
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  {isRTL ? 'طباعة الملف' : 'Print Profile'}
                </button>
                <button
                  className="modal-btn"
                  onClick={() => {
                    if (selectedVolunteer.opportunities && selectedVolunteer.opportunities.length > 0) {
                      // If there's only one opportunity, print it directly
                      if (selectedVolunteer.opportunities.length === 1) {
                        handlePrintVolunteerCertificate(selectedVolunteer, selectedVolunteer.opportunities[0]);
                      } else {
                        // Show selection modal or use first completed opportunity
                        const completedOpp = selectedVolunteer.opportunities.find(o => o.status === 'completed') || selectedVolunteer.opportunities[0];
                        handlePrintVolunteerCertificate(selectedVolunteer, completedOpp);
                      }
                    } else {
                      toast.error(isRTL ? 'لا توجد فرص تطوعية لطباعة الشهادة' : 'No opportunities to print certificate');
                    }
                  }}
                  style={{ background: 'linear-gradient(135deg, #e02529, #c41e24)', color: 'white' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="7"/>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                  </svg>
                  {isRTL ? 'طباعة شهادة' : 'Print Certificate'}
                </button>
                <button className="modal-btn cancel" onClick={() => setShowVolunteerDetailModal(false)}>
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Volunteer Rating Modal */}
        {showVolunteerRatingModal && selectedVolunteer && (
          <div className="modal-overlay" onClick={() => setShowVolunteerRatingModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'تقييم المتطوع' : 'Rate Volunteer'}</h2>
                <button className="close-btn" onClick={() => setShowVolunteerRatingModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="opportunity-info-summary">
                  <h4>{selectedVolunteer.name}</h4>
                  {selectedOpportunity && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {isRTL ? 'فرصة: ' : 'Opportunity: '}{selectedOpportunity.title}
                    </p>
                  )}
                </div>

                {/* Rating Type Toggle (Award/Deduction) */}
                <div className="form-group">
                  <label>{isRTL ? 'نوع التقييم' : 'Rating Type'}</label>
                  <div className="rating-type-toggle">
                    <button
                      type="button"
                      className={`rating-type-btn award ${volunteerRatingForm.type === 'award' ? 'active' : ''}`}
                      onClick={() => setVolunteerRatingForm(prev => ({ ...prev, type: 'award' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      <span>{isRTL ? 'منح نقاط' : 'Award'}</span>
                    </button>
                    <button
                      type="button"
                      className={`rating-type-btn deduction ${volunteerRatingForm.type === 'deduction' ? 'active' : ''}`}
                      onClick={() => setVolunteerRatingForm(prev => ({ ...prev, type: 'deduction' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      <span>{isRTL ? 'خصم نقاط' : 'Deduction'}</span>
                    </button>
                  </div>
                </div>

                {/* Points Selector (1-5) */}
                <div className="form-group">
                  <label>{isRTL ? 'عدد النقاط' : 'Number of Points'}</label>
                  <div className="points-selector">
                    {[1, 2, 3, 4, 5].map(num => (
                      <button
                        key={num}
                        type="button"
                        className={`point-btn ${volunteerRatingForm.points === num ? 'active' : ''} ${volunteerRatingForm.type}`}
                        onClick={() => setVolunteerRatingForm(prev => ({ ...prev, points: num }))}
                      >
                        {volunteerRatingForm.type === 'deduction' ? `-${num}` : `+${num}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'المعيار' : 'Criteria'}</label>
                  <select
                    value={volunteerRatingForm.criteria}
                    onChange={(e) => setVolunteerRatingForm(prev => ({ ...prev, criteria: e.target.value }))}
                    className="criteria-select"
                  >
                    {criteriaOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'التاريخ' : 'Date'}</label>
                  <input
                    type="date"
                    value={volunteerRatingForm.ratingDate}
                    onChange={(e) => setVolunteerRatingForm(prev => ({ ...prev, ratingDate: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                  <textarea
                    value={volunteerRatingForm.notes}
                    onChange={(e) => setVolunteerRatingForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder={isRTL ? 'ملاحظات حول الأداء...' : 'Performance notes...'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowVolunteerRatingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateVolunteerRating}
                  disabled={volunteerLoading}
                >
                  {volunteerLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التقييم' : 'Save Rating')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Hours Adjustment Modal */}
        {showHoursAdjustModal && (
          <div className="modal-overlay" onClick={() => setShowHoursAdjustModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'تعديل ساعات التطوع' : 'Adjust Volunteering Hours'}</h2>
                <button className="close-btn" onClick={() => setShowHoursAdjustModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{isRTL ? 'قيمة التعديل (ساعات)' : 'Adjustment Value (hours)'}</label>
                  <div className="hours-adjustment-input">
                    <button
                      type="button"
                      className="adjust-btn decrease"
                      onClick={() => setHoursAdjustForm(prev => ({ ...prev, adjustment: prev.adjustment - 1 }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                    <input
                      type="number"
                      value={hoursAdjustForm.adjustment}
                      onChange={(e) => setHoursAdjustForm(prev => ({ ...prev, adjustment: parseFloat(e.target.value) || 0 }))}
                      className="adjustment-value-input"
                    />
                    <button
                      type="button"
                      className="adjust-btn increase"
                      onClick={() => setHoursAdjustForm(prev => ({ ...prev, adjustment: prev.adjustment + 1 }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  </div>
                  <small className="adjustment-hint">
                    {isRTL ? 'أدخل رقم موجب للزيادة أو سالب للنقصان' : 'Enter positive number to add or negative to subtract hours'}
                  </small>
                </div>
                <div className="form-group">
                  <label>{isRTL ? 'سبب التعديل' : 'Reason for Adjustment'}</label>
                  <textarea
                    value={hoursAdjustForm.reason}
                    onChange={(e) => setHoursAdjustForm(prev => ({ ...prev, reason: e.target.value }))}
                    rows="3"
                    placeholder={isRTL ? 'أدخل سبب تعديل الساعات...' : 'Enter reason for hours adjustment...'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowHoursAdjustModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleAdjustHours}
                  disabled={hoursAdjustForm.adjustment === 0}
                >
                  {isRTL ? 'حفظ التعديل' : 'Save Adjustment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      <UnifiedAttendancePage
        open={volunteerAttendanceMode}
        onClose={() => setVolunteerAttendanceMode(false)}
        isRTL={isRTL}
      />

      {/* Per-volunteer attendance history modal */}
      {showLogModal && logVolunteer && (
        <div className="mawhba-modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="mawhba-modal mawhba-log-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📅 {isRTL ? `سجل حضور المتطوع — ${logVolunteer.name}` : `Attendance History — ${logVolunteer.name}`}</h3>

            {/* Volunteer profile block — mirrors the public share page so
                the admin sees the same identifying info + program +
                period + Drive link that the external reviewer sees. */}
            {(() => {
              const prog = logVolunteer.summerProgram;
              const progColor = prog?.color || null;
              const isoDate = (v) => v ? String(v).slice(0, 10) : '';
              const effFrom = isoDate(logVolunteer.shareFromDate) || isoDate(prog?.startDate);
              const effTo = isoDate(logVolunteer.shareToDate) || isoDate(prog?.endDate);
              const publicUrl = logVolunteer.shareEnabled && logVolunteer.shareToken
                ? `${window.location.origin}/public/volunteer/${logVolunteer.shareToken}`
                : null;
              return (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '12px 14px',
                  margin: '8px 0 12px',
                  fontSize: 13
                }}>
                  {/* Row 1 — name + program chip + public link */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <strong style={{ fontSize: 15, color: '#0f172a' }}>{logVolunteer.name}</strong>
                    {prog && (
                      <span style={{
                        padding: '3px 10px', borderRadius: 999,
                        fontSize: 11, fontWeight: 700,
                        background: progColor ? progColor + '18' : '#e2e8f0',
                        color: progColor || '#475569',
                        border: `1px solid ${progColor ? progColor + '55' : '#cbd5e1'}`
                      }}>
                        {prog.name}
                      </span>
                    )}
                    {publicUrl && (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          marginInlineStart: 'auto',
                          padding: '4px 10px', borderRadius: 6,
                          background: '#EE2329', color: '#fff',
                          fontSize: 11, fontWeight: 700,
                          textDecoration: 'none'
                        }}
                        title={isRTL ? 'فتح التقرير العام كما يراه المراجع' : 'Open the public report'}
                      >
                        {isRTL ? '↗ التقرير العام' : '↗ Public report'}
                      </a>
                    )}
                  </div>

                  {/* Row 2 — identity grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 10
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isRTL ? 'رقم الهوية' : 'National ID'}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: '#0f172a', marginTop: 2 }} dir="ltr">
                        {logVolunteer.nationalId || '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isRTL ? 'الجوال' : 'Phone'}
                      </div>
                      <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: '#0f172a', marginTop: 2 }} dir="ltr">
                        {logVolunteer.phone || '—'}
                      </div>
                    </div>
                    {logVolunteer.email && (
                      <div>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {isRTL ? 'البريد' : 'Email'}
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: '#0f172a', marginTop: 2, wordBreak: 'break-all' }} dir="ltr">
                          {logVolunteer.email}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 3 — period + drive URL */}
                  {(effFrom || effTo || logVolunteer.driveUrl) && (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                      {(effFrom || effTo) && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px', borderRadius: 6,
                          background: '#fef2f2', color: '#b91c1c',
                          border: '1px solid #fecaca',
                          fontSize: 12, fontWeight: 600
                        }}>
                          <span>📅</span>
                          {isRTL ? 'الفترة:' : 'Period:'}
                          <b dir="ltr">{effFrom || '…'}</b>
                          →
                          <b dir="ltr">{effTo || '…'}</b>
                        </span>
                      )}
                      {logVolunteer.driveUrl && (
                        <a
                          href={logVolunteer.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px', borderRadius: 6,
                            background: '#eff6ff', color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontSize: 12, fontWeight: 700,
                            textDecoration: 'none'
                          }}
                        >
                          📁 {isRTL ? 'فتح مجلد Drive' : 'Open Drive folder'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Chance filter — narrows the log to a single opportunity
                so admin can view / edit / delete the days that belong
                to that chance in isolation. All actions (pencil, ↩, ×)
                still operate on the underlying VolunteerAttendance row. */}
            {logVolunteer?.opportunities?.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '10px 12px', margin: '0 0 10px',
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8
              }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>
                  {isRTL ? 'عرض حسب الفرصة:' : 'Filter by chance:'}
                </label>
                <select
                  value={logChanceFilter}
                  onChange={(e) => setLogChanceFilter(e.target.value)}
                  style={{
                    flex: '1 1 240px', padding: '6px 10px',
                    borderRadius: 6, border: '1px solid #93c5fd',
                    fontFamily: 'inherit', fontSize: 13
                  }}
                >
                  <option value="all">
                    {isRTL
                      ? `الكل (${logRecords.length})`
                      : `All (${logRecords.length})`}
                  </option>
                  {logVolunteer.opportunities.map(o => (
                    <option key={o.opportunityId} value={o.opportunityId}>
                      {o.title}
                      {o.dailyStartTime && o.dailyEndTime
                        ? ` — ${o.dailyStartTime}–${o.dailyEndTime}`
                        : ''}
                    </option>
                  ))}
                </select>
                {logChanceFilter !== 'all' && (
                  <button
                    onClick={() => setLogChanceFilter('all')}
                    className="mawhba-btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                  >
                    {isRTL ? 'إظهار الكل' : 'Show all'}
                  </button>
                )}
                {logChanceFilter !== 'all' && (
                  <span style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>
                    {isRTL
                      ? `المعروض: ${filteredLogRecords.length}`
                      : `Shown: ${filteredLogRecords.length}`}
                  </span>
                )}
              </div>
            )}

            {/* Manual add — for past days the volunteer never scanned.
                Deliberately near the top so admin sees it before
                scrolling through the rows. */}
            <div style={{ margin: '0 0 12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {!showAddManual ? (
                <button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setManualForm({ opportunityId: '', date: today, checkInAt: '', checkOutAt: '' });
                    setShowAddManual(true);
                  }}
                  className="mawhba-btn-secondary"
                  style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}
                >
                  + {isRTL ? 'إضافة سجل يدوي' : 'Add manual record'}
                </button>
              ) : (() => {
                const opps = logVolunteer?.opportunities || [];
                const pickedOpp = opps.find(o => o.opportunityId === manualForm.opportunityId);
                return (
                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end',
                    padding: 10, borderRadius: 8,
                    background: '#f0fdf4', border: '1.5px solid #86efac',
                    width: '100%'
                  }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, minWidth: 200, flex: '1 1 220px' }}>
                      <span style={{ fontWeight: 700, color: '#166534' }}>
                        {isRTL ? 'الفرصة التطوعية' : 'Volunteer chance'}
                      </span>
                      <select
                        value={manualForm.opportunityId}
                        onChange={(e) => pickManualOpportunity(e.target.value)}
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #86efac', fontFamily: 'inherit' }}
                      >
                        <option value="">
                          {isRTL ? '— بدون فرصة محددة —' : '— No specific chance —'}
                        </option>
                        {opps.map(o => (
                          <option key={o.opportunityId} value={o.opportunityId}>
                            {o.title}
                            {o.dailyStartTime && o.dailyEndTime
                              ? ` (${o.dailyStartTime}–${o.dailyEndTime})`
                              : ''}
                          </option>
                        ))}
                      </select>
                      {pickedOpp && (
                        <span style={{ fontSize: 10, color: '#166534', fontWeight: 500 }}>
                          {isRTL ? 'مدى الفرصة: ' : 'Range: '}
                          <b dir="ltr">{pickedOpp.startDate}</b> → <b dir="ltr">{pickedOpp.endDate}</b>
                        </span>
                      )}
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#166534' }}>
                        {isRTL ? 'التاريخ' : 'Date'}
                      </span>
                      <input
                        type="date"
                        value={manualForm.date}
                        min={pickedOpp?.startDate || undefined}
                        max={pickedOpp?.endDate || undefined}
                        onChange={(e) => setManualForm(f => ({ ...f, date: e.target.value }))}
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #86efac' }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#166534' }}>
                        {isRTL ? 'وقت الدخول' : 'Check-in'}
                      </span>
                      <input
                        type="time"
                        value={manualForm.checkInAt}
                        onChange={(e) => setManualForm(f => ({ ...f, checkInAt: e.target.value }))}
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #86efac', width: 110 }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: '#166534' }}>
                        {isRTL ? 'وقت الخروج' : 'Check-out'}
                      </span>
                      <input
                        type="time"
                        value={manualForm.checkOutAt}
                        onChange={(e) => setManualForm(f => ({ ...f, checkOutAt: e.target.value }))}
                        style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #86efac', width: 110 }}
                      />
                    </label>
                    <button
                      onClick={submitManualAttendance}
                      disabled={savingManual}
                      className="mawhba-btn-primary"
                      style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}
                    >
                      {savingManual ? '…' : (isRTL ? 'حفظ' : 'Save')}
                    </button>
                    <button
                      onClick={() => setShowAddManual(false)}
                      disabled={savingManual}
                      className="mawhba-btn-secondary"
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                );
              })()}
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {isRTL
                  ? 'لتسجيل يوم لم يمسح فيه المتطوع الباركود. اختيار الفرصة يعبّئ الأوقات تلقائياً؛ يمكنك تركه فارغاً لسجل عام.'
                  : 'For days the volunteer never scanned. Picking a chance auto-fills the times; leave blank for a general record.'}
              </span>
            </div>

            <div className="mawhba-log-summary">
              <div>
                <span>{isRTL ? 'إجمالي الأيام' : 'Total days'}</span>
                <b>{filteredLogRecords.length}</b>
              </div>
              <div>
                <span>{isRTL ? 'مكتملة' : 'Completed'}</span>
                <b>{filteredLogRecords.filter(r => r.checkInAt && r.checkOutAt).length}</b>
              </div>
              <div>
                <span>{isRTL ? 'لم يخرج بعد' : 'Still in'}</span>
                <b>{filteredLogRecords.filter(r => r.checkInAt && !r.checkOutAt).length}</b>
              </div>
              <div>
                <span>
                  {logChanceOpp
                    ? (isRTL ? 'الساعات ضمن الفرصة' : 'Hours within chance')
                    : (isRTL ? 'إجمالي الوقت' : 'Total time')}
                </span>
                <b>
                  {(() => {
                    const total = filteredLogRecords.reduce((s, r) => {
                      const chMin = chanceRelativeMin(r);
                      return s + (chMin != null ? chMin : (durationMin(r) || 0));
                    }, 0);
                    return `${Math.floor(total / 60)}h ${total % 60}m`;
                  })()}
                </b>
              </div>
            </div>

            <div className="mawhba-log-table-wrap">
              {logLoading ? (
                <div className="mawhba-empty">{isRTL ? 'جارٍ التحميل...' : 'Loading...'}</div>
              ) : filteredLogRecords.length === 0 ? (
                <div className="mawhba-empty">
                  {logRecords.length === 0
                    ? (isRTL ? 'لا يوجد سجل حضور بعد' : 'No attendance records yet')
                    : (isRTL ? 'لا يوجد سجل ضمن هذه الفرصة' : 'No records inside this chance')}
                </div>
              ) : (
                <table className="mawhba-log-table">
                  <thead>
                    <tr>
                      <th>{isRTL ? 'التاريخ' : 'Date'}</th>
                      <th>{isRTL ? 'الدخول' : 'Check In'}</th>
                      <th>{isRTL ? 'الخروج' : 'Check Out'}</th>
                      <th>{isRTL ? 'المدة' : 'Duration'}</th>
                      <th>{isRTL ? 'الحالة' : 'Status'}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogRecords.map(r => {
                      const dur = durationMin(r);
                      const chMin = chanceRelativeMin(r);
                      const completed = r.checkInAt && r.checkOutAt;
                      const isEditing = editingCheckoutId === r.attendanceId;
                      return (
                        <tr key={r.attendanceId} className={completed ? 'is-completed' : 'is-partial'}>
                          <td className="mono">{r.date}</td>
                          <td className="mono">{fmtHms(r.checkInAt)}</td>
                          <td className="mono">
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                                <input
                                  type="time"
                                  value={editingCheckoutValue}
                                  onChange={(e) => setEditingCheckoutValue(e.target.value)}
                                  autoFocus
                                  step="60"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveCheckoutTime(r);
                                    if (e.key === 'Escape') cancelEditCheckout();
                                  }}
                                  style={{
                                    padding: '4px 6px', borderRadius: 6,
                                    border: '1.5px solid #16a34a',
                                    fontFamily: 'inherit', fontSize: '0.85rem',
                                    width: 100
                                  }}
                                />
                                <button
                                  onClick={() => saveCheckoutTime(r)}
                                  disabled={savingCheckout}
                                  className="mawhba-btn-small"
                                  style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}
                                  title={isRTL ? 'حفظ' : 'Save'}
                                >{savingCheckout ? '…' : '✓'}</button>
                                <button
                                  onClick={cancelEditCheckout}
                                  disabled={savingCheckout}
                                  className="mawhba-btn-small"
                                  title={isRTL ? 'إلغاء' : 'Cancel'}
                                >×</button>
                              </div>
                            ) : fmtHms(r.checkOutAt)}
                          </td>
                          <td className="mono">
                            {chMin != null ? (
                              <>
                                <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                  {`${Math.floor(chMin / 60)}h ${chMin % 60}m`}
                                </span>
                                {dur != null && dur !== chMin && (
                                  <span style={{ color: '#94a3b8', fontSize: '0.85em', marginInlineStart: 4 }}>
                                    / {`${Math.floor(dur / 60)}h ${dur % 60}m`}
                                  </span>
                                )}
                              </>
                            ) : (dur != null ? `${Math.floor(dur / 60)}h ${dur % 60}m` : '—')}
                          </td>
                          <td>
                            <span className={`mawhba-log-pill ${completed ? 'ok' : 'partial'}`}>
                              {completed ? (isRTL ? '✓ مكتمل' : '✓ Complete') : (isRTL ? '⏳ داخل الآن' : '⏳ Still in')}
                            </span>
                          </td>
                          <td>
                            <div className="mawhba-log-row-actions">
                              {!isEditing && r.checkInAt && (
                                <button
                                  className="mawhba-btn-small"
                                  onClick={() => beginEditCheckout(r)}
                                  title={r.checkOutAt
                                    ? (isRTL ? 'تعديل وقت الخروج' : 'Edit check-out time')
                                    : (isRTL ? 'إضافة وقت الخروج يدوياً' : 'Manually add check-out time')}
                                  style={{
                                    background: r.checkOutAt ? '#eef2ff' : '#dcfce7',
                                    color: r.checkOutAt ? '#4338ca' : '#166534',
                                    borderColor: r.checkOutAt ? '#c7d2fe' : '#86efac'
                                  }}
                                >✎</button>
                              )}
                              {r.checkOutAt && !isEditing && (
                                <button
                                  className="mawhba-btn-small mawhba-btn-warn"
                                  onClick={() => clearVolCheckoutRecord(r)}
                                  title={isRTL ? 'حذف تسجيل الخروج فقط' : 'Clear check-out only'}
                                >↩</button>
                              )}
                              {!isEditing && (
                                <button
                                  className="mawhba-btn-small mawhba-btn-del"
                                  onClick={() => deleteVolAttendanceRecord(r)}
                                  title={isRTL ? 'حذف السجل بالكامل' : 'Delete entire record'}
                                >×</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mawhba-modal-actions">
              <button className="mawhba-btn-secondary" onClick={() => setShowLogModal(false)}>
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full volunteers attendance export modal */}
      {showExportModal && (
        <div className="mawhba-modal-overlay" onClick={() => !exporting && setShowExportModal(false)}>
          <div className="mawhba-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📥 {isRTL ? 'تصدير سجل حضور المتطوعين' : 'Export Volunteer Attendance'}</h3>
            <p style={{ color: '#64748b', margin: '4px 0 12px', fontSize: 13 }}>
              {isRTL ? 'سيصدَّر سجل الحضور لجميع المتطوعين في النطاق المحدد كملف Excel.' : 'Exports attendance for all volunteers over the selected range as an Excel-friendly file.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{isRTL ? 'من تاريخ' : 'From'}</span>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, marginTop: 4 }}
                />
              </label>
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{isRTL ? 'إلى تاريخ' : 'To'}</span>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, marginTop: 4 }}
                />
              </label>
            </div>
            <div className="mawhba-modal-actions">
              <button
                className="mawhba-btn-secondary"
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                className="mawhba-btn-primary"
                onClick={downloadAllVolunteersAttendance}
                disabled={exporting}
                style={{ background: '#16a34a' }}
              >
                {exporting ? (isRTL ? 'جارٍ التصدير...' : 'Exporting...') : (isRTL ? 'تصدير' : 'Download')}
              </button>
            </div>
          </div>
        </div>
      )}

            <ReceiptModal
          open={!!receiptTarget}
          onClose={() => setReceiptTarget(null)}
          recipient={receiptTarget}
          personType="volunteer"
        />
        <ReceiptArchiveModal
          open={!!archiveTarget}
          onClose={() => setArchiveTarget(null)}
          recipient={archiveTarget}
          personType="volunteer"
        />
        <VolunteerContractModal
          open={!!contractTarget}
          onClose={() => setContractTarget(null)}
          recipient={contractTarget}
        />
    </>
  );
};

export default VolunteerManagement;
