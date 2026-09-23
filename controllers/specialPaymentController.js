const SpecialProject = require("../models/specialProjectModel");
const SpecialInvestment = require("../models/specialInvestmentModel");
const SpecialPayout = require("../models/specialPayoutModel");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const sequelize = require("../config/db");

const specialPaymentController = {
  getInvestorsByProject: async (req, res) => {
    try {
      const { projectId } = req.params;
      const investments = await SpecialInvestment.findAll({
        where: { specialProjectId: projectId, status: 'SUCCESS' },
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
      console.error("Error fetching special project investors:", error);
      return res.status(500).json({ message: "Failed to fetch investors." });
    }
  },

  getInvestmentsByUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const investments = await SpecialInvestment.findAll({
        where: { userId, status: 'SUCCESS' },
        include: [
          {
            model: SpecialProject,
            as: 'project',
            attributes: ['id', 'projectName', 'status', 'roi', 'targetAmount', 'collectedAmount', 'projectCategory']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      
      return res.status(200).json({ success: true, investments });
    } catch (error) {
      console.error("Error fetching user special investments:", error);
      return res.status(500).json({ message: "Failed to fetch investment history." });
    }
  },

  getPayoutSchedule: async (req, res) => {
      try {
          const { investmentId } = req.params;
          const payouts = await SpecialPayout.findAll({
              where: { specialInvestmentId: investmentId },
              order: [['created_at', 'ASC']]
          });
          return res.status(200).json({ success: true, payouts });
      } catch (error) {
          console.error("Error fetching payout schedule:", error);
          return res.status(500).json({ message: "Failed to fetch payout schedule." });
      }
  },

  getLedgerHistory: async (req, res) => {
    try {
        const { investmentId } = req.params;
        const SpecialInvestmentLedger = require("../models/specialInvestmentLedgerModel");
        const history = await SpecialInvestmentLedger.findAll({
            where: { specialInvestmentId: investmentId },
            order: [['transactionDate', 'ASC']]
        });
        return res.status(200).json({ success: true, history });
    } catch (error) {
        console.error("Error fetching ledger history:", error);
        return res.status(500).json({ message: "Failed to fetch ledger history." });
    }
  },

  recordMonthlyPayback: async (req, res) => {
    try {
      const { investmentId } = req.params;
      const { amount, paybackType } = req.body;
      const paybackProof = req.file ? req.file.path.replace(/\\/g, '/') : null;

      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
          return res.status(400).json({ message: "A valid amount must be provided." });
      }

      if (!paybackProof) {
          return res.status(400).json({ message: "Payment proof is required." });
      }

      const result = await sequelize.transaction(async (t) => {
          const investment = await SpecialInvestment.findByPk(investmentId, {
            include: [{ model: SpecialProject, as: 'project' }],
            transaction: t,
            lock: true
          });
          
          if (!investment) {
            throw new Error("Investment record not found.");
          }

          if (investment.paybackStatus === 'PAID') {
              throw new Error("This investment has already been fully paid.");
          }

          if (paybackType !== 'INTEREST' && paybackType !== 'CAPITAL') {
              throw new Error("Invalid payback type. Must be INTEREST or CAPITAL.");
          }

          const payoutAmount = parseFloat(amount);
          let actualPayout = payoutAmount;
          let newRemainingCapital = parseFloat(investment.remainingCapital);
          let newAccumulatedInterest = parseFloat(investment.accumulatedInterest || 0);

          let roiPaid = 0;
          let capitalPaid = 0;
          let description = "Admin Payback";

          if (paybackType === 'INTEREST') {
              if (payoutAmount > newAccumulatedInterest) {
                  actualPayout = newAccumulatedInterest;
              }
              newAccumulatedInterest -= actualPayout;
              roiPaid = actualPayout;
              description = "Interest Payback";
          } else if (paybackType === 'CAPITAL') {
              if (payoutAmount > newRemainingCapital) {
                  actualPayout = newRemainingCapital;
              }
              newRemainingCapital -= actualPayout;
              capitalPaid = actualPayout;
              description = "Capital Payback";
          }

          const payout = await SpecialPayout.create({
              specialInvestmentId: investment.id,
              capitalPaid,
              roiPaid,
              totalPaid: actualPayout,
              paybackProof,
              status: 'PAID',
              paidAt: new Date()
          }, { transaction: t });

          const newTotalBalance = newRemainingCapital + newAccumulatedInterest;

          const SpecialInvestmentLedger = require("../models/specialInvestmentLedgerModel");
          await SpecialInvestmentLedger.create({
              specialInvestmentId: investment.id,
              transactionType: 'PAYOUT_MADE',
              amount: actualPayout.toFixed(2),
              balanceAfter: newTotalBalance.toFixed(2),
              description,
              transactionDate: new Date()
          }, { transaction: t });

          await investment.update({
              remainingCapital: newRemainingCapital.toFixed(2),
              accumulatedInterest: newAccumulatedInterest.toFixed(2),
              paybackStatus: (newRemainingCapital <= 0.01 && newAccumulatedInterest <= 0.01) ? 'PAID' : 'PENDING'
          }, { transaction: t });

          // Record in global transaction ledger
          await Transaction.create({
              userId: investment.userId,
              projectId: null,
              investmentId: null,
              amount: actualPayout,
              transactionId: `SP_PAYOUT_${payout.id}_${Date.now()}`,
              type: 'PAYOUT',
              status: 'SUCCESS',
              description: `Special Project Payout: ${actualPayout.toFixed(2)}`
          }, { transaction: t });

          return { payout, investment };
      });

      return res.status(200).json({ 
        success: true, 
        message: "Monthly payback recorded successfully.",
        payout: result.payout,
        investment: result.investment
      });
    } catch (error) {
      console.error("Error recording special monthly payback:", error);
      return res.status(500).json({ message: error.message || "Internal server error while recording payback." });
    }
  }
};

module.exports = specialPaymentController;
