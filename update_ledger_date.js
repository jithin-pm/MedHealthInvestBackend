const sequelize = require('./config/db');

async function updateLedgerDate() {
  try {
    await sequelize.authenticate();
    console.log('Connection established.');

    // We know project ID is 8 and we need to fix the interest accrued transaction
    const newDate = new Date('2026-09-01T00:00:00Z');

    // First find the investment ID for project 8
    const [investments] = await sequelize.query(`SELECT id FROM special_investments WHERE specialProjectId = 8`);
    if (investments.length > 0) {
      const invId = investments[0].id;

      // Update the ledger
      await sequelize.query(
        `UPDATE special_investment_ledgers 
         SET transactionDate = :date, created_at = :date 
         WHERE specialInvestmentId = :invId AND transactionType = 'INTEREST_ACCRUED'`,
        { replacements: { date: newDate, invId: invId } }
      );
      
      console.log(`Successfully updated the ledger transaction date to ${newDate.toISOString()}`);
    } else {
      console.log('No investments found for project 8');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error updating ledger date:', error);
    process.exit(1);
  }
}

updateLedgerDate();
