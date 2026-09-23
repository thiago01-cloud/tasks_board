// Public landing page: presents the platform, with floating buttons to
// log in or sign up. Same principle as the real estate agency project
// (houses): a logged-in account never sees this page (redirect handled by
// the middleware, added together with authentication).
import Link from "next/link";
import Logo from "./components/Logo";
import { APP_NAME, pageTitle } from "@/lib/constants";

export const metadata = {
  title: pageTitle("La plateforme de gestion de tâches pour entreprises"),
  description:
    "Créez votre compte, lancez votre entreprise et gérez vos tâches et votre équipe depuis une seule plateforme.",
};

function IconAccount() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </svg>
  );
}

function IconCompany() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 21V9.5L12 4l8 5.5V21" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

function IconManage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconTasks() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 9.5l2 2 4-4.5" />
      <path d="M8 16h8" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8.5" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.4" />
      <path d="M2.8 19.5c1-3.2 3.2-4.8 5.7-4.8s4.7 1.6 5.7 4.8" />
      <path d="M14.8 15.1c2 .2 3.5 1.6 4.2 3.7" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 20V11" />
      <path d="M12 20V4" />
      <path d="M19 20v-7" />
    </svg>
  );
}

function IconNotifications() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="home-page">
      <div className="floating-buttons">
        <Link href="/login" className="button-secondary button">
          Se connecter
        </Link>
        <Link href="/signup" className="button">
          Créer un compte
        </Link>
      </div>

      <header className="home-header">
        <Logo size="large" />
        <h1 className="home-title">
          La gestion des tâches de votre entreprise, du compte à l&apos;équipe
        </h1>
        <p className="home-subtitle">
          {APP_NAME} centralise vos tâches, vos échéances et votre équipe
          dans un seul espace. Créez votre compte, lancez votre entreprise,
          et suivez tout depuis un tableau de bord pensé pour le travail
          d&apos;équipe.
        </p>
        <div className="home-cta">
          <Link href="/signup" className="button">
            Créer un compte
          </Link>
          <Link href="/login" className="button-secondary button">
            Se connecter
          </Link>
        </div>
      </header>

      <section className="home-section">
        <h2 className="section-title">Comment ça marche</h2>
        <p className="section-subtitle">
          Trois étapes suffisent pour démarrer, sans configuration complexe.
        </p>
        <div className="steps-grid">
          <div className="step-card">
            <span className="step-number">1</span>
            <div className="step-icon">
              <IconAccount />
            </div>
            <h3>Créez votre compte</h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
              Un numéro de téléphone et un mot de passe suffisent pour créer
              votre compte de connexion.
            </p>
          </div>
          <div className="step-card">
            <span className="step-number">2</span>
            <div className="step-icon">
              <IconCompany />
            </div>
            <h3>Créez votre entreprise</h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
              Renseignez le nom de votre entreprise : elle est prête en
              quelques secondes.
            </p>
          </div>
          <div className="step-card">
            <span className="step-number">3</span>
            <div className="step-icon">
              <IconManage />
            </div>
            <h3>Gérez vos tâches</h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 14 }}>
              Ajoutez vos agents, créez des tâches et suivez leur avancement
              depuis un seul endroit.
            </p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-title">Tout ce dont votre entreprise a besoin</h2>
        <p className="section-subtitle">
          Une plateforme pensée pour le suivi de tâches au quotidien.
        </p>
        <div className="features-grid">
          <div className="feature-card">
            <IconTasks />
            <h3>Tâches</h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5 }}>
              Créez, assignez et suivez l&apos;avancement de chaque tâche.
            </p>
          </div>
          <div className="feature-card">
            <IconTeam />
            <h3>Équipe</h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5 }}>
              Invitez vos agents et gérez leurs rôles au sein de votre
              entreprise.
            </p>
          </div>
          <div className="feature-card">
            <IconDashboard />
            <h3>Tableau de bord</h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5 }}>
              Visualisez la charge de travail et les échéances en un coup
              d&apos;œil.
            </p>
          </div>
          <div className="feature-card">
            <IconNotifications />
            <h3>Notifications</h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5 }}>
              Recevez une alerte à chaque assignation ou échéance proche.
            </p>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <h2>Prêt à démarrer ?</h2>
        <p>Créez votre compte et lancez votre entreprise en quelques minutes.</p>
        <Link href="/signup" className="button" style={{ background: "var(--color-accent)" }}>
          Créer un compte gratuitement
        </Link>
      </section>
    </div>
  );
}
