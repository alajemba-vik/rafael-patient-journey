import { useMe, type Role } from "./me";

// Which actions each role sees in the screens. The API decides and enforces every permission;
// this only chooses which buttons to show, and keeps that choice in one place so screens don't
// drift apart. Keep it in step with the services' access policies.
type Action = "bookAppointments" | "manageCareTeam" | "leadPathways" | "takeOnPatients";

const ACTIONS: Record<Action, Role[]> = {
  bookAppointments: ["coordinator", "secretary"],
  manageCareTeam: ["coordinator"],
  leadPathways: ["coordinator"],
  takeOnPatients: ["coordinator"],
};

/** `can.bookAppointments` and so on, for the logged-in person. */
export function usePermissions(): Record<Action, boolean> {
  const role = useMe().data?.role;
  return Object.fromEntries(
    Object.entries(ACTIONS).map(([action, roles]) => [action, role !== undefined && roles.includes(role)]),
  ) as Record<Action, boolean>;
}
