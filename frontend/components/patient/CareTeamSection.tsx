import { useState, type FormEvent } from "react";

import { useAddToCareTeam, useCareStaff, useCareTeam, useRemoveFromCareTeam } from "../../api/careTeam";
import { useMe } from "../../api/me";
import { QueryState } from "../feedback/QueryState";
import { Button } from "../forms/Button";
import { ConfirmButton } from "../forms/ConfirmButton";
import { SelectField } from "../forms/SelectField";
import { ROLE_LABELS } from "../labels";

export function CareTeamSection({ patientId }: { patientId: string }) {
  const team = useCareTeam(patientId);
  const isCoordinator = useMe().data?.role === "coordinator";
  const remove = useRemoveFromCareTeam();

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
                <span>
                  {m.full_name}
                  <br />
                  <span className="rf-muted">{m.discipline ?? ROLE_LABELS[m.role]}</span>
                </span>
                {isCoordinator && (
                  <ConfirmButton
                    question={`Retirer ${m.full_name} ?`}
                    confirmLabel="Retirer"
                    onConfirm={() => remove.mutate(m.assignment_id)}
                    pending={remove.isPending && remove.variables === m.assignment_id}
                  >
                    Retirer
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {isCoordinator && team.data && (
        <AddMemberForm patientId={patientId} memberIds={new Set(team.data.map((m) => m.user_id))} />
      )}
    </section>
  );
}

function AddMemberForm({ patientId, memberIds }: { patientId: string; memberIds: Set<string> }) {
  const staff = useCareStaff();
  const add = useAddToCareTeam();
  const [chosen, setChosen] = useState("");
  const available = (staff.data ?? [])
    .filter((s) => !memberIds.has(s.id))
    .sort((a, b) => (a.discipline ?? "").localeCompare(b.discipline ?? "") || a.full_name.localeCompare(b.full_name));

  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate({ patient_id: patientId, professional_id: chosen }, { onSuccess: () => setChosen("") });
  }

  return (
    <form className="rf-form" onSubmit={submit}>
      <SelectField label="Ajouter à l’équipe" required value={chosen} onChange={(e) => setChosen(e.target.value)}>
        <option value="">Choisir une personne</option>
        {available.map((s) => (
          <option key={s.id} value={s.id}>
            {s.discipline ?? ROLE_LABELS[s.role]} · {s.full_name}
          </option>
        ))}
      </SelectField>
      {add.isError && (
        <p className="rf-field__error" role="alert">
          L’ajout n’a pas abouti. Réessayez.
        </p>
      )}
      <Button type="submit" variant="secondary" pending={add.isPending}>
        Ajouter
      </Button>
    </form>
  );
}
