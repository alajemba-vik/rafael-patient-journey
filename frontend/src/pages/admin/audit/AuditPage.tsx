import { useState } from "react";

import { useAccounts, useAuditEvents } from "../../../api/identity_access";
import { usePatients } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { SelectField } from "../../../components/forms/SelectField";
import { TextField } from "../../../components/forms/TextField";
import { PageHeader } from "../../../components/layout/PageHeader";
import { formatDate } from "../../../lib/format";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { instituteClock } from "../../../lib/time";

// Searching patients is itself recorded in the journal, so nothing is listed before a real search.
const MIN_SEARCH = 2;

export function AuditPage() {
  const accounts = useAccounts();
  const [actorId, setActorId] = useState("");
  const [search, setSearch] = useState("");
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const events = useAuditEvents({ patientId: patient?.id, actorId: actorId || undefined });

  return (
    <>
      <PageHeader title="Journal d’accès" />
      <p className="rf-muted rf-section">
        Qui a consulté ou modifié les données d’un patient, et quand. Les 200 événements les plus récents sont affichés
        ; chaque consultation de ce journal y est elle-même inscrite.
      </p>
      <div className="rf-toolbar rf-section">
        <SelectField label="Compte" value={actorId} onChange={(e) => setActorId(e.target.value)}>
          <option value="">Tous les comptes</option>
          {(accounts.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Rechercher un patient"
          hint="Début du nom ou du prénom."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPatient(null);
          }}
        />
        {debouncedSearch.length >= MIN_SEARCH && (
          <PatientChoice search={debouncedSearch} selectedId={patient?.id ?? ""} onChoose={setPatient} />
        )}
      </div>
      <QueryState
        query={events}
        empty={{ isEmpty: (list) => list.length === 0, title: "Aucun événement pour ces critères." }}
      >
        {(list) => (
          <div className="rf-table-wrap">
            <table className="rf-table">
              <caption className="rf-visually-hidden">
                {patient ? `Événements concernant ${patient.name}` : "Événements récents"}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Heure</th>
                  <th scope="col">Compte</th>
                  <th scope="col">Action</th>
                  <th scope="col">Patient</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.occurred_at)}</td>
                    <td>{instituteClock(e.occurred_at)}</td>
                    <td>{e.actor_name ?? "Compte inconnu"}</td>
                    <td>
                      <code>{e.action}</code>
                    </td>
                    <td>{patientLabel(e.patient_id, patient)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </>
  );
}

/** The API gives the patient's id only; the name is known when the admin searched for that patient. */
function patientLabel(patientId: string | null, chosen: { id: string; name: string } | null): string {
  if (patientId === null) return "—";
  return chosen?.id === patientId ? chosen.name : `Dossier ${patientId.slice(0, 8)}`;
}

function PatientChoice({
  search,
  selectedId,
  onChoose,
}: {
  search: string;
  selectedId: string;
  onChoose: (patient: { id: string; name: string } | null) => void;
}) {
  const matches = usePatients(search).data ?? [];

  return (
    <SelectField
      label="Patient"
      value={selectedId}
      onChange={(e) => {
        const found = matches.find((p) => p.id === e.target.value);
        onChoose(found ? { id: found.id, name: `${found.first_name} ${found.last_name}` } : null);
      }}
    >
      <option value="">{matches.length === 0 ? "Aucun patient trouvé" : "Choisir un patient"}</option>
      {matches.map((p) => (
        <option key={p.id} value={p.id}>
          {p.last_name.toUpperCase()} {p.first_name}
        </option>
      ))}
    </SelectField>
  );
}

// React Router loads a lazy route's component from this export.
export { AuditPage as Component };
