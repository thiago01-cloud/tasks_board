import { redirect } from "next/navigation";
import Logo from "../components/Logo";
import { getCurrentAgent, needsPasswordSetup } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import SetPasswordForm from "./SetPasswordForm";

export const metadata = {
  title: pageTitle("Choisissez votre mot de passe"),
};

// Landed on right after clicking an invite link (see
// app/api/auth/accept-invite/route.ts, which creates the session and
// redirects here) — the one thing an invited account has to do before
// anything else in the dashboard is reachable (see the same check in
// app/dashboard/layout.tsx).
export default async function SetPasswordPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  // Already done (e.g. the invite link was opened a second time, or
  // someone navigates back here manually) — nothing to do, back to work.
  if (!needsPasswordSetup(agent)) redirect("/dashboard");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 24,
        background:
          "radial-gradient(circle at 50% 0%, var(--color-primary-tint) 0%, var(--color-background) 55%)",
      }}
    >
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Logo size="large" />
        <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: 14 }}>
          Bienvenue {agent.firstName} — choisissez votre mot de passe pour continuer
        </p>
      </div>

      <div
        className="card"
        style={{ width: "100%", maxWidth: 420, borderTop: "3px solid var(--color-accent)" }}
      >
        <SetPasswordForm />
      </div>
    </div>
  );
}
