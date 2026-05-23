const Razorpay = require("razorpay");
const crypto = require("crypto");
const Project = require("../models/projectModel");
const Investment = require("../models/investmentModel");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const sequelize = require("../config/db");
const sendEmail = require("../utils/sendEmail");
const { getProjectOngoingTemplate } = require("../utils/emailTemplates");
const BankDetails = require("../models/bankDetailsModel");
const PanDetails = require("../models/panDetailsModel");


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const paymentController = {
  /**
   * POST /api/payment/create-order
   * Body: { amount, projectId, userId }
   * Creates a Razorpay order and returns the order details + key_id to the client.
   */
  createOrder: async (req, res) => {
    try {
      const { amount, projectId, userId } = req.body;

      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "A valid investment amount is required." });
      }
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required." });
      }

      // Check remaining balance
      const project = await Project.findByPk(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found." });
      }

      const remainingBalance = parseFloat(project.targetAmount) - parseFloat(project.collectedAmount || 0);
      if (parseFloat(amount) > remainingBalance) {
        return res.status(400).json({ 
          message: `Investment exceeds project capacity. Maximum allowable: ₹${remainingBalance.toLocaleString()}` 
        });
      }

      // Razorpay expects amount in paise (1 INR = 100 paise)
      const amountInPaise = Math.round(parseFloat(amount) * 100);

      const options = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `receipt_proj_${projectId}_user_${userId}_${Date.now()}`,
        notes: {
          projectId: String(projectId),
          userId: String(userId),
        },
      };

      console.log("Creating Razorpay Order with options:", options);
      const order = await razorpay.orders.create(options);

      return res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error) {
      console.error("Error creating Razorpay order:", error);
      return res.status(500).json({
        message: "Failed to create payment order.",
        error: error.message,
        details: error
      });
    }
  },

  /**
   * POST /api/payment/verify
   * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, projectId, userId, amount }
   * Verifies the Razorpay payment signature and records the transaction.
   */
  verifyPayment: async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        projectId,
        userId,
        amount,
      } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ message: "Payment verification data is incomplete." });
      }

      console.log("Verifying Payment - Request Body:", req.body);
      
      // Compute the expected signature
      const hmacSource = `${razorpay_order_id}|${razorpay_payment_id}`;
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(hmacSource)
        .digest("hex");

      console.log("Generated Signature:", generatedSignature);
      console.log("Received Signature:", razorpay_signature);

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ 
          success: false, 
          message: "Payment signature verification failed.",
          debug: { generated: generatedSignature, received: razorpay_signature }
        });
      }


      // ✅ Payment is legitimate. Update the project's collected amount within a transaction for safety.
      const result = await sequelize.transaction(async (t) => {
        const project = await Project.findByPk(projectId, { transaction: t, lock: true });
        if (project) {
          const newAmount = parseFloat(project.collectedAmount || 0) + parseFloat(amount);
          
          const updates = { collectedAmount: newAmount };
          // If target is reached or exceeded, set status to ONGOING
          if (newAmount >= parseFloat(project.targetAmount) && project.status !== 'ONGOING') {
            updates.status = 'ONGOING';
            const startDate = new Date();
            updates.ongoingStartDate = startDate;
            const durationMonths = parseInt(project.duration);
            updates.completionDate = new Date(startDate.getTime() + (durationMonths * 30 * 24 * 60 * 60 * 1000));
          }

          const oldStatus = project.status;
          await project.update(updates, { transaction: t });

          // Record the individual investment
          const investment = await Investment.create({
            projectId,
            userId,
            amount,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            status: 'SUCCESS'
          }, { transaction: t });

          // Record in the global Transaction Ledger
          await Transaction.create({
            userId,
            projectId,
            investmentId: investment.id,
            amount,
            transactionId: razorpay_payment_id,
            type: 'INVESTMENT',
            status: 'SUCCESS',
            description: `Investment in ${project.projectName}`
          }, { transaction: t });

          return { newAmount, status: updates.status || project.status, wasAlreadyOngoing: oldStatus === 'ONGOING' };
        }
        return null;
      });

      if (result !== null) {
        console.log(`Project ${projectId} updated: Collected ${result.newAmount}, Status ${result.status}`);
        
        // Emit real-time update to all connected clients
        if (req.io) {
          req.io.emit("project_updated", { 
            projectId: parseInt(projectId), 
            collectedAmount: result.newAmount,
            status: result.status
          });
        }

        // Send Project Ongoing Emails to Investors
        if (result.status === 'ONGOING' && !result.wasAlreadyOngoing) {
          (async () => {
            try {
              const project = await Project.findByPk(projectId);
              const investments = await Investment.findAll({
                where: { projectId: Number(projectId), status: 'SUCCESS' },
                include: [{ model: User, as: 'investor', attributes: ['email', 'fullName'] }]
              });
              console.log(`[DEBUG] Found ${investments.length} successful investments`);

              for (const inv of investments) {
                if (inv.investor && inv.investor.email) {
                  const html = getProjectOngoingTemplate(project, inv.investor);
                  const subject = `Project Ongoing: ${project.projectName} - Funding Completed!`;
                  console.log(`[DEBUG] Attempting to send email to ${inv.investor.email}`);
                  sendEmail({ to: inv.investor.email, subject, html })
                    .then(() => console.log(`[DEBUG] Email sent successfully to ${inv.investor.email}`))
                    .catch(err => console.error(`[ERROR] Failed to send email to ${inv.investor.email}:`, err));
                }
              }
            } catch (error) {
              console.error("Failed to send ongoing project emails:", error);
            }
          })();
        }
      }


      return res.status(200).json({
        success: true,
        message: "Payment verified successfully and project updated.",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      });
    } catch (error) {
      console.error("Error verifying Razorpay payment:", error);
      return res.status(500).json({
        message: "Internal server error during payment verification.",
        error: error.message,
      });
    }
  },
  
  /**
   * GET /api/payment/investors/:projectId
   * Returns a list of users who invested in a specific project.
   */
  getInvestorsByProject: async (req, res) => {
    try {
      const { projectId } = req.params;
      const investments = await Investment.findAll({
        where: { projectId, status: 'SUCCESS' },
        include: [
          {
            model: User,
            as: 'investor',
            attributes: ['id', 'fullName', 'email', 'mobileNumber']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      
      return res.status(200).json({ success: true, investments });
    } catch (error) {
      console.error("Error fetching project investors:", error);
      return res.status(500).json({ message: "Failed to fetch investors." });
    }
  },

  /**
   * GET /api/payment/user-investments/:userId
   * Returns a list of investments made by a specific user.
   */
  getInvestmentsByUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const investments = await Investment.findAll({
        where: { userId, status: 'SUCCESS' },
        include: [
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'projectName', 'status', 'roi', 'duration', 'targetAmount', 'collectedAmount', 'projectType', 'projectCategory']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      
      return res.status(200).json({ success: true, investments });
    } catch (error) {
      console.error("Error fetching user investments:", error);
      return res.status(500).json({ message: "Failed to fetch investment history." });
    }
  },

  /**
   * GET /api/payment/user-details/:userId
   * Returns user bank and PAN details (dummy fallback if missing)
   */
  getUserFinancialDetails: async (req, res) => {
    try {
      const { userId } = req.params;
      
      const bankDetails = await BankDetails.findOne({ where: { userId } });
      const panDetails = await PanDetails.findOne({ where: { userId } });
      
      return res.status(200).json({ 
        bank: bankDetails ? {
          accountNumber: bankDetails.bankAccount,
          ifsc: bankDetails.ifsc,
          bankName: bankDetails.bankName,
          accountHolderName: bankDetails.accountHolderName,
          branch: bankDetails.branch,
          city: bankDetails.city,
          payoutPhone: bankDetails.payoutPhone
        } : { 
          accountNumber: 'DUMMY123456789', 
          ifsc: 'DUMMY000123', 
          bankName: 'Standard Test Bank',
          accountHolderName: 'Standard Test Holder',
          branch: 'Main Branch',
          city: 'Mumbai',
          payoutPhone: '9876543210'
        },
        pan: panDetails ? {
          panNumber: panDetails.panNumber,
          fullName: panDetails.fullName,
          dob: panDetails.dob
        } : { 
          panNumber: 'ABCDE1234F',
          fullName: 'Standard Test Holder',
          dob: '1995-01-01'
        }
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      return res.status(200).json({ 
        bank: { 
          accountNumber: 'DUMMY123456789', 
          ifsc: 'DUMMY000123', 
          bankName: 'Standard Test Bank',
          accountHolderName: 'Standard Test Holder',
          branch: 'Main Branch',
          city: 'Mumbai',
          payoutPhone: '9876543210'
        },
        pan: { 
          panNumber: 'ABCDE1234F',
          fullName: 'Standard Test Holder',
          dob: '1995-01-01'
        }
      });
    }
  },

  /**
   * POST /api/payment/admin-record-investment
   * Body: { projectId, userId, amount }
   * Allows admin to manually record an investment (e.g. for exclusive projects)
   */
  adminRecordInvestment: async (req, res) => {
    try {
      const { projectId, userId, amount } = req.body;

      if (!projectId || !userId || !amount) {
        return res.status(400).json({ message: "Project ID, User ID, and Amount are required." });
      }

      const result = await sequelize.transaction(async (t) => {
        const project = await Project.findByPk(projectId, { transaction: t, lock: true });
        if (!project) throw new Error("Project not found");

        const newAmount = parseFloat(project.collectedAmount || 0) + parseFloat(amount);
        const updates = { collectedAmount: newAmount };

        // If target is reached or exceeded, set status to ONGOING
        if (newAmount >= parseFloat(project.targetAmount) && project.status !== 'ONGOING') {
          updates.status = 'ONGOING';
          const startDate = new Date();
          updates.ongoingStartDate = startDate;
          const durationMonths = parseInt(project.duration);
          updates.completionDate = new Date(startDate.getTime() + (durationMonths * 30 * 24 * 60 * 60 * 1000));
        }

        const oldStatus = project.status;
        await project.update(updates, { transaction: t });

        // Record the individual investment
        const investment = await Investment.create({
          projectId,
          userId,
          amount,
          paymentId: `ADMIN_MANUAL_${Date.now()}`,
          orderId: `ADMIN_ORDER_${Date.now()}`,
          status: 'SUCCESS'
        }, { transaction: t });

        // Record in the global Transaction Ledger
        await Transaction.create({
          userId,
          projectId,
          investmentId: investment.id,
          amount,
          transactionId: investment.paymentId,
          type: 'INVESTMENT',
          status: 'SUCCESS',
          description: `Manual Admin Investment in ${project.projectName}`
        }, { transaction: t });

        return { newAmount, status: updates.status || project.status, wasAlreadyOngoing: oldStatus === 'ONGOING' };
      });

        if (req.io) {
          req.io.emit("project_updated", { 
            projectId: parseInt(projectId), 
            collectedAmount: result.newAmount,
            status: result.status
          });
        }

        // Send Project Ongoing Emails to Investors
        if (result.status === 'ONGOING' && !result.wasAlreadyOngoing) {
          (async () => {
            try {
              const project = await Project.findByPk(projectId);
              const investments = await Investment.findAll({
                where: { projectId: Number(projectId), status: 'SUCCESS' },
                include: [{ model: User, as: 'investor', attributes: ['email', 'fullName'] }]
              });
              console.log(`[DEBUG] Found ${investments.length} successful investments`);

              for (const inv of investments) {
                if (inv.investor && inv.investor.email) {
                  const html = getProjectOngoingTemplate(project, inv.investor);
                  const subject = `Project Ongoing: ${project.projectName} - Funding Completed!`;
                  console.log(`[DEBUG] Attempting to send email to ${inv.investor.email}`);
                  sendEmail({ to: inv.investor.email, subject, html })
                    .then(() => console.log(`[DEBUG] Email sent successfully to ${inv.investor.email}`))
                    .catch(err => console.error(`[ERROR] Failed to send email to ${inv.investor.email}:`, err));
                }
              }
            } catch (error) {
              console.error("Failed to send ongoing project emails:", error);
            }
          })();
        }



      return res.status(200).json({
        success: true,
        message: "Manual investment recorded successfully.",
        collectedAmount: result.newAmount,
        status: result.status
      });
    } catch (error) {
      console.error("Error recording manual investment:", error);
      return res.status(500).json({ 
        message: "Failed to record manual investment.",
        error: error.message 
      });
    }
  },

  /**
   * POST /api/payment/record-payback/:investmentId
   * Updates an investment with payback proof and marks as PAID
   */
  recordPayback: async (req, res) => {
    try {
      const { investmentId } = req.params;
      const paybackProof = req.file ? req.file.path.replace(/\\/g, '/') : null;

      const investment = await Investment.findByPk(investmentId, {
        include: [{ model: Project, as: 'project' }]
      });
      
      if (!investment) {
        return res.status(404).json({ message: "Investment record not found." });
      }

      await investment.update({
        paybackStatus: 'PAID',
        paybackProof: paybackProof
      });

      // Record in the global Transaction Ledger
      const isRefund = investment.project?.status === 'EXPIRED';
      const type = isRefund ? 'REFUND' : 'PAYOUT';
      
      // Calculate final settlement amount
      let settlementAmount = Number(investment.amount);
      if (type === 'PAYOUT') {
        const roi = Number(investment.project?.roi || 0);
        const duration = Number(investment.project?.duration || 1);
        const yieldAmount = (settlementAmount * roi * duration) / 100;
        settlementAmount += yieldAmount;
      }

      await Transaction.create({
        userId: investment.userId,
        projectId: investment.projectId,
        investmentId: investment.id,
        amount: settlementAmount,
        transactionId: `SETTLE_${investment.id}_${Date.now()}`,
        type: type,
        status: 'SUCCESS',
        description: `${type === 'REFUND' ? 'Capital Refund' : 'Investment Payout'} for ${investment.project?.projectName || 'Project'}`
      });

      return res.status(200).json({ 
        success: true, 
        message: `${type} recorded successfully.`,
        investment 
      });
    } catch (error) {
      console.error("Error recording payback:", error);
      return res.status(500).json({ message: "Internal server error while recording payback." });
    }
  },

  /**
   * GET /api/payment/all
   * Returns all successful investments across all projects and users.
   * Typically used for Admin Transaction History.
   */
  getAllInvestments: async (req, res) => {
    try {
      const transactions = await Transaction.findAll({
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['fullName', 'email', 'mobileNumber']
          },
          {
            model: Project,
            as: 'project',
            attributes: ['projectName', 'projectType', 'projectCategory', 'status']
          }
        ],
        order: [['transactionDate', 'DESC']]
      });

      return res.status(200).json({ success: true, transactions });
    } catch (error) {
      console.error("Error fetching all transactions:", error);
      return res.status(500).json({ message: "Failed to fetch transaction history." });
    }
  }
};

module.exports = paymentController;
