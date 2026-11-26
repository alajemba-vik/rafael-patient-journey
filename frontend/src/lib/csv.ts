/**
 * CSV files that open cleanly in Excel set to French: semicolon-separated, UTF-8 with a BOM
 * so accents survive, and cells that look like formulas defused (CSV injection).
 */
export type Cell = string | number | null | undefined;

const SEPARATOR = ";";
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value).replace(".", ",") : value;
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(SEPARATOR)).join("\r\n");
}

/** Hands the browser a .csv file to save. */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]): void {
  const blob = new Blob(["﻿", toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
