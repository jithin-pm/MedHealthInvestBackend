const express = require("express");
const router = express.Router();
const { verifyPanCard } = require("../controllers/panController");

router.post("/verify-pan", verifyPanCard);

module.exports = router;
