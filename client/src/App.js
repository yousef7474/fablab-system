import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './i18n';
import { lightTheme } from './config/theme';
import RegistrationForm from './components/RegistrationForm/RegistrationForm';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import LanguageSelector from './components/LanguageSelector';

// Wrapper to conditionally show LanguageSelector (hide only on admin login)
const ConditionalLanguageSelector = () => {
  const location = useLocation();
  // Hide only on admin login page (it has its own language toggle)
  if (location.pathname === '/admin/login') return null;
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
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
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
