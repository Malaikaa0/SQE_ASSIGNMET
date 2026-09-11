// Email delivery for critical alerts (Req 6501). If SMTP isn't configured
// (no SMTP_HOST), alerts are logged to the console instead of failing —
// convenient for local/dev use without a mail server.
const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function sendAlertEmail({ subject, text }) {
  if (!transporter) {
    console.log(`[EMAIL-SIMULATED] (configure SMTP_HOST in .env to send real emails)\nSubject: ${subject}\n${text}`);
    return { simulated: true };
  }
  try {
    await transporter.sendMail({
      from: process.env.ALERT_EMAIL_FROM || 'library-alerts@example.com',
      to: process.env.ALERT_EMAIL_TO || 'admin@example.com',
      subject,
      text,
    });
    return { simulated: false };
  } catch (err) {
    console.error('Failed to send alert email:', err.message);
    return { simulated: false, error: err.message };
  }
}

module.exports = { sendAlertEmail };
