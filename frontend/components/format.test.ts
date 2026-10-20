import { describe, expect, it } from "vitest";

import { formatChange, formatDate, formatMonth, formatNumber, formatTime } from "./format";

describe("French formatting in Paris time", () => {
  it("formats dates, times and months", () => {
    expect(formatDate("2026-10-19T12:00:00Z")).toBe("19 octobre 2026");
    expect(formatTime("2026-10-19T12:30:00Z")).toBe("14 h 30");
    expect(formatMonth("2026-10")).toBe("octobre 2026");
  });

  it("formats numbers with a decimal comma and signed changes", () => {
    expect(formatNumber(66.66)).toBe("66,7");
    expect(formatChange(12.5)).toBe("+12,5");
    expect(formatChange(-3)).toBe("−3");
  });
});
