// Shared Mon-Fri "week" date helpers used by both index.html (tabs) and
// data.html (the admin upload page). Weeks are always identified by their
// Monday, formatted as YYYY-MM-DD.

// The Monday of "the week you should currently be looking at": if today is
// Sat/Sun, that's next Monday; otherwise it's the Monday of the week
// containing today (so it doesn't roll forward again until the following
// Sat/Sun). Matches QuoteMaker_V3's own default-week-picker logic.
function currentOrUpcomingMonday(base) {
  const d = new Date(base || new Date());
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Parses a "<Mon> <day>" name (e.g. "Sep 21", from QuoteMaker_V3's export
// convention) into a sortable {month, day} pair, or null if it doesn't match.
function parseMonthDayName(name) {
  const m = (name || "").match(/^([A-Za-z]{3,})\s+(\d{1,2})/);
  if (!m) return null;
  const month = MONTH_NAMES.indexOf(m[1].toLowerCase().slice(0, 3));
  if (month === -1) return null;
  return { month, day: Number(m[2]) };
}

// Sorts file-like objects (anything with a `.name`) chronologically by their
// "<Mon> <day>" name, so drag-and-drop order never depends on filesystem/
// browser read order. Falls back to a plain string compare for names that
// don't match the convention.
function sortByDateName(items, getName) {
  const name = getName || ((x) => x.name);
  items.sort((a, b) => {
    const da = parseMonthDayName(name(a));
    const db = parseMonthDayName(name(b));
    if (da && db) return da.month - db.month || da.day - db.day;
    return name(a).localeCompare(name(b));
  });
  return items;
}

// "Jul 13-17, 2026" or "Jul 29-Aug 2, 2026" when the week spans two months.
function weekLabel(mondayIso) {
  const monday = new Date(mondayIso + "T00:00:00");
  const friday = addDays(monday, 4);
  const fmtMonth = (d) => d.toLocaleDateString("en-US", { month: "short" });
  const year = friday.getFullYear();
  if (monday.getMonth() === friday.getMonth()) {
    return `${fmtMonth(monday)} ${monday.getDate()}–${friday.getDate()}, ${year}`;
  }
  return `${fmtMonth(monday)} ${monday.getDate()}–${fmtMonth(friday)} ${friday.getDate()}, ${year}`;
}
