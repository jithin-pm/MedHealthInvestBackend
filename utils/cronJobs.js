const cron = require('node-cron');
const { Op } = require('sequelize');
const SpecialInvestment = require('../models/specialInvestmentModel');
const SpecialProject = require('../models/specialProjectModel');
const SpecialInvestmentLedger = require('../models/specialInvestmentLedgerModel');
const Project = require('../models/projectModel');
const Admin = require('../models/adminModel');
const User = require('../models/userModel');
const sendEmail = require('./sendEmail');
const { getProjectCompletionReminderAdminTemplate, getGracePeriodNotificationTemplate } = require('./emailTemplates');

/**
 * Monthly interest accrual for Special Projects
 */
const runMonthlyInterestAccrual = async () => {
    console.log("[CRON] Running monthly interest accrual for Special Projects...");
    try {
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
            
            const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);

            if (investmentDate >= cutoffDate) {
                console.log(`[CRON] Skipping Investment ID: ${investment.id} (Invested ${investmentDate.toISOString()} - next payout will be next month)`);
                continue;
            }

            const principal = parseFloat(investment.amountInvested);
            const roi = parseFloat(investment.project.roi);
            
            const interest = (principal * roi) / 100;
            const newAccumulatedInterest = parseFloat(investment.accumulatedInterest || 0) + interest;
            const totalBalance = parseFloat(investment.remainingCapital) + newAccumulatedInterest;

            await SpecialInvestmentLedger.create({
                specialInvestmentId: investment.id,
                transactionType: 'INTEREST_ACCRUED',
                amount: interest.toFixed(2),
                balanceAfter: totalBalance.toFixed(2),
                description: `Monthly Interest (${roi}%)`,
                transactionDate: new Date()
            });

            investment.accumulatedInterest = newAccumulatedInterest.toFixed(2);
            await investment.save();

            console.log(`[CRON] Accrued ${interest.toFixed(2)} interest for Investment ID: ${investment.id}. New Accumulated Interest: ${newAccumulatedInterest.toFixed(2)}`);
        }
        
        console.log("[CRON] Monthly interest accrual completed.");
    } catch (error) {
        console.error("[CRON] Error during monthly interest accrual:", error);
    }
};

/**
 * Dispatches Grace Period notification emails to users on the 1st of the month
 * for Special Project investments created during the previous month.
 */
const runGracePeriodNotificationCheck = async (options = {}) => {
    const force = options.force || false;
    const now = options.date ? new Date(options.date) : new Date();

    // Under standard cron execution, this executes on the 1st of the month
    if (!force && now.getDate() !== 1) {
        console.log(`[CRON] Today is day ${now.getDate()} of the month. Grace period email check executes only on the 1st.`);
        return;
    }

    console.log(`[CRON] Checking Special Investments for Grace Period notifications (Date: ${now.toISOString()})...`);
    try {
        // Investments made in the preceding month enter their Grace Period on the 1st of the current month
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);

        const whereClause = {
            status: 'SUCCESS',
            paybackStatus: 'PENDING',
            gracePeriodEmailSent: false,
            created_at: {
                [Op.gte]: previousMonthStart,
                [Op.lt]: currentMonthStart
            }
        };

        if (options.investmentId) {
            delete whereClause.created_at;
            delete whereClause.gracePeriodEmailSent;
            whereClause.id = options.investmentId;
        }

        const eligibleInvestments = await SpecialInvestment.findAll({
            where: whereClause,
            include: [
                {
                    model: SpecialProject,
                    as: 'project',
                    where: {
                        status: ['ACTIVE', 'ONGOING']
                    }
                },
                {
                    model: User,
                    as: 'investor',
                    attributes: ['id', 'fullName', 'email']
                }
            ]
        });

        console.log(`[CRON] Found ${eligibleInvestments.length} special investment(s) in their Grace Period month.`);

        for (const invInstance of eligibleInvestments) {
            const inv = invInstance.get ? invInstance.get({ plain: true }) : invInstance;
            const user = inv.investor || (inv.userId ? await User.findByPk(inv.userId) : null);
            const project = inv.project || (inv.specialProjectId ? await SpecialProject.findByPk(inv.specialProjectId) : null);

            if (!user || !user.email) {
                console.warn(`[CRON] No email found for investor of Investment ID ${inv.id}. Skipping.`);
                continue;
            }

            if (!project) {
                console.warn(`[CRON] No project found for Investment ID ${inv.id}. Skipping.`);
                continue;
            }

            try {
                const emailHtml = getGracePeriodNotificationTemplate(inv, project, user, now);
                await sendEmail({
                    to: user.email,
                    subject: `[MedHealth Invest] Investment Grace Period Commenced: ${project.projectName}`,
                    html: emailHtml
                });

                await invInstance.update({ gracePeriodEmailSent: true });
                console.log(`[CRON] Grace Period email sent to ${user.email} for investment #${inv.id} (${project.projectName})`);
            } catch (sendErr) {
                console.error(`[CRON] Failed to send Grace Period email to ${user.email} (Investment #${inv.id}):`, sendErr.message);
            }
        }

        console.log("[CRON] Grace Period notification check completed.");
    } catch (error) {
        console.error("[CRON] Error during Grace Period notification check:", error);
    }
};

/**
 * Check projects completing within 30 days and 1 day, and send email reminder to admin
 * Note: Only Standard and Exclusive projects have a fixed tenure completion date.
 * Special projects do not have an ending date and are therefore excluded.
 */
const runProjectCompletionReminderCheck = async () => {
    console.log("[CRON] Checking projects for completion reminders (30 days & 1 day)...");
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // 1. Fetch Admin Recipients
        let adminRecipients = [];
        try {
            const admins = await Admin.findAll({ attributes: ['email', 'fullName'] });
            adminRecipients = admins.filter(a => a.email).map(a => ({ email: a.email.trim(), fullName: a.fullName }));
        } catch (adminErr) {
            console.error("[CRON] Error fetching admins:", adminErr.message);
        }

        // Fallback to environment variables if no admins in table
        if (adminRecipients.length === 0) {
            const fallbackEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER;
            if (fallbackEmail) {
                adminRecipients.push({ email: fallbackEmail, fullName: 'Administrator' });
            }
        }

        if (adminRecipients.length === 0) {
            console.warn("[CRON] No admin email found for project maturity reminders.");
            return;
        }

        // 2. Fetch all ONGOING projects (Standard and Exclusive only)
        const ongoingProjects = await Project.findAll({ 
            where: { status: 'ONGOING' } 
        }).catch(() => []);

        console.log(`[CRON] Found ${ongoingProjects.length} ongoing standard/exclusive projects to evaluate for maturity reminders.`);

        for (const projectInstance of ongoingProjects) {
            const p = projectInstance.get ? projectInstance.get({ plain: true }) : projectInstance;
            let maturityDate = null;

            if (p.completionDate) {
                maturityDate = new Date(p.completionDate);
            } else if (p.ongoingStartDate && p.duration) {
                maturityDate = new Date(new Date(p.ongoingStartDate).getTime() + (parseInt(p.duration) * 30 * 24 * 60 * 60 * 1000));
            } else if (p.duration && (p.created_at || p.createdAt)) {
                const start = new Date(p.created_at || p.createdAt);
                maturityDate = new Date(start.getTime() + (parseInt(p.duration) * 30 * 24 * 60 * 60 * 1000));
            }

            if (!maturityDate || isNaN(maturityDate.getTime())) continue;

            const startOfMaturity = new Date(maturityDate.getFullYear(), maturityDate.getMonth(), maturityDate.getDate());
            const diffDays = Math.ceil((startOfMaturity - startOfToday) / (1000 * 60 * 60 * 24));

            // Reset flags if project tenure was modified/extended beyond 30 days
            if (diffDays > 30 && (p.reminder30DaysSent || p.reminder1DaySent)) {
                await projectInstance.update({ reminder30DaysSent: false, reminder1DaySent: false });
            }

            // Milestone A: 30-Day Reminder
            // Triggers when project is within 30 days (diffDays <= 30 and > 1) and hasn't been sent yet
            if (diffDays <= 30 && diffDays > 1 && !p.reminder30DaysSent) {
                console.log(`[CRON] Sending 30-day completion reminder for project: "${p.projectName}" (${diffDays} days left)...`);
                
                for (const admin of adminRecipients) {
                    try {
                        const emailHtml = getProjectCompletionReminderAdminTemplate(p, diffDays, admin);
                        await sendEmail({
                            to: admin.email,
                            subject: `[Reminder] Project "${p.projectName}" Completing in ${diffDays} Days`,
                            html: emailHtml
                        });
                        console.log(`[CRON] Sent 30-day reminder for "${p.projectName}" to ${admin.email}`);
                    } catch (mailErr) {
                        console.error(`[CRON] Failed to send 30-day reminder to ${admin.email}:`, mailErr.message);
                    }
                }

                await projectInstance.update({ reminder30DaysSent: true });
            }

            // Milestone B: 1-Day Reminder
            // Triggers when project is 1 day or less from maturity (diffDays <= 1 and >= 0) and hasn't been sent yet
            if (diffDays <= 1 && diffDays >= 0 && !p.reminder1DaySent) {
                console.log(`[CRON] Sending 1-day urgent completion reminder for project: "${p.projectName}" (${diffDays} days left)...`);
                
                for (const admin of adminRecipients) {
                    try {
                        const emailHtml = getProjectCompletionReminderAdminTemplate(p, diffDays, admin);
                        await sendEmail({
                            to: admin.email,
                            subject: `[Urgent Reminder] Project "${p.projectName}" Completing Tomorrow (1 Day Left)`,
                            html: emailHtml
                        });
                        console.log(`[CRON] Sent 1-day reminder for "${p.projectName}" to ${admin.email}`);
                    } catch (mailErr) {
                        console.error(`[CRON] Failed to send 1-day reminder to ${admin.email}:`, mailErr.message);
                    }
                }

                await projectInstance.update({ reminder1DaySent: true });
            }
        }

        console.log("[CRON] Project completion reminder check finished.");
    } catch (error) {
        console.error("[CRON] Error during project completion reminder check:", error);
    }
};

const setupCronJobs = () => {
    // Schedule for 1st of every month at 00:00 for monthly interest accrual & grace period notifications
    cron.schedule('0 0 1 * *', async () => {
        await runMonthlyInterestAccrual();
        await runGracePeriodNotificationCheck();
    });

    // Schedule daily at 09:00 AM for project completion reminders (Standard & Exclusive projects)
    cron.schedule('0 9 * * *', () => {
        runProjectCompletionReminderCheck();
    });

    // Also run an initial check 10 seconds after server boot to prevent missed alerts
    setTimeout(() => {
        runProjectCompletionReminderCheck();
        if (new Date().getDate() === 1) {
            runGracePeriodNotificationCheck();
        }
    }, 10000);

    console.log("Cron jobs scheduled: Monthly interest accrual, Grace period notifications & Project completion reminders.");
};

module.exports = {
    setupCronJobs,
    runMonthlyInterestAccrual,
    runProjectCompletionReminderCheck,
    runGracePeriodNotificationCheck
};
