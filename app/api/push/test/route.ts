import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgentEnsured } from "@/lib/auth";
import { sendPushToAgent } from "@/lib/push";

// Lets a signed-in agent send themselves one push notification on demand —
// the "Envoyer une notification de test" button on PushNotificationsCard.tsx
// ("Mon compte"). Exists purely to verify the end-to-end pipeline (VAPID
// keys configured, this browser's subscription still valid, the push
// actually reaching the device) without having to wait for a real task
// event to trigger one.
export async function POST() {
  const { agent, error } = await requireAgentEnsured();
  if (error) return error;

  const subscriptionCount = await prisma.pushSubscription.count({ where: { agentId: agent!.id } });
  if (subscriptionCount === 0) {
    return NextResponse.json(
      {
        error:
          "Aucun abonnement push actif pour cet appareil. Activez d'abord les notifications push ci-dessus.",
      },
      { status: 400 }
    );
  }

  await sendPushToAgent(agent!.id, {
    title: "Notification de test",
    body: "Si vous voyez cette notification, les notifications push fonctionnent correctement sur cet appareil.",
    url: "/dashboard/account",
    tag: "push-test",
  });

  return NextResponse.json({ ok: true, subscriptionCount });
}
