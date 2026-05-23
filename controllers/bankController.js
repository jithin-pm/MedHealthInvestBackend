const axios = require("axios");
const BankDetails = require("../models/bankDetailsModel");
const User = require("../models/userModel");

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
    const isSuccess = 
      bankInfo.status === "SUCCESS" || 
      bankInfo.account_status === "VALID" || 
      bankInfo.data?.status === "SUCCESS";

    if (isSuccess) {
      const details = bankInfo.data || bankInfo || {};
      const dbPayload = {
        userId,
        accountHolderName: details.name_at_bank || details.nameAtBank || name,
        bankAccount: bank_account,
        ifsc: ifsc,
        bankName: details.bank_name || details.bankName || "N/A",
        branch: details.branch || "N/A",
        city: details.city || "N/A",
        payoutPhone: phone,
        status: "verified",
        isVerified: true,
        referenceId: bankInfo.reference_id || bankInfo.refId || "N/A",
        nameMatchScore: details.name_match_score || "100.00",
        ifscDetails: details.ifsc_details || details.ifscDetails || null,
        verifiedAt: new Date()
      };

      const existingRecord = await BankDetails.findOne({ where: { userId } });
      if (existingRecord) {
        await existingRecord.update(dbPayload);
      } else {
        await BankDetails.create(dbPayload);
      }
      // Also update the User record with bank details and set isBankVerified to 1
      await User.update(
        {
          bankName: details.bank_name || details.bankName || "N/A",
          accountNumber: bank_account,
          ifscCode: ifsc,
          accountHolderName: details.name_at_bank || details.nameAtBank || name,
          isBankVerified: 1,
        },
        {
          where: { id: userId },
        }
      );
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
