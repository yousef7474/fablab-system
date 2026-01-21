const { EliteUser } = require('../models');

/**
 * Register a new elite user
 */
exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      nationalId,
      nationality,
      sex,
      dateOfBirth,
      city,
      organization,
      specialization,
      bio,
      password,
      profilePicture
    } = req.body;

    // Check if email already exists
    const existingEmail = await EliteUser.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({
        message: 'البريد الإلكتروني مسجل مسبقاً',
        messageEn: 'Email already registered'
      });
    }

    // Check if national ID already exists
    const existingNationalId = await EliteUser.findOne({ where: { nationalId } });
    if (existingNationalId) {
      return res.status(400).json({
        message: 'رقم الهوية مسجل مسبقاً',
        messageEn: 'National ID already registered'
      });
    }

    // Generate unique ID
    const uniqueId = await EliteUser.generateUniqueId();

    // Create the elite user
    const eliteUser = await EliteUser.create({
      uniqueId,
      firstName,
      lastName,
      email,
      phoneNumber,
      nationalId,
      nationality: nationality || 'Saudi',
      sex,
      dateOfBirth: dateOfBirth || null,
      city,
      organization,
      specialization,
      bio,
      password,
      profilePicture
    });

    // Return user data without password
    const userData = {
      eliteId: eliteUser.eliteId,
      uniqueId: eliteUser.uniqueId,
      firstName: eliteUser.firstName,
      lastName: eliteUser.lastName,
      email: eliteUser.email,
      phoneNumber: eliteUser.phoneNumber,
      city: eliteUser.city,
      status: eliteUser.status
    };

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      messageEn: 'Account created successfully',
      user: userData
    });
  } catch (error) {
    console.error('Error registering elite user:', error);
    res.status(500).json({
      message: 'حدث خطأ أثناء التسجيل',
      messageEn: 'Error during registration',
      error: error.message
    });
  }
};

/**
 * Elite user login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await EliteUser.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        messageEn: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        message: 'الحساب غير مفعل',
        messageEn: 'Account is not active'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        messageEn: 'Invalid email or password'
      });
    }

    // Update last login
    await user.update({ lastLogin: new Date() });

    // Return user data without password
    const userData = {
      eliteId: user.eliteId,
      uniqueId: user.uniqueId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePicture: user.profilePicture,
      city: user.city,
      organization: user.organization,
      specialization: user.specialization,
      status: user.status
    };

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      messageEn: 'Login successful',
      user: userData
    });
  } catch (error) {
    console.error('Error logging in elite user:', error);
    res.status(500).json({
      message: 'حدث خطأ أثناء تسجيل الدخول',
      messageEn: 'Error during login',
      error: error.message
    });
  }
};

/**
 * Get all elite users (for admin)
 */
exports.getAllEliteUsers = async (req, res) => {
  try {
    const users = await EliteUser.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching elite users:', error);
    res.status(500).json({
      message: 'حدث خطأ أثناء جلب البيانات',
      messageEn: 'Error fetching data',
      error: error.message
    });
  }
};

/**
 * Get elite user by ID
 */
exports.getEliteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await EliteUser.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        message: 'المستخدم غير موجود',
        messageEn: 'User not found'
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching elite user:', error);
    res.status(500).json({
      message: 'حدث خطأ أثناء جلب البيانات',
      messageEn: 'Error fetching data',
      error: error.message
    });
  }
};

/**
 * Update elite user status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await EliteUser.findByPk(id);
    if (!user) {
      return res.status(404).json({
        message: 'المستخدم غير موجود',
        messageEn: 'User not found'
      });
    }

    await user.update({ status });

    res.json({
      message: 'تم تحديث الحالة بنجاح',
      messageEn: 'Status updated successfully',
      user: {
        eliteId: user.eliteId,
        uniqueId: user.uniqueId,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Error updating elite user status:', error);
    res.status(500).json({
      message: 'حدث خطأ أثناء التحديث',
      messageEn: 'Error updating status',
      error: error.message
    });
  }
};

/**
 * Delete elite user
 */
exports.deleteEliteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await EliteUser.findByPk(id);
    if (!user) {
      return res.status(404).json({
        message: 'المستخدم غير موجود',
        messageEn: 'User not found'
      });
    }

    await user.destroy();

    res.json({
      message: 'تم حذف المستخدم بنجاح',
      messageEn: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting elite user:', error);
    res.status(500).json({
      message: 'حدث خطأ أثناء الحذف',
      messageEn: 'Error deleting user',
      error: error.message
    });
  }
};

module.exports = exports;
