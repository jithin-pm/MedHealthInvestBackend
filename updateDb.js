const sequelize = require('./config/db');

async function updateDb() {
  try {
    await sequelize.query("ALTER TABLE Enquiries MODIFY COLUMN enquiryType ENUM('General', 'Exclusive', 'Special') NOT NULL DEFAULT 'General';");
    console.log("Successfully updated Enquiries table ENUM");
  } catch (error) {
    console.error("Error updating table:", error);
  } finally {
    process.exit(0);
  }
}

updateDb();
