const { User, Registration, Borrowing, Education, EducationStudent } = require('../models');

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

// Generate unique Borrowing ID in format B#00001
const generateBorrowingId = async () => {
  const lastBorrowing = await Borrowing.findOne({
    order: [['createdAt', 'DESC']]
  });

  let newIdNumber = 1;
  if (lastBorrowing && lastBorrowing.borrowingId) {
    const lastIdNumber = parseInt(lastBorrowing.borrowingId.replace('B#', ''));
    newIdNumber = lastIdNumber + 1;
  }

  return `B#${String(newIdNumber).padStart(5, '0')}`;
};

// Generate unique Education ID in format E#00001
const generateEducationId = async () => {
  const lastEducation = await Education.findOne({
    order: [['createdAt', 'DESC']]
  });

  let newIdNumber = 1;
  if (lastEducation && lastEducation.educationId) {
    const lastIdNumber = parseInt(lastEducation.educationId.replace('E#', ''));
    newIdNumber = lastIdNumber + 1;
  }

  return `E#${String(newIdNumber).padStart(5, '0')}`;
};

// Generate unique Student ID in format S#00001
const generateStudentId = async () => {
  const lastStudent = await EducationStudent.findOne({
    order: [['createdAt', 'DESC']]
  });

  let newIdNumber = 1;
  if (lastStudent && lastStudent.studentId) {
    const lastIdNumber = parseInt(lastStudent.studentId.replace('S#', ''));
    newIdNumber = lastIdNumber + 1;
  }

  return `S#${String(newIdNumber).padStart(5, '0')}`;
};

module.exports = {
  generateUserId,
  generateRegistrationId,
  generateBorrowingId,
  generateEducationId,
  generateStudentId
};
