"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/enums";
import { formatDateTimeShort } from "@/lib/dates";

type NotificationItem = {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  task: { id: string; title: string } | null;
};

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Bell + dropdown for the notifications every task interaction generates
// (assignment, status/progress change, edit, comment — see
// PATCH /api/tasks/[id] and POST /api/tasks/[id]/comments) for whoever's
// linked to that task. Rendered twice by Sidebar.tsx (mobile bar + the
// desktop sidebar itself), each instance independent — a small app, not
// worth lifting shared state for.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Silent — the bell just stays as it was; not worth an error banner
      // for a background count refresh.
    }
    setLoading(false);
  }

  // Fetched once on mount so the badge count shows up without needing to
  // open the panel first.
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) load(); // refresh in case time passed since mount
  }

  async function markOneRead(id: string) {
    setNotifications((current) =>
      current ? current.map((n) => (n.id === id ? { ...n, read: true } : n)) : current
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // Best effort — worst case it shows as unread again after a reload.
    }
  }

  async function markAllRead() {
    setNotifications((current) => (current ? current.map((n) => ({ ...n, read: true })) : current));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // Best effort, same as above.
    }
  }

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="icon-button"
        onClick={toggleOpen}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-panel" role="menu">
          <div className="notification-panel-header">
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-primary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {loading && notifications === null && (
            <p style={{ margin: "6px 10px", fontSize: 13, color: "var(--color-text-muted)" }}>Chargement...</p>
          )}

          {notifications !== null && notifications.length === 0 && (
            <p style={{ margin: "6px 10px", fontSize: 13, color: "var(--color-text-muted)" }}>
              Aucune notification pour l&apos;instant.
            </p>
          )}

          {notifications?.map((n) =>
            n.task ? (
              <Link
                key={n.id}
                href={`/dashboard/tasks/${n.task.id}`}
                className="notification-item"
                data-unread={n.read ? undefined : "true"}
                onClick={() => {
                  if (!n.read) markOneRead(n.id);
                  setOpen(false);
                }}
              >
                <p className="notification-item-title">{n.task.title}</p>
                <p className="notification-item-meta">
                  {NOTIFICATION_TYPE_LABELS[n.type] || n.type} · {formatDateTimeShort(n.createdAt)}
                </p>
              </Link>
            ) : (
              <div key={n.id} className="notification-item" data-unread={n.read ? undefined : "true"}>
                <p className="notification-item-title">{NOTIFICATION_TYPE_LABELS[n.type] || n.type}</p>
                <p className="notification-item-meta">{formatDateTimeShort(n.createdAt)}</p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
