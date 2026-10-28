const transporter = require("../config/email");
const { getLogoAttachment } = require("./emailLayout");

/**
 * Send an email
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
    const sender = from || process.env.EMAIL_FROM;

    const activeTransporter = (transporter.hostingerTransporter && sender && sender.includes('noreply@medhealthinvest.com'))
      ? transporter.hostingerTransporter
      : transporter;

    const info = await activeTransporter.sendMail({
      from: sender,
      replyTo: replyTo || sender,
      to,
      subject,
      text: text || (html ? html.replace(/<[^>]*>?/gm, '') : ''),
      html,
      bcc,
      cc,
      attachments: [getLogoAttachment(), ...(attachments || [])]
    });

    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = sendEmail;
