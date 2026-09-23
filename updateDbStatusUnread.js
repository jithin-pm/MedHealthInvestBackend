const sequelize = require('./config/db');

async function updateDbStatus() {
  try {
    await sequelize.query("ALTER TABLE Enquiries MODIFY COLUMN status ENUM('Pending', 'Read', 'Resolved', 'Unread') NOT NULL DEFAULT 'Unread';");
    await sequelize.query("UPDATE Enquiries SET status = 'Unread' WHERE status = 'Pending';");
    await sequelize.query("UPDATE Enquiries SET status = 'Read' WHERE status = 'Resolved';");
    await sequelize.query("ALTER TABLE Enquiries MODIFY COLUMN status ENUM('Unread', 'Read') NOT NULL DEFAULT 'Unread';");
    console.log("Successfully updated status column to Unread and Read");
  } catch (error) {
    console.error("Error updating table:", error);
  } finally {
    process.exit(0);
  }
}

updateDbStatus();
