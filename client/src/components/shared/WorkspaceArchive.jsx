import React, { useEffect, useState } from 'react';
import api from '../../config/api';

// Every person's workspace history: each booking they were on (as leader
// or member), including rejected and deleted ones, with extensions and the
// average day rating.

const STATUS = {
  pending: ['قيد المراجعة', 'Pending'],
  approved: ['مقبول', 'Accepted'],
  rejected: ['مرفوض', 'Rejected'],
  deleted: ['محذوف', 'Deleted']
};

const WorkspaceArchive = ({ isRTL }) => {
  const L = (ar, en) => (isRTL ? ar : en);
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await api.get('/workspace-requests/people', { params: { q } });
        if (alive) setData(res.data);
      } catch {
        if (alive) setData({ people: [], total: 0 });
      }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  return (
    <div className="wsa">
      <div className="wsr-tools">
        <input
          className="wsr-search"
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={L('ابحث عن شخص بالاسم أو الهوية أو الجوال…', 'Find a person by name, ID or mobile…')}
        />
        {data && <span className="wsa-count">{L(`${data.total} شخص`, `${data.total} people`)}</span>}
      </div>
      {!data ? (
        <div className="wsr-empty">{L('جاري التحميل…', 'Loading…')}</div>
      ) : data.people.length === 0 ? (
        <div className="wsr-empty">{L('لا يوجد أشخاص في الأرشيف', 'No one in the archive')}</div>
      ) : (
        <div className="wsa-list">
          {data.people.map(p => (
            <article key={p.key} className="wsa-person">
              <div className="wsa-head">
                <span className="wsa-av">{(p.name || '؟').trim().charAt(0)}</span>
                <span className="wsa-who">
                  <b>{p.name}</b>
                  <small dir="ltr">{[p.nationalId, p.phoneNumber, p.email].filter(Boolean).join(' · ')}</small>
                </span>
                <em>{L(`${p.bookings.length} حجز`, `${p.bookings.length} bookings`)}</em>
              </div>
              <ul className="wsa-bookings">
                {p.bookings.map(b => (
                  <li key={`${b.requestId}-${b.role}`}>
                    <span className="wsr-no">{b.requestNumber}</span>
                    <span className={`wsr-chip ${b.status === 'deleted' ? 'rejected' : b.status}`}>{L(...STATUS[b.status])}</span>
                    <span className="wsa-unit">{L(`مساحة ${b.unitCode.slice(2)}`, `WS ${b.unitCode.slice(2)}`)}</span>
                    <span className="wsa-dates" dir="ltr">{b.startDate} → {b.endDate} · {b.startTime}–{b.endTime}</span>
                    <span className="wsa-role">{b.role === 'leader' ? L('قائد', 'Leader') : L('عضو', 'Member')}</span>
                    {b.extensions > 0 && <span className="wsa-ext">{L(`مُدّد ${b.extensions}×`, `extended ${b.extensions}×`)}</span>}
                    {b.rating && <span className="wsa-rate">{b.rating}★</span>}
                    {b.projectName && <small className="wsa-proj">{b.projectName}</small>}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkspaceArchive;
