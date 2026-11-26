import type { Role } from "../../../api/identity_access";
import type { Notification } from "../../../api/notifications";
import { paths } from "../../../app/paths";

const STAFF_ROLES: Role[] = ["professional", "coordinator"];

/** Where a notification leads: the page where the person can act on it, if there is one. */
export function notificationLink(notification: Notification, role: Role): string | null {
  const staff = STAFF_ROLES.includes(role);
  switch (notification.template) {
    case "missed_appointment":
    case "message_received":
      if (staff && notification.subject_id) return paths.pro.patient(notification.subject_id);
      return role === "patient" ? paths.patient.messages : null;
    case "session_to_rate":
      return role === "patient" ? paths.patient.appointments : null;
    default:
      if (role === "patient") return paths.patient.appointments;
      return staff ? paths.pro.schedule : null;
  }
}
