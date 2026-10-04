const { User, Registration } = require('../models');
const { generateUserId, generateRegistrationId } = require('../utils/idGenerator');
const { checkTimeSlotAvailability, getAvailableTimeSlots } = require('../utils/conflictChecker');
const { sendRegistrationConfirmation, sendEngineerNotification } = require('../utils/emailService');
const { Op } = require('sequelize');
const { checkEntityPassword, issueEntityToken, verifyEntityToken } = require('../utils/entityAccess');

// POST /registration/entity-access  body: { password }
// Unlocks the "Entity" application type. Attempts are capped per client.
const _entityHits = new Map(); // ip → recent attempt timestamps
const ENTITY_LIMIT = 10;
const ENTITY_WINDOW_MS = 10 * 60 * 1000;

exports.entityAccess = async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  const now = Date.now();
  const hits = (_entityHits.get(ip) || []).filter(t => now - t < ENTITY_WINDOW_MS);
  if (hits.length >= ENTITY_LIMIT) {
    return res.status(429).json({
      message: 'Too many attempts — please try again in a few minutes',
      messageAr: 'محاولات كثيرة — يرجى المحاولة بعد دقائق'
    });
  }
  if (!checkEntityPassword(req.body?.password)) {
    hits.push(now);
    _entityHits.set(ip, hits);
    if (_entityHits.size > 5000) {
      for (const [k, v] of _entityHits) if (!v.some(t => now - t < ENTITY_WINDOW_MS)) _entityHits.delete(k);
    }
    // 403, not 401: the client's axios interceptor treats 401 as an
    // expired admin session and redirects to the admin login.
    return res.status(403).json({ code: 'WRONG_PASSWORD', message: 'Incorrect password', messageAr: 'كلمة المرور غير صحيحة' });
  }
  res.json({ ok: true, token: issueEntityToken() });
};

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
      volunteerSection,
      volunteerSkills,
      serviceDetails,
      serviceType,
      commitmentName
    } = req.body;

    let userId = existingUserId;
    let user;

    // Entity registrations need the access code (see entityAccess).
    const entityDenied = () => res.status(403).json({
      code: 'ENTITY_ACCESS_REQUIRED',
      message: 'Entity registration requires the access password',
      messageAr: 'التسجيل ككيان يتطلب إدخال كلمة المرور'
    });
    if (applicationType === 'Entity' && !verifyEntityToken(req.body.entityAccessToken)) {
      return entityDenied();
    }

    // Create or get user
    if (existingUserId) {
      user = await User.findByPk(existingUserId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (!applicationType && user.applicationType === 'Entity' && !verifyEntityToken(req.body.entityAccessToken)) {
        return entityDenied();
      }

      // Refresh the user's profile with whatever the form submitted this time.
      // A returning user may pick a new applicationType, upload a profile
      // picture, or correct their personal info — none of that was persisted
      // before, so the admin saw stale data on the ID card / dashboard.
      const updatable = {
        applicationType, firstName, lastName, sex, nationality, nationalId,
        phoneNumber, email, currentJob, nationalAddress, entityName,
        visitingEntity, personInCharge, profilePicture
      };
      const updates = {};
      Object.entries(updatable).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== null) updates[k] = v;
      });

      // Keep the display name in sync with the new application type.
      if (updates.applicationType) {
        if (['Beneficiary', 'Visitor', 'Volunteer', 'Talented'].includes(updates.applicationType)) {
          const fn = updates.firstName || user.firstName;
          const ln = updates.lastName || user.lastName;
          if (fn || ln) updates.name = [fn, ln].filter(Boolean).join(' ');
        } else if (updates.applicationType === 'FABLAB Visit') {
          updates.name = updates.personInCharge || user.personInCharge || updates.name || user.name;
        } else if (updates.applicationType === 'Entity') {
          updates.name = updates.name || updates.entityName || user.entityName;
        }
      }

      if (Object.keys(updates).length) {
        await user.update(updates);
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

    // Check time slot availability (skip for volunteers)
    let isAvailable = true;
    if (applicationType === 'Volunteer') {
      isAvailable = true; // Volunteers bypass time slot check
    } else if (appointmentDate && appointmentTime) {
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
      volunteerSection,
      volunteerSkills,
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
