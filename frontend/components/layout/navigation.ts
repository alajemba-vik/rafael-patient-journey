import type { Role } from "../../api/me";

export type NavItem = { to: string; label: string };

const FAQ: NavItem = { to: "/faq", label: "Questions fréquentes" };

/** Menu per role. Each role's pages are added here as they're built. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  patient: [FAQ],
  secretary: [FAQ],
  professional: [FAQ],
  coordinator: [FAQ],
  admin: [FAQ],
};

/** Where each role lands after logging in: the first item of its menu. */
export function homeFor(role: Role): string {
  return NAV_BY_ROLE[role][0].to;
}
