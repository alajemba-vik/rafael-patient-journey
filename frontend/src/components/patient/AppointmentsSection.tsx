import { usePermissions } from "../../api/identity_access";
import { usePatientAppointments, type Appointment } from "../../api/scheduling";
import { ManageAppointment } from "../appointments/ManageAppointment";
import { QueryState } from "../feedback/QueryState";
import { StatusBadge } from "../feedback/StatusBadge";
import { BookingForm } from "../forms/BookingForm";
import { formatTime, formatWeekday } from "../format";
import { CANCEL_REASON_LABELS } from "../labels";

/** Split into what's still ahead (soonest first) and the history (latest first). */
export function splitAppointments(list: Appointment[], now: Date) {
  const isAhead = (a: Appointment) => a.status !== "cancelled" && new Date(a.ends_at) >= now;
  const byStart = (a: Appointment, b: Appointment) => a.starts_at.localeCompare(b.starts_at);
  return {
    upcoming: list.filter(isAhead).sort(byStart),
    history: list
      .filter((a) => !isAhead(a))
      .sort(byStart)
      .reverse(),
  };
}

/** A patient's appointments. Coordinators and reception book, move, cancel and annotate here. */
export function AppointmentsSection({ patientId }: { patientId: string }) {
  const appointments = usePatientAppointments(patientId);
  const canBook = usePermissions().bookAppointments;

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
        {(list) => {
          const { upcoming, history } = splitAppointments(list, new Date());
          return (
            <>
              <h3 className="rf-label">À venir</h3>
              {upcoming.length === 0 ? (
                <p className="rf-muted rf-section">Aucun rendez-vous à venir.</p>
              ) : (
                <ul className="rf-cards rf-section">
                  {upcoming.map((a) => (
                    <AppointmentItem key={a.id} appointment={a} manageable={canBook} />
                  ))}
                </ul>
              )}
              {history.length > 0 && (
                <details className="rf-disclosure rf-collapsible">
                  <summary>Historique · {history.length}</summary>
                  <ul className="rf-cards rf-disclosure__body">
                    {history.map((a) => (
                      <AppointmentItem key={a.id} appointment={a} manageable={false} />
                    ))}
                  </ul>
                </details>
              )}
            </>
          );
        }}
      </QueryState>
    </section>
  );
}

function AppointmentItem({ appointment: a, manageable }: { appointment: Appointment; manageable: boolean }) {
  return (
    <li className="rf-card">
      <div className="rf-card__head">
        <span className="rf-card__time rf-capitalize">
          {formatWeekday(a.starts_at)} · {formatTime(a.starts_at)}
        </span>
        <StatusBadge status={a.status} />
      </div>
      <p className="rf-card__meta">
        avec {a.professional_name}
        {a.cancel_reason && ` · ${CANCEL_REASON_LABELS[a.cancel_reason]}`}
      </p>
      {a.note && (
        <p className="rf-note">
          <span className="rf-visually-hidden">Note : </span>
          {a.note}
        </p>
      )}
      {manageable && <ManageAppointment appointment={a} />}
    </li>
  );
}
