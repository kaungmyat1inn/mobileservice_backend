const Job = require("../models/Job");
const Expense = require("../models/Expense");
const { addSuggestion } = require("./suggestionControllers");
const { notifyJobStatusChange } = require("../services/telegramBot");
const { buildQrLink, generateJobQrPayload } = require("../services/qrService");

const ALLOWED_JOB_STATUSES = [
  "pending",
  "progress",
  "cancel",
  "complete",
  "checked_out",
];

const getPeriodRange = (period, query = {}) => {
  const now = new Date();
  let start;
  let end;

  if (period === "daily") {
    const base = query.date ? new Date(query.date) : now;
    start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    return { start, end };
  }

  if (period === "yearly") {
    const year = Number.parseInt(query.year, 10) || now.getFullYear();
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
    return { start, end };
  }

  // Default monthly
  const month = Number.parseInt(query.month, 10) || now.getMonth() + 1; // 1-12
  const year = Number.parseInt(query.year, 10) || now.getFullYear();
  start = new Date(year, month - 1, 1);
  end = new Date(year, month, 1);
  return { start, end };
};

const getActorDisplayName = (user) => {
  if (!user) return "System";
  return user.name || user.email || "System";
};

const appendTimeline = (job, status) => {
  if (!status) return;
  if (!Array.isArray(job.timeline)) {
    job.timeline = [];
  }
  job.timeline.push({
    status,
    updatedAt: new Date(),
  });
};

const appendStatusLog = (job, req, fromStatus, toStatus, source = "manual") => {
  if (!toStatus || fromStatus === toStatus) return;
  if (!Array.isArray(job.statusLogs)) {
    job.statusLogs = [];
  }

  job.statusLogs.push({
    fromStatus: fromStatus || null,
    toStatus,
    updatedAt: new Date(),
    updatedBy: req.user?._id || null,
    updatedByName: getActorDisplayName(req.user),
    source,
  });
};

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private (Owner only)
const createJob = async (req, res) => {
  // The 'protect' middleware ensures req.user is available
  // and we expect req.user.shopId to be present for a logged-in owner.
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  const {
    customerName,
    customerPhone,
    deviceModel,
    imeiOrSn,
    color,
    issue,
    partsCost,
    serviceFee,
    reserves,
    assignedTechnician,
  } = req.body;

  try {
    // Generate a unique job number (e.g., MSG-timestamp)
    const jobNo = `#${Date.now()}`;

    // Calculate total amount (partsCost + serviceFee - reserves)
    const totalAmount =
      Number(partsCost || 0) + Number(serviceFee || 0) - Number(reserves || 0);

    const newJob = new Job({
      jobNo,
      shopId: req.user.shopId, // Associate the job with the owner's shop
      customerName,
      customerPhone,
      deviceModel,
      imeiOrSn: imeiOrSn || "",
      color: color || "",
      issue,
      partsCost: partsCost || 0,
      serviceFee: serviceFee || 0,
      reserves: reserves || 0,
      totalAmount,
      status: "pending",
      assignedTechnician: assignedTechnician || null,
    });
    appendTimeline(newJob, "pending");
    appendStatusLog(newJob, req, null, newJob.status, "create");

    // Add suggestions dynamically
    if (deviceModel) addSuggestion('model', deviceModel);
    if (color) addSuggestion('color', color);
    if (issue) addSuggestion('issue', issue);

    const savedJob = await newJob.save();
    await savedJob.populate("assignedTechnician", "name role");
    res.status(201).json(savedJob);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get all jobs for the logged-in owner's shop with search, filter, and pagination
// @route   GET /api/jobs/my-shop?page=1&limit=10&search=customerName&status=pending
// @access  Private (Owner only)
const getMyShopJobs = async (req, res) => {
  // This function will be implemented later to fetch jobs for the logged-in owner's shop
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  const shopId = req.user.shopId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = { shopId };

  // Search by customerName or deviceModel
  if (req.query.search) {
    const searchKeyword = new RegExp(req.query.search, "i"); // Case-insensitive search
    query.$or = [
      { customerName: searchKeyword },
      { deviceModel: searchKeyword },
    ];
  }

  // Filter by status
  if (req.query.status) {
    query.status = req.query.status;
  }

  try {
    const jobs = await Job.find(query)
      .populate("assignedTechnician", "name role")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); // Sort by newest first

    const totalJobs = await Job.countDocuments(query);

    res.status(200).json({
      jobs,
      currentPage: page,
      totalPages: Math.ceil(totalJobs / limit),
      totalJobs,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get shop report for the logged-in owner's shop
// @route   GET /api/jobs/my-shop/report
// @access  Private (Owner only)
const getShopReport = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const shopId = req.user.shopId;
    const period = (req.query.period || "monthly").toString().toLowerCase();
    const { start, end } = getPeriodRange(period, req.query);

    const jobReport = await Job.aggregate([
      {
        $match: {
          shopId: shopId,
          isLocked: true,
          checkoutDate: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null, // Group all matching documents into a single result
          totalPartsCost: { $sum: "$partsCost" },
          totalServiceFee: { $sum: "$serviceFee" },
          totalReserves: { $sum: "$reserves" },
          totalJobs: { $sum: 1 }, // Count the number of jobs
        },
      },
      {
        $project: {
          _id: 0, // Exclude the _id field from the final output
          totalPartsCost: 1,
          totalServiceFee: 1,
          totalReserves: 1,
          totalJobs: 1,
        },
      },
    ]);

    const expenseReport = await Expense.aggregate([
      {
        $match: {
          shopId: shopId,
          expenseDate: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: null,
          totalExpense: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          totalExpense: 1,
        },
      },
    ]);

    const jobTotals = jobReport[0] || {
      totalPartsCost: 0,
      totalServiceFee: 0,
      totalReserves: 0,
      totalJobs: 0,
    };
    const totalExpense = expenseReport[0]?.totalExpense || 0;
    const totalProfit =
      Number(jobTotals.totalServiceFee || 0) -
      Number(totalExpense || 0) -
      Number(jobTotals.totalReserves || 0);

    res.status(200).json({
      period,
      from: start,
      to: end,
      totalPartsCost: jobTotals.totalPartsCost,
      totalServiceFee: jobTotals.totalServiceFee,
      totalReserves: jobTotals.totalReserves,
      totalExpense,
      totalProfit,
      totalJobs: jobTotals.totalJobs,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get a single job by ID
// @route   GET /api/jobs/:id
// @access  Private (Owner only)
const getJobById = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const job = await Job.findById(req.params.id).populate("assignedTechnician", "name role");

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Ensure the job belongs to the user's shop
    if (job.shopId.toString() !== req.user.shopId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to access this job" });
    }

    res.status(200).json(job);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Update a job
// @route   PUT /api/jobs/:id
// @access  Private (Owner only)
const updateJob = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const job = await Job.findById(req.params.id);
    const previousStatus = job?.status;

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Ensure the job belongs to the user's shop
    if (job.shopId.toString() !== req.user.shopId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to update this job" });
    }

    if (job.status === "checked_out") {
      return res.status(403).json({
        message: "Job is locked after checked_out",
      });
    }

    const {
      customerName,
      customerPhone,
      deviceModel,
      imeiOrSn,
      color,
      issue,
      partsCost,
      serviceFee,
      reserves,
      status,
      assignedTechnician,
    } = req.body;

    if (status && !ALLOWED_JOB_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Invalid job status",
      });
    }

    if (customerName) job.customerName = customerName;
    if (customerPhone) job.customerPhone = customerPhone;
    if (deviceModel) {
      job.deviceModel = deviceModel;
      addSuggestion('model', deviceModel);
    }
    if (imeiOrSn !== undefined) job.imeiOrSn = imeiOrSn;
    if (color !== undefined) {
      job.color = color;
      if (color) addSuggestion('color', color);
    }
    if (issue) {
      job.issue = issue;
      addSuggestion('issue', issue);
    }
    if (partsCost !== undefined) job.partsCost = partsCost;
    if (serviceFee !== undefined) job.serviceFee = serviceFee;
    if (reserves !== undefined) job.reserves = reserves;
    if (status) {
      appendStatusLog(job, req, job.status, status, "update");
      appendTimeline(job, status);
      job.status = status;
      if (status === "checked_out") {
        job.isLocked = true;
      }
    }

    // Update assigned technician
    if (assignedTechnician !== undefined) {
      job.assignedTechnician = assignedTechnician || null;
    }

    // Recalculate total amount if partsCost, serviceFee or reserves changed
    if (partsCost !== undefined || serviceFee !== undefined || reserves !== undefined) {
      job.totalAmount =
        Number(job.partsCost || 0) + Number(job.serviceFee || 0) - Number(job.reserves || 0);
    }

    const updatedJob = await job.save();
    await updatedJob.populate("assignedTechnician", "name role");
    if (previousStatus && previousStatus !== updatedJob.status) {
      notifyJobStatusChange(updatedJob).catch((err) =>
        console.error("Telegram notify error:", err),
      );
    }
    res.status(200).json(updatedJob);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Checkout a job (finalize bill and lock job)
// @route   PUT /api/jobs/:id/checkout
// @access  Private (Owner only)
const checkoutJob = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.shopId.toString() !== req.user.shopId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to checkout this job" });
    }

    if (job.isLocked === true) {
      return res.status(400).json({
        message: "Job is already checked out and locked",
      });
    }

    job.finalCost = Number(job.totalAmount || 0);
    job.profit =
      Number(job.serviceFee || 0) - Number(job.partsCost || 0) - Number(job.reserves || 0);
    job.checkoutDate = new Date();
    job.isLocked = true;
    appendStatusLog(job, req, job.status, "checked_out", "checkout");
    appendTimeline(job, "checked_out");
    job.status = "checked_out";

    const updatedJob = await job.save();
    await updatedJob.populate("assignedTechnician", "name role");
    res.status(200).json(updatedJob);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get total counts for all 5 statuses
// @route   GET /api/jobs/my-shop/status-counts
// @access  Private (Owner only)
const getStatusCounts = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const shopId = req.user.shopId;
    const rows = await Job.aggregate([
      { $match: { shopId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const response = {
      pending: 0,
      progress: 0,
      cancel: 0,
      complete: 0,
      checked_out: 0,
    };

    for (const row of rows) {
      if (row._id === "pending") response.pending = row.count;
      if (row._id === "progress") response.progress = row.count;
      if (row._id === "cancel") response.cancel = row.count;
      if (row._id === "complete") response.complete = row.count;
      if (row._id === "checked_out") response.checked_out = row.count;
    }

    return res.status(200).json(response);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete a job
// @route   DELETE /api/jobs/:id
// @access  Private (Owner only)
const deleteJob = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Ensure the job belongs to the user's shop
    if (job.shopId.toString() !== req.user.shopId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to delete this job" });
    }

    await job.deleteOne();
    res.status(200).json({ message: "Job removed" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get job QR link for customer tracking
// @route   GET /api/jobs/:id/qr
// @access  Private (Owner only)
const getJobQr = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.shopId.toString() !== req.user.shopId.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to access this job" });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    if (job.createdAt < cutoff) {
      return res.status(410).json({ message: "Job QR link expired" });
    }

    const payload = generateJobQrPayload(job._id.toString());
    const qrLink = buildQrLink(payload);

    res.status(200).json({ payload, qrLink });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createJob,
  getMyShopJobs,
  getShopReport,
  getJobById,
  updateJob,
  checkoutJob,
  getStatusCounts,
  deleteJob,
  getJobQr,
};
