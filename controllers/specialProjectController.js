const SpecialProject = require("../models/specialProjectModel");
const User = require("../models/userModel");
const SpecialInvestment = require("../models/specialInvestmentModel");
const sequelize = require("../config/db");

const specialProjectController = {
  addProject: async (req, res) => {
    try {
      const { projectName, projectCategory, targetAmount, collectedAmount, minInvestmentAmount, roi, assignedUserId, investmentMode } = req.body;

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

      const isPreSettled = investmentMode === 'Pre-Settled';
      const ongoingStartDate = isPreSettled ? new Date() : null;

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
        ongoingStartDate
      });

      if (isPreSettled) {
        await SpecialInvestment.create({
          specialProjectId: newProject.id,
          userId: assignedUserId,
          amountInvested: targetAmount,
          remainingCapital: targetAmount,
          paymentId: `PRESETTLED_${Date.now()}`,
          orderId: `ORDER_${Date.now()}`,
          status: 'SUCCESS'
        });
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

      res.status(200).json(project);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  },

  editProject: async (req, res) => {
    try {
      const { id } = req.params;
      const { projectName, projectCategory, targetAmount, collectedAmount, minInvestmentAmount, roi, status, assignedUserId } = req.body;

      const project = await SpecialProject.findByPk(id);
      if (!project) {
        return res.status(404).json({ message: "Special project not found" });
      }

      const paymentProof = req.file ? req.file.path.replace(/\\/g, '/') : project.paymentProof;

      let ongoingStartDate = project.ongoingStartDate;
      let completionDate = project.completionDate;

      if (status === 'ONGOING' && project.status !== 'ONGOING') {
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

      const SpecialInvestmentLedger = require("../models/specialInvestmentLedgerModel");
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
        
        const SpecialInvestment = require("../models/specialInvestmentModel");
        const SpecialInvestmentLedger = require("../models/specialInvestmentLedgerModel");

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
