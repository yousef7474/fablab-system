import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import api from '../../config/api';
import './CustomersManagement.css';

const emptyForm = { name: '', email: '', phone: '' };

const CustomersManagement = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const t = (ar, en) => (isRTL ? ar : en);

  const [subTab, setSubTab] = useState('compose'); // compose | list
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState(null); // customer or null
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  // Compose form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [useHtml, setUseHtml] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [showConfirmSend, setShowConfirmSend] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers');
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      toast.error(t('خطأ في تحميل العملاء', 'Failed to load customers'));
    } finally {
      setLoading(false);
    }
  }, [isRTL]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const stats = useMemo(() => {
    const total = customers.length;
    const withEmail = customers.filter(c => c.email && c.email.trim()).length;
    return { total, withEmail, withoutEmail: total - withEmail };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      (c.name  || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowAddModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name || '', email: c.email || '', phone: c.phone || '' });
    setShowAddModal(true);
  };

  const closeAdd = () => {
    if (saving) return;
    setShowAddModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const submitAdd = async (e) => {
    e?.preventDefault?.();
    if (!form.name.trim()) {
      toast.error(t('الاسم مطلوب', 'Name is required'));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/customers/${editing.customerId}`, form);
        toast.success(t('تم تحديث العميل', 'Customer updated'));
      } else {
        await api.post('/customers', form);
        toast.success(t('تمت إضافة العميل', 'Customer added'));
      }
      closeAdd();
      fetchCustomers();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.messageAr || err.response?.data?.message || t('فشل الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    const msg = t(`هل تريد حذف "${c.name}"؟`, `Delete "${c.name}"?`);
    if (!window.confirm(msg)) return;
    try {
      await api.delete(`/customers/${c.customerId}`);
      toast.success(t('تم الحذف', 'Deleted'));
      fetchCustomers();
    } catch (err) {
      console.error(err);
      toast.error(t('فشل الحذف', 'Delete failed'));
    }
  };

  // Excel import — reads the file client-side with SheetJS and posts to
  // /customers/bulk-import. Column headers are matched loosely: any header
  // containing "name/الاسم" → name; "email/بريد" → email; "phone/جوال/هاتف"
  // → phone.
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const rows = json.map(row => {
        const out = { name: '', email: '', phone: '' };
        for (const [key, val] of Object.entries(row)) {
          const k = String(key).toLowerCase();
          const v = val == null ? '' : String(val).trim();
          if (!out.name  && (k.includes('name')  || k.includes('الاسم'))) out.name  = v;
          else if (!out.email && (k.includes('email') || k.includes('بريد') || k.includes('mail'))) out.email = v;
          else if (!out.phone && (k.includes('phone') || k.includes('جوال') || k.includes('هاتف') || k.includes('mobile'))) out.phone = v;
        }
        return out;
      }).filter(r => r.name);

      if (rows.length === 0) {
        toast.warning(t('لم يتم العثور على صفوف صالحة', 'No valid rows found'));
        return;
      }

      const res = await api.post('/customers/bulk-import', { rows });
      const s = res.data || {};
      toast.success(t(
        `تمت الإضافة: ${s.inserted || 0} • تحديث: ${s.updated || 0} • تخطى: ${s.skipped || 0}`,
        `Inserted: ${s.inserted || 0} • Updated: ${s.updated || 0} • Skipped: ${s.skipped || 0}`
      ));
      fetchCustomers();
    } catch (err) {
      console.error(err);
      toast.error(t('فشل استيراد الملف', 'File import failed'));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendEmail = async (isTest = false) => {
    if (!subject.trim()) {
      toast.error(t('العنوان مطلوب', 'Subject is required'));
      return;
    }
    if (!message.trim()) {
      toast.error(t('الرسالة مطلوبة', 'Message is required'));
      return;
    }
    if (isTest && !testEmail.trim()) {
      toast.error(t('أدخل بريد الاختبار', 'Enter a test email'));
      return;
    }

    setSending(true);
    try {
      const payload = { subject, message, useHtml };
      if (isTest) payload.testEmail = testEmail.trim();
      const res = await api.post('/customers/send-email', payload);
      const r = res.data || {};
      if (isTest) {
        toast.success(t(
          `أُرسل بريد اختبار إلى ${testEmail}`,
          `Test email sent to ${testEmail}`
        ));
      } else {
        toast.success(t(
          `تم الإرسال إلى ${r.sent} • فشل: ${r.failed}`,
          `Sent to ${r.sent} • Failed: ${r.failed}`
        ));
        setShowConfirmSend(false);
        if (r.errors?.length) console.warn('Send errors:', r.errors);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.messageAr || err.response?.data?.message || t('فشل الإرسال', 'Send failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="customers-management" data-page="manager">
      <div className="customers-header">
        <div>
          <h2>{t('العملاء والمراسلة', 'Customers & Mailing List')}</h2>
          <p>{t(
            'قائمة عملاء فاب لاب لإرسال حملات البريد الإلكتروني.',
            'FabLab customer contacts for sending email campaigns.'
          )}</p>
        </div>
      </div>

      <div className="customers-stats">
        <div className="customer-stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">{t('إجمالي العملاء', 'Total customers')}</div>
          </div>
        </div>
        <div className="customer-stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div>
            <div className="stat-value">{stats.withEmail}</div>
            <div className="stat-label">{t('لديهم بريد إلكتروني', 'With email')}</div>
          </div>
        </div>
        <div className="customer-stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div className="stat-value">{stats.withoutEmail}</div>
            <div className="stat-label">{t('بدون بريد إلكتروني', 'Without email')}</div>
          </div>
        </div>
      </div>

      <div className="customers-tabs">
        <button
          className={`customers-tab ${subTab === 'compose' ? 'active' : ''}`}
          onClick={() => setSubTab('compose')}
        >
          {t('إرسال بريد جماعي', 'Send Bulk Email')}
        </button>
        <button
          className={`customers-tab ${subTab === 'list' ? 'active' : ''}`}
          onClick={() => setSubTab('list')}
        >
          {t(`قائمة العملاء (${stats.total})`, `Customer List (${stats.total})`)}
        </button>
      </div>

      {subTab === 'compose' && (
        <div className="compose-panel">
          <div className="compose-card">
            <div className="compose-recipients-banner">
              <div>
                <div className="banner-title">{t('المستلمون', 'Recipients')}</div>
                <div className="banner-count">{stats.withEmail}</div>
                <div className="banner-sub">
                  {t(
                    `سيتم إرسال البريد إلى ${stats.withEmail} عميل لديهم بريد إلكتروني صالح.`,
                    `Email will be sent to ${stats.withEmail} customers with a valid email address.`
                  )}
                  {stats.withoutEmail > 0 && (
                    <span className="banner-warn">
                      {t(
                        ` (سيتم تجاوز ${stats.withoutEmail} بدون بريد)`,
                        ` (${stats.withoutEmail} without email will be skipped)`
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <label className="field">
              <span className="field-label">{t('العنوان', 'Subject')}</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('مثال: ورشة الطباعة ثلاثية الأبعاد — الأسبوع القادم', 'e.g. 3D Printing Workshop — Next Week')}
                maxLength={200}
              />
            </label>

            <label className="field">
              <span className="field-label">
                {t('الرسالة', 'Message')}
                <label className="html-toggle">
                  <input
                    type="checkbox"
                    checked={useHtml}
                    onChange={(e) => setUseHtml(e.target.checked)}
                  />
                  <span>{t('HTML', 'HTML')}</span>
                </label>
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t(
                  useHtml
                    ? '<p>اكتب رسالتك بصيغة HTML هنا…</p>'
                    : 'اكتب رسالتك هنا. سيتم الحفاظ على الأسطر الجديدة تلقائياً.',
                  useHtml
                    ? '<p>Write your HTML message here…</p>'
                    : 'Write your message here. Line breaks are preserved automatically.'
                )}
                rows={12}
              />
              <span className="field-hint">
                {t(
                  useHtml
                    ? 'وضع HTML: يمكنك استخدام وسوم مثل <b> و<a href>.'
                    : 'وضع النص: الأسطر الجديدة والروابط تُحفظ كما هي.',
                  useHtml
                    ? 'HTML mode: you can use tags like <b> and <a href>.'
                    : 'Plain text mode: line breaks are preserved as-is.'
                )}
              </span>
            </label>

            <div className="compose-actions">
              <div className="test-row">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder={t('بريد الاختبار', 'Test email')}
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => sendEmail(true)}
                  disabled={sending}
                >
                  {sending ? t('جارٍ الإرسال…', 'Sending…') : t('إرسال اختبار', 'Send test')}
                </button>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowConfirmSend(true)}
                disabled={sending || stats.withEmail === 0}
              >
                {t(
                  `إرسال إلى ${stats.withEmail} عميل`,
                  `Send to ${stats.withEmail} customers`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === 'list' && (
        <div className="list-panel">
          <div className="list-toolbar">
            <input
              type="text"
              className="list-search"
              placeholder={t('بحث بالاسم أو البريد أو الجوال…', 'Search by name, email, or phone…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="list-actions">
              <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? t('جارٍ الاستيراد…', 'Importing…') : t('استيراد من Excel', 'Import from Excel')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileImport}
              />
              <button className="btn btn-primary" onClick={openAdd}>
                {t('+ إضافة عميل', '+ Add customer')}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-block">{t('جارٍ التحميل…', 'Loading…')}</div>
          ) : filtered.length === 0 ? (
            <div className="empty-block">
              {search
                ? t('لا توجد نتائج للبحث.', 'No results for your search.')
                : t('لا يوجد عملاء بعد. أضف واحداً أو استورد من Excel.', 'No customers yet. Add one or import from Excel.')}
            </div>
          ) : (
            <div className="customers-table-wrap">
              <table className="customers-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>{t('الاسم', 'Name')}</th>
                    <th>{t('البريد الإلكتروني', 'Email')}</th>
                    <th>{t('الجوال', 'Phone')}</th>
                    <th style={{ width: 140 }}>{t('إجراءات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.customerId}>
                      <td className="row-num">{i + 1}</td>
                      <td className="row-name">{c.name}</td>
                      <td className="row-email">
                        {c.email
                          ? <a href={`mailto:${c.email}`}>{c.email}</a>
                          : <span className="muted">—</span>}
                      </td>
                      <td className="row-phone">{c.phone || <span className="muted">—</span>}</td>
                      <td className="row-actions">
                        <button className="icon-btn" title={t('تعديل', 'Edit')} onClick={() => openEdit(c)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                        </button>
                        <button className="icon-btn danger" title={t('حذف', 'Delete')} onClick={() => handleDelete(c)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="cm-modal-overlay" onClick={closeAdd}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header">
              <h3>{editing ? t('تعديل العميل', 'Edit Customer') : t('إضافة عميل', 'Add Customer')}</h3>
              <button className="cm-close" onClick={closeAdd}>×</button>
            </div>
            <form onSubmit={submitAdd} className="cm-modal-body">
              <label className="field">
                <span className="field-label">{t('الاسم', 'Name')} <span className="req">*</span></span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span className="field-label">{t('البريد الإلكتروني', 'Email')}</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">{t('الجوال', 'Phone')}</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="9665XXXXXXXX"
                />
              </label>
              <div className="cm-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeAdd} disabled={saving}>
                  {t('إلغاء', 'Cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmSend && (
        <div className="cm-modal-overlay" onClick={() => !sending && setShowConfirmSend(false)}>
          <div className="cm-modal cm-modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="cm-modal-header">
              <h3>{t('تأكيد الإرسال الجماعي', 'Confirm Bulk Send')}</h3>
            </div>
            <div className="cm-modal-body">
              <p className="confirm-lead">
                {t(
                  `أنت على وشك إرسال بريد إلى ${stats.withEmail} عميل. هذا الإجراء لا يمكن التراجع عنه.`,
                  `You are about to send this email to ${stats.withEmail} customers. This action cannot be undone.`
                )}
              </p>
              <div className="confirm-preview">
                <div className="preview-row"><strong>{t('العنوان:', 'Subject:')}</strong> {subject}</div>
                <div className="preview-row"><strong>{t('المستلمون:', 'Recipients:')}</strong> {stats.withEmail}</div>
              </div>
              <div className="cm-modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowConfirmSend(false)} disabled={sending}>
                  {t('إلغاء', 'Cancel')}
                </button>
                <button className="btn btn-primary" onClick={() => sendEmail(false)} disabled={sending}>
                  {sending
                    ? t('جارٍ الإرسال…', 'Sending…')
                    : t('نعم، إرسال الآن', 'Yes, send now')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersManagement;
