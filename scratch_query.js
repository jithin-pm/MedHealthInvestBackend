const sequelize = require("../config/db");
const PanDetails = require("../models/panDetailsModel");
const BankDetails = require("../models/bankDetailsModel");
const User = require("../models/userModel");

async function main() {
  try {
    const users = await User.findAll({
      where: { isPanVerified: 1 },
      attributes: ['id', 'email', 'isPanVerified', 'isBankVerified']
    });
    console.log("Verified Users:", JSON.stringify(users, null, 2));

    for (const u of users) {
      console.log(`\n--- User ID: ${u.id} ---`);
      const pan = await PanDetails.findOne({ where: { userId: u.id } });
      console.log("PAN Record:", pan ? pan.toJSON() : "NOT FOUND");
      
      const bank = await BankDetails.findOne({ where: { userId: u.id } });
      console.log("Bank Record:", bank ? bank.toJSON() : "NOT FOUND");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
}

main();
