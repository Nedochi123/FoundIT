// Small helpers for showing boost times. The plans and prices come from the server (GET /api/boosts/plans),
// which owns them; see BOOST_PLANS in backend/src/utils/boosts.js.

// SQLite times look like "2026-10-09 14:30:00" (UTC)
const toDate = (iso) => new Date(String(iso).replace(" ", "T") + "Z");

/** "2 days 4 hours left", "5 hours left", "30 minutes left" */
export function timeLeft(iso) {
  const ms = toDate(iso).getTime() - Date.now();
  if (ms <= 0) return "ending now";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"}${hours ? ` ${hours} ${hours === 1 ? "hour" : "hours"}` : ""} left`;
  if (hours > 0) return `${hours} ${hours === 1 ? "hour" : "hours"} left`;
  const left = Math.max(1, mins);
  return `${left} ${left === 1 ? "minute" : "minutes"} left`;
}

/** "Tue, 3:20 pm" */
export function formatWhen(iso) {
  return toDate(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/** "just now", "5m ago", "3h ago", "2d ago" */
export function timeAgo(iso) {
  const mins = Math.floor((Date.now() - toDate(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
