import { useState } from "react";
import { Link } from "react-router";

import { usePatients } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { TextField } from "../../../components/forms/TextField";
import { useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { formatDate, formatPhone } from "../../../lib/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { RegisterPatientForm } from "./RegisterPatientForm";
import { paths } from "../../../app/paths";

export function ReceptionPatientsPage() {
  const [search, setSearch] = useState("");
  const patients = usePatients(useDebouncedValue(search));

  return (
    <>
      <PageHeader title="Patients" />
      <details className="rf-disclosure rf-section">
        <summary>Enregistrer un patient</summary>
        <div className="rf-disclosure__body">
          <RegisterPatientForm />
        </div>
      </details>
      <div className="rf-toolbar">
        <TextField
          label="Rechercher par nom ou téléphone"
          hint="Début du nom, ou au moins 3 chiffres du numéro."
          type="search"
          autoComplete="off"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <QueryState
        query={patients}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: search ? "Aucun patient ne correspond à cette recherche." : "Aucun patient enregistré.",
        }}
      >
        {(list) => (
          <ul className="rf-list" aria-label="Patients">
            {list.map((p) => (
              <li key={p.id}>
                <div className="rf-stack">
                  <Link className="rf-link" to={paths.reception.patient(p.id)}>
                    {p.last_name.toUpperCase()} {p.first_name}
                  </Link>
                  <span className="rf-muted">né·e le {formatDate(p.birth_date)}</span>
                </div>
                <span className="rf-muted">{p.phone ? formatPhone(p.phone) : "Pas de téléphone"}</span>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </>
  );
}

// React Router loads a lazy route's component from this export.
export { ReceptionPatientsPage as Component };
