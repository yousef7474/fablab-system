/**
 * Role-based access control middleware
 * Checks if the authenticated admin has the required role
 */

// Generic role check middleware factory
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        message: 'Access denied. Insufficient permissions.',
        messageAr: 'تم رفض الوصول. صلاحيات غير كافية.'
      });
    }

    next();
  };
};

// Pre-configured role middlewares
const requireManager = requireRole('manager', 'admin');
const requireAdmin = requireRole('admin');

module.exports = {
  requireRole,
  requireManager,
  requireAdmin
};
