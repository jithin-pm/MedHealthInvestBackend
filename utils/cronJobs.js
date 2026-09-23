const cron = require('node-cron');
const SpecialInvestment = require('../models/specialInvestmentModel');
const SpecialProject = require('../models/specialProjectModel');
const SpecialInvestmentLedger = require('../models/specialInvestmentLedgerModel');

const runMonthlyInterestAccrual = async () => {
    console.log("[CRON] Running monthly interest accrual for Special Projects...");
    try {
        // Find all SUCCESS investments that are not fully paid
        const activeInvestments = await SpecialInvestment.findAll({
            where: {
                status: 'SUCCESS',
                paybackStatus: 'PENDING'
            },
            include: [{
                model: SpecialProject,
                as: 'project',
                where: {
                    status: ['ACTIVE', 'ONGOING']
                }
            }]
        });

        console.log(`[CRON] Found ${activeInvestments.length} active investments to process.`);

        for (const investment of activeInvestments) {
            const investmentDate = new Date(investment.created_at || investment.createdAt);
            const now = new Date();
            
            // We run on the 1st of the month (e.g. May 1st). 
            // We want a strict 1-month skip. This means ANY investment made in April (the previous month) 
            // must NOT get a payout on May 1st. They will get it on June 1st.
            // So the cutoff is exactly the 1st of the previous month at 00:00:00.
            const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);

            if (investmentDate >= cutoffDate) {
                console.log(`[CRON] Skipping Investment ID: ${investment.id} (Invested ${investmentDate.toISOString()} - next payout will be next month)`);
                continue;
            }

            const principal = parseFloat(investment.amountInvested);
            const roi = parseFloat(investment.project.roi);
            
            // Calculate simple interest based on the principal amount (no compounding)
            const interest = (principal * roi) / 100;
            const newAccumulatedInterest = parseFloat(investment.accumulatedInterest || 0) + interest;
            const totalBalance = parseFloat(investment.remainingCapital) + newAccumulatedInterest;

            // Log it in the ledger
            await SpecialInvestmentLedger.create({
                specialInvestmentId: investment.id,
                transactionType: 'INTEREST_ACCRUED',
                amount: interest.toFixed(2),
                balanceAfter: totalBalance.toFixed(2),
                description: `Monthly Interest (${roi}%)`,
                transactionDate: new Date()
            });

            // Update the investment accumulated interest
            investment.accumulatedInterest = newAccumulatedInterest.toFixed(2);
            await investment.save();

            console.log(`[CRON] Accrued ${interest.toFixed(2)} interest for Investment ID: ${investment.id}. New Accumulated Interest: ${newAccumulatedInterest.toFixed(2)}`);
        }
        
        console.log("[CRON] Monthly interest accrual completed.");
    } catch (error) {
        console.error("[CRON] Error during monthly interest accrual:", error);
    }
};

const setupCronJobs = () => {
    // Schedule for 1st of every month at 00:00
    cron.schedule('0 0 1 * *', () => {
        runMonthlyInterestAccrual();
    });

    console.log("Cron jobs scheduled.");
};

module.exports = {
    setupCronJobs,
    runMonthlyInterestAccrual // Exported for manual testing
};
