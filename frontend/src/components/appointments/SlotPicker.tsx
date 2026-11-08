import { useId } from "react";

import { useAvailability, type AvailabilityFor } from "../../api/scheduling";
import { formatTime } from "../../lib/format";
import { instituteClock } from "../../lib/time";

type Props = {
  professionalId: string;
  day: string;
  minutes: number;
  /** The chosen time on the Institute's clock, "14:30". */
  value: string;
  onChange: (time: string) => void;
  /** Also leave out the patient's other bookings, and the appointment being moved. */
  context?: AvailabilityFor;
};

const NOON = "12:00";

/** The practitioner's free times that day, as large tappable choices: no phoning around. */
export function SlotPicker({ professionalId, day, minutes, value, onChange, context }: Props) {
  const availability = useAvailability(professionalId, day, minutes, context);
  const name = useId();

  if (!professionalId || !day) {
    return <p className="rf-muted">Choisissez la personne et la date pour voir les créneaux libres.</p>;
  }
  if (availability.isPending) {
    return (
      <p className="rf-muted" role="status">
        Recherche des créneaux libres…
      </p>
    );
  }
  if (availability.isError) {
    return <p className="rf-muted">Créneaux indisponibles pour le moment : saisissez l’heure ci-dessous.</p>;
  }

  const slots = availability.data.free.map((slot) => ({ time: instituteClock(slot.starts_at), at: slot.starts_at }));
  if (slots.length === 0) {
    return <p className="rf-muted">Aucun créneau libre de {minutes} min ce jour-là. Essayez une autre date.</p>;
  }

  const groups = [
    { label: "Matin", slots: slots.filter((s) => s.time < NOON) },
    { label: "Après-midi", slots: slots.filter((s) => s.time >= NOON) },
  ].filter((group) => group.slots.length > 0);

  return (
    <div className="rf-stack">
      {groups.map((group) => (
        <fieldset key={group.label} className="rf-question">
          <legend>
            {group.label} <span className="rf-muted">· créneaux libres de {minutes} min</span>
          </legend>
          <div className="rf-choices">
            {group.slots.map((slot) => (
              <label key={slot.at} className="rf-choice">
                <input
                  type="radio"
                  name={name}
                  value={slot.time}
                  checked={value === slot.time}
                  onChange={() => onChange(slot.time)}
                />
                <span>{formatTime(slot.at)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
