import { redirect } from "next/navigation";
import { getCurrentAgent, needsPasswordSetup, canManageSubscription } from "@/lib/auth";
import Sidebar from "./Sidebar";
import ConfirmProvider from "./ConfirmProvider";
import AutoRefresh from "./AutoRefresh";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const agent = await getCurrentAgent();

  // Rare case: the token is valid but the agent/company was deleted
  // in the meantime.
  if (!agent) redirect("/login");
  // An account invited via POST /api/agents/invite is logged in
  // (GET /api/auth/accept-invite) before it has ever chosen its own
  // password — nothing else in the dashboard is reachable until it does.
  if (needsPasswordSetup(agent)) redirect("/set-password");

  // Computed here (a server component, so it can hit the database) and
  // passed down rather than left to Sidebar.tsx (client-side) to decide —
  // see canManageSubscription()'s own comment: unlike every other nav
  // link's admin-role check, this one isn't derivable from the session
  // alone (an owner-delegated agent isn't an "ADMIN").
  const showSubscriptionLink = await canManageSubscription(agent);

  return (
    <ConfirmProvider>
      <AutoRefresh />
      <div className="dashboard-layout">
        <Sidebar agent={agent} showSubscriptionLink={showSubscriptionLink} />
        <main className="main-content">{children}</main>
      </div>
    </ConfirmProvider>
  );
}
