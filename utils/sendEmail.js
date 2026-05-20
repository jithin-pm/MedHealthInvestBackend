const transporter = require("../config/email");
const { getLogoAttachment } = require("./emailLayout");

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email body in HTML
 * @param {string} [options.text] - Email body in plain text (optional)
 * @returns {Promise}
 */
const sendEmail = async (options) => {
  try {
    const { to, subject, html, text, bcc, cc, attachments } = options;
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
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
