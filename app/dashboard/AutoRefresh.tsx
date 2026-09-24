"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps every dashboard page's server-rendered data (task board, task
// detail, dashboard stats, team page...) in sync with what the rest of the
// team is doing, without anyone needing to reload — a task moved or
// updated on one agent's screen reaches everyone else's on its own.
// Deliberately simple polling rather than a push service (WebSockets don't
// fit Vercel's serverless functions, and a managed push service like
// Pusher/Ably would mean a new external dependency + API key): every tick,
// router.refresh() re-runs the CURRENT route's server data fetch (same
// Prisma queries each page already has) and re-renders with fresh props —
// no new API routes needed, and every page that renders straight from
// props (TaskBoard, the dashboard stats, the team page) picks up changes
// for free. Pages that keep a local mirror of server data for optimistic
// UI (TaskDetail.tsx, SubtaskList.tsx) each have their own small
// useEffect that re-syncs from props when they change — see those files.
//
// Mounted once in dashboard/layout.tsx so it covers every page under
// /dashboard without each one wiring its own timer. Paused while the tab
// is hidden or the browser is offline, so a background tab doesn't keep
// spending requests (and Neon connections) for nobody.
const REFRESH_INTERVAL_MS = 8000;

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    function tick() {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      router.refresh();
      // Lets components that fetch their own data client-side (e.g.
      // NotificationBell) piggyback on the same cadence instead of each
      // running a separate timer.
      window.dispatchEvent(new Event("app:refresh-tick"));
    }

    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
