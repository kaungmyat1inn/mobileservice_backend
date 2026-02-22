const { body, validationResult } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map((err) => extractedErrors.push({ [err.param]: err.msg }));

  return res.status(422).json({
    errors: extractedErrors,
  });
};

const registerValidation = [
  body("email").isEmail().withMessage("Please enter a valid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("isSuperAdmin")
    .optional()
    .isBoolean()
    .withMessage("isSuperAdmin must be a boolean"),
  body("shopId").optional().isMongoId().withMessage("Invalid Shop ID format"),
  validate,
];

const createJobValidation = [
  body("customerName").notEmpty().withMessage("Customer name is required"),
  body("customerPhone").notEmpty().withMessage("Customer phone is required"),
  body("deviceModel").notEmpty().withMessage("Device model is required"),
  body("issue").notEmpty().withMessage("Issue description is required"),
  body("partsCost")
    .optional()
    .isNumeric()
    .withMessage("Parts cost must be a number"),
  body("serviceFee")
    .optional()
    .isNumeric()
    .withMessage("Service fee must be a number"),
  body("reserves")
    .optional()
    .isNumeric()
    .withMessage("Reserves must be a number"),
  body("status")
    .optional()
    .isIn(["pending", "progress", "cancel", "complete", "checked_out"])
    .withMessage("Invalid job status"),
  validate,
];

const updateJobValidation = [
  body("customerName")
    .optional()
    .notEmpty()
    .withMessage("Customer name cannot be empty"),
  body("customerPhone")
    .optional()
    .notEmpty()
    .withMessage("Customer phone cannot be empty"),
  body("deviceModel")
    .optional()
    .notEmpty()
    .withMessage("Device model cannot be empty"),
  body("issue")
    .optional()
    .notEmpty()
    .withMessage("Issue description cannot be empty"),
  body("partsCost")
    .optional()
    .isNumeric()
    .withMessage("Parts cost must be a number"),
  body("serviceFee")
    .optional()
    .isNumeric()
    .withMessage("Service fee must be a number"),
  body("reserves")
    .optional()
    .isNumeric()
    .withMessage("Reserves must be a number"),
  body("status")
    .optional()
    .isIn(["pending", "progress", "cancel", "complete", "checked_out"])
    .withMessage("Invalid job status"),
  validate,
];

const createExpenseValidation = [
  body("title").notEmpty().withMessage("Expense title is required"),
  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isNumeric()
    .withMessage("Amount must be a number"),
  body("expenseDate")
    .optional()
    .isISO8601()
    .withMessage("Expense date must be a valid date"),
  validate,
];

const updateUserProfileValidation = [
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please enter a valid email address"),
  body("customRule")
    .optional()
    .isString(),
  validate,
];

const updateUserPasswordValidation = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
  validate,
];

const forgotPasswordValidation = [
  body("email").isEmail().withMessage("Please enter a valid email address"),
  validate,
];

const resetPasswordValidation = [
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  validate,
];

module.exports = {
  registerValidation,
  createJobValidation,
  updateJobValidation,
  createExpenseValidation,
  updateUserProfileValidation,
  updateUserPasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  validate, // Export generic validator for other uses if needed
};
