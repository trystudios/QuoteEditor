// Sends mail through Gmail's own SMTP server, authenticated with an App
// Password (GMAIL_USER / GMAIL_APP_PASSWORD env vars) - the real sender
// account, no third-party relay, no click-tracking rewrites.

const nodemailer = require("nodemailer");

function getTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendGmail({ to, bcc, subject, html, text, attachments }) {
  const transport = getTransport();
  return transport.sendMail({
    from: `Quotes <${process.env.GMAIL_USER}>`,
    to,
    bcc,
    subject,
    html,
    text,
    attachments,
  });
}

module.exports = { sendGmail };
