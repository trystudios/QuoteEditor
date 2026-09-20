// Fired by Vercel Cron Mon-Fri at 6:00 PM IST (see vercel.json). Posts
// today's quote card to the Facebook Page and Instagram, using the same
// stored week data (and JPG-priority-over-render logic) as send-daily.js.
//
// Also callable manually with ?date=YYYY-MM-DD and ?dryRun=1, same as
// send-daily.js.

const { resolveTodayFile, getTodayImageBuffer, put } = require("../lib/week-data");
const { postToFacebookPage, CAPTION } = require("../lib/facebook-post");
const { postToInstagram } = require("../lib/instagram-post");

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

  // Instagram needs a public image URL (no direct upload); Facebook's
  // /photos endpoint takes the raw bytes directly. Upload once, use for IG,
  // pass the buffer straight through for FB.
  const { url: imageUrl } = await put(`social/${todayIso}.jpg`, imageBuffer, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true,
  });

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

  res.status(200).json({ posted: true, todayIso, weekStart, file: file.name, usedProvidedJpg, imageUrl, ...results });
};
