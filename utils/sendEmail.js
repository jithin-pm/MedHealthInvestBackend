const transporter = require("../config/email");
const { getLogoAttachment } = require("./emailLayout");

const SECURITY_FROM = '"Med Health Invest Security" <noreply@medhealthinvest.com>';
const NOTIFICATION_FROM = process.env.EMAIL_FROM || '"Med Health Invest Notification" <noreply@medhealthinvest.com>';

/**
 * Send an email via Hostinger mail account (noreply@medhealthinvest.com)
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email body in HTML
 * @param {string} [options.text] - Email body in plain text (optional)
 * @param {string} [options.from] - Custom from address
 * @param {string} [options.replyTo] - Custom reply-to address
 * @param {boolean} [options.isSecurity] - If true, sends from "Med Health Invest Security"
 * @returns {Promise}
 */
const sendEmail = async (options) => {
  try {
    const { to, subject, html, text, bcc, cc, attachments, from, replyTo, isSecurity } = options;
    const defaultSender = isSecurity ? SECURITY_FROM : NOTIFICATION_FROM;
    const sender = from || defaultSender;

    const info = await transporter.sendMail({
      from: sender,
      replyTo: replyTo || 'noreply@medhealthinvest.com',
      to,
      subject,
      text: text || (html ? html.replace(/<[^>]*>?/gm, '') : ''),
      html,
      bcc,
      cc,
      attachments: [getLogoAttachment(), ...(attachments || [])]
    });

    console.log("Email sent successfully via Hostinger: %s to %s (From: %s)", info.messageId, to, sender);
    return info;
  } catch (error) {
    console.error("Error sending email via Hostinger:", error.message || error);
    throw error;
  }
};

sendEmail.SECURITY_FROM = SECURITY_FROM;
sendEmail.NOTIFICATION_FROM = NOTIFICATION_FROM;

module.exports = sendEmail;
