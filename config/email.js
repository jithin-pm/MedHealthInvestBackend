const nodemailer = require("nodemailer");

// Primary Transporter: Hostinger Mail (noreply@medhealthinvest.com)
const host = process.env.HOSTINGER_EMAIL_HOST || process.env.EMAIL_HOST || 'smtp.hostinger.com';
const port = parseInt(process.env.HOSTINGER_EMAIL_PORT || process.env.EMAIL_PORT || '465');
const user = process.env.HOSTINGER_EMAIL_USER || process.env.EMAIL_USER || 'noreply@medhealthinvest.com';
const pass = process.env.HOSTINGER_EMAIL_PASS || process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass,
  },
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error(`Hostinger Nodemailer verification failed for ${user}:`, error.message);
  } else {
    console.log(`Hostinger Nodemailer is ready to send all emails from ${user}`);
  }
});

module.exports = transporter;
