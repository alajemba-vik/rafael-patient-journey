import type { Role } from "../../api/me";

export type NavItem = { to: string; label: string };

const FAQ: NavItem = { to: "/faq", label: "Questions fréquentes" };

/** Menu per role. Each role's pages are added here as they're built. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  patient: [
    { to: "/patient", label: "Accueil" },
    { to: "/patient/rendez-vous", label: "Rendez-vous" },
    { to: "/patient/parcours", label: "Mon parcours" },
    { to: "/patient/questionnaires", label: "Questionnaires" },
    FAQ,
  ],
  secretary: [FAQ],
  professional: [
    { to: "/pro", label: "Mon planning" },
    { to: "/pro/patients", label: "Mes patients" },
    { to: "/pro/tableau-de-bord", label: "Tableau de bord" },
    FAQ,
  ],
  coordinator: [
    { to: "/pro", label: "Mon planning" },
    { to: "/pro/patients", label: "Patients" },
    { to: "/pro/tableau-de-bord", label: "Tableau de bord" },
    FAQ,
  ],
  admin: [FAQ],
};

/** Where each role lands after logging in: the first item of its menu. */
export function homeFor(role: Role): string {
  return NAV_BY_ROLE[role][0].to;
}
