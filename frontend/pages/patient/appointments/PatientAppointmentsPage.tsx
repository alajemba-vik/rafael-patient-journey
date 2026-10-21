import { useMyAppointments } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { formatTime, formatWeekday } from "../../../components/format";
import { PageHeader } from "../../../components/layout/PageHeader";

export function PatientAppointmentsPage() {
  const appointments = useMyAppointments();

  return (
    <>
      <PageHeader title="Vos rendez-vous" />
      <QueryState
        query={appointments}
        empty={{
          isEmpty: (list) => list.length === 0,
          title: "Aucun rendez-vous prévu.",
          children: <p>Votre coordinatrice ou coordinateur organise vos rendez-vous avec vous.</p>,
        }}
      >
        {(list) => (
          <div className="rf-table-wrap">
            <table className="rf-table">
              <caption className="rf-muted">Les trois prochains mois</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Heure</th>
                  <th scope="col">Avec</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td>{formatWeekday(a.starts_at)}</td>
                    <td>
                      {formatTime(a.starts_at)} – {formatTime(a.ends_at)}
                    </td>
                    <td>{a.professional_name}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
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
export { PatientAppointmentsPage as Component };
