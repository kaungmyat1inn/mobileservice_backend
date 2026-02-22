const Expense = require("../models/Expense");

// @desc    Create an expense for the logged-in owner's shop
// @route   POST /api/expenses
// @access  Private (Owner only)
const createExpense = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const { title, amount, note, expenseDate } = req.body;

    const expense = await Expense.create({
      shopId: req.user.shopId,
      title,
      amount: Number(amount),
      note: note || "",
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Get expenses for the logged-in owner's shop
// @route   GET /api/expenses/my-shop
// @access  Private (Owner only)
const getMyShopExpenses = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const expenses = await Expense.find({ shopId: req.user.shopId })
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(limit);

    res.status(200).json({ expenses });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private (Owner only)
const deleteExpense = async (req, res) => {
  if (!req.user || !req.user.shopId) {
    return res
      .status(401)
      .json({ message: "Not authorized, no shop found for user" });
  }

  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (expense.shopId.toString() !== req.user.shopId.toString()) {
      return res.status(401).json({
        message: "Not authorized to delete this expense",
      });
    }

    await expense.deleteOne();
    res.status(200).json({ message: "Expense removed" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createExpense,
  getMyShopExpenses,
  deleteExpense,
};
