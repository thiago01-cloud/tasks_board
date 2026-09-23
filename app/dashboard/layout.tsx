import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import Sidebar from "./Sidebar";
import ConfirmProvider from "./ConfirmProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const agent = await getCurrentAgent();

  // Rare case: the token is valid but the agent/company was deleted
  // in the meantime.
  if (!agent) redirect("/login");

  return (
    <ConfirmProvider>
      <div className="dashboard-layout">
        <Sidebar agent={agent} />
        <main className="main-content">{children}</main>
      </div>
    </ConfirmProvider>
  );
}
