import { i18n } from "../i18n";

/** The five levels of every 0–4 scale the Institute uses. */
export const LEVELS = [0, 1, 2, 3, 4] as const;

type Scale = "difficulty" | "satisfaction" | "coping";

/** The five labels of one 0–4 session scale, in the interface's language. */
export function levelLabels(scale: Scale): string[] {
  return LEVELS.map((level) => i18n.t(`sessions.levels.${scale}.${level}`));
}

/** One rating as its label, or a dash when it hasn't been given. */
export function levelLabel(scale: Scale, value: number | null): string {
  return value === null ? "—" : i18n.t(`sessions.levels.${scale}.${value as (typeof LEVELS)[number]}`);
}
