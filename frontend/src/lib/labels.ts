import type { Schemas } from "../api/core/client";

// Repeated vocabulary (roles, statuses, milestones, dimensions) is translated under `labels.*`
// in the locale files: `t(\`labels.status.${status}\`)`. This file only lists the keys that
// screens show in a set order.

/** The pathway's self-assessment dimensions, in the order every screen shows them. */
export const DIMENSIONS = ["physical", "psychological", "emotional", "sexual", "socio_professional"] as const;

/** Why an appointment was cancelled, in the order the cancel form offers them. */
export const CANCEL_REASONS: Schemas["CancelReason"][] = ["patient_request", "practitioner_unavailable", "other"];
