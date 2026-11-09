import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../config/api';
import OvertimeApprovals from './OvertimeApprovals';
import FablabVisitApprovals from './FablabVisitApprovals';
import VolunteerOpportunityApprovals from './VolunteerOpportunityApprovals';
import ApprovalArchiveTab from '../Admin/ApprovalArchiveTab';
import ProjectSupportApprovals from './ProjectSupportApprovals';
import { TrainingKitApprovals } from '../TrainingKits/ManagerKits';
import { PlanApprovals } from '../ExecutionPlans/ManagerPlans';
import { RequestApprovals } from '../Requests/ManagerRequests';
import './Approvals.css';

// Segmented switcher for the manager's Approvals tab. Instead of
// stacking every queue below the previous one (which made scrolling
// through unrelated sections tiresome), we show ONE queue at a time
// and let the manager switch between them via a tab bar. Each tab
// carries a live pending-count badge so the manager can see at a
// glance where their attention is needed.
// `solid` is the active-tab fill: a deeper shade of `color` so the
// white label stays readable (the bright tints fail contrast).

const TABS = [
  { id: 'overtime',  ar: 'الساعات الإضافية',  en: 'Overtime',           icon: '🕓', color: '#d97706', solid: '#b45309', endpoint: '/overtime/pending' },
  { id: 'visit',     ar: 'زيارات فاب لاب',    en: 'FabLab Visits',      icon: '🏢', color: '#0ea5e9', solid: '#0369a1', endpoint: '/fablab-visits/pending' },
  { id: 'volunteer', ar: 'الفرص التطوعية',    en: 'Volunteer',          icon: '🤝', color: '#16a34a', solid: '#15803d', endpoint: '/volunteer-opportunity-requests/pending' },
  { id: 'support',   ar: 'طلبات الدعم',       en: 'Support Requests',   icon: '💜', color: '#8b5cf6', solid: '#7c3aed', endpoint: '/project-support/pending' },
  { id: 'kits',      ar: 'الحقائب التدريبية', en: 'Training Kits',      icon: '🎒', color: '#EE2329', solid: '#c81e24', endpoint: '/training-kits/admin/kits?scope=pending' },
  { id: 'plans',     ar: 'الخطط التنفيذية',  en: 'Execution Plans',    icon: '🗓', color: '#0d9488', solid: '#0f766e', endpoint: '/execution-plans/admin/plans?scope=pending' },
  // Workshop + financial requests share one queue (several endpoints).
  { id: 'requests',  ar: 'طلبات الورش والصرف والتصميم', en: 'Requests', icon: '📨', color: '#6366f1', solid: '#4338ca', endpoint: ['/workshop-requests/admin/requests?scope=pending', '/financial-requests/admin/requests?scope=pending', '/media-requests/admin/requests?scope=pending'] },
  // Archive isn't a "queue" — it's the audit trail of every request
  // ever sent to the manager, so no pending-count endpoint. Rendered
  // as an ordinary tab that shows the historical list w/ reprint.
  { id: 'archive',   ar: 'الأرشيف',           en: 'Archive',            icon: '🗂', color: '#475569', solid: '#475569', endpoint: null }
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
      const eps = Array.isArray(t.endpoint) ? t.endpoint : [t.endpoint];
      const ns = await Promise.all(eps.map(ep => api.get(ep).then(({ data }) => (Array.isArray(data) ? data.length : 0)).catch(() => 0)));
      next[t.id] = ns.reduce((a, b) => a + b, 0);
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
              <span style={{ color: 'var(--fx-green-ink, #16a34a)' }}>✓</span>
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
                style={{ '--tab-color': t.color, '--tab-solid': t.solid }}
                onClick={() => setActive(t.id)}
              >
                <span className="ap-hub-tab-icon">{t.icon}</span>
                <span className="ap-hub-tab-label">{isRTL ? t.ar : t.en}</span>
                {count > 0 && (
                  <span
                    className="ap-hub-tab-badge"
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
        {active === 'support'   && <ProjectSupportApprovals />}
        {active === 'kits'      && <TrainingKitApprovals />}
        {active === 'plans'     && <PlanApprovals />}
        {active === 'requests'  && <RequestApprovals />}
        {active === 'archive'   && <ApprovalArchiveTab />}
      </div>
    </div>
  );
};

export default ApprovalsHub;
