const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { protect } = require("../middleware/authMiddleware");

// Staff CRUD routes
router.post("/", protect, staffController.createStaff);
router.get("/my-shop", protect, staffController.getStaffByShop);
router.get("/my-shop/performance", protect, staffController.getStaffPerformance);
router.get("/:id", protect, staffController.getStaffById);
router.put("/:id", protect, staffController.updateStaff);
router.delete("/:id", protect, staffController.deleteStaff);

module.exports = router;

