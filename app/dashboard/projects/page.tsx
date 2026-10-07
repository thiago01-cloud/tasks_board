import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageTitle } from "@/lib/constants";
import { computeProjectProgress } from "@/lib/projects";
import { formatDate } from "@/lib/dates";
import ProjectProgressBar from "./ProjectProgressBar";

export const metadata = {
  title: pageTitle("Projets"),
};

// Open to every role (see NavLinks.tsx's own comment) — only the
// "+ Nouveau projet" button below is gated to admins/managers, same
// pattern as the Tasks tab itself gating just its own creation button.
export default async function ProjectsPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");

  const projects = await prisma.project.findMany({
    where: { companyId: agent.companyId },
    orderBy: { createdAt: "desc" },
    include: { tasks: { select: { progress: true } } },
  });

  const canCreate = agent.role === "ADMIN" || agent.role === "MANAGER";

  return (
    <div>
      <div className="page-header">
        <h1>Projets</h1>
        {canCreate && (
          <Link href="/dashboard/projects/new" className="button">
            + Nouveau projet
          </Link>
        )}
      </div>

      {projects.length === 0 && (
        <div className="card">
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Aucun projet pour l&apos;instant.</p>
        </div>
      )}

      {projects.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {projects.map((p) => {
            const progress = computeProjectProgress(p.tasks);
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                className="card"
                style={{ display: "block", textDecoration: "none", color: "inherit" }}
              >
                <h3 style={{ margin: "0 0 6px" }}>{p.name}</h3>
                {p.objective && (
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>{p.objective}</p>
                )}
                <ProjectProgressBar progress={progress} />
                <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
                  {p.tasks.length} tâche{p.tasks.length > 1 ? "s" : ""}
                  {p.deliveryDate && <> · Livraison : {formatDate(p.deliveryDate.toISOString())}</>}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
