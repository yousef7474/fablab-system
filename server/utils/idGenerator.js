const { User, Registration } = require('../models');

// Generate unique User ID in format U#00001
const generateUserId = async () => {
  const lastUser = await User.findOne({
    order: [['createdAt', 'DESC']]
  });

  let newIdNumber = 1;
  if (lastUser && lastUser.userId) {
    const lastIdNumber = parseInt(lastUser.userId.replace('U#', ''));
    newIdNumber = lastIdNumber + 1;
  }

  return `U#${String(newIdNumber).padStart(5, '0')}`;
};

// Generate unique Registration ID in format R#00001
const generateRegistrationId = async () => {
  const lastRegistration = await Registration.findOne({
    order: [['createdAt', 'DESC']]
  });

  let newIdNumber = 1;
  if (lastRegistration && lastRegistration.registrationId) {
    const lastIdNumber = parseInt(lastRegistration.registrationId.replace('R#', ''));
    newIdNumber = lastIdNumber + 1;
  }

  return `R#${String(newIdNumber).padStart(5, '0')}`;
};

module.exports = {
  generateUserId,
  generateRegistrationId
};
