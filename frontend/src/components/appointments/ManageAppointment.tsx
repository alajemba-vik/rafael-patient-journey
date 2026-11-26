import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

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
import { formatTime } from "../../lib/format";
import { CANCEL_REASONS } from "../../lib/labels";
import { instituteDate, instituteDateTime, instituteToday, minutesBetween } from "../../lib/time";
import { SlotPicker } from "./SlotPicker";

type Panel = "move" | "cancel" | "note";

/**
 * Move, cancel or annotate one appointment: what reception used to do with a phone and a
 * sticky note. One panel opens at a time, right under the appointment it changes.
 */
export function ManageAppointment({ appointment }: { appointment: Appointment }) {
  const { t } = useTranslation();
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
            {t("manage.move")}
          </ToggleButton>
        )}
        {scheduled && (
          <ToggleButton panel="cancel" open={open} panelId={panelId} onToggle={toggle} who={appointment.patient_name}>
            {t("manage.cancel")}
          </ToggleButton>
        )}
        <ToggleButton panel="note" open={open} panelId={panelId} onToggle={toggle} who={appointment.patient_name}>
          {appointment.note ? t("manage.editNote") : t("manage.addNote")}
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
  const { t } = useTranslation();
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
    <form
      className="rf-form"
      onSubmit={submit}
      aria-label={t("manage.moveFormLabel", { name: appointment.patient_name })}
    >
      <p className="rf-muted">
        {t("manage.moveIntro", {
          minutes,
          professional: appointment.professional_name,
          time: formatTime(appointment.starts_at),
        })}
      </p>
      <TextField
        label={t("manage.newDate")}
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
        label={t("manage.newTime")}
        type="time"
        required
        step={300}
        hint={t("manage.parisTime")}
        value={time}
        onChange={(event) => setTime(event.target.value)}
      />
      {move.isError && (
        <p className="rf-field__error" role="alert">
          {move.error instanceof ApiError && move.error.status === 409 ? t("manage.moveTaken") : t("manage.moveFailed")}
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={move.isPending}>
          {t("manage.moveSubmit")}
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={move.isPending}>
          {t("common.back")}
        </Button>
      </div>
    </form>
  );
}

function CancelForm({ appointment, onDone }: { appointment: Appointment; onDone: () => void }) {
  const { t } = useTranslation();
  const cancel = useCancelAppointment();
  const [reason, setReason] = useState<CancelReason>("patient_request");
  const name = useId();

  function submit(event: FormEvent) {
    event.preventDefault();
    cancel.mutate({ appointmentId: appointment.id, reason }, { onSuccess: onDone });
  }

  return (
    <form
      className="rf-form"
      onSubmit={submit}
      aria-label={t("manage.cancelFormLabel", { name: appointment.patient_name })}
    >
      <fieldset className="rf-question">
        <legend>{t("manage.cancelQuestion")}</legend>
        <div className="rf-choices">
          {CANCEL_REASONS.map((value) => (
            <label key={value} className="rf-choice">
              <input
                type="radio"
                name={name}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              <span>{t(`labels.cancelReason.${value}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {cancel.isError && (
        <p className="rf-field__error" role="alert">
          {t("manage.cancelFailed")}
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={cancel.isPending}>
          {t("manage.cancelSubmit")}
        </Button>
        <Button variant="secondary" onClick={onDone} disabled={cancel.isPending}>
          {t("manage.keep")}
        </Button>
      </div>
    </form>
  );
}

function NoteForm({ appointment, onDone }: { appointment: Appointment; onDone: () => void }) {
  const { t } = useTranslation();
  const save = useUpdateAppointmentNote();
  const [note, setNote] = useState(appointment.note ?? "");

  function submit(event: FormEvent, value = note) {
    event.preventDefault();
    save.mutate({ appointmentId: appointment.id, note: value }, { onSuccess: onDone });
  }

  return (
    <form
      className="rf-form"
      onSubmit={submit}
      aria-label={t("manage.noteFormLabel", { name: appointment.patient_name })}
    >
      <TextArea
        label={t("manage.noteLabel")}
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        autoFocus
        hint={t("manage.noteHint", { length: note.length, max: NOTE_MAX_LENGTH })}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {save.isError && (
        <p className="rf-field__error" role="alert">
          {t("manage.noteFailed")}
        </p>
      )}
      <div className="rf-actions">
        <Button type="submit" pending={save.isPending}>
          {t("manage.noteSave")}
        </Button>
        {appointment.note && (
          <Button variant="secondary" onClick={(event) => submit(event, "")} disabled={save.isPending}>
            {t("manage.noteClear")}
          </Button>
        )}
        <Button variant="secondary" className="rf-btn--quiet" onClick={onDone} disabled={save.isPending}>
          {t("common.back")}
        </Button>
      </div>
    </form>
  );
}
