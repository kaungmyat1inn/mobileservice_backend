const Shop = require("../models/shop");
const User = require("../models/user");
const Job = require("../models/Job");
const ShopOwner = require("../models/ShopOwner");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const Staff = require("../models/Staff");
const Expense = require("../models/Expense");
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

    // Override with explicit maxStaffAllowed if provided
    let finalMaxStaff = explicitMaxStaff || 1;

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
      subscriptionStart: startDate,
      subscriptionExpire: expireDate,
      maxStaffAllowed: finalMaxStaff,
    });

    // Add initial payment record
    const initialPrice = plan ? plan.price : (planName === 'yearly' ? 500000 : (planName === 'monthly' ? 50000 : 0));
    shop.paymentHistory.push({
      planName: planName,
      price: initialPrice,
      date: startDate,
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

// ၃.၁။ ဆိုင်သက်တမ်းတိုးခြင်း (Extend Subscription)
exports.extendShopSubscription = async (req, res) => {
  try {
    const { planName } = req.body;
    const shopId = req.params.id;

    const shop = await Shop.findById(shopId);
    if (!shop) return res.status(404).json({ message: "Shop not found" });

    // Lookup plan ignoring case
    const plan = await SubscriptionPlan.findOne({ name: new RegExp('^' + planName + '$', 'i') });
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const now = new Date();
    // Start extension from current expiry or now if already expired
    const currentExpire = new Date(shop.subscriptionExpire);
    const startDateForExtension = currentExpire > now ? currentExpire : now;

    const newExpire = new Date(startDateForExtension);
    newExpire.setDate(newExpire.getDate() + plan.durationDays);

    // Seed paymentHistory for legacy shops if empty
    if (!shop.paymentHistory || shop.paymentHistory.length === 0) {
      const pName = shop.subscriptionPlan || 'trial';
      const legacyPlan = await SubscriptionPlan.findOne({ name: new RegExp('^' + pName + '$', 'i') });
      let legacyPrice = 0;
      if (legacyPlan) {
        legacyPrice = legacyPlan.price;
      } else if (pName.toLowerCase() === 'yearly') {
        legacyPrice = 500000;
      } else if (pName.toLowerCase() === 'monthly') {
        legacyPrice = 50000;
      }

      shop.paymentHistory.push({
        planName: pName,
        price: legacyPrice,
        date: new Date(shop.subscriptionStart || shop.createdAt)
      });
    }

    shop.subscriptionExpire = newExpire;
    shop.subscriptionPlan = plan.name;
    shop.maxStaffAllowed = plan.maxStaffAllowed;

    // Add to payment history for financial stats
    shop.paymentHistory.push({
      planName: plan.name,
      price: plan.price,
      date: now
    });

    await shop.save();

    res.status(200).json({ message: "Shop subscription extended successfully", shop });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    // Delete all associated data
    await Job.deleteMany({ shopId: shop._id });
    await Staff.deleteMany({ shopId: shop._id });
    await Expense.deleteMany({ shopId: shop._id });
    await ShopOwner.deleteMany({ shopId: shop._id });

    // Delete the shop
    await Shop.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Shop deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ၈။ Financial Stats
// @route   GET /api/admin/financial-stats
// @access  Private (Super Admin)
exports.getFinancialStats = async (req, res) => {
  try {
    const now = new Date();

    // Fetch all shops to calculate historical revenue accurately
    const allShops = await Shop.find();

    // Fetch all subscription plans to get pricing
    const plans = await SubscriptionPlan.find();

    // Create a map of plan name to plan details
    const planMap = {};
    plans.forEach(plan => {
      planMap[plan.name] = plan;
      planMap[plan.name.toLowerCase()] = plan;
    });

    let yearlyRevenue = 0;
    let monthlyRevenue = 0;
    const revenueByPlanMap = {};

    // For monthly trend (last 6 months)
    const targetDate = new Date();
    // Use targetMonth and targetYear from query, otherwise current Date in server timezone
    const targetMonth = req.query.month ? parseInt(req.query.month) - 1 : targetDate.getMonth();
    const targetYear = req.query.year ? parseInt(req.query.year) : targetDate.getFullYear();

    const monthlyTrendMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const monthKey = d.getFullYear() + '-' + d.getMonth();
      const monthName = d.toLocaleString('en-US', { month: 'short' });
      monthlyTrendMap[monthKey] = { monthName, total: 0, sortKey: d.getTime() };
    }

    // We calculate from precise boundaries
    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 1);

    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);

    let activeSubscribers = 0;

    allShops.forEach(shop => {
      if (shop.isActive && new Date(shop.subscriptionExpire) > now) {
        activeSubscribers++;
      }

      // Use a single property `subscriptionPlan` to link to Subscription Plans.
      const planNameFallback = shop.subscriptionPlan || 'trial';
      const plan = planMap[planNameFallback] || planMap[planNameFallback.toLowerCase()];

      let shopValue = 0;

      if (plan && plan.price > 0) {
        shopValue = plan.price;
      } else if (planNameFallback === 'monthly' || planNameFallback === 'yearly') {
        // Fallback for legacy plans if missing in DB
        shopValue = planNameFallback === 'monthly' ? 50000 : 500000;
      }

      // Gather all payments for this shop
      const payments = [];
      if (shop.paymentHistory && shop.paymentHistory.length > 0) {
        payments.push(...shop.paymentHistory);
      } else {
        // Fallback for legacy shops without payment history
        payments.push({
          planName: plan ? plan.name : planNameFallback,
          price: shopValue,
          date: new Date(shop.subscriptionStart || shop.createdAt)
        });
      }

      payments.forEach(payment => {
        const payDate = new Date(payment.date);
        let payVal = payment.price;

        if (payVal === undefined || payVal === null) {
          payVal = shopValue; // Fallback if price is missing in history
        }

        // Monthly Revenue check
        if (payDate.getTime() >= monthStart.getTime() && payDate.getTime() < monthEnd.getTime()) {
          monthlyRevenue += payVal;
        }

        // Yearly Revenue check
        if (payDate.getTime() >= yearStart.getTime() && payDate.getTime() < yearEnd.getTime()) {
          yearlyRevenue += payVal;
        }

        // Group by Plan
        const pName = payment.planName || planNameFallback;
        const displayPlanName = planMap[pName] ? planMap[pName].name : (pName.charAt(0).toUpperCase() + pName.slice(1));

        if (!revenueByPlanMap[displayPlanName]) {
          revenueByPlanMap[displayPlanName] = 0;
        }
        revenueByPlanMap[displayPlanName] += payVal;

        // Trend check
        const shopMonthKey = payDate.getFullYear() + '-' + payDate.getMonth();
        if (monthlyTrendMap[shopMonthKey]) {
          monthlyTrendMap[shopMonthKey].total += payVal;
        }
      });
    });

    // Convert revenueByPlanMap to percentage array
    const revenueByPlan = [];
    const totalAllTime = Object.values(revenueByPlanMap).reduce((a, b) => a + b, 0);

    if (totalAllTime > 0) {
      for (const [plan, amount] of Object.entries(revenueByPlanMap)) {
        if (amount > 0) {
          revenueByPlan.push({
            plan,
            percentage: Math.round((amount / totalAllTime) * 100)
          });
        }
      }
    }

    // Sort by percentage descending
    revenueByPlan.sort((a, b) => b.percentage - a.percentage);

    const monthlyTrend = Object.values(monthlyTrendMap)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(item => ({
        month: item.monthName,
        total: item.total
      }));

    res.status(200).json({
      yearlyRevenue: Math.round(yearlyRevenue),
      monthlyRevenue: Math.round(monthlyRevenue),
      activeSubscribers,
      revenueByPlan,
      monthlyTrend
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
