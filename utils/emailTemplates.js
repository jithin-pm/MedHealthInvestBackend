const { wrapInBaseLayout } = require("./emailLayout");

const getProjectLaunchTemplate = (project, user = {}) => {
  const { projectName, roi, duration, projectCategory } = project;
  const userName = user.fullName || 'Investor';
  const minInvestmentAmount = project.minInvestmentAmount ?? (project.get ? project.get('minInvestmentAmount') : 1000);
  const formattedMinInvestment = Number(minInvestmentAmount || 1000).toLocaleString('en-IN');
  const yearlyRoi = (Number(roi || 0) * 12).toFixed(1).replace(/\.0$/, '');
  
  const content = `
    <p>A new strategic investment opportunity is now available on our platform. We thought you might be interested in expanding your portfolio with this latest offering.</p>
    
    <div style="display: inline-block; padding: 6px 14px; border-radius: 8px; background-color: #e8f5e9; color: #00c853; font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 20px;">
      ${roi}% Monthly ROI • Min. Investment ₹${formattedMinInvestment}
    </div>

    <div class="project-card">
      <div class="detail-item">
        <div class="detail-label">Project Name</div>
        <div class="detail-value">${projectName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Asset Classification</div>
        <div class="detail-value">${projectCategory}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Minimum Investment Amount</div>
        <div class="detail-value">₹${formattedMinInvestment}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label" style="color: #00c853; font-weight: 700;">Monthly ROI (Main Return)</div>
        <div class="detail-value" style="color: #00c853; font-size: 22px;">${roi}% per month</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Yearly ROI (Annualized)</div>
        <div class="detail-value">${yearlyRoi}% p.a.</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Commitment Term</div>
        <div class="detail-value">${duration} Months</div>
      </div>
    </div>
    
    <p>This project offers an attractive return of <strong>${roi}% monthly</strong> (approx. <strong>${yearlyRoi}% yearly</strong>) with accessible entry starting from <strong>₹${formattedMinInvestment}</strong>. It has been carefully vetted to meet our standards for health-sector growth and financial resilience.</p>
    
    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/project/${project.id}" class="button">Explore Project</a>
  `;

  return wrapInBaseLayout(`New Project Launched`, content, userName);
};

const getProjectOngoingTemplate = (project, user = {}) => {
  const { projectName, roi, duration, completionDate, id } = project;
  const userName = user.fullName || 'Investor';
  const formattedDate = new Date(completionDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const content = `
    <p>Great news! The subscription phase for <strong>${projectName}</strong> has concluded successfully. Your investment is now actively working.</p>
    
    <div class="project-card">
      <div class="detail-item">
        <div class="detail-label">Project</div>
        <div class="detail-value">${projectName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Contracted ROI</div>
        <div class="detail-value">${roi}%</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Maturity Date</div>
        <div class="detail-value">${formattedDate}</div>
      </div>
    </div>
    
    <p>Performance reports and yield updates will be available through your private profile. Stay visible and respond fast when updates are posted.</p>
    
    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/project/${id}" class="button">View Project Details</a>
  `;

  return wrapInBaseLayout(`Project is now Ongoing`, content, userName);
};

const getProjectCompletedTemplate = (project, user = {}) => {
  const { projectName, roi } = project;
  const userName = user.fullName || 'Investor';

  const content = `
    <p>We are excited to announce that <strong>${projectName}</strong> has successfully reached its full maturity. Your portfolio has been updated accordingly.</p>
    
    <div class="project-card" style="text-align: center; background-color: #e8f5e9;">
      <div class="detail-label" style="color: #00c853;">Portfolio Status</div>
      <div style="font-size: 24px; font-weight: 700; color: #004d40; margin: 10px 0;">MATURED & VERIFIED</div>
      <div class="detail-value">ROI: ${roi}% Achieved</div>
    </div>
    
    <p>Kindly review your account details to ensure a seamless settlement of your principal and accumulated yields. Be seen, act quickly to re-invest or withdraw.</p>
    
    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/profile" class="button">Check Settlement</a>
  `;

  return wrapInBaseLayout(`Project Matured Successfully`, content, userName);
};

const getPreSettledInvestmentTemplate = (project, user = {}) => {
  const { projectName, roi, duration, targetAmount } = project;
  const userName = user.fullName || 'Investor';

  const content = `
    <p>Great news! Your payment has been successfully verified by our team, and your invested timeline has started for <strong>${projectName}</strong>.</p>
    
    <div class="project-card">
      <div class="detail-item">
        <div class="detail-label">Project</div>
        <div class="detail-value">${projectName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Invested Amount</div>
        <div class="detail-value">₹${Number(targetAmount).toLocaleString('en-IN')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Yearly ROI</div>
        <div class="detail-value" style="color: #00c853;">${roi}%</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Duration</div>
        <div class="detail-value">${duration} Months</div>
      </div>
    </div>
    
    <p>Performance reports and yield updates will be available through your private profile.</p>
    
    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/profile" class="button">View Profile</a>
  `;

  return wrapInBaseLayout(`Investment Confirmation - ${projectName}`, content, userName);
};

const getInvestmentSuccessTemplate = (project, user = {}, amount) => {
  const { projectName, roi, duration } = project;
  const userName = user.fullName || 'Investor';

  const content = `
    <p>Congratulations! Your investment in <strong>${projectName}</strong> has been successfully processed.</p>
    
    <div class="project-card">
      <div class="detail-item">
        <div class="detail-label">Project Name</div>
        <div class="detail-value">${projectName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Invested Amount</div>
        <div class="detail-value">₹${Number(amount).toLocaleString('en-IN')}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Yearly ROI</div>
        <div class="detail-value" style="color: #00c853;">${roi}%</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Duration</div>
        <div class="detail-value">${duration} Months</div>
      </div>
    </div>
    
    <p>You can track your investment's performance and view your transaction history from your profile.</p>
    
    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/profile" class="button">View Profile</a>
  `;

  return wrapInBaseLayout(`Investment Successful - ${projectName}`, content, userName);
};


const getProjectCompletionReminderAdminTemplate = (project, daysRemaining, adminUser = {}) => {
  const { projectName, roi, duration, projectCategory, projectType } = project;
  const adminName = adminUser.fullName || 'Administrator';
  const target = project.targetAmount ? Number(project.targetAmount).toLocaleString('en-IN') : '0';
  const formattedDate = project.completionDate 
    ? new Date(project.completionDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'Upcoming';

  const isOneDay = daysRemaining <= 1;
  const headline = isOneDay 
    ? 'Critical Alert: Project Completing in 1 Day' 
    : 'Reminder: Project Completing in 30 Days';

  const urgencyBadgeColor = isOneDay ? '#e53935' : '#ff9800';
  const urgencyBadgeBg = isOneDay ? '#ffebee' : '#fff3e0';

  const content = `
    <p>This is an automated administrative notification regarding the maturity schedule of an active investment tenure.</p>
    
    <div style="display: inline-block; padding: 6px 14px; border-radius: 8px; background-color: ${urgencyBadgeBg}; color: ${urgencyBadgeColor}; font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 20px;">
      ${isOneDay ? '1 Day Remaining until Maturity' : '30 Days Remaining until Maturity'}
    </div>

    <div class="project-card">
      <div class="detail-item">
        <div class="detail-label">Project Name</div>
        <div class="detail-value">${projectName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Project Type & Category</div>
        <div class="detail-value">${projectType || 'Special'} • ${projectCategory}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Total Investment Allocation</div>
        <div class="detail-value">₹${target}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Contracted ROI & Duration</div>
        <div class="detail-value" style="color: #00c853;">${roi}% • ${duration} Months</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Target Maturity Completion Date</div>
        <div class="detail-value">${formattedDate}</div>
      </div>
    </div>
    
    <p>${
      isOneDay 
        ? '<strong>Action Required:</strong> This project will conclude tomorrow. Please review investor yield ledgers, verify bank accounts, and prepare for payout settlement initiation.'
        : '<strong>Advance Notice:</strong> This project will reach its full commitment term in 30 days. Please monitor ongoing performance and begin scheduling capital and yield payouts.'
    }</p>
    
    <a href="${process.env.ADMIN_URL || 'http://localhost:5174'}/dashboard/project-reminders" class="button" style="background-color: #00c853; color: #ffffff !important;">Review in Admin Reminders</a>
  `;

  return wrapInBaseLayout(headline, content, adminName);
};


/**
 * User notification sent on the 1st of the month when a Special Project investment enters its Grace Period (Cooling Period)
 * @param {Object} investment - The special investment instance/object
 * @param {Object} project - The special project instance/object
 * @param {Object} user - The investor user object { fullName, email }
 * @param {Date} [referenceDate] - Optional reference date
 */
const getGracePeriodNotificationTemplate = (investment, project, user = {}, referenceDate = new Date()) => {
  const { projectName, roi } = project;
  const userName = user.fullName || 'Valued Investor';
  const amountInvested = investment.amountInvested ? Number(investment.amountInvested).toLocaleString('en-IN') : '0';

  // Calculate Grace Month (month following investment) and First Payout Date (2 months following investment)
  const invDate = new Date(investment.created_at || investment.createdAt || referenceDate);
  const graceDate = new Date(invDate.getFullYear(), invDate.getMonth() + 1, 1);
  const graceMonthName = graceDate.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });

  const firstPayoutDate = new Date(invDate.getFullYear(), invDate.getMonth() + 2, 1);
  const formattedFirstPayoutDate = firstPayoutDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const content = `
    <p>We are pleased to inform you that your strategic investment in <strong>${projectName}</strong> has officially entered its designated <strong>Grace Period</strong> (Cooling & Capital Deployment Phase) for the month of <strong>${graceMonthName}</strong>.</p>
    
    <div style="display: inline-block; padding: 6px 14px; border-radius: 8px; background-color: #e8f5e9; color: #00c853; font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 20px;">
      Grace Period Active • Capital Secured
    </div>

    <div class="project-card">
      <div class="detail-item">
        <div class="detail-label">Project Name</div>
        <div class="detail-value">${projectName}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Invested Capital</div>
        <div class="detail-value">₹${amountInvested}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Grace Period Month</div>
        <div class="detail-value" style="color: #0288d1;">${graceMonthName} (Cooling Phase)</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Contracted Monthly Return</div>
        <div class="detail-value" style="color: #00c853;">${roi}% per month</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">First Return Accrual / Payout Date</div>
        <div class="detail-value">${formattedFirstPayoutDate}</div>
      </div>
    </div>
    
    <p><strong>What is the Grace Period?</strong></p>
    <p>In accordance with MedHealth Invest Special Project guidelines, the first month following capital allocation serves as a deployment and infrastructure ramp-up period. During this cooling phase, your funds are securely allocated and actively working in healthcare operations. No return payouts take place during this initial month.</p>
    
    <p><strong>What happens next?</strong></p>
    <p>Starting from <strong>${formattedFirstPayoutDate}</strong>, your monthly contracted returns of <strong>${roi}%</strong> will begin accruing and will be credited to your ledger on the 1st of each subsequent month.</p>
    
    <p>You can track your investment portfolio, monthly accruals, and transaction records in real-time through your investor dashboard.</p>
    
    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/profile" class="button">View My Portfolio</a>
  `;

  return wrapInBaseLayout(`Investment Grace Period Commenced`, content, userName);
};


/**
 * Security email sent when a user enters an incorrect password or exceeds attempts
 */
const getFailedLoginAttemptTemplate = (user, attemptsLeft) => {
  const userName = user.fullName || 'Valued User';
  const now = new Date();
  const formattedTime = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const isLocked = attemptsLeft <= 0;
  const attemptsUsed = 3 - attemptsLeft;

  const content = isLocked ? `
    <div style="display: inline-block; padding: 6px 14px; border-radius: 8px; background-color: #ffebee; color: #c62828; font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 20px;">
      Account Temporarily Blocked (24 Hours)
    </div>

    <p>We detected <strong>3 consecutive failed sign-in attempts</strong> on your MedHealth Invest account with an incorrect password.</p>

    <div class="project-card" style="border-left: 4px solid #c62828;">
      <div class="detail-item">
        <div class="detail-label">Security Status</div>
        <div class="detail-value" style="color: #c62828;">BLOCKED FOR 24 HOURS</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Failed Attempts</div>
        <div class="detail-value">3 of 3 attempts used</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Event Timestamp</div>
        <div class="detail-value">${formattedTime}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Automatic Unblock Time</div>
        <div class="detail-value">24 Hours from event</div>
      </div>
    </div>

    <p>To protect your portfolio and sensitive financial assets, your account has been temporarily locked. You will be able to attempt login again after 24 hours.</p>

    <p><strong>Did not attempt to sign in?</strong><br>
    If you did not perform these sign-in attempts, your account credentials may be compromised. Please contact MedHealth Invest support immediately.</p>

    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/contact" class="button" style="background-color: #c62828;">Contact Security Support</a>
  ` : `
    <div style="display: inline-block; padding: 6px 14px; border-radius: 8px; background-color: #fff3e0; color: #e65100; font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 20px;">
      Security Warning • Failed Sign-In Attempt
    </div>

    <p>A sign-in attempt to your MedHealth Invest account failed due to an incorrect password.</p>

    <div class="project-card" style="border-left: 4px solid #ff9800;">
      <div class="detail-item">
        <div class="detail-label">Failed Password Attempt</div>
        <div class="detail-value">Attempt ${attemptsUsed} of 3</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Remaining Attempts</div>
        <div class="detail-value" style="color: #e65100; font-size: 22px;">${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Security Policy</div>
        <div class="detail-value">Account blocked for 24 hours after 3 failed attempts</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Timestamp</div>
        <div class="detail-value">${formattedTime}</div>
      </div>
    </div>

    <p><strong>Notice:</strong> You have <strong>${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left</strong>. If password entry fails 3 times, your account will be automatically <strong>blocked for 24 hours</strong> for security reasons.</p>

    <p>If you have forgotten your password, please reset it now before exhausting your remaining attempts.</p>

    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/forgot-password" class="button" style="background-color: #00c853;">Reset Password</a>
  `;

  const headline = isLocked ? `Account Temporarily Blocked` : `Security Alert: Failed Sign-In Attempt`;
  return wrapInBaseLayout(headline, content, userName);
};


/**
 * Security email sent when an admin unblocks a user's account
 */
const getAccountUnblockedTemplate = (user) => {
  const userName = user.fullName || 'Valued User';

  const content = `
    <div style="display: inline-block; padding: 6px 14px; border-radius: 8px; background-color: #e8f5e9; color: #00c853; font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 20px;">
      Account Unblocked
    </div>

    <p>Good news! Your MedHealth Invest account has been successfully unblocked by our administrative security team.</p>

    <div class="project-card" style="border-left: 4px solid #00c853;">
      <div class="detail-item">
        <div class="detail-label">Account Status</div>
        <div class="detail-value" style="color: #00c853;">ACTIVE & UNBLOCKED</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Failed Attempt Counter</div>
        <div class="detail-value">Reset to 0</div>
      </div>
    </div>

    <p>You may now sign in to your dashboard using your registered credentials.</p>

    <p>If you suspect unauthorized sign-in attempts were made on your account, we recommend updating your password immediately after logging in.</p>

    <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/login" class="button">Sign In to Dashboard</a>
  `;

  return wrapInBaseLayout(`Account Unblocked Successfully`, content, userName);
};

module.exports = {
  getAccountUnblockedTemplate,
  getFailedLoginAttemptTemplate,
  getGracePeriodNotificationTemplate,
  getProjectCompletionReminderAdminTemplate, getProjectLaunchTemplate, getProjectOngoingTemplate, getProjectCompletedTemplate, getPreSettledInvestmentTemplate, getInvestmentSuccessTemplate };
