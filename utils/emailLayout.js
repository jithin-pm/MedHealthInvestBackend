
const path = require('path');

/**
 * Wraps content in a premium MedHealth Invest email layout
 * @param {string} title - The title of the email
 * @param {string} content - The HTML content to wrap
 * @returns {string} - Complete HTML email
 */
const wrapInBaseLayout = (title, content, userName = 'Valued Investor') => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');
        
        body {
          margin: 0;
          padding: 0;
          background-color: #f7f9fa;
          font-family: 'Outfit', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #1d4354;
          -webkit-font-smoothing: antialiased;
        }
        
        .email-wrapper {
          width: 100%;
          background-color: #f7f9fa;
          padding: 30px 0;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
        }
        
        .top-nav {
          padding: 20px 30px;
          text-align: right;
          font-size: 13px;
        }
        
        .top-nav a {
          color: #5e6d55;
          text-decoration: none;
          margin-left: 15px;
          font-weight: 600;
        }
        
        .hero-section {
          
          padding: 50px 40px;
          color: black;
          text-align: left;
        }
        
        .hero-section img {
          height: 40px;
          margin-bottom: 25px;
          filter: brightness(0) invert(1);
        }
        
        .hero-text {
          font-size: 36px;
          line-height: 1.2;
          font-weight: 700;
          margin: 0;
        }
        
        .content-body {
          padding: 40px;
          font-size: 16px;
          line-height: 1.6;
          color: #1d4354;
        }
        
        .greeting {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        
        .button {
          display: inline-block;
          padding: 15px 35px;
          background-color: #00c853;
          color: #ffffff !important;
          text-decoration: none;
          font-weight: 700;
          border-radius: 30px;
          margin: 25px 0;
          transition: transform 0.2s ease;
        }
        
        .footer {
          padding: 40px;
          text-align: center;
          font-size: 13px;
          color: #b2b2b2;
          border-top: 1px solid #f0f0f0;
        }
        
        .footer a {
          color: #00c853;
          text-decoration: none;
        }
        
        .project-card {
          background-color: #f8fcf9;
          border-radius: 15px;
          padding: 25px;
          margin: 25px 0;
          border: 1px solid #e8f5e9;
        }
        
        .detail-item {
          margin-bottom: 15px;
        }
        
        .detail-label {
          font-size: 12px;
          color: #818e94;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 1px;
        }
        
        .detail-value {
          font-size: 18px;
          font-weight: 700;
          color: #1d4354;
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="top-nav">
            <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/projects">Projects</a>
            <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}/profile">Dashboard</a>
            <a href="${process.env.FRONTEND_URL || 'https://medhealthinvest.com'}">Logout</a>
          </div>
          
          <div class="hero-section">
            <img src="cid:mhi-logo" alt="MedHealth Invest">
            <div class="hero-text">${title}</div>
          </div>
          
          <div class="content-body">
            <div class="greeting">Hi ${userName},</div>
            ${content}
          </div>
          
          <div class="footer">
            <p>&copy; 2026 MedHealth Invest. All rights reserved.</p>
            <p>
              <a href="#">Unsubscribe</a> | <a href="#">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Returns the attachment object for the logo
 */
const getLogoAttachment = () => {
  return {
    filename: 'logo.png',
    path: path.join(__dirname, '../assets/logo.png'),
    cid: 'mhi-logo'
  };
};

module.exports = { wrapInBaseLayout, getLogoAttachment };
