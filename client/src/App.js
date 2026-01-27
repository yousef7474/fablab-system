import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './i18n';
import { lightTheme } from './config/theme';
import RegistrationForm from './components/RegistrationForm/RegistrationForm';
import EliteRegistrationForm from './components/EliteRegistration/EliteRegistrationForm';
import EliteDashboard from './components/EliteRegistration/EliteDashboard';
import EliteLogin from './components/EliteRegistration/EliteLogin';
import EliteUserAccount from './components/EliteRegistration/EliteUserAccount';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import ManagerDashboard from './components/Manager/ManagerDashboard';
import LanguageSelector from './components/LanguageSelector';

// Wrapper to conditionally show LanguageSelector (hide on admin/manager/elite pages)
const ConditionalLanguageSelector = () => {
  const location = useLocation();
  // Hide on admin login page, manager dashboard, and elite registration (they have their own language toggle or are Arabic only)
  if (location.pathname === '/admin/login' || location.pathname.startsWith('/manager') || location.pathname.startsWith('/elite')) return null;
  return <LanguageSelector />;
};

// App content that needs access to Router context
const AppContent = () => {
  return (
    <>
      <ConditionalLanguageSelector />
      <Routes>
        <Route path="/" element={<RegistrationForm />} />
        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/elite-registration" element={<EliteRegistrationForm />} />
        <Route path="/elite-dashboard" element={<EliteDashboard />} />
        <Route path="/elite/login" element={<EliteLogin />} />
        <Route path="/elite/account" element={<EliteUserAccount />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
        <Route path="/manager/dashboard/*" element={<ManagerDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
