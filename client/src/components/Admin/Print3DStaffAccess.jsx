import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Admin 3D Printing tab → "موظفو الخدمة": which employees run the 3D
// printing service from their own board (same access as the admins:
// requests, quotes, statuses, customer emails, materials, open / close).
const Print3DStaffAccess = ({ isRTL, onClose }) => {
  const [emails, setEmails] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [pick, setPick] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/print3d/staff')
      .then(({ data }) => { setEmails(data.emails || []); setEmployees(data.employees || []); })
      .catch(() => { toast.error(isRTL ? 'تعذّر تحميل القائمة' : 'Failed to load the list'); onClose(); });
  }, [isRTL, onClose]);

  const byEmail = useMemo(() => Object.fromEntries(employees.map(e => [String(e.email).toLowerCase(), e])), [employees]);
  const candidates = employees.filter(e => !(emails || []).includes(String(e.email).toLowerCase()));

  const save = async (next) => {
    setSaving(true);
    try {
      const { data } = await api.put('/print3d/staff', { emails: next });
      setEmails(data.emails);
      toast.success(isRTL ? 'تم حفظ صلاحيات الموظفين' : 'Staff access saved');
    } catch {
      toast.error(isRTL ? 'تعذّر الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="p3t-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="p3t-modal"
        dir={isRTL ? 'rtl' : 'ltr'}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p3t-modal-head">
          <div>
            <div className="p3t-modal-kicker">{isRTL ? 'صلاحيات خدمة الطباعة' : '3D printing access'}</div>
            <h3>{isRTL ? 'موظفو الخدمة' : 'Service staff'}</h3>
          </div>
          <button type="button" className="p3t-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="p3t-modal-body">
          <p className="p3t-staff-intro">
            {isRTL
              ? 'يدير هؤلاء الموظفون خدمة الطباعة من لوحة الموظف بنفس صلاحيات الإدارة: الطلبات، عروض الأسعار، الحالات، مراسلة العملاء، الخامات، وفتح الخدمة وإغلاقها. يصلهم أيضًا إشعار بكل طلب جديد.'
              : 'These employees run the service from their employee board with the same access as admins: requests, quotes, statuses, customer emails, materials, and opening / closing the service. They also get an email for every new request.'}
          </p>
          {emails === null ? (
            <p className="p3t-staff-empty">{isRTL ? 'جاري التحميل…' : 'Loading…'}</p>
          ) : (
            <>
              <ul className="p3t-staff-list">
                {emails.length === 0 && <li className="p3t-staff-empty">{isRTL ? 'لا يوجد موظفون — الخدمة للإدارة فقط' : 'No staff — admins only'}</li>}
                {emails.map(email => (
                  <li key={email}>
                    <span>
                      <b>{byEmail[email]?.name || (isRTL ? 'لا يوجد موظف بهذا البريد بعد' : 'No employee with this email yet')}</b>
                      <small dir="ltr">{email}</small>
                    </span>
                    <button type="button" className="p3t-btn p3t-btn--danger p3t-btn--sm" disabled={saving} onClick={() => save(emails.filter(e => e !== email))}>
                      {isRTL ? 'إزالة' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="p3t-staff-add">
                <select value={pick} onChange={e => setPick(e.target.value)} disabled={saving}>
                  <option value="">{isRTL ? 'اختر موظفًا لإضافته…' : 'Pick an employee to add…'}</option>
                  {candidates.map(e => <option key={e.employeeId} value={String(e.email).toLowerCase()}>{e.name} — {e.email}</option>)}
                </select>
                <button type="button" className="p3t-btn p3t-btn--primary p3t-btn--sm" disabled={!pick || saving} onClick={() => { save([...emails, pick]); setPick(''); }}>
                  {isRTL ? 'إضافة' : 'Add'}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Print3DStaffAccess;
