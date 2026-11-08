import { useId, useState } from "react";
import { Link } from "react-router";

import { ApiError } from "../../../api/core/client";
import { useChangeStatus } from "../../../api/reception";
import type { Appointment } from "../../../api/scheduling";
import { ManageAppointment } from "../../../components/appointments/ManageAppointment";
import { Button } from "../../../components/forms/Button";
import { formatMinutes, formatTime } from "../../../lib/format";
import { CANCEL_REASON_LABELS } from "../../../lib/labels";
import { minutesBetween } from "../../../lib/time";
import { paths } from "../../../app/paths";
import { LONG_WAIT_MINUTES, minutesLate, type StatusAction } from "./board";

type Props = {
  appointment: Appointment;
  now: Date;
  /** Today's board: waiting times and lateness count. Other days show none. */
  live: boolean;
  /** The steps reception can record from here (see `actionsFor`). */
  actions: StatusAction[];
  /** Move, cancel and annotate: off in the closed lists (done, no-show, cancelled). */
  manageable?: boolean;
};

/** One appointment on the board: who, when, how long they've waited, and the next step. */
export function AppointmentCard({ appointment: a, now, live, actions, manageable }: Props) {
  // One status change per card: clicks on two cards never cancel each other's progress.
  const change = useChangeStatus();
  const signal = live ? timeSignal(a, now) : null;
  // Move, cancel and note stay one click away so the board reads as names and next steps.
  const [managing, setManaging] = useState(false);
  const manageId = useId();
  // With a "more" menu, only the main next step stays on the card; undos live in the menu.
  const visible = manageable ? actions.filter((action) => action.primary) : actions;
  const tucked = manageable ? actions.filter((action) => !action.primary) : [];
  // No step to record (a day still to come): move, cancel and note go straight on the card.
  const direct = manageable && actions.length === 0;
  const hasMenu = manageable && !direct;

  const buttons = (list: StatusAction[]) =>
    list.map((action) => (
      <Button
        key={action.status}
        variant={action.primary ? "primary" : "secondary"}
        className={action.primary ? "rf-btn--compact" : "rf-btn--compact rf-btn--quiet"}
        pending={change.isPending && change.variables.status === action.status}
        disabled={change.isPending}
        onClick={() => change.mutate({ appointmentId: a.id, status: action.status })}
      >
        {action.label}
        <span className="rf-visually-hidden"> · {a.patient_name}</span>
      </Button>
    ));

  return (
    <li className={["rf-card", signal?.attention && "rf-card--attention"].filter(Boolean).join(" ")}>
      <div className="rf-card__head">
        <span className="rf-card__time">
          {formatTime(a.starts_at)} – {formatTime(a.ends_at)}
        </span>
        {signal && <span className="rf-flag">{signal.text}</span>}
      </div>
      <span className="rf-card__name">
        <Link to={paths.reception.patient(a.patient_id)}>{a.patient_name}</Link>
      </span>
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
      {change.isError && (
        <p className="rf-field__error" role="alert">
          {statusErrorMessage(change.error)}
        </p>
      )}
      {direct && <ManageAppointment appointment={a} />}
      {(visible.length > 0 || hasMenu) && (
        <div className="rf-card__actions">
          {buttons(visible)}
          {hasMenu && (
            <Button
              variant="secondary"
              className="rf-btn--compact rf-btn--quiet rf-card__more"
              aria-expanded={managing}
              aria-controls={managing ? manageId : undefined}
              onClick={() => setManaging(!managing)}
            >
              {managing ? "Moins d’options" : "Plus d’options"}
              <span className="rf-visually-hidden"> · {a.patient_name}</span>
            </Button>
          )}
        </div>
      )}
      {managing && (
        <div id={manageId} className="rf-card__menu">
          {tucked.length > 0 && <div className="rf-card__actions">{buttons(tucked)}</div>}
          <ManageAppointment appointment={a} />
        </div>
      )}
    </li>
  );
}

function statusErrorMessage(error: Error): string {
  return error instanceof ApiError && error.status === 409
    ? "Pas enregistré : ce rendez-vous venait de changer. La carte est à jour, vérifiez avant de recommencer."
    : "Pas enregistré. Réessayez.";
}

/** What the clock says about this appointment, if anything worth reading at a glance. */
function timeSignal(a: Appointment, now: Date): { text: string; attention: boolean } | null {
  if (a.status === "arrived" && a.arrived_at) {
    const waited = minutesBetween(a.arrived_at, now);
    return { text: `Attend depuis ${formatMinutes(waited)}`, attention: waited >= LONG_WAIT_MINUTES };
  }
  if (a.status === "in_session" && a.called_in_at) {
    return { text: `En séance depuis ${formatMinutes(minutesBetween(a.called_in_at, now))}`, attention: false };
  }
  const late = minutesLate(a, now);
  if (late > 0) return { text: `En retard · ${formatMinutes(late)}`, attention: true };
  return null;
}
