// Dates, times and numbers in the interface's language, always in the Institute's time zone.
import { currentLanguage, i18n, LANGUAGES, type Language } from "../i18n";
import { INSTITUTE_TIME_ZONE as TIME_ZONE } from "./time";

type Formatters = {
  date: Intl.DateTimeFormat;
  weekday: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  month: Intl.DateTimeFormat;
  monthShort: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
};

// Building an Intl formatter is slow, so each language's set is built once.
const cache = new Map<Language, Formatters>();

function formatters(): Formatters {
  const language = currentLanguage();
  let set = cache.get(language);
  if (!set) {
    const locale = LANGUAGES[language].intlLocale;
    set = {
      date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: TIME_ZONE }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: TIME_ZONE }),
      time: new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: TIME_ZONE,
      }),
      month: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }),
      monthShort: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }),
      number: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    };
    cache.set(language, set);
  }
  return set;
}

/** "19 octobre 2026" · "19 October 2026" */
export function formatDate(value: string): string {
  return formatters().date.format(new Date(value));
}

/** "lundi 19 octobre" · "Monday 19 October" */
export function formatWeekday(value: string): string {
  return formatters().weekday.format(new Date(value));
}

/** "14 h 30" · "14:30" */
export function formatTime(value: string): string {
  const [hours, minutes] = formatters().time.format(new Date(value)).split(":");
  return i18n.t("format.time", { hours, minutes });
}

/** "octobre 2026" · "October 2026", from a "2026-10" period. */
export function formatMonth(period: string): string {
  return formatters().month.format(new Date(`${period}-01T00:00:00Z`));
}

/** "oct." · "Oct", from a "2026-10" period: for chart axes. */
export function formatMonthShort(period: string): string {
  return formatters().monthShort.format(new Date(`${period}-01T00:00:00Z`));
}

/** "66,7" · "66.7" */
export function formatNumber(value: number): string {
  return formatters().number.format(value);
}

/** "+12,5" or "−3" */
export function formatChange(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatters().number.format(Math.abs(value))}`;
}

/** "06 12 34 56 78", "+33 6 12 34 56 78": stored numbers, grouped the French way to read aloud. */
export function formatPhone(value: string): string {
  if (/^0\d{9}$/.test(value)) return value.replace(/(\d{2})(?=\d)/g, "$1 ");
  if (/^\+33\d{9}$/.test(value)) return `+33 ${value.slice(3, 4)} ${value.slice(4).replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  return value;
}

/** "8 min", "1 h 05" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return i18n.t("format.minutes", { minutes });
  return i18n.t("format.hoursMinutes", {
    hours: Math.floor(minutes / 60),
    minutes: String(minutes % 60).padStart(2, "0"),
  });
}
