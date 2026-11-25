import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

// Open / close the 3D printing service (the same switch as the admin
// Settings card), for the 3D printing staff on the employee board. An
// optional from / to window schedules the closure; the reason is shown on
// the public /print-service page.
const Print3DServiceStatus = ({ apiClient, isRTL }) => {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ from: '', to: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/settings/print3d-status');
      setStatus(data);
      setForm({ from: data.from || '', to: data.to || '', reason: data.reason || '' });
    } catch { /* the tab still works without it */ }
  }, [apiClient]);
  useEffect(() => { load(); }, [load]);

  const save = async (disabled) => {
    if (disabled && !form.reason.trim()) {
      toast.error(isRTL ? 'اكتب سبب الإغلاق أولًا' : 'Write the reason first');
      return;
    }
    setSaving(true);
    try {
      await apiClient.put('/settings/print3d-status', disabled
        ? { disabled: true, from: form.from || null, to: form.to || null, reason: form.reason }
        : { disabled: false });
      toast.success(isRTL ? (disabled ? 'تم إغلاق الخدمة' : 'تم فتح الخدمة') : (disabled ? 'Service closed' : 'Service open'));
      load();
    } catch {
      toast.error(isRTL ? 'تعذّر الحفظ' : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!status) return null;
  const closed = !!status.effectiveClosed;
  return (
    <div className={`p3t-svc ${closed ? 'is-closed' : 'is-open'}`}>
      <div className="p3t-svc-state">
        <b>{closed ? (isRTL ? 'الخدمة مغلقة حاليًا' : 'The service is closed') : (isRTL ? 'الخدمة مفتوحة لاستقبال الطلبات' : 'The service is taking requests')}</b>
        <small>
          {status.disabled && !closed
            ? (isRTL ? `إغلاق مجدول ${status.from || ''} ← ${status.to || ''}` : `Closure scheduled ${status.from || ''} → ${status.to || ''}`)
            : closed && status.reason ? status.reason
              : (isRTL ? 'عند الإغلاق يظهر السبب في صفحة طلب الطباعة' : 'When closed, the reason shows on the print request page')}
        </small>
      </div>
      {status.disabled ? (
        <button type="button" className="p3t-btn p3t-btn--success p3t-btn--sm" disabled={saving} onClick={() => save(false)}>
          {isRTL ? 'فتح الخدمة' : 'Open the service'}
        </button>
      ) : (
        <div className="p3t-svc-form">
          <input type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} title={isRTL ? 'من (اختياري)' : 'From (optional)'} />
          <input type="date" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} title={isRTL ? 'إلى (اختياري)' : 'To (optional)'} />
          <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={isRTL ? 'سبب الإغلاق (يظهر للعملاء)' : 'Reason (shown to customers)'} />
          <button type="button" className="p3t-btn p3t-btn--danger p3t-btn--sm" disabled={saving} onClick={() => save(true)}>
            {isRTL ? 'إغلاق الخدمة' : 'Close the service'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Print3DServiceStatus;
