const fs = require('fs');
const file = 'controllers/specialProjectController.js';
let content = fs.readFileSync(file, 'utf8');

const targetFunction = `    getProjectsByUser: async (req, res) => {
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

const newFunction = `    getProjectsByUser: async (req, res) => {
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

content = content.replace(targetFunction, newFunction);
fs.writeFileSync(file, content, 'utf8');
console.log('Backend updated');
