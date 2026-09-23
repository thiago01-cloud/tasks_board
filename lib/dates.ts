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

// "15 janvier 2026 à 17:30"
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
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
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "15 janvier 2026" — date only, e.g. for "created on".
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
