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
    let limit = parseInt(req.query.limit, 10);
    const query = { shopId: req.user.shopId };

    if (req.query.startDate && req.query.endDate) {
      query.expenseDate = {
        $gte: new Date(req.query.startDate),
        $lt: new Date(req.query.endDate),
      };
      // when filtering by explicit date range, default to bringing all records matching it
      if (!req.query.limit) limit = 1000;
    } else {
      if (!req.query.limit) limit = 50;
    }

    const expenses = await Expense.find(query)
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
