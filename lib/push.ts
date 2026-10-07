// Thin wrapper around web-push (https://github.com/web-push-libs/web-push)
// for sending browser/PWA push notifications — the "manage notifications"
// feature alongside the in-app bell (NotificationBell.tsx) and the Resend
// emails in lib/email.ts. Same fallback principle as that file: if the
// VAPID keys aren't configured, sending is silently skipped rather than
// failing the request that triggered it (a task update, a comment, ...).
//
// Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and (optionally)
// VAPID_SUBJECT in the environment — see .env.example. The public key is
// also read client-side (app/dashboard/NotificationBell.tsx) to call
// PushManager.subscribe(), hence the NEXT_PUBLIC_ prefix.
//
// Requires the `web-push` package: run `npm install` once (see
// package.json — deliberately not installed here since this environment
// can't reach the npm registry to verify the exact version; the VAPID
// keys themselves were generated locally with Node's built-in crypto
// module, not with this package, for the same reason).
import webpush from "web-push";
import { prisma } from "./prisma";
import { NOTIFICATION_TYPE_LABELS } from "./enums";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:contact@example.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!vapidPublicKey || !vapidPrivateKey) return false;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  // Lets the browser replace a previous notification for the same task
  // instead of stacking a new one for every interaction — see
  // public/sw.js's `push` handler.
  tag?: string;
};

// Builds the push payload the same way NotificationBell.tsx renders an
// in-app row: NOTIFICATION_TYPE_LABELS[type] as the title, the task's own
// title as the body, a direct link to the task as the click target.
export function pushPayloadForTask(type: string, task: { id: string; title: string }): PushPayload {
  return {
    title: NOTIFICATION_TYPE_LABELS[type] || type,
    body: task.title,
    url: `/dashboard/tasks/${task.id}`,
    tag: `task-${task.id}`,
  };
}

// Sends `payload` to every device/browser the given agent has subscribed
// from. Best-effort and silent: a push failure must never break the
// request that triggered it. A subscription the push service reports as
// gone (404 Not Found — unregistered, or 410 Gone — expired) is deleted
// so it isn't retried forever; any other error is just logged.
export async function sendPushToAgent(agentId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { agentId } });
  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("Échec de l'envoi d'une notification push:", statusCode, err);
        }
      }
    })
  );
}

// Same as sendPushToAgent, for several recipients at once — every call
// site that creates notifications for a set of agents (task assigned,
// status/progress changed, comment, rejected, cron alerts, ...) uses this
// right after, de-duplicated since the same agent is never meant to be
// notified twice for the same event.
export async function sendPushToAgents(agentIds: Iterable<string>, payload: PushPayload): Promise<void> {
  const uniqueIds = [...new Set(agentIds)];
  if (uniqueIds.length === 0) return;
  await Promise.all(uniqueIds.map((id) => sendPushToAgent(id, payload)));
}
