import React from 'react';
import { useTranslation } from 'react-i18next';
import { ToastContainer, Slide } from 'react-toastify';
import '../../styles/fx-toast.css';

// The app-wide pop-up notifications in the dashboards' "fx" studio look:
// a card with a gradient icon tile per type and a gradient timer line.
// Arabic pages get them right-to-left, on the left side (the sidebar sits
// on the right there). Colours follow the light / dark theme in
// fx-toast.css.

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ICONS = {
  success: <Icon><path d="M20 6 9 17l-5-5" /></Icon>,
  error: <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>,
  warning: <Icon><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></Icon>,
  info: <Icon><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Icon>,
  default: <Icon><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></Icon>
};

const ToastIcon = ({ type, isLoading }) => (
  <span className={`fxt-icon fxt-icon--${isLoading ? 'loading' : type}`}>
    {isLoading ? <i className="fxt-spin" /> : (ICONS[type] || ICONS.default)}
  </span>
);

const FxToasts = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const CloseButton = ({ closeToast }) => (
    <button type="button" className="fxt-close" onClick={closeToast} aria-label={isRTL ? 'إغلاق' : 'Close'}>
      <Icon><path d="M18 6 6 18M6 6l12 12" /></Icon>
    </button>
  );

  return (
    <ToastContainer
      position={isRTL ? 'top-left' : 'top-right'}
      rtl={isRTL}
      autoClose={4500}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnFocusLoss
      draggable
      pauseOnHover
      transition={Slide}
      icon={ToastIcon}
      closeButton={CloseButton}
    />
  );
};

export default FxToasts;
