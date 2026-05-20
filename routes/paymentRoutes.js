const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// POST /api/payment/create-order  — creates a Razorpay order
router.post("/create-order", authMiddleware, paymentController.createOrder);

// POST /api/payment/verify  — verifies the payment signature after checkout
router.post("/verify", authMiddleware, paymentController.verifyPayment);

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// GET /api/payment/all — gets all successful investments (Admin)
router.get("/all", authMiddleware, paymentController.getAllInvestments);

// GET /api/payment/investors/:projectId — gets investors for a project
router.get("/investors/:projectId", authMiddleware, paymentController.getInvestorsByProject);

// GET /api/payment/user-investments/:userId — gets investments for a user
router.get("/user-investments/:userId", authMiddleware, paymentController.getInvestmentsByUser);

// GET /api/payment/user-details/:userId — gets user bank/pan info
router.get("/user-details/:userId", authMiddleware, paymentController.getUserFinancialDetails);

// POST /api/payment/record-payback/:investmentId — uploads screenshot and marks as PAID
router.post("/record-payback/:investmentId", authMiddleware, upload.single("paybackProof"), paymentController.recordPayback);

// POST /api/payment/admin-record-investment - Manual record by admin
router.post("/admin-record-investment", authMiddleware, paymentController.adminRecordInvestment);

module.exports = router;
