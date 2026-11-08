// Dates, times and numbers the French way, in the Institute's time zone.
import { INSTITUTE_TIME_ZONE as TIME_ZONE } from "./time";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: TIME_ZONE });
const weekdayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** "19 octobre 2026" */
export function formatDate(value: string): string {
  return dateFormat.format(new Date(value));
}

/** "lundi 19 octobre" */
export function formatWeekday(value: string): string {
  return weekdayFormat.format(new Date(value));
}

/** "14 h 30" */
export function formatTime(value: string): string {
  return timeFormat.format(new Date(value)).replace(":", " h ");
}

/** "octobre 2026", from a "2026-10" period. */
export function formatMonth(period: string): string {
  return monthFormat.format(new Date(`${period}-01T00:00:00Z`));
}

/** "66,7" */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** "+12,5" or "−3" */
export function formatChange(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${numberFormat.format(Math.abs(value))}`;
}

/** "06 12 34 56 78", "+33 6 12 34 56 78": stored numbers, grouped the French way to read aloud. */
export function formatPhone(value: string): string {
  if (/^0\d{9}$/.test(value)) return value.replace(/(\d{2})(?=\d)/g, "$1 ");
  if (/^\+33\d{9}$/.test(value)) return `+33 ${value.slice(3, 4)} ${value.slice(4).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  return value;
}

/** "8 min", "1 h 05" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}
