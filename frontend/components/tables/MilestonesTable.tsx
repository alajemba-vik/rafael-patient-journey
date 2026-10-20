import type { Schemas } from "../../api/client";
import { DIMENSIONS, MILESTONE_LABELS } from "../labels";

type Milestone = Schemas["PatientMilestone"];

/** The 0–4 self-assessment at each milestone, one column per milestone, so progress reads across. */
export function MilestonesTable({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="rf-table-wrap rf-narrow">
      <table className="rf-table">
        {/* TODO(validate): what 0 and 4 mean on the Institute's self-assessment scale. */}
        <caption className="rf-muted">Auto-évaluation, de 0 à 4</caption>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            {milestones.map((m) => (
              <th key={m.kind} scope="col" className="rf-num">
                {MILESTONE_LABELS[m.kind]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIMENSIONS.map(([key, label]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {milestones.map((m) => (
                <td key={m.kind} className="rf-num">
                  {m[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
