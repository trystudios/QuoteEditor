// Fired by Vercel Cron Mon-Fri at 8:00 AM IST (see vercel.json). Figures out
// today's date in IST, finds that week's stored recipes + Un-change links
// (uploaded via /data), renders today's card server-side, and emails it.
//
// Also callable manually with ?date=YYYY-MM-DD to test a specific weekday
// without waiting for the schedule, and ?dryRun=1 to render+prep without
// actually sending.

const { list, put } = require("@vercel/blob");
const { renderQuoteJpg } = require("../lib/render-quote");
const { buildEmailHtml } = require("../lib/email-template");
const { getYoutubeTitle } = require("../lib/youtube");
const { sendGmail } = require("../lib/gmail-send");

const PREFIX = "weeks/";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayInIst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return { iso: `${get("year")}-${get("month")}-${get("day")}`, weekday: get("weekday") };
}

function mondayOf(iso, dow) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

function fileMatchesDate(fileName, targetIso) {
  const m = fileName.match(/^([A-Za-z]{3,})\s+(\d{1,2})/);
  if (!m) return false;
  const idx = MONTHS.findIndex((mo) => m[1].toLowerCase().startsWith(mo.toLowerCase()));
  if (idx === -1) return false;
  const [year, month, day] = targetIso.split("-").map(Number);
  return idx === month - 1 && Number(m[2]) === day;
}

async function loadWeek(weekStart) {
  const { blobs } = await list({ prefix: `${PREFIX}${weekStart}.json` });
  if (!blobs.length) return null;
  const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

module.exports = async (req, res) => {
  // Vercel signs real cron invocations with this header when CRON_SECRET is
  // set; manual test hits (?date=... during setup) need the same secret as
  // a query param since they aren't cron-signed.
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    const authQuery = req.query && req.query.secret;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && authQuery !== process.env.CRON_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  const dateOverride = req.query && req.query.date;
  const dryRun = req.query && req.query.dryRun === "1";

  let todayIso, weekday;
  if (dateOverride) {
    const d = new Date(`${dateOverride}T00:00:00Z`);
    todayIso = dateOverride;
    weekday = WEEKDAYS[d.getUTCDay()];
  } else {
    ({ iso: todayIso, weekday } = todayInIst());
  }

  const dow = WEEKDAYS.indexOf(weekday);
  if (dow === 0 || dow === 6) {
    res.status(200).json({ skipped: true, reason: "Weekend", todayIso });
    return;
  }

  const weekStart = mondayOf(todayIso, dow);
  const week = await loadWeek(weekStart);
  if (!week) {
    res.status(200).json({ skipped: true, reason: "No stored week for " + weekStart, todayIso });
    return;
  }

  const file = (week.files || []).find((f) => fileMatchesDate(f.name, todayIso));
  if (!file) {
    res.status(200).json({ skipped: true, reason: "No recipe for " + todayIso + " in week " + weekStart, todayIso });
    return;
  }

  // unchangeLinks entries are {url, title} - title is whatever was shown/
  // edited on the /data page at upload time. Older stored weeks may have a
  // plain string (url only, no saved title) - fall back to a live oEmbed
  // lookup in that case.
  const unchangeEntry = (week.unchangeLinks || {})[todayIso] || "";
  const unchangeUrl = typeof unchangeEntry === "string" ? unchangeEntry : unchangeEntry.url || "";
  const savedTitle = typeof unchangeEntry === "object" ? unchangeEntry.title : "";

  // Prefer an already-exported JPG (uploaded via /data alongside the JSON)
  // over rendering - it's a proven-reliable image and skips the renderer's
  // known-flaky font registration under warm-instance reuse (see README/
  // conversation history). Falls back to server-side rendering if no JPG
  // was provided for this day.
  const [imageBuffer, unchangeTitle] = await Promise.all([
    file.jpg_b64 ? Buffer.from(file.jpg_b64, "base64") : renderQuoteJpg(file.recipe),
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
