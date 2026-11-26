import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCareStaff } from "../../api/care_team";
import { useWeekPlanning, type PlanningSlot } from "../../api/scheduling";
import { formatTime, formatWeekday } from "../../lib/format";
import { addDays, instituteDate, instituteToday, mondayOf } from "../../lib/time";
import { QueryState } from "../feedback/QueryState";
import { Button } from "../forms/Button";
import { TextField } from "../forms/TextField";

// Readable on one screen; the API refuses more.
const MAX_PEOPLE = 12;
const WEEKDAYS = 5;

function Slot({ slot }: { slot: PlanningSlot }) {
  const { t } = useTranslation();
  return (
    <li className={`rf-planning__slot rf-planning__slot--${slot.status}`}>
      <span className="rf-planning__time">
        {formatTime(slot.starts_at)}–{formatTime(slot.ends_at)}
      </span>{" "}
      {slot.patient_name ?? <span className="rf-muted">{t("planning.taken")}</span>}
      {slot.status === "no_show" && <span className="rf-visually-hidden"> · {t("labels.status.no_show")}</span>}
    </li>
  );
}

/** Several practitioners' weeks side by side: one row per person, one column per weekday. */
export function WeekPlanning() {
  const { t } = useTranslation();
  const staff = useCareStaff();
  const [monday, setMonday] = useState(() => mondayOf(instituteToday()));
  const [chosen, setChosen] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const planning = useWeekPlanning(monday, chosen);
  const days = Array.from({ length: WEEKDAYS }, (_, i) => addDays(monday, i));
  const people = (staff.data ?? []).filter((person) => chosen.includes(person.id));

  function toggle(id: string) {
    setChosen(chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id]);
  }

  return (
    <div className="rf-planning">
      <aside className="rf-panel rf-stack">
        <p className="rf-title">{t("planning.whoTitle")}</p>
        <p className="rf-muted" aria-live="polite">
          {t("planning.chosen", { count: chosen.length, max: MAX_PEOPLE })}
        </p>
        <TextField label={t("planning.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <QueryState query={staff}>
          {(list) => (
            <div className="rf-choices rf-choices--scroll">
              {list
                .filter((p) =>
                  `${p.full_name} ${p.discipline ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
                )
                .map((person) => (
                  <label key={person.id} className="rf-choice">
                    <input
                      type="checkbox"
                      checked={chosen.includes(person.id)}
                      disabled={!chosen.includes(person.id) && chosen.length >= MAX_PEOPLE}
                      onChange={() => toggle(person.id)}
                    />
                    <span>
                      {person.full_name}
                      {person.discipline && <span className="rf-muted"> · {person.discipline}</span>}
                    </span>
                  </label>
                ))}
            </div>
          )}
        </QueryState>
      </aside>

      <div className="rf-stack">
        <div className="rf-daynav" role="group" aria-label={t("planning.chooseWeek")}>
          <Button variant="secondary" onClick={() => setMonday(addDays(monday, -7))}>
            <span aria-hidden="true">‹</span> {t("planning.previousWeek")}
          </Button>
          <Button variant="secondary" onClick={() => setMonday(mondayOf(instituteToday()))}>
            {t("planning.thisWeek")}
          </Button>
          <Button variant="secondary" onClick={() => setMonday(addDays(monday, 7))}>
            {t("planning.nextWeek")} <span aria-hidden="true">›</span>
          </Button>
        </div>
        {chosen.length === 0 ? (
          <p className="rf-state">{t("planning.chooseSomeone")}</p>
        ) : (
          <QueryState query={planning}>
            {(slots) => (
              <div className="rf-table-wrap">
                <table className="rf-table rf-planning__grid">
                  <caption className="rf-visually-hidden">{t("planning.caption")}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("planning.person")}</th>
                      {days.map((day) => (
                        <th key={day} scope="col">
                          {formatWeekday(`${day}T12:00:00Z`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((person) => (
                      <tr key={person.id}>
                        <th scope="row">
                          {person.full_name}
                          {person.discipline && (
                            <>
                              <br />
                              <span className="rf-muted">{person.discipline}</span>
                            </>
                          )}
                        </th>
                        {days.map((day) => {
                          const daySlots = slots.filter(
                            (s) => s.professional_id === person.id && instituteDate(s.starts_at) === day,
                          );
                          return (
                            <td key={day}>
                              {daySlots.length === 0 ? (
                                <span className="rf-muted">{t("planning.free")}</span>
                              ) : (
                                <ul className="rf-planning__slots">
                                  {daySlots.map((slot) => (
                                    <Slot key={slot.id} slot={slot} />
                                  ))}
                                </ul>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryState>
        )}
      </div>
    </div>
  );
}
