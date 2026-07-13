// Backs the /data admin page and the homepage's week tabs.
//
// Data model in Vercel Blob: one deterministic-pathname blob per week,
// weeks/<weekStart>.json -> { weekStart, files: [{ name, recipe }, ...] }.
//
// There's deliberately no separate "index" blob: list({prefix:'weeks/'}) is
// a live listing of what's actually in the store (unlike re-fetching a blob's
// *content* by URL, which sits behind Vercel Blob's CDN cache and can serve
// stale bytes for a while after an overwrite/delete of the same pathname).
// Existence/eviction/cap logic all reads through list(), never through a
// cached content fetch, so it can't go stale.
//
// GET    -> list of stored weeks (no password; it's the same data the public
//           blob URLs already expose, so there's nothing to gate on reads)
// POST   -> { password, weekStart, files } - upload/replace one week,
//           evicting the oldest stored week(s) if over the 20-file cap
// DELETE -> { password, weekStart } - remove one stored week

const { put, del, list } = require("@vercel/blob");

const PREFIX = "weeks/";
const MAX_FILES = 20;

function pathFor(weekStart) {
  return `${PREFIX}${weekStart}.json`;
}

async function listWeeks() {
  const { blobs } = await list({ prefix: PREFIX });
  return blobs
    .map((b) => {
      const m = b.pathname.match(/^weeks\/(\d{4}-\d{2}-\d{2})\.json$/);
      return m ? { weekStart: m[1], url: b.url } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

async function fileCountFor(weekEntry) {
  try {
    const res = await fetch(`${weekEntry.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data.files) ? data.files.length : 0;
  } catch (e) {
    return 0;
  }
}

function isMonday(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "")) return false;
  const d = new Date(dateStr + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1;
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const weeks = await listWeeks();
    // fileCount costs an extra fetch per week - only compute it when asked
    // (the /data admin page wants it; the homepage's tabs don't need it).
    if (req.query && req.query.counts === "1") {
      const withCounts = await Promise.all(
        weeks.map(async (w) => ({ ...w, fileCount: await fileCountFor(w) }))
      );
      res.status(200).json({ weeks: withCounts });
    } else {
      res.status(200).json({ weeks });
    }
    return;
  }

  const body = req.body || {};

  if (req.method === "POST") {
    if (body.password !== process.env.UPLOAD_PASSWORD) {
      res.status(401).json({ error: "Wrong password." });
      return;
    }
    if (!isMonday(body.weekStart)) {
      res.status(400).json({ error: "weekStart must be a YYYY-MM-DD Monday." });
      return;
    }
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) {
      res.status(400).json({ error: "No files provided." });
      return;
    }
    for (const f of files) {
      if (!f || typeof f.name !== "string" || typeof f.recipe !== "object") {
        res.status(400).json({ error: "Each file needs a name and a recipe object." });
        return;
      }
    }
    if (files.length > MAX_FILES) {
      res.status(400).json({ error: `This upload alone (${files.length} files) exceeds the ${MAX_FILES}-file cap.` });
      return;
    }

    let weeks = (await listWeeks()).filter((w) => w.weekStart !== body.weekStart);
    const counts = await Promise.all(weeks.map(fileCountFor));
    weeks = weeks.map((w, i) => ({ ...w, fileCount: counts[i] }));

    // Enforce the file cap by evicting the oldest stored week(s) first.
    let total = files.length + weeks.reduce((sum, w) => sum + w.fileCount, 0);
    while (total > MAX_FILES && weeks.length) {
      weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      const oldest = weeks.shift();
      total -= oldest.fileCount;
      try {
        await del(oldest.url);
      } catch (e) {
        // already gone - fine
      }
    }

    await put(pathFor(body.weekStart), JSON.stringify({ weekStart: body.weekStart, files }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });

    const finalWeeks = await listWeeks();
    res.status(200).json({ weeks: finalWeeks });
    return;
  }

  if (req.method === "DELETE") {
    if (body.password !== process.env.UPLOAD_PASSWORD) {
      res.status(401).json({ error: "Wrong password." });
      return;
    }
    const weeks = await listWeeks();
    const entry = weeks.find((w) => w.weekStart === body.weekStart);
    if (entry) {
      try {
        await del(entry.url);
      } catch (e) {
        // already gone - fine
      }
    }
    const finalWeeks = await listWeeks();
    res.status(200).json({ weeks: finalWeeks });
    return;
  }

  res.status(405).json({ error: "Method not allowed." });
};
