const express = require('express');
const router = express.Router();
const aadharController = require('../controllers/aadharController');

router.post('/verify-aadhar', aadharController.verifyAadharCard);

module.exports = router;
