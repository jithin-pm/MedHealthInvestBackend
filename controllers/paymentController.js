const Razorpay = require("razorpay");
const crypto = require("crypto");
const Project = require("../models/projectModel");
const Investment = require("../models/investmentModel");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const sequelize = require("../config/db");
const sendEmail = require("../utils/sendEmail");
const { getProjectOngoingTemplate, getInvestmentSuccessTemplate } = require("../utils/emailTemplates");
const BankDetails = require("../models/bankDetailsModel");
const PanDetails = require("../models/panDetailsModel");
const SpecialProject = require("../models/specialProjectModel");
const SpecialInvestment = require("../models/specialInvestmentModel");
const SpecialPayout = require("../models/specialPayoutModel");


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

        // Send individual success email
        (async () => {
          try {
            const user = await User.findByPk(userId);
            const project = await Project.findByPk(projectId);
            if (user && user.email) {
              const html = getInvestmentSuccessTemplate(project, user, amount);
              const subject = `Investment Successful - ${project.projectName}`;
              sendEmail({ to: user.email, subject, html })
                .then(() => console.log(`[DEBUG] Investment success email sent to ${user.email}`))
                .catch(err => console.error(`[ERROR] Failed to send investment success email to ${user.email}:`, err));
            }
          } catch (error) {
            console.error("Failed to send individual investment success email:", error);
          }
        })();

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
            attributes: ['id', 'customUserId', 'fullName', 'email', 'mobileNumber']
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

        // Send individual success email
        (async () => {
          try {
            const user = await User.findByPk(userId);
            const project = await Project.findByPk(projectId);
            if (user && user.email) {
              const html = getInvestmentSuccessTemplate(project, user, amount);
              const subject = `Investment Successful - ${project.projectName}`;
              sendEmail({ to: user.email, subject, html })
                .then(() => console.log(`[DEBUG] Investment success email sent to ${user.email}`))
                .catch(err => console.error(`[ERROR] Failed to send investment success email to ${user.email}:`, err));
            }
          } catch (error) {
            console.error("Failed to send individual investment success email:", error);
          }
        })();

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

      const now = new Date();
      const dateStr = String(now.getDate()).padStart(2, '0') + String(now.getMonth() + 1).padStart(2, '0') + now.getFullYear();
      let customTxId;
      if (type === 'REFUND') {
        customTxId = `REF-${dateStr}-${String(investment.id).padStart(2, '0')}`;
      } else if (investment.project?.projectType === 'Exclusive') {
        customTxId = `EXP-PAY-${dateStr}-${String(investment.id).padStart(2, '0')}`;
      } else {
        customTxId = `STD-${dateStr}-${String(investment.id).padStart(2, '0')}`;
      }

      await Transaction.create({
        userId: investment.userId,
        projectId: investment.projectId,
        investmentId: investment.id,
        amount: settlementAmount,
        transactionId: customTxId,
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
            attributes: ['id', 'customUserId', 'fullName', 'email', 'mobileNumber']
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'projectName', 'projectType', 'projectCategory', 'status', 'duration']
          },
          {
            model: Investment,
            as: 'investment',
            attributes: ['paybackProof']
          }
        ],
        order: [['transactionDate', 'DESC']]
      });

      const mappedTransactions = [];

      for (const t of transactions) {
        let plain = t.get({ plain: true });
        plain.paybackProof = plain.investment?.paybackProof || null;
        
        // Resolve missing project details for Special Project Payouts
        if (plain.transactionId && plain.transactionId.startsWith('SP_PAYOUT_')) {
           const payoutId = plain.transactionId.split('_')[2];
           if (payoutId) {
             const specialPayout = await SpecialPayout.findByPk(payoutId, {
                include: [{
                  model: SpecialInvestment, as: 'investment',
                  include: [{ model: SpecialProject, as: 'project' }]
                }]
             });
             if (specialPayout) {
                 if (specialPayout.investment && specialPayout.investment.project) {
                     plain.project = {
                        projectName: specialPayout.investment.project.projectName,
                        projectType: 'Special'
                     };
                 }
                 plain.paybackProof = specialPayout.paybackProof;

                 const roiPaid = parseFloat(specialPayout.roiPaid || 0);
                 const capPaid = parseFloat(specialPayout.capitalPaid || 0);
                 if (roiPaid > 0 && capPaid > 0) {
                     plain.payoutCategory = 'INTEREST & CAPITAL RETURNED';
                 } else if (roiPaid > 0) {
                     plain.payoutCategory = 'INTEREST RETURNED';
                 } else if (capPaid > 0) {
                     plain.payoutCategory = 'CAPITAL RETURNED';
                 }
             }
           }
        }
        
        if (plain.transactionId && plain.transactionId.startsWith('SP_PAYOUT_')) {
          if (!plain.project) {
              plain.project = {
                  projectName: 'Special Project',
                  projectType: 'Special'
              };
          }
          if (!plain.payoutCategory) {
              if (plain.description && plain.description.toLowerCase().includes('interest')) {
                  plain.payoutCategory = 'INTEREST RETURNED';
              } else if (plain.description && plain.description.toLowerCase().includes('capital')) {
                  plain.payoutCategory = 'CAPITAL RETURNED';
              }
          }
        }
        mappedTransactions.push(plain);
      }

      // 2. Fetch missing Special Project Investments
      const specialInvestments = await SpecialInvestment.findAll({
         where: { status: 'SUCCESS' },
         include: [
            {
              model: User,
              as: 'investor',
              attributes: ['id', 'customUserId', 'fullName', 'email', 'mobileNumber']
            },
            {
              model: SpecialProject,
              as: 'project',
              attributes: ['id', 'projectName', 'projectCategory', 'status']
            }
         ]
      });

      for (const spInv of specialInvestments) {
         mappedTransactions.push({
             id: `sp_inv_${spInv.id}`,
             userId: spInv.userId,
             projectId: spInv.specialProjectId,
             investmentId: spInv.id,
             amount: spInv.amountInvested,
             transactionId: spInv.paymentId,
             type: 'INVESTMENT',
             status: 'SUCCESS',
             description: `Special Project Investment: ${parseFloat(spInv.amountInvested).toFixed(2)}`,
             transactionDate: spInv.created_at || spInv.createdAt,
             user: spInv.investor ? { 
                 id: spInv.investor.id, 
                 customUserId: spInv.investor.customUserId, 
                 fullName: spInv.investor.fullName, 
                 email: spInv.investor.email,
                 mobileNumber: spInv.investor.mobileNumber
             } : null,
             project: spInv.project ? { 
                 id: spInv.project.id,
                 projectName: spInv.project.projectName, 
                 projectCategory: spInv.project.projectCategory,
                 status: spInv.project.status,
                 projectType: 'Special' 
             } : null,
             paybackProof: null
         });
      }

      // 3. Format displayTransactionId matching user side (SPL-DDMMYYYY-XX / EXP-DDMMYYYY-XX)
      const formatDateDDMMYYYY = (dateVal) => {
        const d = dateVal ? new Date(dateVal) : new Date();
        if (isNaN(d.getTime())) {
          const now = new Date();
          return String(now.getDate()).padStart(2, '0') + String(now.getMonth() + 1).padStart(2, '0') + now.getFullYear();
        }
        return String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + d.getFullYear();
      };

      for (const tx of mappedTransactions) {
        const txDate = tx.transactionDate || tx.created_at || tx.createdAt || new Date();
        const dateStr = formatDateDDMMYYYY(txDate);
        const isSpecial = tx.project?.projectType === 'Special' || tx.project?.projectCategory === 'Special' || (typeof tx.transactionId === 'string' && tx.transactionId.startsWith('SP_')) || (typeof tx.id === 'string' && tx.id.startsWith('sp_inv_'));
        const isExclusive = tx.project?.projectType === 'Exclusive' || tx.project?.projectCategory === 'Exclusive';

        const isRefund = tx.type === 'REFUND' || tx.project?.status === 'EXPIRED' || (typeof tx.description === 'string' && tx.description.toLowerCase().includes('refund')) || (typeof tx.transactionId === 'string' && tx.transactionId.startsWith('REF-'));

        if (isRefund) {
          const invId = tx.investmentId || (typeof tx.id === 'string' && tx.id.startsWith('sp_inv_') ? tx.id.replace('sp_inv_', '') : tx.id);
          tx.displayTransactionId = `REF-${dateStr}-${String(invId).padStart(2, '0')}`;
        } else if (isSpecial) {
          if (tx.type === 'PAYOUT' || (typeof tx.transactionId === 'string' && tx.transactionId.startsWith('SP_PAYOUT_'))) {
            const parts = tx.transactionId?.split('_');
            const payoutId = (parts && parts.length >= 3 && !isNaN(parts[2])) ? parts[2] : (tx.investmentId || tx.id);
            tx.displayTransactionId = `SPL-PAY-${dateStr}-${String(payoutId).padStart(2, '0')}`;
          } else {
            const invId = tx.investmentId || (typeof tx.id === 'string' && tx.id.startsWith('sp_inv_') ? tx.id.replace('sp_inv_', '') : tx.id);
            tx.displayTransactionId = `SPL-${dateStr}-${String(invId).padStart(2, '0')}`;
          }
        } else if (isExclusive) {
          const invId = tx.investmentId || tx.id;
          if (tx.type === 'PAYOUT') {
            tx.displayTransactionId = `EXP-PAY-${dateStr}-${String(invId).padStart(2, '0')}`;
          } else {
            tx.displayTransactionId = `EXP-${dateStr}-${String(invId).padStart(2, '0')}`;
          }
        } else {
          // Standard
          if (tx.type === 'PAYOUT') {
            const invId = tx.investmentId || tx.id;
            tx.displayTransactionId = `STD-${dateStr}-${String(invId).padStart(2, '0')}`;
          } else if (tx.transactionId && tx.transactionId.startsWith('pay_')) {
            tx.displayTransactionId = tx.transactionId;
          } else {
            const invId = tx.investmentId || tx.id;
            tx.displayTransactionId = `INV-${String(invId).padStart(6, '0')}`;
          }
        }
      }

      // 4. Sort combined results by date descending
      mappedTransactions.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));

      return res.status(200).json({ success: true, transactions: mappedTransactions });
    } catch (error) {
      console.error("Error fetching all transactions:", error);
      return res.status(500).json({ message: "Failed to fetch transaction history." });
    }
  }
};

module.exports = paymentController;
