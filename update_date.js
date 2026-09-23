const sequelize = require('./config/db');
const SpecialInvestment = require('./models/specialInvestmentModel');
const SpecialInvestmentLedger = require('./models/specialInvestmentLedgerModel');

async function updateDate() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    const newDate = new Date('2026-08-08T10:00:00Z');

    const investments = await SpecialInvestment.findAll({
      where: {
        specialProjectId: 7
      }
    });

    console.log(`Found ${investments.length} investments for project 7`);

    for (const inv of investments) {
      inv.created_at = newDate;
      await inv.save();

      const ledgers = await SpecialInvestmentLedger.findAll({
        where: {
          specialInvestmentId: inv.id
        }
      });

      for (const ledger of ledgers) {
        ledger.transactionDate = newDate;
        ledger.created_at = newDate;
        await ledger.save();
      }
    }

    console.log('Update complete.');
    process.exit(0);
  } catch (error) {
    console.error('Unable to connect to the database or update:', error);
    process.exit(1);
  }
}

updateDate();
