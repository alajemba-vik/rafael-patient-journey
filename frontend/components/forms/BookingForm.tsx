import { useState, type FormEvent } from "react";

import { ApiError } from "../../api/client";
import { useCareTeam } from "../../api/careTeam";
import { useBookAppointment } from "../../api/scheduling";
import { ROLE_LABELS } from "../labels";
import { Button } from "./Button";
import { SelectField } from "./SelectField";
import { TextField } from "./TextField";

const DURATIONS = [30, 45, 60, 90];
// The intake with a coordinator lasts about an hour or more, as the Institute describes it.
const COORDINATION_MINUTES = 60;
const SESSION_MINUTES = 45;

/** Book an appointment with a member of the patient's care team. */
export function BookingForm({ patientId }: { patientId: string }) {
  const team = useCareTeam(patientId);
  const book = useBookAppointment();
  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState(SESSION_MINUTES);
  const [booked, setBooked] = useState(false);

  function chooseMember(id: string) {
    setMemberId(id);
    const member = team.data?.find((m) => m.user_id === id);
    setMinutes(member?.role === "coordinator" ? COORDINATION_MINUTES : SESSION_MINUTES);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setBooked(false);
    const start = new Date(`${date}T${time}`);
    const end = new Date(start.getTime() + minutes * 60_000);
    book.mutate(
      { patient_id: patientId, professional_id: memberId, starts_at: start.toISOString(), ends_at: end.toISOString() },
      { onSuccess: () => setBooked(true) },
    );
  }

  const error =
    book.error instanceof ApiError && book.error.status === 409
      ? "Ce créneau n’est pas libre pour le patient ou pour la personne choisie."
      : book.isError
        ? "La prise de rendez-vous n’a pas abouti. Réessayez."
        : undefined;

  return (
    <form className="rf-form rf-narrow" onSubmit={submit}>
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
      <div className="rf-row">
        <TextField label="Date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
        <TextField
          label="Heure"
          type="time"
          required
          step={300}
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
        <SelectField label="Durée" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} min
            </option>
          ))}
        </SelectField>
      </div>
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
