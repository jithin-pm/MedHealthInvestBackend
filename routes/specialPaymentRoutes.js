const express = require("express");
const router = express.Router();
const specialPaymentController = require("../controllers/specialPaymentController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Route for getting all investments for a special project
router.get("/investors/:projectId", specialPaymentController.getInvestorsByProject);

// Route for getting all special investments by user
router.get("/user-investments/:userId", specialPaymentController.getInvestmentsByUser);

// Route for getting payout schedule for a special investment
router.get("/payout-schedule/:investmentId", specialPaymentController.getPayoutSchedule);

// Route for fetching the ledger history for a special investment
router.get("/ledger-history/:investmentId", specialPaymentController.getLedgerHistory);

// Route for recording a monthly payback manually by admin
router.post(
  "/record-monthly-payback/:investmentId",
  upload.single('paybackProof'),
  specialPaymentController.recordMonthlyPayback
);

// Manual trigger for testing the cron job
router.post("/trigger-monthly-interest", async (req, res) => {
    const { runMonthlyInterestAccrual } = require('../utils/cronJobs');
    await runMonthlyInterestAccrual();
    res.json({ message: 'Cron job executed manually.' });
});

module.exports = router;
