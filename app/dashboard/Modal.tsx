"use client";

import { useEffect } from "react";

// Small reusable modal shell — used for anything that needs to show a
// short panel of actions/instructions above the page rather than inline
// (e.g. "share this teammate's login link", shown from TeamCard.tsx and
// TeamForm.tsx's own post-creation panel). Distinct from ConfirmProvider's
// dialog: that one is a yes/no prompt with no title bar or close button;
// this one holds richer content (buttons, links, help text) and closes via
// its own × button, the backdrop, or Escape — never by "confirming"
// anything.
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
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
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
    </div>
  );
}
