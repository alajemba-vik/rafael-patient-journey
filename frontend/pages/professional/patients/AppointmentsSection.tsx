import { useMe } from "../../../api/me";
import { useCancelAppointment, usePatientAppointments } from "../../../api/scheduling";
import { QueryState } from "../../../components/feedback/QueryState";
import { StatusBadge } from "../../../components/feedback/StatusBadge";
import { BookingForm } from "../../../components/forms/BookingForm";
import { ConfirmButton } from "../../../components/forms/ConfirmButton";
import { formatDate, formatTime } from "../../../components/format";

/** A patient's appointments. Coordinators and reception book and cancel here. */
export function AppointmentsSection({ patientId }: { patientId: string }) {
  const appointments = usePatientAppointments(patientId);
  const role = useMe().data?.role;
  const canBook = role === "coordinator" || role === "secretary";
  const cancel = useCancelAppointment();

  return (
    <section className="rf-section" aria-labelledby="appointments-title">
      <h2 id="appointments-title" className="rf-title">
        Rendez-vous
      </h2>
      {canBook && (
        <details className="rf-disclosure rf-section">
          <summary>Prendre un rendez-vous</summary>
          <div className="rf-disclosure__body">
            <BookingForm patientId={patientId} />
          </div>
        </details>
      )}
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
                  {canBook && <th scope="col">Action</th>}
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
                    {canBook && (
                      <td>
                        {a.status === "scheduled" && (
                          <ConfirmButton
                            question="Annuler ce rendez-vous ?"
                            confirmLabel="Annuler le rendez-vous"
                            onConfirm={() => cancel.mutate(a.id)}
                            pending={cancel.isPending && cancel.variables === a.id}
                          >
                            Annuler
                          </ConfirmButton>
                        )}
                      </td>
                    )}
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
