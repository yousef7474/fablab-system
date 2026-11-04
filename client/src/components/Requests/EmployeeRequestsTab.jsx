import React, { useState } from 'react';
import EmployeeWorkshopRequests from './workshop/EmployeeWorkshopRequests';
import EmployeeFinanceRequests from './finance/EmployeeFinanceRequests';
import '../TrainingKits/TrainingKits.css';
import '../ExecutionPlans/Plans.css';

// Employee dashboard tab «الطلبات»: workshop requests (from an approved
// training kit) and financial requests (طلبات الصرف), each through the
// project manager then the manager.
const TYPES = [
  { key: 'workshop', icon: '🛠', label: 'طلبات الورش' },
  { key: 'finance', icon: '💰', label: 'طلبات الصرف المالي' }
];

const EmployeeRequestsTab = ({ portalTarget, theme }) => {
  const [type, setType] = useState(() => { try { return localStorage.getItem('empRequestsType') === 'finance' ? 'finance' : 'workshop'; } catch { return 'workshop'; } });
  const pick = (key) => { setType(key); try { localStorage.setItem('empRequestsType', key); } catch { /* ignore */ } };
  return (
    <>
      <div className="tk ep-kindbar" data-theme={theme} dir="rtl" style={{ marginBottom: 14 }}>
        <div className="ep-kindswitch" role="tablist" aria-label="نوع الطلبات">
          {TYPES.map(t => (
            <button key={t.key} type="button" role="tab" aria-selected={type === t.key} onClick={() => pick(t.key)}>
              <span aria-hidden="true">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>
      {type === 'workshop'
        ? <EmployeeWorkshopRequests portalTarget={portalTarget} theme={theme} />
        : <EmployeeFinanceRequests portalTarget={portalTarget} theme={theme} />}
    </>
  );
};

export default EmployeeRequestsTab;
