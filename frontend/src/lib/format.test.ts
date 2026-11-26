import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "../i18n";
import { formatChange, formatDate, formatMinutes, formatMonth, formatNumber, formatTime } from "./format";

describe("formatting in Paris time", () => {
  afterEach(() => i18n.changeLanguage("fr"));

  it("formats dates, times and months the French way", () => {
    expect(formatDate("2026-10-19T12:00:00Z")).toBe("19 octobre 2026");
    expect(formatTime("2026-10-19T12:30:00Z")).toBe("14 h 30");
    expect(formatMonth("2026-10")).toBe("octobre 2026");
  });

  it("formats numbers with a decimal comma and signed changes", () => {
    expect(formatNumber(66.66)).toBe("66,7");
    expect(formatChange(12.5)).toBe("+12,5");
    expect(formatChange(-3)).toBe("−3");
  });

  it("follows the interface's language, still on the Paris clock", async () => {
    await i18n.changeLanguage("en");

    expect(formatDate("2026-10-19T12:00:00Z")).toBe("19 October 2026");
    expect(formatTime("2026-10-19T12:30:00Z")).toBe("14:30");
    expect(formatNumber(66.66)).toBe("66.7");
    expect(formatMinutes(65)).toBe("1 h 05");
  });
});
