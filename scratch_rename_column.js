const sequelize = require('./config/db');

async function run() {
  try {
    await sequelize.authenticate();
    await sequelize.query('ALTER TABLE special_projects CHANGE COLUMN projectImages paymentProof TEXT;');
    console.log("Column renamed successfully.");
  } catch (error) {
    console.error("Error renaming column:", error);
  } finally {
    process.exit(0);
  }
}

run();
