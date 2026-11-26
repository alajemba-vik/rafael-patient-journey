import type { ClinicalProfile } from "../api/patients";

// The same lists as the backend (patients/models.py), in the questionnaire's order.
export const CANCER_SITES = [
  "breast",
  "prostate",
  "brain",
  "head_neck",
  "sinus",
  "thyroid",
  "lung",
  "oesophagus",
  "stomach",
  "liver",
  "gallbladder",
  "pancreas",
  "kidney",
  "colorectal",
  "urothelial",
  "anal",
  "ovary",
  "endometrium",
  "cervix",
  "vagina",
  "vulva",
  "testis",
  "skin",
  "lymph_node",
  "blood",
  "other",
] as const;
export const WORK_SITUATIONS = ["active", "retired", "sick_leave", "therapeutic_part_time", "other"] as const;
export const TREATMENT_KINDS = [
  "surgery",
  "chemotherapy",
  "radiotherapy",
  "hormone_therapy",
  "immunotherapy",
  "targeted_therapy",
  "other",
] as const;
export const TREATMENT_STATUSES = ["ongoing", "finished"] as const;

export type CancerSite = (typeof CANCER_SITES)[number];
export type WorkSituation = (typeof WORK_SITUATIONS)[number];
export type TreatmentKind = (typeof TREATMENT_KINDS)[number];

export const YES_NO_FIELDS = [
  "metastatic",
  "lives_alone",
  "has_dependants",
  "has_caregivers",
  "smoker",
  "drinks_alcohol",
  "takes_supplements",
] as const satisfies readonly (keyof ClinicalProfile)[];

/** Body mass index, rounded to one decimal, or null when height or weight is missing. */
export function bodyMassIndex(heightCm: number | null | undefined, weightKg: number | null | undefined) {
  if (!heightCm || !weightKg) return null;
  return Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10;
}
