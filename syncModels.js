require("./config/db");
const SpecialProject = require("./models/specialProjectModel");
const SpecialInvestment = require("./models/specialInvestmentModel");
const SpecialPayout = require("./models/specialPayoutModel");
const SpecialInvestmentLedger = require("./models/specialInvestmentLedgerModel");
const User = require("./models/userModel");
const db = require("./config/db");

// Define associations briefly for sync
SpecialProject.belongsTo(User, { foreignKey: 'assignedUserId', as: 'assignedUser' });
User.hasMany(SpecialProject, { foreignKey: 'assignedUserId', as: 'specialProjects' });

SpecialInvestment.belongsTo(User, { foreignKey: 'userId', as: 'investor' });
SpecialInvestment.belongsTo(SpecialProject, { foreignKey: 'specialProjectId', as: 'project' });
SpecialProject.hasMany(SpecialInvestment, { foreignKey: 'specialProjectId', as: 'investments' });
User.hasMany(SpecialInvestment, { foreignKey: 'userId', as: 'specialInvestments' });

SpecialPayout.belongsTo(SpecialInvestment, { foreignKey: 'specialInvestmentId', as: 'investment' });
SpecialInvestment.hasMany(SpecialPayout, { foreignKey: 'specialInvestmentId', as: 'payouts' });

SpecialInvestmentLedger.belongsTo(SpecialInvestment, { foreignKey: 'specialInvestmentId', as: 'investment' });
SpecialInvestment.hasMany(SpecialInvestmentLedger, { foreignKey: 'specialInvestmentId', as: 'ledgerEntries' });

const syncDb = async () => {
    try {
        await SpecialProject.sync({ alter: true });
        await SpecialInvestment.sync({ alter: true });
        await SpecialPayout.sync({ alter: true });
        await SpecialInvestmentLedger.sync({ alter: true });
        console.log("Special models synced successfully.");
        process.exit();
    } catch (e) {
        console.error("Error syncing:", e);
        process.exit(1);
    }
}
syncDb();
