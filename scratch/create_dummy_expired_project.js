const Project = require('../models/projectModel');
const Investment = require('../models/investmentModel');
const User = require('../models/userModel');

async function createDummyData() {
  try {
    // 1. Find a user
    const user = await User.findOne();
    if (!user) {
      console.error('No user found in the database. Please create a user first.');
      process.exit(1);
    }

    // 2. Create an Expired Project
    const project = await Project.create({
      projectName: "Legacy Medical Equipment Fund",
      projectCategory: "Healthcare Infrastructure",
      projectType: "Standard",
      targetAmount: 500000.00,
      collectedAmount: 150000.00, // Partially funded
      minInvestmentAmount: 10000.00,
      roi: 12.5,
      duration: 12,
      status: "EXPIRED",
      activeDeadline: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    });

    console.log(`Project created: ${project.projectName} (ID: ${project.id})`);

    // 3. Create Investments
    // Investment 1: Already paid back
    await Investment.create({
      projectId: project.id,
      userId: user.id,
      amount: 100000.00,
      paymentId: "pay_dummy_1",
      orderId: "order_dummy_1",
      status: "SUCCESS",
      paybackStatus: "PAID",
      paybackProof: "uploads/payback/dummy_proof.jpg"
    });

    // Investment 2: Pending payback
    await Investment.create({
      projectId: project.id,
      userId: user.id,
      amount: 50000.00,
      paymentId: "pay_dummy_2",
      orderId: "order_dummy_2",
      status: "SUCCESS",
      paybackStatus: "PENDING"
    });

    console.log('Dummy investments created. Project is now "partially paid" (some investors paid, some pending).');
    process.exit(0);
  } catch (error) {
    console.error('Error creating dummy data:', error);
    process.exit(1);
  }
}

createDummyData();
