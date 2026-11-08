import type { Schemas } from "../api/core/client";

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

/** What each role's people are called. The `secretary` role is the reception desk. */
export const ROLE_LABELS: Record<Schemas["Role"], string> = {
  patient: "Patient·e",
  secretary: "Chargé·e d’accueil",
  professional: "Praticien·ne",
  coordinator: "Coordinateur·rice",
  admin: "Administrateur·rice",
};

export const STATUS_LABELS: Record<Schemas["AppointmentStatus"], string> = {
  scheduled: "Prévu",
  arrived: "En salle d’attente",
  in_session: "En séance",
  done: "Terminé",
  no_show: "Absent·e",
  cancelled: "Annulé",
};

export const CANCEL_REASON_LABELS: Record<Schemas["CancelReason"], string> = {
  patient_request: "Le patient a prévenu",
  practitioner_unavailable: "Praticien·ne indisponible",
  other: "Autre raison",
};
