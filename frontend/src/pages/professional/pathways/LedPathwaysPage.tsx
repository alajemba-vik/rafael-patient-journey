import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useLedPathways } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { instituteToday } from "../../../lib/time";
import { paths } from "../../../app/paths";

export function LedPathwaysPage() {
  const { t } = useTranslation();
  const pathways = useLedPathways();
  const today = instituteToday();

  return (
    <>
      <PageHeader title={t("ledPathways.title")} />
      <QueryState
        query={pathways}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: t("ledPathways.empty"),
          children: (
            <Link className="rf-link" to={paths.pro.patients}>
              {t("ledPathways.seeUnassigned")}
            </Link>
          ),
        }}
      >
        {(list) => (
          <div className="rf-table-wrap">
            <table className="rf-table">
              <thead>
                <tr>
                  <th scope="col">{t("ledPathways.patient")}</th>
                  <th scope="col">{t("ledPathways.openedOn")}</th>
                  <th scope="col">{t("ledPathways.nextMilestone")}</th>
                  <th scope="col">{t("ledPathways.dueAround")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const late = p.next_due_on !== null && p.next_due_on < today;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link className="rf-link" to={paths.pro.patient(p.patient_id)}>
                          {p.patient_name}
                        </Link>
                      </td>
                      <td>{formatDate(p.opened_at)}</td>
                      <td>{p.next_milestone ? t(`labels.milestone.${p.next_milestone}`) : t("ledPathways.allDone")}</td>
                      <td>
                        {p.next_due_on ? formatDate(p.next_due_on) : "—"}{" "}
                        {late && <span className="rf-badge rf-badge--no_show">{t("ledPathways.late")}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </>
  );
}

// React Router loads a lazy route's component from this export.
export { LedPathwaysPage as Component };
