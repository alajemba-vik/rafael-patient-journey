import type { ParseKeys } from "i18next";

import type { Role } from "../api/identity_access";
import { paths } from "./paths";

/** `label` is a translation key: menus are translated where they are shown. */
type NavItem = { to: string; label: ParseKeys };

const FAQ: NavItem = { to: paths.faq, label: "nav.faq" };

/** Menu per role. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  patient: [
    { to: paths.patient.home, label: "nav.patientHome" },
    { to: paths.patient.appointments, label: "nav.patientAppointments" },
    { to: paths.patient.pathway, label: "nav.patientPathway" },
    { to: paths.patient.questionnaires, label: "nav.patientQuestionnaires" },
    { to: paths.patient.messages, label: "nav.patientMessages" },
    FAQ,
  ],
  secretary: [
    { to: paths.reception.board, label: "nav.receptionBoard" },
    { to: paths.reception.planning, label: "nav.planning" },
    { to: paths.reception.groups, label: "nav.groups" },
    { to: paths.reception.patients, label: "nav.receptionPatients" },
    { to: paths.reception.callBacks, label: "nav.receptionCallBacks" },
    FAQ,
  ],
  professional: [
    { to: paths.pro.schedule, label: "nav.proSchedule" },
    { to: paths.pro.patients, label: "nav.proPatients" },
    { to: paths.pro.groups, label: "nav.groups" },
    { to: paths.pro.dashboard, label: "nav.dashboard" },
    FAQ,
  ],
  coordinator: [
    { to: paths.pro.schedule, label: "nav.proSchedule" },
    { to: paths.pro.patients, label: "nav.proPatients" },
    { to: paths.pro.pathways, label: "nav.proPathways" },
    { to: paths.pro.needs, label: "nav.proNeeds" },
    { to: paths.pro.planning, label: "nav.planning" },
    { to: paths.pro.groups, label: "nav.groups" },
    { to: paths.pro.dashboard, label: "nav.dashboard" },
    FAQ,
  ],
  admin: [
    { to: paths.admin.accounts, label: "nav.adminAccounts" },
    { to: paths.admin.faq, label: "nav.adminFaq" },
    { to: paths.admin.audit, label: "nav.adminAudit" },
    { to: paths.admin.dashboard, label: "nav.dashboard" },
    FAQ,
  ],
};

/** Where each role lands after logging in: the first item of its menu. */
export function homeFor(role: Role): string {
  return NAV_BY_ROLE[role][0].to;
}
