import type { Schemas } from "../api/core/client";

export type Goal = Schemas["Goal"];
export type AssessmentTest = Schemas["AssessmentTest"];

/** The Institute's goals list, in the order its assessment form shows them. */
export const GOALS: Goal[] = [
  "pain",
  "treatment_side_effects",
  "self_esteem",
  "weight_loss",
  "weight_gain",
  "muscle_strength",
  "emotional_support",
  "sleep",
  "sexual_health",
  "wellbeing",
];
export const MAX_GOALS = 3;
export const MAX_DISCIPLINES = 5;

/** The disciplines a care plan can draw on; the same codes as the backend's catalogue. */
export const DISCIPLINES = [
  "adapted_physical_activity",
  "acupuncture",
  "auriculotherapy",
  "chef_workshop",
  "universal_workshop",
  "art_therapy",
  "therapeutic_singing",
  "choir",
  "sports_coaching",
  "image_consulting",
  "healthy_cooking",
  "dance_therapy",
  "dietetics",
  "drama_therapy",
  "occupational_therapy",
  "writing_therapy",
  "femininity_sensuality",
  "support_group",
  "homeopathy",
  "hypnosis",
  "sensory_immersion",
  "physiotherapy",
  "luxopuncture",
  "massage",
  "neurofeedback_massage",
  "manicure",
  "nutrition_doctor",
  "sleep_medicine",
  "pain_medicine",
  "individual_meditation",
  "group_meditation",
  "micronutrition",
  "career_pathway",
  "music_therapy",
  "naturopathy",
  "neurofeedback",
  "oil_yoga",
  "osteopathy",
  "oncology_aesthetics",
  "pilates",
  "psychiatry",
  "psychology",
  "occupational_psychology",
  "psychomotor_therapy",
  "hair_prosthesis",
  "qi_gong",
  "reiki",
  "reflexology",
  "sexology",
  "sound_therapy",
  "sophrology",
  "sophro_sexology",
  "shiatsu",
  "therapeutic_touch",
  "tuina",
  "yoga",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

/** The assessment day's tests, the range each score can take, and who usually records it. */
export const ASSESSMENT_TESTS: { test: AssessmentTest; min: number; max: number; step: number }[] = [
  { test: "k10", min: 10, max: 50, step: 1 },
  { test: "mna_screening", min: 0, max: 14, step: 1 },
  { test: "marshall", min: 0, max: 8, step: 1 },
  { test: "sitting_hours", min: 0, max: 24, step: 0.5 },
  { test: "balance_right", min: 0, max: 30, step: 1 },
  { test: "balance_left", min: 0, max: 30, step: 1 },
  { test: "sit_to_stand", min: 0, max: 60, step: 1 },
  { test: "handgrip", min: 0, max: 100, step: 0.5 },
];
