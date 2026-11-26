import { useTranslation } from "react-i18next";

import { WeekPlanning } from "../../../components/appointments/WeekPlanning";
import { PageHeader } from "../../../components/layout/PageHeader";

export function ReceptionPlanningPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t("planning.title")} />
      <p className="rf-muted rf-section">{t("planning.intro")}</p>
      <WeekPlanning />
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { ReceptionPlanningPage as Component };
