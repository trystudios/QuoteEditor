// Shared "find today's stored quote" logic - used by both api/send-daily.js
// (email) and api/post-social.js (Facebook/Instagram), so both automations
// look up the same day's data the same way.

const { list, put } = require("@vercel/blob");
const { renderQuoteJpg } = require("./render-quote");

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

// Resolves ?date=/todayInIst() + weekend-skip into { todayIso, weekStart,
// week, file } or a { skipped: reason } result.
async function resolveTodayFile(dateOverride) {
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
    return { skipped: "Weekend", todayIso };
  }

  const weekStart = mondayOf(todayIso, dow);
  const week = await loadWeek(weekStart);
  if (!week) {
    return { skipped: `No stored week for ${weekStart}`, todayIso, weekStart };
  }

  const file = (week.files || []).find((f) => fileMatchesDate(f.name, todayIso));
  if (!file) {
    return { skipped: `No recipe for ${todayIso} in week ${weekStart}`, todayIso, weekStart };
  }

  return { todayIso, weekStart, week, file };
}

// Prefer an already-exported JPG (uploaded via /data alongside the JSON)
// over rendering - it's a proven-reliable image and skips the renderer's
// known-flaky font registration under warm-instance reuse.
async function getTodayImageBuffer(file) {
  return file.jpg_b64 ? Buffer.from(file.jpg_b64, "base64") : renderQuoteJpg(file.recipe);
}

function unchangeEntryFor(week, todayIso) {
  const entry = (week.unchangeLinks || {})[todayIso] || "";
  const url = typeof entry === "string" ? entry : entry.url || "";
  const title = typeof entry === "object" ? entry.title : "";
  return { url, title };
}

module.exports = { resolveTodayFile, getTodayImageBuffer, unchangeEntryFor, put };
