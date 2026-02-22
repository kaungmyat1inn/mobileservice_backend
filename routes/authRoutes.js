const express = require("express");
const router = express.Router();
const authController = require("../controllers/authControllers");

const { protect } = require("../middleware/authMiddleware"); // Import protect middleware
const upload = require("../middleware/uploadMiddleware");
const {
  registerValidation,
  updateUserProfileValidation,
  updateUserPasswordValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require("../middleware/validationMiddleware");

router.post("/register", registerValidation, authController.registerUser);
router.post("/login", authController.loginUser);
router.get("/profile", protect, authController.getUserProfile);
router.put(
  "/profile",
  protect, // Ensure protect is used here
  updateUserProfileValidation,
  authController.updateUserProfile,
);
router.put(
  "/profile/logo",
  protect,
  upload.single("logo"),
  authController.uploadShopLogo
);
router.put(
  "/password",
  protect, // Ensure protect is used here
  updateUserPasswordValidation,
  authController.updateUserPassword,
);
router.post(
  "/forgotpassword",
  forgotPasswordValidation,
  authController.forgotPassword,
);
router.put(
  "/resetpassword/:resettoken",
  resetPasswordValidation,
  authController.resetPassword,
);

module.exports = router;
