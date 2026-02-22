const jwt = require("jsonwebtoken");
const User = require("../models/user");

// JWT Token ကိုစစ်ဆေးပြီး User ကို req.user မှာထည့်ပေးတဲ့ Middleware
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.user.id).select("-password");

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Super Admin ဟုတ်၊ မဟုတ် စစ်ဆေးသည့် Middleware
const checkSuperAdmin = (req, res, next) => {
  if (req.user && req.user.isSuperAdmin) {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Access denied. Super Admin privileges required." });
  }
};

module.exports = { protect, checkSuperAdmin };
