"use client";

import { useEffect, useState } from "react";

// Floating shortcuts pinned to the bottom-right of the team page. The two
// "Ajouter..." buttons don't open a modal — they just smooth-scroll down
// to the existing "Ajouter un membre" / "Créer un groupe" forms (each
// target has scroll-margin-top set via .scroll-target so it doesn't land
// under the sticky mobile top bar). A third, round "back to top" button
// appears once the page has actually been scrolled down.
function scrollToForm(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function UserPlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function GroupPlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="8" r="3" />
      <circle cx="12" cy="8" r="3" />
      <path d="M1 21v-1.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4V21" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

export default function TeamFabButtons() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setShowTop(window.scrollY > 280);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="team-fab-row">
      {showTop && (
        <button
          type="button"
          className="team-fab-button team-fab-button-secondary team-fab-button-round"
          onClick={scrollToTop}
          aria-label="Retour en haut"
          title="Retour en haut"
        >
          <ArrowUpIcon />
        </button>
      )}
      <button type="button" className="team-fab-button" onClick={() => scrollToForm("add-agent-form")}>
        <UserPlusIcon />
        <span>Ajouter un agent</span>
      </button>
      <button
        type="button"
        className="team-fab-button team-fab-button-secondary"
        onClick={() => scrollToForm("add-group-form")}
      >
        <GroupPlusIcon />
        <span>Ajouter un groupe</span>
      </button>
    </div>
  );
}
