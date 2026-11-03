const SpecialProject = require("../models/specialProjectModel");
const User = require("../models/userModel");
const SpecialInvestment = require("../models/specialInvestmentModel");
const SpecialInvestmentLedger = require("../models/specialInvestmentLedgerModel");
const sequelize = require("../config/db");
const { Op, Sequelize } = require("sequelize");

const parseCustomStartDate = (startDate) => {
  if (!startDate) return new Date();
  if (typeof startDate === 'string' && startDate.includes('-')) {
    const parts = startDate.split('T')[0].split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    }
  }
  const d = new Date(startDate);
  if (!isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  }
  return new Date();
};

const syncProjectLedgersAndDates = async (project, customStartDate) => {
  if (!project || !customStartDate) return;

  const investments = await SpecialInvestment.findAll({
    where: { specialProjectId: project.id }
  });

  const now = new Date();
  const startYear = customStartDate.getFullYear();
  const startMonth = customStartDate.getMonth(); // 0-indexed
  const gracePeriodDate = new Date(startYear, startMonth + 1, 1, 12, 0, 0);
  const gracePeriodPassed = gracePeriodDate <= now;

  for (const inv of investments) {
    const principal = parseFloat(inv.amountInvested || project.targetAmount);
    const monthlyRoi = parseFloat(project.roi);
    const monthlyInterest = (principal * monthlyRoi) / 100;

    // 1. Initial Investment entry
    const existingInitial = await SpecialInvestmentLedger.findOne({
      where: {
        specialInvestmentId: inv.id,
        transactionType: 'INITIAL_INVESTMENT'
      }
    });

    if (existingInitial) {
      await existingInitial.update({
        transactionDate: customStartDate,
        amount: principal.toFixed(2),
        balanceAfter: principal.toFixed(2)
      });
    } else {
      await SpecialInvestmentLedger.create({
        specialInvestmentId: inv.id,
        transactionType: 'INITIAL_INVESTMENT',
        amount: principal.toFixed(2),
        balanceAfter: principal.toFixed(2),
        description: 'Initial Investment',
        transactionDate: customStartDate,
        created_at: customStartDate,
        updated_at: customStartDate
      });
    }

    // 2. Accruals from Month 2 onwards (Month 1 is Grace Period)
    let monthOffset = 2;
    let totalAccumulatedInterest = 0;
    let rollingBalance = principal;

    while (true) {
      const accrualDate = new Date(startYear, startMonth + monthOffset, 1, 12, 0, 0);
      if (accrualDate > now) {
        break;
      }
      totalAccumulatedInterest += monthlyInterest;
      rollingBalance += monthlyInterest;

      const accYear = accrualDate.getFullYear();
      const accMonth = accrualDate.getMonth() + 1; // 1-12
      const existingAccrual = await SpecialInvestmentLedger.findOne({
        where: {
          specialInvestmentId: inv.id,
          transactionType: 'INTEREST_ACCRUED',
          [Op.and]: [
            Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('transactionDate')), accYear),
            Sequelize.where(Sequelize.fn('MONTH', Sequelize.col('transactionDate')), accMonth)
          ]
        }
      });

      if (!existingAccrual) {
        await SpecialInvestmentLedger.create({
          specialInvestmentId: inv.id,
          transactionType: 'INTEREST_ACCRUED',
          amount: monthlyInterest.toFixed(2),
          balanceAfter: rollingBalance.toFixed(2),
          description: `Monthly Interest (${monthlyRoi}%)`,
          transactionDate: accrualDate,
          created_at: accrualDate,
          updated_at: accrualDate
        });
      }
      monthOffset++;
    }

    await inv.update({
      accumulatedInterest: totalAccumulatedInterest.toFixed(2),
      gracePeriodEmailSent: gracePeriodPassed,
      created_at: customStartDate
    });

    await sequelize.query("UPDATE special_investments SET created_at = ? WHERE id = ?", {
      replacements: [customStartDate, inv.id]
    });
  }

  await sequelize.query("UPDATE special_projects SET created_at = ? WHERE id = ?", {
    replacements: [customStartDate, project.id]
  });
};

const specialProjectController = {
  addProject: async (req, res) => {
    try {
      const { projectName, projectCategory, targetAmount, collectedAmount, minInvestmentAmount, roi, assignedUserId, investmentMode, startDate } = req.body;

      if (!projectName || !projectCategory || !targetAmount || !roi || !assignedUserId) {
        return res.status(400).json({ message: "All required fields must be provided" });
      }

      const assignedUser = await User.findByPk(assignedUserId);
      if (!assignedUser) {
        return res.status(404).json({ message: "Assigned user not found" });
      }
      if (assignedUser.isPanVerified !== 1 ) {
        return res.status(400).json({ message: "The assigned user must complete PAN verification before a special project can be initiated for them." });
      }

      const existingProject = await SpecialProject.findOne({ where: { projectName } });
      if (existingProject) {
        return res.status(400).json({ message: "A special project with this name already exists" });
      }

      const paymentProof = req.file ? req.file.path.replace(/\\/g, '/') : null;

      const customStartDate = parseCustomStartDate(startDate);

      const isPreSettled = investmentMode === 'Pre-Settled';
      const ongoingStartDate = isPreSettled ? customStartDate : null;

      const newProject = await SpecialProject.create({
        projectName,
        projectCategory,
        targetAmount,
        collectedAmount: isPreSettled ? targetAmount : (collectedAmount || 0),
        minInvestmentAmount: minInvestmentAmount || 1000,
        roi,
        assignedUserId,
        paymentProof,
        status: isPreSettled ? 'ONGOING' : 'ACTIVE',
        ongoingStartDate,
        created_at: customStartDate,
        updated_at: customStartDate
      });

      if (isPreSettled) {
        const principal = parseFloat(targetAmount);
        const monthlyRoi = parseFloat(roi);
        const monthlyInterest = (principal * monthlyRoi) / 100;

        const now = new Date();
        const startYear = customStartDate.getFullYear();
        const startMonth = customStartDate.getMonth(); // 0-indexed

        // Grace period is Month 1 after investment (cooling buffer)
        const gracePeriodDate = new Date(startYear, startMonth + 1, 1, 12, 0, 0);
        const gracePeriodPassed = gracePeriodDate <= now;

        const newInvestment = await SpecialInvestment.create({
          specialProjectId: newProject.id,
          userId: assignedUserId,
          amountInvested: targetAmount,
          remainingCapital: targetAmount,
          accumulatedInterest: "0.00",
          paymentId: `PRESETTLED_${Date.now()}`,
          orderId: `ORDER_${Date.now()}`,
          status: 'SUCCESS',
          paybackStatus: 'PENDING',
          gracePeriodEmailSent: gracePeriodPassed,
          created_at: customStartDate,
          updated_at: customStartDate
        });

        // Synchronize initial investment ledger, accruals for past months, and timestamps
        await syncProjectLedgersAndDates(newProject, customStartDate);
      }

      res.status(201).json({ message: "Special project added successfully", project: newProject });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  getAllProjects: async (req, res) => {
    try {
      const projects = await SpecialProject.findAll({
        include: [{ model: User, as: 'assignedUser', attributes: ['id', 'fullName', 'email'] }],
        order: [['created_at', 'DESC']]
      });
      res.status(200).json(projects);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  getProjectById: async (req, res) => {
    try {
      const { id } = req.params;
      const project = await SpecialProject.findByPk(id, {
        include: [{ model: User, as: 'assignedUser', attributes: ['id', 'fullName', 'email'] }]
      });

      if (!project) {
        return res.status(404).json({ message: "Special project not found" });
      }

      // Auto-heal missing ledgers or accruals if project is ONGOING
      if (project.status === 'ONGOING' && project.ongoingStartDate) {
        try {
          await syncProjectLedgersAndDates(project, new Date(project.ongoingStartDate));
        } catch (healErr) {
          console.error("Auto-heal ledger error in getProjectById:", healErr);
        }
      }

      res.status(200).json(project);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  editProject: async (req, res) => {
    try {
      const { id } = req.params;
      const { projectName, projectCategory, targetAmount, collectedAmount, minInvestmentAmount, roi, status, assignedUserId, startDate } = req.body;

      const project = await SpecialProject.findByPk(id);
      if (!project) {
        return res.status(404).json({ message: "Special project not found" });
      }

      const paymentProof = req.file ? req.file.path.replace(/\\/g, '/') : project.paymentProof;

      let ongoingStartDate = project.ongoingStartDate;
      let completionDate = project.completionDate;

      if (startDate) {
        ongoingStartDate = parseCustomStartDate(startDate);
      }

      if (status === 'ONGOING' && project.status !== 'ONGOING' && !ongoingStartDate) {
        ongoingStartDate = new Date();
      }

      if (status === 'COMPLETED' && project.status !== 'COMPLETED') {
        completionDate = new Date();
      }

      await project.update({
        projectName: projectName || project.projectName,
        projectCategory: projectCategory || project.projectCategory,
        targetAmount: targetAmount || project.targetAmount,
        collectedAmount: collectedAmount || project.collectedAmount,
        minInvestmentAmount: minInvestmentAmount || project.minInvestmentAmount,
        roi: roi || project.roi,
        status: status || project.status,
        assignedUserId: assignedUserId || project.assignedUserId,
        paymentProof,
        ongoingStartDate,
        completionDate
      });

      if (ongoingStartDate) {
        await syncProjectLedgersAndDates(project, ongoingStartDate);
      }

      res.status(200).json({ message: "Special project updated successfully", project });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  deleteProject: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      const { id } = req.params;
      const project = await SpecialProject.findByPk(id, { transaction: t });

      if (!project) {
        await t.rollback();
        return res.status(404).json({ message: "Special project not found" });
      }

      const SpecialPayout = require("../models/specialPayoutModel");

      const investments = await SpecialInvestment.findAll({
        where: { specialProjectId: id },
        transaction: t
      });

      const investmentIds = investments.map(inv => inv.id);

      if (investmentIds.length > 0) {
        await SpecialInvestmentLedger.destroy({
          where: { specialInvestmentId: investmentIds },
          transaction: t
        });

        await SpecialPayout.destroy({
          where: { specialInvestmentId: investmentIds },
          transaction: t
        });

        await SpecialInvestment.destroy({
          where: { specialProjectId: id },
          transaction: t
        });
      }

      await project.destroy({ transaction: t });
      await t.commit();
      res.status(200).json({ message: "Special project deleted successfully" });
    } catch (error) {
      if (t) await t.rollback();
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  getProjectsByUser: async (req, res) => {
    try {
        const { userId } = req.params;
        const projects = await SpecialProject.findAll({
            where: { assignedUserId: userId },
            order: [['created_at', 'DESC']]
        });

        const investments = await SpecialInvestment.findAll({
            where: { userId: userId, status: 'SUCCESS' }
        });

        const investmentIds = investments.map(i => i.id);
        let ledgers = [];
        if (investmentIds.length > 0) {
            ledgers = await SpecialInvestmentLedger.findAll({
                where: { specialInvestmentId: investmentIds }
            });
        }

        const enrichedProjects = projects.map(p => {
            const projInvestments = investments.filter(inv => inv.specialProjectId === p.id);
            const projLedgers = ledgers.filter(l => projInvestments.some(inv => inv.id === l.specialInvestmentId));
            
            const totalInvested = projInvestments.reduce((sum, inv) => sum + parseFloat(inv.amountInvested || 0), 0);
            
            const totalInterestAccrued = projLedgers
                .filter(l => l.transactionType === 'INTEREST_ACCRUED')
                .reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
                
            const totalPayoutsMade = projLedgers
                .filter(l => l.transactionType === 'PAYOUT_MADE')
                .reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
            
            // Balance = Principal + Interest - Payouts
            const currentBalance = totalInvested + totalInterestAccrued - totalPayoutsMade;
            
            // Returned = Payouts made
            const moneyReturned = totalPayoutsMade;
            
            return {
                ...p.toJSON(),
                totalInvested,
                currentBalance,
                moneyReturned,
                totalInterestAccrued
            };
        });

        res.status(200).json(enrichedProjects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
  }
};

module.exports = specialProjectController;
