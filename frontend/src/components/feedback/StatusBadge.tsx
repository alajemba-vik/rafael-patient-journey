import { useTranslation } from "react-i18next";

import type { Schemas } from "../../api/core/client";

/** An appointment's status, always in words: color only reinforces it. */
export function StatusBadge({ status }: { status: Schemas["AppointmentStatus"] }) {
  const { t } = useTranslation();
  return <span className={`rf-badge rf-badge--${status}`}>{t(`labels.status.${status}`)}</span>;
}
