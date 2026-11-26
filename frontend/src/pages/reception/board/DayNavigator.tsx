import { useTranslation } from "react-i18next";

import { Button } from "../../../components/forms/Button";
import { TextField } from "../../../components/forms/TextField";
import { addDays } from "../../../lib/time";

// The agenda's range, as the API accepts it.
const FIRST_DAY = "2000-01-01";
const LAST_DAY = "2100-12-31";

type Props = { day: string; today: string; onChange: (day: string) => void };

/** Step through days, jump back to today, or pick any date: reception plans ahead and looks back. */
export function DayNavigator({ day, today, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className="rf-daynav" role="group" aria-label={t("board.chooseDay")}>
      <Button variant="secondary" onClick={() => onChange(addDays(day, -1))}>
        <span aria-hidden="true">‹</span> {t("board.previousDay")}
      </Button>
      <Button variant="secondary" onClick={() => onChange(today)} disabled={day === today}>
        {t("board.today")}
      </Button>
      <Button variant="secondary" onClick={() => onChange(addDays(day, 1))}>
        {t("board.nextDay")} <span aria-hidden="true">›</span>
      </Button>
      <TextField
        label={t("board.day")}
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
