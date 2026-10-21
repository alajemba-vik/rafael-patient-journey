import { usePatientAppointments } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { formatDate, formatTime } from "../../../components/format";

export function AppointmentsSection({ patientId }: { patientId: string }) {
  const appointments = usePatientAppointments(patientId);

  return (
    <section className="rf-section" aria-labelledby="appointments-title">
      <h2 id="appointments-title" className="rf-title">
        Rendez-vous
      </h2>
      <QueryState
        query={appointments}
        empty={{ isEmpty: (list) => list.length === 0, title: "Aucun rendez-vous pour ce patient." }}
      >
        {(list) => (
          <div className="rf-table-wrap">
            <table className="rf-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Heure</th>
                  <th scope="col">Avec</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {[...list].reverse().map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.starts_at)}</td>
                    <td>{formatTime(a.starts_at)}</td>
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
    </section>
  );
}
