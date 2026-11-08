import type { Schemas } from "../../api/client";
import { STATUS_LABELS } from "../labels";

/** An appointment's status, always in words: color only reinforces it. */
export function StatusBadge({ status }: { status: Schemas["AppointmentStatus"] }) {
  return <span className={`rf-badge rf-badge--${status}`}>{STATUS_LABELS[status]}</span>;
}
