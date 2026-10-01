"use client";

import { useState } from "react";

// Self-service password change on "Mon compte" (see page.tsx) — needs the
// current password, since unlike app/set-password (reached right after an
// invite link, where the fresh session is proof enough) this is reachable
// at any time by someone already fully logged in. See PATCH
// /api/account/password's own comment for the forgot-password case
// instead (an admin/owner resetting it from the Équipe page).
export default function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Impossible de contacter le serveur.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="currentPassword">Mot de passe actuel</label>
        <input
          id="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="newPassword">Nouveau mot de passe</label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && (
        <p style={{ color: "var(--color-success)", fontSize: 13, margin: "0 0 10px" }}>
          Mot de passe mis à jour.
        </p>
      )}

      <button type="submit" className="button" disabled={loading}>
        {loading ? "Enregistrement..." : "Changer le mot de passe"}
      </button>
    </form>
  );
}
