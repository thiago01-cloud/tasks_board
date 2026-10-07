import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";

// Registers (POST) or removes (DELETE) this browser's Web Push
// subscription for the signed-in agent — called by
// app/dashboard/account/PushNotificationsCard.tsx right after
// PushManager.subscribe()/unsubscribe(). See lib/push.ts for how these
// rows get used, and prisma/schema.prisma's PushSubscription model for
// why `endpoint` alone is enough to identify a device.
export async function POST(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Abonnement push invalide." }, { status: 400 });
  }

  // Upsert on `endpoint` (unique — see schema): the same browser/device
  // subscribing again (permission re-granted, keys rotated by the
  // browser, ...) replaces its own row instead of erroring on the unique
  // constraint or piling up duplicates.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { agentId: agent!.id, endpoint, p256dh, auth },
    update: { agentId: agent!.id, p256dh, auth },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { agent, error } = await requireAgent();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Abonnement push invalide." }, { status: 400 });
  }

  // Scoped to the current agent so one account can never remove another
  // agent's subscription by guessing/replaying an endpoint.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, agentId: agent!.id } });

  return NextResponse.json({ ok: true });
}
