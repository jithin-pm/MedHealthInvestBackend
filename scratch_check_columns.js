const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const sequelize = require("./config/db");
const Transaction = require("./models/transactionModel");
const Investment = require("./models/investmentModel");

async function main() {
  try {
    const txDesc = await Transaction.describe();
    console.log("Transaction table columns:", Object.keys(txDesc));
    const invDesc = await Investment.describe();
    console.log("Investment table columns:", Object.keys(invDesc));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sequelize.close();
  }
}

main();
