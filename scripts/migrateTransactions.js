const Project = require("../models/projectModel");
const Investment = require("../models/investmentModel");
const Transaction = require("../models/transactionModel");
const sequelize = require("../config/db");

// Define Associations (Since this is a standalone script)
Investment.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Investment.belongsTo(require("../models/userModel"), { foreignKey: 'userId', as: 'investor' });
Transaction.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Transaction.belongsTo(require("../models/userModel"), { foreignKey: 'userId', as: 'user' });

async function migrate() {
  console.log("Starting Transaction Migration...");
  
  try {
    // Manually sync the transaction table first to ensure transactionId column exists
    await Transaction.sync({ alter: true });
    console.log("Transaction table synchronized.");

    const investments = await Investment.findAll({
      where: { status: 'SUCCESS' },
      include: [{ model: Project, as: 'project' }]
    });

    console.log(`Found ${investments.length} investments to process.`);

    for (const inv of investments) {
      // 1. Check if INVESTMENT transaction exists
      const existingInvTx = await Transaction.findOne({
        where: { investmentId: inv.id, type: 'INVESTMENT' }
      });

      if (!existingInvTx) {
        await Transaction.create({
          userId: inv.userId,
          projectId: inv.projectId,
          investmentId: inv.id,
          amount: inv.amount,
          transactionId: inv.paymentId,
          type: 'INVESTMENT',
          status: 'SUCCESS',
          description: `Historical: Investment in ${inv.project?.projectName || 'Project'}`,
          transactionDate: inv.created_at
        });
        console.log(`Migrated INVESTMENT for ID ${inv.id}`);
      }

      // 2. If PAID, check if PAYOUT/REFUND transaction exists
      if (inv.paybackStatus === 'PAID') {
        const type = inv.project?.status === 'EXPIRED' ? 'REFUND' : 'PAYOUT';
        const existingPayoutTx = await Transaction.findOne({
          where: { investmentId: inv.id, type: type }
        });

        if (!existingPayoutTx) {
          await Transaction.create({
            userId: inv.userId,
            projectId: inv.projectId,
            investmentId: inv.id,
            amount: inv.amount,
            type: type,
            status: 'SUCCESS',
            description: `Historical: ${type === 'REFUND' ? 'Capital Refund' : 'Investment Payout'} for ${inv.project?.projectName || 'Project'}`,
            transactionDate: inv.updated_at // Use updated_at as an approximation of payback date
          });
          console.log(`Migrated ${type} for ID ${inv.id}`);
        }
      }
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
