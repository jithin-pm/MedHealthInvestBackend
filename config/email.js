const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error("Nodemailer verification failed:", error);
  } else {
    console.log("Nodemailer is ready to send emails");
  }
});

// Optional dedicated Hostinger transporter for noreply@medhealthinvest.com
if (process.env.HOSTINGER_EMAIL_PASS) {
  const hostingerTransporter = nodemailer.createTransport({
    host: process.env.HOSTINGER_EMAIL_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.HOSTINGER_EMAIL_PORT || '465'),
    secure: (process.env.HOSTINGER_EMAIL_PORT || '465') == 465,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER || 'noreply@medhealthinvest.com',
      pass: process.env.HOSTINGER_EMAIL_PASS,
    },
  });

  hostingerTransporter.verify(function (error, success) {
    if (error) {
      console.warn("Hostinger Nodemailer verification failed:", error.message);
    } else {
      console.log("Hostinger Nodemailer is ready to send from noreply@medhealthinvest.com");
    }
  });

  transporter.hostingerTransporter = hostingerTransporter;
}

module.exports = transporter;
