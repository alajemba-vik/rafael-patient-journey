import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../app/paths";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="rf-narrow">
      <PageHeader title={t("notFound.title")} />
      <p>{t("notFound.text")}</p>
      <Link to={paths.home} className="rf-btn">
        {t("feedback.backHome")}
      </Link>
    </div>
  );
}
