const sequelize = require('./config/db');
const SpecialInvestment = require('./models/specialInvestmentModel');
const SpecialInvestmentLedger = require('./models/specialInvestmentLedgerModel');

async function updateDateToJuly() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    // Setting date to July 15, 2026
    const newDate = new Date('2026-07-15T10:00:00Z');
    const projectId = 8; // From the screenshot URL

    const investments = await SpecialInvestment.findAll({
      where: {
        specialProjectId: projectId
      }
    });

    console.log(`Found ${investments.length} investments for project ${projectId}`);

    for (const inv of investments) {
      await sequelize.query(
        `UPDATE special_investments SET created_at = :date WHERE id = :id`,
        { replacements: { date: newDate, id: inv.id } }
      );

      const ledgers = await SpecialInvestmentLedger.findAll({
        where: {
          specialInvestmentId: inv.id
        }
      });

      for (const ledger of ledgers) {
        await sequelize.query(
          `UPDATE special_investment_ledgers SET transactionDate = :date, created_at = :date WHERE id = :id`,
          { replacements: { date: newDate, id: ledger.id } }
        );
      }
      
      console.log(`Updated investment ID ${inv.id} and its ledgers to ${newDate.toISOString()}`);
    }

    console.log('Update to July complete.');
    process.exit(0);
  } catch (error) {
    console.error('Unable to connect to the database or update:', error);
    process.exit(1);
  }
}

updateDateToJuly();
