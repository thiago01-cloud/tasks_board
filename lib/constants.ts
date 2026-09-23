// Small shared constants, deliberately with no other dependency: this
// file must be importable without restriction by a middleware (edge
// runtime), by server or client components, etc. Same principle as the
// real estate agency project (houses).
export const SESSION_COOKIE_NAME = "tasks_session";

// Temporary cookie set between the two steps of login, when an account is
// an Agent in several companies: while it picks which one to visit (see
// /login/choose-company). Short-lived.
export const PRE_SESSION_COOKIE_NAME = "tasks_pre_session";

// ---------------------------------------------------------------------
// Application-wide constants: name, description, footer signature and
// color palette. One place to change if any of these change, rather than
// scattered across every page.
//
// Note on colors: the source of truth for RENDERING stays app/globals.css
// (CSS variables under :root, e.g. var(--color-primary)) — that's what
// pages and components should use first. The COLORS object below mirrors
// those same values in JS, for cases where a CSS variable can't be used.
// If you change a value here, update the matching globals.css variable
// too (and vice versa).
// ---------------------------------------------------------------------

export const APP_NAME = "TASKS";

export const APP_DESCRIPTION =
  "Plateforme de gestion des tâches pour entreprises : tâches, équipe et suivi, réunis dans un seul espace.";

export const FOOTER_SIGNATURE =
  "By EseaX Corporate, Justin-Laurent NZENGUI-MAYOMBO";

// "TASKS" palette — must stay in sync with the CSS variables defined in
// app/globals.css (:root).
export const COLORS = {
  background: "#f5f6fa",
  surface: "#ffffff",
  surfaceAlt: "#f8f9fc",
  border: "#dfe3ea",
  text: "#1a1d29",
  textMuted: "#6b7280",

  primary: "#2a3365",
  primaryHover: "#1e2450",
  primaryTint: "#eaecfb",

  accent: "#f59e0b",
  accentTint: "#fef3c7",

  danger: "#b3261e",
  dangerTint: "#fbe9e7",
};

// Builds a consistent page title, e.g. "Login — TASKS".
// Calling pageTitle() with no argument just returns the app name.
export function pageTitle(subtitle?: string): string {
  return subtitle ? `${subtitle} — ${APP_NAME}` : APP_NAME;
}
