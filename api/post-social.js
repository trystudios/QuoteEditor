// Fired by Vercel Cron Mon-Fri at 6:00 PM IST (see vercel.json). Posts
// today's quote card to the Facebook Page and Instagram, using the same
// stored week data (and JPG-priority-over-render logic) as send-daily.js.
//
// X (Twitter) posting is built (lib/x-post.js, OAuth 1.0a, tested working)
// but NOT called here - X's API now requires paid credits to actually post
// a tweet (media upload alone succeeded, but tweet creation returned
// "credits depleted", HTTP 402), and the user doesn't want to pay for it.
// Re-enable by importing postToX/X_CAPTION from lib/x-post and adding it
// to the try/catch block below, once/if there's budget for X API credits.
//
// Also callable manually with ?date=YYYY-MM-DD and ?dryRun=1, same as
// send-daily.js.

const { resolveTodayFile, getTodayImageBuffer, put } = require("../lib/week-data");
const { postToFacebookPage, CAPTION } = require("../lib/facebook-post");
const { postToInstagram } = require("../lib/instagram-post");
const { sendGmail } = require("../lib/gmail-send");

const ALERT_EMAIL = process.env.ALERT_EMAIL || "rajeshnrathod@gmail.com";

async function alertOnFailure(todayIso, results) {
  const failures = [];
  if (results.facebookError) failures.push(`Facebook: ${results.facebookError}`);
  if (results.instagramError) failures.push(`Instagram: ${results.instagramError}`);
  if (!failures.length) return;
  try {
    await sendGmail({
      to: ALERT_EMAIL,
      subject: `QuoteEditor: social post failed for ${todayIso}`,
      html: `<p>The ${todayIso} quote failed to post to:</p><ul>${failures
        .map((f) => `<li>${f}</li>`)
        .join("")}</ul>`,
    });
  } catch (e) {
    // Best-effort alert - don't let a broken mailer mask the original failure.
  }
}

function checkAuth(req) {
  if (!process.env.CRON_SECRET) return true;
  const authHeader = req.headers.authorization;
  const authQuery = req.query && req.query.secret;
  return authHeader === `Bearer ${process.env.CRON_SECRET}` || authQuery === process.env.CRON_SECRET;
}

module.exports = async (req, res) => {
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

  const { todayIso, weekStart, file } = result;
  const imageBuffer = await getTodayImageBuffer(file);
  const usedProvidedJpg = Boolean(file.jpg_b64);

  if (dryRun) {
    res.status(200).json({ dryRun: true, todayIso, weekStart, file: file.name, usedProvidedJpg, caption: CAPTION });
    return;
  }

  let imageUrl;
  try {
    // Instagram needs a public image URL (no direct upload); Facebook's
    // /photos endpoint takes the raw bytes directly. Upload once, use for
    // IG, pass the buffer straight through for FB.
    ({ url: imageUrl } = await put(`social/${todayIso}.jpg`, imageBuffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true,
    }));
  } catch (e) {
    await alertOnFailure(todayIso, { facebookError: `Blob upload: ${e.message}`, instagramError: `Blob upload: ${e.message}` });
    res.status(500).json({ posted: false, todayIso, weekStart, file: file.name, blobUploadError: e.message });
    return;
  }

  const results = {};
  try {
    results.facebook = await postToFacebookPage(imageBuffer);
  } catch (e) {
    results.facebookError = e.message;
  }
  try {
    results.instagram = await postToInstagram(imageUrl, CAPTION);
  } catch (e) {
    results.instagramError = e.message;
  }
  await alertOnFailure(todayIso, results);
  res.status(200).json({ posted: true, todayIso, weekStart, file: file.name, usedProvidedJpg, imageUrl, ...results });
};
