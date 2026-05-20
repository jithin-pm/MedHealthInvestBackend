const Enquiry = require('../models/enquiryModel');

// Create a new enquiry
exports.createEnquiry = async (req, res) => {
  try {
    const { fullname, email, countryCode, phone, subject, message, enquiryType } = req.body;
    
    if (!fullname || !email || !countryCode || !phone || !subject || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newEnquiry = await Enquiry.create({
      fullname,
      email,
      countryCode,
      phone,
      subject,
      message,
      enquiryType: enquiryType || 'General'
    });

    res.status(201).json({
      message: "Enquiry submitted successfully",
      enquiry: newEnquiry
    });
  } catch (error) {
    console.error("Error creating enquiry:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all enquiries (for admin)
exports.getAllEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(enquiries);
  } catch (error) {
    console.error("Error fetching enquiries:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get enquiries filtered by type (General or Exclusive)
exports.getEnquiriesByType = async (req, res) => {
  try {
    const { type } = req.params;
    if (!['General', 'Exclusive'].includes(type)) {
      return res.status(400).json({ message: "Invalid enquiry type. Use 'General' or 'Exclusive'." });
    }
    const enquiries = await Enquiry.findAll({
      where: { enquiryType: type },
      order: [['createdAt', 'DESC']]
    });
    res.status(200).json(enquiries);
  } catch (error) {
    console.error("Error fetching enquiries by type:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

