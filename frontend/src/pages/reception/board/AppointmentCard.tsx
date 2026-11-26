import type { TFunction } from "i18next";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { ApiError } from "../../../api/core/client";
import { useChangeStatus } from "../../../api/reception";
import type { Appointment } from "../../../api/scheduling";
import { ManageAppointment } from "../../../components/appointments/ManageAppointment";
import { Button } from "../../../components/forms/Button";
import { formatMinutes, formatTime } from "../../../lib/format";
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
  const { t } = useTranslation();
  const change = useChangeStatus();
  const signal = live ? timeSignal(a, now, t) : null;
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
        {t(action.label)}
        <span className="rf-visually-hidden"> · {a.patient_name}</span>
      </Button>
    ));

  return (
    <li
      className={[
        "rf-card",
        `rf-card--${a.status}`, // Ajout de la classe de statut
        signal?.attention && "rf-card--attention",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
        {t("board.with", { name: a.professional_name })}
        {a.cancel_reason && ` · ${t(`labels.cancelReason.${a.cancel_reason}`)}`}
      </p>
      {a.note && (
        <p className="rf-note">
          <span className="rf-visually-hidden">{t("board.notePrefix")}</span>
          {a.note}
        </p>
      )}
      {change.isError && (
        <p className="rf-field__error" role="alert">
          {statusErrorMessage(change.error, t)}
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
              {managing ? t("board.fewerOptions") : t("board.moreOptions")}
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

function statusErrorMessage(error: Error, t: TFunction): string {
  return error instanceof ApiError && error.status === 409 ? t("board.statusConflict") : t("board.statusFailed");
}

/** What the clock says about this appointment, if anything worth reading at a glance. */
function timeSignal(a: Appointment, now: Date, t: TFunction): { text: string; attention: boolean } | null {
  if (a.status === "arrived" && a.arrived_at) {
    const waited = minutesBetween(a.arrived_at, now);
    return { text: t("board.waitingFor", { duration: formatMinutes(waited) }), attention: waited >= LONG_WAIT_MINUTES };
  }
  if (a.status === "in_session" && a.called_in_at) {
    return {
      text: t("board.inSessionFor", { duration: formatMinutes(minutesBetween(a.called_in_at, now)) }),
      attention: false,
    };
  }
  const late = minutesLate(a, now);
  if (late > 0) return { text: t("board.late", { duration: formatMinutes(late) }), attention: true };
  return null;
}
