import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, IconButton, Menu, MenuItem } from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';

const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    document.dir = lng === 'ar' ? 'rtl' : 'ltr';
    handleClose();
  };

  return (
    <Box sx={{ position: 'fixed', top: 20, right: 20, zIndex: 1000 }}>
      <IconButton
        onClick={handleClick}
        sx={{
          backgroundColor: 'white',
          boxShadow: 2,
          '&:hover': { backgroundColor: '#f5f5f5' }
        }}
      >
        <LanguageIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={() => changeLanguage('en')}>English</MenuItem>
        <MenuItem onClick={() => changeLanguage('ar')}>العربية</MenuItem>
      </Menu>
    </Box>
  );
};

export default LanguageSelector;
