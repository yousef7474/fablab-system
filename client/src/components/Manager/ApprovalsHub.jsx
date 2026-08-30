import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';
import OvertimeApprovals from './OvertimeApprovals';
import FablabVisitApprovals from './FablabVisitApprovals';
import VolunteerOpportunityApprovals from './VolunteerOpportunityApprovals';
import ApprovalArchiveTab from '../Admin/ApprovalArchiveTab';
import './Approvals.css';

// Segmented switcher for the manager's Approvals tab. Instead of
// stacking every queue below the previous one (which made scrolling
// through unrelated sections tiresome), we show ONE queue at a time
// and let the manager switch between them via a tab bar. Each tab
// carries a live pending-count badge so the manager can see at a
// glance where their attention is needed.

const TABS = [
  { id: 'overtime',  ar: 'الساعات الإضافية',  en: 'Overtime',           icon: '🕓', color: '#d97706', endpoint: '/overtime/pending' },
  { id: 'visit',     ar: 'زيارات فاب لاب',    en: 'FabLab Visits',      icon: '🏢', color: '#0ea5e9', endpoint: '/fablab-visits/pending' },
  { id: 'volunteer', ar: 'الفرص التطوعية',    en: 'Volunteer',          icon: '🤝', color: '#16a34a', endpoint: '/volunteer-opportunity-requests/pending' },
  // Archive isn't a "queue" — it's the audit trail of every request
  // ever sent to the manager, so no pending-count endpoint. Rendered
  // as an ordinary tab that shows the historical list w/ reprint.
  { id: 'archive',   ar: 'الأرشيف',           en: 'Archive',            icon: '🗂', color: '#475569', endpoint: null }
];

const ApprovalsHub = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [active, setActive] = useState('overtime');
  const [counts, setCounts] = useState({});

  // Poll pending counts every 45s so the tab badges stay fresh
  // without hitting the API too aggressively.
  const loadCounts = useCallback(async () => {
    const next = {};
    await Promise.all(TABS.filter(t => t.endpoint).map(async (t) => {
      try {
        const { data } = await api.get(t.endpoint);
        next[t.id] = Array.isArray(data) ? data.length : 0;
      } catch { next[t.id] = 0; }
    }));
    setCounts(next);
  }, []);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => {
    const iv = setInterval(loadCounts, 45000);
    return () => clearInterval(iv);
  }, [loadCounts]);

  // Re-load counts when the active queue changes so switching feels
  // instant even if a background poll hasn't fired.
  useEffect(() => { loadCounts(); }, [active, loadCounts]);

  const totalPending = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Segmented switcher */}
      <div className="ap-hub-bar">
        <div className="ap-hub-total">
          {totalPending > 0 ? (
            <>
              <span className="ap-hub-total-dot" />
              <b>{totalPending}</b>
              <span>{isRTL ? 'طلبات بانتظار الاعتماد' : 'pending approvals'}</span>
            </>
          ) : (
            <>
              <span style={{ color: '#16a34a' }}>✓</span>
              <span>{isRTL ? 'لا توجد طلبات بانتظار الاعتماد' : 'No pending approvals'}</span>
            </>
          )}
        </div>
        <div className="ap-hub-tabs">
          {TABS.map(t => {
            const isActive = active === t.id;
            const count = counts[t.id] || 0;
            return (
              <button
                key={t.id}
                className={`ap-hub-tab ${isActive ? 'is-active' : ''}`}
                style={isActive ? {
                  background: t.color,
                  color: '#fff',
                  borderColor: t.color,
                  boxShadow: `0 8px 20px -8px ${t.color}80`
                } : {}}
                onClick={() => setActive(t.id)}
              >
                <span className="ap-hub-tab-icon">{t.icon}</span>
                <span className="ap-hub-tab-label">{isRTL ? t.ar : t.en}</span>
                {count > 0 && (
                  <span
                    className="ap-hub-tab-badge"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.28)' : t.color + '20',
                      color: isActive ? '#fff' : t.color
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* One queue at a time — no more stacked headings */}
      <div className="ap-hub-panel">
        {active === 'overtime'  && <OvertimeApprovals />}
        {active === 'visit'     && <FablabVisitApprovals />}
        {active === 'volunteer' && <VolunteerOpportunityApprovals />}
        {active === 'archive'   && <ApprovalArchiveTab />}
      </div>
    </div>
  );
};

export default ApprovalsHub;
