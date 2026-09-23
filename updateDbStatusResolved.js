const sequelize = require('./config/db');

async function updateDbStatus() {
  try {
    await sequelize.query("ALTER TABLE Enquiries MODIFY COLUMN status ENUM('Pending', 'Read', 'Resolved') NOT NULL DEFAULT 'Pending';");
    await sequelize.query("UPDATE Enquiries SET status = 'Resolved' WHERE status = 'Read';");
    console.log("Successfully updated status column to include Resolved");
  } catch (error) {
    console.error("Error updating table:", error);
  } finally {
    process.exit(0);
  }
}

updateDbStatus();
