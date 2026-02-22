const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expenseControllers");
const { protect } = require("../middleware/authMiddleware");
const { createExpenseValidation } = require("../middleware/validationMiddleware");

router.post("/", protect, createExpenseValidation, expenseController.createExpense);
router.get("/my-shop", protect, expenseController.getMyShopExpenses);
router.delete("/:id", protect, expenseController.deleteExpense);

module.exports = router;
