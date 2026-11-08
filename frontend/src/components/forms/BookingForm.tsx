import { useState, type FormEvent } from "react";

import { ApiError } from "../../api/core/client";
import { useCareTeam } from "../../api/care_team";
import { NOTE_MAX_LENGTH, useBookAppointment } from "../../api/scheduling";
import { SlotPicker } from "../appointments/SlotPicker";
import { ROLE_LABELS } from "../../lib/labels";
import { instituteDateTime, instituteToday } from "../../lib/time";
import { Button } from "./Button";
import { SelectField } from "./SelectField";
import { TextArea } from "./TextArea";
import { TextField } from "./TextField";

const DURATIONS = [30, 45, 60, 90];
// The intake with a coordinator lasts about an hour or more, as the Institute describes it.
const COORDINATION_MINUTES = 60;
const SESSION_MINUTES = 45;

type Props = {
  patientId: string;
  /** Book only with this person: a practitioner booking a follow-up with themselves. */
  practitioner?: { id: string; name: string };
};

/** Book an appointment with a member of the patient's care team, picking from their free times. */
export function BookingForm({ patientId, practitioner }: Props) {
  const team = useCareTeam(patientId);
  const book = useBookAppointment();
  const [memberId, setMemberId] = useState(practitioner?.id ?? "");
  const [date, setDate] = useState(instituteToday);
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState(SESSION_MINUTES);
  const [note, setNote] = useState("");
  const [booked, setBooked] = useState(false);

  function chooseMember(id: string) {
    setMemberId(id);
    setTime("");
    const member = team.data?.find((m) => m.user_id === id);
    setMinutes(member?.role === "coordinator" ? COORDINATION_MINUTES : SESSION_MINUTES);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setBooked(false);
    // The time typed means the Institute's clock, even from a browser set to another zone.
    const start = instituteDateTime(date, time);
    const end = new Date(start.getTime() + minutes * 60_000);
    book.mutate(
      {
        patient_id: patientId,
        professional_id: memberId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        note,
      },
      {
        onSuccess: () => {
          setBooked(true);
          setTime("");
          setNote("");
        },
      },
    );
  }

  const error =
    book.error instanceof ApiError && book.error.status === 409
      ? "Ce créneau n’est pas libre pour le patient ou pour la personne choisie."
      : book.error instanceof ApiError && book.error.status === 400
        ? "Ce jour est déjà passé : choisissez aujourd’hui ou une date à venir."
        : book.isError
          ? "La prise de rendez-vous n’a pas abouti. Réessayez."
          : undefined;

  return (
    <form className="rf-form rf-narrow" onSubmit={submit}>
      {practitioner ? (
        <p className="rf-muted">Séance avec vous ({practitioner.name}).</p>
      ) : (
        <SelectField
          label="Avec"
          required
          value={memberId}
          onChange={(event) => chooseMember(event.target.value)}
          hint={team.data?.length === 0 ? "Ajoutez d’abord quelqu’un à l’équipe de soins." : undefined}
        >
          <option value="">Choisir dans l’équipe de soins</option>
          {team.data?.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name} · {m.discipline ?? ROLE_LABELS[m.role]}
            </option>
          ))}
        </SelectField>
      )}
      <div className="rf-row">
        <TextField
          label="Date"
          type="date"
          required
          min={instituteToday()}
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setTime("");
          }}
        />
        <SelectField label="Durée" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} min
            </option>
          ))}
        </SelectField>
      </div>
      <SlotPicker
        professionalId={memberId}
        day={date}
        minutes={minutes}
        value={time}
        onChange={setTime}
        context={{ patientId }}
      />
      <TextField
        label="Heure"
        type="time"
        required
        hint="Heure de Paris. Choisissez un créneau ci-dessus ou saisissez une autre heure."
        step={300}
        value={time}
        onChange={(event) => setTime(event.target.value)}
      />
      <TextArea
        label="Note pour l’équipe (facultatif)"
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        hint="Visible par l’équipe, pas par le patient. Aucune information médicale."
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {error && (
        <p className="rf-field__error" role="alert">
          {error}
        </p>
      )}
      {booked && (
        <p className="rf-banner" role="status">
          Rendez-vous enregistré.
        </p>
      )}
      <Button type="submit" pending={book.isPending}>
        Prendre le rendez-vous
      </Button>
    </form>
  );
}
