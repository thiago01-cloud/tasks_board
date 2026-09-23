import { redirect } from "next/navigation";
import { Suspense } from "react";
import Logo from "../../components/Logo";
import { getPreSessionPayload, getAccessibleCompanies } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import ChooseCompanyForm from "./ChooseCompanyForm";

export const metadata = {
  title: pageTitle("Choisir une entreprise"),
};

export default async function ChooseCompanyPage() {
  const prePayload = await getPreSessionPayload();
  if (!prePayload?.userId) redirect("/login");

  const companies = await getAccessibleCompanies(prePayload.userId);
  if (companies.length === 0) redirect("/create-company");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 24,
        background:
          "radial-gradient(circle at 50% 0%, var(--color-primary-tint) 0%, var(--color-background) 55%)",
      }}
    >
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Logo size="large" />
        <p style={{ color: "var(--color-text-muted)", margin: 0, fontSize: 14 }}>
          Choisis l&apos;entreprise dans laquelle tu veux te rendre
        </p>
      </div>

      <div
        className="card"
        style={{ width: "100%", maxWidth: 420, borderTop: "3px solid var(--color-accent)" }}
      >
        <Suspense fallback={null}>
          <ChooseCompanyForm
            companies={companies.map(({ company, role }) => ({ id: company.id, name: company.name, role }))}
          />
        </Suspense>
      </div>
    </div>
  );
}
