import React from 'react';
import { Icon } from '../RegistrationForm/StudioShell';

// Shared pieces of the three education pages (teacher, students, attendance).

// 24-unit-grid icons for rail steps / tiles.
export const EDU_ICONS = {
  teacher: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  section: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  schedule: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  photo: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  terms: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z'],
  key: ['M21 2l-2 2', 'M15.5 7.5l3 3L22 7l-3-3', 'M11.39 11.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78z', 'M11.4 11.6 19 4'],
  students: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  check: ['M9 11l3 3L22 4', 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  done: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  plus: ['M12 5v14', 'M5 12h14'],
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  qr: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M20 14v.01', 'M14 20h.01', 'M17 20h4v-3'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3']
};

// What the education service is — shown on the rail when no steps run.
export const EDU_INTRO = (isRTL) => ({
  portal: isRTL ? 'التعليم · فاب لاب الأحساء' : 'Education · FabLab Al-Ahsa',
  title: isRTL ? <>نتعلّم بالصنع<br /><em>في قاعات فاب لاب</em></> : <>Learning by making<br /><em>in FabLab's rooms</em></>,
  features: [
    { ar: 'حجز قاعة وقسم لفترة تعليمية كاملة', en: 'Book a room and section for a full teaching period', d: EDU_ICONS.schedule },
    { ar: 'تسجيل الطلاب برقم التعليم', en: 'Register students with the education ID', d: EDU_ICONS.students },
    { ar: 'تحضير الطلاب بمسح بطاقاتهم', en: 'Take attendance by scanning their cards', d: EDU_ICONS.check }
  ]
});

// Step 1 of the students / attendance pages: confirm the teacher's education ID.
export const EduVerify = ({ isRTL, value, onChange, onVerify, loading }) => (
  <div className="edu-verify">
    <span className="edu-verify-ico"><Icon d={EDU_ICONS.search} /></span>
    <h2 className="step-title">{isRTL ? 'التحقق من رقم التعليم' : 'Verify the education ID'}</h2>
    <p className="step-description">
      {isRTL ? 'أدخل رقم التعليم الخاص بالمعلم (مثال: E#00001)' : "Enter the teacher's education ID (e.g. E#00001)"}
    </p>
    <div className="form-group">
      <label className="form-label">{isRTL ? 'رقم التعليم' : 'Education ID'} <span className="required">*</span></label>
      <input
        type="text"
        className="form-input edu-code"
        placeholder="E#00001"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && onVerify()}
      />
    </div>
    <button type="button" className="btn btn-primary" onClick={onVerify} disabled={loading}>
      {loading ? <span className="loading-spinner" /> : (
        <>
          <Icon d={EDU_ICONS.check} />
          {isRTL ? 'تحقق' : 'Verify'}
        </>
      )}
    </button>
  </div>
);

// The verified education period, as a strip of facts.
export const EduInfo = ({ isRTL, info, withSchedule }) => (
  <div className="edu-info">
    <div><small>{isRTL ? 'رقم التعليم' : 'Education ID'}</small><b><bdi>{info.educationId}</bdi></b></div>
    <div><small>{isRTL ? 'المعلم' : 'Teacher'}</small><b>{info.teacherName}</b></div>
    <div><small>{isRTL ? 'القسم' : 'Section'}</small><b>{info.section}</b></div>
    {withSchedule && (
      <div><small>{isRTL ? 'الجدول' : 'Schedule'}</small><b><bdi dir="ltr">{info.periodStartTime} - {info.periodEndTime}</bdi></b></div>
    )}
  </div>
);
