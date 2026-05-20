const axios = require("axios");
const BankDetails = require("../models/bankDetailsModel");

exports.verifyBankAccount = async (req, res) => {
  try {
    const {
      userId,
      bank_account,
      ifsc,
      name,
      phone,
    } = req.body;

    if (!userId || !bank_account || !ifsc || !name || !phone) {
        return res.status(400).json({
            success: false,
            message: "All fields (userId, bank_account, ifsc, name, phone) are required"
        });
    }

    console.log("CLIENT ID:", process.env.CASHFREE_CLIENT_ID);
    console.log("VERIFICATION URL:", process.env.CASHFREE_VERIFICATION_URL);

    const response = await axios.post(
      `${process.env.CASHFREE_VERIFICATION_URL}/bank-account/sync`,
      {
        bank_account,
        ifsc,
        name,
        phone,
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

    const bankInfo = response.data;

    // Save to database if successful
    if (bankInfo.status === "SUCCESS" || bankInfo.data?.status === "SUCCESS") {
      const details = bankInfo.data || {};
      
      // Update or create bank details for this user
      await BankDetails.upsert({
        userId,
        accountHolderName: details.name_at_bank || name,
        bankAccount: bank_account,
        ifsc: ifsc,
        bankName: details.bank_name || "N/A",
        branch: details.branch || "N/A",
        city: details.city || "N/A",
        payoutPhone: phone,
        status: "VERIFIED",
        isVerified: true,
        referenceId: bankInfo.reference_id || "N/A"
      });
    }

    return res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("Cashfree Bank Verification Error:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      success: false,
      message: "Bank verification failed",
      error:
        error.response?.data || error.message,
    });
  }
};
