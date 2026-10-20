import type { Schemas } from "../../api/client";

type Status = Schemas["AppointmentStatus"];

const LABELS: Record<Status, string> = {
  scheduled: "Prévu",
  arrived: "Arrivé·e",
  done: "Terminé",
  no_show: "Absent·e",
  cancelled: "Annulé",
};

/** An appointment's status, always in words: color only reinforces it. */
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`rf-badge rf-badge--${status}`}>{LABELS[status]}</span>;
}
