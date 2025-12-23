import { createTheme } from '@mui/material/styles';

export const colors = {
  racingRed: '#EE2329',
  lightBlue: '#C2E0E1',
  skyReflection: '#81AED6',
  babyBlueIce: '#92B9E1',
  mintLeaf: '#48BF85'
};

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: colors.racingRed,
      light: colors.babyBlueIce,
      dark: '#c01d22'
    },
    secondary: {
      main: colors.mintLeaf,
      light: colors.lightBlue
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff'
    },
    text: {
      primary: '#333333',
      secondary: '#666666'
    }
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600
    },
    body1: {
      fontSize: '1rem'
    }
  },
  shape: {
    borderRadius: 12
  },
  shadows: [
    'none',
    '0px 2px 8px rgba(0, 0, 0, 0.05)',
    '0px 4px 16px rgba(0, 0, 0, 0.08)',
    '0px 8px 24px rgba(0, 0, 0, 0.12)',
    '0px 12px 32px rgba(0, 0, 0, 0.15)',
    ...Array(20).fill('0px 16px 40px rgba(0, 0, 0, 0.2)')
  ]
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.racingRed,
      light: colors.babyBlueIce,
      dark: '#c01d22'
    },
    secondary: {
      main: colors.mintLeaf,
      light: colors.lightBlue
    },
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d'
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0'
    }
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600
    },
    body1: {
      fontSize: '1rem'
    }
  },
  shape: {
    borderRadius: 12
  },
  shadows: [
    'none',
    '0px 2px 8px rgba(0, 0, 0, 0.3)',
    '0px 4px 16px rgba(0, 0, 0, 0.4)',
    '0px 8px 24px rgba(0, 0, 0, 0.5)',
    '0px 12px 32px rgba(0, 0, 0, 0.6)',
    ...Array(20).fill('0px 16px 40px rgba(0, 0, 0, 0.7)')
  ]
});
