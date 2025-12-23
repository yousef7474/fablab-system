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
      return res.json({
        exists: true,
        user: {
          userId: user.userId,
          applicationType: user.applicationType,
          firstName: user.firstName,
          lastName: user.lastName,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber
        }
      });
    }

    res.json({ exists: false });
  } catch (error) {
    console.error('Error checking user:', error);
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
        name
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

    // Send emails
    const userName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.name;

    await sendRegistrationConfirmation(user.email, userName, registrationId);

    await sendEngineerNotification(fablabSection, {
      userName,
      userEmail: user.email,
      registrationId,
      appointmentDate: appointmentDate || visitDate || startDate,
      appointmentTime: appointmentTime || visitStartTime || startTime,
      requiredServices,
      serviceDetails
    });

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
