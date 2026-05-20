const express = require("express");
const router = express.Router();
const {
  verifyBankAccount,
} = require("../controllers/bankController");

router.post(
  "/verify-bank",
  verifyBankAccount
);

module.exports = router;
