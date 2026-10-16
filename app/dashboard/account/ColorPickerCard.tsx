"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AGENT_COLOR_PALETTE } from "@/lib/colors";

// "Chaque agent doit avoir une couleur" / "les couleurs attribuées aux
// utilisateurs sont uniques" — self-service pick from a fixed palette
// (see lib/colors.ts), shown everywhere this agent's initials appear
// (TeamCard.tsx, TeamMemberDetail.tsx, TaskCard.tsx's assignee
// avatar-stack). `initialColor` is null until this agent has ever chosen
// one — the swatch grid still shows which one is CURRENTLY applied
// (`effectiveColor`, the same fallback assignAgentColors() derives
// everywhere else), it's just not highlighted as an explicit pick until
// they actually make one. `takenByOthers` greys out — and disables —
// every swatch a teammate has already explicitly chosen, so this agent
// can't even attempt a pick the server would reject as a duplicate (see
// PATCH /api/account/color, and the database's own
// `@@unique([companyId, color])`).
export default function ColorPickerCard({
  effectiveColor,
  initialColor,
  takenByOthers,
}: {
  effectiveColor: string;
  initialColor: string | null;
  takenByOthers: string[];
}) {
  const router = useRouter();
  const [color, setColor] = useState<string | null>(initialColor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePick(next: string) {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/account/color", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }
      setColor(next);
      router.refresh();
    } catch {
      setError("Impossible de contacter le serveur.");
    }
    setLoading(false);
  }

  const current = color || effectiveColor;
  const takenSet = new Set(takenByOthers);

  return (
    <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
      <h3 style={{ marginTop: 0 }}>Ma couleur</h3>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
        Affichée sur vos avatars dans l&apos;équipe et sur les tâches qui vous sont assignées. Chaque couleur ne
        peut être utilisée que par une seule personne.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {AGENT_COLOR_PALETTE.map((swatch) => {
          const takenByTeammate = swatch !== current && takenSet.has(swatch);
          return (
            <button
              key={swatch}
              type="button"
              aria-label={takenByTeammate ? "Couleur déjà prise par un autre membre" : "Choisir cette couleur"}
              title={takenByTeammate ? "Déjà utilisée par un autre membre de l'équipe" : undefined}
              onClick={() => handlePick(swatch)}
              disabled={loading || takenByTeammate}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: swatch,
                border: swatch === current ? "3px solid var(--color-text)" : "1px solid var(--color-border)",
                cursor: loading || takenByTeammate ? "default" : "pointer",
                padding: 0,
                opacity: takenByTeammate ? 0.3 : 1,
              }}
            />
          );
        })}
      </div>
      {error && <p className="error-message" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
