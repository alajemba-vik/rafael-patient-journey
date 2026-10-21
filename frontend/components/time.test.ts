import { describe, expect, it } from "vitest";

import { addDays, instituteDateTime } from "./time";

describe("the Institute's clock", () => {
  it("reads entered times as Paris time in winter and summer", () => {
    expect(instituteDateTime("2027-01-15", "10:00").toISOString()).toBe("2027-01-15T09:00:00.000Z");
    expect(instituteDateTime("2027-06-15", "10:00").toISOString()).toBe("2027-06-15T08:00:00.000Z");
  });

  it("finds local midnight on both sides of a clock change", () => {
    expect(instituteDateTime("2026-10-25").toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(instituteDateTime("2026-10-26").toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(instituteDateTime("2027-03-29").toISOString()).toBe("2027-03-28T22:00:00.000Z");
  });

  it("adds days across months", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
  });
});
