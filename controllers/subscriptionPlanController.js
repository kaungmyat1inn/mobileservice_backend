const SubscriptionPlan = require("../models/SubscriptionPlan");

// ပါဝင်သော Plan များစာရင်းရယူခြင်း (Public - for shop registration)
exports.getActivePlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 });
    res.status(200).json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Plans များစာရင်းရယူခြင်း (Super Admin)
exports.getAllPlans = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const plans = await SubscriptionPlan.find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const totalPlans = await SubscriptionPlan.countDocuments();

    res.status(200).json({
      plans,
      currentPage: page,
      totalPages: Math.ceil(totalPlans / limit),
      totalPlans,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Plan အသစ်ဆောက်ခြင်း
exports.createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      currency,
      durationDays,
      maxStaffAllowed,
      features,
      isActive,
      isPopular,
      sortOrder,
    } = req.body;

    // Check if plan name already exists
    const existingPlan = await SubscriptionPlan.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    if (existingPlan) {
      return res.status(400).json({ message: "Plan with this name already exists" });
    }

    const plan = new SubscriptionPlan({
      name,
      description,
      price,
      currency,
      durationDays,
      maxStaffAllowed,
      features: features || [],
      isActive: isActive !== undefined ? isActive : true,
      isPopular: isPopular || false,
      sortOrder: sortOrder || 0,
    });

    await plan.save();
    res.status(201).json({ message: "Plan created successfully", plan });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Plan တစ်ခုကို ပြင်ဆင်ခြင်း
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Remove id from update data if present
    delete updateData.id;
    // Remove timestamps from update
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.status(200).json({ message: "Plan updated successfully", plan });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Plan တစ်ခုကို ဖျက်ခြင်း
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findByIdAndDelete(id);

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Plan တစ်ခုကို ရယူခြင်း (Single)
exports.getPlanById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.status(200).json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

