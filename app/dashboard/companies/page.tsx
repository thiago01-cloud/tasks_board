import { redirect } from "next/navigation";
import { getCurrentAgent, getAccessibleCompanies } from "@/lib/auth";
import CompanyRow from "./CompanyRow";
import CreateCompanyForm from "@/app/create-company/CreateCompanyForm";

// Full management page for every company the account can reach (owned, or
// where it holds an Agent record) — rename/delete for the ones it owns,
// switch for any of them, plus creating a new one. Replaces the old
// sidebar dropdown, which only let you switch and jump to /create-company.
export default async function CompaniesPage() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");

  const companies = await getAccessibleCompanies(agent.userId);
  // Owned companies first (the ones this page lets you actually manage),
  // then alphabetical within each group.
  const sorted = [...companies].sort((a, b) => {
    if (a.role === "OWNER" && b.role !== "OWNER") return -1;
    if (b.role === "OWNER" && a.role !== "OWNER") return 1;
    return a.company.name.localeCompare(b.company.name);
  });

  return (
    <div>
      <div className="page-header">
        <h1>Mes entreprises</h1>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Rôle</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <CompanyRow
                  key={item.company.id}
                  company={item.company}
                  role={item.role}
                  isActive={item.company.id === agent.companyId}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Créer une nouvelle entreprise</h3>
        <CreateCompanyForm />
      </div>
    </div>
  );
}
