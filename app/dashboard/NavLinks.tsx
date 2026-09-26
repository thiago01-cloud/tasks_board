"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; exact?: boolean };

const LINKS: NavLink[] = [
  { href: "/dashboard", label: "Tableau de bord", exact: true },
  { href: "/dashboard/tasks", label: "Tâches" },
];

const TEAM_LINK: NavLink = { href: "/dashboard/team", label: "Équipe" };
const SUBSCRIPTION_LINK: NavLink = { href: "/dashboard/subscription", label: "Abonnement" };

export default function NavLinks({
  showTeamLink,
  showSubscriptionLink,
  onNavigate,
}: {
  // Team page is open to admins and managers (see app/dashboard/team/
  // page.tsx's own comment) — not just admins, despite the prop's old
  // name.
  showTeamLink: boolean;
  // Abonnement is billing-adjacent — admin-only, narrower than the team
  // link above (see app/dashboard/subscription/page.tsx's own guard).
  showSubscriptionLink: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  let links = showTeamLink ? [...LINKS, TEAM_LINK] : LINKS;
  if (showSubscriptionLink) links = [...links, SUBSCRIPTION_LINK];

  return (
    <nav className="dashboard-nav">
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${active ? " active" : ""}`}
            onClick={onNavigate}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
