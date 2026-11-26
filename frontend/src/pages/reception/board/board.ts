import type { ParseKeys } from "i18next";

import type { BoardStatus } from "../../../api/reception";
import type { Appointment } from "../../../api/scheduling";
import { minutesBetween } from "../../../lib/time";

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

/** `label` is a translation key, translated where the button is shown. */
export type StatusAction = { status: BoardStatus; label: ParseKeys; primary?: boolean };

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
          { status: "done", label: "board.action.attended", primary: true },
          { status: "no_show", label: "board.action.noShow" },
        ];
      case "in_session":
        return [{ status: "done", label: "board.action.finished", primary: true }];
      case "no_show":
        return [{ status: "scheduled", label: "board.action.undoNoShow" }];
      default:
        return [];
    }
  }
  switch (a.status) {
    case "scheduled":
      return [
        { status: "arrived", label: "board.action.arrived", primary: true },
        // Absent only once the session should have started: no premature no-shows.
        ...(new Date(a.starts_at) <= now
          ? [{ status: "no_show" as const, label: "board.action.noShow" as const }]
          : []),
      ];
    case "arrived":
      return [
        { status: "in_session", label: "board.action.callIn", primary: true },
        { status: "done", label: "board.action.finished" },
        { status: "scheduled", label: "board.action.undoArrival" },
      ];
    case "in_session":
      return [
        { status: "done", label: "board.action.finish", primary: true },
        { status: "arrived", label: "board.action.backToWaiting" },
      ];
    case "no_show":
      return [{ status: "scheduled", label: "board.action.undoNoShow" }];
    default:
      return [];
  }
}
