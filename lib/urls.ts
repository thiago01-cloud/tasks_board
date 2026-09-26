// Loose "is this a usable http(s) link" check for the optional task
// link/image-URL fields (see Task.linkUrl/imageUrl in prisma/schema.prisma,
// and POST /api/tasks + PATCH /api/tasks/[id]) — deliberately no
// stricter than that: nothing here verifies the URL actually resolves to
// anything or that an "image" URL really serves an image, exactly like a
// normal "paste a link" field elsewhere on the web. Shared by both
// routes so creating and editing a task reject the same malformed input
// the same way.
export function normalizeOptionalUrl(value: unknown): { ok: true; url: string | null } | { ok: false } {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return { ok: true, url: null };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false };
    return { ok: true, url: trimmed };
  } catch {
    return { ok: false };
  }
}
