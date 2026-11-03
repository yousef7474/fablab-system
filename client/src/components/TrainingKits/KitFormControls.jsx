import React from 'react';
import { AutoArea, Seg } from './KitParts';
import { fid } from './kitForms';

// Building blocks for the attachment form screens — the same markup and
// classes as the kit editor's own fields, bound to data.forms.<key>.

export const getIn = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);

/**
 * Field builders for one form. `form` is data.forms[fkey]; `setF(path, v)`
 * writes into it. Ids are fid(fkey, path) so the completion issues can
 * point at them.
 */
export const makeControls = ({ fkey, form, setF, locked }) => {
  const val = (p) => { const v = getIn(form, p); return v == null ? '' : v; };
  const id = (p) => fid(fkey, p);
  const text = (p, o = {}) => (
    <input className={`tk-in ${o.cls || ''}`} type={o.type || 'text'} id={id(p)} value={val(p)} placeholder={o.ph || ''} dir={o.dir}
      aria-label={o.label} autoComplete="off" disabled={locked} onChange={(e) => setF(p, e.target.value)} />
  );
  const area = (p, o = {}) => (
    <AutoArea id={id(p)} value={val(p)} rows={o.rows || 1} placeholder={o.ph || ''} aria-label={o.label} disabled={locked} onChange={(v) => setF(p, v)} />
  );
  const numIn = (p, o = {}) => {
    const input = (
      <input className="tk-in num" type="number" inputMode="decimal" id={id(p)} value={val(p)} min={o.min == null ? 0 : o.min} step={o.step || '1'}
        placeholder={o.ph || ''} aria-label={o.label} disabled={locked}
        onChange={(e) => { const v = e.target.value; setF(p, v === '' ? '' : (isFinite(+v) ? +v : '')); }} />
    );
    return o.sfx ? <span className="tk-affix" style={o.sfxW ? { '--sfx': `${o.sfxW}px` } : undefined}>{input}<span className="sfx">{o.sfx}</span></span> : input;
  };
  const date = (p, label) => <input className="tk-in" type="date" id={id(p)} value={val(p)} aria-label={label} disabled={locked} onChange={(e) => setF(p, e.target.value)} />;
  const time = (p, label) => <input className="tk-in num" type="time" id={id(p)} value={val(p)} aria-label={label} disabled={locked} onChange={(e) => setF(p, e.target.value)} />;
  const select = (p, opts, o = {}) => (
    <select className="tk-in" id={id(p)} value={val(p)} aria-label={o.label} disabled={locked} onChange={(e) => setF(p, e.target.value)}>
      {o.ph !== null && <option value="">{o.ph || 'اختر…'}</option>}
      {opts.map(x => { const ov = typeof x === 'string' ? x : x.v; const ol = typeof x === 'string' ? x : x.l; return <option key={ov} value={ov}>{ol}</option>; })}
    </select>
  );
  const seg = (p, opts, labelId) => <Seg id={id(p)} options={opts} value={val(p)} labelledBy={labelId} onChange={(v) => !locked && setF(p, v)} />;
  return { val, id, text, area, numIn, date, time, select, seg };
};

export const Field = ({ label, req, hint, wide, htmlFor, labelId, children }) => (
  <div className={`tk-field${wide ? ' wide' : ''}`}>
    {htmlFor
      ? <label className="tk-lbl" htmlFor={htmlFor}>{label}{req && <span className="tk-req" aria-hidden="true">*</span>}</label>
      : <span className="tk-lbl" id={labelId}>{label}{req && <span className="tk-req" aria-hidden="true">*</span>}</span>}
    {hint && <p className="tk-hint">{hint}</p>}
    {children}
  </div>
);

export const Panel = ({ title, note, id, children, actions }) => (
  <div className="tk-panel" id={id}>
    {(title || note || actions) && (
      <div className="tk-panel-head">
        <h3 className="tk-panel-title">{title}</h3>
        {note && <p className="tk-panel-note">{note}</p>}
        {actions && <div className="tkf-actions">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

export const SecHead = ({ n, title, desc }) => (
  <header className="tk-sec-head tkf-sec-head">
    <span className="tk-sec-num">{n}</span>
    <div><h2>{title}</h2>{desc && <p className="tk-sec-desc">{desc}</p>}</div>
  </header>
);

// Kit data shown inside a form (read-only, edited in the kit itself).
export const Linked = ({ label, children, from }) => (
  <div className="tkf-linked">
    <span className="lbl">{label}{from && <small> · من {from}</small>}</span>
    <div className="val">{children || <span className="tk-muted-s">— لم يُعبأ في الحقيبة بعد</span>}</div>
  </div>
);

export const RmBtn = ({ locked, onClick, label }) => (locked ? null : (
  <button type="button" className="tk-ibtn danger" onClick={onClick} aria-label={label} title={label}>🗑</button>
));

export const AddBtn = ({ locked, onClick, children }) => (locked ? null : (
  <button type="button" className="tk-add" onClick={onClick}>＋ {children}</button>
));

// Header + rows of a small editable table (desktop columns, cards on
// narrow screens — the kit's tk-rt-* pattern).
export const RowTable = ({ cols, heads, id, children, empty }) => (
  <div style={{ '--cols': cols }}>
    <div className="tk-rt-head">{heads.map((h, i) => <span key={i}>{h}</span>)}</div>
    <div className="tk-rt-body" id={id}>
      {React.Children.count(children) ? children : <p className="tk-empty">{empty || 'لا توجد صفوف بعد.'}</p>}
    </div>
  </div>
);

export const Cell = ({ label, half, act, children }) => (
  <div className={`tk-cell${half ? ' half' : ''}${act ? ' act' : ''}`}>
    {label && <span className="tk-cell-lbl">{label}</span>}
    {children}
  </div>
);
