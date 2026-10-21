import type { Role } from "../api/me";
import { paths } from "./paths";

type NavItem = { to: string; label: string };

const FAQ: NavItem = { to: paths.faq, label: "Questions fréquentes" };

/** Menu per role. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  patient: [
    { to: paths.patient.home, label: "Accueil" },
    { to: paths.patient.appointments, label: "Rendez-vous" },
    { to: paths.patient.pathway, label: "Mon parcours" },
    { to: paths.patient.questionnaires, label: "Questionnaires" },
    FAQ,
  ],
  secretary: [
    { to: paths.reception.board, label: "Accueil du jour" },
    { to: paths.reception.patients, label: "Patients" },
    FAQ,
  ],
  professional: [
    { to: paths.pro.schedule, label: "Mon planning" },
    { to: paths.pro.patients, label: "Mes patients" },
    { to: paths.pro.dashboard, label: "Tableau de bord" },
  ],
  coordinator: [
    { to: paths.pro.schedule, label: "Mon planning" },
    { to: paths.pro.patients, label: "Patients" },
    { to: paths.pro.pathways, label: "Mes parcours" },
    { to: paths.pro.needs, label: "Besoins signalés" },
    { to: paths.pro.dashboard, label: "Tableau de bord" },
  ],
  admin: [
    { to: paths.admin.accounts, label: "Comptes" },
    { to: paths.admin.faq, label: "Gérer la FAQ" },
    { to: paths.admin.dashboard, label: "Tableau de bord" },
    FAQ,
  ],
};

/** Where each role lands after logging in: the first item of its menu. */
export function homeFor(role: Role): string {
  return NAV_BY_ROLE[role][0].to;
}
