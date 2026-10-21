// The Institute's clock. Every date shown, entered or compared means Paris time, wherever the
// browser happens to be, matching the backend's INSTITUTE_TIME_ZONE setting.
export const INSTITUTE_TIME_ZONE = "Europe/Paris";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: INSTITUTE_TIME_ZONE });
const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: INSTITUTE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** How far the Institute's clock is ahead of UTC at a given instant, in milliseconds. */
function offsetMs(instant: number): number {
  const p = Object.fromEntries(partsFormat.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  const asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return asIfUtc - Math.floor(instant / 60_000) * 60_000;
}

/** The instant when the Institute's clock reads `time` on `date` ("2026-10-21", "14:30"). */
export function instituteDateTime(date: string, time = "00:00"): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  // Twice, so a guess on the wrong side of a clock change corrects itself.
  const first = wallClock - offsetMs(wallClock);
  return new Date(wallClock - offsetMs(first));
}

/** Today's date at the Institute, "2026-10-21". */
export function instituteToday(): string {
  return dayFormat.format(new Date());
}

/** A date some days later, "2026-10-28". */
export function addDays(date: string, days: number): string {
  const noon = new Date(`${date}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + days);
  return noon.toISOString().slice(0, 10);
}
