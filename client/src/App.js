import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './i18n';
import { lightTheme } from './config/theme';
import RegistrationForm from './components/RegistrationForm/RegistrationForm';
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import LanguageSelector from './components/LanguageSelector';

function App() {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Router>
        <LanguageSelector />
        <Routes>
          <Route path="/" element={<RegistrationForm />} />
          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard/*" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
