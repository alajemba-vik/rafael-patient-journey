import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useOpenNeeds, useResolveNeed } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { formatDate } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../app/paths";

export function NeedsPage() {
  const { t } = useTranslation();
  const needs = useOpenNeeds();
  const resolve = useResolveNeed();

  return (
    <div className="rf-narrow">
      <PageHeader title={t("needs.title")} />
      <QueryState
        query={needs}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: t("needs.empty"),
          children: <p>{t("needs.emptyHint")}</p>,
        }}
      >
        {(list) => (
          <ul className="rf-list">
            {list.map((need) => (
              <li key={need.id}>
                <div className="rf-stack">
                  <p>
                    <Link className="rf-link" to={paths.pro.patient(need.patient_id)}>
                      {need.patient_name}
                    </Link>{" "}
                    <span className="rf-muted">
                      {t("needs.raisedBy", { name: need.raised_by_name, date: formatDate(need.raised_at) })}
                    </span>
                  </p>
                  <p>{need.note}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => resolve.mutate(need.id)}
                  pending={resolve.isPending && resolve.variables === need.id}
                >
                  {t("needs.resolve")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

// React Router loads a lazy route's component from this export.
export { NeedsPage as Component };
