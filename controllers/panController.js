const axios = require("axios");
const PanDetails = require("../models/panDetailsModel");
const User = require("../models/userModel");

exports.verifyPanCard = async (req, res) => {
  try {
    const {
      userId,
      panNumber,
      fullName
    } = req.body;

    if (!userId || !panNumber || !fullName) {
        return res.status(400).json({
            success: false,
            message: "All fields (userId, panNumber, fullName) are required"
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

    if (panInfo.valid === true) {
      const dbPayload = {
        userId,
        fullName: panInfo.name || fullName,
        panNumber: panNumber,
        status: "verified",
        isVerified: true,
        referenceId: panInfo.reference_id || "N/A",
        verifiedAt: new Date()
      };

      const existingRecord = await PanDetails.findOne({ where: { userId } });
      if (existingRecord) {
        await existingRecord.update(dbPayload);
      } else {
        await PanDetails.create(dbPayload);
      }

      // Update isPanVerified to 1 in the users table
      await User.update(
        { isPanVerified: 1 },
        { where: { id: userId } }
      );
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
