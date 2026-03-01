import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import api from '../../config/api';
import './EducationForm.css';

const StudentAttendance = () => {
  const navigate = useNavigate();
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

  const handleVerify = async () => {
    if (!educationId.trim()) {
      toast.error('الرجاء إدخال رقم التعليم');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/education/verify/${encodeURIComponent(educationId.trim())}`);
      setEducationInfo(res.data);
      // Fetch students
      const studentsRes = await api.get(`/education/${encodeURIComponent(educationId.trim())}/students/public`);
      setStudents(studentsRes.data);
      // Initialize all as present
      const map = {};
      studentsRes.data.forEach(s => { map[s.studentId] = 'present'; });
      setAttendanceMap(map);
      setStep(2);
      toast.success('تم التحقق بنجاح');
    } catch (error) {
      toast.error(error.response?.data?.messageAr || 'رقم التعليم غير صحيح');
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

  const toggleStatus = (studentId) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present'
    }));
  };

  const markAll = (status) => {
    const map = {};
    students.forEach(s => { map[s.studentId] = status; });
    setAttendanceMap(map);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const records = Object.entries(attendanceMap).map(([studentId, status]) => ({ studentId, status }));
      await api.post(`/education/${encodeURIComponent(educationId)}/attendance`, { date: attendanceDate, records });
      toast.success('تم تسجيل الحضور بنجاح');
    } catch (error) {
      toast.error(error.response?.data?.messageAr || 'حدث خطأ أثناء التسجيل');
    } finally {
      setLoading(false);
    }
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
      toast.success('تم تحميل الملف');
    } catch {
      toast.error('حدث خطأ أثناء التحميل');
    }
  };

  const downloadPeriodExcel = async () => {
    if (!periodStart || !periodEnd) {
      toast.error('حدد تاريخ البداية والنهاية');
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
      toast.success('تم تحميل الملف');
    } catch {
      toast.error('حدث خطأ أثناء التحميل');
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '10px', border: '2px solid #e2e8f0',
    fontSize: '15px', outline: 'none', transition: 'border 0.2s', direction: 'rtl', textAlign: 'right',
    boxSizing: 'border-box'
  };

  const labelStyle = { display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', textAlign: 'right', fontSize: '14px' };

  const btnPrimary = {
    background: 'linear-gradient(135deg, #6d28d9, #7c3aed)', color: 'white', border: 'none',
    padding: '14px 32px', borderRadius: '12px', fontSize: '16px', fontWeight: '700',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
    boxShadow: '0 4px 15px rgba(109, 40, 217, 0.3)'
  };

  const presentCount = Object.values(attendanceMap).filter(s => s === 'present').length;
  const absentCount = Object.values(attendanceMap).filter(s => s === 'absent').length;

  return (
    <div className="education-page">
      <div className="education-bg-shapes">
        <div className="education-shape" />
        <div className="education-shape" />
        <div className="education-shape" />
      </div>
      <div className="education-container">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{ width: '100%', maxWidth: '800px' }}
        >
          {/* Header */}
          <div className="education-header">
            <div className="education-logo">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <h1 className="education-title">حضور الطلاب</h1>
            <p className="education-subtitle">Student Attendance</p>
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: '40px', height: '6px', borderRadius: '3px',
                background: step >= s ? 'white' : 'rgba(255,255,255,0.3)',
                transition: 'background 0.3s'
              }} />
            ))}
          </div>

          {/* Card */}
          <div style={{
            background: 'white', borderRadius: '20px', padding: '32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)', position: 'relative'
          }}>
            {/* Home button */}
            <button
              onClick={() => navigate('/')}
              style={{
                position: 'absolute', top: '16px', left: '16px', background: 'none', border: 'none',
                cursor: 'pointer', color: '#6d28d9', padding: '8px'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>

            <AnimatePresence mode="wait">
              {/* Step 1: Verify Education ID */}
              {step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                      width: '70px', height: '70px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px'
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                    <h2 style={{ color: '#1e293b', fontSize: '22px', margin: '0 0 8px 0' }}>التحقق من رقم التعليم</h2>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>أدخل رقم التعليم الخاص بالمعلم (مثال: E#00001)</p>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>رقم التعليم *</label>
                    <input
                      type="text"
                      placeholder="E#00001"
                      value={educationId}
                      onChange={e => setEducationId(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleVerify()}
                      style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', fontWeight: '700', letterSpacing: '2px' }}
                    />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={handleVerify} disabled={loading} style={btnPrimary}>
                      {loading ? <span style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} /> : 'تحقق'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Attendance */}
              {step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  {/* Education Info */}
                  {educationInfo && (
                    <div style={{
                      background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', borderRadius: '12px',
                      padding: '16px', marginBottom: '20px', border: '1px solid #ddd6fe'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div><span style={{ color: '#64748b', fontSize: '12px' }}>رقم التعليم</span><br /><strong style={{ color: '#5b21b6' }}>{educationInfo.educationId}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '12px' }}>المعلم</span><br /><strong style={{ color: '#5b21b6' }}>{educationInfo.teacherName}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '12px' }}>القسم</span><br /><strong style={{ color: '#5b21b6' }}>{educationInfo.section}</strong></div>
                      </div>
                    </div>
                  )}

                  {/* Date Picker */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>تاريخ الحضور</label>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={e => handleDateChange(e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center', fontSize: '16px', fontWeight: '600' }}
                    />
                  </div>

                  {/* Quick Actions */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => markAll('present')} style={{
                      background: '#10b981', color: 'white', border: 'none', padding: '8px 20px',
                      borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                    }}>
                      تحضير الكل
                    </button>
                    <button onClick={() => markAll('absent')} style={{
                      background: '#ef4444', color: 'white', border: 'none', padding: '8px 20px',
                      borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                    }}>
                      تغييب الكل
                    </button>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', fontWeight: '600' }}>
                      <span style={{ color: '#10b981' }}>حاضر: {presentCount}</span>
                      <span style={{ color: '#ef4444' }}>غائب: {absentCount}</span>
                    </div>
                  </div>

                  {/* Students Table */}
                  {students.length > 0 ? (
                    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: 'linear-gradient(135deg, #5b21b6, #6d28d9)', color: 'white' }}>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>الصورة</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>الاسم</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>الهوية</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>المدرسة</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>الحالة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((s, i) => (
                            <tr key={s.studentId} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <img src={s.personalPhoto} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: '600' }}>{s.fullName}</td>
                              <td style={{ padding: '8px 12px' }}>{s.nationalId}</td>
                              <td style={{ padding: '8px 12px' }}>{s.schoolName}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => toggleStatus(s.studentId)}
                                  style={{
                                    background: attendanceMap[s.studentId] === 'present' ? '#10b981' : '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '6px 16px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    minWidth: '70px',
                                    transition: 'background 0.2s'
                                  }}
                                >
                                  {attendanceMap[s.studentId] === 'present' ? '✓ حاضر' : '✗ غائب'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      لا يوجد طلاب مسجلين
                    </div>
                  )}

                  {/* Submit Button */}
                  {students.length > 0 && (
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <button onClick={handleSubmit} disabled={loading} style={btnPrimary}>
                        {loading ? <span style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} /> : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                            تسجيل الحضور
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Download Section */}
                  {students.length > 0 && (
                    <div style={{
                      background: '#f5f3ff', borderRadius: '12px', padding: '16px',
                      border: '1px solid #ddd6fe', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap'
                    }}>
                      <button onClick={downloadDayExcel} style={{
                        background: 'linear-gradient(135deg, #6d28d9, #7c3aed)', color: 'white', border: 'none',
                        padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '6px'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        تحميل هذا اليوم
                      </button>
                      <button onClick={() => setShowPeriodModal(true)} style={{
                        background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', color: 'white', border: 'none',
                        padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '6px'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        تحميل فترة
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Period Modal */}
      <AnimatePresence>
        {showPeriodModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowPeriodModal(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 1000
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'white', borderRadius: '20px', padding: '32px',
                maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }}
            >
              <h3 style={{ color: '#1e293b', marginBottom: '20px', textAlign: 'center' }}>تحميل حضور فترة</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>تاريخ البداية</label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>تاريخ النهاية</label>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={downloadPeriodExcel} style={btnPrimary}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  تحميل
                </button>
                <button onClick={() => setShowPeriodModal(false)} style={{
                  ...btnPrimary, background: '#64748b', boxShadow: 'none'
                }}>
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default StudentAttendance;
