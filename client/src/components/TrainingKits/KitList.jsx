import React from 'react';
import { fmtDay } from './kitModel';
import { StatusPill } from './KitParts';
import { KIT_KIND, idOfDoc, numberOfDoc } from './kinds';

// Cards — the employee's own kits / plans, the project manager's queue /
// archive and the manager's approvals / approved archive.
const KitList = ({ kits, onOpen, showAuthor = false, empty, kind = KIT_KIND }) => {
  if (!kits.length) {
    return (
      <div className="tk-blank">
        <span className="big">{kind.icon}</span>
        <b>{empty?.title || 'لا توجد عناصر'}</b>
        {empty?.text && <span>{empty.text}</span>}
        {empty?.action}
      </div>
    );
  }
  return (
    <div className="tk-list">
      {kits.map(k => (
        <button type="button" className="tk-card" key={idOfDoc(k)} onClick={() => onOpen(k)}>
          <span className="no">{kind.fmtNo(numberOfDoc(k))}</span>
          <div style={{ minWidth: 0 }}>
            <h4>{k.title || kind.untitled}</h4>
            <div className="meta">
              <StatusPill kit={k} />
              {showAuthor && k.author?.name && <span>👤 {k.author.name}</span>}
              {k.currentVersion > 0 && <span>الإصدار {k.currentVersion}</span>}
              {k.status === 'approved'
                ? <span>اعتُمدت {fmtDay(k.approvedAt)}</span>
                : <span>آخر تحديث {fmtDay(k.updatedAt)}</span>}
            </div>
            {k.lastComment && k.status === 'returned' && <div className="cmt" title={k.lastComment}>↩ {k.lastComment}</div>}
          </div>
          <div className="side">
            <span className="mono" style={{ fontSize: 13 }}>{k.completion || 0}%</span>
            <span className="tk-meter"><i style={{ width: `${k.completion || 0}%` }} /></span>
          </div>
        </button>
      ))}
    </div>
  );
};

export const KitFilters = ({ options, value, onChange }) => (
  <div className="tk-filters" role="group">
    {options.map(o => (
      <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
        {o.label} <span className="c">{o.count}</span>
      </button>
    ))}
  </div>
);

export default KitList;
