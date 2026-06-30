import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import ReceiptModal from '../shared/ReceiptModal';
import ReceiptArchiveModal from '../shared/ReceiptArchiveModal';
import AttendanceLog from '../shared/AttendanceLog';

// Worker hourly rate — pass to AttendanceLog so it shows the cost column.
const WORKER_HOURLY_RATE = 15;

const WorkerManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Worker state
  const [workers, setWorkers] = useState([]);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [showWorkerDetailModal, setShowWorkerDetailModal] = useState(false);
  const [showWorkerRatingModal, setShowWorkerRatingModal] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerRatingForm, setWorkerRatingForm] = useState({
    workerId: '',
    opportunityId: '',
    type: 'award',
    points: 1,
    criteria: '',
    notes: '',
    ratingDate: new Date().toISOString().split('T')[0]
  });
  const [workerForm, setWorkerForm] = useState({
    name: '',
    nationalId: '',
    phone: '',
    email: '',
    nationalIdPhoto: ''
  });
  const [opportunityForm, setOpportunityForm] = useState({
    workerId: '',
    workerIds: [],
    selectAllWorkers: false,
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    dailyHours: 8,
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

  const fetchWorkers = useCallback(async () => {
    try {
      const response = await api.get('/workers');
      setWorkers(response.data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const resetWorkerForm = () => {
    setWorkerForm({
      name: '',
      nationalId: '',
      phone: '',
      email: '',
      nationalIdPhoto: ''
    });
  };

  const resetOpportunityForm = () => {
    setOpportunityForm({
      workerId: '',
      workerIds: [],
      selectAllWorkers: false,
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      dailyHours: 8,
      rating: 0,
      ratingCriteria: '',
      ratingNotes: ''
    });
  };

  const handleCreateWorker = async () => {
    if (!workerForm.name || !workerForm.nationalId || !workerForm.phone) {
      toast.error(isRTL ? 'الاسم ورقم الهوية والجوال مطلوبة' : 'Name, national ID, and phone are required');
      return;
    }

    setWorkerLoading(true);
    try {
      await api.post('/workers', workerForm);
      toast.success(isRTL ? 'تم إضافة العامل بنجاح' : 'Worker added successfully');
      setShowWorkerModal(false);
      resetWorkerForm();
      fetchWorkers();
    } catch (error) {
      console.error('Error creating worker:', error);
      if (error.response?.status === 409) {
        toast.error(isRTL ? 'يوجد عامل بنفس رقم الهوية' : 'Worker with this national ID already exists');
      } else {
        toast.error(isRTL ? 'خطأ في إضافة العامل' : 'Error adding worker');
      }
    } finally {
      setWorkerLoading(false);
    }
  };

  const handleCreateOpportunity = async () => {
    const hasValidWorker = opportunityForm.selectAllWorkers || opportunityForm.workerIds.length > 0;
    if (!hasValidWorker || !opportunityForm.title || !opportunityForm.startDate || !opportunityForm.endDate) {
      toast.error(isRTL ? 'العامل والعنوان والتاريخ مطلوبة' : 'Worker, title, and dates are required');
      return;
    }

    setWorkerLoading(true);
    try {
      // Get list of workers to assign
      const workerIds = opportunityForm.selectAllWorkers
        ? workers.map(v => v.workerId)
        : opportunityForm.workerIds;

      // Create opportunity for each worker
      const promises = workerIds.map(workerId =>
        api.post('/workers/opportunities', {
          ...opportunityForm,
          workerId
        })
      );

      await Promise.all(promises);
      toast.success(isRTL
        ? `تم إضافة فرصة العمل لـ ${workerIds.length} عامل بنجاح`
        : `Opportunity added to ${workerIds.length} worker(s) successfully`);
      setShowOpportunityModal(false);
      resetOpportunityForm();
      fetchWorkers();
    } catch (error) {
      console.error('Error creating opportunity:', error);
      toast.error(isRTL ? 'خطأ في إضافة فرصة العمل' : 'Error adding opportunity');
    } finally {
      setWorkerLoading(false);
    }
  };

  const handleOpenWorkerRating = (worker, opportunity = null) => {
    setSelectedWorker(worker);
    setSelectedOpportunity(opportunity);
    setWorkerRatingForm({
      workerId: worker.workerId,
      opportunityId: opportunity?.opportunityId || '',
      type: 'award',
      points: 1,
      criteria: '',
      notes: '',
      ratingDate: new Date().toISOString().split('T')[0]
    });
    setShowWorkerRatingModal(true);
  };

  const handleCreateWorkerRating = async () => {
    if (!workerRatingForm.workerId) return;

    setWorkerLoading(true);
    try {
      await api.post('/workers/ratings', workerRatingForm);
      toast.success(isRTL ? 'تم إضافة التقييم بنجاح' : 'Rating added successfully');
      setShowWorkerRatingModal(false);
      setSelectedWorker(null);
      setSelectedOpportunity(null);
      fetchWorkers();
    } catch (error) {
      console.error('Error creating worker rating:', error);
      toast.error(isRTL ? 'خطأ في إضافة التقييم' : 'Error adding rating');
    } finally {
      setWorkerLoading(false);
    }
  };

  const handleDeleteWorkerRating = async (ratingId) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذا التقييم؟' : 'Delete this rating?')) return;

    try {
      await api.delete(`/workers/ratings/${ratingId}`);
      toast.success(isRTL ? 'تم حذف التقييم' : 'Rating deleted');
      fetchWorkers();
    } catch (error) {
      console.error('Error deleting rating:', error);
      toast.error(isRTL ? 'خطأ في حذف التقييم' : 'Error deleting rating');
    }
  };

  const handleDeleteOpportunity = async (opportunityId) => {
    if (!window.confirm(isRTL ? 'حذف فرصة العمل وسجل الحضور الخاص بها نهائياً؟' : 'Delete this opportunity and its attendance log permanently?')) {
      return;
    }
    try {
      await api.delete(`/workers/opportunities/${opportunityId}`);
      toast.success(isRTL ? 'تم حذف فرصة العمل' : 'Opportunity deleted');
      fetchWorkers();
      // Refresh the open detail view so the row disappears immediately.
      if (selectedWorker) {
        const fresh = await api.get(`/workers/${selectedWorker.workerId}`);
        if (fresh.data) setSelectedWorker(fresh.data);
      }
    } catch (err) {
      console.error('Error deleting opportunity:', err);
      toast.error(isRTL ? 'خطأ في حذف فرصة العمل' : 'Error deleting opportunity');
    }
  };

  const handleDeleteWorker = async (workerId, forceDelete = false) => {
    const confirmMessage = forceDelete
      ? (isRTL ? 'هل أنت متأكد؟ سيتم حذف العامل وجميع سجلات العمل الخاصة به نهائياً!' : 'Are you sure? This will permanently delete the worker and ALL their worker records!')
      : (isRTL ? 'هل أنت متأكد من حذف هذا العامل؟' : 'Are you sure you want to delete this worker?');

    if (!window.confirm(confirmMessage)) return;

    try {
      const url = forceDelete ? `/workers/${workerId}?force=true` : `/workers/${workerId}`;
      await api.delete(url);
      toast.success(isRTL ? 'تم حذف العامل بنجاح' : 'Worker deleted successfully');
      setShowWorkerDetailModal(false);
      setSelectedWorker(null);
      fetchWorkers();
    } catch (error) {
      console.error('Error deleting worker:', error);
      // Check if it's because of existing opportunities
      if (error.response?.data?.requiresForce) {
        const count = error.response.data.opportunityCount;
        const forceConfirm = window.confirm(
          isRTL
            ? `هذا العامل لديه ${count} سجل عمل. هل تريد حذف العامل مع جميع سجلاته؟`
            : `This worker has ${count} worker record(s). Do you want to delete the worker along with all their records?`
        );
        if (forceConfirm) {
          handleDeleteWorker(workerId, true);
        }
      } else {
        toast.error(isRTL ? 'خطأ في حذف العامل' : 'Error deleting worker');
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
      await api.patch(`/workers/opportunities/${hoursAdjustForm.opportunityId}/hours`, {
        adjustment: hoursAdjustForm.adjustment,
        reason: hoursAdjustForm.reason
      });
      toast.success(isRTL ? 'تم تعديل الساعات بنجاح' : 'Hours adjusted successfully');
      setShowHoursAdjustModal(false);
      fetchWorkers();
      // Refresh selected worker data
      if (selectedWorker) {
        const updated = workers.find(v => v.workerId === selectedWorker.workerId);
        if (updated) setSelectedWorker(updated);
      }
    } catch (error) {
      console.error('Error adjusting hours:', error);
      toast.error(isRTL ? 'خطأ في تعديل الساعات' : 'Error adjusting hours');
    }
  };

  const handleWorkerPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(isRTL ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجا)' : 'File too large (max 5MB)');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setWorkerForm(prev => ({ ...prev, nationalIdPhoto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateTotalHours = (startDate, endDate, dailyHours = 8) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return days * dailyHours;
  };

  // View worker details
  const handleViewWorker = (worker) => {
    setSelectedWorker(worker);
    setShowWorkerDetailModal(true);
  };

  // Export single worker history as CSV
  const handleExportWorkerHistory = (worker) => {
    // Opportunities section
    const oppHeaders = [
      'Worker Name', 'National ID', 'Phone', 'Email',
      'Opportunity Title', 'Description', 'Start Date', 'End Date',
      'Daily Hours', 'Total Hours', 'Status'
    ];

    const oppRows = (worker.opportunities || []).map(opp => [
      worker.name,
      worker.nationalId,
      worker.phone,
      worker.email || 'N/A',
      opp.title,
      opp.description || '',
      opp.startDate,
      opp.endDate,
      opp.dailyHours || 8,
      opp.totalHours || 0,
      opp.status || 'active'
    ]);

    // Calculate totals
    const totalHours = (worker.opportunities || []).reduce((sum, o) => sum + (o.totalHours || 0), 0);
    const awards = (worker.ratings || []).filter(r => r.type === 'award').reduce((sum, r) => sum + (r.points || 0), 0);
    const deductions = (worker.ratings || []).filter(r => r.type === 'deduction').reduce((sum, r) => sum + (r.points || 0), 0);
    const netPoints = awards - deductions;

    // Ratings section
    const ratingHeaders = ['Date', 'Type', 'Points', 'Criteria', 'Notes'];
    const ratingRows = (worker.ratings || []).map(r => [
      r.ratingDate,
      r.type,
      r.type === 'deduction' ? `-${r.points}` : `+${r.points}`,
      r.criteria || '',
      r.notes ? r.notes.replace(/"/g, '""') : ''
    ]);

    // Build CSV content
    const csvLines = [
      '--- WORKER INFO ---',
      `"Name","${worker.name}"`,
      `"National ID","${worker.nationalId}"`,
      `"Phone","${worker.phone}"`,
      `"Email","${worker.email || 'N/A'}"`,
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
    link.download = `worker_${worker.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(isRTL ? 'تم تصدير السجل بنجاح' : 'History exported successfully');
  };

  // Print worker profile with all info including national ID photo

  const handlePrintWorkerProfile = (worker, opportunity = null) => {
    const printWindow = window.open('', '_blank');
    const totalHours = (worker.opportunities || []).reduce((sum, o) => sum + ((o.totalHours || 0) + (o.hoursAdjustment || 0)), 0);

    const printContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <title>${isRTL ? 'ملف العامل' : 'Worker Profile'} - ${worker.name}</title>
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
            <div class="header-title">${isRTL ? 'ملف العامل' : 'Worker Profile'}</div>
            <div class="header-subtitle">${isRTL ? 'فاب لاب الأحساء - مختبر التصنيع الرقمي' : 'FABLAB Al-Ahsa - Digital Fabrication Laboratory'}</div>
          </div>
          <img src="/fablab.png" alt="FABLAB" class="logo" />
        </div>

        <div class="profile-section">
          <div class="profile-photo">
            ${worker.nationalIdPhoto ? `<img src="${worker.nationalIdPhoto}" alt="ID Photo" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f0f0f0;font-size:48px;color:#999;">' + (worker.name?.charAt(0) || 'V') + '</div>'}
          </div>
          <div class="profile-info">
            <div class="profile-name">${worker.name}</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">${isRTL ? 'رقم الهوية' : 'National ID'}</div>
                <div class="info-value">${worker.nationalId}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${isRTL ? 'رقم الهاتف' : 'Phone'}</div>
                <div class="info-value">${worker.phone}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${isRTL ? 'البريد الإلكتروني' : 'Email'}</div>
                <div class="info-value">${worker.email || (isRTL ? 'غير متوفر' : 'N/A')}</div>
              </div>
              <div class="info-item">
                <div class="info-label">${isRTL ? 'الحالة' : 'Status'}</div>
                <div class="info-value">${worker.isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">${isRTL ? 'إحصائيات العمل' : 'Workering Statistics'}</div>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${worker.totalOpportunities || 0}</div>
              <div class="stat-label">${isRTL ? 'فرص عمل' : 'Opportunities'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalHours}</div>
              <div class="stat-label">${isRTL ? 'ساعة عمل' : 'Total Hours'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">+${worker.totalAwards || 0}</div>
              <div class="stat-label">${isRTL ? 'نقاط مكتسبة' : 'Awards'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${worker.totalPoints || 0}</div>
              <div class="stat-label">${isRTL ? 'صافي النقاط' : 'Net Points'}</div>
            </div>
          </div>
        </div>

        ${(worker.opportunities && worker.opportunities.length > 0) ? `
        <div class="section">
          <div class="section-title">${isRTL ? 'سجل العمل' : 'Workering History'}</div>
          ${worker.opportunities.map(opp => `
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

        ${worker.nationalIdPhoto ? `
        <div class="section" style="page-break-before: always; margin-top: 30px;">
          <div class="section-title">${isRTL ? 'صورة الهوية الوطنية' : 'National ID Photo'}</div>
          <div style="display: flex; justify-content: center; align-items: center; padding: 20px; background: #f8f9fa; border-radius: 12px; border: 2px solid #e02529;">
            <img src="${worker.nationalIdPhoto}" alt="National ID" style="max-width: 100%; max-height: 500px; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
          </div>
          <div style="text-align: center; margin-top: 15px; padding: 10px; background: linear-gradient(135deg, #e02529 0%, #c41e24 100%); color: white; border-radius: 8px;">
            <div style="font-size: 16px; font-weight: 700;">${worker.name}</div>
            <div style="font-size: 14px; margin-top: 5px;">${isRTL ? 'رقم الهوية:' : 'National ID:'} ${worker.nationalId}</div>
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <p>${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية - فاب لاب الأحساء' : 'Abdulmonem Alrashed Humanitarian Foundation - FABLAB Al-Ahsa'}</p>
          <p>${isRTL ? 'تم الطباعة في' : 'Printed on'}: ${new Date().toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  // Print worker certificate - modern colorful professional design

  const handlePrintWorkerCertificate = (worker, opportunity) => {
    if (!opportunity) {
      toast.error(isRTL ? 'يرجى اختيار فرصة عمل لطباعة الشهادة' : 'Please select an opportunity to print certificate');
      return;
    }

    const printWindow = window.open('', '_blank');
    const totalHours = (opportunity.totalHours || 0) + (opportunity.hoursAdjustment || 0);
    const certId = 'VOL-' + (opportunity.opportunityId?.substring(0, 8).toUpperCase() || Date.now());

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>شهادة عمل - ${worker.name}</title>
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
          .worker-name {
            font-size: 42px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 8px;
            position: relative;
            display: inline-block;
          }
          .worker-name::after {
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
          <div class="ribbon">عامل متميز</div>

          <div class="certificate-inner">
            <!-- Header -->
            <div class="header">
              <div class="logo-container">
                <img src="/found.png" alt="Foundation" class="logo" />
              </div>
              <div class="header-center">
                <div class="org-name">مؤسسة عبدالمنعم الراشد الإنسانية</div>
                <div class="cert-title">شهادة عمل</div>
                <div class="cert-subtitle">WORKERING CERTIFICATE</div>
              </div>
              <div class="logo-container">
                <img src="/fablab.png" alt="FABLAB" class="logo" />
              </div>
            </div>

            <div class="divider"></div>

            <!-- Main Content -->
            <div class="main-content">
              <div class="presents-text">تشهد إدارة فاب لاب الأحساء بأن</div>
              <div class="worker-name">${worker.name}</div>

              <div class="appreciation-text">
                قد شارك في العمل العملي من خلال
                <span class="highlight">"${opportunity.title}"</span>
                <br/>
                وأبدى تفانياً وإخلاصاً في خدمة المجتمع، ونثمّن جهوده المتميزة وروح المبادرة والتعاون
              </div>

              <div class="stats-container">
                <div class="stat-card">
                  <div class="stat-value">${totalHours}</div>
                  <div class="stat-label">ساعة عمل</div>
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
                <div class="cert-date">${new Date().toLocaleDateString('ar-SA')}</div>
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

  const handlePrintWorkerIDCard = (worker) => {
    const printWindow = window.open('', '_blank');
    const workerName = worker.name || (isRTL ? 'غير متوفر' : 'N/A');
    const na = isRTL ? 'غير محدد' : 'N/A';

    const idCardContent = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${isRTL ? 'ar' : 'en'}">
      <head>
        <meta charset="UTF-8">
        <title>${isRTL ? 'بطاقة عامل' : 'Worker ID Card'}</title>
        <style>
          @page { size: A4 portrait; margin: 14mm 12mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f1f5f9; }
          body { padding: 24mm 0; display: flex; justify-content: center; }
          .print-note { font-size: 12px; color: #475569; background: white; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 8px 14px; margin-bottom: 8mm; text-align: center; max-width: 80mm; }
          .id-card-wrapper { display: flex; flex-direction: column; align-items: center; }

          .id-card {
            width: 72mm;
            height: 102mm;
            background: linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%);
            border: 0.45mm dashed #475569;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            color: #0f172a;
            box-sizing: border-box;
          }
          .card-header {
            background: linear-gradient(135deg, #111827 0%, #000000 100%);
            padding: 3mm 3.5mm;
            text-align: center;
          }
          .card-title { color: white; font-size: 10pt; font-weight: 700; letter-spacing: 0.4px; line-height: 1.15; }
          .card-subtitle { color: rgba(255,255,255,0.78); font-size: 7pt; margin-top: 1mm; }
          .card-body {
            flex: 1;
            padding: 3.5mm 4mm 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2mm;
          }
          .user-photo {
            width: 24mm;
            height: 29mm;
            background: linear-gradient(135deg, #e5e7eb, #9ca3af);
            border-radius: 2mm;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #0f172a;
            font-weight: bold;
            border: 0.8mm solid #0f172a;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
            overflow: hidden;
            flex-shrink: 0;
          }
          .user-photo img { width: 100%; height: 100%; object-fit: cover; }
          .user-photo .initials { font-size: 22pt; font-weight: bold; color: #0f172a; }
          .user-name {
            font-size: 12pt;
            font-weight: 800;
            color: #0f172a;
            text-align: center;
            line-height: 1.2;
            max-height: 11mm;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .user-type-badge {
            display: inline-block;
            background: linear-gradient(135deg, #1f2937, #000000);
            color: white;
            font-size: 8pt;
            padding: 0.8mm 4mm;
            border-radius: 999px;
            font-weight: 700;
          }
          .info-section { width: 100%; display: flex; flex-direction: column; gap: 1mm; margin-top: 1.5mm; }
          .info-row { display: flex; justify-content: space-between; font-size: 8pt; padding: 1mm 0; border-bottom: 0.2mm dotted #d4d4d8; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: 700; color: #525252; }
          .info-value { color: #0f172a; font-weight: 600; text-align: ${isRTL ? 'left' : 'right'}; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .card-footer {
            background: #ffffff;
            padding: 2mm 3mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-top: 0.3mm solid #e5e7eb;
          }
          .card-footer .logo { height: 8mm; width: auto; flex-shrink: 0; }
          .decorative-stripe {
            position: absolute;
            top: 40%;
            ${isRTL ? 'right' : 'left'}: 0;
            width: 1mm;
            height: 25%;
            background: linear-gradient(to bottom, transparent, #000000, transparent);
          }
          @media print {
            html, body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { padding: 0; }
            .print-note { display: none; }
            .id-card { box-shadow: none; break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="id-card-wrapper">
          <div class="print-note">${isRTL ? 'حجم البطاقة 72×102 ملم — اقطع حسب الخط المتقطع' : 'Card size 72×102 mm — cut along the dashed line'}</div>
          <div class="id-card">
            <div class="card-header">
              <div class="card-title">${isRTL ? 'بطاقة عامل فاب لاب الأحساء' : 'FABLAB Al-Ahsa Worker Card'}</div>
              <div class="card-subtitle">${isRTL ? 'مؤسسة عبدالمنعم الراشد الإنسانية' : 'Abdulmonem Al-Rashed Foundation'}</div>
            </div>
            <div class="card-body">
              <div class="user-photo">
                ${worker.nationalIdPhoto
                  ? `<img src="${worker.nationalIdPhoto}" alt="${workerName}" />`
                  : `<span class="initials">${workerName.charAt(0).toUpperCase()}</span>`
                }
              </div>
              <div class="user-name">${workerName}</div>
              <div class="user-type-badge">${isRTL ? 'عامل' : 'Worker'}</div>

              <div class="info-section">
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'رقم الهوية' : 'National ID'}</span>
                  <span class="info-value">${worker.nationalId || na}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'الهاتف' : 'Phone'}</span>
                  <span class="info-value">${worker.phone || na}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${isRTL ? 'البريد' : 'Email'}</span>
                  <span class="info-value">${worker.email || na}</span>
                </div>
              </div>
            </div>
            <div class="decorative-stripe"></div>
            <div class="card-footer">
              <img src="/found.png" alt="Foundation" class="logo">
              <img src="/fablab.png" alt="FABLAB" class="logo">
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(idCardContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  };

  const handleExportAllWorkers = () => {
    const headers = [
      'Worker Name', 'National ID', 'Phone', 'Email',
      'Total Opportunities', 'Total Hours', 'Awards', 'Deductions', 'Net Points', 'Status'
    ];

    const rows = workers.map(v => [
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
    const totalOpps = workers.reduce((sum, v) => sum + (v.totalOpportunities || 0), 0);
    const totalHours = workers.reduce((sum, v) => sum + (v.totalHours || 0), 0);
    const totalAwards = workers.reduce((sum, v) => sum + (v.totalAwards || 0), 0);
    const totalDeductions = workers.reduce((sum, v) => sum + (v.totalDeductions || 0), 0);
    const totalNetPoints = workers.reduce((sum, v) => sum + (v.totalPoints || 0), 0);

    const summaryRows = [
      [],
      ['--- SUMMARY ---'],
      ['Total Workers', 'Total Opportunities', 'Total Hours', 'Total Awards', 'Total Deductions', 'Total Net Points'],
      [workers.length, totalOpps, totalHours, totalAwards, totalDeductions, totalNetPoints]
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
    link.download = `all_workers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(isRTL ? 'تم تصدير جميع العمال' : 'All workers exported');
  };


  return (
    <>
          <div className="volunteers-content">
            <div className="volunteers-header">
              <h2>{isRTL ? 'إدارة العمال' : 'Worker Management'}</h2>
              <div className="volunteers-actions">
                <button className="add-volunteer-btn" onClick={() => setShowWorkerModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                  {isRTL ? 'إضافة عامل' : 'Add Worker'}
                </button>
                <button className="add-opportunity-btn" onClick={() => setShowOpportunityModal(true)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="18"/>
                    <line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                  {isRTL ? 'إضافة فرصة عمل' : 'Add Opportunity'}
                </button>
                {workers.length > 0 && (
                  <button className="export-btn" onClick={handleExportAllWorkers}>
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

            <div className="volunteers-grid">
              {workers.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <p>{isRTL ? 'لا يوجد عمال' : 'No workers found'}</p>
                </div>
              ) : (
                workers.map(worker => (
                  <div key={worker.workerId} className="volunteer-card">
                    <div className="volunteer-header">
                      <div className="volunteer-avatar">
                        {worker.name?.charAt(0) || 'V'}
                      </div>
                      <div className="volunteer-info">
                        <h3>{worker.name}</h3>
                        <p>{worker.phone}</p>
                      </div>
                    </div>
                    <div className="volunteer-stats">
                      <div className="stat-item">
                        <div className="stat-value">{worker.totalOpportunities || 0}</div>
                        <div className="stat-label">{isRTL ? 'فرص' : 'Opportunities'}</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{worker.totalHours || 0}</div>
                        <div className="stat-label">{isRTL ? 'ساعة' : 'Hours'}</div>
                      </div>
                      <div className="stat-item">
                        <div className={`stat-value ${(worker.totalPoints || 0) > 0 ? 'positive' : (worker.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                          {(worker.totalPoints || 0) > 0 ? '+' : ''}{worker.totalPoints || 0}
                        </div>
                        <div className="stat-label">{isRTL ? 'نقاط' : 'Net Points'}</div>
                      </div>
                    </div>
                    {worker.opportunities && worker.opportunities.length > 0 && (
                      <div className="volunteer-opportunities">
                        <strong style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {isRTL ? 'آخر الفرص:' : 'Recent:'}
                        </strong>
                        {worker.opportunities.slice(0, 2).map(opp => (
                          <div key={opp.opportunityId} className="opportunity-item">
                            <span className="opportunity-title">{opp.title}</span>
                            <span className="opportunity-hours">{opp.totalHours}h</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="volunteer-card-actions">
                      <button
                        className="view-volunteer-btn"
                        onClick={() => handleViewWorker(worker)}
                        title={isRTL ? 'عرض التفاصيل' : 'View Details'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                        {isRTL ? 'عرض' : 'View'}
                      </button>
                      <button
                        className="export-volunteer-btn"
                        onClick={() => handlePrintWorkerIDCard(worker)}
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
                        onClick={() => handleExportWorkerHistory(worker)}
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
                        onClick={() => handleOpenWorkerRating(worker)}
                        title={isRTL ? 'تقييم العامل' : 'Rate Worker'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                        </svg>
                        {isRTL ? 'تقييم' : 'Rate'}
                      </button>
                      <button
                        className="export-volunteer-btn"
                        onClick={() => setReceiptTarget(worker)}
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
                        onClick={() => setArchiveTarget(worker)}
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
                        className="delete-volunteer-btn"
                        onClick={() => handleDeleteWorker(worker.workerId)}
                        title={isRTL ? 'حذف العامل' : 'Delete Worker'}
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
                  </div>
                ))
              )}
            </div>
          </div>

        {/* Worker Modal */}
        {showWorkerModal && (
          <div className="modal-overlay" onClick={() => setShowWorkerModal(false)}>
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
                  <h2>{isRTL ? 'عامل جديد' : 'New Worker'}</h2>
                  <p>{isRTL ? 'تسجيل عامل جديد في النظام' : 'Register a new worker'}</p>
                </div>
                <button className="modal-close-modern" onClick={() => setShowWorkerModal(false)}>
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
                        value={workerForm.name}
                        onChange={(e) => setWorkerForm(prev => ({ ...prev, name: e.target.value }))}
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
                        value={workerForm.nationalId}
                        onChange={(e) => setWorkerForm(prev => ({ ...prev, nationalId: e.target.value }))}
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
                          value={workerForm.phone}
                          onChange={(e) => setWorkerForm(prev => ({ ...prev, phone: e.target.value }))}
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
                          value={workerForm.email}
                          onChange={(e) => setWorkerForm(prev => ({ ...prev, email: e.target.value }))}
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
                    {workerForm.nationalIdPhoto ? (
                      <div className="photo-preview">
                        <img src={workerForm.nationalIdPhoto} alt="ID" />
                        <button
                          className="remove-photo-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWorkerForm(prev => ({ ...prev, nationalIdPhoto: '' }));
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
                          onChange={handleWorkerPhotoUpload}
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
                <button className="btn-cancel" onClick={() => setShowWorkerModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn-submit volunteer-submit"
                  onClick={handleCreateWorker}
                  disabled={workerLoading || !workerForm.name || !workerForm.nationalId || !workerForm.phone}
                >
                  {workerLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'إضافة عامل' : 'Add Worker'}
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
                  <h2>{isRTL ? 'فرصة عمل جديدة' : 'New Opportunity'}</h2>
                  <p>{isRTL ? 'إنشاء فرصة عمل للعمال' : 'Create a worker opportunity'}</p>
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
                    <span>{isRTL ? 'اختيار العمال' : 'Select Workers'}</span>
                  </div>
                  <div className="select-all-toggle">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={opportunityForm.selectAllWorkers}
                        onChange={(e) => {
                          const selectAll = e.target.checked;
                          setOpportunityForm(prev => ({
                            ...prev,
                            selectAllWorkers: selectAll,
                            workerIds: selectAll ? workers.map(v => v.workerId) : []
                          }));
                        }}
                        className="toggle-checkbox"
                      />
                      <span className="toggle-switch"></span>
                      <span className="toggle-text">{isRTL ? 'تعيين لجميع العمال' : 'Assign to all workers'}</span>
                    </label>
                  </div>
                  {!opportunityForm.selectAllWorkers && (
                    <div className="volunteer-checkbox-list modern-list">
                      {workers.map(v => (
                        <label key={v.workerId} className={`volunteer-checkbox-item modern ${opportunityForm.workerIds.includes(v.workerId) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={opportunityForm.workerIds.includes(v.workerId)}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const newWorkerIds = isChecked
                                ? [...opportunityForm.workerIds, v.workerId]
                                : opportunityForm.workerIds.filter(id => id !== v.workerId);
                              setOpportunityForm(prev => ({
                                ...prev,
                                workerIds: newWorkerIds,
                                workerId: newWorkerIds.length === 1 ? newWorkerIds[0] : ''
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
                  {!opportunityForm.selectAllWorkers && opportunityForm.workerIds.length > 0 && (
                    <div className="selected-count-badge">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                      </svg>
                      {isRTL
                        ? `تم تحديد ${opportunityForm.workerIds.length} عامل`
                        : `${opportunityForm.workerIds.length} worker${opportunityForm.workerIds.length > 1 ? 's' : ''} selected`}
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
                      placeholder={isRTL ? 'عنوان فرصة العمل' : 'Opportunity title'}
                      className="modern-input-field"
                    />
                  </div>
                  <div className="form-group modern-input">
                    <label>{isRTL ? 'الوصف' : 'Description'}</label>
                    <textarea
                      value={opportunityForm.description}
                      onChange={(e) => setOpportunityForm(prev => ({ ...prev, description: e.target.value }))}
                      rows="3"
                      placeholder={isRTL ? 'وصف فرصة العمل...' : 'Opportunity description...'}
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
                    <span>{isRTL ? 'فترة العمل' : 'Worker Period'}</span>
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
                  {/* Workers don't enter daily hours upfront — hours are
                      logged per day in the worker profile after the
                      opportunity is created. */}
                </div>

                <div className="info-note-modern">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <p>
                    {isRTL
                      ? 'ملاحظة: يمكنك تقييم العامل بعد انتهاء فرصة العمل'
                      : 'Note: You can rate the worker after the opportunity is completed'}
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
                  disabled={workerLoading || (!opportunityForm.selectAllWorkers && opportunityForm.workerIds.length === 0) || !opportunityForm.title || !opportunityForm.startDate || !opportunityForm.endDate}
                >
                  {workerLoading ? (
                    <>
                      <span className="spinner"></span>
                      {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {isRTL ? 'إنشاء فرصة العمل' : 'Create Opportunity'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Worker Detail Modal */}
        {showWorkerDetailModal && selectedWorker && (
          <div className="modal-overlay" onClick={() => setShowWorkerDetailModal(false)}>
            <motion.div
              className="modal-content volunteer-detail-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'معلومات العامل' : 'Worker Details'}</h2>
                <button className="close-btn" onClick={() => setShowWorkerDetailModal(false)}>×</button>
              </div>
              <div className="modal-body volunteer-detail-body">
                {/* Worker Profile Section */}
                <div className="volunteer-detail-profile">
                  <div className="volunteer-detail-avatar">
                    {selectedWorker.nationalIdPhoto ? (
                      <img src={selectedWorker.nationalIdPhoto} alt="ID" className="volunteer-id-photo" />
                    ) : (
                      <div className="avatar-placeholder">
                        {selectedWorker.name?.charAt(0) || 'V'}
                      </div>
                    )}
                  </div>
                  <div className="volunteer-detail-info">
                    <h3>{selectedWorker.name}</h3>
                    <div className="info-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="9" cy="10" r="2"/>
                        <path d="M15 8h2"/>
                        <path d="M15 12h2"/>
                        <path d="M7 16h10"/>
                      </svg>
                      <span>{isRTL ? 'رقم الهوية: ' : 'National ID: '}{selectedWorker.nationalId}</span>
                    </div>
                    <div className="info-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>
                      </svg>
                      <span>{selectedWorker.phone}</span>
                    </div>
                    {selectedWorker.email && (
                      <div className="info-row">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        <span>{selectedWorker.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Section */}
                <div className="volunteer-detail-stats">
                  <div className="detail-stat">
                    <div className="detail-stat-value">{selectedWorker.totalOpportunities || 0}</div>
                    <div className="detail-stat-label">{isRTL ? 'فرص عمل' : 'Opportunities'}</div>
                  </div>
                  <div className="detail-stat">
                    <div className="detail-stat-value">{selectedWorker.totalHours || 0}</div>
                    <div className="detail-stat-label">{isRTL ? 'ساعة عمل' : 'Total Hours'}</div>
                  </div>
                  <div className="detail-stat">
                    <div className={`detail-stat-value ${(selectedWorker.totalPoints || 0) > 0 ? 'positive' : (selectedWorker.totalPoints || 0) < 0 ? 'negative' : ''}`}>
                      {(selectedWorker.totalPoints || 0) > 0 ? '+' : ''}{selectedWorker.totalPoints || 0}
                    </div>
                    <div className="detail-stat-label">{isRTL ? 'صافي النقاط' : 'Net Points'}</div>
                  </div>
                </div>

                {/* Points Breakdown */}
                {(selectedWorker.totalAwards > 0 || selectedWorker.totalDeductions > 0) && (
                  <div className="points-breakdown">
                    <span className="awards">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      +{selectedWorker.totalAwards || 0} {isRTL ? 'منح' : 'awards'}
                    </span>
                    <span className="deductions">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      -{selectedWorker.totalDeductions || 0} {isRTL ? 'خصم' : 'deductions'}
                    </span>
                  </div>
                )}

                {/* Ratings History */}
                {selectedWorker.ratings && selectedWorker.ratings.length > 0 && (
                  <div className="volunteer-history-section">
                    <h4>{isRTL ? 'سجل التقييمات' : 'Ratings History'}</h4>
                    <div className="ratings-history-list">
                      {selectedWorker.ratings.map(rating => (
                        <div key={rating.ratingId} className={`rating-history-item ${rating.type}`}>
                          <div className="rating-history-header">
                            <span className={`rating-points ${rating.type}`}>
                              {rating.type === 'deduction' ? `-${rating.points}` : `+${rating.points}`}
                            </span>
                            <span className="rating-date">{rating.ratingDate}</span>
                            <button
                              className="delete-rating-btn"
                              onClick={() => handleDeleteWorkerRating(rating.ratingId)}
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
                {selectedWorker.nationalIdPhoto && (
                  <div className="volunteer-id-section">
                    <h4>{isRTL ? 'صورة الهوية' : 'National ID Photo'}</h4>
                    <img
                      src={selectedWorker.nationalIdPhoto}
                      alt="National ID"
                      className="volunteer-id-full"
                      onClick={() => window.open(selectedWorker.nationalIdPhoto, '_blank')}
                    />
                  </div>
                )}

                {/* Opportunities History */}
                <div className="volunteer-history-section">
                  <h4>{isRTL ? 'سجل العمل' : 'Workering History'}</h4>
                  {(!selectedWorker.opportunities || selectedWorker.opportunities.length === 0) ? (
                    <p className="no-history">{isRTL ? 'لا توجد فرص عمل مسجلة' : 'No workering history'}</p>
                  ) : (
                    <div className="history-list">
                      {selectedWorker.opportunities.map(opp => (
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
                          <AttendanceLog
                            opportunity={opp}
                            isRTL={isRTL}
                            onSaved={fetchWorkers}
                            hourlyRate={WORKER_HOURLY_RATE}
                            apiPath="/workers/opportunities"
                          />
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
                              onClick={() => handleOpenWorkerRating(selectedWorker, opp)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                              </svg>
                              {isRTL ? 'تقييم' : 'Rate'}
                            </button>
                            <button
                              className="print-certificate-btn"
                              onClick={() => handlePrintWorkerCertificate(selectedWorker, opp)}
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
                              title={isRTL ? 'حذف فرصة العمل' : 'Delete Opportunity'}
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
                  onClick={() => handleDeleteWorker(selectedWorker.workerId)}
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
                  onClick={() => handleExportWorkerHistory(selectedWorker)}
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
                  onClick={() => handlePrintWorkerProfile(selectedWorker)}
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
                    if (selectedWorker.opportunities && selectedWorker.opportunities.length > 0) {
                      // If there's only one opportunity, print it directly
                      if (selectedWorker.opportunities.length === 1) {
                        handlePrintWorkerCertificate(selectedWorker, selectedWorker.opportunities[0]);
                      } else {
                        // Show selection modal or use first completed opportunity
                        const completedOpp = selectedWorker.opportunities.find(o => o.status === 'completed') || selectedWorker.opportunities[0];
                        handlePrintWorkerCertificate(selectedWorker, completedOpp);
                      }
                    } else {
                      toast.error(isRTL ? 'لا توجد فرص عمل لطباعة الشهادة' : 'No opportunities to print certificate');
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
                <button className="modal-btn cancel" onClick={() => setShowWorkerDetailModal(false)}>
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Worker Rating Modal */}
        {showWorkerRatingModal && selectedWorker && (
          <div className="modal-overlay" onClick={() => setShowWorkerRatingModal(false)}>
            <motion.div
              className="modal-content task-modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="modal-header">
                <h2>{isRTL ? 'تقييم العامل' : 'Rate Worker'}</h2>
                <button className="close-btn" onClick={() => setShowWorkerRatingModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="opportunity-info-summary">
                  <h4>{selectedWorker.name}</h4>
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
                      className={`rating-type-btn award ${workerRatingForm.type === 'award' ? 'active' : ''}`}
                      onClick={() => setWorkerRatingForm(prev => ({ ...prev, type: 'award' }))}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z"/>
                      </svg>
                      <span>{isRTL ? 'منح نقاط' : 'Award'}</span>
                    </button>
                    <button
                      type="button"
                      className={`rating-type-btn deduction ${workerRatingForm.type === 'deduction' ? 'active' : ''}`}
                      onClick={() => setWorkerRatingForm(prev => ({ ...prev, type: 'deduction' }))}
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
                        className={`point-btn ${workerRatingForm.points === num ? 'active' : ''} ${workerRatingForm.type}`}
                        onClick={() => setWorkerRatingForm(prev => ({ ...prev, points: num }))}
                      >
                        {workerRatingForm.type === 'deduction' ? `-${num}` : `+${num}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'المعيار' : 'Criteria'}</label>
                  <select
                    value={workerRatingForm.criteria}
                    onChange={(e) => setWorkerRatingForm(prev => ({ ...prev, criteria: e.target.value }))}
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
                    value={workerRatingForm.ratingDate}
                    onChange={(e) => setWorkerRatingForm(prev => ({ ...prev, ratingDate: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                  <textarea
                    value={workerRatingForm.notes}
                    onChange={(e) => setWorkerRatingForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder={isRTL ? 'ملاحظات حول الأداء...' : 'Performance notes...'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-btn cancel" onClick={() => setShowWorkerRatingModal(false)}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="modal-btn save"
                  onClick={handleCreateWorkerRating}
                  disabled={workerLoading}
                >
                  {workerLoading ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التقييم' : 'Save Rating')}
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
                <h2>{isRTL ? 'تعديل ساعات العمل' : 'Adjust Workering Hours'}</h2>
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
            <ReceiptModal
          open={!!receiptTarget}
          onClose={() => setReceiptTarget(null)}
          recipient={receiptTarget}
          personType="worker"
        />
        <ReceiptArchiveModal
          open={!!archiveTarget}
          onClose={() => setArchiveTarget(null)}
          recipient={archiveTarget}
          personType="worker"
        />
    </>
  );
};

export default WorkerManagement;
