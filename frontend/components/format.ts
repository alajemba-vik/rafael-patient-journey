// Dates, times and numbers the French way, in the Institute's time zone.
const TIME_ZONE = "Europe/Paris";

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
