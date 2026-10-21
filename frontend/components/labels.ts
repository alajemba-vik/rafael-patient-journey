import type { Schemas } from "../api/client";

/** French names for the pathway's milestones and self-assessment dimensions. */
export const MILESTONE_LABELS: Record<Schemas["MilestoneKind"], string> = {
  intake: "Premier bilan",
  review: "Bilan à mi-parcours",
  final: "Bilan final",
};

export const DIMENSIONS = [
  ["physical", "Physique et sportif"],
  ["psychological", "Psychologique"],
  ["emotional", "Émotionnel"],
  ["sexual", "Sexuel"],
  ["socio_professional", "Socio-professionnel"],
] as const;

export const ROLE_LABELS: Record<Schemas["Role"], string> = {
  patient: "Patient·e",
  secretary: "Accueil",
  professional: "Praticien·ne",
  coordinator: "Coordination",
  admin: "Administration",
};
