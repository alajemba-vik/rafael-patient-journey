import { useCareTeam } from "../../../api/careTeam";
import { QueryState } from "../../../components/feedback/QueryState";
import { ROLE_LABELS } from "../../../components/labels";

export function CareTeamSection({ patientId }: { patientId: string }) {
  const team = useCareTeam(patientId);

  return (
    <section className="rf-panel" aria-labelledby="team-title">
      <h2 id="team-title" className="rf-title">
        Équipe de soins
      </h2>
      <QueryState query={team} empty={{ isEmpty: (list) => list.length === 0, title: "Aucun membre pour le moment." }}>
        {(members) => (
          <ul className="rf-list">
            {members.map((m) => (
              <li key={m.assignment_id}>
                <span>{m.full_name}</span>
                <span className="rf-muted">{m.discipline ?? ROLE_LABELS[m.role]}</span>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </section>
  );
}
