/**
 * Seed script: Insert dummy transactions for the last financial year (FY 2025-26)
 * Run: node scripts/seedFYTransactions.js
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const sequelize = require("../config/db");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const Project = require("../models/projectModel");

// Last financial year: April 1, 2025 – March 31, 2026
const FY_START = new Date("2025-04-01T00:00:00");
const FY_END = new Date("2026-03-31T23:59:59");

// Generate a random date within the FY range
function randomFYDate() {
  const start = FY_START.getTime();
  const end = FY_END.getTime();
  return new Date(start + Math.random() * (end - start));
}

// Generate a fake transaction ID
function fakeTxnId(prefix = "pay") {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = `${prefix}_`;
  for (let i = 0; i < 14; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

async function seed() {
  try {
    // Fetch existing users and projects
    const users = await User.findAll({ attributes: ["id"], raw: true });
    const projects = await Project.findAll({ attributes: ["id"], raw: true });

    if (users.length === 0 || projects.length === 0) {
      console.error("❌ No users or projects found in DB. Please add some first.");
      process.exit(1);
    }

    console.log(`Found ${users.length} users and ${projects.length} projects.`);

    const userIds = users.map((u) => u.id);
    const projectIds = projects.map((p) => p.id);

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    const amounts = [5000, 10000, 15000, 20000, 25000, 50000, 75000, 100000, 150000, 200000];

    const dummyTransactions = [];

    // 10 INVESTMENT transactions
    for (let i = 0; i < 10; i++) {
      dummyTransactions.push({
        userId: pick(userIds),
        projectId: pick(projectIds),
        amount: pick(amounts),
        transactionId: fakeTxnId("pay"),
        type: "INVESTMENT",
        status: "SUCCESS",
        description: "Dummy FY investment",
        transactionDate: randomFYDate(),
      });
    }

    // 5 PAYOUT transactions
    for (let i = 0; i < 5; i++) {
      dummyTransactions.push({
        userId: pick(userIds),
        projectId: pick(projectIds),
        amount: pick([5000, 10000, 15000, 20000, 25000]),
        transactionId: fakeTxnId("pyt"),
        type: "PAYOUT",
        status: "SUCCESS",
        description: "Dummy FY payout",
        transactionDate: randomFYDate(),
      });
    }

    // 3 REFUND transactions
    for (let i = 0; i < 3; i++) {
      dummyTransactions.push({
        userId: pick(userIds),
        projectId: pick(projectIds),
        amount: pick([5000, 10000, 15000, 20000]),
        transactionId: fakeTxnId("ref"),
        type: "REFUND",
        status: "SUCCESS",
        description: "Dummy FY refund",
        transactionDate: randomFYDate(),
      });
    }

    // Bulk insert
    const created = await Transaction.bulkCreate(dummyTransactions);
    console.log(`✅ Successfully inserted ${created.length} dummy transactions for FY 2025-26.`);
    console.log(`   - 10 Investments, 5 Payouts, 3 Refunds`);
    console.log(`   - Date range: ${FY_START.toDateString()} – ${FY_END.toDateString()}`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
