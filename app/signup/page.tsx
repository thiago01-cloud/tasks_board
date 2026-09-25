import Link from "next/link";
import { Suspense } from "react";
import Logo from "../components/Logo";
import SignupForm from "./SignupForm";
import { pageTitle } from "@/lib/constants";

export const metadata = {
  title: pageTitle("Créer un compte"),
};

export default function SignupPage() {
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
          Créez votre compte pour démarrer votre entreprise
        </p>
      </div>

      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 400,
          display: "flex",
          justifyContent: "center",
          borderTop: "3px solid var(--color-accent)",
        }}
      >
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </div>

      <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
        Déjà un compte ? <Link href="/login">Se connecter</Link>
      </p>
    </div>
  );
}
