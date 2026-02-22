const express = require("express");
const router = express.Router();
const jobController = require("../controllers/jobControllers");
const { protect } = require("../middleware/authMiddleware");
const {
  createJobValidation,
  updateJobValidation,
} = require("../middleware/validationMiddleware");

router.post("/", protect, createJobValidation, jobController.createJob);
router.get("/my-shop", protect, jobController.getMyShopJobs); // ဆိုင်ပိုင်ရှင်ရဲ့ အလုပ်စာရင်းကို ကြည့်ရန်
router.get("/my-shop/report", protect, jobController.getShopReport); // ဆိုင်ပိုင်ရှင်ရဲ့ report ကြည့်ရန်
router.get("/my-shop/status-counts", protect, jobController.getStatusCounts);
router.put("/:id/checkout", protect, jobController.checkoutJob);
router.get("/:id/qr", protect, jobController.getJobQr);
router.get("/:id", protect, jobController.getJobById); // New route for single job
router.put("/:id", protect, updateJobValidation, jobController.updateJob); // New route for updating job
router.delete("/:id", protect, jobController.deleteJob); // New route for deleting job

module.exports = router;
