const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);
router.post("/admin-login", authController.adminLogin);
router.post("/refresh", authController.refreshToken);
router.get("/all-users", authController.getAllUsers);
router.get("/verification-status/:userId", authController.getVerificationStatus);
router.post("/extend-session", authController.extendSession);

module.exports = router;
