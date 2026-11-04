const transporter = require("../config/email");
const { getLogoAttachment } = require("./emailLayout");

/**
 * Send an email via Hostinger mail account (noreply@medhealthinvest.com)
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email body in HTML
 * @param {string} [options.text] - Email body in plain text (optional)
 * @param {string} [options.from] - Custom from address
 * @param {string} [options.replyTo] - Custom reply-to address
 * @returns {Promise}
 */
const sendEmail = async (options) => {
  try {
    const { to, subject, html, text, bcc, cc, attachments, from, replyTo } = options;
    const defaultSender = process.env.EMAIL_FROM || '"Med Health Invest" <noreply@medhealthinvest.com>';
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

    console.log("Email sent successfully via Hostinger: %s to %s", info.messageId, to);
    return info;
  } catch (error) {
    console.error("Error sending email via Hostinger:", error.message || error);
    throw error;
  }
};

module.exports = sendEmail;
