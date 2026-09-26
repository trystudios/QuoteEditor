// Manually-triggered (for now) weekly digest email: subject names the
// week's date range, body lists all 5 quotes as plain text, and each
// day's JPG (not the JSON recipe) is attached.
//
// Usage: /api/send-week?weekStart=YYYY-MM-DD&secret=...&test=1
// weekStart must be the Monday key used when the week was uploaded via
// /data. ?test=1 sends only to WEEK_EMAIL_TEST_TO instead of the real
// BCC list. ?dryRun=1 builds everything but sends nothing.

const { loadWeek } = require("../lib/week-data");
const { sendGmail } = require("../lib/gmail-send");
const { parseRecipientEmails, DEFAULT_RECIPIENTS_TEXT } = require("../lib/recipients");

function checkAuth(req) {
  const authHeader = req.headers.authorization;
  const authQuery = req.query && req.query.secret;
  if (process.env.CRON_SECRET && (authHeader === `Bearer ${process.env.CRON_SECRET}` || authQuery === process.env.CRON_SECRET)) {
    return true;
  }
  // /data's upload flow triggers this straight from the browser with the
  // same admin password already entered there - no CRON_SECRET involved.
  const passwordQuery = req.query && req.query.password;
  if (process.env.UPLOAD_PASSWORD && passwordQuery === process.env.UPLOAD_PASSWORD) return true;
  return !process.env.CRON_SECRET && !process.env.UPLOAD_PASSWORD;
}

function subjectFor(week) {
  const files = week.files || [];
  const first = files[0].name;
  const last = files[files.length - 1].name;
  const year = week.weekStart.slice(0, 4);
  return `Quotes ${first}-${last}, ${year}`;
}

function bodyTextFor(week) {
  const lines = ["Quotes for the Week uploaded to : https://quoteeditor.vercel.app/", ""];
  (week.files || []).forEach((f, i) => {
    const quote = (f.recipe && f.recipe.quote && f.recipe.quote.text) || "";
    const attr = (f.recipe && f.recipe.attribution && f.recipe.attribution.text) || "- Prem Rawat";
    const quoteLines = quote.split("\n").map((l) => l.trim()).filter(Boolean);
    lines.push(`${i + 1}.`, ...quoteLines, attr, "");
  });
  return lines.join("\n");
}

function attachmentsFor(week) {
  return (week.files || [])
    .filter((f) => f.jpg_b64)
    .map((f) => ({
      filename: `${f.name.replace(/\s+/g, "-")}.jpg`,
      content: Buffer.from(f.jpg_b64, "base64"),
      contentType: "image/jpeg",
    }));
}

module.exports = async (req, res) => {
  if (!checkAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const weekStart = req.query && req.query.weekStart;
  if (!weekStart) {
    res.status(400).json({ error: "weekStart query param is required (YYYY-MM-DD Monday key)" });
    return;
  }

  const week = await loadWeek(weekStart);
  if (!week) {
    res.status(404).json({ error: `No stored week for ${weekStart}` });
    return;
  }

  const subject = subjectFor(week);
  const text = bodyTextFor(week);
  const attachments = attachmentsFor(week);

  const isTest = req.query && req.query.test === "1";
  const bcc = isTest
    ? [process.env.WEEK_EMAIL_TEST_TO || process.env.GMAIL_USER]
    : parseRecipientEmails(week.recipients || DEFAULT_RECIPIENTS_TEXT);

  const dryRun = req.query && req.query.dryRun === "1";
  if (dryRun) {
    res.status(200).json({ dryRun: true, subject, text, attachmentCount: attachments.length, bcc });
    return;
  }

  await sendGmail({ to: process.env.GMAIL_USER, bcc, subject, text, attachments });

  res.status(200).json({ sent: true, subject, attachmentCount: attachments.length, bcc });
};
