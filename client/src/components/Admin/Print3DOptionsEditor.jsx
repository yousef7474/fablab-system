import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '../../config/api';

// Editor for the materials + colors customers can pick on the public
// 3D print form (Settings key 'print3d_options'). Materials carry their
// per-gram rate, which the server stores in print3d_rate_<code>. Colors
// are one shared list; each can be limited to specific materials.

const CODE_RE = /^[A-Z0-9][A-Z0-9_+-]{0,15}$/;

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

const toDraft = (opts) => ({
  materials: (opts?.materials || []).map(m => ({
    ...m, rate: m.rate == null ? '' : String(m.rate), _key: nextKey(), _isNew: false
  })),
  colors: (opts?.colors || []).map(c => ({
    ...c, materials: Array.isArray(c.materials) ? c.materials : [], _key: nextKey()
  }))
});

const Toggle = ({ on, onChange, disabled, isRTL }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    className={`p3t-switch ${on ? 'is-on' : ''}`}
    onClick={() => onChange(!on)}
    disabled={disabled}
    title={on ? (isRTL ? 'متاح للعملاء' : 'Offered to customers') : (isRTL ? 'غير متاح' : 'Not offered')}
  >
    <span className="p3t-switch-knob" />
    <span className="p3t-switch-label">{on ? (isRTL ? 'متاح' : 'On') : (isRTL ? 'موقوف' : 'Off')}</span>
  </button>
);

const Print3DOptionsEditor = ({ initial, canEdit, isRTL, onClose, onSaved }) => {
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraft(toDraft(initial)); setDirty(false); }, [initial]);

  const update = (fn) => { setDraft(d => fn(d)); setDirty(true); };

  const setMat = (key, field, value) => update(d => ({
    ...d, materials: d.materials.map(m => m._key === key ? { ...m, [field]: value } : m)
  }));
  const setColor = (key, field, value) => update(d => ({
    ...d, colors: d.colors.map(c => c._key === key ? { ...c, [field]: value } : c)
  }));

  const addMaterial = () => update(d => ({
    ...d,
    materials: [...d.materials, {
      code: '', nameAr: '', nameEn: '', noteAr: '', noteEn: '', enabled: true, rate: '',
      _key: nextKey(), _isNew: true
    }]
  }));

  // Removing a material also drops it from every color's limit list.
  // A color that was limited to that material alone is switched off
  // rather than silently widened to "all materials".
  const removeMaterial = (key) => update(d => {
    const gone = d.materials.find(m => m._key === key);
    const code = gone ? String(gone.code).trim().toUpperCase() : '';
    return {
      materials: d.materials.filter(m => m._key !== key),
      colors: d.colors.map(c => {
        if (!code || !c.materials.includes(code)) return c;
        const rest = c.materials.filter(x => x !== code);
        return rest.length ? { ...c, materials: rest } : { ...c, materials: [], enabled: false };
      })
    };
  });

  const addColor = () => update(d => ({
    ...d,
    colors: [...d.colors, {
      hex: '#000000', nameAr: '', nameEn: '', materials: [], enabled: true, _key: nextKey()
    }]
  }));
  const removeColor = (key) => update(d => ({ ...d, colors: d.colors.filter(c => c._key !== key) }));

  const toggleColorMaterial = (key, code) => update(d => ({
    ...d,
    colors: d.colors.map(c => {
      if (c._key !== key) return c;
      const has = c.materials.includes(code);
      return { ...c, materials: has ? c.materials.filter(x => x !== code) : [...c.materials, code] };
    })
  }));

  const materialCodes = draft.materials
    .map(m => String(m.code || '').trim().toUpperCase())
    .filter(code => CODE_RE.test(code));

  // Mirrors the server's checks so most mistakes are caught before
  // the request; the server re-validates regardless.
  const validate = () => {
    const codes = new Set();
    for (const m of draft.materials) {
      const code = String(m.code || '').trim().toUpperCase();
      if (!CODE_RE.test(code)) {
        return isRTL
          ? `رمز الخامة "${code || '—'}" غير صحيح — استخدم أحرفاً لاتينية أو أرقاماً (مثل PLA)`
          : `Invalid material code "${code || '—'}" — use letters/digits (e.g. PLA)`;
      }
      if (codes.has(code)) return isRTL ? `الخامة ${code} مكررة` : `Material ${code} is listed twice`;
      codes.add(code);
      if (!m.nameAr.trim() && !m.nameEn.trim()) return isRTL ? `يرجى إدخال اسم للخامة ${code}` : `Material ${code} needs a name`;
      const rate = Number(m.rate);
      if (m.rate === '' || !Number.isFinite(rate) || rate < 0) {
        return isRTL ? `يرجى إدخال سعر غرام صحيح للخامة ${code}` : `Enter a valid price per gram for ${code}`;
      }
    }
    const hexes = new Set();
    for (const c of draft.colors) {
      const hex = String(c.hex || '').toLowerCase();
      if (hexes.has(hex)) return isRTL ? `اللون ${hex} مكرر` : `Color ${hex} is listed twice`;
      hexes.add(hex);
      if (!c.nameAr.trim() && !c.nameEn.trim()) return isRTL ? `يرجى إدخال اسم للون ${hex}` : `Color ${hex} needs a name`;
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const payload = {
        materials: draft.materials.map(m => ({
          code: String(m.code).trim().toUpperCase(),
          nameAr: m.nameAr.trim(), nameEn: m.nameEn.trim(),
          noteAr: (m.noteAr || '').trim(), noteEn: (m.noteEn || '').trim(),
          enabled: !!m.enabled,
          rate: Number(m.rate)
        })),
        colors: draft.colors.map(c => ({
          hex: String(c.hex).toLowerCase(),
          nameAr: c.nameAr.trim(), nameEn: c.nameEn.trim(),
          materials: c.materials,
          enabled: !!c.enabled
        }))
      };
      const { data } = await api.put('/print3d/options', payload);
      toast.success(isRTL ? 'تم حفظ الخامات والألوان' : 'Materials & colors saved');
      setDirty(false);
      onSaved(data);
    } catch (err) {
      const body = err?.response?.data || {};
      toast.error((isRTL ? body.messageAr : body.message) || body.message || (isRTL ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (dirty && !window.confirm(isRTL ? 'تجاهل التعديلات غير المحفوظة؟' : 'Discard unsaved changes?')) return;
    onClose();
  };

  const ro = !canEdit;
  const enabledMaterials = draft.materials.filter(m => m.enabled).length;
  const enabledColors = draft.colors.filter(c => c.enabled).length;

  return (
    <motion.div
      className="p3t-modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={requestClose}
    >
      <motion.div
        className="p3t-modal p3t-modal--wide"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p3t-modal-head">
          <div>
            <div className="p3t-modal-kicker">{isRTL ? 'خيارات نموذج الطباعة' : 'Print form options'}</div>
            <h3 className="p3t-opt-title">{isRTL ? 'الخامات والألوان المتاحة' : 'Available materials & colors'}</h3>
          </div>
          <button type="button" className="p3t-modal-close" onClick={requestClose}>✕</button>
        </div>

        <div className="p3t-modal-body p3t-opt">
          <div className="p3t-opt-intro">
            {isRTL
              ? 'يظهر للعميل فقط ما هو "متاح". إيقاف خامة أو لون لا يؤثر على الطلبات السابقة.'
              : 'Customers only see entries switched on. Switching something off does not affect existing requests.'}
            {ro && (
              <b className="p3t-opt-ro">{isRTL ? ' — التعديل متاح للمدير فقط.' : ' — Only managers can edit.'}</b>
            )}
          </div>

          {/* Materials */}
          <section className="p3t-section">
            <div className="p3t-opt-head">
              <h4>{isRTL ? `🧱 الخامات (${enabledMaterials}/${draft.materials.length} متاحة)` : `🧱 Materials (${enabledMaterials}/${draft.materials.length} on)`}</h4>
              {!ro && (
                <button type="button" className="p3t-btn p3t-btn--ghost p3t-btn--sm" onClick={addMaterial}>
                  + {isRTL ? 'إضافة خامة' : 'Add material'}
                </button>
              )}
            </div>
            {draft.materials.length === 0 && (
              <div className="p3t-opt-empty">
                {isRTL ? 'لا توجد خامات — لن يتمكن العملاء من إرسال طلبات.' : 'No materials — customers will not be able to submit requests.'}
              </div>
            )}
            <div className="p3t-opt-list">
              {draft.materials.map(m => (
                <div key={m._key} className={`p3t-opt-item ${m.enabled ? '' : 'is-off'}`}>
                  <div className="p3t-opt-item-top">
                    <Toggle on={!!m.enabled} onChange={v => setMat(m._key, 'enabled', v)} disabled={ro} isRTL={isRTL} />
                    {m._isNew ? (
                      <input
                        type="text"
                        className="p3t-opt-code-input"
                        dir="ltr"
                        maxLength={16}
                        value={m.code}
                        onChange={e => setMat(m._key, 'code', e.target.value.toUpperCase().replace(/\s/g, ''))}
                        placeholder={isRTL ? 'الرمز مثل ABS' : 'Code e.g. ABS'}
                        disabled={ro}
                      />
                    ) : (
                      <span className="p3t-opt-code">{m.code}</span>
                    )}
                    <span className="p3t-opt-spacer" />
                    {!ro && (
                      <button
                        type="button"
                        className="p3t-opt-del"
                        onClick={() => removeMaterial(m._key)}
                        title={isRTL ? 'حذف الخامة' : 'Remove material'}
                      >✕</button>
                    )}
                  </div>
                  <div className="p3t-opt-grid">
                    <label className="p3t-opt-field">
                      <span>{isRTL ? 'الاسم بالعربية' : 'Arabic name'}</span>
                      <input type="text" dir="rtl" maxLength={80} value={m.nameAr} onChange={e => setMat(m._key, 'nameAr', e.target.value)} disabled={ro} />
                    </label>
                    <label className="p3t-opt-field">
                      <span>{isRTL ? 'الاسم بالإنجليزية' : 'English name'}</span>
                      <input type="text" dir="ltr" maxLength={80} value={m.nameEn} onChange={e => setMat(m._key, 'nameEn', e.target.value)} disabled={ro} />
                    </label>
                    <label className="p3t-opt-field">
                      <span>{isRTL ? 'ملاحظة قصيرة (عربي، اختياري)' : 'Short note (Arabic, optional)'}</span>
                      <input type="text" dir="rtl" maxLength={160} value={m.noteAr} onChange={e => setMat(m._key, 'noteAr', e.target.value)} disabled={ro} />
                    </label>
                    <label className="p3t-opt-field">
                      <span>{isRTL ? 'ملاحظة قصيرة (إنجليزي، اختياري)' : 'Short note (English, optional)'}</span>
                      <input type="text" dir="ltr" maxLength={160} value={m.noteEn} onChange={e => setMat(m._key, 'noteEn', e.target.value)} disabled={ro} />
                    </label>
                    <label className="p3t-opt-field p3t-opt-field--rate">
                      <span>{isRTL ? 'سعر الغرام (ر.س)' : 'Price / gram (SAR)'}</span>
                      <input type="number" dir="ltr" step="0.01" min="0" value={m.rate} onChange={e => setMat(m._key, 'rate', e.target.value)} disabled={ro} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Colors */}
          <section className="p3t-section">
            <div className="p3t-opt-head">
              <h4>{isRTL ? `🎨 الألوان (${enabledColors}/${draft.colors.length} متاحة)` : `🎨 Colors (${enabledColors}/${draft.colors.length} on)`}</h4>
              {!ro && (
                <button type="button" className="p3t-btn p3t-btn--ghost p3t-btn--sm" onClick={addColor}>
                  + {isRTL ? 'إضافة لون' : 'Add color'}
                </button>
              )}
            </div>
            <div className="p3t-opt-hint">
              {isRTL
                ? 'قائمة ألوان واحدة لكل الخامات. لحصر لون على خامات معينة، اختر الخامات من "متاح لـ" — اختيار "الكل" يعرضه مع كل الخامات.'
                : 'One color list shared by all materials. To limit a color to certain materials, pick them under "Offered for" — "All" shows it with every material.'}
            </div>
            {draft.colors.length === 0 && (
              <div className="p3t-opt-empty">
                {isRTL ? 'لا توجد ألوان — لن يتمكن العملاء من إرسال طلبات.' : 'No colors — customers will not be able to submit requests.'}
              </div>
            )}
            <div className="p3t-opt-list">
              {draft.colors.map(c => (
                <div key={c._key} className={`p3t-opt-item ${c.enabled ? '' : 'is-off'}`}>
                  <div className="p3t-opt-item-top">
                    <Toggle on={!!c.enabled} onChange={v => setColor(c._key, 'enabled', v)} disabled={ro} isRTL={isRTL} />
                    <label className="p3t-opt-swatch" style={{ background: c.hex }} title={isRTL ? 'تغيير اللون' : 'Change color'}>
                      <input type="color" value={c.hex} onChange={e => setColor(c._key, 'hex', e.target.value.toLowerCase())} disabled={ro} />
                    </label>
                    <span className="p3t-opt-hex" dir="ltr">{c.hex}</span>
                    {/* Names sit inline on wide screens and wrap below on phones. */}
                    <div className="p3t-opt-grid p3t-opt-grid--inline">
                      <label className="p3t-opt-field">
                        <span>{isRTL ? 'الاسم بالعربية' : 'Arabic name'}</span>
                        <input type="text" dir="rtl" maxLength={40} value={c.nameAr} onChange={e => setColor(c._key, 'nameAr', e.target.value)} disabled={ro} />
                      </label>
                      <label className="p3t-opt-field">
                        <span>{isRTL ? 'الاسم بالإنجليزية' : 'English name'}</span>
                        <input type="text" dir="ltr" maxLength={40} value={c.nameEn} onChange={e => setColor(c._key, 'nameEn', e.target.value)} disabled={ro} />
                      </label>
                    </div>
                    <span className="p3t-opt-spacer p3t-opt-spacer--narrow" />
                    {!ro && (
                      <button
                        type="button"
                        className="p3t-opt-del"
                        onClick={() => removeColor(c._key)}
                        title={isRTL ? 'حذف اللون' : 'Remove color'}
                      >✕</button>
                    )}
                  </div>
                  <div className="p3t-opt-limits">
                    <span>{isRTL ? 'متاح لـ:' : 'Offered for:'}</span>
                    <button
                      type="button"
                      className={`p3t-chip p3t-chip--sm ${c.materials.length === 0 ? 'is-active' : ''}`}
                      onClick={() => setColor(c._key, 'materials', [])}
                      disabled={ro}
                    >
                      {isRTL ? 'الكل' : 'All'}
                    </button>
                    {materialCodes.map(code => (
                      <button
                        key={code}
                        type="button"
                        className={`p3t-chip p3t-chip--sm ${c.materials.includes(code) ? 'is-active' : ''}`}
                        onClick={() => toggleColorMaterial(c._key, code)}
                        disabled={ro}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p3t-modal-foot">
          <div className="p3t-foot-left">
            {dirty && <span className="p3t-opt-dirty">{isRTL ? '● تعديلات غير محفوظة' : '● Unsaved changes'}</span>}
          </div>
          <div className="p3t-foot-right">
            <button type="button" className="p3t-btn p3t-btn--ghost" onClick={requestClose}>
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
            {canEdit && (
              <button type="button" className="p3t-btn p3t-btn--primary" onClick={save} disabled={saving || !dirty}>
                {saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Print3DOptionsEditor;
