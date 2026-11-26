import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { Html5Qrcode } from 'html5-qrcode';
import axios from 'axios';
import StudioShell, { Icon, useStudioTheme } from '../RegistrationForm/StudioShell';
import { EDU_ICONS, EDU_INTRO, EduVerify, EduInfo } from './EduParts';
import './EducationForm.css';

const API_URL = process.env.NODE_ENV === 'production' ? '/api' : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');
const api = axios.create({ baseURL: API_URL });

const StudentAttendance = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const tx = (ar, en) => (isRTL ? ar : en);
  const [theme, toggleTheme] = useStudioTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [educationId, setEducationId] = useState('');
  const [educationInfo, setEducationInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const qrScannerRef = useRef(null);
  const qrCooldownRef = useRef(false);

  const handleVerify = async () => {
    if (!educationId.trim()) {
      toast.error(tx('الرجاء إدخال رقم التعليم', 'Please enter the education ID'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/education/verify/${encodeURIComponent(educationId.trim())}`);
      setEducationInfo(res.data);
      // Fetch students
      const studentsRes = await api.get(`/education/${encodeURIComponent(educationId.trim())}/students/public`);
      setStudents(studentsRes.data);
      // Initialize all as absent, then load today's attendance
      const map = {};
      studentsRes.data.forEach(s => { map[s.studentId] = 'absent'; });
      // Load existing attendance for today
      try {
        const attRes = await api.get(`/education/${encodeURIComponent(educationId.trim())}/attendance?date=${attendanceDate}`);
        attRes.data.forEach(a => { if (map[a.studentId] !== undefined) map[a.studentId] = a.status; });
      } catch {}
      setAttendanceMap(map);
      setStep(2);
      toast.success(tx('تم التحقق بنجاح', 'Verified successfully'));
    } catch (error) {
      toast.error((isRTL ? error.response?.data?.messageAr : error.response?.data?.message) || tx('رقم التعليم غير صحيح', 'Invalid education ID'));
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceForDate = async (date) => {
    try {
      const res = await api.get(`/education/${encodeURIComponent(educationId)}/attendance?date=${date}`);
      const map = {};
      students.forEach(s => { map[s.studentId] = 'present'; });
      res.data.forEach(a => { map[a.studentId] = a.status; });
      setAttendanceMap(map);
    } catch {
      // If no attendance found, keep defaults
    }
  };

  const handleDateChange = (date) => {
    setAttendanceDate(date);
    loadAttendanceForDate(date);
  };

  const autoSaveAttendance = async (newMap) => {
    try {
      const records = Object.entries(newMap).map(([studentId, status]) => ({ studentId, status }));
      await api.post(`/education/${encodeURIComponent(educationId)}/attendance`, { date: attendanceDate, records });
    } catch (err) {
      console.error('Auto-save attendance error:', err);
      toast.error(tx('خطأ في حفظ الحضور', 'Could not save attendance'), { autoClose: 2000 });
    }
  };

  const toggleStatus = async (studentId) => {
    const newStatus = attendanceMap[studentId] === 'present' ? 'absent' : 'present';
    const newMap = { ...attendanceMap, [studentId]: newStatus };
    setAttendanceMap(newMap);
    // Save only this one student
    try {
      await api.post(`/education/${encodeURIComponent(educationId)}/attendance`, {
        date: attendanceDate,
        records: [{ studentId, status: newStatus }]
      });
      toast.success(newStatus === 'present' ? tx('✓ حاضر', '✓ Present') : tx('✗ غائب', '✗ Absent'), { autoClose: 1500 });
    } catch (err) {
      toast.error(tx('خطأ في حفظ الحضور', 'Could not save attendance'), { autoClose: 2000 });
    }
  };

  const markAll = (status) => {
    const map = {};
    students.forEach(s => { map[s.studentId] = status; });
    setAttendanceMap(map);
    autoSaveAttendance(map);
    toast.success(status === 'present' ? tx('تم تحضير الكل', 'All marked present') : tx('تم تغييب الكل', 'All marked absent'), { autoClose: 1500 });
  };

  // QR Scanner functions
  const startQRScanner = async () => {
    setShowQRScanner(true);
    await new Promise(r => setTimeout(r, 500));
    const el = document.getElementById('edu-qr-reader');
    if (!el) return;

    try {
      const scanner = new Html5Qrcode('edu-qr-reader');
      qrScannerRef.current = scanner;
      const devices = await Html5Qrcode.getCameras();
      if (!devices.length) { toast.error(tx('لم يتم العثور على كاميرا', 'No camera found')); return; }
      const cam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear')) || devices[devices.length - 1];

      await scanner.start(cam.id, { fps: 25, qrbox: undefined, videoConstraints: { width: { ideal: 1920 }, height: { ideal: 1080 } } },
        async (decodedText) => {
          if (qrCooldownRef.current) return;
          qrCooldownRef.current = true;

          // Beep
          try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 1200; g.gain.value = 0.3; o.start(); o.stop(ctx.currentTime + 0.15); } catch {}

          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.type === 'education' && parsed.studentId) {
              // Auto-mark as present
              const res = await api.post('/education/attendance/mark', { studentId: parsed.studentId, educationId: parsed.educationId || educationId });
              const name = parsed.fullName || res.data.student?.fullName || '';
              if (res.data.alreadyMarked) {
                toast.info(tx(`${name} — مسجل مسبقاً (دخول: ${res.data.checkInTime || '?'} | خروج: ${res.data.checkOutTime || '?'})`, `${name} — already recorded (in: ${res.data.checkInTime || '?'} | out: ${res.data.checkOutTime || '?'})`), { autoClose: 4000 });
              } else if (res.data.action === 'checkout') {
                toast.success(tx(`📤 ${name} — تسجيل خروج ${res.data.checkOutTime} (الدخول: ${res.data.checkInTime})`, `📤 ${name} — checked out ${res.data.checkOutTime} (in: ${res.data.checkInTime})`), { autoClose: 4000 });
              } else {
                toast.success(tx(`📥 ${name} — تسجيل دخول ${res.data.time}`, `📥 ${name} — checked in ${res.data.time}`), { autoClose: 3000 });
              }
              // Update local map
              setAttendanceMap(prev => ({ ...prev, [parsed.studentId]: 'present' }));
            }
          } catch {}

          setTimeout(() => { qrCooldownRef.current = false; }, 3000);
        },
        () => {}
      );
    } catch (err) { console.error('QR error:', err); }
  };

  const stopQRScanner = async () => {
    if (qrScannerRef.current) {
      try { await qrScannerRef.current.stop(); } catch {}
      try { qrScannerRef.current.clear(); } catch {}
      qrScannerRef.current = null;
    }
    setShowQRScanner(false);
  };

  const downloadDayExcel = async () => {
    try {
      const res = await api.get(`/education/${encodeURIComponent(educationId)}/attendance/export?startDate=${attendanceDate}&endDate=${attendanceDate}`);
      const data = res.data;
      const wsData = [
        ['حضور الطلاب - ' + data.education.educationId],
        ['التاريخ: ' + attendanceDate, 'القسم: ' + data.education.section, 'المعلم: ' + data.education.teacherName],
        [],
        ['#', 'الاسم', 'رقم الهوية', 'المدرسة', 'الحالة']
      ];
      data.students.forEach((s, i) => {
        wsData.push([i + 1, s.fullName, s.nationalId, s.schoolName, s.attendance[0] === 'present' ? 'حاضر' : s.attendance[0] === 'absent' ? 'غائب' : '-']);
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
      XLSX.writeFile(wb, `attendance_${educationId}_${attendanceDate}.xlsx`);
      toast.success(tx('تم تحميل الملف', 'File downloaded'));
    } catch {
      toast.error(tx('حدث خطأ أثناء التحميل', 'Download failed'));
    }
  };

  const downloadPeriodExcel = async () => {
    if (!periodStart || !periodEnd) {
      toast.error(tx('حدد تاريخ البداية والنهاية', 'Choose the start and end dates'));
      return;
    }
    try {
      const res = await api.get(`/education/${encodeURIComponent(educationId)}/attendance/export?startDate=${periodStart}&endDate=${periodEnd}`);
      const data = res.data;
      const header = ['#', 'الاسم', 'رقم الهوية', 'المدرسة', ...data.dates];
      const wsData = [
        ['حضور الطلاب - ' + data.education.educationId],
        ['الفترة: ' + periodStart + ' إلى ' + periodEnd, 'القسم: ' + data.education.section, 'المعلم: ' + data.education.teacherName],
        [],
        header
      ];
      data.students.forEach((s, i) => {
        wsData.push([i + 1, s.fullName, s.nationalId, s.schoolName, ...s.attendance.map(a => a === 'present' ? 'حاضر' : a === 'absent' ? 'غائب' : '-')]);
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
      XLSX.writeFile(wb, `attendance_${educationId}_${periodStart}_${periodEnd}.xlsx`);
      setShowPeriodModal(false);
      toast.success(tx('تم تحميل الملف', 'File downloaded'));
    } catch {
      toast.error(tx('حدث خطأ أثناء التحميل', 'Download failed'));
    }
  };

  const presentCount = Object.values(attendanceMap).filter(s => s === 'present').length;
  const absentCount = Object.values(attendanceMap).filter(s => s === 'absent').length;

  // Leaving the attendance step must release the camera first.
  const goToStep = async (next) => {
    if (showQRScanner) await stopQRScanner();
    setStep(next);
  };
  const startOver = async () => {
    await goToStep(1);
    setEducationId('');
    setEducationInfo(null);
    setStudents([]);
    setAttendanceMap({});
  };

  const steps = [
    { key: 'verify', label: tx('رقم التعليم', 'Education ID'), icon: EDU_ICONS.key },
    { key: 'attendance', label: tx('تحضير الطلاب', 'Attendance'), icon: EDU_ICONS.check }
  ];

  // Period Modal — rendered outside the animated card so position:fixed holds.
  const periodModal = (
    <AnimatePresence>
      {showPeriodModal && (
        <motion.div
          className="edu-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setShowPeriodModal(false)}
        >
          <motion.div
            className="edu-modal"
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <h3>{tx('تحميل حضور فترة', 'Download a period')}</h3>
            <p className="edu-sub">{tx('ملف Excel بحضور كل الطلاب لكل يوم في الفترة.', "An Excel sheet with every student's attendance for each day of the period.")}</p>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{tx('تاريخ البداية', 'Start date')}</label>
                <input type="date" className="form-input" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{tx('تاريخ النهاية', 'End date')}</label>
                <input type="date" className="form-input" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            <div className="edu-modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPeriodModal(false)}>
                {tx('إلغاء', 'Cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={downloadPeriodExcel}>
                <Icon d={EDU_ICONS.download} />
                {tx('تحميل', 'Download')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <StudioShell
      isRTL={isRTL}
      theme={theme}
      onToggleTheme={toggleTheme}
      intro={EDU_INTRO(isRTL)}
      subtitle={tx('التعليم · حضور الطلاب', 'Education · student attendance')}
      servicesHref="/register"
      steps={steps}
      activeStep={step - 1}
      onJump={(i) => goToStep(i + 1)}
      onHome={startOver}
      extra={periodModal}
    >
      <motion.section
        className="rgx-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="rgx-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: isRTL ? -24 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? 24 : -24 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <p className="rgx-step-eyebrow">
                <span>{String(step).padStart(2, '0')}</span>
                {steps[step - 1]?.label}
              </p>

              {/* Step 1: Verify Education ID */}
              {step === 1 && (
                <EduVerify isRTL={isRTL} value={educationId} onChange={setEducationId} onVerify={handleVerify} loading={loading} />
              )}

              {/* Step 2: Attendance */}
              {step === 2 && (
                <>
                  <h2 className="step-title">{tx('حضور الطلاب', 'Student Attendance')}</h2>
                  <p className="step-description">{tx('امسح بطاقات الطلاب أو اضغط على حالة كل طالب — يُحفظ كل تغيير فورًا.', "Scan the students' cards or tap each student's status — every change saves right away.")}</p>

                  {educationInfo && <EduInfo isRTL={isRTL} info={educationInfo} />}

                  {/* Date + quick actions */}
                  <div className="edu-toolbar">
                    <div className="form-group">
                      <label className="form-label">{tx('تاريخ الحضور', 'Attendance date')}</label>
                      <input
                        type="date"
                        className="form-input"
                        value={attendanceDate}
                        onChange={e => handleDateChange(e.target.value)}
                      />
                    </div>
                    <div className="edu-actions">
                      <button type="button" className="btn edu-btn-navy" onClick={() => { showQRScanner ? stopQRScanner() : startQRScanner(); }}>
                        <Icon d={showQRScanner ? EDU_ICONS.x : EDU_ICONS.qr} />
                        {showQRScanner ? tx('إغلاق الماسح', 'Close scanner') : tx('مسح QR', 'Scan QR')}
                      </button>
                      <button type="button" className="btn edu-btn-ok" onClick={() => markAll('present')}>
                        {tx('تحضير الكل', 'All present')}
                      </button>
                      <button type="button" className="btn btn-secondary edu-btn-no" onClick={() => markAll('absent')}>
                        {tx('تغييب الكل', 'All absent')}
                      </button>
                    </div>
                  </div>

                  {/* Counts */}
                  <div className="edu-kpis">
                    <div className="edu-kpi">
                      <i><Icon d={EDU_ICONS.students} /></i>
                      <div><b>{students.length}</b><small>{tx('الطلاب', 'Students')}</small></div>
                    </div>
                    <div className="edu-kpi ok">
                      <i><Icon d={['M20 6 9 17l-5-5']} /></i>
                      <div><b>{presentCount}</b><small>{tx('حاضر', 'Present')}</small></div>
                    </div>
                    <div className="edu-kpi no">
                      <i><Icon d={EDU_ICONS.x} /></i>
                      <div><b>{absentCount}</b><small>{tx('غائب', 'Absent')}</small></div>
                    </div>
                  </div>

                  {/* QR Scanner */}
                  {showQRScanner && (
                    <div className="edu-scanner">
                      <div className="edu-scanner-head">
                        <span><Icon d={EDU_ICONS.photo} />{tx('مسح QR الطلاب', 'Scan student QR codes')}</span>
                        <button type="button" onClick={stopQRScanner} aria-label={tx('إغلاق', 'Close')}>✕</button>
                      </div>
                      <div id="edu-qr-reader" />
                    </div>
                  )}

                  {/* Students */}
                  {students.length > 0 ? (
                    <div className="edu-list">
                      {students.map(s => {
                        const present = attendanceMap[s.studentId] === 'present';
                        return (
                          <div className="edu-row edu-att-row" key={s.studentId}>
                            <img src={s.personalPhoto} alt="" />
                            <div className="edu-row-main">
                              <b>{s.fullName}</b>
                              <small><bdi>{s.nationalId}</bdi> · {s.schoolName}</small>
                            </div>
                            <button
                              type="button"
                              className={`edu-status ${present ? 'is-present' : 'is-absent'}`}
                              onClick={() => toggleStatus(s.studentId)}
                              aria-pressed={present}
                            >
                              {present ? tx('✓ حاضر', '✓ Present') : tx('✗ غائب', '✗ Absent')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="edu-empty">{tx('لا يوجد طلاب مسجلين', 'No registered students')}</div>
                  )}

                  {/* Auto-save indicator */}
                  <p className="edu-autosave">
                    <Icon d={['M20 6 9 17l-5-5']} />
                    {tx('يتم حفظ الحضور تلقائياً عند النقر', 'Attendance saves automatically on tap')}
                  </p>

                  {/* Download Section */}
                  {students.length > 0 && (
                    <div className="edu-downloads">
                      <p className="edu-kicker" style={{ margin: 0 }}>
                        <Icon d={EDU_ICONS.download} />
                        {tx('تحميل الحضور (Excel)', 'Download attendance (Excel)')}
                      </p>
                      <div>
                        <button type="button" className="btn btn-secondary" onClick={downloadDayExcel}>
                          <Icon d={EDU_ICONS.download} />
                          {tx('تحميل هذا اليوم', 'This day')}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowPeriodModal(true)}>
                          <Icon d={EDU_ICONS.schedule} />
                          {tx('تحميل فترة', 'A period')}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>
    </StudioShell>
  );
};

export default StudentAttendance;
