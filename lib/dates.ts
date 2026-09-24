// Small date helpers shared by the task board's forms and displays. A
// task's dueDate is a full DateTime (see prisma/schema.prisma) — a
// deadline is a precise moment ("today at 5pm"), not just a day.

// Converts an ISO datetime string (UTC, as stored/returned by the API)
// into the "YYYY-MM-DDTHH:mm" format an <input type="datetime-local">
// needs for its value — expressed in the browser's local time, not a
// naive slice(0, 16), which would show the UTC time instead.
export function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

// Converts an <input type="datetime-local"> value (implicitly local
// time, no timezone info) into a proper ISO string with an explicit UTC
// offset — done client-side, in the browser's own timezone, so the
// result is unambiguous no matter which timezone the server ends up
// running in (today that's the same machine as the browser, but this
// stays correct once deployed).
export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

// The app is used by one team, all in Gabon — fixed here rather than left
// to whichever timezone happens to be ambient where the formatting code
// runs. That ambient default is NOT reliable: these formatters are called
// from client components (TaskDetail.tsx, NotificationBell.tsx), but
// Next.js still renders those once on the server for the initial HTML —
// and Vercel's serverless functions run with TZ=UTC, not Gabon's. Without
// an explicit timeZone, that first (server) render showed the UTC hour —
// and, right around midnight WAT, even the wrong DAY — while the browser
// only fixed it up after hydration, if at all, which is exactly the "date
// de création qui ne correspond pas" bug this fixes. Africa/Libreville is
// WAT, UTC+1 year-round (no DST), so this needs no seasonal adjustment.
const DISPLAY_TIME_ZONE = "Africa/Libreville";

// "15 janvier 2026 à 17:30"
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "15 janv., 17:30" — compact form for cards and comment timestamps.
export function formatDateTimeShort(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "15 janvier 2026" — date only, e.g. for "created on".
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Formats a duration given in milliseconds as e.g. "2 j 5 h", "3 h 20 min"
// or "45 min" — always positive, the caller decides what the sign means
// (see TaskDetail.tsx's "on time / early / late" readout, the one place
// this is used). Rounds to the minute; under a minute reads as "< 1 min"
// rather than "0 min", which would misleadingly read as "no difference".
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60000);
  if (totalMinutes < 1) return "< 1 min";

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} j`);
  if (hours > 0) parts.push(`${hours} h`);
  // Minutes are only worth showing when they're the only unit, or the
  // finer of exactly two units (e.g. "3 h 20 min") — a third unit would
  // be more precision than this readout needs ("2 j 5 h 12 min").
  if (minutes > 0 && days === 0) parts.push(`${minutes} min`);
  if (parts.length === 0) parts.push(`${minutes} min`);

  return parts.join(" ");
}
