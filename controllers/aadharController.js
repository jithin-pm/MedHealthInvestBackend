const AadharDetails = require("../models/aadharDetailsModel");
const User = require("../models/userModel");

exports.verifyAadharCard = async (req, res) => {
  try {
    const { userId, aadharNumber, fullName } = req.body;

    if (!userId || !aadharNumber || !fullName) {
        return res.status(400).json({
            success: false,
            message: "All fields (userId, aadharNumber, fullName) are required"
        });
    }

    // Mock Verification: Accept any 12-digit number for now
    if (!/^\d{12}$/.test(aadharNumber)) {
        return res.status(400).json({
            success: false,
            message: "Invalid Aadhaar number. It must be exactly 12 digits."
        });
    }

    const dbPayload = {
      userId,
      fullName,
      aadharNumber,
      status: "verified",
      isVerified: true,
      referenceId: "MOCK_AADHAAR_" + Date.now(),
      verifiedAt: new Date()
    };

    const existingRecord = await AadharDetails.findOne({ where: { userId } });
    if (existingRecord) {
      await existingRecord.update(dbPayload);
    } else {
      await AadharDetails.create(dbPayload);
    }

    // Update isAadharVerified to 1 in the users table
    await User.update(
      { isAadharVerified: 1 },
      { where: { id: userId } }
    );

    return res.status(200).json({
      success: true,
      message: "Aadhaar verified successfully",
      data: dbPayload
    });
  } catch (error) {
    console.error("Aadhaar Verification Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Aadhaar verification failed",
      error: error.message,
    });
  }
};
