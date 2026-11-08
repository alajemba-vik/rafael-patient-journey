import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { addDays } from "../../../lib/time";

// The agenda's range, as the API accepts it.
const FIRST_DAY = "2000-01-01";
const LAST_DAY = "2100-12-31";

type Props = { day: string; today: string; onChange: (day: string) => void };

/** Step through days, jump back to today, or pick any date: reception plans ahead and looks back. */
export function DayNavigator({ day, today, onChange }: Props) {
  return (
    <div className="rf-daynav" role="group" aria-label="Choisir le jour">
      <Button variant="secondary" onClick={() => onChange(addDays(day, -1))}>
        <span aria-hidden="true">‹</span> Veille
      </Button>
      <Button variant="secondary" onClick={() => onChange(today)} disabled={day === today}>
        Aujourd’hui
      </Button>
      <Button variant="secondary" onClick={() => onChange(addDays(day, 1))}>
        Lendemain <span aria-hidden="true">›</span>
      </Button>
      <TextField
        label="Jour"
        type="date"
        value={day}
        min={FIRST_DAY}
        max={LAST_DAY}
        onChange={(event) => {
          // Typing a year digit by digit passes through 0002, 0020…: wait for a real date.
          const value = event.target.value;
          if (value >= FIRST_DAY && value <= LAST_DAY) onChange(value);
        }}
      />
    </div>
  );
}
