const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html
  });
}

module.exports = {
  sendEmail
};