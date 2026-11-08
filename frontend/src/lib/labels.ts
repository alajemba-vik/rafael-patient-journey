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

export const ROLE_LABELS: Record<Schemas["Role"], string> = {
  patient: "Patient·e",
  secretary: "Accueil",
  professional: "Praticien·ne",
  coordinator: "Coordination",
  admin: "Administration",
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
