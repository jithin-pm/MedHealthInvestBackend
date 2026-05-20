const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { authMiddleware, adminMiddleware } = require("../middlewares/authMiddleware");

router.get("/stats", authMiddleware, adminMiddleware, dashboardController.getDashboardStats);

module.exports = router;
