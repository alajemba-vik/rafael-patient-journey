import { Link } from "react-router";

import { useOpenNeeds, useResolveNeed } from "../../../api/pathways";
import { QueryState } from "../../../components/feedback/QueryState";
import { Button } from "../../../components/forms/Button";
import { formatDate } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../paths";

export function NeedsPage() {
  const needs = useOpenNeeds();
  const resolve = useResolveNeed();

  return (
    <div className="rf-narrow">
      <PageHeader title="Besoins signalés" />
      <QueryState
        query={needs}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: "Aucun besoin en attente.",
          children: <p>Les besoins signalés par les praticiens sur vos parcours apparaîtront ici.</p>,
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
                      · {need.raised_by_name}, le {formatDate(need.raised_at)}
                    </span>
                  </p>
                  <p>{need.note}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => resolve.mutate(need.id)}
                  pending={resolve.isPending && resolve.variables === need.id}
                >
                  Marquer comme traité
                </Button>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}
