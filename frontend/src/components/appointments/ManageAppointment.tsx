import { useId, useState, type FormEvent } from "react";

import { ApiError } from "../../api/core/client";
import {
  NOTE_MAX_LENGTH,
  useCancelAppointment,
  useRescheduleAppointment,
  useUpdateAppointmentNote,
  type Appointment,
  type CancelReason,
} from "../../api/scheduling";
import { Button } from "../forms/Button";
import { TextArea } from "../forms/TextArea";
import { TextField } from "../forms/TextField";
import { CANCEL_REASON_LABELS } from "../../lib/labels";
import { instituteClock, instituteDate, instituteDateTime, instituteToday, minutesBetween } from "../../lib/time";
import { SlotPicker } from "./SlotPicker";

type Panel = "move" | "cancel" | "note";

/**
 * Move, cancel or annotate one appointment: what reception used to do with a phone and a
 * sticky note. One panel opens at a time, right under the appointment it changes.
 */
export function ManageAppointment({ appointment }: { appointment: Appointment }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const panelId = useId();
  const scheduled = appointment.status === "scheduled";
  const close = () => setOpen(null);

  function toggle(panel: Panel) {
    setOpen((current) => (current === panel ? null : panel));
  }

  return (
    <>
      <div className="rf-card__actions">
        {scheduled && (
          <ToggleButton panel="move" open={open} panelId={panelId} onToggle={toggle} who={appointment.patient_name}>
            Déplacer
          </ToggleButton>
        )}
        {scheduled && (
          <ToggleButton panel="cancel" open={open} panelId={panelId} onToggle={toggle} who={appointment.patient_name}>
            Annuler
          </ToggleButton>
        )}
        <ToggleButton panel="note" open={open} panelId={panelId} onToggle={toggle} who={appointment.patient_name}>
          {appointment.note ? "Modifier la note" : "Ajouter une note"}
        </ToggleButton>
      </div>
      {open && (
        <div id={panelId} className="rf-inline-panel">
          {open === "move" && <MoveForm appointment={appointment} onDone={close} />}
          {open === "cancel" && <CancelForm appointment={appointment} onDone={close} />}
          {open === "note" && <NoteForm appointment={appointment} onDone={close} />}
        </div>
      )}
    </>
  );
}

function ToggleButton(props: {
  panel: Panel;
  open: Panel | null;
  panelId: string;
  who: string;
  onToggle: (panel: Panel) => void;
  children: string;
}) {
  const expanded = props.open === props.panel;
  return (
    <Button
      variant="secondary"
      className="rf-btn--compact rf-btn--quiet"
      aria-expanded={expanded}
      aria-controls={expanded ? props.panelId : undefined}
      onClick={() => props.onToggle(props.panel)}
    >
      {props.children}
      <span className="rf-visually-hidden"> · {props.who}</span>
    </Button>
  );
}

function MoveForm({ appointment, onDone }: { appointment: Appointment; onDone: () => void }) {
  const move = useRescheduleAppointment();
  const minutes = minutesBetween(appointment.starts_at, appointment.ends_at);
  const [date, setDate] = useState(() => {
    const day = instituteDate(appointment.starts_at);
    return day < instituteToday() ? instituteToday() : day;
  });
  const [time, setTime] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const start = instituteDateTime(date, time);
    move.mutate(
      {
        appointmentId: appointment.id,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="rf-form" onSubmit={submit} aria-label={`Déplacer le rendez-vous de ${appointment.patient_name}`}>
      <p className="rf-muted">
        Même durée ({minutes} min), avec {appointment.professional_name}. Actuellement à{" "}
        {instituteClock(appointment.starts_at).replace(":", " h ")}.
      </p>
      <TextField
        label="Nouvelle date"
        type="date"
        required
        min={instituteToday()}
        value={date}
        onChange={(event) => {
          setDate(event.target.value);
          setTime("");
        }}
      />
      <SlotPicker
        professionalId={appointment.professional_id}
        day={date}
        minutes={minutes}
        value={time}
        onChange={setTime}
        context={{ patientId: appointment.patient_id, ignoreId: appointment.id }}
      />
      <TextField
        label="Nouvelle heure"
        type="time"
        required
        step={300}
        hint="Heure de Paris."
        value={time}
        onChange={(event) => setTime(event.target.value)}
      />
      {move.isError && (
        <p className="rf-field__error" role="alert">
          {move.error instanceof ApiError && move.error.status === 409
            ? "Ce créneau n’est plus libre. Choisissez-en un autre."
            : "Le rendez-vous n’a pas été déplacé. Réessayez."}
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={move.isPending}>
          Déplacer le rendez-vous
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={move.isPending}>
          Retour
        </Button>
      </div>
    </form>
  );
}

const REASONS = Object.entries(CANCEL_REASON_LABELS) as [CancelReason, string][];

function CancelForm({ appointment, onDone }: { appointment: Appointment; onDone: () => void }) {
  const cancel = useCancelAppointment();
  const [reason, setReason] = useState<CancelReason>("patient_request");
  const name = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    cancel.mutate({ appointmentId: appointment.id, reason }, { onSuccess: onDone });
  }

  return (
    <form className="rf-form" onSubmit={submit} aria-label={`Annuler le rendez-vous de ${appointment.patient_name}`}>
      <fieldset className="rf-question">
        <legend>Pourquoi ce rendez-vous est-il annulé ?</legend>
        <div className="rf-choices">
          {REASONS.map(([value, label]) => (
            <label key={value} className="rf-choice">
              <input
                type="radio"
                name={name}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {cancel.isError && (
        <p className="rf-field__error" role="alert">
          L’annulation n’a pas abouti. Réessayez.
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={cancel.isPending}>
          Annuler le rendez-vous
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={cancel.isPending}>
          Garder le rendez-vous
        </Button>
      </div>
    </form>
  );
}

function NoteForm({ appointment, onDone }: { appointment: Appointment; onDone: () => void }) {
  const save = useUpdateAppointmentNote();
  const [note, setNote] = useState(appointment.note ?? "");

  function submit(event: FormEvent, value = note) {
    event.preventDefault();
    save.mutate({ appointmentId: appointment.id, note: value }, { onSuccess: onDone });
  }

  return (
    <form className="rf-form" onSubmit={submit} aria-label={`Note sur le rendez-vous de ${appointment.patient_name}`}>
      <TextArea
        label="Note pour l’équipe"
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        autoFocus
        hint={`Visible par l’équipe, pas par le patient. Aucune information médicale. ${note.length}/${NOTE_MAX_LENGTH}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {save.isError && (
        <p className="rf-field__error" role="alert">
          La note n’a pas été enregistrée. Réessayez.
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={save.isPending}>
          Enregistrer la note
        </Button>
        {appointment.note && (
          <Button variant="secondary" onClick={(event) => submit(event, "")} disabled={save.isPending}>
            Effacer la note
          </Button>
        )}
        <Button variant="secondary" className="rf-btn--quiet" onClick={onDone} disabled={save.isPending}>
          Retour
        </Button>
      </div>
    </form>
  );
}
