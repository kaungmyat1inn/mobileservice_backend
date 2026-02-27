const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminControllers");
const subscriptionPlanController = require("../controllers/subscriptionPlanController");
const { protect, checkSuperAdmin } = require("../middleware/authMiddleware");

// /api/admin/shops
router.post("/shops", protect, checkSuperAdmin, adminController.createShop);
router.get("/shops", protect, checkSuperAdmin, adminController.getAllShops);
router.get("/users", protect, checkSuperAdmin, adminController.getAllUsers);
router.get("/staff", protect, checkSuperAdmin, adminController.getAllStaff);
router.get("/jobs", protect, checkSuperAdmin, adminController.getAllJobs);
router.put(
  "/shops/:id",
  protect,
  checkSuperAdmin,
  adminController.updateShopStatus,
);
router.put(
  "/shops/:id/password",
  protect,
  checkSuperAdmin,
  adminController.updateShopPassword,
);
router.put(
  "/shops/:id/pin",
  protect,
  checkSuperAdmin,
  adminController.updateShopPin,
);
router.get(
  "/shops/:id/invoices/latest",
  protect,
  checkSuperAdmin,
  adminController.getLatestShopInvoice,
);
router.post(
  "/shops/:id/extend",
  protect,
  checkSuperAdmin,
  adminController.extendShopSubscription,
);
router.patch(
  "/shops/:id/limit",
  protect,
  checkSuperAdmin,
  adminController.updateShopStaffLimit,
);
router.post(
  "/shops/:id/owner-qr",
  protect,
  checkSuperAdmin,
  adminController.generateOwnerQr,
);
router.delete(
  "/shops/:id",
  protect,
  checkSuperAdmin,
  adminController.deleteShop,
);

// /api/admin/financial-stats
router.get(
  "/financial-stats",
  protect,
  checkSuperAdmin,
  adminController.getFinancialStats,
);

// /api/admin/subscription-plans
router.get(
  "/subscription-plans",
  protect,
  checkSuperAdmin,
  subscriptionPlanController.getAllPlans,
);
router.get(
  "/subscription-plans/active",
  subscriptionPlanController.getActivePlans,
);
router.post(
  "/subscription-plans",
  protect,
  checkSuperAdmin,
  subscriptionPlanController.createPlan,
);
router.get(
  "/subscription-plans/:id",
  protect,
  checkSuperAdmin,
  subscriptionPlanController.getPlanById,
);
router.put(
  "/subscription-plans/:id",
  protect,
  checkSuperAdmin,
  subscriptionPlanController.updatePlan,
);
router.delete(
  "/subscription-plans/:id",
  protect,
  checkSuperAdmin,
  subscriptionPlanController.deletePlan,
);

module.exports = router;
