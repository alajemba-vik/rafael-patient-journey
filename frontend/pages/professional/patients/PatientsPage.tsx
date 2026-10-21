import { useState } from "react";
import { Link } from "react-router";

import { usePermissions } from "../../../api/permissions";
import { usePatients } from "../../../api/patients";
import { QueryState } from "../../../components/feedback/QueryState";
import { TextField } from "../../../components/forms/TextField";
import { useDebouncedValue } from "../../../components/forms/useDebouncedValue";
import { formatDate } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";
import { paths } from "../../../app/paths";

export function PatientsPage() {
  const [search, setSearch] = useState("");
  const [unassigned, setUnassigned] = useState(false);
  const patients = usePatients(useDebouncedValue(search), unassigned);
  const canTakeOn = usePermissions().takeOnPatients;

  return (
    <>
      <PageHeader title={unassigned ? "Nouveaux patients" : "Mes patients"} />
      <div className="rf-toolbar">
        {canTakeOn && (
          <div className="rf-segmented" role="group" aria-label="Quels patients afficher">
            <button type="button" aria-pressed={!unassigned} onClick={() => setUnassigned(false)}>
              Mes patients
            </button>
            <button type="button" aria-pressed={unassigned} onClick={() => setUnassigned(true)}>
              Sans coordination
            </button>
          </div>
        )}
        <TextField
          label="Rechercher par nom"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoComplete="off"
        />
      </div>
      <QueryState
        query={patients}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: search
            ? "Aucun patient ne correspond à cette recherche."
            : unassigned
              ? "Tous les patients ont une coordinatrice ou un coordinateur."
              : "Aucun patient dans votre file active pour le moment.",
        }}
      >
        {(list) => (
          <div className="rf-table-wrap">
            <table className="rf-table">
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Date de naissance</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="rf-link" to={paths.pro.patient(p.id)}>
                        {p.last_name.toUpperCase()} {p.first_name}
                      </Link>
                    </td>
                    <td>{formatDate(p.birth_date)}</td>
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
