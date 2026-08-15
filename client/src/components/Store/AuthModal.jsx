import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

// Login/Register modal for the store customer.
const AuthModal = ({ isRTL, onClose, onSuccess, login, register, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', nationalId: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password) {
      toast.error(isRTL ? 'البريد وكلمة المرور مطلوبان' : 'Email + password required');
      return;
    }
    if (mode === 'register' && !form.name.trim()) {
      toast.error(isRTL ? 'الاسم مطلوب' : 'Name required');
      return;
    }
    if (mode === 'register' && form.password.length < 6) {
      toast.error(isRTL ? '6 أحرف على الأقل لكلمة المرور' : 'Password ≥ 6 chars');
      return;
    }
    setBusy(true);
    try {
      const c = mode === 'login'
        ? await login(form.email.trim().toLowerCase(), form.password)
        : await register({
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            phone: form.phone.trim() || null,
            nationalId: form.nationalId.trim() || null
          });
      toast.success(isRTL ? `مرحباً ${c.name}` : `Welcome ${c.name}`);
      onSuccess?.(c);
    } catch (err) {
      const msg = err?.response?.data?.messageAr || err?.response?.data?.message
        || (isRTL ? 'حدث خطأ' : 'Error');
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="st-modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="st-modal st-modal--auth"
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="st-modal-close" onClick={onClose}>✕</button>
        <div className="st-auth-head">
          <div className="st-auth-mark">🛍️</div>
          <h2>{mode === 'login' ? (isRTL ? 'تسجيل الدخول' : 'Sign In') : (isRTL ? 'إنشاء حساب' : 'Create Account')}</h2>
          <p>
            {mode === 'login'
              ? (isRTL ? 'سجّل الدخول لعرض طلباتك السابقة والتسوق بشكل أسرع' : 'Sign in to view past orders and check out faster')
              : (isRTL ? 'أنشئ حساباً لمتابعة طلباتك في أي وقت' : 'Create an account to track your orders anytime')}
          </p>
        </div>
        <form onSubmit={submit} className="st-auth-form">
          {mode === 'register' && (
            <label className="st-field">
              <span>{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</span>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </label>
          )}
          <label className="st-field">
            <span>{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</span>
            <input type="email" dir="ltr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
          </label>
          <label className="st-field">
            <span>{isRTL ? 'كلمة المرور *' : 'Password *'}</span>
            <input type="password" dir="ltr" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
          </label>
          {mode === 'register' && (
            <>
              <label className="st-field">
                <span>{isRTL ? 'رقم الجوال (اختياري)' : 'Phone (optional)'}</span>
                <input type="tel" dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05XXXXXXXX" />
              </label>
              <label className="st-field">
                <span>{isRTL ? 'رقم الهوية (اختياري)' : 'National ID (optional)'}</span>
                <input type="text" dir="ltr" value={form.nationalId} onChange={e => setForm(f => ({ ...f, nationalId: e.target.value }))} />
              </label>
            </>
          )}
          <button type="submit" className="st-btn st-btn--primary st-btn--wide" disabled={busy}>
            {busy
              ? (isRTL ? 'جارٍ...' : 'Please wait...')
              : (mode === 'login' ? (isRTL ? 'دخول' : 'Sign In') : (isRTL ? 'إنشاء الحساب' : 'Create Account'))}
          </button>
          <div className="st-auth-switch">
            {mode === 'login'
              ? (<>
                  <span>{isRTL ? 'ليس لديك حساب؟' : "Don't have an account?"}</span>
                  <button type="button" onClick={() => setMode('register')}>{isRTL ? 'أنشئ حساباً' : 'Register'}</button>
                </>)
              : (<>
                  <span>{isRTL ? 'لديك حساب مسبقاً؟' : 'Already have an account?'}</span>
                  <button type="button" onClick={() => setMode('login')}>{isRTL ? 'سجّل الدخول' : 'Sign In'}</button>
                </>)}
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AuthModal;
