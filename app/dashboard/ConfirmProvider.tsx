"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button — for anything destructive (delete, déconnexion...).
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

// A small "es-tu sûr(e) ?" step, reused everywhere an action used to fire
// immediately on click — logout, marking a subtask done, changing a
// task's status, every delete — instead of the browser's own confirm()
// popup, which looks out of place next to the rest of this app's UI.
// Usage:
//   const confirm = useConfirm();
//   async function handleClick() {
//     if (!(await confirm({ title: "Se déconnecter ?" }))) return;
//     ...proceed...
//   }
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within <ConfirmProvider>.");
  }
  return confirm;
}

// Mounted once in app/dashboard/layout.tsx, above the sidebar and page
// content, so every dashboard page can call useConfirm() without wiring
// its own dialog state.
export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  function confirm(options: ConfirmOptions) {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }

  function settle(value: boolean) {
    if (pending) pending.resolve(value);
    setPending(null);
  }

  useEffect(() => {
    if (!pending) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") settle(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="confirm-overlay" onClick={() => settle(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-dialog-title" className="confirm-dialog-title">
              {pending.title}
            </h3>
            {pending.message && <p className="confirm-dialog-message">{pending.message}</p>}
            <div className="confirm-dialog-actions">
              <button type="button" className="button-secondary button" onClick={() => settle(false)}>
                {pending.cancelLabel || "Annuler"}
              </button>
              <button
                type="button"
                className="button"
                style={
                  pending.danger
                    ? { background: "var(--color-danger)", borderColor: "var(--color-danger)" }
                    : undefined
                }
                onClick={() => settle(true)}
                autoFocus
              >
                {pending.confirmLabel || "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
