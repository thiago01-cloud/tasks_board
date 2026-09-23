"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "./ConfirmProvider";

export default function LogoutButton() {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!(await confirm({ title: "Se déconnecter ?", confirmLabel: "Se déconnecter" }))) return;
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="button-secondary button" onClick={handleClick} disabled={loading}>
      Déconnexion
    </button>
  );
}
