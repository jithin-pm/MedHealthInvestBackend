const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Investment = require("../models/investmentModel");
const sequelize = require("../config/db");
const { Op } = require("sequelize");
const sendEmail = require("../utils/sendEmail");
const { getProjectLaunchTemplate, getProjectCompletedTemplate } = require("../utils/emailTemplates");



const Transaction = require("../models/transactionModel");

const projectController = {
  addProject: async (req, res) => {
    try {
      const { projectName, projectCategory, projectType, targetAmount, collectedAmount, minInvestmentAmount, roi, duration, exclusiveUserId, investmentMode } = req.body;

      if (!projectName || !projectCategory || !projectType || !targetAmount || !roi || !duration) {
        return res.status(400).json({ message: "All fields except files are required" });
      }

      const existingProject = await Project.findOne({ where: { projectName } });
      if (existingProject) {
        return res.status(400).json({ message: "A project with this name already exists" });
      }

      let finalImages = [];
      const imageSlots = req.body.imageSlots ? JSON.parse(req.body.imageSlots) : null;
      const newFiles = req.files && req.files.projectImages ? req.files.projectImages : [];
      let newFileIndex = 0;

      if (imageSlots) {
        finalImages = imageSlots.map(slot => {
          if (slot === 'NEW') {
            const file = newFiles[newFileIndex++];
            return file ? file.path : null;
          }
          if (slot === 'EMPTY') return null;
          return slot;
        }).filter(img => img !== null);
      } else {
        finalImages = req.files && req.files.projectImages ? req.files.projectImages.map(f => f.path) : [];
      }

      const isPreSettled = projectType === 'Exclusive' && investmentMode === 'Pre-Settled';
      const ongoingStartDate = isPreSettled ? new Date() : null;
      const durationValue = parseInt(duration);
      const completionDate = isPreSettled ? new Date(ongoingStartDate.getTime() + (durationValue * 30 * 24 * 60 * 60 * 1000)) : null;

      const newProject = await Project.create({
        projectName,
        projectCategory,
        projectType,
        targetAmount,
        collectedAmount: isPreSettled ? targetAmount : (collectedAmount || 0),
        minInvestmentAmount: minInvestmentAmount || 1000,
        roi,
        duration,
        projectImages: JSON.stringify(finalImages),
        status: isPreSettled ? 'ONGOING' : 'ACTIVE',
        activeDeadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        ongoingStartDate,
        completionDate,
        exclusiveUserId: (projectType === 'Exclusive' && exclusiveUserId && !isNaN(parseInt(exclusiveUserId))) ? parseInt(exclusiveUserId) : null
      });

      if (isPreSettled) {
        const parsedUserId = parseInt(exclusiveUserId);
        const preSettledProofPath = req.files && req.files.preSettledProof ? req.files.preSettledProof[0].path.replace(/\\/g, '/') : null;

        // 1. Create the Investment record
        const investment = await Investment.create({
          projectId: newProject.id,
          userId: parsedUserId,
          amount: parseFloat(targetAmount),
          paymentId: `PRE_SETTLED_${Date.now()}`,
          orderId: `PRE_SETTLED_ORDER_${Date.now()}`,
          status: 'SUCCESS',
          paybackStatus: 'PENDING',
          paybackProof: preSettledProofPath
        });

        // 2. Create the Transaction record in global Ledger
        await Transaction.create({
          userId: parsedUserId,
          projectId: newProject.id,
          investmentId: investment.id,
          amount: parseFloat(targetAmount),
          transactionId: investment.paymentId,
          type: 'INVESTMENT',
          status: 'SUCCESS',
          description: `Pre-Settled Exclusive Investment in ${projectName}`
        });
      }

      res.status(201).json({ message: "Project created successfully", project: newProject });

      // Send Email Notifications (Asynchronously)
      (async () => {
        try {
          let recipients = [];
          if (newProject.projectType === 'Exclusive') {
            const exclusiveUser = await User.findByPk(newProject.exclusiveUserId);
            if (exclusiveUser) {
              recipients = [exclusiveUser];
            }
          } else {
            recipients = await User.findAll({ 
              where: { role: 'user' }
            });
          }

          if (recipients.length > 0) {
            // Filter unique emails
            const uniqueRecipients = [];
            const seenEmails = new Set();
            for (const user of recipients) {
              if (user.email && !seenEmails.has(user.email)) {
                uniqueRecipients.push(user);
                seenEmails.add(user.email);
              }
            }

            for (const user of uniqueRecipients) {
              const emailHtml = getProjectLaunchTemplate(newProject, user);
              sendEmail({
                to: user.email,
                subject: `New Project Launched: ${newProject.projectName} - High ROI Opportunity!`,
                html: emailHtml
              }).catch(err => console.error(`Failed to send email to ${user.email}:`, err));
            }
            
            console.log(`Launch email sequence started for ${recipients.length} recipients.`);
          }
        } catch (emailError) {
          console.error("Failed to send launch emails:", emailError);
        }
      })();
    } catch (error) {

      console.error("Error in addProject:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  getAllProjects: async (req, res) => {
    try {
      // Auto-expire projects that passed 90 days and haven't met target
      await Project.update(
        { status: 'EXPIRED' },
        {
          where: {
            status: 'ACTIVE',
            activeDeadline: { 
              [Op.not]: null,
              [Op.lt]: Project.sequelize.literal('NOW()') 
            }
          }
        }
      );

      const { userId, isAdmin } = req.query;
      let whereClause = {};
      const validUserId = (userId && userId !== 'undefined' && userId !== 'null') ? userId : null;

      if (isAdmin === 'true') {
        whereClause = {};
      } else if (validUserId) {
        whereClause = {
          [Op.or]: [
            { projectType: 'Standard', status: { [Op.in]: ['ACTIVE', 'ONGOING', 'COMPLETED'] } },
            { 
              [Op.and]: [
                { projectType: 'Exclusive' },
                { exclusiveUserId: validUserId },
                { status: { [Op.in]: ['ACTIVE', 'ONGOING', 'COMPLETED'] } }
              ]
            }
          ]
        };
      } else {
        whereClause = { projectType: 'Standard', status: { [Op.in]: ['ACTIVE', 'ONGOING', 'COMPLETED'] } };
      }

      const projects = await Project.findAll({ 
        where: whereClause,
        include: [
          {
            model: User,
            as: 'assignedUser',
            attributes: ['id', 'fullName', 'email', 'mobileNumber', 'countryCode']
          },
          {
            model: Investment,
            as: 'investments',
            attributes: ['id', 'status', 'paybackStatus']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Map projects to include isSettled flag
      const mappedProjects = projects.map(p => {
        const plainProject = p.get({ plain: true });
        if (plainProject.status === 'EXPIRED') {
          const successInvestments = plainProject.investments?.filter(inv => inv.status === 'SUCCESS') || [];
          if (successInvestments.length === 0) {
            plainProject.isSettled = true;
          } else {
            plainProject.isSettled = successInvestments.every(inv => inv.paybackStatus === 'PAID');
          }
        } else {
          plainProject.isSettled = false;
        }
        return plainProject;
      });

      res.status(200).json({ projects: mappedProjects });
    } catch (error) {
      console.error("Error in getAllProjects:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  getProjectById: async (req, res) => {
    try {
      const { id } = req.params;

      // Auto-expire this specific project if needed
      await Project.update(
        { status: 'EXPIRED' },
        {
          where: {
            id,
            status: 'ACTIVE',
            activeDeadline: { 
              [Op.not]: null,
              [Op.lt]: Project.sequelize.literal('NOW()') 
            }
          }
        }
      );

      const project = await Project.findByPk(id, {
        include: [
          {
            model: User,
            as: 'assignedUser',
            attributes: ['id', 'fullName', 'email', 'mobileNumber', 'countryCode']
          }
        ]
      });
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.status(200).json(project);
    } catch (error) {
      console.error("Error in getProjectById:", error);
      res.status(500).json({ message: "Server error" });
    }
  },

  editProject: async (req, res) => {
    try {
      const { id } = req.params;
      const { projectName, projectCategory, projectType, targetAmount, collectedAmount, minInvestmentAmount, roi, duration, status, exclusiveUserId } = req.body;
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      let finalImages = [];
      const imageSlots = req.body.imageSlots ? JSON.parse(req.body.imageSlots) : null;
      const newFiles = req.files && req.files.projectImages ? req.files.projectImages : [];
      let newFileIndex = 0;

      if (imageSlots) {
        finalImages = imageSlots.map(slot => {
          if (slot === 'NEW') {
            const file = newFiles[newFileIndex++];
            return file ? file.path : null;
          }
          if (slot === 'EMPTY') return null;
          return slot;
        }).filter(img => img !== null);
      } else {
        finalImages = newFiles.length > 0 ? newFiles.map(f => f.path) : JSON.parse(project.projectImages || '[]');
      }

      let ongoingStartDate = project.ongoingStartDate;
      let completionDate = project.completionDate;
      if (status === 'ONGOING' && project.status !== 'ONGOING') {
        ongoingStartDate = new Date();
        const durationValue = parseInt(duration || project.duration);
        completionDate = new Date(ongoingStartDate.getTime() + (durationValue * 30 * 24 * 60 * 60 * 1000));
      }

      const oldStatus = project.status;
      await project.update({
        projectName: projectName || project.projectName,
        projectCategory: projectCategory || project.projectCategory,
        projectType: projectType || project.projectType,
        targetAmount: targetAmount || project.targetAmount,
        collectedAmount: collectedAmount !== undefined ? collectedAmount : project.collectedAmount,
        minInvestmentAmount: minInvestmentAmount !== undefined ? minInvestmentAmount : project.minInvestmentAmount,
        roi: roi || project.roi,
        duration: duration || project.duration,
        status: status || project.status,
        ongoingStartDate: ongoingStartDate,
        completionDate: completionDate,
        projectImages: JSON.stringify(finalImages),
        exclusiveUserId: (projectType || project.projectType) === 'Exclusive' ? (exclusiveUserId && !isNaN(parseInt(exclusiveUserId)) ? parseInt(exclusiveUserId) : project.exclusiveUserId) : null
      });

      res.status(200).json({ message: "Project updated successfully", project });

      // Send Completion Email if status changed to COMPLETED
      if (status === 'COMPLETED' && oldStatus !== 'COMPLETED') {
        console.log(`[DEBUG] Project ${id} transitioned to COMPLETED. Fetching investors...`);
        (async () => {
          try {
              const investments = await Investment.findAll({
                where: { projectId: Number(id), status: 'SUCCESS' },
                include: [{ model: User, as: 'investor', attributes: ['email', 'fullName'] }]
              });

            console.log(`[DEBUG] Found ${investments.length} successful investments for project ${id}`);
            for (const inv of investments) {
              if (inv.investor && inv.investor.email) {
                console.log(`[DEBUG] Attempting to send completion email to ${inv.investor.email}`);
                const html = getProjectCompletedTemplate(project, inv.investor);
                const subject = `Congratulations! ${project.projectName} has Matured - Check Your Settlement`;
                
                sendEmail({ to: inv.investor.email, subject, html })
                  .then(() => console.log(`[DEBUG] Completion email sent to ${inv.investor.email}`))
                  .catch(err => console.error(`[ERROR] Failed to send completion email to ${inv.investor.email}:`, err));
              }
            }
          } catch (error) {
            console.error("[ERROR] Failed to send completion emails:", error);
          }
        })();
      }
    } catch (error) {

      console.error("Error in editProject:", error);
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  },

  deleteProject: async (req, res) => {
    try {
      const { id } = req.params;
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      await sequelize.transaction(async (t) => {
        // Delete all investments associated with this project first
        await Investment.destroy({ where: { projectId: id }, transaction: t });
        // Then delete the project
        await project.destroy({ transaction: t });
      });

      res.status(200).json({ message: "Project and its associated records deleted successfully" });
    } catch (error) {
      console.error("Delete project error:", error);
      res.status(500).json({ message: "Server error during project deletion." });
    }
  },
};

module.exports = projectController;
