import { useState } from "react";
import { Link } from "react-router";

import { usePatients } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { TextField } from "../../../components/forms/TextField";
import { useDebouncedValue } from "../../../components/forms/useDebouncedValue";
import { formatDate } from "../../../components/format";
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
          label="Rechercher par nom"
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
          <div className="rf-table-wrap">
            <table className="rf-table">
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Date de naissance</th>
                  <th scope="col">Téléphone</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="rf-link" to={paths.reception.patient(p.id)}>
                        {p.last_name.toUpperCase()} {p.first_name}
                      </Link>
                    </td>
                    <td>{formatDate(p.birth_date)}</td>
                    <td>{p.phone ?? "—"}</td>
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

// React Router loads a lazy route's component from this export.
export { ReceptionPatientsPage as Component };
