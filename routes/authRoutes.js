const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.post("/register", authController.registerUser);
router.post("/verify-registration-otp", authController.verifyRegistrationOtp);
router.post("/login", authController.loginUser);
router.post("/verify-login-otp", authController.verifyLoginOtp);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/admin-login", authController.adminLogin);
router.post("/refresh", authController.refreshToken);
router.post("/admin-refresh", authController.adminRefreshToken);
router.get("/all-users", authController.getAllUsers);
router.post("/unblock-user/:userId", authController.unblockUser);
router.post("/toggle-status/:userId", authController.toggleUserStatus);
router.put("/update-profile", authMiddleware, authController.updateProfile);
router.put("/admin-update-user/:userId", authController.adminUpdateUser);
router.get("/verification-status/:userId", authController.getVerificationStatus);
router.post("/extend-session", authController.extendSession);

router.get("/user-activity-logs/:userId", authController.getUserActivityLogs);

module.exports = router;
