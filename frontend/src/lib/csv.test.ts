import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("separates with semicolons and writes decimals the French way", () => {
    expect(
      toCsv(
        ["Nom", "Score"],
        [
          ["Alex", 72.5],
          ["Sam", null],
        ],
      ),
    ).toBe("Nom;Score\r\nAlex;72,5\r\nSam;");
  });

  it("quotes cells holding a separator, a quote or a line break", () => {
    expect(toCsv(["Note"], [['Dit "bonjour"; part'], ["deux\nlignes"]])).toBe(
      'Note\r\n"Dit ""bonjour""; part"\r\n"deux\nlignes"',
    );
  });

  it("defuses text that a spreadsheet would run as a formula", () => {
    expect(toCsv(["Nom"], [['=HYPERLINK("x")'], ["-2+3"]])).toBe('Nom\r\n"\'=HYPERLINK(""x"")"\r\n\'-2+3');
  });
});
