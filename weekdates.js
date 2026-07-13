// Shared Mon-Fri "week" date helpers used by both index.html (tabs) and
// data.html (the admin upload page). Weeks are always identified by their
// Monday, formatted as YYYY-MM-DD.

// The Monday of "the week you should currently be looking at": if today is
// Sat/Sun, that's next Monday; otherwise it's the Monday of the week
// containing today (so it doesn't roll forward again until the following
// Sat/Sun). Matches QuoteMaker_v2's own default-week-picker logic.
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
