const Shop = require("../models/shop");
const User = require("../models/user");
const Job = require("../models/Job");
const ShopOwner = require("../models/ShopOwner");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const { SUBSCRIPTION_CLASSES } = require("../models/shop");
const {
  buildQrLink,
  generateOwnerToken,
  generateOwnerQrPayload,
} = require("../services/qrService");

// Helper function to calculate subscription expiry date
const calculateSubscriptionExpire = (plan, startDate = new Date()) => {
  const start = new Date(startDate);
  let expire;

  // If plan is a MongoDB ObjectId, look up the plan
  if (plan && plan.length === 24) {
    return null; // Will be calculated after plan lookup
  }

  switch (plan) {
    case "monthly":
      expire = new Date(start);
      expire.setMonth(expire.getMonth() + 1);
      break;
    case "yearly":
      expire = new Date(start);
      expire.setFullYear(expire.getFullYear() + 1);
      break;
    case "trial":
    default:
      expire = new Date(start);
      expire.setDate(expire.getDate() + 7); // 7 days trial
      break;
  }
  return expire;
};

// ၁။ ဆိုင်အသစ် ဆောက်ပေးခြင်း
exports.createShop = async (req, res) => {
  try {
    const {
      subscriptionPlanId,
      subscriptionPlan,
      subscriptionStart,
      subscriptionExpire,
      subscriptionClass,
      maxStaffAllowed: explicitMaxStaff,
      password,
      ...shopData
    } = req.body;

    let planName = subscriptionPlan || "trial";
    let startDate = subscriptionStart ? new Date(subscriptionStart) : new Date();
    let expireDate;

    // Calculate staff limit based on subscription class
    // Default to Basic (1 staff) if not specified
    let calculatedMaxStaff = SUBSCRIPTION_CLASSES['Basic'].defaultStaff;
    
    if (subscriptionClass && SUBSCRIPTION_CLASSES[subscriptionClass]) {
      calculatedMaxStaff = SUBSCRIPTION_CLASSES[subscriptionClass].defaultStaff;
    }

    // Override with explicit maxStaffAllowed if provided
    let finalMaxStaff = explicitMaxStaff || calculatedMaxStaff;

    // If subscriptionPlanId is provided, look up the plan for duration
    // Handle both MongoDB ObjectId and string IDs like "monthly", "yearly", "trial"
    if (subscriptionPlanId) {
      let plan = null;
      
      // Check if it's a valid MongoDB ObjectId (24 character hex string)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(subscriptionPlanId);
      
      if (isValidObjectId) {
        // It's a valid ObjectId, try to find by ID
        plan = await SubscriptionPlan.findById(subscriptionPlanId);
      } else {
        // It's a string ID like "monthly", "yearly", "trial", try to find by name
        // First letter uppercase to match seeded data
        const planName = subscriptionPlanId.charAt(0).toUpperCase() + subscriptionPlanId.slice(1).toLowerCase();
        plan = await SubscriptionPlan.findOne({ name: planName });
      }
      
      if (plan) {
        planName = plan.name;
        expireDate = new Date(startDate);
        expireDate.setDate(expireDate.getDate() + plan.durationDays);
        
        // Use plan's maxStaffAllowed if not explicitly provided
        if (!explicitMaxStaff) {
          finalMaxStaff = plan.maxStaffAllowed;
        }
      } else {
        // Plan not found, use default calculation
        expireDate = calculateSubscriptionExpire(planName, startDate);
      }
    } else {
      // Use legacy plan name calculation
      expireDate = subscriptionExpire
        ? new Date(subscriptionExpire)
        : calculateSubscriptionExpire(planName, startDate);
    }

    const shop = new Shop({
      ...shopData,
      subscriptionPlan: planName,
      subscriptionClass: subscriptionClass || 'Basic',
      subscriptionStart: startDate,
      subscriptionExpire: expireDate,
      maxStaffAllowed: finalMaxStaff,
    });

    await shop.save();

    // Create user account for the shop
    // Pass raw password - let User model's pre-save hook handle hashing
    if (password && shopData.email) {
      const user = new User({
        email: shopData.email,
        password: password, // Pass raw password, not pre-hashed
        isSuperAdmin: false,
        shopId: shop._id,
      });

      await user.save();
    }

    res.status(201).json({ message: "Shop Created Successfully", shop });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ၂။ ဆိုင်အားလုံး စာရင်းကို ကြည့်ခြင်း
exports.getAllShops = async (req, res) => {
  try {
    const shops = await Shop.find();
    
    // Get job counts for each shop
    const shopsWithJobCounts = await Promise.all(
      shops.map(async (shop) => {
        const jobCount = await Job.countDocuments({ shopId: shop._id });
        return {
          ...shop.toObject(),
          jobCount,
        };
      })
    );
    
    res.status(200).json(shopsWithJobCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ၂-၁။ Users အားလုံး စာရင်းကို ကြည့်ခြင်း (Super Admin Only)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments();

    res.status(200).json({
      users,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ၂-၂။ Jobs အားလုံး စာရင်းကို ကြည့်ခြင်း (Super Admin Only)
exports.getAllJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const jobs = await Job.find()
      .populate("shopId", "shopName email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalJobs = await Job.countDocuments();

    res.status(200).json({
      jobs,
      currentPage: page,
      totalPages: Math.ceil(totalJobs / limit),
      totalJobs,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ၃။ ဆိုင်တစ်ခုကို ပိတ်ခြင်း (Disable) သို့မဟုတ် ပြင်ဆင်ခြင်း
exports.updateShopStatus = async (req, res) => {
  try {
    const { 
      subscriptionExpire, 
      subscriptionClass, 
      maxStaffAllowed: explicitMaxStaff,
      ...rest 
    } = req.body;
    
    const updateData = { ...rest };

    if (subscriptionExpire) {
      updateData.subscriptionExpire = new Date(subscriptionExpire);
    }

    // Handle subscription class changes
    if (subscriptionClass) {
      updateData.subscriptionClass = subscriptionClass;
      
      // If subscriptionClass is changed and maxStaffAllowed is NOT explicitly provided,
      // auto-fill with the class default
      if (!explicitMaxStaff && SUBSCRIPTION_CLASSES[subscriptionClass]) {
        updateData.maxStaffAllowed = SUBSCRIPTION_CLASSES[subscriptionClass].defaultStaff;
      }
    }

    // If maxStaffAllowed is explicitly provided, always override
    if (explicitMaxStaff !== undefined) {
      updateData.maxStaffAllowed = explicitMaxStaff;
    }

    const shop = await Shop.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    res.status(200).json(shop);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ၄။ ဆိုင်ပို့ဆောင်သူစကားဝှက် ပြင်ဆင်ခြင်း
exports.updateShopPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Find user by shopId
    const user = await User.findOne({ shopId: shop._id });
    if (!user) {
      return res.status(404).json({ message: "User account not found for this shop" });
    }

    // Set raw password - let User model's pre-save hook handle hashing
    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ၅။ Generate Shop Owner QR Token
// @route   POST /api/admin/shops/:id/owner-qr
// @access  Private (Super Admin)
exports.generateOwnerQr = async (req, res) => {
  try {
    const shopId = req.params.id;
    const token = generateOwnerToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const record = await ShopOwner.create({
      token,
      shopId,
      expiresAt,
    });

    const payload = generateOwnerQrPayload(record.token);
    const qrLink = buildQrLink(payload);

    res.status(200).json({
      token: record.token,
      expiresAt: record.expiresAt,
      qrLink,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ၆။ Update Shop Staff Limit
// @route   PATCH /api/admin/shops/:id/limit
// @access  Private (Super Admin)
exports.updateShopStaffLimit = async (req, res) => {
  try {
    const { maxStaffAllowed } = req.body;

    if (maxStaffAllowed === undefined || typeof maxStaffAllowed !== 'number' || maxStaffAllowed < 1) {
      return res.status(400).json({ 
        message: "Invalid value for maxStaffAllowed. Must be a number greater than 0." 
      });
    }

    const shop = await Shop.findByIdAndUpdate(
      req.params.id,
      { maxStaffAllowed },
      { new: true }
    );

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    res.status(200).json({
      message: "Staff limit updated successfully",
      shop: {
        _id: shop._id,
        shopName: shop.shopName,
        maxStaffAllowed: shop.maxStaffAllowed,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ၇။ Delete Shop
// @route   DELETE /api/admin/shops/:id
// @access  Private (Super Admin)
exports.deleteShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Delete associated user account
    await User.deleteMany({ shopId: shop._id });
    
    // Delete the shop
    await Shop.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Shop deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
