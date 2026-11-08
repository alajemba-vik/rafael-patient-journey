import { describe, expect, it } from "vitest";

import type { Appointment } from "../../../api/scheduling";
import { actionsFor, groupBoard, minutesLate } from "./board";

function appointment(overrides: Partial<Appointment>): Appointment {
  return {
    id: crypto.randomUUID(),
    patient_id: "p",
    patient_name: "Alex Synthetic",
    professional_id: "u",
    professional_name: "Jordan Praticien",
    starts_at: "2030-01-10T09:00:00Z",
    ends_at: "2030-01-10T09:45:00Z",
    status: "scheduled",
    ...overrides,
  };
}

describe("the reception board", () => {
  it("puts each appointment in its lane, the waiting room in order of arrival", () => {
    const late = appointment({ status: "arrived", arrived_at: "2030-01-10T08:50:00Z" });
    const early = appointment({ status: "arrived", arrived_at: "2030-01-10T08:40:00Z" });
    const list = [
      late,
      early,
      appointment({ status: "in_session" }),
      appointment({ status: "done" }),
      appointment({ status: "no_show" }),
      appointment({ status: "cancelled" }),
      appointment({}),
    ];

    const board = groupBoard(list);

    expect(board.waiting).toEqual([early, late]);
    expect([board.inSession, board.upcoming, board.done, board.noShow, board.cancelled].map((l) => l.length)).toEqual([
      1, 1, 1, 1, 1,
    ]);
  });

  it("counts a scheduled patient as late only after a few minutes", () => {
    const due = appointment({});

    expect(minutesLate(due, new Date("2030-01-10T09:03:00Z"))).toBe(0);
    expect(minutesLate(due, new Date("2030-01-10T09:12:00Z"))).toBe(12);
    expect(minutesLate({ ...due, status: "arrived" }, new Date("2030-01-10T09:30:00Z"))).toBe(0);
  });
});

describe("actionsFor", () => {
  const now = new Date("2030-01-10T12:00:00Z");
  const at = (status: Appointment["status"], starts_at = "2030-01-10T11:00:00Z") => appointment({ status, starts_at });
  const statuses = (list: { status: string }[]) => list.map((a) => a.status);

  it("runs today's waiting room step by step", () => {
    expect(statuses(actionsFor(at("scheduled"), "today", now))).toEqual(["arrived", "no_show"]);
    expect(statuses(actionsFor(at("arrived"), "today", now))).toEqual(["in_session", "done", "scheduled"]);
  });

  it("offers no absence before the session has started", () => {
    const later = at("scheduled", "2030-01-10T15:00:00Z");

    expect(statuses(actionsFor(later, "today", now))).toEqual(["arrived"]);
  });

  it("only closes a past day's appointments, with no waiting room", () => {
    expect(statuses(actionsFor(at("scheduled"), "past", now))).toEqual(["done", "no_show"]);
    expect(statuses(actionsFor(at("in_session"), "past", now))).toEqual(["done"]);
  });

  it("records nothing for a day still to come", () => {
    expect(actionsFor(at("scheduled"), "future", now)).toEqual([]);
  });
});
