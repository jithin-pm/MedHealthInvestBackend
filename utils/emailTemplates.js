const { wrapInBaseLayout } = require("./emailLayout");

const getProjectLaunchTemplate = (project, user = {}) => {
  const { projectName, roi, duration, projectCategory } = project;
  const userName = user.fullName || 'Investor';
  
  const content = `
    <p>A new strategic investment opportunity is now available on our platform. We thought you might be interested in expanding your portfolio with this latest offering.</p>
    
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
        <div class="detail-label">Projected Annual ROI</div>
        <div class="detail-value" style="color: #00c853;">${roi}%</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Commitment Term</div>
        <div class="detail-value">${duration} Months</div>
      </div>
    </div>
    
    <p>This project has been carefully vetted to meet our standards for health-sector growth and financial resilience. Be seen, act quickly to secure your allocation.</p>
    
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
    
    <p>Performance reports and yield updates will be available through your private dashboard. Stay visible and respond fast when updates are posted.</p>
    
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

module.exports = { getProjectLaunchTemplate, getProjectOngoingTemplate, getProjectCompletedTemplate };

