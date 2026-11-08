import type { BoardStatus } from "../../../api/reception";
import type { Appointment } from "../../../api/scheduling";
import { minutesBetween } from "../../../components/time";

// Waiting this long, or this late without arriving, puts a card in front of reception.
export const LONG_WAIT_MINUTES = 15;
export const LATE_AFTER_MINUTES = 5;

export type Board = {
  waiting: Appointment[];
  inSession: Appointment[];
  upcoming: Appointment[];
  done: Appointment[];
  noShow: Appointment[];
  cancelled: Appointment[];
};

/** Sorts a day's appointments into the board's lanes, each in the order reception reads it. */
export function groupBoard(appointments: Appointment[]): Board {
  const by = (status: Appointment["status"]) => appointments.filter((a) => a.status === status);
  const byArrival = (a: Appointment, b: Appointment) => (a.arrived_at ?? "").localeCompare(b.arrived_at ?? "");
  return {
    // First come, first called.
    waiting: by("arrived").sort(byArrival),
    inSession: by("in_session"),
    upcoming: by("scheduled"),
    done: by("done"),
    noShow: by("no_show"),
    cancelled: by("cancelled"),
  };
}

/** Minutes since a scheduled appointment should have started, or 0 if it isn't late. */
export function minutesLate(appointment: Appointment, now: Date): number {
  if (appointment.status !== "scheduled") return 0;
  const late = minutesBetween(appointment.starts_at, now);
  return late >= LATE_AFTER_MINUTES ? late : 0;
}

export type DayKind = "past" | "today" | "future";

export type StatusAction = { status: BoardStatus; label: string; primary?: boolean };

/**
 * What reception can record next, mirroring the API's rules. Today runs the waiting room
 * step by step, with an undo for a mis-click; a past day only closes what was left open;
 * a day still to come takes nothing.
 */
export function actionsFor(a: Appointment, dayKind: DayKind, now: Date): StatusAction[] {
  if (dayKind === "future") return [];
  if (dayKind === "past") {
    switch (a.status) {
      case "scheduled":
      case "arrived":
        return [
          { status: "done", label: "Venu·e", primary: true },
          { status: "no_show", label: "Absent·e" },
        ];
      case "in_session":
        return [{ status: "done", label: "Terminé", primary: true }];
      case "no_show":
        return [{ status: "scheduled", label: "Annuler l’absence" }];
      default:
        return [];
    }
  }
  switch (a.status) {
    case "scheduled":
      return [
        { status: "arrived", label: "Arrivé·e", primary: true },
        // Absent only once the session should have started: no premature no-shows.
        ...(new Date(a.starts_at) <= now ? [{ status: "no_show" as const, label: "Absent·e" }] : []),
      ];
    case "arrived":
      return [
        { status: "in_session", label: "Appeler", primary: true },
        { status: "done", label: "Terminé" },
        { status: "scheduled", label: "Annuler l’arrivée" },
      ];
    case "in_session":
      return [
        { status: "done", label: "Terminer", primary: true },
        { status: "arrived", label: "Remettre en attente" },
      ];
    case "no_show":
      return [{ status: "scheduled", label: "Annuler l’absence" }];
    default:
      return [];
  }
}
