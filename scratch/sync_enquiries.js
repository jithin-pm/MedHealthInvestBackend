require('dotenv').config({ path: 'c:\\jithin-pm\\Work\\MedHealthInvestBackend\\.env' });
const sequelize = require('../config/db');
const Enquiry = require('../models/enquiryModel');

async function syncEnquiryTable() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database.");
    
    // Sync the Enquiry model (creates the table if it doesn't exist)
    await Enquiry.sync();
    console.log("Enquiry table created/synced successfully.");
    
    process.exit(0);
  } catch (error) {
    console.error("Error syncing database:", error);
    process.exit(1);
  }
}

syncEnquiryTable();
