const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');

// POST /api/enquiry - Create a new enquiry
router.post('/', enquiryController.createEnquiry);

// GET /api/enquiry - Get all enquiries (for admin)
router.get('/', enquiryController.getAllEnquiries);

// GET /api/enquiry/type/:type - Get enquiries by type (General or Exclusive)
router.get('/type/:type', enquiryController.getEnquiriesByType);

module.exports = router;
