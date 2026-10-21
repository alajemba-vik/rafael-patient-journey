import { Link } from "react-router";

import { useLedPathways } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { formatDate } from "../../../components/format";
import { MILESTONE_LABELS } from "../../../components/labels";
import { PageHeader } from "../../../components/layout/PageHeader";
import { instituteToday } from "../../../components/time";
import { paths } from "../../../app/paths";

export function LedPathwaysPage() {
  const pathways = useLedPathways();
  const today = instituteToday();

  return (
    <>
      <PageHeader title="Mes parcours" />
      <QueryState
        query={pathways}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: "Vous ne coordonnez aucun parcours en cours.",
          children: (
            <Link className="rf-link" to={paths.pro.patients}>
              Voir les patients sans coordination
            </Link>
          ),
        }}
      >
        {(list) => (
          <div className="rf-table-wrap">
            <table className="rf-table">
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Ouvert le</th>
                  <th scope="col">Prochain bilan</th>
                  <th scope="col">Prévu vers le</th>
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
                      <td>{p.next_milestone ? MILESTONE_LABELS[p.next_milestone] : "Tous les bilans sont faits"}</td>
                      <td>
                        {p.next_due_on ? formatDate(p.next_due_on) : "—"}{" "}
                        {late && <span className="rf-badge rf-badge--no_show">En retard</span>}
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
