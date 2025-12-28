const { User, Registration } = require('../models');
const { generateUserId, generateRegistrationId } = require('../utils/idGenerator');
const { checkTimeSlotAvailability, getAvailableTimeSlots } = require('../utils/conflictChecker');
const { sendRegistrationConfirmation, sendEngineerNotification } = require('../utils/emailService');
const { Op } = require('sequelize');

// Check if user exists
exports.checkUser = async (req, res) => {
  try {
    const { identifier } = req.body; // national ID or phone number

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { nationalId: identifier },
          { phoneNumber: identifier }
        ]
      }
    });

    if (user) {
      // Return all user fields for auto-fill
      return res.json({
        exists: true,
        user: {
          userId: user.userId,
          applicationType: user.applicationType,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          sex: user.sex,
          nationality: user.nationality,
          nationalId: user.nationalId,
          phoneNumber: user.phoneNumber,
          email: user.email,
          currentJob: user.currentJob,
          nationalAddress: user.nationalAddress,
          entityName: user.entityName,
          visitingEntity: user.visitingEntity,
          personInCharge: user.personInCharge,
          profilePicture: user.profilePicture
        }
      });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Validate user info before registration (check for conflicts)
exports.validateUserInfo = async (req, res) => {
  try {
    const { email, phoneNumber, nationalId, existingUserId } = req.body;
    const conflicts = [];

    // Check if email is already used by another user
    if (email) {
      const emailUser = await User.findOne({ where: { email } });
      if (emailUser && emailUser.userId !== existingUserId) {
        conflicts.push({
          field: 'email',
          message: 'This email is already registered with different information',
          messageAr: 'هذا البريد الإلكتروني مسجل بالفعل بمعلومات مختلفة',
          existingUser: {
            name: emailUser.firstName && emailUser.lastName
              ? `${emailUser.firstName} ${emailUser.lastName}`
              : emailUser.name,
            phoneNumber: emailUser.phoneNumber
          }
        });
      }
    }

    // Check if phone number is already used by another user
    if (phoneNumber) {
      const phoneUser = await User.findOne({ where: { phoneNumber } });
      if (phoneUser && phoneUser.userId !== existingUserId) {
        conflicts.push({
          field: 'phoneNumber',
          message: 'This phone number is already registered with different information',
          messageAr: 'رقم الهاتف هذا مسجل بالفعل بمعلومات مختلفة',
          existingUser: {
            name: phoneUser.firstName && phoneUser.lastName
              ? `${phoneUser.firstName} ${phoneUser.lastName}`
              : phoneUser.name,
            email: phoneUser.email
          }
        });
      }
    }

    // Check if national ID is already used by another user
    if (nationalId) {
      const idUser = await User.findOne({ where: { nationalId } });
      if (idUser && idUser.userId !== existingUserId) {
        conflicts.push({
          field: 'nationalId',
          message: 'This National ID is already registered with different information',
          messageAr: 'رقم الهوية هذا مسجل بالفعل بمعلومات مختلفة',
          existingUser: {
            name: idUser.firstName && idUser.lastName
              ? `${idUser.firstName} ${idUser.lastName}`
              : idUser.name,
            email: idUser.email,
            phoneNumber: idUser.phoneNumber
          }
        });
      }
    }

    if (conflicts.length > 0) {
      return res.status(409).json({
        valid: false,
        conflicts
      });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error('Error validating user info:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get available time slots
exports.getAvailableSlots = async (req, res) => {
  try {
    const { section, date } = req.query;

    if (!section || !date) {
      return res.status(400).json({ message: 'Section and date are required' });
    }

    const availableSlots = await getAvailableTimeSlots(section, date);
    res.json({ slots: availableSlots });
  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new registration
exports.createRegistration = async (req, res) => {
  try {
    const {
      // User data
      existingUserId,
      applicationType,
      firstName,
      lastName,
      sex,
      nationality,
      nationalId,
      phoneNumber,
      email,
      currentJob,
      nationalAddress,
      entityName,
      visitingEntity,
      personInCharge,
      name,
      profilePicture,
      // Registration data
      fablabSection,
      requiredServices,
      otherServiceDetails,
      appointmentDate,
      appointmentTime,
      appointmentDuration,
      startDate,
      endDate,
      startTime,
      endTime,
      visitDate,
      visitStartTime,
      visitEndTime,
      serviceDetails,
      serviceType,
      commitmentName
    } = req.body;

    let userId = existingUserId;
    let user;

    // Create or get user
    if (existingUserId) {
      user = await User.findByPk(existingUserId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    } else {
      // Generate new user ID
      userId = await generateUserId();

      // Determine name based on application type
      let userName = name;
      if (['Beneficiary', 'Visitor', 'Volunteer', 'Talented'].includes(applicationType)) {
        userName = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || name);
      } else if (applicationType === 'FABLAB Visit') {
        userName = personInCharge || name;
      } else if (applicationType === 'Entity') {
        userName = name || entityName;
      }

      // Create new user
      user = await User.create({
        userId,
        applicationType,
        firstName,
        lastName,
        sex,
        nationality,
        nationalId,
        phoneNumber,
        email,
        currentJob,
        nationalAddress,
        entityName,
        visitingEntity,
        personInCharge,
        name: userName,
        profilePicture
      });
    }

    // Check time slot availability
    let isAvailable = true;
    if (appointmentDate && appointmentTime) {
      const endTimeCalc = appointmentDuration
        ? new Date(new Date(`1970-01-01T${appointmentTime}`).getTime() + appointmentDuration * 60000)
            .toTimeString().slice(0, 5)
        : appointmentTime;
      isAvailable = await checkTimeSlotAvailability(fablabSection, appointmentDate, appointmentTime, endTimeCalc);
    } else if (startDate && endDate && startTime && endTime) {
      isAvailable = await checkTimeSlotAvailability(fablabSection, startDate, startTime, endTime);
    } else if (visitDate && visitStartTime && visitEndTime) {
      isAvailable = await checkTimeSlotAvailability(fablabSection, visitDate, visitStartTime, visitEndTime);
    }

    if (!isAvailable) {
      return res.status(409).json({ message: 'Time slot is not available' });
    }

    // Generate registration ID
    const registrationId = await generateRegistrationId();

    // Create registration
    const registration = await Registration.create({
      registrationId,
      userId,
      fablabSection,
      requiredServices,
      otherServiceDetails,
      appointmentDate,
      appointmentTime,
      appointmentDuration,
      startDate,
      endDate,
      startTime,
      endTime,
      visitDate,
      visitStartTime,
      visitEndTime,
      serviceDetails,
      serviceType,
      commitmentName,
      status: 'pending'
    });

    // Send emails (non-blocking - don't fail registration if email fails)
    const userName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.name;

    // Send confirmation to user
    try {
      await sendRegistrationConfirmation(user.email, userName, registrationId);
    } catch (emailError) {
      console.error('Failed to send user confirmation email:', emailError);
    }

    // Send notification to section engineer
    try {
      console.log(`📧 Attempting to send engineer notification for section: ${fablabSection}`);
      await sendEngineerNotification(fablabSection, {
        userName,
        userEmail: user.email,
        registrationId,
        appointmentDate: appointmentDate || visitDate || startDate,
        appointmentTime: appointmentTime || visitStartTime || startTime,
        requiredServices,
        serviceDetails
      });
    } catch (emailError) {
      console.error('Failed to send engineer notification email:', emailError);
    }

    res.status(201).json({
      message: 'Registration created successfully',
      registration: {
        registrationId,
        userId,
        userName,
        fablabSection,
        appointmentDate: appointmentDate || visitDate || startDate,
        appointmentTime: appointmentTime || visitStartTime || startTime,
        requiredServices,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error creating registration:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = exports;
