const axios = require("axios");
const PanDetails = require("../models/panDetailsModel");

exports.verifyPanCard = async (req, res) => {
  try {
    const {
      userId,
      panNumber,
      fullName,
      dob
    } = req.body;

    if (!userId || !panNumber || !fullName || !dob) {
        return res.status(400).json({
            success: false,
            message: "All fields (userId, panNumber, fullName, dob) are required"
        });
    }

    console.log("CLIENT ID:", process.env.CASHFREE_CLIENT_ID);
    console.log("VERIFICATION URL:", process.env.CASHFREE_VERIFICATION_URL);

    const response = await axios.post(
      `${process.env.CASHFREE_VERIFICATION_URL}/pan`,
      {
        pan: panNumber,
        name: fullName,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-client-id": process.env.CASHFREE_CLIENT_ID,
          "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
          "x-api-version": "2022-09-01",
        },
      }
    );

    const panInfo = response.data;

    // Save to database if successful
    if (panInfo.status === "SUCCESS" || panInfo.valid) {
      await PanDetails.upsert({
        userId,
        fullName: panInfo.name || fullName,
        panNumber: panNumber,
        dob: dob,
        status: "VERIFIED",
        isVerified: true,
        referenceId: panInfo.reference_id || "N/A"
      });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Cashfree PAN Verification Error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      success: false,
      message: "PAN verification failed",
      error:
        error.response?.data || error.message,
    });
  }
};
