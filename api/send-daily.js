// Fired by Vercel Cron Mon-Fri at 8:15 AM IST (see vercel.json). Figures out
// today's date in IST, finds that week's stored recipes + Un-change links
// (uploaded via /data), gets today's image, and emails it.
//
// Also callable manually with ?date=YYYY-MM-DD to test a specific weekday
// without waiting for the schedule, and ?dryRun=1 to render+prep without
// actually sending.

const { resolveTodayFile, getTodayImageBuffer, unchangeEntryFor, put } = require("../lib/week-data");
const { buildEmailHtml } = require("../lib/email-template");
const { getYoutubeTitle } = require("../lib/youtube");
const { sendGmail } = require("../lib/gmail-send");

function checkAuth(req) {
  if (!process.env.CRON_SECRET) return true;
  const authHeader = req.headers.authorization;
  const authQuery = req.query && req.query.secret;
  return authHeader === `Bearer ${process.env.CRON_SECRET}` || authQuery === process.env.CRON_SECRET;
}

module.exports = async (req, res) => {
  // Vercel signs real cron invocations with this header when CRON_SECRET is
  // set; manual test hits (?date=... during setup) need the same secret as
  // a query param since they aren't cron-signed.
  if (!checkAuth(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const dryRun = req.query && req.query.dryRun === "1";
  const result = await resolveTodayFile(req.query && req.query.date);
  if (result.skipped) {
    res.status(200).json({ skipped: true, reason: result.skipped, todayIso: result.todayIso });
    return;
  }

  const { todayIso, weekStart, week, file } = result;

  // unchangeLinks entries are {url, title} - title is whatever was shown/
  // edited on the /data page at upload time. Older stored weeks may have a
  // plain string (url only, no saved title) - fall back to a live oEmbed
  // lookup in that case.
  const { url: unchangeUrl, title: savedTitle } = unchangeEntryFor(week, todayIso);

  const [imageBuffer, unchangeTitle] = await Promise.all([
    getTodayImageBuffer(file),
    savedTitle ? Promise.resolve(savedTitle) : getYoutubeTitle(unchangeUrl),
  ]);

  const { url: imageUrl } = await put(`sent/${todayIso}.jpg`, imageBuffer, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true,
  });

  const html = buildEmailHtml({ imageUrl, unchangeUrl, unchangeTitle, subject: "Quote of the Day" });

  const usedProvidedJpg = Boolean(file.jpg_b64);

  if (dryRun) {
    res.status(200).json({ dryRun: true, todayIso, weekStart, file: file.name, usedProvidedJpg, imageUrl, unchangeUrl, unchangeTitle });
    return;
  }

  const to = process.env.DAILY_EMAIL_TO || process.env.GMAIL_USER;
  await sendGmail({ to, subject: "Quote of the Day", html });

  res.status(200).json({ sent: true, todayIso, weekStart, file: file.name, usedProvidedJpg, to, imageUrl, unchangeTitle });
};
