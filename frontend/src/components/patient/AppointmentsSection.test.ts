import { describe, expect, it } from "vitest";

import type { Appointment } from "../../api/scheduling";
import { splitAppointments } from "./AppointmentsSection";

const at = (id: string, starts_at: string, status = "scheduled") =>
  ({ id, starts_at, ends_at: starts_at.replace("T09", "T10"), status }) as Appointment;

describe("splitAppointments", () => {
  it("puts what's ahead soonest first and the history latest first, cancellations included", () => {
    const now = new Date("2030-01-10T12:00:00Z");
    const list = [
      at("past", "2030-01-01T09:00:00Z", "done"),
      at("later", "2030-01-20T09:00:00Z"),
      at("soon", "2030-01-12T09:00:00Z"),
      at("cancelled", "2030-01-15T09:00:00Z", "cancelled"),
    ];

    const { upcoming, history } = splitAppointments(list, now);

    expect(upcoming.map((a) => a.id)).toEqual(["soon", "later"]);
    expect(history.map((a) => a.id)).toEqual(["cancelled", "past"]);
  });
});
