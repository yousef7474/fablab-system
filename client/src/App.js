import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './i18n';
import { lightTheme } from './config/theme';
import LanguageSelector from './components/LanguageSelector';

// Route-level code splitting: each page becomes its own JS chunk so the
// landing/register page doesn't have to download the entire admin panel.
const RegistrationForm = lazy(() => import('./components/RegistrationForm/RegistrationForm'));
const EliteRegistrationForm = lazy(() => import('./components/EliteRegistration/EliteRegistrationForm'));
const EliteDashboard = lazy(() => import('./components/EliteRegistration/EliteDashboard'));
const EliteLogin = lazy(() => import('./components/EliteRegistration/EliteLogin'));
const EliteUserAccount = lazy(() => import('./components/EliteRegistration/EliteUserAccount'));
const AdminLogin = lazy(() => import('./components/Admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const BorrowingForm = lazy(() => import('./components/BorrowingForm/BorrowingForm'));
const EducationForm = lazy(() => import('./components/EducationForm/EducationForm'));
const StudentRegistration = lazy(() => import('./components/EducationForm/StudentRegistration'));
const StudentAttendance = lazy(() => import('./components/EducationForm/StudentAttendance'));
const ManagerDashboard = lazy(() => import('./components/Manager/ManagerDashboard'));
const EmployeeLogin = lazy(() => import('./components/Employee/EmployeeLogin'));
const EmployeeDashboard = lazy(() => import('./components/Employee/EmployeeDashboard'));
const WorkshopRegistration = lazy(() => import('./components/WorkshopRegistration/WorkshopRegistration'));
const PublicVolunteerReport = lazy(() => import('./components/Public/PublicVolunteerReport'));
const PublicAttendanceReport = lazy(() => import('./components/Public/PublicAttendanceReport'));

const RouteFallback = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--gray-50, #f9fafb)'
  }}>
    <div style={{
      width: 42, height: 42,
      border: '3px solid rgba(238, 35, 41, 0.15)',
      borderTopColor: '#EE2329',
      borderRadius: '50%',
      animation: 'spin 0.9s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Wrapper to conditionally show LanguageSelector (hide on admin/manager/elite pages)
const ConditionalLanguageSelector = () => {
  const location = useLocation();
  if (location.pathname === '/admin/login' || location.pathname.startsWith('/manager') || location.pathname.startsWith('/elite') || location.pathname.startsWith('/employee') || location.pathname.startsWith('/workshop') || location.pathname.startsWith('/public/')) return null;
  return <LanguageSelector />;
};

const AppContent = () => {
  return (
    <>
      <ConditionalLanguageSelector />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<RegistrationForm />} />
          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/elite-registration" element={<EliteRegistrationForm />} />
          <Route path="/elite-dashboard" element={<EliteDashboard />} />
          <Route path="/elite/login" element={<EliteLogin />} />
          <Route path="/elite/account" element={<EliteUserAccount />} />
          <Route path="/borrow" element={<BorrowingForm />} />
          <Route path="/educate" element={<EducationForm />} />
          <Route path="/educate/students" element={<StudentRegistration />} />
          <Route path="/educate/attendance" element={<StudentAttendance />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
          <Route path="/manager/dashboard/*" element={<ManagerDashboard />} />
          <Route path="/workshop" element={<WorkshopRegistration />} />
          <Route path="/employee/login" element={<EmployeeLogin />} />
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          {/* Public no-login volunteer report pages (token-gated) */}
          <Route path="/public/volunteer/:token" element={<PublicVolunteerReport />} />
          <Route path="/public/report/:token" element={<PublicAttendanceReport />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
};

function App() {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </ThemeProvider>
  );
}

export default App;
