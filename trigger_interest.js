const sequelize = require('./config/db');
const SpecialProject = require('./models/specialProjectModel');
const SpecialInvestment = require('./models/specialInvestmentModel');
const { runMonthlyInterestAccrual } = require('./utils/cronJobs');

// Add association
SpecialInvestment.belongsTo(SpecialProject, { foreignKey: 'specialProjectId', as: 'project' });
SpecialProject.hasMany(SpecialInvestment, { foreignKey: 'specialProjectId', as: 'investments' });

async function triggerInterest() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    
    // Run the interest accrual
    await runMonthlyInterestAccrual();
    
    console.log('Interest calculation completed.');
    process.exit(0);
  } catch (error) {
    console.error('Error triggering interest:', error);
    process.exit(1);
  }
}

triggerInterest();
