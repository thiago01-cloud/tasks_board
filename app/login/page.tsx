import Link from "next/link";
import { Suspense } from "react";
import Logo from "../components/Logo";
import LoginForm from "./LoginForm";
import { pageTitle } from "@/lib/constants";

export const metadata = {
  title: pageTitle("Connexion"),
};

export default function LoginPage() {
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
          Connexion à ton espace
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
          <LoginForm />
        </Suspense>
      </div>

      <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
        Pas encore de compte ? <Link href="/signup">Créer un compte</Link>
      </p>
    </div>
  );
}
