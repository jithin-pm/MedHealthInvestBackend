const sequelize = require('./config/db');

async function updateDbStatus() {
  try {
    await sequelize.query("ALTER TABLE Enquiries ADD COLUMN status ENUM('Pending', 'Read') NOT NULL DEFAULT 'Pending';");
    console.log("Successfully added status column to Enquiries table");
  } catch (error) {
    if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
      console.log("Column 'status' already exists.");
    } else {
      console.error("Error updating table:", error);
    }
  } finally {
    process.exit(0);
  }
}

updateDbStatus();
