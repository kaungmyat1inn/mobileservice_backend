const Staff = require("../models/Staff");
const Shop = require("../models/shop");

// @desc    Create a new staff member
// @route   POST /api/staff
// @access  Private (Owner/Admin only)
const createStaff = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  const { name, role, phone } = req.body;

  try {
    // Get the shop to check the staff limit
    const shop = await Shop.findById(req.user.shopId);
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Default maxStaffAllowed to 1 if null
    const maxStaffAllowed = shop.maxStaffAllowed ?? 1;

    // Count existing staff for this shop
    const currentStaffCount = await Staff.countDocuments({ shopId: req.user.shopId });

    // Check if staff limit is reached
    if (currentStaffCount >= maxStaffAllowed) {
      return res.status(403).json({
        message: `Staff limit reached (${maxStaffAllowed}). Please upgrade your plan to add more staff.`,
        limit: maxStaffAllowed,
        currentCount: currentStaffCount,
        subscriptionClass: shop.subscriptionClass || 'Basic',
      });
    }

    const newStaff = new Staff({
      name,
      role: role || "Technician",
      phone,
      shopId: req.user.shopId,
    });

    const savedStaff = await newStaff.save();
    res.status(201).json(savedStaff);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all staff members for the logged-in owner's shop
// @route   GET /api/staff/my-shop
// @access  Private (Owner/Admin only)
const getStaffByShop = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const staff = await Staff.find({ shopId: req.user.shopId }).sort({ createdAt: -1 });
    
    // Get shop's max staff limit
    const shop = await Shop.findById(req.user.shopId);
    const maxStaffAllowed = shop?.maxStaffAllowed || 1;
    const currentCount = staff.length;

    res.status(200).json({
      staff,
      limit: maxStaffAllowed,
      currentCount,
      subscriptionClass: shop?.subscriptionClass || 'Basic',
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get a single staff member by ID
// @route   GET /api/staff/:id
// @access  Private (Owner/Admin only)
const getStaffById = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    // Ensure the staff belongs to the user's shop
    if (staff.shopId.toString() !== req.user.shopId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to access this staff member" });
    }

    res.status(200).json(staff);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update a staff member
// @route   PUT /api/staff/:id
// @access  Private (Owner/Admin only)
const updateStaff = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  const { name, role, phone, isActive } = req.body;

  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    // Ensure the staff belongs to the user's shop
    if (staff.shopId.toString() !== req.user.shopId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to update this staff member" });
    }

    if (name) staff.name = name;
    if (role) staff.role = role;
    if (phone !== undefined) staff.phone = phone;
    if (isActive !== undefined) staff.isActive = isActive;

    const updatedStaff = await staff.save();
    res.status(200).json(updatedStaff);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete a staff member
// @route   DELETE /api/staff/:id
// @access  Private (Owner/Admin only)
const deleteStaff = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    // Ensure the staff belongs to the user's shop
    if (staff.shopId.toString() !== req.user.shopId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to delete this staff member" });
    }

    await staff.deleteOne();
    res.status(200).json({ message: "Staff removed" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get staff performance stats (for dashboard)
// @route   GET /api/staff/my-shop/performance
// @access  Private (Owner/Admin only)
const getStaffPerformance = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  const Job = require("../models/Job");

  try {
    const shopId = req.user.shopId;
    const period = (req.query.period || "monthly").toString().toLowerCase();

    // Get period date range
    const now = new Date();
    let start, end;

    if (period === "daily") {
      const base = req.query.date ? new Date(req.query.date) : now;
      start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    } else if (period === "yearly") {
      const year = Number.parseInt(req.query.year, 10) || now.getFullYear();
      start = new Date(year, 0, 1);
      end = new Date(year + 1, 0, 1);
    } else {
      // Default monthly
      const month = Number.parseInt(req.query.month, 10) || now.getMonth() + 1;
      const year = Number.parseInt(req.query.year, 10) || now.getFullYear();
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 1);
    }

    // Get all staff for the shop
    const staff = await Staff.find({ shopId });

    // Get staff performance from completed jobs
    const performanceStats = await Job.aggregate([
      {
        $match: {
          shopId: shopId,
          isLocked: true,
          assignedTechnician: { $ne: null },
          checkoutDate: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: "$assignedTechnician",
          totalJobs: { $sum: 1 },
          totalProfit: { $sum: "$profit" },
          totalPartsCost: { $sum: "$partsCost" },
          totalServiceFee: { $sum: "$serviceFee" },
        },
      },
    ]);

    // Create a map for quick lookup
    const statsMap = {};
    performanceStats.forEach((stat) => {
      statsMap[stat._id?.toString()] = stat;
    });

    // Combine staff data with performance stats
    const staffWithPerformance = staff.map((s) => {
      const stats = statsMap[s._id.toString()] || {
        totalJobs: 0,
        totalProfit: 0,
        totalPartsCost: 0,
        totalServiceFee: 0,
      };
      return {
        staffId: s._id,
        name: s.name,
        role: s.role,
        totalJobs: stats.totalJobs,
        totalProfit: stats.totalProfit,
        totalPartsCost: stats.totalPartsCost,
        totalServiceFee: stats.totalServiceFee,
      };
    });

    res.status(200).json({
      period,
      from: start,
      to: end,
      staffPerformance: staffWithPerformance,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createStaff,
  getStaffByShop,
  getStaffById,
  updateStaff,
  deleteStaff,
  getStaffPerformance,
};

