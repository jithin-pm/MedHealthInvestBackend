const jwt = require("jsonwebtoken");
const Admin = require("../models/adminModel");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Reject all actions if regular user account has been deactivated
    if (decoded.role !== 'admin' && decoded.id) {
      const User = require("../models/userModel");
      const user = await User.findByPk(decoded.id, { attributes: ['id', 'isActive'] });
      if (user && (user.isActive === false || user.isActive === 0)) {
        return res.status(403).json({
          message: "Your account has been deactivated. Please contact support.",
          isInactive: true
        });
      }
    }

    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

const adminMiddleware = async (req, res, next) => {
  // 1. Direct role check in verified JWT
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  // 2. Check if adminRefreshToken cookie is present and valid
  const adminRefresh = req.cookies && (req.cookies.adminRefreshToken || req.cookies.refreshToken);
  if (adminRefresh) {
    try {
      const decoded = jwt.verify(adminRefresh, process.env.JWT_REFRESH_SECRET);
      if (decoded && decoded.role === 'admin') {
        req.user = decoded;
        return next();
      }
    } catch (e) {
      // ignore
    }
  }

  // 3. Fallback: check if id in req.user corresponds to an admin in DB
  if (req.user && req.user.id) {
    try {
      const admin = await Admin.findByPk(req.user.id);
      if (admin && admin.role === 'admin') {
        req.user.role = 'admin';
        return next();
      }
    } catch (e) {
      // ignore
    }
  }

  // 4. In development environment, if request originates from admin portal (e.g. localhost:5173)
  const origin = req.headers.origin || req.headers.referer || '';
  if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost:5173') || origin.includes('127.0.0.1:5173'))) {
    console.warn(`[DEV] Admin middleware auto-permitting request from admin origin: ${origin}`);
    if (req.user) req.user.role = 'admin';
    return next();
  }

  res.status(403).json({ message: "Access denied. Admin only." });
};

module.exports = { authMiddleware, adminMiddleware };
