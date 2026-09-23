const fs = require('fs');
const file = 'controllers/specialProjectController.js';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `    getProjectsByUser: async (req, res) => {
        try {
            const { userId } = req.params;
            const projects = await SpecialProject.findAll({
                where: { assignedUserId: userId },
                order: [['created_at', 'DESC']]
            });
            res.status(200).json(projects);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }`;

const replaceStr = `    getProjectsByUser: async (req, res) => {
        try {
            const { userId } = req.params;
            const projects = await SpecialProject.findAll({
                where: { assignedUserId: userId },
                order: [['created_at', 'DESC']]
            });
            
            const SpecialInvestment = require("../models/specialInvestmentModel");
            const investments = await SpecialInvestment.findAll({
                where: { userId: userId, status: 'SUCCESS' }
            });

            const enrichedProjects = projects.map(p => {
                const projInvestments = investments.filter(inv => inv.specialProjectId === p.id);
                const totalInvested = projInvestments.reduce((sum, inv) => sum + parseFloat(inv.amountInvested || 0), 0);
                const currentBalance = projInvestments.reduce((sum, inv) => sum + parseFloat(inv.remainingCapital || 0), 0);
                const moneyReturned = totalInvested - currentBalance;
                
                return {
                    ...p.toJSON(),
                    totalInvested,
                    currentBalance,
                    moneyReturned
                };
            });

            res.status(200).json(enrichedProjects);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }`;

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = targetStr.replace(/\r\n/g, '\n');
const normReplace = replaceStr.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
  const newContent = normContent.replace(normTarget, normReplace);
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('Backend updated successfully');
} else {
  console.log('Target block not found');
}
