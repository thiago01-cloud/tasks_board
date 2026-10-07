"use client";

import { useEffect, useState } from "react";

// Converts the VAPID public key (base64url, as generated for .env — see
// .env.example) into the raw Uint8Array PushManager.subscribe() expects
// for `applicationServerKey`. Standard snippet for the Web Push API —
// there's no browser-native base64url decoder.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status =
  | "checking"
  | "unsupported" // browser has no Push API (e.g. desktop Safari, or iOS Safari not installed to the home screen)
  | "unconfigured" // NEXT_PUBLIC_VAPID_PUBLIC_KEY isn't set — see .env.example
  | "denied" // the person refused the browser's permission prompt
  | "off"
  | "on";

// Self-service push notification opt-in for THIS browser/device — one row
// on "Mon compte" (see page.tsx), alongside the account/password forms.
// Deliberately per-device rather than a single account-wide toggle: each
// subscription (lib/push.ts, prisma's PushSubscription model) is tied to
// one browser's own PushManager endpoint, so a phone and a laptop are
// switched on independently, exactly like how a push notification
// permission itself works in every browser.
export default function PushNotificationsCard() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        setStatus("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setStatus(subscription ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setError("");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setBusy(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error();

      setStatus("on");
    } catch {
      setError("Impossible d'activer les notifications push. Réessayez.");
    }
    setBusy(false);
  }

  async function handleDisable() {
    setError("");
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus("off");
    } catch {
      setError("Impossible de désactiver les notifications push. Réessayez.");
    }
    setBusy(false);
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3 style={{ marginTop: 0 }}>Notifications push</h3>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
        Recevez les notifications de TASKS (tâche assignée, statut changé, commentaire, alertes de
        délai...) directement sur cet appareil, même quand l&apos;onglet n&apos;est pas ouvert — en plus
        de la cloche et des emails. À activer séparément sur chaque appareil/navigateur utilisé.
      </p>

      {status === "checking" && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>Vérification...</p>
      )}

      {status === "unsupported" && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
          Ce navigateur ne prend pas en charge les notifications push (sur iPhone/iPad : installez
          d&apos;abord TASKS sur l&apos;écran d&apos;accueil depuis Safari, via Partager → Sur l&apos;écran
          d&apos;accueil, puis revenez sur cette page).
        </p>
      )}

      {status === "unconfigured" && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
          Les notifications push ne sont pas encore configurées sur ce serveur.
        </p>
      )}

      {status === "denied" && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
          Les notifications ont été bloquées pour ce site. Autorisez-les depuis les réglages de
          votre navigateur (icône de cadenas dans la barre d&apos;adresse) pour les activer ici.
        </p>
      )}

      {status === "off" && (
        <button type="button" className="button" onClick={handleEnable} disabled={busy}>
          {busy ? "Activation..." : "Activer les notifications push"}
        </button>
      )}

      {status === "on" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span
            className="badge"
            style={{ color: "var(--color-success)", borderColor: "var(--color-success)" }}
          >
            Activées sur cet appareil
          </span>
          <button type="button" className="button-secondary button" onClick={handleDisable} disabled={busy}>
            {busy ? "Désactivation..." : "Désactiver"}
          </button>
        </div>
      )}

      {error && <p className="error-message" style={{ margin: "10px 0 0" }}>{error}</p>}
    </div>
  );
}
