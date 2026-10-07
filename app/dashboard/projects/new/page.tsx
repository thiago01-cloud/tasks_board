import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/lib/auth";
import { pageTitle } from "@/lib/constants";
import ProjectForm from "../ProjectForm";

export const metadata = {
  title: pageTitle("Nouveau projet"),
};

// Creating a project is reserved for admins and managers — see POST
// /api/projects's own comment — so anyone else landing here directly is
// sent back, same pattern as app/dashboard/tasks/new/page.tsx.
export default async function NewProjectPage() {
  const agent = await getCurrentAgent();
  if (!agent || (agent.role !== "ADMIN" && agent.role !== "MANAGER")) redirect("/dashboard/projects");

  return (
    <div>
      <div className="page-header">
        <h1>Nouveau projet</h1>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <ProjectForm />
      </div>
    </div>
  );
}
