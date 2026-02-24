const User = require("../models/user");
const Shop = require("../models/shop");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const DEFAULT_SECURITY_PIN = "123456";

const generateToken = (user) => {
  return jwt.sign(
    {
      user: {
        id: user._id,
        isSuperAdmin: user.isSuperAdmin,
        shopId: user.shopId,
      },
    },
    process.env.JWT_SECRET,
    {}
  );
};

const verifyShopPin = async (shop, pin) => {
  if (!shop.securityPinHash) {
    return pin === DEFAULT_SECURITY_PIN;
  }
  return bcrypt.compare(pin, shop.securityPinHash);
};

const setShopPin = async (shop, pin) => {
  const salt = await bcrypt.genSalt(10);
  shop.securityPinHash = await bcrypt.hash(pin, salt);
};

// User အသစ် Register လုပ်ခြင်း
exports.registerUser = async (req, res) => {
  const { email, password, isSuperAdmin, shopId } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    let finalShopId = null; // Default to null for Super Admins

    if (!isSuperAdmin) {
      // If not a Super Admin, shopId is required and must be valid
      if (!shopId) {
        return res
          .status(400)
          .json({ message: "Shop ID is required for non-Super Admin users" });
      }
      const shopExists = await Shop.findById(shopId);
      if (!shopExists) {
        return res.status(400).json({ message: "Invalid Shop ID" });
      }
      finalShopId = shopId; // Assign shopId if valid and not Super Admin
    } else {
      // If Super Admin, ensure shopId is null
      finalShopId = null;
    }

    const user = await User.create({
      email,
      password,
      isSuperAdmin,
      shopId: finalShopId,
    });
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        shopId: user.shopId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User Login ဝင်ရောက်ခြင်း
exports.loginUser = async (req, res) => {
  const email = (req.body.email || "").toString().trim().toLowerCase();
  const password = (req.body.password || "").toString();

  try {
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      // Check if user is a shop owner and verify subscription
      if (!user.isSuperAdmin && user.shopId) {
        const shop = await Shop.findById(user.shopId);
        if (shop) {
          // Check if shop subscription is expired
          const now = new Date();
          const expireDate = new Date(shop.subscriptionExpire);

          if (now > expireDate) {
            return res.status(403).json({
              message: "Your shop subscription has expired. Please contact admin.",
              subscriptionExpired: true,
              shopName: shop.shopName,
              expiredDate: shop.subscriptionExpire,
            });
          }

          // Check if shop is inactive
          if (!shop.isActive) {
            return res.status(403).json({
              message: "Your shop account has been deactivated. Please contact admin.",
              shopDeactivated: true,
              shopName: shop.shopName,
            });
          }

          // Return shopName in successful login response
          res.json({
            token: generateToken(user),
            user: {
              id: user._id,
              email: user.email,
              isSuperAdmin: user.isSuperAdmin,
              shopId: user.shopId,
              shopName: shop.shopName, // Include shop name
              phone: shop.phone,
              shopAddress: shop.address,
              subscriptionStartDate: shop.subscriptionStart,
              subscriptionEndDate: shop.subscriptionExpire,
              subscriptionPlan: shop.subscriptionPlan,
              subscriptionClass: shop.subscriptionClass,
              maxStaffAllowed: shop.maxStaffAllowed,
              logoUrl: shop.logoUrl,
              customRule: shop.customRule,
              registrationDate: shop.createdAt,
            },
          });
          return;
        }
      }

      res.json({
        token: generateToken(user),
        user: {
          id: user._id,
          email: user.email,
          isSuperAdmin: user.isSuperAdmin,
          shopId: user.shopId,
          shopName: user.isSuperAdmin ? 'Super Admin' : null, // Set shopName for Super Admin
          phone: null,
          shopAddress: null,
          subscriptionStartDate: null,
          subscriptionEndDate: null,
          subscriptionPlan: null,
          subscriptionClass: null,
          maxStaffAllowed: null,
          logoUrl: null,
          customRule: null,
          registrationDate: user.createdAt,
        },
      });
    } else {
      res.status(401).json({ message: "Invalid email or password. Please check your credentials." });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot Password - Send reset email
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found with this email" });
    }

    // Get Reset Token
    const resetToken = user.getResetPasswordToken();
    await user.save();

    // In production, send email with resetToken
    // For now, return the reset token in response
    res.status(200).json({
      message: "Password reset email sent",
      resetToken: resetToken,
      // Note: Remove this in production and send via email instead
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset Password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res) => {
  const { password } = req.body;

  // Get hashed token
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.resettoken)
    .digest("hex");

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
      message: "Password reset successful. You can now login.",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let shopData = {
      shopName: user.isSuperAdmin ? "Super Admin" : null,
      phone: null,
      shopAddress: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      subscriptionPlan: null,
      subscriptionClass: null,
      maxStaffAllowed: null,
      logoUrl: null,
      customRule: null,
      registrationDate: null,
    };

    if (!user.isSuperAdmin && user.shopId) {
      const shop = await Shop.findById(user.shopId);
      if (shop) {
        shopData = {
          shopName: shop.shopName,
          phone: shop.phone,
          shopAddress: shop.address,
          subscriptionStartDate: shop.subscriptionStart,
          subscriptionEndDate: shop.subscriptionExpire,
          subscriptionPlan: shop.subscriptionPlan,
          subscriptionClass: shop.subscriptionClass,
          maxStaffAllowed: shop.maxStaffAllowed,
          logoUrl: shop.logoUrl,
          customRule: shop.customRule,
          registrationDate: shop.createdAt,
        };
      }
    }

    return res.status(200).json({
      id: user._id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      shopId: user.shopId,
      ...shopData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  const { email, customRule, shopName, phone, shopAddress } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isSuperAdmin) {
      // Keep existing behavior for super admin account updates.
      if (email && email !== user.email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
          return res.status(400).json({ message: "Email already in use" });
        }
        user.email = email;
      }
    }

    const updatedUser = await user.save();

    let shopData = {
      shopName: updatedUser.isSuperAdmin ? "Super Admin" : null,
      phone: null,
      shopAddress: null,
      subscriptionStartDate: null,
      subscriptionEndDate: null,
      subscriptionPlan: null,
      subscriptionClass: null,
      maxStaffAllowed: null,
      logoUrl: null,
      customRule: null,
      registrationDate: null,
    };

    if (!updatedUser.isSuperAdmin && updatedUser.shopId) {
      const shop = await Shop.findById(updatedUser.shopId);
      if (shop) {
        if (shopName !== undefined) {
          shop.shopName = shopName;
        }
        if (phone !== undefined) {
          shop.phone = phone;
        }
        if (shopAddress !== undefined) {
          shop.address = shopAddress;
        }
        if (customRule !== undefined) {
          shop.customRule = customRule;
        }
        await shop.save();

        shopData = {
          shopName: shop.shopName,
          phone: shop.phone,
          shopAddress: shop.address,
          subscriptionStartDate: shop.subscriptionStart,
          subscriptionEndDate: shop.subscriptionExpire,
          subscriptionPlan: shop.subscriptionPlan,
          subscriptionClass: shop.subscriptionClass,
          maxStaffAllowed: shop.maxStaffAllowed,
          logoUrl: shop.logoUrl,
          customRule: shop.customRule,
          registrationDate: shop.createdAt,
        };
      }
    }

    res.status(200).json({
      id: updatedUser._id,
      email: updatedUser.email,
      isSuperAdmin: updatedUser.isSuperAdmin,
      shopId: updatedUser.shopId,
      ...shopData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user password
// @route   PUT /api/auth/password
// @access  Private
exports.updateUserPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify security PIN for protected sections
// @route   POST /api/auth/verify-pin
// @access  Private
exports.verifySecurityPin = async (req, res) => {
  const { pin } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user || user.isSuperAdmin || !user.shopId) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const shop = await Shop.findById(user.shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const isValid = await verifyShopPin(shop, pin);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid PIN" });
    }

    // Migrate from implicit default PIN to stored hash when verified first time.
    if (!shop.securityPinHash && pin === DEFAULT_SECURITY_PIN) {
      await setShopPin(shop, pin);
      await shop.save();
    }

    return res.status(200).json({ valid: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Update security PIN for protected sections
// @route   PUT /api/auth/profile/pin
// @access  Private
exports.updateSecurityPin = async (req, res) => {
  const { currentPin, newPin } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user || user.isSuperAdmin || !user.shopId) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const shop = await Shop.findById(user.shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const isValidCurrentPin = await verifyShopPin(shop, currentPin);
    if (!isValidCurrentPin) {
      return res.status(401).json({ message: "Current PIN is incorrect" });
    }

    await setShopPin(shop, newPin);
    await shop.save();

    return res.status(200).json({ message: "PIN updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
// @desc    Upload shop logo
// @route   PUT /api/auth/profile/logo
// @access  Private
exports.uploadShopLogo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.isSuperAdmin || !user.shopId) {
      return res.status(404).json({ message: "Shop not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const shop = await Shop.findById(user.shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Delete old logo if exists
    if (shop.logoUrl) {
      const oldPath = path.join(__dirname, "..", shop.logoUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update shop with new logo url
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    shop.logoUrl = logoUrl;
    await shop.save();

    res.json({ message: "Logo updated successfully", logoUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
