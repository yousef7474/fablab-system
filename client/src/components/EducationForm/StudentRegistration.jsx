import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';
import './EducationForm.css';

const StudentRegistration = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [educationId, setEducationId] = useState('');
  const [educationInfo, setEducationInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    nationalId: '',
    phoneNumber: '',
    schoolName: '',
    educationLevel: '',
    parentPhoneNumber: '',
    personalPhoto: ''
  });

  const handleVerify = async () => {
    if (!educationId.trim()) {
      toast.error('الرجاء إدخال رقم التعليم');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/education/verify/${encodeURIComponent(educationId.trim())}`);
      setEducationInfo(res.data);
      setStep(2);
      toast.success('تم التحقق بنجاح');
    } catch (error) {
      toast.error(error.response?.data?.messageAr || 'رقم التعليم غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setForm(prev => ({ ...prev, personalPhoto: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleAddToList = () => {
    const required = ['fullName', 'nationalId', 'phoneNumber', 'schoolName', 'educationLevel', 'parentPhoneNumber', 'personalPhoto'];
    for (const field of required) {
      if (!form[field]) {
        toast.error('جميع الحقول مطلوبة');
        return;
      }
    }
    setStudents(prev => [...prev, { ...form, _tempId: Date.now() }]);
    setForm({ fullName: '', nationalId: '', phoneNumber: '', schoolName: '', educationLevel: '', parentPhoneNumber: '', personalPhoto: '' });
    toast.success('تم إضافة الطالب إلى القائمة');
  };

  const handleRemoveFromList = (tempId) => {
    setStudents(prev => prev.filter(s => s._tempId !== tempId));
  };

  const handleSubmit = async () => {
    if (students.length === 0) {
      toast.error('أضف طالباً واحداً على الأقل');
      return;
    }
    setLoading(true);
    try {
      const payload = students.map(({ _tempId, ...rest }) => rest);
      await api.post(`/education/${encodeURIComponent(educationId)}/students`, { students: payload });
      setSubmitted(true);
      setStep(3);
      toast.success('تم تسجيل الطلاب بنجاح');
    } catch (error) {
      toast.error(error.response?.data?.messageAr || 'حدث خطأ أثناء التسجيل');
    } finally {
      setLoading(false);
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
          style={{ width: '100%', maxWidth: '700px' }}
        >
          {/* Header */}
          <div className="education-header">
            <div className="education-logo">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h1 className="education-title">تسجيل الطلاب</h1>
            <p className="education-subtitle">Student Registration</p>
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            {[1, 2, 3].map(s => (
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

              {/* Step 2: Add Students */}
              {step === 2 && !submitted && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  {/* Education Info Card */}
                  {educationInfo && (
                    <div style={{
                      background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', borderRadius: '12px',
                      padding: '16px', marginBottom: '24px', border: '1px solid #ddd6fe'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div><span style={{ color: '#64748b', fontSize: '12px' }}>رقم التعليم</span><br /><strong style={{ color: '#5b21b6' }}>{educationInfo.educationId}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '12px' }}>المعلم</span><br /><strong style={{ color: '#5b21b6' }}>{educationInfo.teacherName}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '12px' }}>القسم</span><br /><strong style={{ color: '#5b21b6' }}>{educationInfo.section}</strong></div>
                        <div><span style={{ color: '#64748b', fontSize: '12px' }}>الجدول</span><br /><strong style={{ color: '#5b21b6' }}>{educationInfo.periodStartTime} - {educationInfo.periodEndTime}</strong></div>
                      </div>
                    </div>
                  )}

                  <h3 style={{ color: '#1e293b', marginBottom: '16px', textAlign: 'right' }}>بيانات الطالب</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={labelStyle}>الاسم الكامل *</label>
                      <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} style={inputStyle} placeholder="اسم الطالب الكامل" />
                    </div>
                    <div>
                      <label style={labelStyle}>رقم الهوية *</label>
                      <input type="text" value={form.nationalId} onChange={e => setForm(p => ({ ...p, nationalId: e.target.value }))} style={inputStyle} placeholder="رقم الهوية الوطنية" />
                    </div>
                    <div>
                      <label style={labelStyle}>رقم الهاتف *</label>
                      <input type="text" value={form.phoneNumber} onChange={e => setForm(p => ({ ...p, phoneNumber: e.target.value }))} style={inputStyle} placeholder="05XXXXXXXX" />
                    </div>
                    <div>
                      <label style={labelStyle}>اسم المدرسة *</label>
                      <input type="text" value={form.schoolName} onChange={e => setForm(p => ({ ...p, schoolName: e.target.value }))} style={inputStyle} placeholder="اسم المدرسة" />
                    </div>
                    <div>
                      <label style={labelStyle}>المرحلة التعليمية *</label>
                      <select value={form.educationLevel} onChange={e => setForm(p => ({ ...p, educationLevel: e.target.value }))} style={inputStyle}>
                        <option value="">اختر المرحلة</option>
                        <option value="ابتدائي">ابتدائي</option>
                        <option value="متوسط">متوسط</option>
                        <option value="ثانوي">ثانوي</option>
                        <option value="جامعي">جامعي</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>رقم هاتف ولي الأمر *</label>
                      <input type="text" value={form.parentPhoneNumber} onChange={e => setForm(p => ({ ...p, parentPhoneNumber: e.target.value }))} style={inputStyle} placeholder="05XXXXXXXX" />
                    </div>
                  </div>

                  {/* Photo Upload */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>الصورة الشخصية *</label>
                    <div style={{
                      border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '20px',
                      textAlign: 'center', cursor: 'pointer', position: 'relative',
                      background: form.personalPhoto ? '#f8fafc' : 'white'
                    }}>
                      {form.personalPhoto ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                          <img src={form.personalPhoto} alt="Preview" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                          <span style={{ color: '#10b981', fontWeight: '600' }}>تم رفع الصورة</span>
                        </div>
                      ) : (
                        <div>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ marginBottom: '8px' }}>
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                          </svg>
                          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>اضغط لرفع الصورة</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handlePhotoUpload}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <button onClick={handleAddToList} style={{ ...btnPrimary, background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      إضافة إلى القائمة
                    </button>
                  </div>

                  {/* Students Table */}
                  {students.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ color: '#1e293b', marginBottom: '12px', textAlign: 'right' }}>
                        قائمة الطلاب ({students.length})
                      </h4>
                      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'linear-gradient(135deg, #5b21b6, #6d28d9)', color: 'white' }}>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>الصورة</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>الاسم</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>الهوية</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>المدرسة</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>المرحلة</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>الهاتف</th>
                              <th style={{ padding: '10px 12px', textAlign: 'right' }}>ولي الأمر</th>
                              <th style={{ padding: '10px 12px', textAlign: 'center' }}>حذف</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((s, i) => (
                              <tr key={s._tempId} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                                <td style={{ padding: '8px 12px' }}><img src={s.personalPhoto} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} /></td>
                                <td style={{ padding: '8px 12px' }}>{s.fullName}</td>
                                <td style={{ padding: '8px 12px' }}>{s.nationalId}</td>
                                <td style={{ padding: '8px 12px' }}>{s.schoolName}</td>
                                <td style={{ padding: '8px 12px' }}>{s.educationLevel}</td>
                                <td style={{ padding: '8px 12px' }}>{s.phoneNumber}</td>
                                <td style={{ padding: '8px 12px' }}>{s.parentPhoneNumber}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <button onClick={() => handleRemoveFromList(s._tempId)} style={{
                                    background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px',
                                    padding: '4px 8px', cursor: 'pointer', fontSize: '12px'
                                  }}>حذف</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {students.length > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <button onClick={handleSubmit} disabled={loading} style={btnPrimary}>
                        {loading ? <span style={{ width: '20px', height: '20px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} /> : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                            تسجيل الطلاب ({students.length})
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Success */}
              {step === 3 && submitted && (
                <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <h2 style={{ color: '#1e293b', marginBottom: '8px' }}>تم التسجيل بنجاح!</h2>
                  <p style={{ color: '#64748b', marginBottom: '4px' }}>تم تسجيل {students.length} طالب بنجاح</p>
                  <p style={{ color: '#6d28d9', fontWeight: '700', fontSize: '18px', marginBottom: '24px' }}>رقم التعليم: {educationId}</p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button onClick={() => { setStep(1); setStudents([]); setEducationId(''); setEducationInfo(null); setSubmitted(false); }} style={btnPrimary}>
                      تسجيل مجموعة جديدة
                    </button>
                    <button onClick={() => navigate('/')} style={{ ...btnPrimary, background: '#64748b' }}>
                      الصفحة الرئيسية
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default StudentRegistration;
