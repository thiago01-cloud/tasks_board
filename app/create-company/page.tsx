import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import Logo from "../components/Logo";
import { getCurrentSession, getPreSessionPayload } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import CreateCompanyForm from "./CreateCompanyForm";

export const metadata = {
  title: pageTitle("Créer mon entreprise"),
};

export default async function CreateCompanyPage() {
  const session = await getCurrentSession();
  if (!session) {
    const prePayload = await getPreSessionPayload();
    if (!prePayload?.userId) redirect("/login");
  }

  // Two contexts share this page: mid-signup (no company yet) and an
  // already connected account creating an additional company from the
  // "Mes entreprises" menu — the copy (and the way back) differs.
  const hasCompany = Boolean(session);

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
          {hasCompany
            ? "Créez une nouvelle entreprise"
            : "Créez votre première entreprise pour commencer"}
        </p>
      </div>

      <div
        className="card"
        style={{ width: "100%", maxWidth: 460, borderTop: "3px solid var(--color-accent)" }}
      >
        <Suspense fallback={null}>
          <CreateCompanyForm />
        </Suspense>
      </div>

      {hasCompany && (
        <Link href="/dashboard" style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
          ← Retour au tableau de bord
        </Link>
      )}
    </div>
  );
}
