"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Small reusable modal shell — used for anything that needs to show a
// short panel of actions/instructions above the page rather than inline
// (e.g. "share this teammate's login link", shown from TeamCard.tsx and
// TeamForm.tsx's own post-creation panel). Distinct from ConfirmProvider's
// dialog: that one is a yes/no prompt with no title bar or close button;
// this one holds richer content (buttons, links, help text) and closes via
// its own × button, the backdrop, or Escape — never by "confirming"
// anything.
//
// Rendered through a portal straight into <body> rather than in place in
// the component tree. Without that, a `position: fixed` overlay nested
// several levels deep (e.g. NotificationBell.tsx's instance, which lives
// inside the sidebar) can still end up z-index-fighting with unrelated
// page content in some browsers — the dashboard's big circular-progress
// stat rings (CircularProgress.tsx, size=54) were observed painting on
// top of this exact modal despite its z-index: 100 (see globals.css). A
// portal sidesteps the whole class of "ancestor stacking context" bugs
// instead of chasing each stray z-index one at a time.
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // document.body isn't available during SSR/the first render pass, so the
  // portal target is only resolved once mounted client-side — avoids a
  // hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="modal-dialog-title" className="modal-title">
            {title}
          </h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
